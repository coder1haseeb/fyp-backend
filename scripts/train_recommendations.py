"""Train an optional LightGBM ranker from recommendation impressions.

Run from the backend directory after installing requirements-recommendations.txt.
The API keeps using its hybrid ranker unless a model beats it on a later holdout.
"""

import json
import math
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import lightgbm as lgb
import numpy as np
from dotenv import load_dotenv
from pymongo import MongoClient


ROOT = Path(__file__).resolve().parents[1]
FEATURE_NAMES = json.loads((ROOT / "utils" / "recommendationFeatures.json").read_text(encoding="utf-8"))
WINDOW = timedelta(hours=24)


def ndcg_at_4(groups, scores):
    offset = 0
    results = []
    for group in groups:
        predicted = scores[offset:offset + len(group)]
        offset += len(group)
        labels = [row["label"] for row in group]
        def dcg(indices):
            return sum((2 ** labels[i] - 1) / math.log2(position + 2)
                       for position, i in enumerate(indices[:4]))
        ideal = dcg(sorted(range(len(group)), key=lambda i: labels[i], reverse=True))
        if ideal:
            actual = dcg(sorted(range(len(group)), key=lambda i: predicted[i], reverse=True))
            results.append(actual / ideal)
    return sum(results) / len(results) if results else 0.0


def flatten(groups):
    rows = [row for group in groups for row in group]
    return ([row["features"] for row in rows], [row["label"] for row in rows],
            [len(group) for group in groups])


def load_groups(db):
    end = datetime.now(timezone.utc) - WINDOW
    start = end - timedelta(days=90)
    impressions = list(db.recommendationimpressions.find(
        {"createdAt": {"$gte": start, "$lt": end}},
        {"requestId": 1, "customer": 1, "product": 1, "features": 1,
         "baselineScore": 1, "createdAt": 1, "position": 1},
    ).sort("createdAt", 1))
    if not impressions:
        return []

    events = db.interactions.find(
        {"createdAt": {"$gte": start, "$lt": end + WINDOW},
         "interactionType": {"$in": ["view", "add_to_cart", "purchase"]}},
        {"customer": 1, "product": 1, "interactionType": 1, "createdAt": 1},
    )
    by_pair = defaultdict(list)
    for event in events:
        by_pair[(event["customer"], event["product"])].append(event)

    by_request = defaultdict(list)
    for impression in impressions:
        features = impression.get("features") or []
        if len(features) != len(FEATURE_NAMES) or not all(
                isinstance(value, (int, float)) and math.isfinite(value) for value in features):
            continue
        shown_at = impression["createdAt"]
        label = 0
        for event in by_pair[(impression["customer"], impression["product"])]:
            if shown_at < event["createdAt"] <= shown_at + WINDOW:
                label = max(label, {"view": 1, "add_to_cart": 2, "purchase": 3}[event["interactionType"]])
        by_request[impression["requestId"]].append({
            "features": features, "baseline": impression["baselineScore"],
            "label": label, "position": impression["position"], "created": shown_at,
        })

    groups = [sorted(rows, key=lambda row: row["position"])
              for rows in by_request.values() if len(rows) >= 2]
    return sorted(groups, key=lambda rows: rows[0]["created"])


def train(groups, output):
    if len(groups) < 100 or sum(any(row["label"] > 0 for row in g) for g in groups) < 30:
        print("Not enough recommendation feedback yet; keeping the hybrid ranker.")
        return False
    split = int(len(groups) * 0.8)
    training, validation = groups[:split], groups[split:]
    if len(validation) < 20 or not any(row["label"] > 0 for g in validation for row in g):
        print("Not enough later validation feedback; keeping the hybrid ranker.")
        return False

    x_train, y_train, train_sizes = flatten(training)
    x_val, y_val, val_sizes = flatten(validation)
    x_train = np.asarray(x_train, dtype=np.float64)
    y_train = np.asarray(y_train, dtype=np.int32)
    x_val = np.asarray(x_val, dtype=np.float64)
    y_val = np.asarray(y_val, dtype=np.int32)
    ranker = lgb.LGBMRanker(
        objective="lambdarank", n_estimators=120, learning_rate=0.05,
        num_leaves=15, min_child_samples=10, random_state=42,
        verbosity=-1, n_jobs=2,
    )
    ranker.fit(x_train, y_train, group=train_sizes,
               eval_set=[(x_val, y_val)], eval_group=[val_sizes],
               eval_at=[4], feature_name=FEATURE_NAMES,
               callbacks=[lgb.early_stopping(15, verbose=False)])
    model_scores = list(ranker.predict(x_val, num_iteration=ranker.best_iteration_))
    baseline_scores = [row["baseline"] for group in validation for row in group]
    learned_ndcg = ndcg_at_4(validation, model_scores)
    baseline_ndcg = ndcg_at_4(validation, baseline_scores)
    print(f"Holdout NDCG@4: LightGBM={learned_ndcg:.4f}, hybrid={baseline_ndcg:.4f}")
    if learned_ndcg < baseline_ndcg + 0.01:
        print("Learned model did not improve ranking; keeping the hybrid ranker.")
        return False

    artifact = ranker.booster_.dump_model(num_iteration=ranker.best_iteration_)
    artifact["trained_at"] = datetime.now(timezone.utc).isoformat()
    artifact["validation_ndcg_at_4"] = learned_ndcg
    artifact["baseline_ndcg_at_4"] = baseline_ndcg
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(artifact, handle, allow_nan=False)
    os.replace(temporary, output)
    print(f"Saved validated ranker to {output}")
    return True


if __name__ == "__main__":
    load_dotenv(ROOT / ".env")
    if not os.environ.get("MONGO_URI"):
        raise SystemExit("MONGO_URI is required")
    output_path = Path(os.environ.get("RECOMMENDER_MODEL_PATH") or
                       ROOT / "artifacts" / "recommendation-ranker.json")
    with MongoClient(os.environ["MONGO_URI"], serverSelectionTimeoutMS=10000) as client:
        database = client.get_default_database(default=os.environ.get("MONGO_DB_NAME", "test"))
        train(load_groups(database), output_path)

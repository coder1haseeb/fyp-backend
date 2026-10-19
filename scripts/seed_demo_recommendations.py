"""Create isolated synthetic recommendation feedback and a short-lived demo ranker.

This never inserts records into real impressions or interactions. The normal
daily trainer remains based solely on actual customer feedback.
"""

import argparse
import json
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

from train_recommendations import ROOT, train


SEED_VERSION = "presentation-demo-v1"
COLLECTION = "recommendationtrainingseeds"
GROUP_COUNT = 160
PRODUCTS_PER_GROUP = 4


def make_groups():
    randomizer = random.Random(20261020)
    start = datetime.now(timezone.utc) - timedelta(days=3)
    groups = []
    documents = []

    for group_number in range(GROUP_COUNT):
        request_id = f"{SEED_VERSION}-{group_number:03d}"
        created = start + timedelta(minutes=group_number * 15)
        candidates = []
        for position in range(PRODUCTS_PER_GROUP):
            content = randomizer.random()
            collaborative = randomizer.random()
            popularity = randomizer.random()
            local = randomizer.choice([0, 0, 1])
            freshness = randomizer.random()
            price_log = randomizer.uniform(5.7, 9.2)
            stock_log = randomizer.uniform(1.0, 4.8)
            prior_interest = randomizer.uniform(0, 1.5)
            features = [content, collaborative, popularity, local,
                        freshness, price_log, stock_log, prior_interest]
            baseline = 0.65 * popularity + 0.2 * local + 0.15 * freshness
            preference = (1.2 * local + 0.9 * content + 0.5 * prior_interest
                          + 0.15 * stock_log - 0.25 * price_log
                          + randomizer.uniform(-0.03, 0.03))
            candidates.append({
                "features": features, "baseline": baseline, "label": 0,
                "position": position, "created": created,
                "preference": preference,
            })

        # Some displays have no engagement, as happens with real recommendations.
        if group_number % 5:
            selected = max(candidates, key=lambda row: row["preference"])
            selected["label"] = (1, 2, 3)[group_number % 3]

        group = []
        for row in candidates:
            training_row = {key: row[key] for key in
                            ("features", "baseline", "label", "position", "created")}
            group.append(training_row)
            documents.append({
                "_id": f"{request_id}-{row['position']}",
                "seedVersion": SEED_VERSION,
                "source": "synthetic_demo",
                "requestId": request_id,
                "demoShopperId": f"demo-shopper-{group_number % 20:02d}",
                "demoProductId": f"demo-product-{row['position']:02d}",
                "features": row["features"],
                "baselineScore": row["baseline"],
                "feedbackLabel": row["label"],
                "position": row["position"],
                "createdAt": row["created"],
            })
        groups.append(group)
    return groups, documents


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--activate", action="store_true",
                        help="Write demo feedback to MongoDB and activate a 48-hour demo model")
    arguments = parser.parse_args()
    if not arguments.activate:
        parser.error("pass --activate to create the isolated demo dataset and model")

    load_dotenv(ROOT / ".env")
    if not os.environ.get("MONGO_URI"):
        raise SystemExit("MONGO_URI is required")
    output = Path(os.environ.get("RECOMMENDER_MODEL_PATH") or
                  ROOT / "artifacts" / "recommendation-ranker.json")
    if output.exists():
        existing = json.loads(output.read_text(encoding="utf-8"))
        if existing.get("training_source") != "synthetic_demo":
            raise SystemExit("A non-demo model already exists; leaving it untouched")

    groups, documents = make_groups()
    draft = output.with_name("recommendation-demo-draft.json")
    if not train(groups, draft):
        raise SystemExit("Demo ranker did not pass its holdout check")

    artifact = json.loads(draft.read_text(encoding="utf-8"))
    artifact["training_source"] = "synthetic_demo"
    artifact["demo_expires_at"] = (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()
    artifact["seed_version"] = SEED_VERSION

    with MongoClient(os.environ["MONGO_URI"], serverSelectionTimeoutMS=10000) as client:
        database = client.get_default_database(default=os.environ.get("MONGO_DB_NAME", "test"))
        collection = database[COLLECTION]
        collection.delete_many({"seedVersion": SEED_VERSION})
        collection.insert_many(documents)

    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps(artifact, allow_nan=False), encoding="utf-8")
    os.replace(temporary, output)
    draft.unlink(missing_ok=True)
    print(f"Inserted {len(documents)} isolated synthetic feedback rows into {COLLECTION}")
    print(f"Activated clearly marked demo ranker until {artifact['demo_expires_at']}")


if __name__ == "__main__":
    main()

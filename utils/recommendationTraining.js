const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const TRAINING_CONFIG = require('../config/recommendationTraining.json');

const root = path.join(__dirname, '..');
const modelFile = () => process.env.RECOMMENDER_MODEL_PATH || path.join(root, 'artifacts', 'recommendation-ranker.json');
let run = { state: 'idle', message: 'Training has not been started from the admin panel.' };

function modelStatus() {
  try {
    const model = JSON.parse(fs.readFileSync(modelFile(), 'utf8'));
    const active = Array.isArray(model.tree_info) && model.tree_info.length > 0 &&
      Number.isFinite(model.validation_ndcg_at_4) && Number.isFinite(model.baseline_ndcg_at_4) &&
      model.validation_ndcg_at_4 >= model.baseline_ndcg_at_4 + TRAINING_CONFIG.minimumImprovement &&
      (model.training_source !== 'synthetic_demo' || Date.now() < Date.parse(model.demo_expires_at));
    return active ? {
      active: true,
      source: model.training_source === 'synthetic_demo' ? 'demo' :
        model.training_source === 'provisional_feedback' ? 'provisional feedback' : 'real feedback',
      trainedAt: model.trained_at,
      validationNdcg: model.validation_ndcg_at_4,
      baselineNdcg: model.baseline_ndcg_at_4,
    } : { active: false };
  } catch {
    return { active: false };
  }
}

function status() {
  return { ...run, model: modelStatus() };
}

function start() {
  if (run.state === 'running') return { started: false, status: status() };
  const previousMtime = (() => { try { return fs.statSync(modelFile()).mtimeMs; } catch { return 0; } })();
  run = { state: 'running', startedAt: new Date().toISOString(), message: 'Training with feedback observed so far is running. Recent labels are provisional.' };
  const virtualPython = path.join(root, '.venv-recommendations', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const python = process.env.RECOMMENDER_PYTHON ||
    (fs.existsSync(virtualPython) ? virtualPython : process.platform === 'win32' ? 'python' : 'python3');
  const child = spawn(python, ['scripts/train_recommendations.py', '--include-recent'], {
    cwd: root,
    env: process.env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let settled = false;
  const append = chunk => { output = (output + chunk.toString()).slice(-4000); };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  const timeout = setTimeout(() => child.kill(), 10 * 60 * 1000);
  const finish = (code, failure) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    const updated = (() => { try { return fs.statSync(modelFile()).mtimeMs > previousMtime; } catch { return false; } })();
    const failed = Boolean(failure) || code !== 0;
    const message = failed
      ? `Training failed: ${failure?.message || output.trim().split('\n').slice(-2).join(' ').trim() || `exit code ${code}`}`
      : updated ? 'A model trained on provisional feedback passed validation and was saved. The API will use it shortly.'
        : output.includes('Not enough') ? 'Not enough real recommendation feedback yet. The hybrid ranker remains active.'
          : 'The learned model did not beat the hybrid ranker. The existing ranker remains active.';
    run = { state: failed ? 'failed' : updated ? 'trained' : 'skipped', startedAt: run.startedAt,
      finishedAt: new Date().toISOString(), message: message.slice(0, 500) };
  };
  child.on('error', err => finish(null, err));
  child.on('close', code => finish(code));
  return { started: true, status: status() };
}

module.exports = { status, start };

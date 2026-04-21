import { getSession, getCurrentStep, getCurrentWeight } from '../api/brew.js';
import { createPoller } from '../hooks/usePolling.js';
import { createWeightBar } from '../components/WeightBar.js';

function navigate(path) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const weightHistory = [];

function isStable(w) {
  if (weightHistory.length < 5 || w < 5) return false;
  const min = Math.min(...weightHistory);
  const max = Math.max(...weightHistory);
  return max - min <= 2;
}

function pushWeight(w) {
  weightHistory.push(w);
  if (weightHistory.length > 5) weightHistory.shift();
}

function progressBar(stepIndex, totalSteps) {
  const segments = Array.from({ length: totalSteps }, (_, i) => `
    <div class="progress-seg ${i < stepIndex ? 'progress-seg--done' : i === stepIndex ? 'progress-seg--active' : ''}"></div>
  `).join('');
  return `
    <div class="brew-progress">
      <span class="brew-progress__label">Step ${stepIndex + 1} / ${totalSteps}</span>
      <div class="brew-progress__bar">${segments}</div>
    </div>
  `;
}

function stepCard(step) {
  return `
    <div class="step-card">
      <h2 class="step-card__name">${step.name}</h2>
      <p class="step-card__instruction">${step.instruction}</p>
      <span class="step-card__target">Target: ${step.target_weight_g}g</span>
    </div>
  `;
}


export default function render() {
  let stepPoller, weightPoller, weightBar;

  setTimeout(async () => {
    try {
      const session = await getSession();
      if (!session.active) { navigate('/'); return; }
    } catch { navigate('/'); return; }

    await refreshStep();

    stepPoller = createPoller(refreshStep, 1000);
    weightPoller = createPoller(refreshWeight, 400);
    stepPoller.start();
    weightPoller.start();

    window.addEventListener('popstate', () => {
      stepPoller?.stop();
      weightPoller?.stop();
      weightBar?.destroy();
    }, { once: true });
  }, 0);

  return `
    <div class="brew-page">
      <div id="brew-progress-wrap"></div>
      <div id="brew-step-wrap"><div class="brew-loading">Loading brew…</div></div>
      <div id="brew-weight-wrap"></div>
    </div>

    <style>
      .brew-page {
        max-width: 600px;
        margin: 0 auto;
        padding: 1.5rem 1rem 3rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .brew-progress { display: flex; flex-direction: column; gap: 0.5rem; }
      .brew-progress__label { font-size: 0.85rem; color: var(--color-text-muted); }
      .brew-progress__bar { display: flex; gap: 0.3rem; }
      .progress-seg {
        flex: 1; height: 6px; border-radius: 3px;
        background: var(--color-border);
        transition: background 0.3s;
      }
      .progress-seg--done    { background: var(--color-primary-dark); }
      .progress-seg--active  { background: var(--color-primary); }

      .step-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 14px;
        padding: 1.5rem;
        display: flex; flex-direction: column; gap: 0.6rem;
      }
      .step-card__name { font-size: 1.6rem; font-weight: 700; color: var(--color-primary); }
      .step-card__instruction { font-size: 1rem; color: var(--color-text-muted); line-height: 1.5; }
      .step-card__target {
        display: inline-block; font-size: 0.8rem; padding: 0.25rem 0.65rem;
        border-radius: 999px; background: var(--color-bg);
        border: 1px solid var(--color-border); color: var(--color-text-muted);
        align-self: flex-start;
      }

.brew-loading { color: var(--color-text-muted); font-size: 0.95rem; }
    </style>
  `;
}

async function refreshStep() {
  let data;
  try { data = await getCurrentStep(); } catch { return; }

  if (data.complete) { navigate('/complete'); return; }

  const progressWrap = document.getElementById('brew-progress-wrap');
  const stepWrap     = document.getElementById('brew-step-wrap');
  const weightWrap   = document.getElementById('brew-weight-wrap');
  if (!progressWrap || !stepWrap) return;

  progressWrap.innerHTML = progressBar(data.step_index, data.total_steps);
  stepWrap.innerHTML     = stepCard(data);

  if (weightWrap) {
    if (!weightBar) {
      weightBar = createWeightBar(weightWrap);
      weightBar.update({ currentWeight: 0, targetWeight: data.target_weight_g, isStable: false });
    }
    weightWrap.dataset.target = data.target_weight_g;
  }
}

async function refreshWeight() {
  let data;
  try { data = await getCurrentWeight(); } catch { return; }

  const w = data.weight ?? 0;
  pushWeight(w);

  const weightWrap = document.getElementById('brew-weight-wrap');
  if (!weightWrap || !weightBar) return;

  const target = parseFloat(weightWrap.dataset.target ?? 0);
  weightBar.update({ currentWeight: w, targetWeight: target, isStable: isStable(w) });
}

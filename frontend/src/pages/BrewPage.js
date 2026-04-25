import { getSession, getCurrentStep, getCurrentWeight, completeStep, postConfirmedWeight } from '../api/brew.js';
import { createPoller } from '../hooks/usePolling.js';
import { createWeightBar } from '../components/WeightBar.js';
import { createPourAnimation } from '../components/PourAnimation.js';

function navigate(path) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const weightHistory = [];
let weightBar       = null;
let pourAnim        = null;
let lastWeight      = 0;
let stepStartWeight = null;
let currentStepType = 'pour';
let prevStepType    = null;
let timerInterval   = null;
let brewActive      = false;

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
  let targetHtml = '';
  if (step.type === 'wait' && step.duration_s != null) {
    targetHtml = `<span class="step-card__target">Duration: ${step.duration_s}s</span>`;
  } else if (step.target_weight_g != null) {
    targetHtml = `<span class="step-card__target">Target: ${step.target_weight_g}g</span>`;
  }
  return `
    <div class="step-card step-card--${step.type ?? 'pour'}">
      <h2 class="step-card__name">${step.name}</h2>
      <p class="step-card__instruction">${nl2br(step.instruction)}</p>
      ${targetHtml}
    </div>
  `;
}

function nl2br(str) {
  return (str ?? '').replace(/\n/g, '<br>');
}

function renderTimer(durationS) {
  return `
    <div class="timer-wrap" id="timer-wrap">
      <div class="timer-display" id="timer-display">${durationS}s</div>
      <button class="btn-timer" id="btn-start-timer">Start Timer</button>
    </div>
  `;
}

export default function render() {
  brewActive = true;
  weightBar = null;
  pourAnim  = null;
  lastWeight = 0;
  currentStepType = 'pour';
  weightHistory.length = 0;
  clearInterval(timerInterval);
  timerInterval = null;
  let stepPoller, weightPoller;

  // Register cleanup immediately so it fires even if navigation happens before setTimeout
  window.addEventListener('popstate', () => {
    brewActive = false;
    stepPoller?.stop();
    weightPoller?.stop();
    weightBar?.destroy();
    pourAnim?.destroy();
    clearInterval(timerInterval);
  }, { once: true });

  setTimeout(async () => {
    if (!brewActive) return;
    try {
      const session = await getSession();
      if (!session.active) { if (brewActive) navigate('/'); return; }
    } catch { if (brewActive) navigate('/'); return; }

    await refreshStep();
    if (!brewActive) return;

    stepPoller  = createPoller(refreshStep, 1000);
    weightPoller = createPoller(refreshWeight, 400);
    stepPoller.start();
    weightPoller.start();
  }, 0);

  return `
    <div class="brew-page">
      <div id="brew-progress-wrap"></div>
      <div id="brew-step-wrap" class="brew-step-wrap"><div class="brew-loading">Loading brew…</div></div>
      <div id="brew-pour-wrap"></div>
      <div id="brew-weight-wrap"></div>
      <div id="brew-timer-wrap"></div>
      <div id="brew-confirm-wrap"></div>
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
      .step-card--milk { border-color: #a0c4ff; }
      .step-card--wait { border-color: #ffd6a5; }
      .step-card__name { font-size: 1.6rem; font-weight: 700; color: var(--color-primary); }
      .step-card__instruction { font-size: 1rem; color: var(--color-text-muted); line-height: 1.5; }
      .step-card__target {
        display: inline-block; font-size: 0.8rem; padding: 0.25rem 0.65rem;
        border-radius: 999px; background: var(--color-bg);
        border: 1px solid var(--color-border); color: var(--color-text-muted);
        align-self: flex-start;
      }

      .brew-loading { color: var(--color-text-muted); font-size: 0.95rem; }

      .timer-wrap {
        display: flex; flex-direction: column; align-items: center; gap: 1rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 14px;
        padding: 1.5rem;
      }
      .timer-display {
        font-size: 3rem; font-weight: 700;
        color: var(--color-primary);
        font-variant-numeric: tabular-nums;
      }
      .timer-display.done { color: #4caf50; }
      .btn-timer {
        padding: 0.6rem 1.8rem;
        border: none; border-radius: 10px;
        background: var(--color-primary);
        color: #fff; font-size: 1rem; font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .btn-timer:disabled { opacity: 0.4; cursor: default; }

      .btn-confirm {
        width: 100%;
        padding: 0.9rem;
        border: none;
        border-radius: 12px;
        background: var(--color-primary);
        color: #fff;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .btn-confirm:disabled { opacity: 0.4; cursor: default; }
    </style>
  `;
}

async function advanceStep() {
  try {
    if (currentStepType === 'pour') {
      await postConfirmedWeight(lastWeight);
      await completeStep(lastWeight);
    } else {
      await completeStep(0);
    }
  } catch { /* server handles gracefully */ }

  weightBar?.destroy(); weightBar = null;
  pourAnim?.destroy();  pourAnim  = null;
  lastWeight = 0;
  stepStartWeight = null;
  prevStepType    = currentStepType;
  currentStepType = 'pour';
  weightHistory.length = 0;
  clearInterval(timerInterval); timerInterval = null;

  const confirmWrap = document.getElementById('brew-confirm-wrap');
  if (confirmWrap) confirmWrap.innerHTML = '';
  const timerWrap = document.getElementById('brew-timer-wrap');
  if (timerWrap) timerWrap.innerHTML = '';
  const pourWrap = document.getElementById('brew-pour-wrap');
  if (pourWrap) pourWrap.innerHTML = '';
  const weightWrap = document.getElementById('brew-weight-wrap');
  if (weightWrap) weightWrap.innerHTML = '';

  await refreshStep();
}

function mountConfirmButton(enabled = false) {
  const confirmWrap = document.getElementById('brew-confirm-wrap');
  if (!confirmWrap || confirmWrap.innerHTML !== '') return;
  confirmWrap.innerHTML = `<button class="btn-confirm" id="btn-next-step" ${enabled ? '' : 'disabled'}>Confirm & Next Step</button>`;
  document.getElementById('btn-next-step').addEventListener('click', () => advanceStep());
}

function setConfirmEnabled(enabled) {
  const btn = document.getElementById('btn-next-step');
  if (btn) btn.disabled = !enabled;
}

function startTimer(durationS) {
  const btn = document.getElementById('btn-start-timer');
  const display = document.getElementById('timer-display');
  if (!btn || !display) return;

  btn.disabled = true;
  let remaining = durationS;

  timerInterval = setInterval(() => {
    remaining -= 1;
    if (display) {
      display.textContent = remaining > 0 ? `${remaining}s` : 'Done!';
      if (remaining <= 0) display.classList.add('done');
    }
    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      setConfirmEnabled(true);
    }
  }, 1000);
}

async function refreshStep() {
  let data;
  try { data = await getCurrentStep(); } catch { return; }

  if (data.complete) { if (brewActive) navigate('/complete'); return; }

  const progressWrap = document.getElementById('brew-progress-wrap');
  const stepWrap     = document.getElementById('brew-step-wrap');
  if (!progressWrap || !stepWrap) return;

  const type = data.type ?? 'pour';

  // Only re-render step card on step change (avoid flicker)
  if (stepWrap.dataset.stepIndex !== String(data.step_index)) {
    // Exit animation (skip on initial render)
    if (stepWrap.dataset.stepIndex !== undefined) {
      stepWrap.classList.add('step-exit');
      await new Promise(r => setTimeout(r, 400));
    }

    stepWrap.dataset.stepIndex = data.step_index;
    progressWrap.innerHTML = progressBar(data.step_index, data.total_steps);

    // Enter animation
    stepWrap.style.transition = 'none';
    stepWrap.classList.remove('step-exit');
    stepWrap.classList.add('step-enter');
    stepWrap.innerHTML = stepCard(data);
    stepWrap.offsetHeight; // force reflow
    stepWrap.style.transition = '';
    stepWrap.classList.remove('step-enter');
    prevStepType    = currentStepType;
    currentStepType = type;

    const pourWrap   = document.getElementById('brew-pour-wrap');
    const weightWrap = document.getElementById('brew-weight-wrap');
    const timerWrap  = document.getElementById('brew-timer-wrap');

    if (type === 'pour' || type === 'milk' || type === 'grind') {
      // Delta only when pour follows pour (same container stays on scale).
      // After grind/milk the user swaps containers, so start from zero.
      if (type === 'pour' && prevStepType === 'pour') {
        try {
          const w = await getCurrentWeight();
          stepStartWeight = w.weight ?? 0;
        } catch { stepStartWeight = 0; }
      } else {
        stepStartWeight = 0;
      }

      if (pourWrap && !pourAnim) {
        pourAnim = createPourAnimation(pourWrap);
        pourAnim.update({ fillPercent: 0, isPouring: false });
      }
      if (weightWrap && !weightBar) {
        weightBar = createWeightBar(weightWrap);
        weightBar.update({ currentWeight: 0, targetWeight: data.target_weight_g, isStable: false });
        weightWrap.dataset.target = data.target_weight_g;
      }
      mountConfirmButton(false);

    } else if (type === 'wait') {
      if (pourWrap) pourWrap.innerHTML = '';
      if (weightWrap) weightWrap.innerHTML = '';
      if (timerWrap) {
        timerWrap.innerHTML = renderTimer(data.duration_s);
        document.getElementById('btn-start-timer')?.addEventListener('click', () => startTimer(data.duration_s));
      }
      mountConfirmButton(false);

    } else if (type === 'prep') {
      if (pourWrap) pourWrap.innerHTML = '';
      if (weightWrap) weightWrap.innerHTML = '';
      if (timerWrap) timerWrap.innerHTML = '';
      mountConfirmButton(true);
    }
  }
}

async function refreshWeight() {
  if (currentStepType !== 'pour' && currentStepType !== 'milk' && currentStepType !== 'grind') return;

  let data;
  try { data = await getCurrentWeight(); } catch { return; }

  const raw = data.weight ?? 0;
  const w = Math.max(0, raw - (stepStartWeight ?? 0));
  pushWeight(w);

  const weightWrap = document.getElementById('brew-weight-wrap');
  if (!weightWrap || !weightBar) return;

  const target = parseFloat(weightWrap.dataset.target ?? 0);
  const isPouring = w - lastWeight > 0.5;
  const fillPercent = target > 0 ? Math.min(110, (w / target) * 100) : 0;
  const stable = isStable(w);
  const targetReached = fillPercent >= 95 && fillPercent <= 105;
  lastWeight = w;

  weightBar.update({ currentWeight: w, targetWeight: target, isStable: stable });
  pourAnim?.update({ fillPercent, isPouring });
  setConfirmEnabled(stable && targetReached);
}

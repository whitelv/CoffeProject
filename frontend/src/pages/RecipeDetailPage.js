import { getRecipe, selectRecipe } from '../api/brew.js';

const RECIPE_EMOJI = {
  espresso:      '☕',
  v60:           '🫗',
  'french-press': '🫙',
  aeropress:     '💨',
  'cold-brew':   '🧊',
  latte:         '🥛',
  cappuccino:    '☁️',
};

const STEP_META = {
  prep:  { icon: '📋', label: 'Prep',  color: '#b5a07a' },
  grind: { icon: '⚙️', label: 'Grind', color: '#8d6e63' },
  pour:  { icon: '💧', label: 'Pour',  color: '#5bb8e8' },
  milk:  { icon: '🥛', label: 'Milk',  color: '#a0c4ff' },
  wait:  { icon: '⏱️', label: 'Wait',  color: '#ffd6a5' },
};

function navigate(path) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function render({ id } = {}) {
  setTimeout(() => loadRecipe(id), 0);

  return `
    <div class="detail-page" id="detail-page">
      <header class="detail-top-bar">
        <a href="/" class="back-btn">← Back</a>
      </header>
      <div id="detail-content" class="detail-content">
        ${skeletonDetail()}
      </div>
    </div>

    <style>
      .detail-page {
        max-width: 680px;
        margin: 0 auto;
        padding: 1.5rem 1rem 4rem;
      }

      .detail-top-bar {
        margin-bottom: 1.5rem;
      }

      .back-btn {
        color: var(--color-primary);
        text-decoration: none;
        font-size: 0.95rem;
      }

      .back-btn:hover { text-decoration: underline; }

      .detail-hero {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.5rem;
      }

      .detail-hero__emoji { font-size: 3rem; }

      .detail-hero__title {
        font-size: 1.8rem;
        font-weight: 700;
      }

      .badge {
        display: inline-block;
        font-size: 0.75rem;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        background: var(--color-primary);
        color: var(--color-bg);
        font-weight: 600;
        margin-top: 0.3rem;
      }

      .detail-description {
        color: var(--color-text-muted);
        font-size: 0.95rem;
        margin: 0.75rem 0 1.5rem;
        line-height: 1.5;
      }

      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
        margin-bottom: 2rem;
      }

      .info-cell {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 10px;
        padding: 0.85rem 1rem;
      }

      .info-cell__label {
        font-size: 0.72rem;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.25rem;
      }

      .info-cell__value {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--color-primary);
      }

      .steps-title {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 1rem;
      }

      .steps-guide {
        display: flex;
        flex-direction: column;
        margin-bottom: 2.5rem;
      }

      .step-row {
        display: flex;
        gap: 0.75rem;
        align-items: stretch;
      }

      .step-spine {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex-shrink: 0;
        width: 2.4rem;
      }

      .step-icon-wrap {
        width: 2.4rem;
        height: 2.4rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        flex-shrink: 0;
        border: 2px solid var(--color-border);
        background: var(--color-surface);
      }

      .step-connector {
        flex: 1;
        width: 2px;
        background: var(--color-border);
        margin: 0.2rem 0;
        min-height: 1rem;
      }

      .step-card-guide {
        flex: 1;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        padding: 0.9rem 1rem;
        margin-bottom: 0.5rem;
      }

      .step-card-guide__header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.4rem;
      }

      .step-type-badge {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        color: #fff;
      }

      .step-card-guide__name {
        font-weight: 700;
        font-size: 1rem;
      }

      .step-card-guide__instruction {
        font-size: 0.88rem;
        color: var(--color-text-muted);
        line-height: 1.5;
        margin-bottom: 0.6rem;
      }

      .step-card-guide__measure {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-primary);
      }

      .step-card-guide__measure-label {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        font-weight: 400;
      }

      .start-btn {
        width: 100%;
        padding: 1rem;
        background: var(--color-primary);
        color: var(--color-bg);
        border: none;
        border-radius: 12px;
        font-size: 1.1rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s;
      }

      .start-btn:hover:not(:disabled) { background: var(--color-primary-dark); }
      .start-btn:disabled { opacity: 0.6; cursor: not-allowed; }

      .detail-error {
        color: #e07070;
        margin-top: 0.75rem;
        font-size: 0.9rem;
      }

      /* Skeleton */
      .skeleton {
        background: linear-gradient(90deg, var(--color-border) 25%, var(--color-surface) 50%, var(--color-border) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.2s infinite;
        border-radius: 6px;
      }
      @keyframes shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .sk-title  { width: 55%; height: 1.8rem; margin-bottom: 0.5rem; }
      .sk-badge  { width: 5rem; height: 1.1rem; }
      .sk-desc   { width: 90%; height: 3rem; margin: 0.75rem 0 1.5rem; }
      .sk-grid   { height: 5rem; }
      .sk-steps  { height: 8rem; }
      .sk-btn    { width: 100%; height: 3.2rem; border-radius: 12px; margin-top: 1rem; }
    </style>
  `;
}

function skeletonDetail() {
  return `
    <div class="skeleton sk-title"></div>
    <div class="skeleton sk-badge"></div>
    <div class="skeleton sk-desc"></div>
    <div class="skeleton sk-grid"></div>
    <div class="skeleton sk-steps"></div>
    <div class="skeleton sk-btn"></div>
  `;
}

async function loadRecipe(id) {
  const container = document.getElementById('detail-content');
  if (!container) return;

  let recipe;
  try {
    recipe = await getRecipe(id);
  } catch (err) {
    container.innerHTML = `<p class="detail-error">Failed to load recipe: ${err.message}</p>`;
    return;
  }

  const emoji = RECIPE_EMOJI[recipe.id] || '☕';
  const steps = recipe.steps ?? [];
  const totalWater = steps.reduce((s, st) => s + (st.target_weight_g ?? 0), 0);
  const dose = recipe.dose_g ?? '—';
  const grind = recipe.grind_size ?? '—';
  const time = recipe.brew_time ?? `${steps.length} steps`;

  container.innerHTML = `
    <div class="detail-hero">
      <span class="detail-hero__emoji">${emoji}</span>
      <div>
        <h1 class="detail-hero__title">${recipe.name}</h1>
        <span class="badge">${recipe.id}</span>
      </div>
    </div>

    <p class="detail-description">${recipe.description || 'A classic coffee recipe.'}</p>

    <div class="info-grid">
      <div class="info-cell">
        <div class="info-cell__label">Coffee dose</div>
        <div class="info-cell__value">${dose}g</div>
      </div>
      <div class="info-cell">
        <div class="info-cell__label">Water</div>
        <div class="info-cell__value">${totalWater}g</div>
      </div>
      <div class="info-cell">
        <div class="info-cell__label">Grind size</div>
        <div class="info-cell__value">${grind}</div>
      </div>
      <div class="info-cell">
        <div class="info-cell__label">Est. time</div>
        <div class="info-cell__value">${time}</div>
      </div>
    </div>

    <h2 class="steps-title">Step-by-step guide</h2>
    <div class="steps-guide">
      ${steps.map((step, i) => {
        const meta = STEP_META[step.type] ?? STEP_META.pour;
        const isLast = i === steps.length - 1;
        let measureHtml = '';
        if (step.type === 'wait' && step.duration_s != null) {
          measureHtml = `<span class="step-card-guide__measure">⏱ ${step.duration_s}s <span class="step-card-guide__measure-label">wait</span></span>`;
        } else if (step.target_weight_g != null) {
          const unit = step.type === 'milk' ? 'milk' : step.type === 'grind' ? 'coffee' : 'water';
          measureHtml = `<span class="step-card-guide__measure">${meta.icon} ${step.target_weight_g}g <span class="step-card-guide__measure-label">${unit}</span></span>`;
        }
        return `
          <div class="step-row">
            <div class="step-spine">
              <div class="step-icon-wrap" style="border-color:${meta.color}">${meta.icon}</div>
              ${!isLast ? '<div class="step-connector"></div>' : ''}
            </div>
            <div class="step-card-guide">
              <div class="step-card-guide__header">
                <span class="step-type-badge" style="background:${meta.color}">${meta.label}</span>
                <span class="step-card-guide__name">${step.name}</span>
              </div>
              <div class="step-card-guide__instruction">${step.instruction.replace(/\n/g, '<br>')}</div>
              ${measureHtml}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <button class="start-btn" id="start-brew-btn">Start Brew</button>
    <p class="detail-error" id="start-error" style="display:none"></p>
  `;

  document.getElementById('start-brew-btn').addEventListener('click', () => startBrew(recipe.id));
}

async function startBrew(recipeId) {
  const btn = document.getElementById('start-brew-btn');
  const errEl = document.getElementById('start-error');

  btn.disabled = true;
  btn.textContent = 'Starting…';
  errEl.style.display = 'none';

  try {
    await selectRecipe(recipeId);
    navigate('/brew');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Start Brew';
    errEl.textContent = `Failed to start: ${err.message}`;
    errEl.style.display = 'block';
  }
}

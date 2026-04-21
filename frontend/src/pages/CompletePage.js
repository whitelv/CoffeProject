import { completeBrew, selectRecipe, getRecipe } from '../api/brew.js';
import { createSteamAnimation } from '../components/SteamAnimation.js';

function navigate(path) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function stepRow(log) {
  const diff = Math.abs((log.actual_weight_g ?? 0) - log.target_weight_g);
  const pass = diff <= 5;
  return `
    <tr class="summary-row">
      <td class="summary-cell">${log.step_name}</td>
      <td class="summary-cell summary-cell--num">${log.target_weight_g}g</td>
      <td class="summary-cell summary-cell--num">${(log.actual_weight_g ?? 0).toFixed(1)}g</td>
      <td class="summary-cell summary-cell--result">${pass ? '✅' : '❌'}</td>
    </tr>
  `;
}

export default function render() {
  setTimeout(() => load(), 0);

  return `
    <div class="complete-page">
      <div id="complete-content">
        <div class="complete-loading">Saving brew…</div>
      </div>
    </div>

    <style>
      .complete-page {
        max-width: 600px;
        margin: 0 auto;
        padding: 2rem 1rem 4rem;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .complete-loading {
        color: var(--color-text-muted);
        font-size: 0.95rem;
        text-align: center;
        margin-top: 4rem;
      }

      .complete-hero {
        text-align: center;
        margin-bottom: 2rem;
      }

      .complete-hero__steam {
        display: flex;
        justify-content: center;
        margin-bottom: 0.75rem;
      }

      .complete-hero__title {
        font-size: 2rem;
        font-weight: 700;
        color: var(--color-primary);
        margin-bottom: 0.4rem;
      }

      .complete-hero__sub {
        font-size: 1rem;
        color: var(--color-text-muted);
      }

      .summary-wrap {
        width: 100%;
        margin-bottom: 2rem;
      }

      .summary-title {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.75rem;
      }

      .summary-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }

      .summary-table thead th {
        text-align: left;
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
        border-bottom: 1px solid var(--color-border);
      }

      .summary-cell {
        padding: 0.65rem 0.75rem;
        border-bottom: 1px solid var(--color-border);
      }

      .summary-cell--num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .summary-cell--result {
        text-align: center;
        font-size: 1.1rem;
      }

      .actions {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .action-btn {
        width: 100%;
        padding: 0.9rem;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: background 0.15s, opacity 0.15s;
      }

      .action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

      .action-btn--primary {
        background: var(--color-primary);
        color: var(--color-bg);
      }
      .action-btn--primary:hover:not(:disabled) { background: var(--color-primary-dark); }

      .action-btn--secondary {
        background: var(--color-surface);
        color: var(--color-text);
        border: 1px solid var(--color-border);
      }
      .action-btn--secondary:hover:not(:disabled) { border-color: var(--color-primary); }

      .complete-error {
        color: #e07070;
        font-size: 0.9rem;
        text-align: center;
        margin-top: 1rem;
      }
    </style>
  `;
}

async function load() {
  const container = document.getElementById('complete-content');
  if (!container) return;

  let result;
  try {
    result = await completeBrew();
  } catch (err) {
    container.innerHTML = `<p class="complete-error">Failed to save brew: ${err.message}</p>`;
    return;
  }

  const recipeId = result.session?.recipe_id;
  const stepLogs = result.step_logs ?? [];

  let recipeName = recipeId ?? 'coffee';
  if (recipeId) {
    try {
      const recipe = await getRecipe(recipeId);
      recipeName = recipe.name ?? recipeName;

      if (stepLogs.length === 0 && recipe.steps?.length) {
        recipe.steps.forEach(s => stepLogs.push({
          step_name: s.name,
          target_weight_g: s.target_weight_g,
          actual_weight_g: s.target_weight_g,
        }));
      }
    } catch { /* use fallback name */ }
  }

  const summaryRows = stepLogs.map(stepRow).join('');

  container.innerHTML = `
    <div class="complete-hero">
      <div id="complete-steam" class="complete-hero__steam"></div>
      <h1 class="complete-hero__title">Brew Complete!</h1>
      <p class="complete-hero__sub">Enjoy your ${recipeName}</p>
    </div>

    ${summaryRows ? `
    <div class="summary-wrap">
      <h2 class="summary-title">Step Summary</h2>
      <table class="summary-table">
        <thead>
          <tr>
            <th>Step</th>
            <th style="text-align:right">Target</th>
            <th style="text-align:right">Actual</th>
            <th style="text-align:center">Result</th>
          </tr>
        </thead>
        <tbody>${summaryRows}</tbody>
      </table>
    </div>` : ''}

    <div class="actions">
      <button class="action-btn action-btn--primary" id="brew-again-btn">Brew Again</button>
      <button class="action-btn action-btn--secondary" id="choose-recipe-btn">Choose Different Recipe</button>
      <button class="action-btn action-btn--secondary" id="view-history-btn">View History</button>
    </div>
    <p class="complete-error" id="complete-error" style="display:none"></p>
  `;

  const steamEl = document.getElementById('complete-steam');
  if (steamEl) createSteamAnimation(steamEl, { size: 200 });

  document.getElementById('choose-recipe-btn').addEventListener('click', () => navigate('/'));
  document.getElementById('view-history-btn').addEventListener('click', () => navigate('/history'));
  document.getElementById('brew-again-btn').addEventListener('click', () => brewAgain(recipeId));
}

async function brewAgain(recipeId) {
  const btn = document.getElementById('brew-again-btn');
  const errEl = document.getElementById('complete-error');
  if (!recipeId) { navigate('/'); return; }

  btn.disabled = true;
  btn.textContent = 'Starting…';
  errEl.style.display = 'none';

  try {
    await selectRecipe(recipeId);
    navigate('/brew');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Brew Again';
    errEl.textContent = `Failed to start: ${err.message}`;
    errEl.style.display = 'block';
  }
}

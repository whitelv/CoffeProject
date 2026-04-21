import { getHistory } from '../api/brew.js';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function stepsPassed(steps) {
  return (steps ?? []).filter(s => Math.abs((s.actual_weight_g ?? 0) - s.target_weight_g) <= 5).length;
}

function stepRow(s) {
  const pass = Math.abs((s.actual_weight_g ?? 0) - s.target_weight_g) <= 5;
  return `
    <tr class="ht-step-row">
      <td class="ht-step-cell">${s.step_name}</td>
      <td class="ht-step-cell ht-step-cell--num">${s.target_weight_g}g</td>
      <td class="ht-step-cell ht-step-cell--num">${(s.actual_weight_g ?? 0).toFixed(1)}g</td>
      <td class="ht-step-cell ht-step-cell--result">${pass ? '✅' : '❌'}</td>
    </tr>
  `;
}

function historyCard(session, index) {
  const steps = session.steps ?? [];
  const passed = stepsPassed(steps);
  const total = steps.length;
  const complete = session.completed;

  return `
    <div class="ht-card" data-index="${index}">
      <button class="ht-card__header" aria-expanded="false" data-toggle="${index}">
        <div class="ht-card__meta">
          <span class="ht-card__name">${session.recipe_name ?? session.recipe_id ?? 'Unknown'}</span>
          <span class="ht-card__date">${formatDate(session.completed_at ?? session.started_at)}</span>
        </div>
        <div class="ht-card__right">
          ${total > 0 ? `<span class="ht-card__steps">${passed}/${total} steps</span>` : ''}
          <span class="ht-badge ${complete ? 'ht-badge--complete' : 'ht-badge--incomplete'}">
            ${complete ? 'Complete' : 'Incomplete'}
          </span>
          <span class="ht-card__chevron">›</span>
        </div>
      </button>
      <div class="ht-card__detail" id="ht-detail-${index}" hidden>
        ${steps.length ? `
        <table class="ht-table">
          <thead>
            <tr>
              <th class="ht-th">Step</th>
              <th class="ht-th ht-th--num">Target</th>
              <th class="ht-th ht-th--num">Actual</th>
              <th class="ht-th ht-th--center">Result</th>
            </tr>
          </thead>
          <tbody>${steps.map(stepRow).join('')}</tbody>
        </table>` : '<p class="ht-no-steps">No step data recorded.</p>'}
      </div>
    </div>
  `;
}

export default function render() {
  setTimeout(() => load(), 0);

  return `
    <div class="ht-page">
      <header class="ht-top-bar">
        <a href="/" class="ht-back">← Back</a>
        <h1 class="ht-title">Brew History</h1>
      </header>
      <div id="ht-content">
        <div class="ht-loading">Loading history…</div>
      </div>
    </div>

    <style>
      .ht-page {
        max-width: 680px;
        margin: 0 auto;
        padding: 1.5rem 1rem 4rem;
      }

      .ht-top-bar {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .ht-back {
        color: var(--color-primary);
        text-decoration: none;
        font-size: 0.95rem;
        flex-shrink: 0;
      }
      .ht-back:hover { text-decoration: underline; }

      .ht-title {
        font-size: 1.4rem;
        font-weight: 700;
      }

      .ht-loading {
        color: var(--color-text-muted);
        font-size: 0.95rem;
      }

      .ht-empty {
        text-align: center;
        padding: 4rem 1rem;
        color: var(--color-text-muted);
      }
      .ht-empty__icon { font-size: 3rem; display: block; margin-bottom: 0.75rem; }
      .ht-empty__msg  { font-size: 1rem; }

      .ht-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .ht-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        overflow: hidden;
      }

      .ht-card__header {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 1rem 1.1rem;
        background: none;
        border: none;
        cursor: pointer;
        text-align: left;
        color: var(--color-text);
      }
      .ht-card__header:hover { background: var(--color-bg); }

      .ht-card__meta {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;
      }

      .ht-card__name {
        font-size: 1rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ht-card__date {
        font-size: 0.8rem;
        color: var(--color-text-muted);
      }

      .ht-card__right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
      }

      .ht-card__steps {
        font-size: 0.8rem;
        color: var(--color-text-muted);
      }

      .ht-badge {
        font-size: 0.72rem;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        font-weight: 600;
      }
      .ht-badge--complete   { background: #2d5a2d; color: #7ed87e; }
      .ht-badge--incomplete { background: #4a2020; color: #e07070; }

      .ht-card__chevron {
        font-size: 1.2rem;
        color: var(--color-text-muted);
        transition: transform 0.2s;
        line-height: 1;
      }
      .ht-card__header[aria-expanded="true"] .ht-card__chevron {
        transform: rotate(90deg);
      }

      .ht-card__detail {
        border-top: 1px solid var(--color-border);
        padding: 0.75rem 1rem 1rem;
      }

      .ht-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.88rem;
      }

      .ht-th {
        text-align: left;
        padding: 0.4rem 0.6rem;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
        border-bottom: 1px solid var(--color-border);
      }
      .ht-th--num    { text-align: right; }
      .ht-th--center { text-align: center; }

      .ht-step-cell {
        padding: 0.55rem 0.6rem;
        border-bottom: 1px solid var(--color-border);
      }
      .ht-step-cell--num    { text-align: right; font-variant-numeric: tabular-nums; }
      .ht-step-cell--result { text-align: center; }

      .ht-no-steps {
        font-size: 0.85rem;
        color: var(--color-text-muted);
        margin: 0;
      }

      .ht-error {
        color: #e07070;
        font-size: 0.9rem;
      }
    </style>
  `;
}

async function load() {
  const container = document.getElementById('ht-content');
  if (!container) return;

  let sessions;
  try {
    sessions = await getHistory();
  } catch (err) {
    container.innerHTML = `<p class="ht-error">Failed to load history: ${err.message}</p>`;
    return;
  }

  if (!sessions.length) {
    container.innerHTML = `
      <div class="ht-empty">
        <span class="ht-empty__icon">☕</span>
        <p class="ht-empty__msg">No brews yet. Start your first brew!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="ht-list">${sessions.map(historyCard).join('')}</div>`;

  container.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.toggle;
      const detail = document.getElementById(`ht-detail-${idx}`);
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      detail.hidden = expanded;
    });
  });
}

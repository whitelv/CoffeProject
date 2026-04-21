import { getRecipes, getSession } from '../api/brew.js';
import { createSteamAnimation } from '../components/SteamAnimation.js';

const RECIPE_EMOJI = {
  espresso:    '☕',
  v60:         '🫗',
  'french-press': '🫙',
  aeropress:   '💨',
  'cold-brew': '🧊',
};

function recipeEmoji(id) {
  return RECIPE_EMOJI[id] || '☕';
}

function skeletonCards() {
  return Array.from({ length: 3 }, () => `
    <div class="recipe-card recipe-card--skeleton">
      <div class="skeleton skeleton--emoji"></div>
      <div class="skeleton skeleton--title"></div>
      <div class="skeleton skeleton--pills"></div>
    </div>
  `).join('');
}

function recipeCard(recipe) {
  const emoji = recipeEmoji(recipe.id);
  const steps = recipe.steps ?? [];
  const totalWater = steps.reduce((s, st) => s + (st.target_weight_g ?? 0), 0);
  const dose = recipe.dose_g ?? '—';
  const time = recipe.brew_time ?? `${steps.length} steps`;

  return `
    <a class="recipe-card" href="/recipe/${recipe.id}">
      <span class="recipe-card__emoji">${emoji}</span>
      <h2 class="recipe-card__name">${recipe.name}</h2>
      <div class="recipe-card__pills">
        <span class="pill">☕ ${dose}g</span>
        <span class="pill">💧 ${totalWater}g</span>
        <span class="pill">⏱ ${time}</span>
      </div>
    </a>
  `;
}

function startRfidPolling(navigate) {
  let prevActive = false;
  const interval = setInterval(async () => {
    try {
      const session = await getSession();
      if (session.active && session.recipe_id && !prevActive) {
        clearInterval(interval);
        navigate('/brew');
      }
      prevActive = !!session.active;
    } catch (_) { /* ignore */ }
  }, 2000);
  return interval;
}

function navigate(path) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function render() {
  // Mount steam animation
  setTimeout(() => {
    const steamEl = document.getElementById('steam-idle');
    if (steamEl) createSteamAnimation(steamEl, { size: 80 });
  }, 0);

  // Mount shell immediately, load recipes async
  setTimeout(async () => {
    const grid = document.getElementById('recipe-grid');
    if (!grid) return;

    try {
      const recipes = await getRecipes();
      grid.innerHTML = recipes.length
        ? recipes.map(recipeCard).join('')
        : '<p class="selection-empty">No recipes found.</p>';
    } catch (err) {
      grid.innerHTML = `<p class="selection-error">Failed to load recipes: ${err.message}</p>`;
    }
  }, 0);

  // Start RFID session polling — stop it when navigating away
  setTimeout(() => {
    const interval = startRfidPolling(navigate);
    window.addEventListener('popstate', () => clearInterval(interval), { once: true });
  }, 0);

  return `
    <div class="selection-page">
      <header class="top-bar">
        <span class="top-bar__title">☕ BrewGuide</span>
        <a href="/settings" class="top-bar__settings" title="Settings">⚙️</a>
      </header>

      <p class="selection-subtitle">Scan your card or choose a recipe</p>

      <div id="steam-idle" class="steam-idle"></div>

      <div id="recipe-grid" class="recipe-grid">
        ${skeletonCards()}
      </div>
    </div>

    <style>
      .selection-page {
        max-width: 960px;
        margin: 0 auto;
        padding: 1.5rem 1rem 3rem;
      }

      .top-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }

      .top-bar__title {
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--color-primary);
      }

      .top-bar__settings {
        font-size: 1.4rem;
        text-decoration: none;
      }

      .selection-subtitle {
        color: var(--color-text-muted);
        margin-bottom: 0.75rem;
        font-size: 0.95rem;
      }

      .steam-idle {
        display: flex;
        justify-content: center;
        margin-bottom: 1.25rem;
      }

      .recipe-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }

      @media (min-width: 640px) {
        .recipe-grid { grid-template-columns: repeat(3, 1fr); }
      }

      .recipe-card {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1.25rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        text-decoration: none;
        color: var(--color-text);
        transition: transform 0.15s ease, border-color 0.15s ease;
        cursor: pointer;
      }

      .recipe-card:hover {
        transform: scale(1.03);
        border-color: var(--color-primary);
      }

      .recipe-card__emoji { font-size: 2rem; }

      .recipe-card__name {
        font-size: 1rem;
        font-weight: 600;
      }

      .recipe-card__pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-top: 0.25rem;
      }

      .pill {
        font-size: 0.75rem;
        padding: 0.2rem 0.55rem;
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: 999px;
        color: var(--color-text-muted);
      }

      /* Skeletons */
      .recipe-card--skeleton { pointer-events: none; }

      .skeleton {
        background: linear-gradient(90deg, var(--color-border) 25%, var(--color-surface) 50%, var(--color-border) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.2s infinite;
        border-radius: 6px;
      }

      .skeleton--emoji  { width: 2.5rem; height: 2.5rem; border-radius: 8px; }
      .skeleton--title  { width: 70%; height: 1rem; margin-top: 0.25rem; }
      .skeleton--pills  { width: 90%; height: 1.5rem; margin-top: 0.5rem; }

      @keyframes shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .selection-error { color: #e07070; }
      .selection-empty { color: var(--color-text-muted); }
    </style>
  `;
}

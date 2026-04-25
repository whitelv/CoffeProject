import { clearHistory } from '../api/brew.js';

function navigate(path) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function render() {
  const savedUrl      = localStorage.getItem('brew_api_url') ?? '';
  const savedTheme    = localStorage.getItem('brew_theme') ?? 'dark';
  const savedSound    = localStorage.getItem('brew_sound') ?? 'on';
  const savedInterval = localStorage.getItem('brew_poll_interval') ?? '400';

  setTimeout(() => {
    // Back button
    document.getElementById('btn-back')?.addEventListener('click', () => navigate('/'));

    // Backend URL — save
    document.getElementById('btn-save-url')?.addEventListener('click', () => {
      const url = document.getElementById('input-api-url').value.trim();
      localStorage.setItem('brew_api_url', url);
      showStatus('status-url', '✅ Saved');
    });

    // Backend URL — test connection
    document.getElementById('btn-test-url')?.addEventListener('click', async () => {
      const url = document.getElementById('input-api-url').value.trim();
      const status = document.getElementById('status-url');
      status.textContent = 'Testing…';
      try {
        const res = await fetch(`${url}/session/`);
        status.textContent = res.ok ? '✅ Connected' : `❌ ${res.status} ${res.statusText}`;
      } catch (e) {
        status.textContent = `❌ ${e.message}`;
      }
    });

    // Theme toggle
    document.getElementById('select-theme')?.addEventListener('change', (e) => {
      const theme = e.target.value;
      localStorage.setItem('brew_theme', theme);
      document.body.dataset.theme = theme;
    });

    // Sound toggle
    document.getElementById('select-sound')?.addEventListener('change', (e) => {
      localStorage.setItem('brew_sound', e.target.value);
    });

    // Poll interval slider
    const slider = document.getElementById('slider-poll');
    const sliderLabel = document.getElementById('slider-poll-label');
    slider?.addEventListener('input', () => {
      sliderLabel.textContent = `${slider.value}ms`;
      localStorage.setItem('brew_poll_interval', slider.value);
    });

    // Clear history
    document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
      const confirmed = window.confirm('Clear all brew history? This cannot be undone.');
      if (!confirmed) return;
      const status = document.getElementById('status-history');
      try {
        await clearHistory();
        status.textContent = '✅ History cleared';
      } catch (e) {
        status.textContent = `❌ ${e.message}`;
      }
    });
  }, 0);

  return `
    <div class="settings-page">
      <header class="settings-header">
        <button class="btn-back" id="btn-back">←</button>
        <h1 class="settings-title">Settings</h1>
      </header>

      <section class="settings-card">
        <h2 class="settings-card__heading">ESP32 / Backend Connection</h2>
        <label class="settings-label">Backend URL</label>
        <input class="settings-input" id="input-api-url" type="text"
          placeholder="http://192.168.1.42:8000" value="${savedUrl}">
        <div class="settings-row">
          <button class="btn-secondary" id="btn-test-url">Test Connection</button>
          <button class="btn-primary" id="btn-save-url">Save</button>
        </div>
        <p class="settings-status" id="status-url"></p>
      </section>

      <section class="settings-card">
        <h2 class="settings-card__heading">Preferences</h2>

        <div class="settings-field">
          <label class="settings-label">Theme</label>
          <select class="settings-select" id="select-theme">
            <option value="dark"  ${savedTheme === 'dark'  ? 'selected' : ''}>Dark</option>
            <option value="light" ${savedTheme === 'light' ? 'selected' : ''}>Light</option>
          </select>
        </div>

        <div class="settings-field">
          <label class="settings-label">Sound Effects</label>
          <select class="settings-select" id="select-sound">
            <option value="on"  ${savedSound === 'on'  ? 'selected' : ''}>On</option>
            <option value="off" ${savedSound === 'off' ? 'selected' : ''}>Off</option>
          </select>
        </div>

        <div class="settings-field">
          <label class="settings-label">Weight Polling Interval
            <span class="settings-label--sub" id="slider-poll-label">${savedInterval}ms</span>
          </label>
          <input class="settings-slider" id="slider-poll" type="range"
            min="200" max="800" step="200" value="${savedInterval}">
          <div class="slider-ticks"><span>200ms</span><span>400ms</span><span>800ms</span></div>
        </div>
      </section>

      <section class="settings-card">
        <h2 class="settings-card__heading">Admin</h2>
        <a class="btn-secondary settings-admin-link" href="/admin/rfid">🪪 RFID Card Mappings</a>
      </section>

      <section class="settings-card">
        <h2 class="settings-card__heading">Data Management</h2>
        <button class="btn-danger" id="btn-clear-history">Clear Brew History</button>
        <p class="settings-status" id="status-history"></p>
      </section>
    </div>

    <style>
      .settings-page {
        max-width: 560px;
        margin: 0 auto;
        padding: 1.5rem 1rem 3rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .settings-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.25rem;
      }

      .btn-back {
        background: none;
        border: none;
        color: var(--color-primary);
        font-size: 1.4rem;
        cursor: pointer;
        padding: 0.2rem 0.5rem;
        border-radius: 8px;
        transition: background 0.15s;
      }
      .btn-back:hover { background: var(--color-surface); }

      .settings-title {
        font-size: 1.4rem;
        font-weight: 700;
      }

      .settings-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 14px;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .settings-card__heading {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--color-text-muted);
        margin-bottom: 0.25rem;
      }

      .settings-label {
        font-size: 0.9rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .settings-label--sub {
        font-weight: 400;
        color: var(--color-primary);
        font-size: 0.85rem;
      }

      .settings-input {
        width: 100%;
        padding: 0.6rem 0.8rem;
        border-radius: 10px;
        border: 1px solid var(--color-border);
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.95rem;
      }
      .settings-input:focus { outline: none; border-color: var(--color-primary); }

      .settings-select {
        width: 100%;
        padding: 0.6rem 0.8rem;
        border-radius: 10px;
        border: 1px solid var(--color-border);
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.95rem;
        cursor: pointer;
      }

      .settings-field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .settings-slider {
        width: 100%;
        accent-color: var(--color-primary);
        cursor: pointer;
      }

      .slider-ticks {
        display: flex;
        justify-content: space-between;
        font-size: 0.72rem;
        color: var(--color-text-muted);
        padding: 0 0.1rem;
      }

      .settings-row {
        display: flex;
        gap: 0.6rem;
      }

      .btn-primary, .btn-secondary, .btn-danger {
        padding: 0.6rem 1.2rem;
        border: none;
        border-radius: 10px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .btn-primary  { background: var(--color-primary); color: #fff; }
      .btn-secondary {
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        color: var(--color-text);
      }
      .btn-danger   { background: #c0392b; color: #fff; width: 100%; }
      .btn-primary:hover, .btn-secondary:hover, .btn-danger:hover { opacity: 0.85; }

      .settings-status {
        font-size: 0.85rem;
        color: var(--color-text-muted);
        min-height: 1.2em;
      }

      .settings-admin-link {
        display: block;
        text-align: center;
        text-decoration: none;
      }
    </style>
  `;
}

function showStatus(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3000);
}

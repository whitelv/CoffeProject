import { getRecipes, getRfidMappings, addRfidMapping, deleteRfidMapping, getLastRfid } from '../api/brew.js';

function navigate(path) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

let scanInterval = null;

function stopScan() {
  if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
}

function mappingRow(m) {
  return `
    <tr class="mapping-row" data-uid="${m.uid}">
      <td class="mapping-cell">${m.uid}</td>
      <td class="mapping-cell">${m.recipe_name}</td>
      <td class="mapping-cell">
        <button class="btn-delete" data-uid="${m.uid}">🗑️</button>
      </td>
    </tr>
  `;
}

function recipeOptions(recipes, selected = '') {
  return recipes.map(r =>
    `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${r.name}</option>`
  ).join('');
}

export default function render() {
  stopScan();

  setTimeout(async () => {
    document.getElementById('btn-back')?.addEventListener('click', () => {
      stopScan();
      navigate('/settings');
    });

    let recipes = [];
    let mappings = [];

    try {
      [recipes, mappings] = await Promise.all([getRecipes(), getRfidMappings()]);
    } catch (e) {
      document.getElementById('rfid-error').textContent = `Failed to load: ${e.message}`;
      return;
    }

    renderTable(mappings);
    document.getElementById('recipe-select').innerHTML = recipeOptions(recipes);

    // Delete mapping
    document.getElementById('mappings-table')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-delete');
      if (!btn) return;
      const uid = btn.dataset.uid;
      try {
        await deleteRfidMapping(uid);
        mappings = mappings.filter(m => m.uid !== uid);
        renderTable(mappings);
      } catch (err) {
        document.getElementById('rfid-error').textContent = `Delete failed: ${err.message}`;
      }
    });

    // Scan card button
    document.getElementById('btn-scan')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-scan');
      const uidInput = document.getElementById('input-uid');
      if (scanInterval) { stopScan(); btn.textContent = 'Scan next card'; return; }

      btn.textContent = 'Scanning… (click to cancel)';
      let elapsed = 0;
      scanInterval = setInterval(async () => {
        elapsed += 500;
        try {
          const res = await getLastRfid();
          if (res.uid) {
            uidInput.value = res.uid;
            stopScan();
            btn.textContent = 'Scan next card';
          }
        } catch { /* ignore poll errors */ }
        if (elapsed >= 10000) {
          stopScan();
          btn.textContent = 'Scan next card';
        }
      }, 500);
    });

    // Add mapping
    document.getElementById('btn-add')?.addEventListener('click', async () => {
      const uid = document.getElementById('input-uid').value.trim();
      const recipe_id = document.getElementById('recipe-select').value;
      const errEl = document.getElementById('form-error');
      errEl.textContent = '';

      if (!uid) { errEl.textContent = 'RFID UID is required.'; return; }
      if (mappings.find(m => m.uid === uid)) {
        errEl.textContent = 'This UID is already mapped.'; return;
      }

      try {
        await addRfidMapping(uid, recipe_id);
        const recipe = recipes.find(r => r.id === recipe_id);
        mappings = [...mappings, { uid, recipe_id, recipe_name: recipe?.name ?? recipe_id }];
        renderTable(mappings);
        document.getElementById('input-uid').value = '';
      } catch (err) {
        errEl.textContent = err.message.includes('409') ? 'Mapping already exists.' : `Error: ${err.message}`;
      }
    });

    // Stop scan on page leave
    window.addEventListener('popstate', stopScan, { once: true });
  }, 0);

  return `
    <div class="rfid-page">
      <header class="rfid-header">
        <button class="btn-back" id="btn-back">←</button>
        <h1 class="rfid-title">RFID Card Mappings</h1>
      </header>

      <p class="rfid-error" id="rfid-error"></p>

      <section class="rfid-card">
        <h2 class="rfid-card__heading">Current Mappings</h2>
        <div class="table-wrap">
          <table class="mappings-table" id="mappings-table">
            <thead>
              <tr>
                <th>RFID UID</th>
                <th>Recipe</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="mappings-body">
              <tr><td colspan="3" class="table-empty">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="rfid-card">
        <h2 class="rfid-card__heading">Add New Mapping</h2>
        <div class="form-field">
          <label class="form-label">RFID UID</label>
          <div class="input-row">
            <input class="form-input" id="input-uid" type="text" placeholder="e.g. A7012249">
            <button class="btn-secondary" id="btn-scan">Scan next card</button>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">Recipe</label>
          <select class="form-select" id="recipe-select"></select>
        </div>
        <p class="form-error" id="form-error"></p>
        <button class="btn-primary" id="btn-add">Add Mapping</button>
      </section>
    </div>

    <style>
      .rfid-page {
        max-width: 600px;
        margin: 0 auto;
        padding: 1.5rem 1rem 3rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .rfid-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
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

      .rfid-title {
        font-size: 1.4rem;
        font-weight: 700;
      }

      .rfid-error {
        color: #e07070;
        font-size: 0.9rem;
        min-height: 1em;
      }

      .rfid-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 14px;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .rfid-card__heading {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--color-text-muted);
      }

      .table-wrap { overflow-x: auto; }

      .mappings-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }

      .mappings-table th {
        text-align: left;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text-muted);
        font-size: 0.8rem;
        font-weight: 600;
      }

      .mapping-cell {
        padding: 0.6rem 0.75rem;
        border-bottom: 1px solid var(--color-border);
      }

      .table-empty {
        padding: 1rem 0.75rem;
        color: var(--color-text-muted);
        font-size: 0.9rem;
      }

      .btn-delete {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1rem;
        opacity: 0.7;
        transition: opacity 0.15s;
      }
      .btn-delete:hover { opacity: 1; }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .form-label {
        font-size: 0.9rem;
        font-weight: 600;
      }

      .input-row {
        display: flex;
        gap: 0.6rem;
      }

      .form-input {
        flex: 1;
        padding: 0.6rem 0.8rem;
        border-radius: 10px;
        border: 1px solid var(--color-border);
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.95rem;
      }
      .form-input:focus { outline: none; border-color: var(--color-primary); }

      .form-select {
        width: 100%;
        padding: 0.6rem 0.8rem;
        border-radius: 10px;
        border: 1px solid var(--color-border);
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.95rem;
        cursor: pointer;
      }

      .form-error {
        color: #e07070;
        font-size: 0.85rem;
        min-height: 1em;
      }

      .btn-primary, .btn-secondary {
        padding: 0.6rem 1.2rem;
        border: none;
        border-radius: 10px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
        white-space: nowrap;
      }
      .btn-primary  { background: var(--color-primary); color: #fff; }
      .btn-secondary {
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        color: var(--color-text);
      }
      .btn-primary:hover, .btn-secondary:hover { opacity: 0.85; }
    </style>
  `;
}

function renderTable(mappings) {
  const tbody = document.getElementById('mappings-body');
  if (!tbody) return;
  if (!mappings.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="table-empty">No mappings yet.</td></tr>';
    return;
  }
  tbody.innerHTML = mappings.map(mappingRow).join('');
}

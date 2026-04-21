import './WeightBar.css';

export function createWeightBar(container) {
  container.innerHTML = `
    <div class="wb">
      <div class="wb__track">
        <div class="wb__fill" id="wb-fill"></div>
      </div>
      <div class="wb__readout">
        <span class="wb__value" id="wb-value">0.0g</span>
        <span class="wb__badge" id="wb-badge">Stable ✓</span>
      </div>
    </div>
  `;

  const fill  = container.querySelector('#wb-fill');
  const value = container.querySelector('#wb-value');
  const badge = container.querySelector('#wb-badge');

  function update({ currentWeight = 0, targetWeight = 0, isStable = false } = {}) {
    const pct = targetWeight > 0 ? Math.min(100, (currentWeight / targetWeight) * 100) : 0;
    const overshoot = targetWeight > 0 && currentWeight > targetWeight + 5;

    fill.style.width = `${pct}%`;
    fill.classList.toggle('wb__fill--stable', isStable && !overshoot);
    fill.classList.toggle('wb__fill--overshoot', overshoot);

    value.textContent = `${currentWeight.toFixed(1)}g`;
    badge.classList.toggle('wb__badge--visible', isStable);
  }

  function destroy() {
    container.innerHTML = '';
  }

  return { update, destroy };
}

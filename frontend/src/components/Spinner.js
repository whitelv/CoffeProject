export function createSpinner() {
  const el = document.createElement('div');
  el.className = 'spinner';
  el.innerHTML = `
    <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
      <circle cx="18" cy="18" r="14" fill="none"
        stroke="#c8864a" stroke-width="3"
        stroke-dasharray="60 28" stroke-linecap="round">
        <animateTransform attributeName="transform" type="rotate"
          from="0 18 18" to="360 18 18" dur="0.8s" repeatCount="indefinite"/>
      </circle>
    </svg>
  `;
  return el;
}

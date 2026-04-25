export function createSkeletonCard() {
  const el = document.createElement('div');
  el.className = 'recipe-card recipe-card--skeleton';
  el.innerHTML = `
    <div class="skeleton skeleton--emoji"></div>
    <div class="skeleton skeleton--title"></div>
    <div class="skeleton skeleton--pills"></div>
  `;
  return el;
}

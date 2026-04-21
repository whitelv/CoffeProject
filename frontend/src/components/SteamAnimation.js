export function createSteamAnimation(container, { size = 120, color = '#c8832a' } = {}) {
  const id = `steam-${Math.random().toString(36).slice(2, 8)}`;

  // SVG viewBox is 100x120: cup occupies y=50..100, steam rises in y=0..50
  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${size}" height="${size}"
      viewBox="0 0 100 120"
      aria-hidden="true"
      style="display:block;overflow:visible"
    >
      <style>
        @keyframes ${id}-rise {
          0%   { transform: translateY(0);     opacity: 0.8; }
          60%  { transform: translateY(-28px); opacity: 0.4; }
          100% { transform: translateY(-44px); opacity: 0;   }
        }
        .${id}-wisp {
          animation: ${id}-rise 2s ease-in-out infinite;
          transform-origin: center bottom;
        }
        .${id}-w1 { animation-delay: 0s; }
        .${id}-w2 { animation-delay: 0.3s; }
        .${id}-w3 { animation-delay: 0.6s; }
      </style>

      <!-- Cup body -->
      <rect x="22" y="62" width="56" height="38" rx="4" ry="4" fill="${color}" opacity="0.15"/>
      <rect x="22" y="62" width="56" height="38" rx="4" ry="4"
            fill="none" stroke="${color}" stroke-width="3"/>

      <!-- Cup base rim -->
      <rect x="16" y="97" width="68" height="6" rx="3" ry="3" fill="${color}"/>

      <!-- Handle -->
      <path d="M78 70 Q96 70 96 82 Q96 94 78 94"
            fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>

      <!-- Coffee fill inside cup -->
      <rect x="25" y="72" width="50" height="10" rx="2" fill="${color}" opacity="0.5"/>

      <!-- Saucer -->
      <ellipse cx="50" cy="103" rx="38" ry="5" fill="${color}" opacity="0.2"/>

      <!-- Steam wisps -->
      <g class="${id}-wisp ${id}-w1">
        <path d="M38 60 Q34 52 38 44 Q42 36 38 28"
              fill="none" stroke="${color}" stroke-width="2.5"
              stroke-linecap="round" opacity="0.85"/>
      </g>
      <g class="${id}-wisp ${id}-w2">
        <path d="M50 58 Q46 50 50 42 Q54 34 50 26"
              fill="none" stroke="${color}" stroke-width="2.5"
              stroke-linecap="round" opacity="0.85"/>
      </g>
      <g class="${id}-wisp ${id}-w3">
        <path d="M62 60 Q58 52 62 44 Q66 36 62 28"
              fill="none" stroke="${color}" stroke-width="2.5"
              stroke-linecap="round" opacity="0.85"/>
      </g>
    </svg>
  `;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = svg.trim();
  container.appendChild(wrapper);

  return {
    destroy() {
      wrapper.remove();
    },
  };
}

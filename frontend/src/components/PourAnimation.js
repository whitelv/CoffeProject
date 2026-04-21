export function createPourAnimation(container) {
  const id = `pour-${Math.random().toString(36).slice(2, 8)}`;

  // SVG viewBox: 100x140. Vessel: x=10,y=40 w=80 h=80. Pour stream from above.
  const VESSEL_X = 10;
  const VESSEL_Y = 40;
  const VESSEL_W = 80;
  const VESSEL_H = 80;

  const el = document.createElement('div');
  el.style.cssText = 'display:flex;justify-content:center;';
  el.innerHTML = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="120" height="140"
      viewBox="0 0 100 140"
      aria-hidden="true"
      style="display:block;overflow:visible"
    >
      <defs>
        <clipPath id="${id}-clip">
          <rect x="${VESSEL_X + 2}" y="${VESSEL_Y}" width="${VESSEL_W - 4}" height="${VESSEL_H}"/>
        </clipPath>
      </defs>

      <style>
        @keyframes ${id}-wiggle {
          0%,100% { d: path("M50 5 Q47 12 50 18 Q53 24 50 30"); }
          50%      { d: path("M50 5 Q53 12 50 18 Q47 24 50 30"); }
        }
        @keyframes ${id}-ripple {
          0%,100% { opacity: 0.4; transform: scaleX(1);   }
          50%      { opacity: 0.8; transform: scaleX(0.92); }
        }
        @keyframes ${id}-flash {
          0%   { fill: #4caf50; }
          100% { fill: #5bb8e8; }
        }
        .${id}-stream {
          animation: ${id}-wiggle 0.4s ease-in-out infinite;
          display: none;
        }
        .${id}-stream.pouring { display: block; }
        .${id}-ripple {
          transform-origin: 50px 0;
          animation: ${id}-ripple 2s ease-in-out infinite;
        }
        .${id}-water.full {
          animation: ${id}-flash 0.5s ease-in-out 3;
        }
      </style>

      <!-- Vessel outline -->
      <rect
        x="${VESSEL_X}" y="${VESSEL_Y}"
        width="${VESSEL_W}" height="${VESSEL_H}"
        rx="6" ry="6"
        fill="none" stroke="#c8832a" stroke-width="3"
      />

      <!-- Water fill (grows from bottom, clipped to vessel interior) -->
      <g clip-path="url(#${id}-clip)">
        <rect
          id="${id}-water"
          class="${id}-water"
          x="${VESSEL_X + 2}"
          y="${VESSEL_Y + VESSEL_H}"
          width="${VESSEL_W - 4}"
          height="0"
          fill="#5bb8e8"
          opacity="0.75"
          style="transition: y 0.3s ease, height 0.3s ease;"
        />
        <!-- Ripple surface line -->
        <rect
          id="${id}-ripple"
          class="${id}-ripple"
          x="${VESSEL_X + 4}"
          y="${VESSEL_Y + VESSEL_H}"
          width="${VESSEL_W - 8}"
          height="3"
          rx="1.5"
          fill="#a0d8f0"
          opacity="0"
          style="transition: y 0.3s ease;"
        />
      </g>

      <!-- Pour stream (wavy path from top, shown only when pouring) -->
      <path
        id="${id}-stream"
        class="${id}-stream"
        d="M50 5 Q47 12 50 18 Q53 24 50 30"
        fill="none"
        stroke="#5bb8e8"
        stroke-width="3"
        stroke-linecap="round"
        opacity="0.85"
      />
    </svg>
  `;

  container.appendChild(el);

  const waterEl  = el.querySelector(`#${id}-water`);
  const rippleEl = el.querySelector(`#${id}-ripple`);
  const streamEl = el.querySelector(`#${id}-stream`);

  let lastFillPercent = 0;

  function update({ fillPercent = 0, isPouring = false } = {}) {
    const pct = Math.max(0, Math.min(100, fillPercent));
    const fillH = (pct / 100) * VESSEL_H;
    const topY  = VESSEL_Y + VESSEL_H - fillH;

    waterEl.setAttribute('y', topY);
    waterEl.setAttribute('height', fillH);

    rippleEl.setAttribute('y', topY);
    rippleEl.style.opacity = fillH > 2 ? '0.6' : '0';

    // Pour stream
    streamEl.classList.toggle('pouring', isPouring);

    // Green flash when nearly full (crossing 95% threshold)
    if (pct >= 95 && lastFillPercent < 95) {
      waterEl.classList.add('full');
      waterEl.addEventListener('animationend', () => waterEl.classList.remove('full'), { once: true });
    }

    lastFillPercent = pct;
  }

  function destroy() {
    el.remove();
  }

  return { update, destroy };
}

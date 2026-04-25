const http = require('http');

const PORT = 8001;

let weight = 0;
let oled = { line1: '', line2: '' };
let session = { active: false, recipe_id: null, step: 0 };
let stepLogs = [];
let rfidPending = null;
let rfidMappings = [
  { uid: 'CARD001', recipe_id: 'espresso' },
  { uid: 'CARD002', recipe_id: 'v60' },
];
let brewHistory = [
  {
    id: 'mock-1',
    recipe_id: 'espresso',
    recipe_name: 'Espresso',
    completed: true,
    started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000 + 90000).toISOString(),
    steps: [{ step_name: 'Tamp', target_weight_g: 36, actual_weight_g: 35.8 }],
  },
  {
    id: 'mock-2',
    recipe_id: 'v60',
    recipe_name: 'V60',
    completed: true,
    started_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 24 * 60 * 60 * 1000 + 200000).toISOString(),
    steps: [
      { step_name: 'Bloom', target_weight_g: 50, actual_weight_g: 51.2 },
      { step_name: 'Pour',  target_weight_g: 200, actual_weight_g: 198.5 },
    ],
  },
  {
    id: 'mock-3',
    recipe_id: 'aeropress',
    recipe_name: 'AeroPress',
    completed: false,
    started_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    completed_at: null,
    steps: [{ step_name: 'Brew', target_weight_g: 220, actual_weight_g: 180.0 }],
  },
];

const RECIPES = [
  {
    id: 'espresso', name: 'Espresso',
    description: 'A concentrated shot of coffee brewed under pressure. Intense, rich, and the base for most milk drinks.',
    dose_g: 18, brew_time: '~5 min', grind_size: 'Fine',
    steps: [
      { type: 'grind', name: 'Grind & Dose',
        instruction: 'Place the portafilter on the scale.\nGrind directly into the portafilter until you hit the target weight.\nDistribute evenly, then tamp flat with firm pressure.',
        target_weight_g: 18 },
      { type: 'pour', name: 'Extract Espresso',
        instruction: 'Start the machine and collect the shot.\nAim for 36 g output (2:1 ratio).\nIdeal extraction time: 25–30 sec.\nStop if it runs longer — the grind may be too fine.',
        target_weight_g: 36 },
    ],
  },
  {
    id: 'v60', name: 'V60',
    description: 'A clean, bright pour-over that highlights the delicate flavours of the coffee bean.',
    dose_g: 15, brew_time: '~3 min', grind_size: 'Medium-fine',
    steps: [
      { type: 'prep', name: 'Set Up Filter',
        instruction: 'Place a paper filter in the V60 and rinse with hot water — removes paper taste and preheats the brewer.\nDiscard the rinse water.\nPlace the V60 with server on the scale.' },
      { type: 'grind', name: 'Grind & Dose',
        instruction: 'Place the V60 on the scale (or a separate container).\nGrind directly in until you hit the target weight.\nMedium-fine texture — like coarse sand.',
        target_weight_g: 15 },
      { type: 'pour', name: 'Bloom',
        instruction: 'Pour 50 g of water at 93°C in a slow spiral from centre outward.\nThis saturates all the grounds and releases CO₂ — you will see the coffee puff up.\nFresh coffee blooms more.',
        target_weight_g: 50 },
      { type: 'wait', name: 'Bloom Rest',
        instruction: 'Let the bloom sit undisturbed.\nThe coffee will settle and crust slightly — that is normal.\nThis step lets CO₂ escape so the next pour extracts evenly.',
        duration_s: 30 },
      { type: 'pour', name: 'Main Pour',
        instruction: 'Pour the remaining water in steady spirals.\nKeep the water level consistent — don\'t let it drain completely between pours.\nFinish by 2:30 min; total draw-down should complete by 3:00 min.',
        target_weight_g: 200 },
    ],
  },
  {
    id: 'french-press', name: 'French Press',
    description: 'Full-bodied and rich — an immersion brew that keeps the natural oils in the cup.',
    dose_g: 30, brew_time: '~5 min', grind_size: 'Coarse',
    steps: [
      { type: 'prep', name: 'Preheat',
        instruction: 'Pour hot water into the empty French Press to preheat it, then discard.\nThis keeps the brew temperature stable.' },
      { type: 'grind', name: 'Grind & Dose',
        instruction: 'Place the French Press (empty) or a bowl on the scale.\nGrind coarsely — like breadcrumbs — until you hit the target.\nAdd grounds to the press.',
        target_weight_g: 30 },
      { type: 'pour', name: 'Add Water',
        instruction: 'Pour 500 g of water at 93–96°C over the grounds.\nEnsure all the coffee is saturated — stir gently once with a spoon.\nPlace the lid on top (plunger up) but do not press yet.',
        target_weight_g: 500 },
      { type: 'wait', name: 'Steep',
        instruction: 'Leave it completely undisturbed.\n4 minutes is the sweet spot — longer = more bitter, shorter = weaker.\nAt the end, press the plunger down slowly and evenly.',
        duration_s: 240 },
    ],
  },
  {
    id: 'aeropress', name: 'AeroPress',
    description: 'Versatile, forgiving, and surprisingly smooth — great for beginners and coffee geeks alike.',
    dose_g: 17, brew_time: '~2 min', grind_size: 'Medium',
    steps: [
      { type: 'prep', name: 'Set Up AeroPress',
        instruction: 'Insert a paper filter in the cap and rinse with hot water.\nAssemble the AeroPress in inverted position and place on the scale.' },
      { type: 'grind', name: 'Grind & Dose',
        instruction: 'Grind to a medium texture — like table salt.\nDose directly into the inverted AeroPress chamber.',
        target_weight_g: 17 },
      { type: 'pour', name: 'Add Water',
        instruction: 'Pour 220 g of water at 85–90°C (slightly cooler than boiling).\nStir gently 3–4 times to make sure all grounds are wet.\nSnap the cap on.',
        target_weight_g: 220 },
      { type: 'wait', name: 'Steep & Press',
        instruction: 'Wait for 90 seconds total steep time.\nThen flip onto your cup and press slowly — 20–30 sec of steady pressure.\nStop when you hear a hiss — don\'t squeeze the last drops (they are bitter).',
        duration_s: 90 },
    ],
  },
  {
    id: 'cold-brew', name: 'Cold Brew',
    description: 'Smooth and naturally sweet — steeped cold overnight for zero bitterness.',
    dose_g: 80, brew_time: '12–18 hr', grind_size: 'Extra coarse',
    steps: [
      { type: 'grind', name: 'Grind & Dose',
        instruction: 'Place your jar or cold brew vessel on the scale.\nGrind very coarsely — like rough gravel.\nFiner grind = over-extraction after 12+ hours.',
        target_weight_g: 80 },
      { type: 'pour', name: 'Add Cold Water',
        instruction: 'Pour 1000 g of cold or room-temperature water over the grounds.\nStir well to saturate all the coffee.\nCover and refrigerate.',
        target_weight_g: 1000 },
      { type: 'wait', name: 'Steep Overnight',
        instruction: 'Steep in the fridge for 12–18 hours.\n12 hr = lighter and sweeter. 18 hr = stronger concentrate.\nWhen done, strain through a filter or fine mesh.\nServe over ice, dilute 1:1 with water or milk if it\'s concentrate.',
        duration_s: 600 },
    ],
  },
  {
    id: 'latte', name: 'Latte',
    description: 'A double espresso with velvety steamed milk — smooth, creamy, and mildly coffee-forward.',
    dose_g: 18, brew_time: '~5 min', grind_size: 'Fine',
    steps: [
      { type: 'grind', name: 'Grind & Dose',
        instruction: 'Place the portafilter on the scale.\nGrind directly into it until you hit the target weight.\nDistribute evenly, then tamp flat with firm pressure.',
        target_weight_g: 18 },
      { type: 'pour', name: 'Extract Espresso',
        instruction: 'Pull a double shot into your cup.\nTarget: 36 g output in 25–30 sec.\nThe shot should be dark amber with a reddish-brown crema on top.',
        target_weight_g: 36 },
      { type: 'milk', name: 'Weigh Cold Milk',
        instruction: 'Place your steaming pitcher on the scale.\nPour in cold whole milk — cold milk gives you more time to texture it.\nFill pitcher to about ⅓ full (leaves room for expansion).',
        target_weight_g: 200 },
      { type: 'wait', name: 'Steam Milk',
        instruction: 'Submerge the steam wand just below the surface.\nFor 2–3 sec: keep the tip near the surface to stretch (introduce air) — you should hear a soft "chh" sound.\nThen submerge deeper and spin the milk in a whirlpool to heat to 60–65°C.\nGoal: smooth, glossy microfoam with no large bubbles.',
        duration_s: 40 },
      { type: 'pour', name: 'Pour Milk',
        instruction: 'Tap the pitcher on the counter and swirl to break any bubbles.\nHold the cup at an angle and pour from low height in a steady stream through the crema.\nFinish with a small upward flick to create a simple latte art dot or heart.\nAim for ~1 cm foam layer on top.',
        target_weight_g: 200 },
    ],
  },
  {
    id: 'cappuccino', name: 'Cappuccino',
    description: 'Equal thirds espresso, steamed milk, and thick dry foam — bold and classic.',
    dose_g: 18, brew_time: '~5 min', grind_size: 'Fine',
    steps: [
      { type: 'grind', name: 'Grind & Dose',
        instruction: 'Place the portafilter on the scale.\nGrind directly into it until you hit the target weight.\nDistribute evenly, then tamp firmly and level.',
        target_weight_g: 18 },
      { type: 'pour', name: 'Extract Espresso',
        instruction: 'Pull a double shot into a cappuccino cup (150–180 ml).\nTarget: 36 g output in 25–30 sec.\nStrong shot is important — milk will balance the intensity.',
        target_weight_g: 36 },
      { type: 'milk', name: 'Weigh Cold Milk',
        instruction: 'Place your steaming pitcher on the scale.\nPour cold whole milk — less than a latte, cappuccino is drier.\nFill pitcher to just under ⅓.',
        target_weight_g: 120 },
      { type: 'wait', name: 'Steam Milk',
        instruction: 'Keep the steam wand near the surface longer than for a latte — 4–6 sec of stretching.\nThis builds more foam volume.\nHeat to 60–65°C.\nThe milk should roughly double in volume and look thick and foamy, not liquid.',
        duration_s: 35 },
      { type: 'pour', name: 'Pour & Foam',
        instruction: 'Pour the steamed milk, then spoon the thick foam on top to form a dome.\nThe cup should be ⅓ espresso, ⅓ steamed milk, ⅓ foam.\nDust with cocoa powder if desired.',
        target_weight_g: 120 },
    ],
  },
];

let lastManualSet = 0;

setInterval(() => {
  if (!session.active) return;
  if (Date.now() - lastManualSet < 3000) return;
  const recipe = RECIPES.find(r => r.id === session.recipe_id);
  const step = recipe?.steps?.[session.step];
  const target = step?.target_weight_g ?? 0;
  if (target > 0 && weight < target) {
    weight = Math.min(target, +(weight + 2).toFixed(1));
  }
}, 400);

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(json);
}

function handleOptions(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

const server = http.createServer(async (req, res) => {
  const url = req.url.replace(/\/?$/, '/').replace(/\/+/g, '/');
  console.log(`${req.method} ${url}`);

  if (req.method === 'OPTIONS') return handleOptions(res);

  if (req.method === 'GET' && url === '/weight/current/') {
    return send(res, 200, { weight });
  }

  if (req.method === 'POST' && url === '/weight/current/') {
    const body = await readBody(req);
    if (body.weight !== undefined) { weight = body.weight; lastManualSet = Date.now(); }
    return send(res, 200, { weight });
  }

  if (req.method === 'POST' && url === '/weight/confirmed/') {
    const body = await readBody(req);
    console.log('confirmed weight:', body.weight);
    const recipe = RECIPES.find(r => r.id === session.recipe_id);
    const step = recipe?.steps?.[session.step];
    if (step) {
      stepLogs.push({ step_name: step.name, target_weight_g: step.target_weight_g, actual_weight_g: body.weight ?? weight });
    }
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url === '/oled/') {
    return send(res, 200, oled);
  }

  if (req.method === 'POST' && url === '/oled/') {
    const body = await readBody(req);
    oled = { ...oled, ...body };
    return send(res, 200, oled);
  }

  if (req.method === 'GET' && url === '/recipes/') {
    return send(res, 200, RECIPES);
  }

  const recipeMatch = url.match(/^\/recipes\/([^/]+)\/$/);
  if (req.method === 'GET' && recipeMatch) {
    const recipe = RECIPES.find(r => r.id === recipeMatch[1]);
    return recipe ? send(res, 200, recipe) : send(res, 404, { error: 'not found' });
  }

  if (req.method === 'GET' && url === '/session/') {
    return send(res, 200, session);
  }

  if (req.method === 'GET' && url === '/recipe/current/') {
    if (!session.active) return send(res, 404, { error: 'No active session' });
    const recipe = RECIPES.find(r => r.id === session.recipe_id) ?? RECIPES[0];
    const steps  = recipe.steps ?? [];
    if (session.step >= steps.length) return send(res, 200, { complete: true });
    const step = steps[session.step];
    return send(res, 200, {
      complete: false,
      type: step.type ?? 'pour',
      name: step.name,
      instruction: step.instruction,
      target_weight_g: step.target_weight_g ?? null,
      duration_s: step.duration_s ?? null,
      step_index: session.step,
      total_steps: steps.length,
    });
  }

  if (req.method === 'POST' && url === '/recipe/select/') {
    const body = await readBody(req);
    const recipeId = body.id ?? body.uid ?? body.rfid ?? null;
    const recipe = RECIPES.find(r => r.id === recipeId) ?? RECIPES[0];
    session = { active: true, recipe_id: recipe.id, step: 0 };
    stepLogs = [];
    weight = 0;
    return send(res, 200, {
      id: recipe.id,
      name: recipe.name,
      first_step: recipe.steps[0]?.name ?? '',
      target_weight_g: recipe.steps[0]?.target_weight_g ?? 0,
    });
  }

  if (req.method === 'POST' && url === '/step/complete/') {
    session.step += 1;
    return send(res, 200, session);
  }

  if (req.method === 'POST' && url === '/brew/complete/') {
    session.active = false;
    const recipe = RECIPES.find(r => r.id === session.recipe_id);
    const entry = {
      id: `brew-${Date.now()}`,
      recipe_id: session.recipe_id,
      recipe_name: recipe?.name ?? session.recipe_id,
      completed: true,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      steps: [...stepLogs],
    };
    brewHistory.unshift(entry);
    return send(res, 200, { ok: true, session, step_logs: stepLogs });
  }

  if (req.method === 'GET' && url === '/brews/history/') {
    return send(res, 200, [...brewHistory]);
  }

  if (req.method === 'DELETE' && url === '/brews/history/') {
    brewHistory.length = 0;
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url === '/rfid/last/') {
    const uid = rfidPending;
    rfidPending = null;
    return send(res, 200, { uid });
  }

  if (req.method === 'POST' && url === '/rfid/simulate/') {
    const body = await readBody(req);
    rfidPending = body.uid ?? null;
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url === '/rfid-mappings/') {
    const list = rfidMappings.map(m => ({
      ...m,
      recipe_name: RECIPES.find(r => r.id === m.recipe_id)?.name ?? m.recipe_id,
    }));
    return send(res, 200, list);
  }

  if (req.method === 'POST' && url === '/rfid-mappings/') {
    const body = await readBody(req);
    const { uid, recipe_id } = body;
    if (!uid) return send(res, 400, { error: 'uid required' });
    if (rfidMappings.find(m => m.uid === uid)) return send(res, 409, { error: 'mapping already exists' });
    rfidMappings.push({ uid, recipe_id });
    return send(res, 200, { ok: true });
  }

  const rfidDeleteMatch = url.match(/^\/rfid-mappings\/([^/]+)\/?$/);
  if (req.method === 'DELETE' && rfidDeleteMatch) {
    const uid = decodeURIComponent(rfidDeleteMatch[1]);
    rfidMappings = rfidMappings.filter(m => m.uid !== uid);
    return send(res, 200, { ok: true });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`mock-esp32 listening on http://localhost:${PORT}`));

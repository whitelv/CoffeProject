const http = require('http');

const PORT = 8001;

let weight = 0;
let oled = { line1: '', line2: '' };
let session = { active: false, recipe_id: null, step: 0 };
let stepLogs = [];

setInterval(() => {
  if (session.active && weight < 36) {
    weight = Math.min(36, +(weight + 2).toFixed(1));
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
    if (body.weight !== undefined) weight = body.weight;
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

  const RECIPES = [
    { id: 'espresso',      name: 'Espresso',     description: 'A concentrated shot of coffee brewed under pressure.', dose_g: 18, brew_time: '25s',   grind_size: 'Fine',        steps: [{ name: 'Tamp',   instruction: 'Tamp grounds evenly', target_weight_g: 36 }] },
    { id: 'v60',           name: 'V60',           description: 'A clean, bright pour-over brew with clarity of flavour.', dose_g: 15, brew_time: '3 min',  grind_size: 'Medium-fine', steps: [{ name: 'Bloom',  instruction: 'Pour 50g, wait 30s',  target_weight_g: 50 }, { name: 'Pour', instruction: 'Pour remaining 200g', target_weight_g: 200 }] },
    { id: 'french-press',  name: 'French Press',  description: 'Full-bodied and rich, steeped for full immersion.', dose_g: 30, brew_time: '4 min',  grind_size: 'Coarse',      steps: [{ name: 'Steep',  instruction: 'Add 500g water',      target_weight_g: 500 }] },
    { id: 'aeropress',     name: 'AeroPress',     description: 'Versatile and smooth with low acidity.', dose_g: 17, brew_time: '2 min',  grind_size: 'Medium',      steps: [{ name: 'Brew',   instruction: 'Pour 220g water',     target_weight_g: 220 }] },
    { id: 'cold-brew',     name: 'Cold Brew',     description: 'Smooth, sweet cold concentrate steeped overnight.', dose_g: 80, brew_time: '12 hr',  grind_size: 'Extra coarse',steps: [{ name: 'Steep',  instruction: 'Add 1000g cold water', target_weight_g: 1000 }] },
  ];

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
      name: step.name,
      instruction: step.instruction,
      target_weight_g: step.target_weight_g,
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
    return send(res, 200, { ok: true, session, step_logs: stepLogs });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`mock-esp32 listening on http://localhost:${PORT}`));

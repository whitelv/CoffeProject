const http = require('http');

const PORT = 8001;

let weight = 0;
let oled = { line1: '', line2: '' };
let session = { active: false, recipe_id: null, step: 0 };

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
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

const server = http.createServer(async (req, res) => {
  const url = req.url.replace(/\/?$/, '/').replace(/\/+/g, '/');
  console.log(`${req.method} ${url}`);

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

  if (req.method === 'GET' && url === '/session/') {
    return send(res, 200, session);
  }

  if (req.method === 'POST' && url === '/recipe/select/') {
    const body = await readBody(req);
    session = { active: true, recipe_id: body.rfid ?? body.id ?? null, step: 0 };
    weight = 0;
    return send(res, 200, session);
  }

  if (req.method === 'POST' && url === '/step/complete/') {
    session.step += 1;
    return send(res, 200, session);
  }

  if (req.method === 'POST' && url === '/brew/complete/') {
    session.active = false;
    return send(res, 200, { ok: true, session });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`mock-esp32 listening on http://localhost:${PORT}`));

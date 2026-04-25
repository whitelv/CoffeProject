function getBaseUrl() {
  return localStorage.getItem('brew_api_url') || import.meta.env.VITE_API_URL || '';
}

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export function get(path) {
  return fetch(`${getBaseUrl()}${path}`).then(handleResponse);
}

export function post(path, body) {
  return fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handleResponse);
}

export function del(path) {
  return fetch(`${getBaseUrl()}${path}`, { method: 'DELETE' }).then(handleResponse);
}

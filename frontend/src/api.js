const API_BASE = 'https://my-sync.onrender.com/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include', ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  verifyPin: (pin) => request('/pin', { method: 'POST', body: JSON.stringify({ pin }) }),
  setupPin: (pin) => request('/setup-pin', { method: 'POST', body: JSON.stringify({ pin }) }),
  checkPinConfigured: () => request('/pin/status'),
  addClipboardItem: (item) => request('/clipboard', { method: 'POST', body: JSON.stringify(item) }),
  getClipboardItems: () => request('/clipboard'),
  deleteClipboardItem: (id) => request(`/clipboard/${id}`, { method: 'DELETE' })
};
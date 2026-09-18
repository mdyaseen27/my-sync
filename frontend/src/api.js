const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include',
    ...options
  });
  
  const data = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  
  return data;
}

export const api = {
  createSession: () => request('/sessions', { method: 'POST' }),
  
  joinSession: (sessionId, pin) => 
    request(`/sessions/${sessionId}/join`, {
      method: 'POST',
      body: JSON.stringify({ pin })
    }),
  
  getSession: (sessionId) => request(`/sessions/${sessionId}`),
  
  endSession: (sessionId) => 
    request(`/sessions/${sessionId}`, { method: 'DELETE' }),
  
  addClipboardItem: (sessionId, item) => 
    request(`/sessions/${sessionId}/clipboard`, {
      method: 'POST',
      body: JSON.stringify(item)
    }),
  
  getClipboardItems: (sessionId) => 
    request(`/sessions/${sessionId}/clipboard`),
  
  removeDevice: (sessionId, deviceId) => 
    request(`/sessions/${sessionId}/devices/${deviceId}`, { method: 'DELETE' })
};
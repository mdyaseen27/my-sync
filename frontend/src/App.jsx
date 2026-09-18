import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { 
  initSocket, 
  disconnectSocket, 
  getSocket,
  onClipboardItem, offClipboardItem,
  onDeviceJoined, offDeviceJoined,
  onDeviceLeft, offDeviceLeft,
  onSessionEnded, offSessionEnded,
  onConnect, offConnect,
  onDisconnect, offDisconnect,
  onReconnecting, offReconnecting,
  onReconnect, offReconnect
} from './socket';
import { 
  encryptText, decryptText, 
  encryptImage, decryptImage,
  generateSalt, base64ToSalt
} from './crypto';
import ClipboardFeed from './ClipboardFeed';
import PinDisplay from './PinDisplay';
import JoinForm from './JoinForm';
import DeviceList from './DeviceList';
import SessionHeader from './SessionHeader';
import Toast from './Toast';
import './styles.css';

export default function App() {
  const [state, setState] = useState('idle');
  const [sessionId, setSessionId] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [pin, setPin] = useState(null);
  const [salt, setSalt] = useState(null);
  const [items, setItems] = useState([]);
  const [devices, setDevices] = useState([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const [toast, setToast] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [joinSessionId, setJoinSessionId] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  
  const pingIntervalRef = useRef(null);
  const expiryIntervalRef = useRef(null);
  const initRef = useRef(false);
  
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  
  const clearSession = useCallback(() => {
    setState('idle');
    setSessionId(null); setDeviceId(null);
    setPin(null); setSalt(null);
    setItems([]); setDevices([]);
    setConnected(false); setReconnecting(false);
    setSessionExpiry(null); setIsHost(false);
    initRef.current = false;
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
    disconnectSocket();
  }, []);
  
  const startExpiryTimer = useCallback((expiresAt) => {
    if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { clearSession(); showToast('Session expired', 'error'); return; }
      setSessionExpiry(diff);
    };
    update();
    expiryIntervalRef.current = setInterval(update, 1000);
  }, [clearSession, showToast]);
  
  const setupSocketListeners = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    
    const cleanup = () => {
      offClipboardItem(() => {});
      offDeviceJoined(() => {});
      offDeviceLeft(() => {});
      offSessionEnded(() => {});
      offConnect(() => {});
      offDisconnect(() => {});
      offReconnecting(() => {});
      offReconnect(() => {});
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
    
    const handleClipboardItem = (item) => {
      setItems(prev => prev.some(i => i.id === item.id) ? prev : [{ ...item, createdAt: new Date(item.createdAt).getTime() }, ...prev].slice(0, 100));
    };
    const handleDeviceJoined = ({ deviceId: d }) => { setDevices(prev => [...prev, { id: d, joinedAt: Date.now() }]); showToast('Device joined', 'info'); };
    const handleDeviceLeft = ({ deviceId: d }) => { setDevices(prev => prev.filter(x => x.id !== d)); showToast('Device left', 'info'); };
    const handleSessionEnded = () => { showToast('Session ended by host', 'error'); clearSession(); };
    const handleConnect = () => { setConnected(true); setReconnecting(false); };
    const handleDisconnect = () => { setConnected(false); };
    const handleReconnecting = () => { setReconnecting(true); };
    const handleReconnect = () => { setReconnecting(false); setConnected(true); };
    
    onClipboardItem(handleClipboardItem);
    onDeviceJoined(handleDeviceJoined);
    onDeviceLeft(handleDeviceLeft);
    onSessionEnded(handleSessionEnded);
    onConnect(handleConnect);
    onDisconnect(handleDisconnect);
    onReconnecting(handleReconnecting);
    onReconnect(handleReconnect);
    
    pingIntervalRef.current = setInterval(() => socket.emit('ping'), 30000);
    
    return cleanup;
  }, [showToast, clearSession]);
  
  const handleCreateSession = useCallback(async () => {
    try {
      const newSalt = generateSalt();
      const result = await api.createSession();
      const newSessionId = result.sessionId;
      const newPin = result.pin;
      setSalt(newSalt); setSessionId(newSessionId); setPin(newPin); setIsHost(true);
      const { deviceId: newDeviceId } = await api.joinSession(newSessionId, newPin);
      setDeviceId(newDeviceId);
      setState('session');
      const { items: initialItems } = await api.getClipboardItems(newSessionId);
      setItems(initialItems.map(item => ({ ...item, createdAt: new Date(item.created_at).getTime() })));
      initSocket(newSessionId, newDeviceId);
      initRef.current = true;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);
  
  const handleJoinSession = useCallback(async (sid, pinToJoin) => {
    setJoinLoading(true); setJoinError('');
    try {
      const { deviceId: newDeviceId } = await api.joinSession(sid, pinToJoin);
      const { data: sd } = await api.getSession(sid);
      const newSalt = base64ToSalt(sd.session.salt);
      setSalt(newSalt); setSessionId(sid); setDeviceId(newDeviceId); setPin(pinToJoin); setIsHost(false);
      setState('session');
      const { items: initialItems } = await api.getClipboardItems(sid);
      setItems(initialItems.map(item => ({ ...item, createdAt: new Date(item.created_at).getTime() })));
      startExpiryTimer(sd.session.expires_at);
      initSocket(sid, newDeviceId);
      initRef.current = true;
    } catch (err) {
      setJoinError(err.message);
      throw err;
    } finally {
      setJoinLoading(false);
    }
  }, [showToast, startExpiryTimer]);
  
  const handleAddText = useCallback(async (text) => {
    if (!sessionId || !salt || !pin) return;
    try {
      const { ciphertext, iv } = await encryptText(pin, salt, text);
      await api.addClipboardItem(sessionId, { type: 'text', ciphertext, iv, expiresAt: new Date(Date.now() + 86400000).toISOString() });
      showToast('Text synced', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }, [sessionId, salt, pin, showToast]);
  
  const handleAddImage = useCallback(async (file) => {
    if (!sessionId || !salt || !pin) return;
    if (file.size > 5242880) { showToast('Image too large (max 5MB)', 'error'); return; }
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) { showToast('Invalid image type', 'error'); return; }
    try {
      const { ciphertext, iv, mimeType } = await encryptImage(pin, salt, file);
      await api.addClipboardItem(sessionId, { type: 'image', ciphertext, iv, mimeType, expiresAt: new Date(Date.now() + 86400000).toISOString() });
      showToast('Image synced', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }, [sessionId, salt, pin, showToast]);
  
  const handleCopyText = useCallback(async (item) => {
    if (!pin || !salt) return;
    try { const text = await decryptText(pin, salt, item.ciphertext, item.iv); await navigator.clipboard.writeText(text); showToast('Copied to clipboard', 'success'); }
    catch { showToast('Failed to copy', 'error'); }
  }, [pin, salt, showToast]);
  
  const handleCopyImage = useCallback(async (item) => {
    if (!pin || !salt) return;
    try { const buf = await decryptImage(pin, salt, item.ciphertext, item.iv); const blob = new Blob([buf], { type: item.mimeType || 'image/png' }); await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]); showToast('Image copied', 'success'); }
    catch { showToast('Failed to copy image', 'error'); }
  }, [pin, salt, showToast]);
  
  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    try { await api.endSession(sessionId); showToast('Session ended', 'success'); clearSession(); }
    catch { showToast('Failed to end session', 'error'); }
  }, [sessionId, showToast, clearSession]);
  
  const handleKickDevice = useCallback(async (devId) => {
    if (!sessionId) return;
    try { await api.removeDevice(sessionId, devId); showToast('Device removed', 'success'); }
    catch { showToast('Failed to remove device', 'error'); }
  }, [sessionId, showToast]);
  
  const loadSessionData = useCallback(async (sid) => {
    try {
      const { data: sd } = await api.getSession(sid);
      if (sd?.session?.expires_at) startExpiryTimer(sd.session.expires_at);
      if (sd?.devices) setDevices(sd.devices.map(d => ({ id: d.id, fingerprint: d.device_fingerprint, joinedAt: new Date(d.joined_at).getTime(), lastSeen: new Date(d.last_seen_at).getTime() })));
    } catch {}
  }, [startExpiryTimer]);
  
  useEffect(() => {
    if (state === 'session' && sessionId && !initRef.current) {
      initRef.current = true;
      setupSocketListeners();
      loadSessionData(sessionId);
    }
  }, [state, sessionId, setupSocketListeners, loadSessionData]);
  
  if (state === 'idle') {
    return (
      <div className="app">
        <div className="container">
          <header className="header">
            <h1>MY Sync</h1>
            <p className="subtitle">Secure cross-device clipboard sharing</p>
          </header>
          <main className="main">
            <div className="card start-card">
              <button className="btn btn-primary btn-large" onClick={handleCreateSession}>Start Clipboard</button>
              <p className="or-divider">or</p>
              <JoinForm sessionId={joinSessionId} onJoin={handleJoinSession} loading={joinLoading} error={joinError} />
              <div style={{ marginTop: '12px' }}>
                <input type="text" value={joinSessionId} onChange={(e) => setJoinSessionId(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Or enter PIN to join" maxLength={6} inputMode="numeric" pattern="[0-9]*" className="pin-input" aria-label="Session PIN" style={{ width: '100%', padding: '12px', fontSize: '1.5rem', textAlign: 'center', fontFamily: 'var(--font-mono)', background: 'var(--color-pin-bg)', border: '2px solid var(--color-pin-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', marginBottom: '12px' }} />
              </div>
            </div>
            <div className="features">
              <div className="feature"><span className="feature-icon">🔐</span><div><h3>End-to-End Encrypted</h3><p>Your clipboard content is encrypted before it leaves your device</p></div></div>
              <div className="feature"><span className="feature-icon">⚡</span><div><h3>Real-time Sync</h3><p>Instantly available on all connected devices via WebSocket</p></div></div>
              <div className="feature"><span className="feature-icon">🕐</span><div><h3>Ephemeral Sessions</h3><p>Auto-expires after inactivity — no permanent data stored</p></div></div>
            </div>
          </main>
        </div>
        {toast && <Toast {...toast} />}
      </div>
    );
  }
  
  return (
    <div className="app">
      <SessionHeader sessionId={sessionId} pin={pin} connected={connected} reconnecting={reconnecting} expiry={sessionExpiry} isHost={isHost} onEndSession={handleEndSession} onCopyPin={() => { navigator.clipboard.writeText(pin); showToast('PIN copied', 'success'); }} />
      <main className="main">
        <DeviceList devices={devices} currentDeviceId={deviceId} onKick={handleKickDevice} isHost={isHost} />
        <ClipboardFeed items={items} pin={pin} salt={salt} onCopyText={handleCopyText} onCopyImage={handleCopyImage} onAddText={handleAddText} onAddImage={handleAddImage} />
      </main>
      {toast && <Toast {...toast} />}
    </div>
  );
}
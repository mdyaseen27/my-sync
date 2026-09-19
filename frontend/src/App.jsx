import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import {
  initSocketDirect, disconnectSocket,
  onClipboardItem, offClipboardItem,
  onClipboardDeleted, offClipboardDeleted,
  onConnect, offConnect,
  onDisconnect, offDisconnect
} from './socket';
import { encryptText, decryptText, encryptImage, decryptImage } from './crypto';
import ClipboardFeed from './ClipboardFeed';
import SessionHeader from './SessionHeader';
import Toast from './Toast';
import './styles.css';

export default function App() {
  const [state, setState] = useState('checking');
  const [pin, setPin] = useState(null);
  const [salt, setSalt] = useState(null);
  const [items, setItems] = useState([]);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState(null);
  const [verifyError, setVerifyError] = useState('');
  const [pinToVerify, setPinToVerify] = useState(Array(6).fill(''));
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [pinConfigured, setPinConfigured] = useState(true);
  const [setupPin, setSetupPin] = useState(Array(6).fill(''));
  const [setupConfirmPin, setSetupConfirmPin] = useState(Array(6).fill(''));
  const [setupLoading, setSetupLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const pingIntervalRef = useRef(null);
  const socketRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const checkPinConfigured = useCallback(async () => {
    try {
      const { configured } = await api.checkPinConfigured();
      setPinConfigured(configured);
      setState(configured ? 'verify' : 'setup');
    } catch { setState('setup'); }
  }, []);

  const setupPinHandler = useCallback(async (fullPin) => {
    if (fullPin.length !== 6) return;
    setSetupLoading(true);
    try {
      await api.setupPin(fullPin);
      showToast('PIN set successfully', 'success');
      setPinConfigured(true);
      setState('verify');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSetupLoading(false); }
  }, [showToast]);

  const verifyPinHandler = useCallback(async (fullPin) => {
    setVerifyLoading(true);
    setVerifyError('');
    try {
      const result = await api.verifyPin(fullPin);
      setPin(fullPin);
      const hex = result.salt;
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      setSalt(bytes);
      setState('session');
      initSocketDirect();
    } catch (err) { setVerifyError(err.message); }
    finally { setVerifyLoading(false); }
  }, []);

  const initSocket = useCallback(() => {
    const socket = initSocketDirect();
    socketRef.current = socket;
    const handleClipboardItem = (item) => {
      setItems(prev => prev.some(i => i.id === item.id) ? prev : [{ ...item, createdAt: new Date(item.createdAt).getTime() }, ...prev].slice(0, 100));
    };
    const handleClipboardDeleted = ({ id }) => { setItems(prev => prev.filter(i => i.id !== id)); };
    const handleConnect = () => { setConnected(true); };
    const handleDisconnect = () => { setConnected(false); };
    onClipboardItem(handleClipboardItem);
    onClipboardDeleted(handleClipboardDeleted);
    onConnect(handleConnect);
    onDisconnect(handleDisconnect);
    pingIntervalRef.current = setInterval(() => { socketRef.current?.emit('ping'); }, 30000);
    return () => {
      offClipboardItem(handleClipboardItem);
      offClipboardDeleted(handleClipboardDeleted);
      offConnect(handleConnect);
      offDisconnect(handleDisconnect);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, []);

  const handleAddText = useCallback(async (text) => {
    if (!pin || !salt) return;
    try {
      const { ciphertext, iv } = await encryptText(pin, salt, text);
      await api.addClipboardItem({ type: 'text', ciphertext, iv });
      showToast('Text synced', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }, [pin, salt, showToast]);

  const handleAddImage = useCallback(async (file) => {
    if (!pin || !salt) return;
    if (file.size > 5242880) { showToast('Image too large (max 5MB)', 'error'); return; }
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) { showToast('Invalid image type', 'error'); return; }
    try {
      const { ciphertext, iv, mimeType } = await encryptImage(pin, salt, file);
      await api.addClipboardItem({ type: 'image', ciphertext, iv, mimeType });
      showToast('Image synced', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }, [pin, salt, showToast]);

  const handleCopyText = useCallback(async (item) => {
    if (!pin || !salt) return;
    try { const text = await decryptText(pin, salt, item.ciphertext, item.iv); await navigator.clipboard.writeText(text); showToast('Copied!', 'success'); }
    catch { showToast('Failed to copy', 'error'); }
  }, [pin, salt, showToast]);

  const handleCopyImage = useCallback(async (item) => {
    if (!pin || !salt) return;
    try { const buf = await decryptImage(pin, salt, item.ciphertext, item.iv); const blob = new Blob([buf], { type: item.mimeType || 'image/png' }); await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]); showToast('Image copied!', 'success'); }
    catch { showToast('Failed to copy', 'error'); }
  }, [pin, salt, showToast]);

  const handleDeleteItem = useCallback(async (id) => { await api.deleteClipboardItem(id); }, []);

  useEffect(() => { checkPinConfigured(); }, []);

  const handleVerifySubmit = async (e) => { e.preventDefault(); const fullPin = pinToVerify.join(''); if (fullPin.length !== 6) return; await verifyPinHandler(fullPin); };
  const handleSetupSubmit = async (e) => { e.preventDefault(); const fullPin = setupPin.join(''); const fullConfirm = setupConfirmPin.join(''); if (fullPin.length !== 6) { setVerifyError('PIN must be 6 digits'); return; } if (fullPin !== fullConfirm) { setVerifyError('PINs do not match'); return; } await setupPinHandler(fullPin); };

  const handlePinDigitChange = (index, value) => { const newPin = [...pinToVerify]; newPin[index] = value.replace(/\D/g, ''); setPinToVerify(newPin); };
  const handleSetupPinDigitChange = (index, value) => { const newPin = [...setupPin]; newPin[index] = value.replace(/\D/g, ''); setSetupPin(newPin); };
  const handleSetupConfirmPinDigitChange = (index, value) => { const newPin = [...setupConfirmPin]; newPin[index] = value.replace(/\D/g, ''); setSetupConfirmPin(newPin); };

  const pinInputProps = (digit, index, onChange) => ({
    type: 'text', maxLength: 1, value: digit, onChange: (e) => onChange(index, e.target.value),
    inputMode: 'numeric', autoFocus: index === 0
  });

  const renderPinInputs = (digits, onChange) => (
    <div className="pin-inputs">
      {digits.map((d, i) => (
        <input key={i} {...pinInputProps(d, i, onChange)} />
      ))}
    </div>
  );

  if (state === 'checking') return <div className="loading-screen"><div className="spinner" />Checking...</div>;

  if (state === 'setup') return (
    <div className="app"><div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card start-card">
        <h2>Set Your PIN</h2><p>Choose a 6-digit PIN</p>
        <form onSubmit={handleSetupSubmit}>
          {renderPinInputs(setupPin, handleSetupPinDigitChange)}
          <p className="setup-hint">Confirm your PIN:</p>
          {renderPinInputs(setupConfirmPin, handleSetupConfirmPinDigitChange)}
          {verifyError && <p className="error">{verifyError}</p>}
          <button type="submit" className="btn btn-primary" disabled={setupLoading}>{setupLoading ? 'Setting...' : 'Set PIN'}</button>
        </form>
      </div>
      {toast && <Toast {...toast} />}
    </div></div>
  );

  if (state === 'verify') return (
    <div className="app"><div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card start-card">
        <h2>Enter Your PIN</h2>
        <form onSubmit={handleVerifySubmit}>
          {renderPinInputs(pinToVerify, handlePinDigitChange)}
          {verifyError && <p className="error">{verifyError}</p>}
          <button type="submit" className="btn btn-primary" disabled={pinToVerify.join('').length !== 6 || verifyLoading}>{verifyLoading ? 'Verifying...' : 'Access'}</button>
          {pinConfigured && <p className="or-divider">or</p>}
          {pinConfigured && <button type="button" className="btn btn-secondary" onClick={() => setShowSetup(true)}>Set new PIN</button>}
        </form>
        {showSetup && (
          <form onSubmit={handleSetupSubmit} style={{ marginTop: '16px' }}>
            <h3>Set New PIN</h3>
            {renderPinInputs(setupPin, handleSetupPinDigitChange)}
            <p className="setup-hint">Confirm:</p>
            {renderPinInputs(setupConfirmPin, handleSetupConfirmPinDigitChange)}
            <button type="submit" className="btn btn-primary" disabled={setupLoading} style={{ marginTop: '8px' }}>{setupLoading ? 'Setting...' : 'Set PIN'}</button>
          </form>
        )}
      </div>
      {toast && <Toast {...toast} />}
    </div></div>
  );

  return (
    <div className="app">
      <SessionHeader connected={connected} onLogout={() => { disconnectSocket(); setState('verify'); setPin(null); setSalt(null); setItems([]); }} />
      <main className="main">
        <ClipboardFeed items={items} pin={pin} salt={salt} onCopyText={handleCopyText} onCopyImage={handleCopyImage} onAddText={handleAddText} onAddImage={handleAddImage} onDeleteItem={handleDeleteItem} />
      </main>
      {toast && <Toast {...toast} />}
    </div>
  );
}
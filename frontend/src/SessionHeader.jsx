import { useState } from 'react';
import PinDisplay from './PinDisplay';

export default function SessionHeader({ 
  sessionId, 
  pin, 
  connected, 
  reconnecting, 
  expiry, 
  isHost, 
  onEndSession, 
  onCopyPin 
}) {
  const [showPin, setShowPin] = useState(false);
  
  const formatTime = (ms) => {
    if (ms <= 0) return 'Expired';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };
  
  return (
    <header className="session-header">
      <div className="header-left">
        <h2>Session Active</h2>
        <span className={`connection-status ${connected ? 'connected' : 'disconnected'} ${reconnecting ? 'reconnecting' : ''}`}>
          {reconnecting ? 'Reconnecting...' : connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div className="header-center">
        {isHost && (
          <PinDisplay pin={pin} onCopy={onCopyPin} />
        )}
      </div>
      
      <div className="header-right">
        <div className="expiry-timer" style={{ color: expiry && expiry < 5 * 60 * 1000 ? 'var(--color-error)' : 'inherit' }}>
          ⏱ {expiry ? formatTime(expiry) : '—'}
        </div>
        {isHost && (
          <button className="btn btn-danger" onClick={onEndSession}>
            End Session
          </button>
        )}
      </div>
    </header>
  );
}
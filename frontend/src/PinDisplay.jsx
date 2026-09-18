import { useState, useRef, useEffect } from 'react';

export default function PinDisplay({ pin, onCopy }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);
  
  const handleCopy = () => {
    onCopy();
    setCopied(true);
  };
  
  return (
    <div className="pin-display">
      <div className="pin-digits" ref={inputRef}>
        {pin.split('').map((digit, i) => (
          <span key={i} className="pin-digit">{digit}</span>
        ))}
      </div>
      <button 
        className={`btn btn-secondary ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        aria-label={copied ? 'Copied!' : 'Copy PIN'}
      >
        {copied ? '✓ Copied' : 'Copy PIN'}
      </button>
      <p className="pin-hint">Share this PIN with another device to join</p>
    </div>
  );
}
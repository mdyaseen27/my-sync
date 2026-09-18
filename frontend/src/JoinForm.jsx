import { useState, useRef } from 'react';

export default function JoinForm({ sessionId, onJoin, loading, error }) {
  const [pin, setPin] = useState(Array(6).fill(''));
  const inputsRef = useRef(null);
  
  const handleChange = (e, index) => {
    const value = e.target.value.replace(/\D/g, '');
    if (!value) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (index < 5) inputsRef.current?.[index + 1]?.focus();
  };
  
  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      const newPin = [...pin];
      newPin[index] = '';
      setPin(newPin);
      inputsRef.current?.[index - 1]?.focus();
    }
  };
  
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setPin(pasted.split(''));
      inputsRef.current?.[5]?.focus();
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const fullPin = pin.join('');
    if (fullPin.length !== 6) return;
    await onJoin(sessionId, fullPin);
  };
  
  return (
    <form className="join-form" onSubmit={handleSubmit}>
      <h3>Join Session</h3>
      <div className="pin-inputs" ref={inputsRef}>
        {pin.map((digit, i) => (
          <input key={i} type="text" maxLength={1} value={digit} onChange={(e) => handleChange(e, i)} onKeyDown={(e) => handleKeyDown(e, i)} onPaste={handlePaste} autoComplete="off" inputMode="numeric" pattern="[0-9]*" aria-label={`PIN digit ${i + 1}`} />
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={pin.join('').length !== 6 || loading}>
        {loading ? 'Joining...' : 'Join'}
      </button>
    </form>
  );
}
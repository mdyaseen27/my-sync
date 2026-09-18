export default function Toast({ message, type = 'info' }) {
  return (
    <div className={`toast toast-${type}`} role="alert" aria-live="polite">
      <span className="toast-message">{message}</span>
    </div>
  );
}
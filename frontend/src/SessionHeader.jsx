export default function SessionHeader({ connected, disconnecting, onLogout }) {
  return (
    <header className="session-header">
      <div className="header-left">
        <h2>MY Sync</h2>
        <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div className="header-right">
        <button className="btn btn-danger" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}
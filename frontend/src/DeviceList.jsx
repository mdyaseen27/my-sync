export default function DeviceList({ devices, currentDeviceId, onKick, isHost }) {
  if (devices.length === 0) return null;
  
  return (
    <div className="device-list">
      <div className="device-list-header">
        <h3>{devices.length} device{devices.length !== 1 ? 's' : ''} connected</h3>
      </div>
      <ul className="devices">
        {devices.map(device => (
          <li key={device.id} className={`device ${device.id === currentDeviceId ? 'current' : ''}`}>
            <span className="device-indicator" />
            <span className="device-name">
              {device.id === currentDeviceId ? 'This device' : `Device ${device.id.slice(0, 8)}`}
            </span>
            {isHost && device.id !== currentDeviceId && (
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => onKick(device.id)}
                aria-label="Remove device"
              >
                Kick
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
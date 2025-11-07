import { useWallet } from '../context/WalletContext';

export function EventLog() {
  const { events, clearEvents } = useWallet();

  return (
    <section id="events-section">
      <h2>Event Log</h2>
      <div className="events-log">
        {events.length === 0 ? (
          <div className="no-events">No events yet...</div>
        ) : (
          events.map((event, index) => (
            <div key={index} className="event-item">
              <span className="event-time">{event.timestamp}</span>
              <span className="event-name">{event.name}</span>
              {event.data && (
                <span className="event-data">{JSON.stringify(event.data, null, 2)}</span>
              )}
            </div>
          ))
        )}
      </div>
      <button className="btn-secondary" onClick={clearEvents}>
        Clear Log
      </button>
    </section>
  );
}

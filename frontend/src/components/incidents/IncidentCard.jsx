import "./IncidentCard.css";

/**
 * Formats a timestamp to a short readable string.
 */
function formatTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function IncidentCard({ incident, isSelected, onClick }) {
  const isActive = ["detected", "acknowledged", "crew_assigned"].includes(
    incident.status
  );

  return (
    <div
      className={`incident-card ${isSelected ? "selected" : ""} ${isActive ? "critical" : ""}`}
      onClick={onClick}
    >
      <div className="incident-card-header">
        <div className="incident-card-id">
          {isActive && <span className="pulse-dot" />}
          Incident #{incident.id}
        </div>
        <div className="incident-card-time">
          {formatTime(incident.detectedAt)}
        </div>
      </div>

      <div className="incident-card-badges">
        <span className={`badge badge-${incident.status}`}>
          {incident.status.replace("_", " ")}
        </span>
        <span className={`badge badge-${incident.localizationType}`}>
          {incident.localizationType === "span"
            ? "Span Level"
            : incident.localizationType === "feeder"
              ? "Feeder Level"
              : "DT Level"}
        </span>
        <span className={`badge badge-${incident.confidence}`}>
          {incident.confidence}
        </span>
      </div>

      <div className="incident-card-location">
        {incident.localizationType === "span" ? (
          <>
            📍 {incident.faultSpanFrom} → {incident.faultSpanTo}
          </>
        ) : incident.localizationType === "feeder" ? (
          <>📍 Feeder {incident.feederId}</>
        ) : (
          <>📍 Transformer {incident.dtId}</>
        )}
        {incident.pincode && <> &middot; PIN {incident.pincode}</>}
      </div>

      <div className="incident-card-meta">
        <div className="incident-card-affected">
          🔌 {incident.affectedPoles} poles affected
        </div>
        <div className="incident-card-type">
          {incident.faultType} fault
        </div>
      </div>
    </div>
  );
}

export default IncidentCard;

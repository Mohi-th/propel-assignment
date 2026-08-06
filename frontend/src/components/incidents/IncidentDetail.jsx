import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  fetchIncidentById,
  updateStatus,
  clearError,
} from "../../redux/incidentSlice.js";
import { repairFault } from "../../redux/simulatorSlice.js";
import "./IncidentDetail.css";

/**
 * Shows when the user needs to know:
 * - Exactly where the fault is
 * - How confident we are
 * - What to do next (ticket actions)
 */
function IncidentDetail({ incidentId, onClose }) {
  const dispatch = useDispatch();
  const { selected, error } = useSelector((state) => state.incidents);

  useEffect(() => {
    if (incidentId) {
      dispatch(fetchIncidentById(incidentId));
    }
  }, [incidentId, dispatch]);

  // Also poll for updates to this specific incident
  useEffect(() => {
    if (!incidentId) return;
    const interval = setInterval(() => {
      dispatch(fetchIncidentById(incidentId));
    }, 5000);
    return () => clearInterval(interval);
  }, [incidentId, dispatch]);

  if (!selected) {
    return null;
  }

  const handleStatusUpdate = (newStatus) => {
    dispatch(clearError());
    dispatch(updateStatus({ id: selected.id, status: newStatus }));
  };

  const handleRepair = () => {
    dispatch(repairFault(selected.id));
  };

  // Which actions are available based on current status
  const nextActions = {
    detected: [{ label: "Acknowledge", status: "acknowledged", style: "btn" }],
    acknowledged: [
      { label: "Assign Crew", status: "crew_assigned", style: "btn-primary" },
    ],
    crew_assigned: [
      { label: "Mark Resolved", status: "resolved", style: "btn-success" },
    ],
    resolved: [],
    verified: [{ label: "Close Ticket", status: "closed", style: "btn" }],
    closed: [],
  };

  const actions = nextActions[selected.status] || [];

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="incident-detail animate-in">
      <div className="incident-detail-header">
        <div className="incident-detail-title">Incident #{selected.id}</div>
        <button className="incident-detail-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="incident-detail-body">
        <div className="detail-row">
          <span className="detail-label">Status</span>
          <span className={`badge badge-${selected.status}`}>
            {selected.status.replace("_", " ")}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Fault Type</span>
          <span className={`badge badge-${selected.faultType}`}>
            {selected.faultType}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Precision</span>
          <span className={`badge badge-${selected.localizationType}`}>
            {selected.localizationType === "span"
              ? "Span Level"
              : selected.localizationType === "feeder"
                ? "Feeder Level"
                : "DT Level"}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Location</span>
          <span className="detail-value">
            {selected.localizationType === "span"
              ? `${selected.faultSpanFrom} → ${selected.faultSpanTo}`
              : selected.localizationType === "feeder"
                ? `Feeder ${selected.feederId}`
                : `Transformer ${selected.dtId}`}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Coordinates</span>
          <span className="detail-value">
            {selected.lat?.toFixed(6)}, {selected.lon?.toFixed(6)}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">PIN Code</span>
          <span className="detail-value">
            {selected.pincode || "Unknown"}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Affected Poles</span>
          <span className="detail-value">{selected.affectedPoles}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Confidence</span>
          <span className={`badge badge-${selected.confidence}`}>
            {selected.confidence}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Detected</span>
          <span className="detail-value">
            {formatDate(selected.detectedAt)}
          </span>
        </div>

        {selected.acknowledgedAt && (
          <div className="detail-row">
            <span className="detail-label">Acknowledged</span>
            <span className="detail-value">
              {formatDate(selected.acknowledgedAt)}
            </span>
          </div>
        )}

        {selected.verifiedAt && (
          <div className="detail-row">
            <span className="detail-label">Verified</span>
            <span className="detail-value">
              {formatDate(selected.verifiedAt)}
            </span>
          </div>
        )}

        {selected.confidenceReason && (
          <div className="detail-reason">
            💡 {selected.confidenceReason}
          </div>
        )}

        {error && <div className="detail-error">⚠️ {error}</div>}

        <div className="detail-actions">
          {actions.map((action) => (
            <button
              key={action.status}
              className={`btn ${action.style}`}
              onClick={() => handleStatusUpdate(action.status)}
            >
              {action.label}
            </button>
          ))}

          {/* Simulator repair button — only for active incidents */}
          {["detected", "acknowledged", "crew_assigned"].includes(
            selected.status
          ) && (
            <button className="btn btn-success" onClick={handleRepair}>
              🔧 Simulate Repair
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default IncidentDetail;

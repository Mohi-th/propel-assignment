import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchIncidents } from "../../redux/incidentSlice.js";
import IncidentCard from "./IncidentCard.jsx";

function IncidentList({ onSelect, selectedId }) {
  const dispatch = useDispatch();
  const { list, loading, error } = useSelector((state) => state.incidents);

  // Fetch incidents on mount and poll every 5 seconds
  useEffect(() => {
    dispatch(fetchIncidents());

    const interval = setInterval(() => {
      dispatch(fetchIncidents());
    }, 5000);

    return () => clearInterval(interval);
  }, [dispatch]);

  // Separate active and resolved incidents
  const activeIncidents = list.filter((inc) =>
    ["detected", "acknowledged", "crew_assigned", "resolved"].includes(
      inc.status
    )
  );

  const closedIncidents = list.filter((inc) =>
    ["verified", "closed"].includes(inc.status)
  );

  if (loading && list.length === 0) {
    return (
      <div className="sidebar-empty">
        <div>Loading incidents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sidebar-empty">
        <div className="text-red">Error: {error}</div>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="sidebar-empty">
        <div className="sidebar-empty-icon">✅</div>
        <div>No incidents</div>
        <div className="text-muted" style={{ fontSize: "0.8rem" }}>
          All systems operational. Use the Simulator tab to inject a fault.
        </div>
      </div>
    );
  }

  return (
    <div>
      {activeIncidents.length > 0 && (
        <>
          <div className="sidebar-section-title">
            Active ({activeIncidents.length})
          </div>
          {activeIncidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              isSelected={selectedId === incident.id}
              onClick={() => onSelect(incident)}
            />
          ))}
        </>
      )}

      {closedIncidents.length > 0 && (
        <>
          <div
            className="sidebar-section-title"
            style={{ marginTop: "var(--space-md)" }}
          >
            Resolved ({closedIncidents.length})
          </div>
          {closedIncidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              isSelected={selectedId === incident.id}
              onClick={() => onSelect(incident)}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default IncidentList;

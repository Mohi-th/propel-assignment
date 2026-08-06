import { useState } from "react";
import Header from "../components/layout/Header.jsx";
import Sidebar from "../components/layout/Sidebar.jsx";
import NetworkMap from "../components/map/NetworkMap.jsx";
import IncidentDetail from "../components/incidents/IncidentDetail.jsx";
import "../styles/Dashboard.css";

/**
 * Dashboard page — the main operator console.
 *
 * Layout:
 *   - Header (top bar with logo, clock, status)
 *   - Sidebar (left: incident list / simulator tabs)
 *   - Map (center: Leaflet map with poles, transformers, incidents)
 *   - IncidentDetail (overlay on map when an incident is selected)
 */
function Dashboard() {
  const [selectedIncident, setSelectedIncident] = useState(null);

  const handleSelectIncident = (incident) => {
    setSelectedIncident(incident);
  };

  const handleCloseDetail = () => {
    setSelectedIncident(null);
  };

  return (
    <div className="dashboard">
      <Header />
      <div className="dashboard-body">
        <Sidebar
          onSelectIncident={handleSelectIncident}
          selectedIncidentId={selectedIncident?.id}
        />
        <div className="dashboard-main">
          <NetworkMap
            selectedIncident={selectedIncident}
          />
          {selectedIncident && (
            <IncidentDetail
              incidentId={selectedIncident.id}
              onClose={handleCloseDetail}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

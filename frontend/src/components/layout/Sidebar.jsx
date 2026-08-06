import { useState } from "react";
import IncidentList from "../incidents/IncidentList.jsx";
import SimulatorPanel from "../simulator/SimulatorPanel.jsx";
import "./Sidebar.css";

function Sidebar({ onSelectIncident, selectedIncidentId }) {
  const [activeTab, setActiveTab] = useState("incidents");

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === "incidents" ? "active" : ""}`}
          onClick={() => setActiveTab("incidents")}
        >
          🔴 Incidents
        </button>
        <button
          className={`sidebar-tab ${activeTab === "simulator" ? "active" : ""}`}
          onClick={() => setActiveTab("simulator")}
        >
          🧪 Simulator
        </button>
      </div>

      <div className="sidebar-content">
        {activeTab === "incidents" && (
          <IncidentList
            onSelect={onSelectIncident}
            selectedId={selectedIncidentId}
          />
        )}
        {activeTab === "simulator" && <SimulatorPanel />}
      </div>
    </aside>
  );
}

export default Sidebar;

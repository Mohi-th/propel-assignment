import { useEffect, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import { useSelector } from "react-redux";
import * as networkApi from "../../api/network.api.js";
import "leaflet/dist/leaflet.css";
import "./NetworkMap.css";

/**
 * Pole colors based on state.
 */
function getPoleColor(pole) {
  if (!pole.deviceId) return "#4b5563";
  if (!pole.isEnergized) return "#ef4444";
  return "#22c55e";
}

/**
 * Helper component that flies the map to a specific location.
 */
function FlyToLocation({ lat, lon, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (lat && lon) {
      map.flyTo([lat, lon], zoom || 16, { duration: 1 });
    }
  }, [lat, lon, zoom, map]);

  return null;
}

function NetworkMap({ selectedIncident }) {
  const [poles, setPoles] = useState([]);
  const [transformers, setTransformers] = useState([]);
  const [feedersList, setFeedersList] = useState([]);
  const incidents = useSelector((state) => state.incidents.list);

  // Load all data
  useEffect(() => {
    async function loadData() {
      try {
        const [polesRes, dtsRes, feedersRes] = await Promise.all([
          networkApi.getPoles(),
          networkApi.getTransformers(),
          networkApi.getFeeders(),
        ]);
        setPoles(polesRes.data);
        setTransformers(dtsRes.data);
        setFeedersList(feedersRes.data);
      } catch (err) {
        console.error("Failed to load map data:", err);
      }
    }
    loadData();
  }, []);

  // Reload poles every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await networkApi.getPoles();
        setPoles(res.data);
      } catch (err) {
        // silent fail
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Compute feeder positions from their DTs (centroid of DT positions)
  const feedersWithPositions = useMemo(() => {
    return feedersList.map((feeder) => {
      const feederDts = transformers.filter((dt) => dt.feederId === feeder.id);
      if (feederDts.length === 0) return null;

      const lat = feederDts.reduce((s, dt) => s + dt.lat, 0) / feederDts.length;
      const lon = feederDts.reduce((s, dt) => s + dt.lon, 0) / feederDts.length;

      // Count poles under this feeder
      const feederPoles = poles.filter((p) => p.feederId === feeder.id);
      const darkCount = feederPoles.filter(
        (p) => p.deviceId && !p.isEnergized
      ).length;

      return {
        ...feeder,
        lat,
        lon,
        dtCount: feederDts.length,
        poleCount: feederPoles.length,
        darkCount,
        dtPositions: feederDts.map((dt) => [dt.lat, dt.lon]),
      };
    }).filter(Boolean);
  }, [feedersList, transformers, poles]);

  // Stats
  const totalPoles = poles.length;
  const darkPoles = poles.filter((p) => p.deviceId && !p.isEnergized).length;
  const activeIncidents = incidents.filter((inc) =>
    ["detected", "acknowledged", "crew_assigned"].includes(inc.status)
  ).length;

  const center = [12.9716, 77.5946];
  const mapCenter = poles.length > 0 ? [poles[0].lat, poles[0].lon] : center;

  // Fly zoom depends on incident type
  const flyZoom = selectedIncident?.faultType === "feeder" ? 13 : 16;

  return (
    <div className="network-map">
      <MapContainer
        center={mapCenter}
        zoom={14}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {selectedIncident && (
          <FlyToLocation
            lat={selectedIncident.lat}
            lon={selectedIncident.lon}
            zoom={flyZoom}
          />
        )}

        {/* Feeder lines — connect each feeder centroid to its DTs */}
        {feedersWithPositions.map((feeder) =>
          feeder.dtPositions.map((dtPos, i) => (
            <Polyline
              key={`fl-${feeder.id}-${i}`}
              positions={[[feeder.lat, feeder.lon], dtPos]}
              pathOptions={{
                color: feeder.darkCount > 0 ? "#f59e0b" : "#6366f1",
                weight: 1.5,
                opacity: 0.4,
                dashArray: "6",
              }}
            />
          ))
        )}

        {/* Feeder markers (largest, purple/indigo) */}
        {feedersWithPositions.map((feeder) => (
          <CircleMarker
            key={feeder.id}
            center={[feeder.lat, feeder.lon]}
            radius={12}
            pathOptions={{
              color: feeder.darkCount > 0 ? "#f59e0b" : "#6366f1",
              fillColor: feeder.darkCount > 0 ? "#f59e0b" : "#6366f1",
              fillOpacity: 0.5,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ fontSize: "0.85rem" }}>
                <strong>{feeder.id}</strong>
                <br />
                {feeder.name || "Feeder"}
                <br />
                Substation: {feeder.substationId}
                <br />
                DTs: {feeder.dtCount}
                <br />
                Poles: {feeder.poleCount}
                {feeder.darkCount > 0 && (
                  <>
                    <br />
                    <span style={{ color: "#ef4444" }}>
                      🔴 {feeder.darkCount} dark poles
                    </span>
                  </>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Transformer markers (medium, blue) */}
        {transformers.map((dt) => (
          <CircleMarker
            key={dt.id}
            center={[dt.lat, dt.lon]}
            radius={8}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.6,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ fontSize: "0.85rem" }}>
                <strong>{dt.id}</strong>
                <br />
                Feeder: {dt.feederId}
                <br />
                Capacity: {dt.capacityKva} kVA
                <br />
                Households: {dt.householdsServed}
                <br />
                Topology: {dt.hasTopology ? "✅ Known" : "❌ Unknown"}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Pole markers (small) */}
        {poles.map((pole) => (
          <CircleMarker
            key={pole.id}
            center={[pole.lat, pole.lon]}
            radius={4}
            pathOptions={{
              color: getPoleColor(pole),
              fillColor: getPoleColor(pole),
              fillOpacity: 0.8,
              weight: 1,
            }}
          >
            <Popup>
              <div style={{ fontSize: "0.85rem" }}>
                <strong>{pole.id}</strong>
                <br />
                DT: {pole.dtId}
                <br />
                Status: {pole.isEnergized ? "🟢 Live" : "🔴 Dark"}
                <br />
                Device: {pole.deviceId || "None"}
                <br />
                PIN: {pole.pincode || "Unknown"}
                {pole.fwVersion && (
                  <>
                    <br />
                    FW: {pole.fwVersion}
                  </>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Active incident markers */}
        {incidents
          .filter((inc) =>
            ["detected", "acknowledged", "crew_assigned"].includes(inc.status)
          )
          .map((inc) => (
            <CircleMarker
              key={`inc-${inc.id}`}
              center={[inc.lat, inc.lon]}
              radius={inc.faultType === "feeder" ? 20 : 14}
              pathOptions={{
                color: "#ef4444",
                fillColor: "#ef4444",
                fillOpacity: 0.3,
                weight: 2,
                dashArray: "4",
              }}
            >
              <Popup>
                <div style={{ fontSize: "0.85rem" }}>
                  <strong>Incident #{inc.id}</strong>
                  <br />
                  {inc.faultType} fault
                  <br />
                  {inc.affectedPoles} poles affected
                  <br />
                  Confidence: {inc.confidence}
                </div>
              </Popup>
            </CircleMarker>
          ))}
      </MapContainer>

      {/* Stats */}
      <div className="map-stats">
        <div className="map-stat-card">
          <div className="map-stat-value">{totalPoles}</div>
          <div className="map-stat-label">Poles</div>
        </div>
        <div className="map-stat-card">
          <div className="map-stat-value text-red">{darkPoles}</div>
          <div className="map-stat-label">Dark</div>
        </div>
        <div className="map-stat-card">
          <div className="map-stat-value text-amber">{activeIncidents}</div>
          <div className="map-stat-label">Active</div>
        </div>
        <div className="map-stat-card">
          <div className="map-stat-value text-blue">
            {feedersWithPositions.length}
          </div>
          <div className="map-stat-label">Feeders</div>
        </div>
      </div>

      {/* Legend */}
      <div className="map-legend">
        <div className="map-legend-title">Legend</div>
        <div className="map-legend-item">
          <div className="map-legend-dot" style={{ background: "#22c55e" }} />
          Pole — Live
        </div>
        <div className="map-legend-item">
          <div className="map-legend-dot" style={{ background: "#ef4444" }} />
          Pole — Dark
        </div>
        <div className="map-legend-item">
          <div className="map-legend-dot" style={{ background: "#4b5563" }} />
          No Device
        </div>
        <div className="map-legend-item">
          <div className="map-legend-dot" style={{ background: "#3b82f6" }} />
          Transformer
        </div>
        <div className="map-legend-item">
          <div className="map-legend-dot" style={{ background: "#6366f1" }} />
          Feeder
        </div>
        <div className="map-legend-item">
          <div
            className="map-legend-dot"
            style={{
              background: "transparent",
              border: "2px dashed #ef4444",
            }}
          />
          Active Fault
        </div>
      </div>
    </div>
  );
}

export default NetworkMap;

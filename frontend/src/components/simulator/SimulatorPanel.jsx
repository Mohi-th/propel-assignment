import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  fetchNetwork,
  injectFault,
  killDevice,
  clearResult,
  clearError,
} from "../../redux/simulatorSlice.js";
import "./SimulatorPanel.css";

/**
 * Simulator panel — lets the evaluator inject faults, kill devices,
 * and watch the system respond. This is the primary evaluation tool.
 */
function SimulatorPanel() {
  const dispatch = useDispatch();
  const { network, lastResult, loading, error } = useSelector(
    (state) => state.simulator
  );

  const [faultType, setFaultType] = useState("span");
  const [targetId, setTargetId] = useState("");
  const [killPoleId, setKillPoleId] = useState("");

  useEffect(() => {
    dispatch(fetchNetwork());
  }, [dispatch]);

  const handleInjectFault = () => {
    dispatch(clearResult());
    dispatch(clearError());
    dispatch(injectFault({ type: faultType, targetId: targetId || undefined }));
  };

  const handleKillDevice = () => {
    if (!killPoleId) return;
    dispatch(clearResult());
    dispatch(clearError());
    dispatch(killDevice(killPoleId));
  };

  // Build target options based on fault type
  const getTargetOptions = () => {
    if (!network) return [];

    if (faultType === "feeder") {
      return network.feeders.map((f) => ({
        value: f.id,
        label: `${f.id} (${f.name || "Feeder"})`,
      }));
    }

    return network.transformers.map((dt) => ({
      value: dt.id,
      label: `${dt.id} (${dt.poleCount} poles${dt.hasTopology ? ", topology ✓" : ", no topology"})`,
    }));
  };

  const targetOptions = getTargetOptions();

  return (
    <div className="simulator-panel">
      {/* Inject Fault */}
      <div className="simulator-section">
        <div className="simulator-section-title">⚡ Inject Fault</div>
        <div className="simulator-form">
          <div className="simulator-form-row">
            <select
              className="select"
              value={faultType}
              onChange={(e) => {
                setFaultType(e.target.value);
                setTargetId("");
              }}
            >
              <option value="span">Span Fault</option>
              <option value="dt">DT Fault</option>
              <option value="feeder">Feeder Fault</option>
            </select>
          </div>

          <div className="simulator-form-row">
            <select
              className="select"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Random target</option>
              {targetOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-danger"
            onClick={handleInjectFault}
            disabled={loading}
          >
            {loading ? "Injecting..." : "🔥 Inject Fault"}
          </button>
        </div>
      </div>

      {/* Kill Device (Noise Test) */}
      <div className="simulator-section">
        <div className="simulator-section-title">📡 Kill Device (Noise Test)</div>
        <div className="simulator-form">
          <div className="simulator-form-row">
            <input
              className="input"
              type="text"
              placeholder="Pole ID (e.g. P-000042)"
              value={killPoleId}
              onChange={(e) => setKillPoleId(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
          <button className="btn" onClick={handleKillDevice} disabled={loading}>
            💀 Kill Device
          </button>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            This should NOT create an incident. The device stops reporting
            but power is still on.
          </div>
        </div>
      </div>

      {/* Result */}
      {lastResult && (
        <div className="simulator-result success">
          ✅ {lastResult.message}
        </div>
      )}

      {error && (
        <div className="simulator-result error">
          ❌ {error}
        </div>
      )}
    </div>
  );
}

export default SimulatorPanel;

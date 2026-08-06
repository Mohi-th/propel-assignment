import api from "./axios.js";

export const injectFault = (type, targetId) =>
  api.post("/simulator/fault", { type, targetId });

export const repairFault = (incidentId) =>
  api.post("/simulator/repair", { incidentId });

export const killDevice = (poleId) =>
  api.post("/simulator/kill-device", { poleId });

export const getNetwork = () => api.get("/simulator/network");

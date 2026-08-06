import api from "./axios.js";

export const getIncidents = () => api.get("/incidents");

export const getIncidentById = (id) => api.get(`/incidents/${id}`);

export const updateIncidentStatus = (id, status) =>
  api.patch(`/incidents/${id}`, { status });

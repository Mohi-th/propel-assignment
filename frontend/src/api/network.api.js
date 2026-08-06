import api from "./axios.js";

export const getPoles = (params) => api.get("/poles", { params });

export const getPoleById = (id) => api.get(`/poles/${id}`);

export const getTransformers = () => api.get("/transformers");

export const getFeeders = () => api.get("/feeders");

export const getScheduledOutages = (from, to) =>
  api.get("/scheduled-outages", { params: { from, to } });

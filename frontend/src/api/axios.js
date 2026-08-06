import axios from "axios";

/**
 * Axios instance with base URL.
 * In Docker, the nginx proxy handles /api/ → backend.
 * In development, Vite proxy handles it (configured in vite.config.js).
 */
const api = axios.create({
  baseURL:import.meta.env.VITE_API_URL|| "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;

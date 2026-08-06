import { configureStore } from "@reduxjs/toolkit";
import incidentReducer from "./incidentSlice.js";
import simulatorReducer from "./simulatorSlice.js";

const store = configureStore({
  reducer: {
    incidents: incidentReducer,
    simulator: simulatorReducer,
  },
});

export default store;

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as simulatorApi from "../api/simulator.api.js";

export const fetchNetwork = createAsyncThunk(
  "simulator/fetchNetwork",
  async () => {
    const response = await simulatorApi.getNetwork();
    return response.data;
  }
);

export const injectFault = createAsyncThunk(
  "simulator/injectFault",
  async ({ type, targetId }, { rejectWithValue }) => {
    try {
      const response = await simulatorApi.injectFault(type, targetId);
      return response.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to inject fault"
      );
    }
  }
);

export const repairFault = createAsyncThunk(
  "simulator/repairFault",
  async (incidentId, { rejectWithValue }) => {
    try {
      const response = await simulatorApi.repairFault(incidentId);
      return response.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to repair fault"
      );
    }
  }
);

export const killDevice = createAsyncThunk(
  "simulator/killDevice",
  async (poleId, { rejectWithValue }) => {
    try {
      const response = await simulatorApi.killDevice(poleId);
      return response.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to kill device"
      );
    }
  }
);

const simulatorSlice = createSlice({
  name: "simulator",
  initialState: {
    network: null,
    lastResult: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearResult: (state) => {
      state.lastResult = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch network
      .addCase(fetchNetwork.fulfilled, (state, action) => {
        state.network = action.payload;
      })
      // Inject fault
      .addCase(injectFault.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(injectFault.fulfilled, (state, action) => {
        state.loading = false;
        state.lastResult = action.payload;
      })
      .addCase(injectFault.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Repair fault
      .addCase(repairFault.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(repairFault.fulfilled, (state, action) => {
        state.loading = false;
        state.lastResult = action.payload;
      })
      .addCase(repairFault.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Kill device
      .addCase(killDevice.fulfilled, (state, action) => {
        state.lastResult = action.payload;
      })
      .addCase(killDevice.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearResult, clearError } = simulatorSlice.actions;
export default simulatorSlice.reducer;

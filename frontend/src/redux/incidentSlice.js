import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as incidentApi from "../api/incident.api.js";

export const fetchIncidents = createAsyncThunk(
  "incidents/fetchAll",
  async () => {
    const response = await incidentApi.getIncidents();
    return response.data;
  }
);

export const fetchIncidentById = createAsyncThunk(
  "incidents/fetchById",
  async (id) => {
    const response = await incidentApi.getIncidentById(id);
    return response.data;
  }
);

export const updateStatus = createAsyncThunk(
  "incidents/updateStatus",
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const response = await incidentApi.updateIncidentStatus(id, status);
      return response.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to update status"
      );
    }
  }
);

const incidentSlice = createSlice({
  name: "incidents",
  initialState: {
    list: [],
    selected: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearSelected: (state) => {
      state.selected = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchIncidents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchIncidents.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchIncidents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch by ID
      .addCase(fetchIncidentById.fulfilled, (state, action) => {
        state.selected = action.payload;
      })
      // Update status
      .addCase(updateStatus.fulfilled, (state, action) => {
        // Update in the list
        const index = state.list.findIndex(
          (inc) => inc.id === action.payload.id
        );
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        // Update selected if it's the same
        if (state.selected && state.selected.id === action.payload.id) {
          state.selected = { ...state.selected, ...action.payload };
        }
        state.error = null;
      })
      .addCase(updateStatus.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearSelected, clearError } = incidentSlice.actions;
export default incidentSlice.reducer;

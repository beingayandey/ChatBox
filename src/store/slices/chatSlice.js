import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchChats } from "../../firebase";

// Thunk to fetch chats
export const fetchUserChats = createAsyncThunk(
  "chat/fetchUserChats",
  async (userId, { rejectWithValue }) => {
    try {
      return new Promise((resolve) => {
        const unsubscribe = fetchChats(userId, (chats) => {
          const serializedChats = chats.map((chat) => ({
            ...chat,
            lastUpdated:
              chat.lastUpdated && typeof chat.lastUpdated.toDate === "function"
                ? chat.lastUpdated.toDate().toISOString()
                : null,
          }));
          resolve({ chats: serializedChats, unsubscribe });
        });
      });
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    chats: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearChats: (state) => {
      state.chats = [];
    },
    setChats: (state, action) => {
      state.chats = action.payload;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserChats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserChats.fulfilled, (state, action) => {
        state.loading = false;
        state.chats = action.payload.chats;
      })
      .addCase(fetchUserChats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearChats, setChats } = chatSlice.actions;
export default chatSlice.reducer;

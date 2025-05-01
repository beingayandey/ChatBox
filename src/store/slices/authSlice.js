import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  provider: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      console.log("[authSlice] loginSuccess action received:", action.payload);
      state.user = action.payload.user;
      state.token = action.payload.token || null;
      state.isAuthenticated = true;
      state.provider = action.payload.provider;
      console.log("[authSlice] New state after loginSuccess:", state);
    },
    logout: (state) => {
      console.log("[authSlice] logout action received");
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.provider = null;
      console.log("[authSlice] New state after logout:", state);
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;

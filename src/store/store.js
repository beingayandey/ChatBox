import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import chatReducer from "./slices/chatSlice";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";

// Configuration for persisting the auth slice
// This tells Redux Persist how to save and load the auth state
const authPersistConfig = {
  key: "auth", // Unique key for the auth slice in storage
  storage, // Storage engine (localStorage for browsers)
};

// Configuration for persisting the chat slice
// This tells Redux Persist how to save and load the chat state
const chatPersistConfig = {
  key: "chat", // Unique key for the chat slice in storage
  storage, // Same storage engine (localStorage)
};

// Combine reducers to create a single root reducer
// This merges the auth and chat slices into one state tree
const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer), // Persisted auth reducer
  chat: persistReducer(chatPersistConfig, chatReducer), // Persisted chat reducer
});

// Configure the Redux store
// This sets up the store with the combined reducer and middleware
export const store = configureStore({
  reducer: rootReducer, // The combined reducer for the entire app
  middleware: (getDefaultMiddleware) =>
    // Customize the default middleware
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore specific Redux Persist actions for serializability checks
        // These actions may include non-serializable data (e.g., timestamps)
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

// Create a persistor object to manage persisted state
// This handles saving and loading the state from storage
export const persistor = persistStore(store);

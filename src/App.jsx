import React from "react";
import MainLayouts from "./layouts/MainLayouts"; // Component defining the app's routing and layout
import { Provider } from "react-redux"; // Redux provider to make store available to components
import { store, persistor } from "./store/store"; // Redux store and persistor for state persistence
import AuthListener from "./components/AuthListener"; // Component to sync Firebase auth with Redux
import { PersistGate } from "redux-persist/integration/react"; // Component to handle Redux persistence
import { BrowserRouter } from "react-router-dom"; // Router for client-side navigation

// App component: The root of the application
const App = () => {
  return (
    // Wrap the app in Redux Provider to provide the store to all components
    <Provider store={store}>
      {/* // Wrap the app in PersistGate to handle Redux state persistence // Delays
      rendering until persisted state is loaded */}
      <PersistGate loading={null} persistor={persistor}>
        {/* // Wrap the app in BrowserRouter for client-side routing */}
        <BrowserRouter>
          {/* // AuthListener syncs Firebase auth state with Redux */}
          <AuthListener />
          {/* // Main content wrapper */}
          <div className="main-body">
            {/* // MainLayouts defines the routing and layout (Header, Routes, etc.) */}
            <MainLayouts />
          </div>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  );
};

// Export the component
export default App;

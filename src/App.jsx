import React from "react";
import MainLayouts from "./layouts/MainLayouts";
import { Provider } from "react-redux";
import { store, persistor } from "./store/store";
import AuthListener from "./components/AuthListener";
import { PersistGate } from "redux-persist/integration/react";
import { BrowserRouter } from "react-router-dom"; // ✅ import BrowserRouter

const App = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <AuthListener />
          <div className="main-body">
            <MainLayouts />
          </div>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  );
};

export default App;

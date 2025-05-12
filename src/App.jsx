import React from "react";
import MainLayouts from "./layouts/MainLayouts";
import { Provider } from "react-redux";
import { store, persistor } from "./store/store"; // <-- updated
import AuthListener from "./components/AuthListener";
import { PersistGate } from "redux-persist/integration/react"; // <-- added

const App = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthListener />
        <div className="main-body">
          <MainLayouts />
        </div>
      </PersistGate>
    </Provider>
  );
};

export default App;

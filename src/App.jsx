import React from "react";
import MainLayouts from "./layouts/MainLayouts";
import { Provider } from "react-redux";
import { store } from "./store/store";
import AuthListener from "./components/AuthListener";

const App = () => {
  return (
    <>
      <Provider store={store}>
        <AuthListener />
        <div className="main-body">
          <MainLayouts />
        </div>
      </Provider>
    </>
  );
};

export default App;

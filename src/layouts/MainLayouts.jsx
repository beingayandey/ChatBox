import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Login from "../pages/Login";
import { ToastProvider } from "../components/contexts/ToastNotification";
import WelcomeHome from "../pages/WelcomeHome";

const MainLayouts = () => {
  return (
    <>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/welcome" element={<WelcomeHome />} />
            <Route path="/" element={<Login />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </>
  );
};

export default MainLayouts;

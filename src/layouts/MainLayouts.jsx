import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Login from "../pages/Login";
import { ToastProvider } from "../components/contexts/ToastNotification";
import WelcomeHome from "../pages/WelcomeHome";
import UsersPage from "../pages/UsersPage";
import Header from "../components/Header";

const MainLayouts = () => {
  return (
    <>
      <ToastProvider>
        <BrowserRouter>
          <Header />
          <div className="main-body-outer">
            <Routes>
              <Route path="/welcome" element={<WelcomeHome />} />
              <Route path="/dashboard" element={<UsersPage />} />
              <Route path="/" element={<Login />} />
            </Routes>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </>
  );
};

export default MainLayouts;

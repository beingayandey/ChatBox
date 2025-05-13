import { Route, Routes, useLocation } from "react-router-dom";

import Login from "../pages/Login";

import ChatPage from "../pages/ChatPage";
import Header from "../components/Header";
import { ToastProvider } from "../components/contexts/ToastNotification";
import Dashboard from "../pages/Dashboard";

const MainLayouts = () => {
  const location = useLocation();
  const isLoginPage =
    location.pathname === "/login" || location.pathname === "/";

  return (
    <ToastProvider>
      {!isLoginPage && <Header />}
      <div className="main-body-outer">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/chat/:userId"
            element={
              <div className="app-layout">
                <div className="main-content">
                  <ChatPage />
                </div>
              </div>
            }
          />
        </Routes>
      </div>
    </ToastProvider>
  );
};

export default MainLayouts;

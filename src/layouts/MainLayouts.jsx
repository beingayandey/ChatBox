import { Route, Routes, useLocation } from "react-router-dom";
import Login from "../pages/Login";
import ChatPage from "../pages/ChatPage";
import Header from "../components/Header";
import { ToastProvider } from "../components/contexts/ToastNotification";
import Dashboard from "../pages/Dashboard";
import ProtectedRoute from "../components/ProtectedRoute"; // Import the new component

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
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:userId"
            element={
              <ProtectedRoute>
                <div className="app-layout">
                  <div className="main-content">
                    <ChatPage />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </ToastProvider>
  );
};

export default MainLayouts;

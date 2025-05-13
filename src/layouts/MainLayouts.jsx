import { Route, Routes, useLocation } from "react-router-dom";

import Login from "../pages/Login";
import UsersPage from "../pages/UsersPage";
import ChatPage from "../pages/ChatPage";
import Header from "../components/Header";
import { ToastProvider } from "../components/contexts/ToastNotification";

const MainLayouts = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <ToastProvider>
      {!isLoginPage && <Header />}
      <div className="main-body-outer">
        <Routes>
          <Route path="/" element={<UsersPage />} />
          <Route path="/dashboard" element={<UsersPage />} />

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

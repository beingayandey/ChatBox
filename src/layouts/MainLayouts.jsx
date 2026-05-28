import { Route, Routes, useLocation } from "react-router-dom";
import Login from "../pages/Login"; // Login page component
import ChatPage from "../pages/ChatPage"; // Chat page component for individual chats
import Header from "../components/Header"; // Header component for navigation
import { ToastProvider } from "../components/contexts/ToastNotification"; // Context provider for toast notifications
import Dashboard from "../pages/Dashboard"; // Dashboard page component (likely includes RecentChats)
import ProtectedRoute from "../components/ProtectedRoute"; // Component to protect routes requiring authentication
import { CallProvider } from "../components/contexts/CallContext";
import { AvatarViewProvider } from "../components/contexts/AvatarViewContext";

// MainLayouts component to define the application's routing and layout
const MainLayouts = () => {
  // Hook to access the current location (URL path)
  const location = useLocation();

  // Determine if the current page is the login page or a chat room
  const isLoginPage =
    location.pathname === "/login" || location.pathname === "/";
  const isChatPage = location.pathname.startsWith("/chat/");

  return (
    // Wrap the app in ToastProvider to enable toast notifications
    // This context allows any component to display notifications
    <ToastProvider>
      <CallProvider>
        <AvatarViewProvider>
          {/* Conditionally render the Header if not on the login page or chat page */}
          {!isLoginPage && !isChatPage && <Header />}

          {/* Main content wrapper */}
          <div className="main-body-outer">
            {/* Define application routes */}
            <Routes>
              {/* Route for the root path (redirects to Login) */}
              <Route path="/" element={<Login />} />

              {/* Route for the login page */}
              <Route path="/login" element={<Login />} />

              {/* Route for the dashboard, protected by authentication */}
              <Route
                path="/dashboard"
                element={
                  // ProtectedRoute ensures only authenticated users can access
                  <ProtectedRoute>
                    <Dashboard /> {/* Likely includes RecentChats or similar */}
                  </ProtectedRoute>
                }
              />

              {/* Route for individual chat pages, protected by authentication */}
              <Route
                path="/chat/:userId"
                element={
                  // ProtectedRoute ensures only authenticated users can access
                  <ProtectedRoute>
                    {/* Layout wrapper for the chat page */}
                    <div className="app-layout">
                      <div className="main-content">
                        <ChatPage /> {/* Renders the chat interface */}
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </AvatarViewProvider>
      </CallProvider>
    </ToastProvider>
  );
};

// Export the component
export default MainLayouts;

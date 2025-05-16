import { Navigate } from "react-router-dom"; // Component for programmatic navigation
import { useSelector } from "react-redux"; // Hook to access Redux state

// ProtectedRoute component to guard routes requiring authentication
const ProtectedRoute = ({ children }) => {
  // Select isAuthenticated from Redux store (from authSlice)
  // Indicates whether the user is logged in
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  // If not authenticated, redirect to the login page
  if (!isAuthenticated) {
    // Navigate component redirects to /login, replacing the current history entry
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the child components (e.g., Dashboard, ChatPage)
  return children;
};

// Export the component
export default ProtectedRoute;

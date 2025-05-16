import React, { useEffect } from "react";
import logo from "../assets/images/logo.svg"; // Logo image for the ChatBox app
import { useToast } from "../components/contexts/ToastNotification"; // Hook to access toast notification context
import GoogleLoginButton from "../components/GoogleLoginButton"; // Component for Google Sign-In
import { useNavigate } from "react-router-dom"; // Hook for programmatic navigation
import { useSelector } from "react-redux"; // Hook to access Redux state

// Login component for user authentication
const Login = () => {
  // Access toast notification functions from ToastProvider context
  const { showInfo } = useToast();

  // Hook for navigating to other routes
  const navigate = useNavigate();

  // Select isAuthenticated from Redux store (from authSlice)
  // Indicates whether the user is logged in
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  // Effect to redirect authenticated users to the dashboard
  useEffect(() => {
    // If the user is authenticated, redirect to /dashboard
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true }); // Replace history entry
    }
  }, [isAuthenticated, navigate]); // Re-run when isAuthenticated or navigate changes

  // Render the login page
  return (
    <div className="total-login">
      <div className="total-login-inner">
        {/* Logo section */}
        <div className="logo">
          <img src={logo} alt="ChatBox Logo" /> {/* App logo */}
        </div>

        {/* Welcome heading */}
        <div className="log-in-heading">
          <h1>Welcome to ChatBox</h1>
        </div>

        {/* Email/Password login buttons (placeholders) */}
        <div className="login-buttons">
          {/* Log In button (not implemented) */}
          <button
            className="login-btn"
            onClick={() => {
              showInfo("Email/Password login coming soon"); // Show placeholder message
            }}
          >
            Log In
          </button>
          {/* Sign Up button (disabled placeholder) */}
          <button className="signup-btn disabled">Sign Up</button>
        </div>

        {/* Divider for alternative sign-in methods */}
        <p className="another-signup">Continue With Accounts</p>

        {/* Social login buttons */}
        <div className="signup-buttons">
          {/* Google Sign-In button */}
          <GoogleLoginButton /> {/* Handles Google authentication */}
          {/* Facebook button (not implemented) */}
          <button
            className="facebook-btn"
            onClick={() => showInfo("Facebook login coming soon")} // Show placeholder message
          >
            Facebook
          </button>
        </div>
      </div>
    </div>
  );
};

// Export the component
export default Login;

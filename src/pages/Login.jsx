import React, { useEffect } from "react";
import logo from "../assets/images/logo.svg";
import { useToast } from "../components/contexts/ToastNotification";
import GoogleLoginButton from "../components/GoogleLoginButton";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const Login = () => {
  const { showInfo } = useToast();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="total-login">
      <div className="total-login-inner">
        <div className="logo">
          <img src={logo} alt="ChatBox Logo" />
        </div>

        <div className="log-in-heading">
          <h1>Welcome to ChatBox</h1>
        </div>

        <div className="login-buttons">
          <button
            className="login-btn"
            onClick={() => {
              showInfo("Email/Password login coming soon");
            }}
          >
            Log In
          </button>
          <button className="signup-btn disabled">Sign Up</button>
        </div>

        <p className="another-signup">Continue With Accounts</p>

        <div className="signup-buttons">
          <GoogleLoginButton />
          <button
            className="facebook-btn"
            onClick={() => showInfo("Facebook login coming soon")}
          >
            Facebook
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;

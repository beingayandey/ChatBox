import React, { useState } from "react";
import logo from "../assets/images/logo.svg";
import { useToast } from "../components/contexts/ToastNotification";
import Loader from "../components/ButtonLoader";
import GoogleLoginButton from "../components/GoogleLoginButton";

const Login = () => {
  const { showSuccess, showError, showInfo } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  };

  return (
    <>
      <div className="total-login">
        <div className="total-login-inner">
          <div className="notice"></div>
          <div className="logo">
            <img src={logo} alt="" />
          </div>
          <div className="log-in-heading ">
            <h1> Welcome to ChatBox</h1>
          </div>
          <div className="login-buttons">
            <button
              className="login-btn "
              onClick={() => {
                handleClick();
                showInfo("Coming Soon");
              }}
            >
              {isLoading ? <Loader size="md" /> : <>Log In</>}
            </button>
            <button className="signup-btn disabled">Sign Up</button>
          </div>
          <p className="another-signup">Continue With Accounts</p>
          <div className="signup-buttons">
            <GoogleLoginButton />
            <button
              className="facebook-btn "
              onClick={() => showSuccess("Login success")}
            >
              Facebook
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;

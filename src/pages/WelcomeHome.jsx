import React from "react";
import logo from "../assets/images/logo.svg";

const WelcomeHome = () => {
  return (
    <>
      <div className="welcome-outer">
        <div className="logo">
          <img src={logo} alt="logo" />
        </div>
        <div className="welcome-cont text-center">
          <h1> Welcome to ChatBox</h1>
          <p>
            Start chatting with Chat Box now. You can chat with new people and
            do anything.
          </p>
          <button className="welcome-btn">Get Started</button>
        </div>
      </div>
    </>
  );
};

export default WelcomeHome;

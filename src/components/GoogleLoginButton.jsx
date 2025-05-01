import React, { useState } from "react";
import { useToast } from "./contexts/ToastNotification";
import Loader from "./ButtonLoader";
import { auth, provider } from "../firebase";
import { signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../store/slices/authSlice";

const GoogleLoginButton = ({ redirectTo = "/dashboard" }) => {
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch(); // Add this line to define dispatch

  const handleGoogleSignIn = async () => {
    console.log("[GoogleLoginButton] Initiating Google Sign-In");
    setIsLoading(true);
    try {
      console.log("[GoogleLoginButton] Calling signInWithPopup");
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("[GoogleLoginButton] Sign-In successful, user:", {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
      });

      const token = await user.getIdToken();
      console.log("[GoogleLoginButton] Firebase ID Token received:", token);

      console.log("[GoogleLoginButton] Dispatching loginSuccess action");
      dispatch(
        loginSuccess({
          user: {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
          },
          token,
          provider: "google",
        })
      );

      console.log("[GoogleLoginButton] Showing success toast");
      showSuccess(`Welcome, ${user.displayName}!`);

      console.log("[GoogleLoginButton] Navigating to:", redirectTo);
      navigate(redirectTo);
    } catch (error) {
      console.error("[GoogleLoginButton] Google Sign-In Error:", {
        message: error.message,
        code: error.code,
      });
      showError(`Google Sign-In Error: ${error.message}`);
    } finally {
      console.log(
        "[GoogleLoginButton] Sign-In process complete, setting isLoading to false"
      );
      setIsLoading(false);
    }
  };

  return (
    <button
      className="google-btn"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
    >
      {isLoading ? <Loader size="md" /> : "Google"}
    </button>
  );
};

export default GoogleLoginButton;

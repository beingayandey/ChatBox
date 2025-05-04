import React, { useState } from "react";
import { useToast } from "./contexts/ToastNotification";
import Loader from "./ButtonLoader";
import { auth, db, provider } from "../firebase";
import { signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../store/slices/authSlice";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const GoogleLoginButton = ({ redirectTo = "/dashboard" }) => {
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleGoogleSignIn = async () => {
    console.log("Starting Google Sign-In...");
    setIsLoading(true);
    try {
      console.log("Connecting to Google...");
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log(`Signed in! User: ${user.displayName}, Email: ${user.email}`);

      // Save user info to Firestore
      console.log("Saving user info to database...");
      await setDoc(doc(db, "users", user.uid), {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
      });

      console.log("Getting user token...");
      const token = await user.getIdToken();
      console.log("Token received!");

      console.log("Updating app with user info...");
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

      console.log(`Showing welcome message for ${user.displayName}`);
      showSuccess(`Welcome, ${user.displayName}!`);

      console.log(`Redirecting to ${redirectTo}...`);
      navigate(redirectTo);
    } catch (error) {
      console.log(`Error during Sign-In: ${error.message}`);
      showError(`Google Sign-In Error: ${error.message}`);
    } finally {
      console.log("Sign-In process finished.");
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

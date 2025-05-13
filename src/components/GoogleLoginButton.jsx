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
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Save user info to Firestore

      await setDoc(doc(db, "users", user.uid), {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
      });

      const token = await user.getIdToken();

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

      showSuccess(`Welcome, ${user.displayName}!`);

      navigate(redirectTo);
    } catch (error) {
      showError(`Google Sign-In Error: ${error.message}`);
    } finally {
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

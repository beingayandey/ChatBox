import React, { useState } from "react";
import { useToast } from "./contexts/ToastNotification"; // Hook to access toast notification context
import Loader from "./ButtonLoader"; // Component to display a loading spinner
import { auth, db, provider } from "../firebase"; // Firebase auth, Firestore, and Google provider
import { signInWithPopup } from "firebase/auth"; // Firebase function for Google Sign-In
import { useNavigate } from "react-router-dom"; // Hook for programmatic navigation
import { useDispatch } from "react-redux"; // Hook to dispatch Redux actions
import { loginSuccess } from "../store/slices/authSlice"; // Action to update auth state
import { doc, setDoc, serverTimestamp } from "firebase/firestore"; // Firestore functions for saving user data

// GoogleLoginButton component for handling Google Sign-In
const GoogleLoginButton = ({ redirectTo = "/dashboard" }) => {
  // Access toast notification functions from ToastProvider context
  const { showSuccess, showError } = useToast();

  // State to track loading status during sign-in
  const [isLoading, setIsLoading] = useState(false);

  // Hook for navigating to other routes
  const navigate = useNavigate();

  // Hook to dispatch Redux actions
  const dispatch = useDispatch();

  // Function to handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsLoading(true); // Start loading
    try {
      // Perform Google Sign-In with Firebase Auth
      const result = await signInWithPopup(auth, provider);
      const user = result.user; // Get the authenticated user

      // Save user info to Firestore's "users" collection
      // Uses setDoc to create or overwrite the user document
      await setDoc(doc(db, "users", user.uid), {
        displayName: user.displayName, // User's display name
        email: user.email, // User's email
        photoURL: user.photoURL, // User's profile picture URL
        createdAt: serverTimestamp(), // Timestamp of account creation
      });

      // Get the user's ID token for authentication (optional)
      const token = await user.getIdToken();

      // Dispatch loginSuccess action to update Redux auth state
      dispatch(
        loginSuccess({
          user: {
            uid: user.uid, // Unique user ID
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
          },
          token, // Firebase ID token
          provider: "google", // Authentication provider
        })
      );

      // Show success toast notification
      showSuccess(`Welcome, ${user.displayName}!`);

      // Navigate to the specified redirect route (default: /dashboard)
      navigate(redirectTo);
    } catch (error) {
      // Show error toast notification
      showError(`Google Sign-In Error: ${error.message}`);
    } finally {
      // Stop loading regardless of success or failure
      setIsLoading(false);
    }
  };

  // Render the Google Sign-In button
  return (
    <button
      className="google-btn" // CSS class for styling
      onClick={handleGoogleSignIn} // Trigger sign-in on click
      disabled={isLoading} // Disable button while loading
    >
      {/* Show loader during sign-in, otherwise show "Google" */}
      {isLoading ? <Loader size="md" /> : "Google"}
    </button>
  );
};

// Export the component
export default GoogleLoginButton;

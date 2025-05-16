import { useEffect } from "react";
import { useDispatch } from "react-redux"; // Hook to dispatch Redux actions
import { onAuthStateChanged } from "firebase/auth"; // Firebase function to monitor auth state
import { auth } from "../firebase"; // Firebase auth instance
import { loginSuccess, logout } from "../store/slices/authSlice"; // Redux actions for auth state

// AuthListener component to sync Firebase auth state with Redux
const AuthListener = () => {
  // Hook to dispatch Redux actions
  const dispatch = useDispatch();

  // Effect to monitor Firebase authentication state
  useEffect(() => {
    // Set up Firebase auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is logged in
        try {
          // Fetch the user's ID token for authentication
          const token = await user.getIdToken();

          // Dispatch loginSuccess to update Redux auth state
          dispatch(
            loginSuccess({
              user: {
                uid: user.uid, // Unique user ID
                displayName: user.displayName, // User's display name
                email: user.email, // User's email
                photoURL: user.photoURL, // User's profile picture URL
              },
              token, // Firebase ID token
              provider: "google", // Authentication provider (hardcoded as Google)
            })
          );
        } catch (error) {
          // Log error if token fetching fails
          console.error("[AuthListener] Error fetching token:", error);
          // Dispatch logout to clear auth state
          dispatch(logout());
        }
      } else {
        // No user is logged in
        dispatch(logout()); // Clear auth state in Redux
      }
    });

    // Cleanup: Unsubscribe from auth listener on unmount
    return () => {
      unsubscribe();
    };
  }, [dispatch]); // Re-run effect if dispatch changes

  // Return null as this component does not render anything
  return null;
};

// Export the component
export default AuthListener;

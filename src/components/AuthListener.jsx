import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux"; // Hooks for Redux actions & state
import { onAuthStateChanged } from "firebase/auth"; // Firebase function to monitor auth state
import { auth, updateUserPresence } from "../firebase"; // Firebase auth & presence updates
import { loginSuccess, logout } from "../store/slices/authSlice"; // Redux actions for auth state

// AuthListener component to sync Firebase auth state with Redux and track user presence
const AuthListener = () => {
  const dispatch = useDispatch();
  const reduxUser = useSelector((state) => state.auth.user);

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
  }, [dispatch]);

  // Effect to synchronize user real-time presence (Online/Offline/Last Active)
  useEffect(() => {
    if (!reduxUser?.uid) return;

    // Immediately mark as Online when app loads / user is authenticated
    updateUserPresence(reduxUser.uid, true);

    const handleFocus = () => {
      updateUserPresence(reduxUser.uid, true);
    };

    const handleBlur = () => {
      updateUserPresence(reduxUser.uid, false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateUserPresence(reduxUser.uid, true);
      } else {
        updateUserPresence(reduxUser.uid, false);
      }
    };

    // Heartbeat check running every 40s to keep Firestore status active
    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        updateUserPresence(reduxUser.uid, true);
      }
    }, 40000);

    // Visibility event listeners
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Clear online presence when the user unloads/closes the tab
    const handleUnload = () => {
      updateUserPresence(reduxUser.uid, false);
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleUnload);
      
      // Cleanup: immediately toggle offline when user signs out or tab unmounts
      updateUserPresence(reduxUser.uid, false);
    };
  }, [reduxUser?.uid]);

  // Return null as this component does not render anything
  return null;
};

// Export the component
export default AuthListener;

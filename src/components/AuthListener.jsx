// src/components/AuthListener.jsx
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { loginSuccess, logout } from "../store/slices/authSlice";

const AuthListener = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log("[AuthListener] Setting up onAuthStateChanged listener");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          console.log(
            "[AuthListener] User signed in:",
            user.uid,
            "Token:",
            token
          );
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
        } catch (error) {
          console.error("[AuthListener] Error fetching token:", error);
          dispatch(logout());
        }
      } else {
        console.log("[AuthListener] No user signed in");
        dispatch(logout());
      }
    });

    return () => {
      console.log("[AuthListener] Cleaning up onAuthStateChanged listener");
      unsubscribe();
    };
  }, [dispatch]);

  return null; // This component doesn't render anything
};

export default AuthListener;

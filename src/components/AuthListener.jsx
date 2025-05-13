// src/components/AuthListener.jsx
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { loginSuccess, logout } from "../store/slices/authSlice";

const AuthListener = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
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
        } catch (error) {
          console.error("[AuthListener] Error fetching token:", error);
          dispatch(logout());
        }
      } else {
        dispatch(logout());
      }
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  return null; // This component doesn't render anything
};

export default AuthListener;

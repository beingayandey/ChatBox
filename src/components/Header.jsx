import React, { useState, useEffect, useRef } from "react";
import { IoChevronBack } from "react-icons/io5"; // Icon for back navigation
import { MdLogout } from "react-icons/md"; // Icon for logout
import { useNavigate } from "react-router-dom"; // Hook for programmatic navigation
import { useDispatch, useSelector } from "react-redux"; // Hooks for Redux state and actions
import { signOut } from "firebase/auth"; // Firebase function for signing out
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"; // Firestore functions for global logout
import { auth, db } from "../firebase"; // Firebase auth and Firestore instances
import { logout } from "../store/slices/authSlice"; // Action to clear auth state
import Search from "./Search"; // Search component (likely for users)
import { clearChats } from "../store/slices/chatSlice"; // Action to clear chat state
import { useTheme } from "./contexts/ThemeContext"; // Theme context hook
import { useAvatarView } from "./contexts/AvatarViewContext"; // Avatar view context hook
import { BsSun, BsMoonStars, BsDisplay } from "react-icons/bs"; // Icons for themes

// Header component for navigation and user profile
const Header = () => {
  // Hook for navigating to other routes
  const navigate = useNavigate();

  // Hook to dispatch Redux actions
  const dispatch = useDispatch();

  // Hook to open profile pictures in full view
  const { openAvatar } = useAvatarView();

  // Theme states and triggers from ThemeContext
  const { theme, resolvedTheme, setTheme } = useTheme();

  // Select current user from Redux store (from authSlice)
  const user = useSelector((state) => state.auth.user);

  // State to toggle the dropdown menu (for settings/logout)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Cycle toggle themes: light -> dark -> system -> light
  const handleCycleTheme = (e) => {
    e.stopPropagation();
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  // Ref to track the dropdown element for click-outside detection
  const dropdownRef = useRef(null);

  // Function to navigate back to the previous page
  const handleBack = () => {
    navigate(-1); // Go back one step in the browser history
  };

  // Function to handle user logout
  const handleLogout = async (e) => {
    e.stopPropagation(); // Prevent dropdown toggle
    try {
      // Update lastLogoutTimestamp in Firestore to trigger global logout on other devices
      if (user && user.uid) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          lastLogoutTimestamp: serverTimestamp()
        });
      }

      // Sign out from Firebase Auth
      await signOut(auth);

      // Dispatch logout action to clear auth state in Redux
      dispatch(logout());

      // Dispatch clearChats action to clear chat state in Redux
      // This also unsubscribes from Firebase chat listeners (via chatSlice)
      dispatch(clearChats());

      // Navigate to the login page
      navigate("/login");
    } catch (error) {
      // Log any errors during logout
      console.error("Logout failed:", error.message);
    }
  };

  // Function to toggle the dropdown menu
  const toggleDropdown = (e) => {
    e.stopPropagation(); // Prevent event bubbling
    setIsDropdownOpen((prev) => !prev); // Toggle dropdown state
  };

  // Effect to close dropdown when clicking outside
  useEffect(() => {
    // Function to detect clicks outside the dropdown
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        isDropdownOpen
      ) {
        setIsDropdownOpen(false); // Close dropdown
      }
    };

    // Add event listener for mouse clicks
    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]); // Re-run when isDropdownOpen changes

  // Render the header
  return (
    <div>
      <div className="outer-header">
        {/* Back button */}
        <div className="left-back" onClick={handleBack}>
          <IoChevronBack /> {/* Back arrow icon */}
        </div>

        {/* Search bar */}
        <div className="header-middle">
          <Search /> {/* Search component, likely for finding users */}
        </div>

        {/* User profile and dropdown */}
        <div className="header-right">
          {user && (
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* Quick theme cycle toggle */}
              <button
                className="theme-quick-toggle"
                onClick={handleCycleTheme}
                title={`Active Theme: ${theme}. Click to switch.`}
              >
                {resolvedTheme === "light" ? (
                  <BsSun style={{ color: "#f59e0b" }} />
                ) : (
                  <BsMoonStars style={{ color: "#a78bfa" }} />
                )}
              </button>

              <div
                className="header-avatar-container"
                ref={dropdownRef} // Reference for click-outside detection
                onClick={toggleDropdown} // Toggle dropdown on click
              >
                {/* User avatar */}
                <img
                  src={user.photoURL || "https://via.placeholder.com/40"} // Fallback image if no photoURL
                  alt={user.displayName || "User Avatar"}
                  className="avatar-image"
                  title={user.displayName} // Tooltip with user's name
                  onClick={(e) => {
                    e.stopPropagation();
                    const highResPhoto = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&size=128&rounded=true&background=random`;
                    openAvatar(highResPhoto, user.displayName || "Your Profile");
                  }}
                  style={{ cursor: "zoom-in" }}
                />
                {/* User display name */}
                <span className="avatar-name">{user.displayName || "User"}</span>
                {/* Dropdown menu (shown when isDropdownOpen is true) */}
                {isDropdownOpen && (
                  <div
                    className="dropdown-menu"
                    onClick={(e) => e.stopPropagation()} // Prevent closing dropdown on click
                  >
                    {/* Settings button (placeholder, not implemented) */}
                    <button className="dropdown-item">Settings</button>
                    {/* Logout button */}
                    <button className="dropdown-item" onClick={handleLogout}>
                      <MdLogout className="logout-icon" /> Logout
                    </button>

                    {/* Appearance theme selection inside dropdown */}
                    <div className="dropdown-theme-header">Appearance</div>
                    <div className="theme-options-list">
                      <button
                        className={`theme-option-item ${theme === "light" ? "active" : ""}`}
                        onClick={() => setTheme("light")}
                      >
                        <BsSun className="theme-option-icon" style={{ color: "#f59e0b" }} />
                        Light Theme
                        {theme === "light" && <span className="theme-indicator-dot" />}
                      </button>
                      <button
                        className={`theme-option-item ${theme === "dark" ? "active" : ""}`}
                        onClick={() => setTheme("dark")}
                      >
                        <BsMoonStars className="theme-option-icon" style={{ color: "#a78bfa" }} />
                        Dark Theme
                        {theme === "dark" && <span className="theme-indicator-dot" />}
                      </button>
                      <button
                        className={`theme-option-item ${theme === "system" ? "active" : ""}`}
                        onClick={() => setTheme("system")}
                      >
                        <BsDisplay className="theme-option-icon" style={{ color: "#3b82f6" }} />
                        System Default
                        {theme === "system" && <span className="theme-indicator-dot" />}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Export the component
export default Header;

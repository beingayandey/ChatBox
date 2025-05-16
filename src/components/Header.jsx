import React, { useState, useEffect, useRef } from "react";
import { IoChevronBack } from "react-icons/io5"; // Icon for back navigation
import { MdLogout } from "react-icons/md"; // Icon for logout
import { useNavigate } from "react-router-dom"; // Hook for programmatic navigation
import { useDispatch, useSelector } from "react-redux"; // Hooks for Redux state and actions
import { signOut } from "firebase/auth"; // Firebase function for signing out
import { auth } from "../firebase"; // Firebase auth instance
import { logout } from "../store/slices/authSlice"; // Action to clear auth state
import Search from "./Search"; // Search component (likely for users)
import { clearChats } from "../store/slices/chatSlice"; // Action to clear chat state

// Header component for navigation and user profile
const Header = () => {
  // Hook for navigating to other routes
  const navigate = useNavigate();

  // Hook to dispatch Redux actions
  const dispatch = useDispatch();

  // Select current user from Redux store (from authSlice)
  const user = useSelector((state) => state.auth.user);

  // State to toggle the dropdown menu (for settings/logout)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Export the component
export default Header;

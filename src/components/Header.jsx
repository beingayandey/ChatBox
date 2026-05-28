import React, { useState, useEffect, useRef } from "react";
import { IoChevronBack } from "react-icons/io5"; // Icon for back navigation
import { MdLogout } from "react-icons/md"; // Icon for logout
import { useNavigate } from "react-router-dom"; // Hook for programmatic navigation
import { useDispatch, useSelector } from "react-redux"; // Hooks for Redux state and actions
import { signOut } from "firebase/auth"; // Firebase function for signing out
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"; // Firestore functions for global logout
import { auth, db } from "../firebase"; // Firebase auth and Firestore instances
import { logout, updateProfileSuccess } from "../store/slices/authSlice"; // Redux actions for auth state
import Search from "./Search"; // Search component (likely for users)
import { clearChats } from "../store/slices/chatSlice"; // Action to clear chat state
import { useTheme } from "./contexts/ThemeContext"; // Theme context hook
import { useAvatarView } from "./contexts/AvatarViewContext"; // Avatar view context hook
import { useToast } from "./contexts/ToastNotification"; // Hook for toast notifications
import { BsSun, BsMoonStars, BsDisplay, BsGear, BsZoomIn, BsX, BsCamera } from "react-icons/bs"; // Icons

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

  // Toast notifications hook
  const { showSuccess, showError } = useToast();

  // Select current user from Redux store (from authSlice)
  const user = useSelector((state) => state.auth.user);

  // State to toggle the dropdown menu (for settings/logout)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // State for the premium Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPhotoURL, setNewPhotoURL] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  const [isUploading, setIsUploading] = useState(false);

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

  // Function to open settings and prepopulate state
  const handleOpenSettings = () => {
    if (user) {
      setNewDisplayName(user.displayName || "");
      setNewPhotoURL(user.photoURL || "");
      setPreviewURL(user.photoURL || "");
      setUploadFile(null);
      setIsSettingsOpen(true);
    }
  };

  // Handle local avatar file picker change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadFile(file);
      setPreviewURL(URL.createObjectURL(file)); // Set local preview object URL
    }
  };

  // Handle saving profile changes
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!newDisplayName.trim()) {
      showError("Display name cannot be empty");
      return;
    }

    setIsUploading(true);
    try {
      let finalPhotoURL = newPhotoURL;

      // 1. If a local file is selected for upload, upload it to Firebase Storage
      if (uploadFile) {
        let fileToUpload = uploadFile;
        // Compress image dynamically if available
        try {
          const { compressImage } = await import("../firebase");
          if (uploadFile.type.startsWith("image/") && compressImage) {
            fileToUpload = await compressImage(uploadFile);
          }
        } catch (compErr) {
          console.warn("Image compression skipped:", compErr);
        }

        const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
        const { storage } = await import("../firebase");

        const storageRef = ref(storage, `avatars/${user.uid}/${Date.now()}_avatar`);
        const snapshot = await uploadBytes(storageRef, fileToUpload);
        finalPhotoURL = await getDownloadURL(snapshot.ref);
      }

      // 2. Update Firebase Auth Local Profile
      const { updateProfile } = await import("firebase/auth");
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: newDisplayName,
          photoURL: finalPhotoURL
        });
      }

      // 3. Update Firestore Global User Profile Document
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName,
        photoURL: finalPhotoURL,
        displayNameLower: newDisplayName.toLowerCase()
      });

      // 4. Update Redux Auth State
      dispatch(
        updateProfileSuccess({
          displayName: newDisplayName,
          photoURL: finalPhotoURL
        })
      );

      showSuccess("Profile settings updated successfully!");
      setIsSettingsOpen(false);
    } catch (err) {
      console.error("Error updating profile settings:", err);
      showError(`Failed to update profile: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
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
                  style={{ cursor: "pointer" }}
                />
                {/* User display name */}
                <span className="avatar-name">{user.displayName || "User"}</span>
                {/* Dropdown menu (shown when isDropdownOpen is true) */}
                {isDropdownOpen && (
                  <div
                    className="dropdown-menu"
                    onClick={(e) => e.stopPropagation()} // Prevent closing dropdown on click
                  >
                    {/* Settings button */}
                    <button
                      className="dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDropdownOpen(false);
                        handleOpenSettings();
                      }}
                    >
                      <BsGear className="logout-icon" style={{ marginRight: "8px", verticalAlign: "middle" }} />
                      Settings
                    </button>

                    {/* View Profile Picture button */}
                    <button
                      className="dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDropdownOpen(false);
                        const highResPhoto = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&size=128&rounded=true&background=random`;
                        openAvatar(highResPhoto, user.displayName || "Your Profile");
                      }}
                    >
                      <BsZoomIn className="logout-icon" style={{ marginRight: "8px", verticalAlign: "middle" }} />
                      View Profile Picture
                    </button>

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

      {/* Premium Glassmorphic Profile & Settings Modal */}
      {isSettingsOpen && (
        <div className="settings-modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="settings-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>Profile Settings</h3>
              <button className="settings-modal-close-btn" onClick={() => setIsSettingsOpen(false)}>
                <BsX />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="settings-modal-body">
              {/* Premium Avatar Edit Area */}
              <div className="settings-avatar-section">
                <div className="settings-avatar-wrapper">
                  <img
                    src={previewURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(newDisplayName || "User")}&size=128&rounded=true&background=random`}
                    alt="Avatar Preview"
                    className="settings-avatar-preview"
                  />
                  <label htmlFor="avatar-upload" className="settings-avatar-upload-label" title="Upload new photo">
                    <BsCamera className="camera-icon" />
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
                <div className="settings-avatar-hint">Click the camera to upload a local photo</div>
              </div>

              {/* Form Fields */}
              <div className="settings-form-group">
                <label className="settings-label">Display Name</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="Enter your name..."
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  maxLength={30}
                  required
                />
              </div>

              <div className="settings-form-group">
                <label className="settings-label">Avatar Image URL</label>
                <input
                  type="url"
                  className="settings-input"
                  placeholder="Or paste direct image URL..."
                  value={newPhotoURL}
                  onChange={(e) => {
                    setNewPhotoURL(e.target.value);
                    setPreviewURL(e.target.value || (user ? user.photoURL : ""));
                  }}
                />
              </div>

              <div className="settings-form-group">
                <label className="settings-label">Email Address (Read-only)</label>
                <input
                  type="email"
                  className="settings-input settings-input-readonly"
                  value={user ? user.email : ""}
                  readOnly
                  disabled
                />
              </div>

              <div className="settings-actions-row">
                <button
                  type="button"
                  className="settings-btn cancel-btn"
                  onClick={() => setIsSettingsOpen(false)}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="settings-btn save-btn"
                  disabled={isUploading}
                >
                  {isUploading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Export the component
export default Header;

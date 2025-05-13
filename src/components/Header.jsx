import React, { useState, useEffect, useRef } from "react";
import { IoChevronBack } from "react-icons/io5";
import { MdLogout } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { logout } from "../store/slices/authSlice";
import Search from "./Search";
import { clearChats } from "../store/slices/chatSlice";

const Header = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleBack = () => {
    navigate(-1);
  };

  const handleLogout = async (e) => {
    e.stopPropagation();
    try {
      await signOut(auth);
      dispatch(logout());
      dispatch(clearChats()); // This will now unsubscribe the listener
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error.message);
    }
  };

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setIsDropdownOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        isDropdownOpen
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div>
      <div className="outer-header">
        <div className="left-back" onClick={handleBack}>
          <IoChevronBack />
        </div>
        <div className="header-middle">
          <Search />
        </div>
        <div className="header-right">
          {user && (
            <div
              className="header-avatar-container"
              ref={dropdownRef}
              onClick={toggleDropdown}
            >
              <img
                src={user.photoURL || "https://via.placeholder.com/40"}
                alt={user.displayName || "User Avatar"}
                className="avatar-image"
                title={user.displayName}
              />
              <span className="avatar-name">{user.displayName || "User"}</span>
              {isDropdownOpen && (
                <div
                  className="dropdown-menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="dropdown-item">Settings</button>
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

export default Header;

import React, { useState } from "react";
import { IoChevronBack } from "react-icons/io5";
import { MdLogout } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { logout } from "../store/slices/authSlice";
import Search from "./Search";
import UsersPage from "../pages/UsersPage";

const Header = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleBack = () => {
    navigate(-1);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      dispatch(logout());
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error.message);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

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
            <div className="header-avatar-container" onClick={toggleDropdown}>
              <img
                src={user.photoURL || "https://via.placeholder.com/40"}
                alt={user.displayName || "User Avatar"}
                className="avatar-image"
                title={user.displayName}
              />
              <span className="avatar-name">{user.displayName || "User"}</span>
              {isDropdownOpen && (
                <div className="dropdown-menu">
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

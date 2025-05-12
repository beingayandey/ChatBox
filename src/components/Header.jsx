import React from "react";
import { IoChevronBack } from "react-icons/io5";
import { BsThreeDots } from "react-icons/bs";
import { MdLogout } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signOut } from "firebase/auth";
import { auth } from "../firebase"; // make sure path is correct
import { logout } from "../store/slices/authSlice";
import Search from "./Search";
import { useLocation } from "react-router-dom";

const Header = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const handleBack = () => {
    navigate(-1);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      dispatch(logout());
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error.message);
    }
  };

  return (
    <>
      <div className="outer-header">
        <div className="left-back" onClick={handleBack}>
          <IoChevronBack />
        </div>
        {user && !isLoginPage && (
          <div className="header-avatar-container">
            <img
              src={user.photoURL || "https://via.placeholder.com/40"}
              alt={user.displayName || "User Avatar"}
              className="avatar-image"
              title={user.displayName}
            />
            <span className="avatar-name">{user.displayName || "User"}</span>
          </div>
        )}
        <div className="header-middle">
          <Search />
        </div>
        <div className="header-right">
          {user && (
            <button className="logout-button" onClick={handleLogout}>
              <MdLogout className="logout-icon" />
            </button>
          )}
          <div className="option-button">
            <button className="right-back">
              <BsThreeDots />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;

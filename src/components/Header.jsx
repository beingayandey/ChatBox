import React from "react";
import { IoChevronBack } from "react-icons/io5";
import { BsThreeDots } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import Search from "./Search";

const Header = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <>
      <div className="outer-header">
        <div className="left-back" onClick={handleBack}>
          <IoChevronBack />
        </div>
        <div className="header-middle">
          <Search />
        </div>
        <div className="right-back">
          <BsThreeDots />
        </div>
      </div>
    </>
  );
};

export default Header;

import React from "react";
import { IoChevronBack } from "react-icons/io5";
import { BsThreeDots } from "react-icons/bs";
import Search from "./Search";

const Header = () => {
  return (
    <>
      <div className="outer-header">
        <div className="left-back">
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

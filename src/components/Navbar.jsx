import React from "react";

const Navbar = ({ activePage, setActivePage }) => {
  return (
    <>
      <div className="navbar-outer">
        <div className="navs">
          <ul>
            <li
              className={`nav-item ${activePage === "recent" ? "active" : ""}`}
              onClick={() => setActivePage("recent")}
            >
              Recent Chats
            </li>
            <li
              className={`nav-item ${activePage === "new" ? "active" : ""}`}
              onClick={() => setActivePage("new")}
            >
              New Chats
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default Navbar;

import React, { useState, useEffect, useRef } from "react";
import { CiSearch } from "react-icons/ci";
import { Link } from "react-router-dom";

const Search = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const wrapperRef = useRef(null);

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsDropdownOpen(!!query);
    onSearch(query); // Pass query to parent
  };

  const handleClickOutside = (event) => {
    if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
      setIsDropdownOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="search-box" ref={wrapperRef}>
      <div className={`search-box-inner ${isDropdownOpen ? "active" : ""}`}>
        <div className="search-icon">
          <CiSearch />
        </div>
        <input
          type="text"
          placeholder="Search users"
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>
      {isDropdownOpen && (
        <div className="search-drop-down">
          <div className="search-drop-down-inner">
            <ul>
              {searchQuery ? (
                <li style={{ padding: "10px 15px" }}>
                  Searching for "{searchQuery}"...
                </li>
              ) : (
                <li style={{ padding: "10px 15px" }}>No results found</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;

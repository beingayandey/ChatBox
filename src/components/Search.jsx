import React, { useState, useEffect, useRef } from "react";
import { CiSearch } from "react-icons/ci";
import { Link } from "react-router-dom";

const Search = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const wrapperRef = useRef(null);

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsDropdownOpen(!!query); // Open only if query has content
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
          placeholder="Search"
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>

      {isDropdownOpen && (
        <div className="search-drop-down">
          <div className="search-drop-down-inner">
            <ul>
              {searchQuery ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <li key={i}>
                    <Link to={`/result/${i}`}>
                      Result {i + 1} for "{searchQuery}"
                    </Link>
                  </li>
                ))
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

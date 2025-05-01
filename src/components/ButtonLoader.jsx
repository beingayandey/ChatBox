import React from "react";

const Loader = ({ size = "md", className = "" }) => {
  return (
    <span
      className={`loader loader--${size} ${className}`}
      aria-hidden="true"
    />
  );
};

Loader.defaultProps = {
  size: "md",
  className: "",
};

export default Loader;

import React, { createContext, useContext, useState } from "react";
import { BsX } from "react-icons/bs";

// Context for viewing profile pictures (avatars)
const AvatarViewContext = createContext(null);

// Provider component that wraps the application and hosts the modal overlay markup
export const AvatarViewProvider = ({ children }) => {
  const [activeAvatar, setActiveAvatar] = useState(null);

  // Function to open the avatar viewer
  const openAvatar = (url, title) => {
    setActiveAvatar({ url, title });
  };

  // Function to close the avatar viewer
  const closeAvatar = () => {
    setActiveAvatar(null);
  };

  return (
    <AvatarViewContext.Provider value={{ openAvatar, closeAvatar }}>
      {children}
      
      {activeAvatar && (
        <div className="avatar-view-overlay" onClick={closeAvatar}>
          <div className="avatar-view-container" onClick={(e) => e.stopPropagation()}>
            <div className="avatar-view-header">
              <h3 className="avatar-view-title">{activeAvatar.title}</h3>
              <button className="avatar-view-close-btn" onClick={closeAvatar}>
                <BsX />
              </button>
            </div>
            <img 
              src={activeAvatar.url} 
              alt={activeAvatar.title} 
              className="avatar-view-image" 
            />
          </div>
        </div>
      )}
    </AvatarViewContext.Provider>
  );
};

// Custom hook to access the avatar view context
export const useAvatarView = () => {
  const context = useContext(AvatarViewContext);
  if (!context) {
    throw new Error("useAvatarView must be used within an AvatarViewProvider");
  }
  return context;
};

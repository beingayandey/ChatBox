import React, { createContext, useContext, useState } from "react";
import { FaTimes } from "react-icons/fa";

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (type, message) => {
    const id = Date.now();
    setToasts((prev) => {
      // If we have 2 toasts, remove the oldest (first) one
      if (prev.length >= 2) {
        return [...prev.slice(1), { id, type, message }];
      }
      return [...prev, { id, type, message }];
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const showSuccess = (message) => addToast("success", message);
  const showError = (message) => addToast("error", message);
  const showInfo = (message) => addToast("info", message);

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast ${
              toast.type === "success"
                ? "toast-success"
                : toast.type === "error"
                ? "toast-error"
                : "toast-info"
            }`}
          >
            {toast.message}
            <button
              onClick={() => removeToast(toast.id)}
              className="toast-close-btn"
            >
              <FaTimes />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

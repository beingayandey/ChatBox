import React, { createContext, useContext, useState, useEffect } from "react";

// Create context for themes
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Read initial theme choice from LocalStorage or default to system
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem("theme") || "system";
    } catch {
      return "system";
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState("light");

  // Setter to persist chosen theme state
  const setTheme = (newTheme) => {
    if (newTheme === "light" || newTheme === "dark" || newTheme === "system") {
      setThemeState(newTheme);
      try {
        localStorage.setItem("theme", newTheme);
      } catch (err) {
        console.warn("Failed to save theme in localStorage:", err);
      }
    }
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // Callback to dynamic state resolver
    const handleChange = () => {
      if (theme === "system") {
        setResolvedTheme(mediaQuery.matches ? "dark" : "light");
      }
    };

    // Calculate active resolved theme on mount or theme setting change
    if (theme === "system") {
      setResolvedTheme(mediaQuery.matches ? "dark" : "light");
    } else {
      setResolvedTheme(theme);
    }

    // Add compatibility listeners for device color preference changes
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [theme]);

  // Synchronize CSS attributes with the resolvedTheme
  useEffect(() => {
    const root = document.documentElement;
    
    // Inject the theme-transitioning class to trigger temporary smooth CSS animations
    root.classList.add("theme-transitioning");
    
    // Toggle dark class and set custom data-theme attribute
    root.setAttribute("data-theme", resolvedTheme);
    root.classList.toggle("dark", resolvedTheme === "dark");

    // Clean up temporary transition utility class
    const timeout = setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 300);

    return () => clearTimeout(timeout);
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Convenient hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

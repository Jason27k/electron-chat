import React, { useEffect, useState } from "react";
import "./TitleBar.css";

interface TitleBarProps {
  title?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({
  title = "Multi-Modal Chat App",
}) => {
  const [platform, setPlatform] = useState<string>("");

  useEffect(() => {
    // Detect platform
    const platform = window.navigator.platform.toLowerCase();
    if (platform.includes("mac")) {
      setPlatform("darwin");
    } else if (platform.includes("win")) {
      setPlatform("win32");
    } else {
      setPlatform("linux");
    }
  }, []);

  const isMac = platform === "darwin";

  // Handle window control actions
  const handleMinimize = () => {
    window.electron?.minimizeWindow();
  };

  const handleMaximize = () => {
    window.electron?.maximizeWindow();
  };

  const handleClose = () => {
    window.electron?.closeWindow();
  };

  return (
    <div className={`title-bar ${platform}`}>
      <div className="title-bar-drag-area">
        <div className="app-title">{title}</div>
      </div>

      {/* Only show custom window controls on non-macOS platforms */}
      {!isMac && (
        <div className="window-controls">
          <button className="window-control minimize" onClick={handleMinimize}>
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect width="10" height="1" x="1" y="5.5" fill="currentColor" />
            </svg>
          </button>
          <button className="window-control maximize" onClick={handleMaximize}>
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect
                width="9"
                height="9"
                x="1.5"
                y="1.5"
                fill="none"
                stroke="currentColor"
              />
            </svg>
          </button>
          <button className="window-control close" onClick={handleClose}>
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path
                d="M2.4 1.1L1.1 2.4l3.6 3.6-3.6 3.6 1.3 1.3 3.6-3.6 3.6 3.6 1.3-1.3-3.6-3.6 3.6-3.6-1.3-1.3-3.6 3.6z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default TitleBar;

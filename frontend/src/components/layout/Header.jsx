import { useState, useEffect } from "react";
import "./Header.css";

function Header() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const formattedDate = time.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          <div className="header-logo-icon">⚡</div>
          <div>
            <div>GridWatch</div>
            <div className="header-subtitle">
              Karnataka Power Distribution Board
            </div>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="header-status">
          <div className="header-status-dot" />
          System Online
        </div>
        <div className="header-time">
          {formattedDate} &middot; {formattedTime}
        </div>
      </div>
    </header>
  );
}

export default Header;

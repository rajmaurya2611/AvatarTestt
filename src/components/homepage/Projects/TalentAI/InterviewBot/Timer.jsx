import React, { useEffect } from "react";
import clockIcon from "../assets_talentAI/clock.svg";
import { formatTime } from "./utils_interviewBot/formatTime";

export default function Timer({ timeLeft, running }) {
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {}, 1000);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="interview-bot-time-left-container">
      <img src={clockIcon} alt="clock" />
      <p style={{ color: "red", fontSize: 16, marginLeft: 5 }}>
        {formatTime(timeLeft)}
      </p>
    </div>
  );
}

import React from "react";
import avatar from "../assets_talentAI/avatar.svg";
import "./interviewBot.css";

export default function MessageList({ messages }) {
  return (
    <div className="interview-bot-transcript-body">
      {messages.map((m, i) => (
        <div key={i} className="interview-bot-message">
          <div
            className="interview-bot-message-container"
            style={{ flexDirection: m.sender === "HR Bot" ? "row" : "row-reverse" }}
          >
            <div className="interview-bot-message-head">
              <img src={avatar} alt="avatar" />
            </div>
            <div className="interview-bot-message-body">
              <strong>{m.sender}</strong>
              <p>{m.text}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

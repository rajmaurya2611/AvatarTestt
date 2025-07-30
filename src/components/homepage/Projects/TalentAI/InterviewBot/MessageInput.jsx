import React from "react";
import sendButton from "../assets_talentAI/send-button.png";

export default function MessageInput({ value, onChange, onSend, disabled }) {
  return (
    <div className="interview-bot-user-input-container">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Type your message here…"
        style={{
          border: "8px solid #f0e9e9",
          width: "25vw",
          borderRadius: 15,
          resize: "none",
          height: 50,
          padding: 7,
          paddingLeft: 5,
          color: "#2C2C2E"
        }}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        style={{ position: "absolute", right: 15, top: 17 }}
      >
        <img src={sendButton} alt="send" style={{ height: 20 }} />
      </button>
    </div>
  );
}

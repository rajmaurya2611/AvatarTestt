import React from "react";
import FileUploader from "./FileUploader";
import "./interviewBot.css";

export default function Header({
  cvFile, jdFile,
  setCvFile, setJdFile,
  onStart,
  loading, started,
  timeLeft
}) {
  return (
    <div className="interview-bot-header">
      <div style={{ paddingLeft: 30, lineHeight: 1.2, marginTop: 21 }}>
        <h1 className="interview-bot-heading">AI Interview Bot</h1>
        <p className="interview-bot-date">July 16, 2025 | { /* Timer mount below */ }</p>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <FileUploader
          label="Upload CV"
          file={cvFile}
          onChange={setCvFile}
          disabled={started || loading}
        />
        <FileUploader
          label="Upload JD"
          file={jdFile}
          onChange={setJdFile}
          disabled={started || loading}
        />
        <button onClick={onStart} disabled={!cvFile || !jdFile || started || loading}>
          {loading ? "Starting…" : "Start Interview"}
        </button>
      </div>
    </div>
  );
}

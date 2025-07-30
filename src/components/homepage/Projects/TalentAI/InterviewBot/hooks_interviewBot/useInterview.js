import { useState } from "react";
import { api } from "../services_interviewBot/api";

export function useInterview() {
  const [cvFile, setCvFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState([]);    // [{ role, content }]
  const [display, setDisplay] = useState([]);    // [{ sender, text }]

  async function startInterview() {
    if (!cvFile || !jdFile) {
      alert("Please upload both CV and JD.");
      return;
    }
    setLoadingUpload(true);
    try {
      const form = new FormData();
      form.append("cv", cvFile);
      form.append("jd", jdFile);
      const {
        data: { cvText, jdText }
      } = await api.post("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const { data } = await api.post("/chat", {
        cv: cvText,
        jd: jdText,
        messages: []
      });

      setHistory(data);
      const first = data.slice(-1)[0].content;
      setDisplay([{ sender: "HR Bot", text: first }]);
      setStarted(true);
    } catch (e) {
      console.error(e);
      alert("Failed to start interview.");
    } finally {
      setLoadingUpload(false);
    }
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    const newHist = [...history, { role: "user", content: text }];
    setHistory(newHist);
    setDisplay(d => [...d, { sender: "You", text }]);

    try {
      const { data } = await api.post("/chat", {
        messages: newHist,
        userText: text
      });
      setHistory(data);
      const bot = data.slice(-1)[0].content;
      setDisplay(d => [...d, { sender: "HR Bot", text: bot }]);

      // TTS:
      const ut = new SpeechSynthesisUtterance(bot);
      window.speechSynthesis.speak(ut);
    } catch (e) {
      console.error(e);
      alert("Failed to send message.");
    }
  }

  async function endInterview() {
    const name = window.prompt("Interview over! Enter your name:");
    if (!name) return;
    try {
      await api.post("/chat/save", { name, conversation: history });
      alert(`Saved under “${name}”`);
      setStarted(false);
    } catch (e) {
      console.error(e);
      alert("Save failed.");
    }
  }

  return {
    cvFile, setCvFile,
    jdFile, setJdFile,
    loadingUpload,
    started,
    display,
    startInterview,
    sendMessage,
    endInterview
  };
}

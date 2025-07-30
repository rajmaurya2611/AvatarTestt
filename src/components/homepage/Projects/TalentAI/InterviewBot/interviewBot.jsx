import React, { useState, useEffect, useRef } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

import MainHeader   from "../MainHeader";
import Sidebar      from "../Sidebar";
import api          from "./services_interviewBot/api";
import Header       from "./Header";
import AvatarPanel  from "./AvatarPanel";
import MessageList  from "./MessageList";
import MessageInput from "./MessageInput";
import Timer        from "./Timer";

import "./interviewBot.css";

export default function InterviewBot() {
  // — file uploads & interview state —
  const [cvFile, setCvFile]       = useState(null);
  const [jdFile, setJdFile]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [started, setStarted]     = useState(false);
  const [history, setHistory]     = useState([]);
  const historyRef                = useRef(history);
  const [messages, setMessages]   = useState([]);
  const [botSpeech, setBotSpeech] = useState("");
  const [input, setInput]         = useState("");
  const [timeLeft, setTimeLeft]   = useState(1800);

  // Sync historyRef
  useEffect(() => { historyRef.current = history; }, [history]);

  // Countdown timer
  useEffect(() => {
    if (!started) return;
    const tid = setInterval(() => setTimeLeft(t => Math.max(t - 1, 0)), 1000);
    return () => clearInterval(tid);
  }, [started]);

  // STT refs
  const recognizerRef = useRef(null);
  const bufRef        = useRef("");
  const pauseTimer    = useRef(null);

  // Start interview: upload → chat → STT setup
  const start = async () => {
    if (!cvFile || !jdFile) {
      alert("Please upload both CV and JD");
      return;
    }
    setLoading(true);
    try {
      // 1️⃣ Upload files & extract text
      const form = new FormData();
      form.append("cv", cvFile);
      form.append("jd", jdFile);
      const { data: { cvText, jdText } } = await api.post("/upload", form);

      // 2️⃣ Initial LLM reply
      const { data } = await api.post("/chat", {
        cv: cvText,
        jd: jdText,
        messages: []
      });
      setHistory(data);
      const firstReply = data[data.length - 1].content;
      setMessages([{ sender: "HR Bot", text: firstReply }]);
      setBotSpeech(firstReply);
      setStarted(true);

      // 3️⃣ Azure STT configuration
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        import.meta.env.VITE_COG_SVC_KEY,
        import.meta.env.VITE_COG_SVC_REGION
      );
      speechConfig.speechRecognitionLanguage = "en-IN";
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
        "2000"
      );
      const recognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()
      );
      recognizerRef.current = recognizer;

      recognizer.recognized = (_, evt) => {
        if (evt.result.reason !== SpeechSDK.ResultReason.RecognizedSpeech) return;
        const text = evt.result.text.trim();
        if (!text) return;
        bufRef.current = bufRef.current ? bufRef.current + " " + text : text;
        clearTimeout(pauseTimer.current);
        pauseTimer.current = setTimeout(async () => {
          const userText = bufRef.current.trim();
          bufRef.current = "";
          setHistory(h => [...h, { role: "user", content: userText }]);
          setMessages(m => [...m, { sender: "You", text: userText }]);
          try {
            const { data: newHistory } = await api.post("/chat", {
              messages: [...historyRef.current, { role: "user", content: userText }],
              userText
            });
            setHistory(newHistory);
            const reply = newHistory[newHistory.length - 1].content;
            setMessages(m => [...m, { sender: "HR Bot", text: reply }]);
            setBotSpeech(reply);
          } catch (err) {
            console.error("Chat API error", err);
          }
        }, 800);
      };

      recognizer.startContinuousRecognitionAsync(
        () => console.log("STT started"),
        err => console.error("STT error", err)
      );
    } catch (err) {
      console.error("Start interview error", err);
      alert("Failed to start interview");
    } finally {
      setLoading(false);
    }
  };

  // Manual text send fallback
  const sendText = async () => {
    const txt = input.trim();
    if (!txt) return;
    setInput("");
    setHistory(h => [...h, { role: "user", content: txt }]);
    setMessages(m => [...m, { sender: "You", text: txt }]);
    try {
      const { data: newHistory } = await api.post("/chat", {
        messages: [...historyRef.current, { role: "user", content: txt }],
        userText: txt
      });
      setHistory(newHistory);
      const reply = newHistory[newHistory.length - 1].content;
      setMessages(m => [...m, { sender: "HR Bot", text: reply }]);
      setBotSpeech(reply);
    } catch (err) {
      console.error("Send text error", err);
      alert("Failed to send message");
    }
  };

  // Stop STT when interview ends
  const end = () => {
    recognizerRef.current?.stopContinuousRecognitionAsync(
      () => console.log("STT stopped"),
      err => console.error("STT stop error", err)
    );
    setStarted(false);
  };

  return (
    <main>
      <MainHeader />
      <Sidebar />

      <div style={{ marginLeft: 50 }}>
        <Header
          cvFile={cvFile}
          jdFile={jdFile}
          setCvFile={setCvFile}
          setJdFile={setJdFile}
          onStart={start}
          loading={loading}
          started={started}
          timeLeft={timeLeft}
        />

        <Timer timeLeft={timeLeft} running={started} />

        <div className="interview-bot-body">
          {/* Avatar stays mounted & lip-syncs each botSpeech */}
          <AvatarPanel speechText={botSpeech} />

          {/* Live transcript */}
          <div className="interview-bot-transcript-container">
            <div className="interview-bot-transcript">
              <div className="interview-bot-transcript-header">
                <div
                  style={{
                    borderRadius: "50%",
                    width: 15,
                    height: 15,
                    background: "#8a0b0b",
                  }}
                />
                <h2
                  style={{
                    color: "white",
                    fontSize: 21,
                    marginLeft: 20,
                    fontWeight: 200,
                    paddingTop: 7,
                  }}
                >
                  Live Transcript
                </h2>
              </div>
              <MessageList messages={messages} />
              <MessageInput
                value={input}
                onChange={setInput}
                onSend={sendText}
                disabled={!started}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

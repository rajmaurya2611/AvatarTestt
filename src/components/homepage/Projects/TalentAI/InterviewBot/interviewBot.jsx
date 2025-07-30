// src/components/interviewBot/InterviewBot.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

import MainHeader   from "../MainHeader";
import Sidebar      from "../Sidebar";
import api          from "./services_interviewBot/api";
import Header       from "./Header";
import MessageList  from "./MessageList";
import MessageInput from "./MessageInput";
import Timer        from "./Timer";

import "./interviewBot.css";

export default function InterviewBot() {
  // — Chat & STT state
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

  const recognizerRef = useRef(null);
  const bufRef        = useRef("");
  const pauseTimer    = useRef(null);

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => {
    if (!started) return;
    const tid = setInterval(() => setTimeLeft(t => Math.max(t - 1, 0)), 1000);
    return () => clearInterval(tid);
  }, [started]);

  // — Avatar streaming refs
  const videoRef       = useRef(null);
  const audioRef       = useRef(null);
  const pcRef          = useRef(null);
  const synthesizerRef = useRef(null);

  // Stop STT when avatar finishes
  const end = useCallback(() => {
    recognizerRef.current?.stopContinuousRecognitionAsync(
      () => console.log("STT stopped"),
      err => console.error("STT stop error", err)
    );
    setStarted(false);
  }, []);

  // — Initialize Avatar + PeerConnection once —
  useEffect(() => {
    const key       = import.meta.env.VITE_COG_SVC_KEY;
    const region    = import.meta.env.VITE_COG_SVC_REGION;
    const endpoint  = import.meta.env.VITE_SPEECH_ENDPOINT.replace(/\/$/, "");
    const character = import.meta.env.VITE_AVATAR_CHARACTER;
    const style     = import.meta.env.VITE_AVATAR_STYLE;

    let cancelled = false;
    (async () => {
      try {
        // 1️⃣ Fetch ICE servers
        const resp = await fetch(
          `${endpoint}/cognitiveservices/avatar/relay/token/v1`,
          { headers: { "Ocp-Apim-Subscription-Key": key } }
        );
        if (!resp.ok) throw new Error(`relay token error: ${resp.status}`);
        const { Urls, Username, Password } = await resp.json();
        console.log("[Avatar] relay payload:", { Urls, Username });

        // 2️⃣ Build iceServers array (TURN + STUN)
        const iceServers = [
          { urls: Urls, username: Username, credential: Password },
          { urls: ["stun:stun.l.google.com:19302"] }
        ];

        // 3️⃣ Create PeerConnection
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        // 3a) Log ICE state changes
        pc.oniceconnectionstatechange = () =>
          console.log("[Avatar] ICE state:", pc.iceConnectionState);

        // 3b) Attach tracks to video/audio
        pc.ontrack = ev => {
          const el = ev.track.kind === "video" ? videoRef.current : audioRef.current;
          if (el) {
            el.srcObject = ev.streams[0];
            el.play().catch(e => console.warn("Playback error:", e));
          }
        };

        // 4️⃣ Configure AvatarSynthesizer
        const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
        const avatarConfig = new SpeechSDK.AvatarConfig(
          character,
          style,
          SpeechSDK.AvatarVideoFormat.MP4
        );
        avatarConfig.remoteIceServers = iceServers;

        const synthesizer = new SpeechSDK.AvatarSynthesizer(
          speechConfig,
          avatarConfig
        );
        synthesizerRef.current = synthesizer;

        synthesizer.avatarSynthesisStarted   = () =>
          console.log("[Avatar] session started");
        synthesizer.avatarSynthesisCompleted = () => {
          console.log("[Avatar] turn completed");
          end();
        };
        synthesizer.canceled = (_, evt) =>
          console.error("[Avatar] error", evt.errorDetails);

        // 5️⃣ Start streaming via your PC
        await synthesizer.startAvatarAsync(pc);
      } catch (err) {
        if (!cancelled) console.error("[Avatar] init error", err);
      }
    })();

    return () => {
      cancelled = true;
      synthesizerRef.current?.close();
      pcRef.current?.close();
    };
  }, [end]);

  // — Speak each LLM reply —
  useEffect(() => {
    const synth = synthesizerRef.current;
    if (synth && botSpeech) {
      console.log("[Avatar] Speaking:", botSpeech);
      synth.speakTextAsync(
        botSpeech,
        () => {},
        err => console.error("[Avatar] speak error", err)
      );
    }
  }, [botSpeech]);

  // — STT & chat start —
  const start = async () => {
    if (!cvFile || !jdFile) return alert("Upload both CV and JD");
    setLoading(true);
    try {
      // Upload & initial chat
      const form = new FormData();
      form.append("cv", cvFile);
      form.append("jd", jdFile);
      const { data: { cvText, jdText } } = await api.post("/upload", form);
      const { data } = await api.post("/chat", {
        cv: cvText, jd: jdText, messages: []
      });
      setHistory(data);
      const first = data.slice(-1)[0].content;
      setMessages([{ sender: "HR Bot", text: first }]);
      setBotSpeech(first);
      setStarted(true);

      // STT setup
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        import.meta.env.VITE_COG_SVC_KEY,
        import.meta.env.VITE_COG_SVC_REGION
      );
      speechConfig.speechRecognitionLanguage = "en-IN";
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
        "2000"
      );
      const recog = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()
      );
      recognizerRef.current = recog;

      recog.recognized = (_, e) => {
        if (e.result.reason !== SpeechSDK.ResultReason.RecognizedSpeech) return;
        const t = e.result.text.trim();
        if (!t) return;
        bufRef.current = bufRef.current ? bufRef.current + " " + t : t;
        clearTimeout(pauseTimer.current);
        pauseTimer.current = setTimeout(async () => {
          const userText = bufRef.current.trim();
          bufRef.current = "";
          setHistory(h => [...h, { role: "user", content: userText }]);
          setMessages(m => [...m, { sender: "You", text: userText }]);
          try {
            const { data: newHist } = await api.post("/chat", {
              messages: [...historyRef.current, { role: "user", content: userText }],
              userText
            });
            setHistory(newHist);
            const reply = newHist.slice(-1)[0].content;
            setMessages(m => [...m, { sender: "HR Bot", text: reply }]);
            setBotSpeech(reply);
          } catch (err) {
            console.error("Chat API error", err);
          }
        }, 800);
      };

      recog.startContinuousRecognitionAsync(
        () => console.log("STT started"),
        err => console.error("STT error", err)
      );
    } catch (err) {
      console.error("Start error", err);
      alert("Failed to start interview");
    } finally {
      setLoading(false);
    }
  };

  // — Manual text send —
  const sendText = async () => {
    const txt = input.trim();
    if (!txt) return;
    setInput("");
    setHistory(h => [...h, { role: "user", content: txt }]);
    setMessages(m => [...m, { sender: "You", text: txt }]);
    try {
      const { data: newHist } = await api.post("/chat", {
        messages: [...historyRef.current, { role: "user", content: txt }],
        userText: txt
      });
      setHistory(newHist);
      const reply = newHist.slice(-1)[0].content;
      setMessages(m => [...m, { sender: "HR Bot", text: reply }]);
      setBotSpeech(reply);
    } catch (err) {
      console.error("SendText error", err);
      alert("Failed to send");
    }
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
          {/* 1️⃣ video is muted to satisfy autoplay */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: 480, height: 270, backgroundColor: "#000" }}
          />
          <audio ref={audioRef} autoPlay muted /> {/* muted here too */}

          {/* Transcript */}
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

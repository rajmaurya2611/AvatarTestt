import React, { useEffect, useRef } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

export default function AvatarPanel({ speechText }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const pcRef    = useRef(null);
  const synthRef = useRef(null);

  useEffect(() => {
    console.log("[Avatar] init…]");
    const key       = import.meta.env.VITE_COG_SVC_KEY;
    const region    = import.meta.env.VITE_COG_SVC_REGION;
    const endpoint  = import.meta.env.VITE_SPEECH_ENDPOINT.replace(/\/$/, "");
    const character = import.meta.env.VITE_AVATAR_CHARACTER;
    const style     = import.meta.env.VITE_AVATAR_STYLE;

    let cancelled = false;
    (async () => {
      try {
        // ─── 1️⃣ Fetch TURN token ───
        const resp = await fetch(
          `${endpoint}/cognitiveservices/avatar/relay/token/v1`,
          { headers: { "Ocp-Apim-Subscription-Key": key } }
        );
        if (!resp.ok) throw new Error(`relay token error: ${resp.status}`);
        const { Urls, Username, Password } = await resp.json();
        console.log("[Avatar] relay payload:", Urls);

        // ─── 2️⃣ ICE servers list (UDP TURN, TCP TURN, STUN) ───
        const iceServers = [
          { urls: Urls, username: Username, credential: Password },
          { urls: Urls.map(u => `${u}?transport=tcp`), username: Username, credential: Password },
          { urls: ["stun:stun.l.google.com:19302"] }
        ];

        // ─── 3️⃣ Create & instrument RTCPeerConnection ───
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;
        pc.onicecandidate = e =>
          console.log("[Avatar] ICE candidate:", e.candidate);
        pc.oniceconnectionstatechange = () =>
          console.log("[Avatar] ICE state:", pc.iceConnectionState);
        pc.ontrack = ev => {
          const el = ev.track.kind === "video" ? videoRef.current : audioRef.current;
          if (el) {
            el.srcObject = ev.streams[0];
            el.play().catch(() => {});
          }
        };

        // ─── 4️⃣ Configure AvatarSynthesizer ───
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
        synthRef.current = synthesizer;

        synthesizer.avatarSynthesisStarted   = () =>
          console.log("[Avatar] session started");
        synthesizer.avatarSynthesisCompleted = () =>
          console.log("[Avatar] turn completed");
        synthesizer.canceled = (_, evt) =>
          console.error("[Avatar] error", evt.errorDetails);

        // ─── *DIAGNOSTIC* Log SDK ICE servers before start ───
        console.log("[Avatar] SDK iceServers before start:", synthesizer.iceServers);

        // ─── Subscribe to high‑level avatar events ───
        synthesizer.avatarEventReceived = (_, evt) =>
          console.log("[AvatarEvent]", evt.eventType, evt);

        // ─── 5️⃣ Start the avatar session, passing YOUR pc ───
        await synthesizer.startAvatarAsync(pc);

        // ─── *DIAGNOSTIC* Log SDK ICE servers after start ───
        console.log("[Avatar] SDK iceServers after start:", synthesizer.iceServers);
      } catch (err) {
        if (!cancelled) console.error("[Avatar] init error", err);
      }
    })();

    return () => {
      cancelled = true;
      synthRef.current?.close();
      pcRef.current?.close();
    };
  }, []);

  // Speak whenever speechText updates
  useEffect(() => {
    const synth = synthRef.current;
    if (synth && speechText) {
      console.log("[Avatar] speaks:", speechText);
      synth.speakTextAsync(
        speechText,
        () => {},
        err => console.error("[Avatar] speak error", err)
      );
    }
  }, [speechText]);

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: 480, height: 270, backgroundColor: "#000" }}
      />
      <audio
        ref={audioRef}
        autoPlay
      />
    </div>
  );
}

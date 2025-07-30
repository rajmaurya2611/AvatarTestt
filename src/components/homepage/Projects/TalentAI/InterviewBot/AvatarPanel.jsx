// src/components/interviewBot/AvatarPanel.jsx
import React, { useEffect, useRef } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

export default function AvatarPanel({ speech, onError, onEnd }) {
  const pcRef          = useRef(null);
  const synthesizerRef = useRef(null);

  useEffect(() => {
    const key       = import.meta.env.VITE_COG_SVC_KEY;
    const region    = import.meta.env.VITE_COG_SVC_REGION;
    const endpoint  = import.meta.env.VITE_SPEECH_ENDPOINT.replace(/\/$/, '');
    const character = import.meta.env.VITE_AVATAR_CHARACTER;
    const style     = import.meta.env.VITE_AVATAR_STYLE;

    let cancelled = false;

    (async () => {
      try {
        // ─── 1️⃣ Fetch TURN/STUN info ───
        const relayUrl = `${endpoint}/cognitiveservices/avatar/relay/token/v1`;
        const resp     = await fetch(relayUrl, {
          headers: { 'Ocp-Apim-Subscription-Key': key }
        });
        if (!resp.ok) throw new Error(`ICE fetch failed: ${resp.status}`);
        const data = await resp.json();
        console.log('[AvatarPanel] relay payload:', data);

        // ─── 2️⃣ Normalize to iceServers[] ───
        let iceServers;
        if (Array.isArray(data.iceServers)) {
          iceServers = data.iceServers;
        } else if (Array.isArray(data.Urls)) {
          iceServers = [{
            urls:       data.Urls,
            username:   data.Username,
            credential: data.Password
          }];
        } else {
          throw new Error('No iceServers returned from avatar relay');
        }
        // Optional STUN fallback
        iceServers.push({ urls: ['stun:stun.l.google.com:19302'] });

        // ─── 3️⃣ Build RTCPeerConnection ───
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        pc.oniceconnectionstatechange = () => {
          console.log('[AvatarPanel] ICE state:', pc.iceConnectionState);
        };

        pc.ontrack = ev => {
          const el = ev.track.kind === 'video'
            ? document.getElementById('remoteVideo')
            : document.getElementById('audioPlayer');
          if (el) {
            el.srcObject = ev.streams[0];
            el.play().catch(e => console.warn('Playback error', e));
          }
        };

        // ─── 4️⃣ Configure AvatarSynthesizer ───
        const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
        const avatarConfig = new SpeechSDK.AvatarConfig(character, style);
        avatarConfig.videoFormat = SpeechSDK.AvatarVideoFormat.MP4;

        const synthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);
        synthesizerRef.current = synthesizer;

        synthesizer.avatarSynthesisStarted = () => {
          console.log('[AvatarPanel] Avatar session started');
        };
        synthesizer.avatarSynthesisCompleted = () => {
          console.log('[AvatarPanel] Avatar turn completed');
          onEnd?.();
        };
        synthesizer.canceled = (_, evt) => {
          console.error('[AvatarPanel] Synth canceled', evt.errorDetails);
          onError?.(new Error(evt.errorDetails));
        };

        // ─── 5️⃣ Start streaming avatar ───
        await synthesizer.startAvatarAsync(pc);
      } catch (err) {
        if (!cancelled) {
          console.error('[AvatarPanel] init error', err);
          onError?.(err);
        }
      }
    })();

    return () => {
      cancelled = true;
      synthesizerRef.current?.close();
      pcRef.current?.close();
    };
  }, [onError, onEnd]);

  // ─── Speak whenever `speech` changes ───
  useEffect(() => {
    if (!speech) return;
    const synth = synthesizerRef.current;
    if (!synth) return;
    console.log('[AvatarPanel] Speaking:', speech);
    synth.speakTextAsync(
      speech,
      () => {},              // success: avatar turn will fire avatarSynthesisCompleted
      err => onError?.(err)  // failure
    );
  }, [speech, onError]);

  return (
    <div>
      <video
        id="remoteVideo"
        autoPlay
        playsInline
        muted={false}
        style={{
          width: 480,
          height: 270,
          backgroundColor: '#000',
        }}
      />
      <audio id="audioPlayer" autoPlay />
    </div>
  );
}

// import { useEffect, useRef, useState } from "react";
// import "./cameraRecorder.css";
// import camera_logo from "../../assets/video_logo.svg";
// import microphone from "../../assets/microphone.svg";
// import audio from "../../assets/volume.svg";

// export default function CameraRecorder() {
//     const videoRef = useRef(null);
//     const mediaRecorderRef = useRef(null);
//     const [recording, setRecording] = useState(false);
//     const [recordedChunks, setRecordedChunks] = useState([]);

//     useEffect(() => {
//         async function startCamera() {
//             try {
//                 const stream = await navigator.mediaDevices.getUserMedia({
//                 video: { facingMode: "user" }, // "user" = front camera
//                 audio: true
//                 });
//                 videoRef.current.srcObject = stream;
//             } catch (err) {
//                 console.error("Error accessing camera:", err);
//             }
//         }

//         startCamera();
//     }, []);

//     const startRecording = () => {
//         const stream = videoRef.current.srcObject;
//         const mediaRecorder = new MediaRecorder(stream);
//         mediaRecorderRef.current = mediaRecorder;

//         mediaRecorder.ondataavailable = (e) => {
//         if (e.data.size > 0) {
//             setRecordedChunks((prev) => [...prev, e.data]);
//         }
//         };

//         mediaRecorder.start();
//         setRecording(true);
//     };

//     const stopRecording = () => {
//         mediaRecorderRef.current.stop();
//         setRecording(false);
//     };

//     const saveRecording = () => {
//         const blob = new Blob(recordedChunks, { type: "video/webm" });
//         const url = URL.createObjectURL(blob);
//         const a = document.createElement("a");
//         a.href = url;
//         a.download = "recording.webm";
//         a.click();
//         URL.revokeObjectURL(url);
//         setRecordedChunks([]);
//     };
//     return (
//         <div className="interview-bot-camera-container">
//             <video
//                 ref={videoRef}
//                 autoPlay
//                 playsInline
//                 muted
//                 style={{  width: "35%", borderRadius: "10px" }}
//             />

//             <div style={{ marginTop: "10px" }}>
//                 {!recording ? (
//                 <button className="interview-bot-record-button" onClick={startRecording}><img src={camera_logo} /></button>
//                 ) : (
//                 <button className="interview-bot-stop-record-button" onClick={stopRecording}><img src={camera_logo} /></button>
//                 )}
//                 <button className="interview-bot-audio"><img src={audio}/></button>
//                 <button className="interview-bot-microphone"><img src={microphone}/></button>
                
//                 {recordedChunks.length > 0 && (
//                 <button onClick={saveRecording} style={{ marginLeft: "10px" }}>
//                     Save Recording
//                 </button>
//                 )}
//             </div>
//         </div>
//     );
//     }



import { useEffect, useRef, useState } from "react";
import "./cameraRecorder.css";
import camera_logo from "../assets_talentAI/video_logo.svg";
import microphone from "../assets_talentAI/microphone.svg";
import audio from "../assets_talentAI/volume.svg";

export default function CameraRecorder() {
    const videoRef = useRef(null); // webcam video
    // const mediaRecorderRef = useRef(null); // for webcam
    const screenRecorderRef = useRef(null); // for screen
    // const [recording, setRecording] = useState(false);
    const [screenRecording, setScreenRecording] = useState(false);
    // const [recordedChunks, setRecordedChunks] = useState([]);
    const [screenChunks, setScreenChunks] = useState([]);

    // Webcam stream setup
    // useEffect(() => {
    // async function startCamera() {
    //     try {
    //         const stream = await navigator.mediaDevices.getUserMedia({
    //             video: { facingMode: "user" },
    //             audio: true,
    //         });
    //         videoRef.current.srcObject = stream;
    //     } catch (err) {
    //         console.error("Error accessing camera:", err);
    //     }
    // }

        // startCamera();
    // }, []);

    // === Webcam Recording ===
    // const startRecording = () => {
    //     const stream = videoRef.current.srcObject;
    //     const mediaRecorder = new MediaRecorder(stream);
    //     mediaRecorderRef.current = mediaRecorder;

    //     mediaRecorder.ondataavailable = (e) => {
    //         if (e.data.size > 0) {
    //             setRecordedChunks((prev) => [...prev, e.data]);
    //         }
    //     };

    //     mediaRecorder.start();
    //     setRecording(true);
    // };

    // const stopRecording = () => {
    //     mediaRecorderRef.current.stop();
    //     setRecording(false);
    // };

    // const saveRecording = () => {
    //     const blob = new Blob(recordedChunks, { type: "video/webm" });
    //     const url = URL.createObjectURL(blob);
    //     const a = document.createElement("a");
    //     a.href = url;
    //     a.download = "camera-recording.webm";
    //     a.click();
    //     URL.revokeObjectURL(url);
    //     setRecordedChunks([]);
    // };

    // === Screen Recording ===
   const startScreenRecording = async () => {
    try {
        // 1. Get screen with system audio
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true, // system audio
        });

        // 2. Get webcam + mic
        const micStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: true, // mic audio
        });
        videoRef.current.srcObject = micStream;

        // 3. Use Web Audio API to mix mic and system audio
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        const systemAudioSource = audioContext.createMediaStreamSource(screenStream);
        const micAudioSource = audioContext.createMediaStreamSource(micStream);

        systemAudioSource.connect(destination);
        micAudioSource.connect(destination);

        // 4. Merge video + mixed audio
        const combinedStream = new MediaStream([
            ...screenStream.getVideoTracks(),         // screen video
            ...destination.stream.getAudioTracks(),   // mixed audio
        ]);

        const recorder = new MediaRecorder(combinedStream);
        screenRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                setScreenChunks((prev) => [...prev, e.data]);
            }
        };

        recorder.onstop = () => {
            screenStream.getTracks().forEach(t => t.stop());
            micStream.getTracks().forEach(t => t.stop());
            audioContext.close();
        };

        recorder.start();
        setScreenRecording(true);

    } catch (err) {
        console.error("Error starting screen recording:", err);
    }
};




    const stopScreenRecording = () => {
        screenRecorderRef.current.stop();
        setScreenRecording(false);
    };

    const saveScreenRecording = () => {
        const blob = new Blob(screenChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "screen-recording.webm";
        a.click();
        URL.revokeObjectURL(url);
        setScreenChunks([]);
    };

    return (
        <div className="interview-bot-camera-container">
            {/* Webcam Preview */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "35%", borderRadius: "10px" }}
            />

            <div style={{ marginTop: "10px" }}>
                {/* Camera Recording Controls */}
                {!screenRecording ? (
                    <button
                        className="interview-bot-record-button"
                        onClick={startScreenRecording}
                    >
                        <img src={camera_logo} />
                    </button>
                ) : (
                    <button
                        className="interview-bot-stop-record-button"
                        onClick={stopScreenRecording}
                    >
                        <img src={camera_logo} />
                    </button>
                )}

                <button className="interview-bot-audio">
                    <img src={audio} />
                </button>
                <button className="interview-bot-microphone">
                    <img src={microphone} />
                </button>

                {screenChunks.length > 0 && (
                    <button onClick={saveScreenRecording} style={{ marginLeft: "10px" }}>
                        Save Recording
                    </button>
                )}

                {/* Screen Recording Controls */}
                {/* {!screenRecording ? (
                    <button
                        className="interview-bot-record-button"
                        onClick={startScreenRecording}
                        style={{ marginLeft: "10px" }}
                    >
                        Start Screen Recording
                    </button>
                ) : (
                    <button
                        className="interview-bot-stop-record-button"
                        onClick={stopScreenRecording}
                        style={{ marginLeft: "10px" }}
                    >
                        Stop Screen Recording
                    </button>
                )}

                {screenChunks.length > 0 && (
                    <button onClick={saveScreenRecording} style={{ marginLeft: "10px" }}>
                        Save Screen Recording
                    </button>
                )} */}
            </div>
        </div>
    );
}

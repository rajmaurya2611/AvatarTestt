import { useEffect, useState, useRef } from "react";
import {
  Layout,
  Upload,
  Button,
  Modal,
  Input,
  Select,
  Typography,
  Rate,
  message,
  Tooltip,
} from "antd";
import {
  UploadOutlined,
  MessageOutlined,
  SaveOutlined,
  StopOutlined,
  AudioOutlined,
  SoundOutlined,
  LikeOutlined,
  DislikeOutlined,
  CopyOutlined
} from "@ant-design/icons";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import logo from "./assets_legal/logo.png";
import { Link } from 'react-router-dom';
 
const { Header, Sider, Content } = Layout;
const { TextArea } = Input;
const { Option } = Select;
 
const API_BASE = import.meta.env.VITE_LEGALLENS_BASE;
 
const predefinedQuestions = [
  "What is the Definition of 'Material Adverse Effect' (MAE) as per the contract?",
  "List the non-compete provisions in the document?",
  "What is the Limitation on Liability (Indemnification) and how is it calculated?",
  "What is the Survival Period for Indemnification?",
  "What is the threshold (Deductible) for claims under indemnification?",
];
 
export default function AnalysisPage() {
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [typingIntervalId, setTypingIntervalId] = useState<NodeJS.Timeout | null>(null);
  
  // Speech Recognition states and refs
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // Speech Synthesis states and refs
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef<boolean>(false);
  const activeSpeechMessageId = useRef<string | null>(null);
 
  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/documents`);
      setUploadedDocs(res.data.documents);
    } catch {
      message.error("Failed to fetch documents.");
    }
  };
 
  useEffect(() => {
    fetchDocuments();
  }, []);
  
  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setQuestion((prev) => (prev + " " + transcript).trim());
      };
      recognition.onerror = (error: any) => {
        console.error("Speech recognition error:", error);
        setIsRecording(false);
      };
      recognition.onend = () => {
        // This ensures the state is updated if recognition stops unexpectedly
        setIsRecording(false);
      };
      recognitionRef.current = recognition;
    } else {
      message.warning("Speech recognition is not supported in this browser.");
    }
    
    // Clean up on component unmount
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Handle any errors during cleanup
        }
      }
      
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const customUpload = async ({ file, onSuccess, onError }: any) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API_BASE}/upload-document`, formData);
      const result = res.data;
 
      message.success("Uploaded successfully");
      fetchDocuments();
      setIsUploadModalOpen(false);
      setFileList([]);
      onSuccess({}, file);
 
      // Show clause check result
      if (result.missing_clauses) {
        const missing = Array.isArray(result.missing_clauses) && result.missing_clauses.length > 0;
 
        Modal.info({
          title: "Clause Check Result",
          content: (
            <div>
              {missing ? (
                <>
                  <p><strong>Missing Clauses:</strong></p>
                  <ul className="list-disc list-inside text-red-600">
                    {result.missing_clauses.map((clause: string, idx: number) => (
                      <li key={idx}>{clause}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-green-600 font-medium">All key clauses are present in the document.</p>
              )}
            </div>
          ),
          width: 500
        });
      }
    } catch (err) {
      message.error("Upload failed");
      onError(new Error("Upload failed"));
    }
  };
 
  const simulateTyping = (text: string, callback: (finalText: string) => void) => {
    let index = 0;
    let currentText = "";
    setBotTyping(true);
    const interval = setInterval(() => {
      if (index < text.length) {
        currentText += text[index++];
        setChatHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = currentText;
          return [...updated];
        });
      } else {
        clearInterval(interval);
        setBotTyping(false);
        callback(currentText);
      }
    }, 20);
    setTypingIntervalId(interval);
  };
 
  const stopTyping = () => {
    if (typingIntervalId) {
      clearInterval(typingIntervalId);
      setBotTyping(false);
      setTypingIntervalId(null);
    }
  };
 
  const handleAsk = async () => {
    if (!selectedDoc || !question) return;
    const userMsg = { id: uuidv4(), role: "user", content: question };
    setChatHistory(prev => [...prev, userMsg]);
    setQuestion("");
 
    const typingPlaceholder = { id: uuidv4(), role: "bot", content: "" };
    setChatHistory(prev => [...prev, typingPlaceholder]);
 
    try {
      const res = await axios.post(`${API_BASE}/query`, {
        mode: "single",
        selected_doc: selectedDoc,
        query: userMsg.content,
      });
 
      simulateTyping(res.data.response, () => {});
    } catch {
      message.error("Failed to get response.");
      setChatHistory(prev => prev.slice(0, -1));
    }
  };
 
  const openFeedbackModal = (id: string) => {
    setActiveMessageId(id);
    setIsFeedbackModalOpen(true);
  };
 
  const submitFeedback = async () => {
    if (!feedbackRating || !activeMessageId) return;
    const msg = chatHistory.find(m => m.id === activeMessageId);
    if (!msg || msg.role !== "bot") return;
 
    setSubmittingFeedback(true);
    try {
      await axios.post(`${API_BASE}/feedback`, {
        query: "",
        response: msg.content,
        feedback: feedbackText,
        rating: feedbackRating,
      });
      message.success("Feedback submitted");
      setFeedbackRating(null);
      setFeedbackText("");
      setIsFeedbackModalOpen(false);
    } catch {
      message.error("Feedback submission failed");
    } finally {
      setSubmittingFeedback(false);
    }
  };
 
  const saveChatAsText = () => {
    const content = chatHistory.map(msg => `${msg.role === "user" ? "You" : "Bot"}: ${msg.content}`).join("\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "chat_history.txt";
    link.click();
  };
 
  
  // Handle microphone click for speech recognition
  const handleMicClick = () => {
    if (!recognitionRef.current) {
      message.warning("Speech recognition is not supported in this browser.");
      return;
    }
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Failed to start recognition:", error);
        message.error("Failed to start speech recognition");
      }
    }
  };
  
  // Function to speak text from bot messages
  const speakText = (text: string, messageId: string) => {
    if ('speechSynthesis' in window) {
      // If we're currently speaking this message, stop it
      if (isSpeakingRef.current && activeSpeechMessageId.current === messageId) {
        window.speechSynthesis.cancel();
        isSpeakingRef.current = false;
        activeSpeechMessageId.current = null;
        setIsSpeaking(false);
        return;
      }
      
      // If we're speaking another message, stop that first
      if (isSpeakingRef.current) {
        window.speechSynthesis.cancel();
      }
      
      // Start speaking this message
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      
      utterance.onend = () => {
        isSpeakingRef.current = false;
        activeSpeechMessageId.current = null;
        setIsSpeaking(false);
      };
      
      utterance.onerror = () => {
        isSpeakingRef.current = false;
        activeSpeechMessageId.current = null;
        setIsSpeaking(false);
      };
      
      isSpeakingRef.current = true;
      activeSpeechMessageId.current = messageId;
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } else {
      message.warning("Speech Synthesis API not supported in this browser.");
    }
  };
  
  // Stop all speech
  const stopAllSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
      activeSpeechMessageId.current = null;
      setIsSpeaking(false);
    }
  };

  // Function to copy text to clipboard
  const copyText = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      console.log("Text copied to clipboard");
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={300} theme="dark" className="bg-[#1f1f1f]">
        <div className="p-4">
          <div className="flex justify-center mb-4">
            <Link to="/">
              <img src={logo} alt="Logo" className="w-40" />
            </Link>
          </div>
 
          <div className="my-14">
            <p className="text-sm text-white text-center mt-2 mb-4">
              Upload PDF/DOCX File • Limit 200MB per file • PDF, DOCX
            </p>
            <Button
              type="primary"
              block
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-[#FF4D4F] border-none"
            >
              Upload Document
            </Button>
          </div>
 
          <p className="text-sm text-white text-center mt-2 mb-4">
            Must select a document to ask questions
          </p>
          <Select
            placeholder="Select Document"
            className="w-full mb-4"
            onChange={setSelectedDoc}
            value={selectedDoc || undefined}
          >
            {uploadedDocs.map(doc => (
              <Option key={doc} value={doc}>{doc}</Option>
            ))}
          </Select>
        </div>
      </Sider>
 
      <Layout>
        <Header className="bg-[#FF4D4F] text-xl font-semibold shadow flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Select
              placeholder="Predefined Questions"
              onChange={setQuestion}
              value={predefinedQuestions.includes(question) ? question : undefined}
              style={{ minWidth: 600 }}
            >
              {predefinedQuestions.map((q, idx) => (
                <Option key={idx} value={q}>{q}</Option>
              ))}
            </Select>
          </div>
          <div className="header-icons flex items-center gap-2">
            {/* <Button icon={<DeleteOutlined />} onClick={clearChat} /> */}
            <Button icon={<SaveOutlined />} onClick={saveChatAsText} />
            <Button icon={<StopOutlined />} onClick={stopTyping} disabled={!botTyping} />
            <Button 
              icon={<SoundOutlined />} 
              onClick={stopAllSpeech}
              disabled={!isSpeaking}
              danger={isSpeaking}
              title="Stop all speech"
            />
          </div>
        </Header>
 
        <Content className="ms-main-layout rounded-xl flex flex-col justify-between">
          <div className="max-w-6xl w-full mx-auto flex flex-col gap-4 overflow-y-auto h-[60vh] p-4 px-8 rounded">
            {chatHistory.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "ms-prompt justify-end" : "ms-response justify-start"}`}>
                <div className={`p-3 max-w-[80%] rounded-lg ${msg.role === "user" ? "text-black rounded-br-none" : "text-black rounded-bl-none"}`}>
                <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  table: ({ node, ...props }) => (
                    <table className="min-w-full border-collapse border border-gray-300 mb-4 text-sm" {...props} />
                  ),
                  thead: ({ node, ...props }) => (
                    <thead className="text-black text-sm" {...props} />
                  ),
                  tbody: ({ node, ...props }) => <tbody {...props} />,
                  tr: ({ node, ...props }) => (
                    <tr className="border-t border-gray-300" {...props} />
                  ),
                  th: ({ node, ...props }) => (
                    <th className="px-4 py-2 text-left text-sm font-semibold border border-gray-300" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="px-4 py-2 border border-gray-300 text-sm" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="pl-5 list-disc space-y-1 text-sm text-gray-800" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="pl-5 list-decimal space-y-1 text-sm text-gray-800" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li {...props} />
                  )
                }}
                >
                  {msg.content}
                </ReactMarkdown>
 
                  {msg.role === "bot" && !botTyping && (
                    <div className="text-right mt-1">
                      <div className="flex justify-end gap-2">
                        <button className="text-gray-500 mx-1 rounded hover:text-[#da2128]" title="Like">
                          <LikeOutlined />
                        </button>
                        <button className="text-gray-500 mx-1 rounded hover:text-[#da2128]" title="Dislike">
                          <DislikeOutlined />
                        </button>
                        <Tooltip title={isSpeakingRef.current && activeSpeechMessageId.current === msg.id ? "Stop speaking" : "Speak this message"}>
                          <SoundOutlined 
                            className={`text-gray-500 mx-1 cursor-pointer hover:text-[#da2128] ${
                              isSpeakingRef.current && activeSpeechMessageId.current === msg.id ? 'text-red-500' : ''
                            }`}
                            onClick={() => speakText(msg.content, msg.id)}
                          />
                        </Tooltip>
                        <button onClick={() => copyText(msg.content)} className="text-gray-500 mx-1 rounded hover:text-[#da2128]" title="Copy">
                            <CopyOutlined />
                        </button>
                        <MessageOutlined 
                          className="text-gray-500 mx-1 cursor-pointer hover:text-[#da2128]" 
                          onClick={() => openFeedbackModal(msg.id)} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {botTyping && <div className="text-gray-400 italic">Typing...</div>}
          </div>
 
          <div className="ms-textarea max-w-4xl w-full mx-auto mb-4 flex gap-2">
            <TextArea
              placeholder="Type your message..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              className="flex-1 rounded border-gray-500"
            />
            <Tooltip title={isRecording ? "Stop recording" : "Voice input"}>
              <Button
                type={isRecording ? "primary" : "default"}
                danger={isRecording}
                icon={<AudioOutlined />}
                onClick={handleMicClick}
                className={isRecording ? "bg-red-500" : ""}
              />
            </Tooltip>
            {/* <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleAsk}
              disabled={!selectedDoc || !question}
              className="bg-[#FF4D4F]"
            >
              Send
            </Button> */}
            <div className="custom-btns">
              <button disabled>Reasoning</button>
              <button disabled>Web Search</button>
            </div>
          </div>
        </Content>
      </Layout>
 
      <Modal open={isUploadModalOpen} title="Upload Contract Document" onCancel={() => setIsUploadModalOpen(false)} footer={null}>
        <Upload.Dragger
          name="file"
          customRequest={customUpload}
          accept=".pdf,.docx"
          fileList={fileList}
          onChange={({ fileList }) => setFileList(fileList)}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 32, color: "#FF4D4F" }} />
          </p>
          <p>Drag and drop or click to upload PDF/DOCX</p>
        </Upload.Dragger>
      </Modal>
 
      <Modal
        open={isFeedbackModalOpen}
        title="Submit Feedback"
        onCancel={() => setIsFeedbackModalOpen(false)}
        onOk={submitFeedback}
        okText="Submit"
        confirmLoading={submittingFeedback}
        okButtonProps={{ disabled: feedbackRating === null }}
      >
        <Typography.Text strong>How helpful was this response?</Typography.Text>
        <div className="my-2">
          <Rate
            className="custom-rate"
            value={feedbackRating || 0}
            onChange={(val) => setFeedbackRating(val)}
          />
        </div>
        <TextArea
          rows={3}
          placeholder="Optional comments..."
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
        />
      </Modal>
    </Layout>
  );
}
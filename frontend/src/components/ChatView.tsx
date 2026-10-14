import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Copy, Check, Volume2, VolumeX, Paperclip, Mic, MicOff, User as UserIcon, X, FileText, Image as ImageIcon, CornerDownLeft, ExternalLink, CheckSquare, Square } from 'lucide-react';
import { Message, ModelInfo } from '../types';
import { api, API_BASE } from '../services/api';

interface ChatViewProps {
  messages: Message[];
  models: ModelInfo[];
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  onSendMessage: (text: string, imageUrl?: string, useRag?: boolean, genAudio?: boolean) => Promise<void>;
  isLoading: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  selectedModel,
  onSendMessage,
  isLoading,
}) => {
  const [inputText, setInputText] = useState('');
  const [useRag, setUseRag] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<string | null>(null);
  
  // Attachments State
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string; status: 'uploading' | 'ready' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Input State (Speech-to-Text)
  const [isListening, setIsListening] = useState(false);
  const [micErrorMsg, setMicErrorMsg] = useState<string | null>(null);
  const isListeningRef = useRef(false);
  const baseTextRef = useRef('');
  const finalTranscriptRef = useRef('');
  const recognitionRef = useRef<any>(null);

  // Audio Playback State (Text-to-Speech)
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Voice Speech Recognition setup
  const toggleSpeechRecognition = async () => {
    setMicErrorMsg(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicErrorMsg('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListeningRef.current) {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    // Capture initial text before recording
    baseTextRef.current = inputText;
    finalTranscriptRef.current = '';

    // Request microphone permission cleanly if needed
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (permErr: any) {
      console.warn('Microphone permission blocked:', permErr);
      setMicErrorMsg('Microphone access blocked. Click the lock/camera icon in your browser URL bar to allow microphone.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        setMicErrorMsg(null);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0].transcript;
          if (res.isFinal) {
            finalTranscriptRef.current += text + ' ';
          } else {
            interim += text;
          }
        }
        const prefix = baseTextRef.current ? baseTextRef.current.trim() + ' ' : '';
        const combined = prefix + finalTranscriptRef.current + interim;
        setInputText(combined);
        if (textareaRef.current) {
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicErrorMsg('Microphone blocked. Please allow microphone in browser URL settings.');
          isListeningRef.current = false;
          setIsListening(false);
        } else if (event.error === 'no-speech') {
          // Keep listening during natural speech pauses
        } else if (event.error === 'aborted') {
          isListeningRef.current = false;
          setIsListening(false);
        } else {
          setMicErrorMsg(`Speech recognition info: ${event.error}`);
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch (e) {
            isListeningRef.current = false;
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setMicErrorMsg(`Unable to start microphone: ${err.message || 'Please check browser settings'}`);
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  // High-performance client-side image compression to ensure fast, reliable vision
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle File & Image Attachments
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processUploadedFile = async (file: File) => {
    if (file.type.startsWith('image/')) {
      const compressed = await compressImage(file);
      setAttachedImage(compressed);
    } else {
      // Document upload for RAG
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      setAttachedFile({ name: file.name, size: sizeStr, status: 'uploading' });
      try {
        await api.uploadDocument(file);
        setAttachedFile({ name: file.name, size: sizeStr, status: 'ready' });
        setUseRag(true);
      } catch (err: any) {
        console.error('Document upload error:', err);
        setAttachedFile({ name: file.name, size: sizeStr, status: 'error' });
      }
    }
  };

  // Clipboard Paste support (Ctrl+V) for screenshots and copied images
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const compressed = await compressImage(file);
          setAttachedImage(compressed);
          return;
        }
      }
    }
  };

  const [isDragOverChat, setIsDragOverChat] = useState(false);

  const handleChatDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverChat(true);
  };

  const handleChatDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverChat(false);
  };

  const handleChatDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverChat(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  const removeAttachedImage = () => setAttachedImage(null);
  const removeAttachedFile = () => setAttachedFile(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !attachedImage) || isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const text = inputText.trim() || (attachedImage ? 'Analyze and reason about this attached image.' : '');
    const imgToSend = attachedImage || undefined;

    setInputText('');
    setAttachedImage(null);
    setAttachedFile(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
    }

    await onSendMessage(text, imgToSend, useRag, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = '48px';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyCode = (code: string, blockId: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(blockId);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  // High-fidelity natural audio playback
  const playTTS = (text: string, msgId: string) => {
    if (playingMsgId === msgId) {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setPlayingMsgId(null);
      return;
    }

    const cleanText = text.replace(/[*#_`]/g, '').slice(0, 400);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setPlayingMsgId(null);
      utterance.onerror = () => setPlayingMsgId(null);
      window.speechSynthesis.speak(utterance);
      setPlayingMsgId(msgId);
    } else {
      const audio = new Audio(`${API_BASE}/ai/tts?text=${encodeURIComponent(cleanText.slice(0, 200))}`);
      audio.onended = () => setPlayingMsgId(null);
      audio.onerror = () => setPlayingMsgId(null);
      audio.play().catch(console.error);
      setPlayingMsgId(msgId);
    }
  };

  // Parse inline elements (images, links, bold, code, URLs)
  const parseInlineElements = (text: string, keyPrefix: string) => {
    // Tokenize for ![alt](url), [text](url), **bold**, `code`, raw URLs
    const regex = /(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\)|https?:\/\/[^\s<)]+|\*\*.*?\*\*|`.*?`)/g;
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      if (!part) return null;
      const partKey = `${keyPrefix}-${idx}`;

      // Image: ![alt](url)
      if (part.startsWith('![') && part.includes('](') && part.endsWith(')')) {
        const altMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
        if (altMatch) {
          return (
            <img
              key={partKey}
              src={altMatch[2]}
              alt={altMatch[1] || 'Embedded visual'}
              className="markdown-rendered-img"
              loading="lazy"
            />
          );
        }
      }

      // Link: [text](url)
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          return (
            <a
              key={partKey}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="markdown-link"
              title={linkMatch[2]}
            >
              <span>{linkMatch[1]}</span>
              <ExternalLink size={11} />
            </a>
          );
        }
      }

      // Raw URL: https://...
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a
            key={partKey}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="markdown-link"
          >
            <span>{part.length > 40 ? part.slice(0, 37) + '...' : part}</span>
            <ExternalLink size={11} />
          </a>
        );
      }

      // Bold: **text**
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={partKey} style={{ color: '#ffffff', fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Inline code: `code`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={partKey}
            style={{
              background: 'rgba(255,255,255,0.08)',
              padding: '2px 5px',
              borderRadius: '4px',
              fontSize: '0.88em',
              fontFamily: 'var(--font-mono)',
              color: '#ffe776',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return <span key={partKey}>{part}</span>;
    });
  };

  // State to track checked tasks inside chat messages
  const [checkedChatTasks, setCheckedChatTasks] = useState<Record<string, boolean>>({});

  const toggleChatTask = (taskId: string) => {
    setCheckedChatTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  // Full ChatGPT-style Markdown & Table Parser
  const renderMessageContent = (content: string, msgId: string) => {
    if (!content) return <span>Generating response…</span>;

    // Check for code blocks ```lang ... ```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let blockCounter = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          value: content.substring(lastIndex, match.index),
        });
      }
      parts.push({
        type: 'code',
        lang: match[1] || 'plaintext',
        code: match[2].trimEnd(),
        blockId: `${msgId}-code-${blockCounter++}`,
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        value: content.substring(lastIndex),
      });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {parts.map((p, pIdx) => {
          if (p.type === 'code') {
            const isCopied = copiedCodeIdx === p.blockId;
            return (
              <div key={pIdx} className="code-block-wrapper">
                <div className="code-block-header">
                  <span>{p.lang}</span>
                  <button
                    type="button"
                    className="code-block-copy-btn"
                    onClick={() => copyCode(p.code || '', p.blockId || '')}
                  >
                    {isCopied ? <Check size={12} color="#23d92c" /> : <Copy size={12} />}
                    <span>{isCopied ? 'Copied!' : 'Copy code'}</span>
                  </button>
                </div>
                <pre className="code-block-content">
                  <code>{p.code}</code>
                </pre>
              </div>
            );
          }

          // Parse lines with Markdown Tables, Task Lists, Headers, and Lists
          const rawLines = (p.value || '').split('\n');
          const renderedNodes: React.ReactNode[] = [];
          let lineIdx = 0;

          while (lineIdx < rawLines.length) {
            const currentLine = rawLines[lineIdx];

            // 1. Detect Markdown Table
            // Header line has | and next line is a separator like |---|---|
            if (
              currentLine.trim().startsWith('|') &&
              currentLine.trim().endsWith('|') &&
              lineIdx + 1 < rawLines.length &&
              rawLines[lineIdx + 1].trim().startsWith('|') &&
              rawLines[lineIdx + 1].includes('---')
            ) {
              const tableHeaderRow = currentLine
                .split('|')
                .slice(1, -1)
                .map((c) => c.trim());
              lineIdx += 2; // skip header and separator line
              const tableRows: string[][] = [];

              while (
                lineIdx < rawLines.length &&
                rawLines[lineIdx].trim().startsWith('|') &&
                rawLines[lineIdx].trim().endsWith('|')
              ) {
                const rowCells = rawLines[lineIdx]
                  .split('|')
                  .slice(1, -1)
                  .map((c) => c.trim());
                tableRows.push(rowCells);
                lineIdx++;
              }

              const tableKey = `${msgId}-table-${pIdx}-${lineIdx}`;
              renderedNodes.push(
                <div key={tableKey} className="markdown-table-wrap">
                  <table className="markdown-table">
                    <thead>
                      <tr>
                        {tableHeaderRow.map((th, thIdx) => (
                          <th key={thIdx}>{parseInlineElements(th, `${tableKey}-th-${thIdx}`)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx}>{parseInlineElements(cell, `${tableKey}-td-${rIdx}-${cIdx}`)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
              continue;
            }

            const trimmed = currentLine.trim();
            const nodeKey = `${msgId}-${pIdx}-${lineIdx}`;

            if (!trimmed) {
              renderedNodes.push(<div key={nodeKey} style={{ height: '0.4em' }} />);
              lineIdx++;
              continue;
            }

            // 2. Interactive Task Checklist Item (- [ ] or - [x])
            const taskMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/);
            if (taskMatch) {
              const defaultChecked = taskMatch[1].toLowerCase() === 'x';
              const taskText = taskMatch[2];
              const taskId = `${msgId}-task-${lineIdx}`;
              const isChecked = checkedChatTasks[taskId] !== undefined ? checkedChatTasks[taskId] : defaultChecked;

              renderedNodes.push(
                <div
                  key={nodeKey}
                  onClick={() => toggleChatTask(taskId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    padding: '2px 0',
                    userSelect: 'none',
                  }}
                >
                  {isChecked ? (
                    <CheckSquare size={16} color="#23d92c" />
                  ) : (
                    <Square size={16} color="#78d0cd" />
                  )}
                  <span
                    style={{
                      fontSize: '0.9rem',
                      textDecoration: isChecked ? 'line-through' : 'none',
                      color: isChecked ? '#888' : '#e0e0e0',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {parseInlineElements(taskText, `${nodeKey}-text`)}
                  </span>
                </div>
              );
              lineIdx++;
              continue;
            }

            // 3. Headings (#, ##, ###)
            if (trimmed.startsWith('### ')) {
              renderedNodes.push(
                <h4 key={nodeKey} style={{ fontSize: '0.96rem', fontWeight: 600, color: '#ffe776', margin: '6px 0 2px' }}>
                  {parseInlineElements(trimmed.slice(4), nodeKey)}
                </h4>
              );
              lineIdx++;
              continue;
            }
            if (trimmed.startsWith('## ')) {
              renderedNodes.push(
                <h3 key={nodeKey} style={{ fontSize: '1.08rem', fontWeight: 600, color: '#f5f5f5', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 4, margin: '8px 0 3px' }}>
                  {parseInlineElements(trimmed.slice(3), nodeKey)}
                </h3>
              );
              lineIdx++;
              continue;
            }
            if (trimmed.startsWith('# ')) {
              renderedNodes.push(
                <h2 key={nodeKey} style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: '10px 0 4px' }}>
                  {parseInlineElements(trimmed.slice(2), nodeKey)}
                </h2>
              );
              lineIdx++;
              continue;
            }

            // 4. Standard bullet list
            const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ');
            const cleanLine = isBullet ? trimmed.substring(2) : currentLine;

            renderedNodes.push(
              <div
                key={nodeKey}
                style={{
                  display: isBullet ? 'flex' : 'block',
                  gap: isBullet ? '6px' : undefined,
                  marginTop: isBullet ? '2px' : undefined,
                  lineHeight: 1.5,
                }}
              >
                {isBullet && <span style={{ color: '#ffe776' }}>•</span>}
                <span>{parseInlineElements(cleanLine, nodeKey)}</span>
              </div>
            );
            lineIdx++;
          }

          return renderedNodes;
        })}
      </div>
    );
  };

  const handleCapabilityClick = (prompt: string, autoRag: boolean = false) => {
    setInputText(prompt);
    if (autoRag) setUseRag(true);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div
      className="workspace-view"
      onDragOver={handleChatDragOver}
      onDragEnter={handleChatDragOver}
      onDragLeave={handleChatDragLeave}
      onDrop={handleChatDrop}
      style={{ position: 'relative' }}
    >
      {isDragOverChat && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255, 231, 118, 0.12)',
          border: '2px dashed #ffe776',
          borderRadius: 16,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          pointerEvents: 'none',
        }}>
          <ImageIcon size={48} color="#ffe776" />
          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffe776' }}>
            Drop image or document to attach
          </span>
        </div>
      )}

      {/* Scrollable Messages Stream */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <h1 className="hero-h1">
              Think clearly.<br />Decide confidently
            </h1>
            <p className="hero-subtitle">
              An AI workspace that structures your reasoning, not just your answers.
            </p>

            {/* 4 Core Pillars Grid */}
            <div className="capabilities-grid">
              <div
                className="capability-card"
                onClick={() => handleCapabilityClick('Write a high-performance Python algorithm for Dijkstra shortest path and explain the computational complexity.')}
              >
                <div className="capability-card-title">
                  <span>🚀</span>
                  <span>Reasoning & Code Synthesis</span>
                </div>
                <div className="capability-card-desc">
                  High-throughput complex problem solving, algorithm design, and code generation.
                </div>
              </div>

              <div
                className="capability-card"
                onClick={() => handleCapabilityClick('Search and ground your answer using my uploaded knowledge base documents: summarize key points.', true)}
              >
                <div className="capability-card-title">
                  <span>📚</span>
                  <span>Document Intelligence (RAG)</span>
                </div>
                <div className="capability-card-desc">
                  Vector retrieval and grounded source citations over PDF, Word, and text files.
                </div>
              </div>

              <div
                className="capability-card"
                onClick={() => handleCapabilityClick('Execute a multi-step objective: calculate 15 * (42 + 18) and outline system architecture safety rules.')}
              >
                <div className="capability-card-title">
                  <span>🤖</span>
                  <span>Autonomous Workflows & Tools</span>
                </div>
                <div className="capability-card-desc">
                  Multi-step execution with AST calculation, diagnostics, and structured trace logs.
                </div>
              </div>

              <div
                className="capability-card"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <div className="capability-card-title">
                  <span>🎙️</span>
                  <span>Multimodal Vision & Audio</span>
                </div>
                <div className="capability-card-desc">
                  Click to attach an image for visual reasoning or use the mic for real-time speech.
                </div>
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`chat-row ${m.role}`}>
              {m.role === 'assistant' && (
                <div className="avatar-ai" aria-hidden="true" />
              )}

              <div className="bubble">
                {/* Render Attached Image if Vision Message */}
                {m.image_url && (
                  <img src={m.image_url} alt="Attached input" className="chat-msg-image" />
                )}

                <div>{renderMessageContent(m.content, m.id)}</div>

                {m.role === 'assistant' && (
                  <div className="message-actions">
                    <button
                      className="msg-action-btn"
                      onClick={() => copyToClipboard(m.content, m.id)}
                      title="Copy response"
                    >
                      {copiedId === m.id ? <Check size={12} color="#23d92c" /> : <Copy size={12} />}
                      <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      className="msg-action-btn"
                      onClick={() => playTTS(m.content, m.id)}
                      title={playingMsgId === m.id ? 'Stop voice playback' : 'Listen with voice synthesis'}
                      style={{ color: playingMsgId === m.id ? '#23d92c' : undefined }}
                    >
                      {playingMsgId === m.id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      <span>{playingMsgId === m.id ? 'Stop' : 'Listen'}</span>
                    </button>
                  </div>
                )}
              </div>

              {m.role === 'user' && (
                <div className="avatar-user" aria-hidden="true">
                  <UserIcon size={15} color="#eaeaea" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Live Reasoning Bar during Inference */}
        {isLoading && (
          <div className="chat-row assistant">
            <div className="avatar-ai" aria-hidden="true" />
            <div className="bubble" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="green-dot" />
              <span style={{ fontSize: '0.85rem', color: '#dedede', fontWeight: 500 }}>
                Live reasoning with {selectedModel}…
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Hidden File Input for Attachments */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.docx,.txt,.md"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Signature Composer Card */}
      <div className="composer-shell">
        <form className="composer" onSubmit={handleSubmit}>
          {/* Yellow-Teal Underglow Accent */}
          <div className="composer-glow" />

          {/* Attachment Preview Bar (Image or Document) */}
          {(attachedImage || attachedFile) && (
            <div className="composer-preview-bar">
              {attachedImage && (
                <div className="preview-chip">
                  <img src={attachedImage} alt="Thumbnail preview" className="preview-img-thumb" />
                  <span style={{ fontSize: '0.8rem', color: '#ffe776' }}>Visual Image Ready</span>
                  <button type="button" className="preview-remove-btn" onClick={removeAttachedImage} title="Remove image">
                    <X size={12} />
                  </button>
                </div>
              )}

              {attachedFile && (
                <div className="preview-chip">
                  <FileText size={16} color="#ffe776" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {attachedFile.name} ({attachedFile.size})
                  </span>
                  <span style={{ fontSize: '0.72rem', color: attachedFile.status === 'ready' ? '#23d92c' : '#ffd000' }}>
                    {attachedFile.status === 'ready' ? 'Indexed (RAG ON)' : 'Uploading…'}
                  </span>
                  <button type="button" className="preview-remove-btn" onClick={removeAttachedFile} title="Remove document">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Active Voice Listening Banner */}
          {isListening && (
            <div className="mic-listening-banner">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="mic-pulse-dot" />
                <span>Listening to your voice… Speak now</span>
              </div>
              <button
                type="button"
                className="btn-stop-listening"
                onClick={toggleSpeechRecognition}
              >
                Done Speaking
              </button>
            </div>
          )}

          {/* Voice Error / Permission Alert */}
          {micErrorMsg && !isListening && (
            <div className="mic-status-error">
              <span>⚠️ {micErrorMsg}</span>
              <button
                type="button"
                className="preview-remove-btn"
                onClick={() => setMicErrorMsg(null)}
                title="Dismiss"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            {/* Prominent ChatGPT-Style Attachment (📎) Button */}
            <button
              type="button"
              className="composer-btn-icon"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image or document"
              title="Attach image (vision) or document (PDF/TXT/Word for RAG)"
            >
              <Paperclip size={19} />
            </button>

            <textarea
              ref={textareaRef}
              className="composer-textarea"
              placeholder={isListening ? "Listening to your voice... Speak now" : "Message Nexus AI… (Paste screenshot or press Enter to send)"}
              value={inputText}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
            />

            {/* Prominent ChatGPT-Style Microphone (🎙️) Button */}
            <button
              type="button"
              className={`composer-btn-icon composer-btn-mic ${isListening ? 'listening' : ''}`}
              onClick={toggleSpeechRecognition}
              aria-label={isListening ? "Stop voice recording" : "Start voice recording"}
              title={isListening ? "Stop listening" : "Click to speak (Voice-to-Text)"}
            >
              {isListening ? <MicOff size={19} /> : <Mic size={19} />}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              className="btn-send-ambient"
              disabled={isLoading || (!inputText.trim() && !attachedImage)}
              aria-label="Send prompt"
              title="Send prompt"
            >
              <span className="send-inner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </span>
            </button>
          </div>

          <div className="composer-controls" style={{ paddingLeft: 46, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* DeepThink / RAG Grounding Toggle Chip */}
            <button
              type="button"
              className={`chip-toggle-rag ${useRag ? 'active' : ''}`}
              onClick={() => setUseRag(!useRag)}
              title="Ground responses in your uploaded Knowledge Base"
            >
              <Sparkles size={14} />
              <span>DeepThink (RAG {useRag ? 'ON' : 'OFF'})</span>
            </button>

            {/* AI Image Generation Prompt Chip */}
            <button
              type="button"
              className="chip-toggle-rag"
              onClick={() => {
                if (!inputText.toLowerCase().startsWith('/image') && !inputText.toLowerCase().includes('generate image')) {
                  setInputText((prev) => (prev ? `/image ${prev}` : 'Generate an image of '));
                }
                textareaRef.current?.focus();
              }}
              title="Generate photorealistic images and visual diagrams"
              style={{
                borderColor: 'rgba(255, 231, 118, 0.3)',
                color: '#ffe776',
                background: 'rgba(255, 231, 118, 0.06)',
              }}
            >
              <ImageIcon size={14} />
              <span>Generate AI Image (/image)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

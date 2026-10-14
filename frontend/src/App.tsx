import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatView } from './components/ChatView';
import { DocumentWorkspace } from './components/DocumentWorkspace';
import { WorkflowWorkspace } from './components/WorkflowWorkspace';
import { AmbientBackground } from './components/AmbientBackground';
import { Conversation, Message, ModelInfo } from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'docs' | 'workflows'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nexus_sidebar_open');
      if (saved !== null) return saved === 'true';
      return window.innerWidth > 900;
    }
    return true;
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Persist sidebar state
  useEffect(() => {
    try {
      localStorage.setItem('nexus_sidebar_open', String(isSidebarOpen));
    } catch (e) {}
  }, [isSidebarOpen]);

  // Global Ctrl+B shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const FALLBACK_MODELS: ModelInfo[] = [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'NavigateLabs / Google',
      description: 'High-speed multimodal intelligence and reasoning',
      capabilities: { text: true, vision: true, audio_tts: false, streaming: true, tool_calling: true, max_tokens: 32768 },
      is_configured: true,
    },
    {
      id: 'gpt-4.1-nano',
      name: 'GPT-4.1 Nano',
      provider: 'NavigateLabs / OpenAI',
      description: 'Ultra-low latency reasoning and quick drafting',
      capabilities: { text: true, vision: false, audio_tts: false, streaming: true, tool_calling: false, max_tokens: 16384 },
      is_configured: true,
    },
    {
      id: 'gpt-4o-mini-tts',
      name: 'GPT-4o Mini TTS',
      provider: 'NavigateLabs / OpenAI',
      description: 'High-fidelity neural speech synthesis',
      capabilities: { text: false, vision: false, audio_tts: true, streaming: false, tool_calling: false, max_tokens: 4096 },
      is_configured: true,
    },
  ];

  // Load models & conversations on startup
  useEffect(() => {
    api.getModels()
      .then((mList) => {
        if (mList && mList.length > 0) {
          setModels(mList);
          const chatModel = mList.find((m) => m.capabilities.text) || mList[0];
          setSelectedModel(chatModel.id);
        } else {
          setModels(FALLBACK_MODELS);
        }
      })
      .catch(() => {
        setModels(FALLBACK_MODELS);
      });

    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const convList = await api.getConversations();
      setConversations(convList);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectConversation = async (id: string) => {
    setActiveConvId(id);
    try {
      const conv = await api.getConversation(id);
      setMessages(conv.messages || []);
      if (conv.model_id) {
        setSelectedModel(conv.model_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setActiveTab('chat');
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
      await loadConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (
    text: string,
    imageUrl?: string,
    useRag?: boolean,
    genAudio?: boolean
  ) => {
    setIsLoading(true);

    // Optimistic user message in UI
    const tempId = `temp-${Date.now()}`;
    const tempUserMsg: Message = {
      id: tempId,
      conversation_id: activeConvId || '',
      role: 'user',
      content: text,
      modality: imageUrl ? 'vision' : 'text',
      tokens_used: 0,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const result = await api.sendChatMessage({
        conversation_id: activeConvId || undefined,
        model_id: selectedModel,
        message: text,
        image_url: imageUrl,
        use_rag: useRag,
        generate_audio: genAudio,
      });

      // Update active conversation ID if newly created
      if (!activeConvId && result.conversation_id) {
        setActiveConvId(result.conversation_id);
        await loadConversations();
      }

      // Extract content correctly from assistant_message or flat content
      const replyContent =
        result.assistant_message?.content ||
        result.content ||
        result.message ||
        '';

      const aiMsg: Message = {
        id: result.assistant_message?.id || `ai-${Date.now()}`,
        conversation_id: result.conversation_id || activeConvId || '',
        role: 'assistant',
        content: replyContent,
        modality: result.audio_url ? 'audio' : 'text',
        tokens_used: result.tokens_used || result.assistant_message?.tokens_used || 0,
        audio_url: result.audio_url || result.assistant_message?.audio_url,
        created_at: result.assistant_message?.created_at || new Date().toISOString(),
      };

      setMessages((prev) => {
        // Replace temporary optimistic message with server-persisted user message if available
        const updated = prev.map((m) =>
          m.id === tempId && result.user_message ? result.user_message : m
        );
        return [...updated, aiMsg];
      });
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        conversation_id: activeConvId || '',
        role: 'assistant',
        content: `Error: ${err.message || 'Unable to complete response. Please check backend connection.'}`,
        modality: 'text',
        tokens_used: 0,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Functional Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Workspace Viewport */}
      <div className="main-viewport">
        {/* Dynamic Living Ambient Moving Background */}
        <AmbientBackground />

        <Header
          activeTab={activeTab}
          models={models}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {activeTab === 'chat' && (
          <ChatView
            messages={messages}
            models={models}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'docs' && <DocumentWorkspace />}

        {activeTab === 'workflows' && (
          <WorkflowWorkspace selectedModel={selectedModel} />
        )}
      </div>
    </div>
  );
};

export default App;

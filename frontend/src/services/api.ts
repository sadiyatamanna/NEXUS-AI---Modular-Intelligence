import { ModelInfo, Conversation, Message, DocumentItem, AgentTaskResponse } from '../types';

export const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export const api = {
  // Health
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  // Auth
  async getCurrentUser() {
    const res = await fetch(`${API_BASE}/auth/me`);
    if (!res.ok) return null;
    return res.json();
  },

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE}/conversations`);
    if (!res.ok) return [];
    return res.json();
  },

  async createConversation(title: string, modelId: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, model_id: modelId }),
    });
    return res.json();
  },

  async getConversation(id: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations/${id}`);
    return res.json();
  },

  async deleteConversation(id: string): Promise<void> {
    await fetch(`${API_BASE}/conversations/${id}`, { method: 'DELETE' });
  },

  // AI Models & Chat
  async getModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${API_BASE}/ai/models`);
    return res.json();
  },

  async sendChatMessage(payload: {
    conversation_id?: string;
    model_id: string;
    message: string;
    image_url?: string;
    use_rag?: boolean;
    generate_audio?: boolean;
  }) {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to complete message');
    }
    return res.json();
  },

  // Documents & RAG
  async getDocuments(): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/documents`);
    if (!res.ok) return [];
    return res.json();
  },

  async uploadDocument(file: File): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Document upload failed');
    }
    return res.json();
  },

  async deleteDocument(id: string): Promise<void> {
    await fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' });
  },

  async queryRag(query: string, modelId?: string) {
    const res = await fetch(`${API_BASE}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, model_id: modelId }),
    });
    return res.json();
  },

  // Agents
  async getAgentTools() {
    const res = await fetch(`${API_BASE}/agents/tools`);
    return res.json();
  },

  async executeAgentTask(task: string, modelId: string, maxSteps = 5): Promise<AgentTaskResponse> {
    const res = await fetch(`${API_BASE}/agents/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, model_id: modelId, max_steps: maxSteps }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Agent execution failed');
    }
    return res.json();
  },

  async getAgentHistory(): Promise<AgentTaskResponse[]> {
    const res = await fetch(`${API_BASE}/agents/history`);
    if (!res.ok) return [];
    return res.json();
  },

  // Image Generation
  async generateImage(prompt: string): Promise<{ prompt: string; image_url: string }> {
    const res = await fetch(`${API_BASE}/ai/image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Image generation failed');
    }
    return res.json();
  },
};


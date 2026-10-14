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
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  },

  async uploadDocument(file: File): Promise<DocumentItem> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        let errorDetail = '';
        try {
          const err = await res.json();
          errorDetail = err.detail;
        } catch {
          errorDetail = `Server error HTTP ${res.status}`;
        }
        throw new Error(errorDetail || 'Document upload failed');
      }
      return res.json();
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message === 'Failed to fetch' || err.message?.includes('NetworkError')) {
        throw new Error(
          'Backend server is offline or unreachable (Failed to fetch). ' +
          'Please ensure the platform backend is running (run "python start_nexus.py" or double-click "run.bat"). ' +
          'If deployed in the cloud, ensure the backend service is healthy.'
        );
      }
      throw err;
    }
  },

  async deleteDocument(id: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Delete document failed:', e);
    }
  },

  async queryRag(query: string, modelId?: string) {
    try {
      const res = await fetch(`${API_BASE}/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, model_id: modelId }),
      });
      if (!res.ok) {
        let errorDetail = '';
        try {
          const err = await res.json();
          errorDetail = err.detail;
        } catch {
          errorDetail = `Query failed HTTP ${res.status}`;
        }
        throw new Error(errorDetail || 'RAG query failed');
      }
      return res.json();
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message === 'Failed to fetch') {
        throw new Error(
          'Backend server is offline or unreachable. Please start the backend with "python start_nexus.py" or "run.bat".'
        );
      }
      throw err;
    }
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


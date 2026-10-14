export interface User {
  id: number;
  email: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface ModelCapability {
  text: boolean;
  vision: boolean;
  audio_tts: boolean;
  streaming: boolean;
  tool_calling: boolean;
  max_tokens: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: ModelCapability;
  is_configured: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modality: 'text' | 'vision' | 'audio';
  tokens_used: number;
  audio_url?: string;
  image_url?: string;
  metadata_json?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: number;
  title: string;
  model_id: string;
  system_prompt?: string;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  file_size: number;
  mime_type: string;
  status: 'uploaded' | 'processing' | 'ready' | 'failed';
  error_message?: string;
  chunk_count: number;
  created_at: string;
}

export interface AgentStep {
  step_number: number;
  action: string;
  tool_name?: string;
  tool_input?: any;
  tool_output?: string;
  thought?: string;
}

export interface AgentTaskResponse {
  id: string;
  agent_name: string;
  task: string;
  status: string;
  steps: AgentStep[];
  result?: string;
  created_at: string;
}

export interface WorkflowTask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  stage?: string;
  category?: string;
  due_date?: string;
  created_at: string;
}

export interface WorkflowReference {
  id: string;
  title: string;
  url: string;
  type: 'link' | 'doc' | 'api' | 'table';
  description?: string;
}

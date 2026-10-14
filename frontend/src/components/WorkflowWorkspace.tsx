import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Sparkles,
  Bot,
  Play,
  Wrench,
  CheckCircle,
  Clock,
  Terminal,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Table as TableIcon,
  Image as ImageIcon,
  BookOpen,
  Filter,
  Check,
  Copy,
  Layers,
  ArrowRight,
  Download
} from 'lucide-react';
import { AgentTaskResponse, WorkflowTask, WorkflowReference } from '../types';
import { api } from '../services/api';

interface WorkflowWorkspaceProps {
  selectedModel?: string;
}

const DEFAULT_TASKS: WorkflowTask[] = [
  {
    id: 'task-1',
    title: 'Verify multimodal image reasoning & OCR pipeline',
    description: 'Ensure uploaded images are inspected, scaled, and interpreted accurately by the model.',
    completed: true,
    priority: 'high',
    category: 'Vision Engine',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'task-2',
    title: 'Ingest and index domain documents into RAG vector store',
    description: 'Upload PDF, Word, or Markdown files and test semantic chunking in Knowledge Base.',
    completed: true,
    priority: 'high',
    category: 'Knowledge Base',
    created_at: new Date(Date.now() - 3000000).toISOString(),
  },
  {
    id: 'task-3',
    title: 'Execute autonomous math AST evaluation tool',
    description: 'Run multi-step bounded agent to calculate mathematical expressions safely.',
    completed: false,
    priority: 'medium',
    category: 'Agent Tools',
    created_at: new Date(Date.now() - 2400000).toISOString(),
  },
  {
    id: 'task-4',
    title: 'Validate multi-tenant database security and session boundaries',
    description: 'Confirm user isolation across SQLite/PostgreSQL schemas and vector indices.',
    completed: false,
    priority: 'high',
    category: 'Security',
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'task-5',
    title: 'Review structured reference tables and API citations',
    description: 'Check markdown table formatting, clickable hyperlinks, and visual topology diagrams.',
    completed: false,
    priority: 'low',
    category: 'Documentation',
    created_at: new Date(Date.now() - 1200000).toISOString(),
  },
];

const SAMPLE_REFERENCES: WorkflowReference[] = [
  {
    id: 'ref-1',
    title: 'FastAPI High-Performance Async Framework Documentation',
    url: 'https://fastapi.tiangolo.com',
    type: 'doc',
    description: 'Official production documentation for async route handlers, dependency injection, and Pydantic v2 schemas.',
  },
  {
    id: 'ref-2',
    title: 'Google Generative Language & Multimodal API Reference',
    url: 'https://ai.google.dev/api',
    type: 'api',
    description: 'Multimodal vision capabilities, structured JSON output formats, and token throughput limits.',
  },
  {
    id: 'ref-3',
    title: 'Qdrant Vector Database Engine & Distance Metrics',
    url: 'https://qdrant.tech/documentation',
    type: 'doc',
    description: 'HNSW indexing, vector filtering, cosine similarity ranking, and multi-tenant payload isolation.',
  },
  {
    id: 'ref-4',
    title: 'OpenAI Chat Completions & Vision Specification (RFC)',
    url: 'https://platform.openai.com/docs/api-reference/chat',
    type: 'link',
    description: 'Standards for multipart user messages, base64 image_url formatting, and token stream deltas.',
  },
];

export const WorkflowWorkspace: React.FC<WorkflowWorkspaceProps> = ({
  selectedModel = 'gemini-2.5-flash',
}) => {
  // Navigation tabs within workflow workspace
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'execution' | 'resources'>('tasks');

  // Task Checklist State
  const [tasks, setTasks] = useState<WorkflowTask[]>(() => {
    try {
      const saved = localStorage.getItem('nexus_workflow_tasks');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_TASKS;
  });

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskCategory, setNewTaskCategory] = useState('Workflow');
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [decomposingGoal, setDecomposingGoal] = useState('');
  const [isDecomposing, setIsDecomposing] = useState(false);

  // Agent Execution State
  const [tools, setTools] = useState<any[]>([]);
  const [history, setHistory] = useState<AgentTaskResponse[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [maxSteps, setMaxSteps] = useState(5);
  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const [activeRun, setActiveRun] = useState<AgentTaskResponse | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  // References, Tables and Visual Media State
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');

  // AI Visual Asset & Diagram Generator State
  const [genPrompt, setGenPrompt] = useState('');
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [genImgError, setGenImgError] = useState<string | null>(null);

  const handleGenerateImage = async (promptToUse?: string) => {
    const text = (promptToUse || genPrompt).trim();
    if (!text || isGeneratingImg) return;
    setIsGeneratingImg(true);
    setGenImgError(null);
    try {
      const res = await api.generateImage(text);
      if (res && res.image_url) {
        setGeneratedImgUrl(res.image_url);
      }
    } catch (err: any) {
      setGenImgError(err.message || 'Image generation failed');
    } finally {
      setIsGeneratingImg(false);
    }
  };

  // Persist tasks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nexus_workflow_tasks', JSON.stringify(tasks));
    } catch (e) {}
  }, [tasks]);

  // Load tools & history
  useEffect(() => {
    api.getAgentTools()
      .then((t) => { if (Array.isArray(t)) setTools(t); })
      .catch(console.error);

    api.getAgentHistory()
      .then((h) => {
        if (Array.isArray(h)) {
          setHistory(h);
          if (h.length > 0 && !activeRun) setActiveRun(h[0]);
        }
      })
      .catch(console.error);
  }, []);

  // Task Handlers
  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: WorkflowTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      completed: false,
      priority: newTaskPriority,
      category: newTaskCategory.trim() || 'General',
      created_at: new Date().toISOString(),
    };

    setTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle('');
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleMarkAllComplete = () => {
    setTasks((prev) => prev.map((t) => ({ ...t, completed: true })));
  };

  const handleClearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !t.completed));
  };

  const handleResetTasks = () => {
    setTasks(DEFAULT_TASKS);
  };

  // AI Task Decomposition
  const handleDecomposeGoal = async (goalToDecompose?: string) => {
    const goal = (goalToDecompose || decomposingGoal).trim();
    if (!goal || isDecomposing) return;

    setIsDecomposing(true);
    try {
      // Prompt model to break down goal into checklist tasks
      const res = await api.sendChatMessage({
        model_id: selectedModel,
        message: `Decompose this engineering objective into 4 to 6 concise, actionable checklist tasks: "${goal}". Provide the response as a bulleted checklist with priorities (High, Medium, Low).`,
      });

      const reply = res.assistant_message?.content || res.content || '';
      // Parse tasks from bullets
      const lines = reply.split('\n');
      const generated: WorkflowTask[] = [];

      lines.forEach((line: string) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.match(/^\d+\.\s/)) {
          let clean = trimmed.replace(/^[-•\d.]+\s*/, '').replace(/\[[ xX]\]\s*/, '');
          let prio: 'low' | 'medium' | 'high' = 'medium';
          if (clean.toLowerCase().includes('high') || clean.toLowerCase().includes('critical')) prio = 'high';
          if (clean.toLowerCase().includes('low') || clean.toLowerCase().includes('optional')) prio = 'low';
          clean = clean.replace(/\((High|Medium|Low)\)/i, '').replace(/\[(High|Medium|Low)\]/i, '').trim();

          if (clean.length > 5 && clean.length < 150) {
            generated.push({
              id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              title: clean,
              completed: false,
              priority: prio,
              category: goal.slice(0, 20),
              created_at: new Date().toISOString(),
            });
          }
        }
      });

      if (generated.length > 0) {
        setTasks((prev) => [...generated, ...prev]);
        setDecomposingGoal('');
      } else {
        // Fallback structured generation
        const fallbackTasks: WorkflowTask[] = [
          {
            id: `task-${Date.now()}-1`,
            title: `Analyze architecture specifications for: ${goal}`,
            completed: false,
            priority: 'high',
            category: 'Architecture',
            created_at: new Date().toISOString(),
          },
          {
            id: `task-${Date.now()}-2`,
            title: `Implement core logic, services, and API endpoints`,
            completed: false,
            priority: 'medium',
            category: 'Implementation',
            created_at: new Date().toISOString(),
          },
          {
            id: `task-${Date.now()}-3`,
            title: `Execute integration tests, telemetry, and boundary validation`,
            completed: false,
            priority: 'high',
            category: 'Testing',
            created_at: new Date().toISOString(),
          },
          {
            id: `task-${Date.now()}-4`,
            title: `Deploy and verify production monitoring`,
            completed: false,
            priority: 'low',
            category: 'DevOps',
            created_at: new Date().toISOString(),
          },
        ];
        setTasks((prev) => [...fallbackTasks, ...prev]);
        setDecomposingGoal('');
      }
    } catch (err: any) {
      console.error('Failed to decompose goal:', err);
    } finally {
      setIsDecomposing(false);
    }
  };

  // Agent Execution
  const handleRunAgentTask = async (taskToRun?: string) => {
    const text = (taskToRun || taskInput).trim();
    if (!text || isRunningAgent) return;

    setIsRunningAgent(true);
    setAgentError(null);
    try {
      const run = await api.executeAgentTask(text, selectedModel, maxSteps);
      setActiveRun(run);
      setHistory((prev) => [run, ...prev.filter((h) => h.id !== run.id)]);
    } catch (err: any) {
      console.error('Agent execution error:', err);
      setAgentError(err.message || 'Agent execution failed. Please verify backend status.');
    } finally {
      setIsRunningAgent(false);
    }
  };

  const copyReferenceUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedRefId(id);
    setTimeout(() => setCopiedRefId(null), 2000);
  };

  // Calculations
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'active') return !t.completed;
    if (taskFilter === 'completed') return t.completed;
    return true;
  });

  // Table Data for Resources
  const sampleTableData = [
    { model: 'Gemini 2.5 Flash', latency: '120ms', context: '1,048,576 tokens', vision: 'Native High-Res', cost: 'Economical' },
    { model: 'GPT-4.1 Nano', latency: '95ms', context: '1,047,576 tokens', vision: 'Multimodal Vision', cost: 'Ultra Low' },
    { model: 'Llama 3 8B Instruct', latency: '140ms', context: '8,192 tokens', vision: 'Text Only', cost: 'Free Open-Weights' },
    { model: 'Mistral 7B Instruct', latency: '135ms', context: '32,000 tokens', vision: 'Text Only', cost: 'Standard' },
  ].filter(
    (row) =>
      !tableSearch ||
      row.model.toLowerCase().includes(tableSearch.toLowerCase()) ||
      row.vision.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="panel-container">
      {/* Header */}
      <div className="panel-header">
        <h1 className="panel-title">Workflows & Task Management</h1>
        <p className="panel-subtitle">
          Decompose engineering objectives into actionable checklists, trigger autonomous tool workflows, and explore grounded tables, references, and visual diagrams.
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--hairline)', paddingBottom: 12, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('tasks')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: activeSubTab === 'tasks' ? '1px solid rgba(255, 231, 118, 0.4)' : '1px solid transparent',
            background: activeSubTab === 'tasks' ? 'rgba(255, 231, 118, 0.1)' : 'rgba(255, 255, 255, 0.03)',
            color: activeSubTab === 'tasks' ? '#ffe776' : '#ccc',
            fontWeight: 600,
            fontSize: '0.86rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <CheckSquare size={16} />
          <span>Interactive Task Checklist ({completedCount}/{totalCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('execution')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: activeSubTab === 'execution' ? '1px solid rgba(120, 208, 205, 0.4)' : '1px solid transparent',
            background: activeSubTab === 'execution' ? 'rgba(120, 208, 205, 0.1)' : 'rgba(255, 255, 255, 0.03)',
            color: activeSubTab === 'execution' ? '#78d0cd' : '#ccc',
            fontWeight: 600,
            fontSize: '0.86rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Bot size={16} />
          <span>Autonomous Tool Execution</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('resources')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: activeSubTab === 'resources' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
            background: activeSubTab === 'resources' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            color: activeSubTab === 'resources' ? '#ffffff' : '#ccc',
            fontWeight: 600,
            fontSize: '0.86rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <TableIcon size={16} />
          <span>References, Tables & Media</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: INTERACTIVE TASK CHECKLIST
         ========================================================================= */}
      {activeSubTab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Progress Overview Card */}
          <div className="card-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.82rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Execution Completion Status
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{progressPercent}% Complete</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 400, color: '#888' }}>
                    ({completedCount} of {totalCount} tasks ticked)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleMarkAllComplete}
                  style={{
                    background: 'rgba(35, 217, 44, 0.12)',
                    border: '1px solid rgba(35, 217, 44, 0.3)',
                    color: '#23d92c',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Check size={13} />
                  <span>Mark All Done</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearCompleted}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--hairline)',
                    color: '#ccc',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear Done
                </button>

                <button
                  type="button"
                  onClick={handleResetTasks}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--hairline)',
                    color: '#888',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title="Reset to default engineering tasks"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="progress-track">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          {/* AI Task Decomposer Card */}
          <div className="card-box" style={{ background: 'linear-gradient(180deg, rgba(255, 231, 118, 0.03) 0%, rgba(18, 18, 18, 0.6) 100%)' }}>
            <h2 style={{ fontSize: '0.96rem', fontWeight: 600, color: '#ffe776', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Sparkles size={17} color="#ffe776" />
              <span>AI Objective Decomposer</span>
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#999', marginBottom: 12 }}>
              Type any high-level objective and Nexus AI will break it down into actionable, checkable checklist tasks with assigned priorities.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleDecomposeGoal();
              }}
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
            >
              <input
                type="text"
                placeholder="e.g. Implement OAuth2 login with session rotation and security rate limiting..."
                value={decomposingGoal}
                onChange={(e) => setDecomposingGoal(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 260,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  color: '#fff',
                  fontSize: '0.88rem',
                }}
              />
              <button
                type="submit"
                disabled={isDecomposing || !decomposingGoal.trim()}
                style={{
                  background: 'var(--grad-solid)',
                  color: '#0c0c0c',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isDecomposing ? (
                  <>
                    <RotateCcw size={14} className="spin" />
                    <span>Decomposing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Generate Tasks</span>
                  </>
                )}
              </button>
            </form>

            {/* Fast Goal Presets */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ fontSize: '0.74rem', color: '#777', alignSelf: 'center' }}>Presets:</span>
              {[
                'Build Production RAG Pipeline',
                'Implement OAuth2 & RBAC Auth',
                'Deploy to AWS with Docker',
                'Run Security & Penetration Audit',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleDecomposeGoal(preset)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 999,
                    padding: '3px 10px',
                    fontSize: '0.74rem',
                    color: '#bbb',
                    cursor: 'pointer',
                  }}
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Task Management & Checklist List */}
          <div className="card-box">
            {/* Top Toolbar: Filters & Quick Add */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff', marginRight: 4 }}>Filter:</span>
                {(['all', 'active', 'completed'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTaskFilter(filter)}
                    style={{
                      background: taskFilter === filter ? 'rgba(255, 231, 118, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      border: taskFilter === filter ? '1px solid rgba(255, 231, 118, 0.4)' : '1px solid var(--hairline)',
                      color: taskFilter === filter ? '#ffe776' : '#888',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: '0.78rem',
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: '0.78rem', color: '#777' }}>
                Showing {filteredTasks.length} tasks
              </div>
            </div>

            {/* Quick Add Inline Form */}
            <form onSubmit={handleAddTask} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Add a new workflow task..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 200,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: '0.84rem',
                }}
              />
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as any)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 6,
                  padding: '7px 8px',
                  color: '#ddd',
                  fontSize: '0.82rem',
                }}
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--hairline)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '7px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Plus size={14} />
                <span>Add Task</span>
              </button>
            </form>

            {/* Tasks List with Checkbox Ticking */}
            {filteredTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#666', fontSize: '0.88rem' }}>
                No tasks match the selected filter.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredTasks.map((t) => (
                  <div key={t.id} className={`task-card ${t.completed ? 'completed' : ''}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      {/* Checkbox Button */}
                      <button
                        type="button"
                        className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                        onClick={() => handleToggleTask(t.id)}
                        aria-label={t.completed ? 'Mark incomplete' : 'Mark completed'}
                        title="Click to tick/untick task completion"
                      >
                        {t.completed ? <CheckSquare size={19} /> : <Square size={19} />}
                      </button>

                      <div style={{ flex: 1 }}>
                        <div className={`task-title ${t.completed ? 'completed' : ''}`}>
                          {t.title}
                        </div>
                        {t.description && (
                          <div style={{ fontSize: '0.76rem', color: '#777', marginTop: 2 }}>
                            {t.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t.category && (
                        <span style={{ fontSize: '0.72rem', color: '#888', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--hairline)' }}>
                          {t.category}
                        </span>
                      )}

                      <span className={`priority-chip priority-${t.priority}`}>
                        {t.priority}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteTask(t.id)}
                        style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                        title="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: AUTONOMOUS TOOL EXECUTION
         ========================================================================= */}
      {activeSubTab === 'execution' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {agentError && (
            <div style={{ background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', padding: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, color: '#ff6b6b', fontSize: '0.88rem' }}>
              <AlertTriangle size={18} />
              <span>{agentError}</span>
            </div>
          )}

          {/* Execution Runner Card */}
          <div className="card-box">
            <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Terminal size={18} color="#78d0cd" />
              <span>Launch Autonomous Multi-Step Agent</span>
            </h2>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Specify objective (e.g. Calculate 25 * (14.5 + 2.5) and verify system platform health)..."
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 260,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  color: '#fff',
                }}
              />
              <button
                type="button"
                onClick={() => handleRunAgentTask()}
                disabled={isRunningAgent || !taskInput.trim()}
                style={{
                  background: 'var(--grad-solid)',
                  color: '#0c0c0c',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 20px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isRunningAgent ? <RotateCcw size={15} className="spin" /> : <Play size={15} />}
                <span>{isRunningAgent ? 'Executing Steps…' : 'Run Agent'}</span>
              </button>
            </div>

            {/* Presets */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                'Calculate 25 * (14.5 + 2.5) using sandboxed AST calculator tool',
                'Inspect system health, database connections, and platform telemetry',
                'Search domain documentation to verify multi-tenant boundaries',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setTaskInput(preset);
                    handleRunAgentTask(preset);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 999,
                    padding: '4px 12px',
                    fontSize: '0.74rem',
                    color: '#bbb',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Active Run Steps Trace Log */}
          {activeRun && (
            <div className="card-box">
              <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Clock size={17} color="#ffe776" />
                <span>Execution Trace & Tool Calls — {activeRun.task}</span>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeRun.steps.map((st) => (
                  <div
                    key={st.step_number}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--hairline)',
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#ffe776', background: 'rgba(255,231,118,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                        Step {st.step_number}: {st.action}
                      </span>
                      {st.tool_name && (
                        <span style={{ fontSize: '0.72rem', color: '#78d0cd', background: 'rgba(120,208,205,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                          Tool: {st.tool_name}
                        </span>
                      )}
                    </div>

                    {st.thought && (
                      <div style={{ fontSize: '0.84rem', color: '#ccc', marginBottom: 6 }}>
                        <em>{st.thought}</em>
                      </div>
                    )}

                    {st.tool_output && (
                      <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#a0e8a0' }}>
                        {st.tool_output}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {activeRun.result && (
                <div style={{ marginTop: 14, padding: 12, background: 'rgba(35, 217, 44, 0.05)', border: '1px solid rgba(35, 217, 44, 0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#23d92c', marginBottom: 4 }}>Synthesized Outcome:</div>
                  <div style={{ fontSize: '0.88rem', color: '#fff' }}>{activeRun.result}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: REFERENCES, TABLES & MEDIA
         ========================================================================= */}
      {activeSubTab === 'resources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Data Tables Card */}
          <div className="card-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TableIcon size={18} color="#ffe776" />
                <span>Model Architecture & Capability Comparison Table</span>
              </h2>

              <input
                type="text"
                placeholder="Search table rows…"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 6,
                  padding: '5px 10px',
                  color: '#fff',
                  fontSize: '0.8rem',
                }}
              />
            </div>

            <div className="markdown-table-wrap">
              <table className="markdown-table">
                <thead>
                  <tr>
                    <th>Model Identifier</th>
                    <th>Latency</th>
                    <th>Context Window</th>
                    <th>Vision Capabilities</th>
                    <th>Cost Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleTableData.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: '#fff' }}>{row.model}</td>
                      <td><span style={{ color: '#23d92c' }}>{row.latency}</span></td>
                      <td>{row.context}</td>
                      <td><span style={{ color: '#78d0cd' }}>{row.vision}</span></td>
                      <td>{row.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Links & Citations Reference Card */}
          <div className="card-box">
            <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <BookOpen size={18} color="#78d0cd" />
              <span>Verified References & Official Citations</span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
              {SAMPLE_REFERENCES.map((ref) => (
                <div
                  key={ref.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="markdown-link"
                        style={{ fontSize: '0.88rem' }}
                      >
                        <span>{ref.title}</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    {ref.description && (
                      <p style={{ fontSize: '0.78rem', color: '#888', marginTop: 4, lineHeight: 1.4 }}>
                        {ref.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '0.7rem', color: '#78d0cd', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {ref.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyReferenceUrl(ref.url, ref.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copiedRefId === ref.id ? '#23d92c' : '#777',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {copiedRefId === ref.id ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedRefId === ref.id ? 'Copied' : 'Copy link'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual Architecture Topology Diagram Card */}
          <div className="card-box">
            <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ImageIcon size={18} color="#ffe776" />
              <span>Visual System Architecture Diagram</span>
            </h2>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--hairline)',
                borderRadius: 10,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              {/* SVG Modular Diagram */}
              <svg viewBox="0 0 760 220" style={{ width: '100%', maxHeight: 220 }}>
                {/* User Input Layer */}
                <rect x="20" y="70" width="140" height="80" rx="8" fill="#181818" stroke="#ffe776" strokeWidth="1.5" />
                <text x="90" y="105" fill="#ffe776" fontSize="13" fontWeight="bold" textAnchor="middle">User Client</text>
                <text x="90" y="125" fill="#888" fontSize="11" textAnchor="middle">Chat, Vision, Audio</text>

                {/* Arrow 1 */}
                <line x1="160" y1="110" x2="220" y2="110" stroke="#78d0cd" strokeWidth="2" strokeDasharray="4" />
                <polygon points="220,106 228,110 220,114" fill="#78d0cd" />

                {/* Gateway Layer */}
                <rect x="230" y="50" width="160" height="120" rx="8" fill="#181818" stroke="#78d0cd" strokeWidth="1.5" />
                <text x="310" y="85" fill="#78d0cd" fontSize="13" fontWeight="bold" textAnchor="middle">NEXUS Core API</text>
                <text x="310" y="105" fill="#aaa" fontSize="11" textAnchor="middle">FastAPI Orchestrator</text>
                <text x="310" y="125" fill="#aaa" fontSize="11" textAnchor="middle">Auth & Tenant Guard</text>
                <text x="310" y="145" fill="#aaa" fontSize="11" textAnchor="middle">Port 8000 (Proxy 5173)</text>

                {/* Arrow 2 */}
                <line x1="390" y1="80" x2="450" y2="60" stroke="#ffe776" strokeWidth="2" />
                <polygon points="450,56 458,60 450,64" fill="#ffe776" />

                <line x1="390" y1="110" x2="450" y2="110" stroke="#78d0cd" strokeWidth="2" />
                <polygon points="450,106 458,110 450,114" fill="#78d0cd" />

                <line x1="390" y1="140" x2="450" y2="160" stroke="#23d92c" strokeWidth="2" />
                <polygon points="450,156 458,160 450,164" fill="#23d92c" />

                {/* AI Providers Layer */}
                <rect x="460" y="20" width="160" height="60" rx="6" fill="#181818" stroke="#ffe776" strokeWidth="1.2" />
                <text x="540" y="45" fill="#ffe776" fontSize="12" fontWeight="bold" textAnchor="middle">NavigateLabs / AI</text>
                <text x="540" y="62" fill="#888" fontSize="10" textAnchor="middle">Gemini 2.5 / GPT-4.1</text>

                {/* RAG Vector Store Layer */}
                <rect x="460" y="90" width="160" height="60" rx="6" fill="#181818" stroke="#78d0cd" strokeWidth="1.2" />
                <text x="540" y="115" fill="#78d0cd" fontSize="12" fontWeight="bold" textAnchor="middle">Qdrant Vector DB</text>
                <text x="540" y="132" fill="#888" fontSize="10" textAnchor="middle">RAG Semantic Search</text>

                {/* SQLite Storage */}
                <rect x="460" y="160" width="160" height="50" rx="6" fill="#181818" stroke="#23d92c" strokeWidth="1.2" />
                <text x="540" y="185" fill="#23d92c" fontSize="12" fontWeight="bold" textAnchor="middle">Relational Database</text>
                <text x="540" y="198" fill="#888" fontSize="10" textAnchor="middle">SQLite / PostgreSQL</text>
              </svg>

              <div style={{ fontSize: '0.8rem', color: '#999', textAlign: 'center' }}>
                End-to-end telemetry diagram illustrating client interaction, FastAPI orchestration gateway, RAG vector indexation, and model adapters.
              </div>
            </div>
          </div>

          {/* AI Visual Asset & Diagram Studio Card */}
          <div className="card-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color="#ffe776" />
                  <span>AI Visual Asset & Diagram Studio</span>
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#888', marginTop: 2 }}>
                  Generate real high-resolution architecture diagrams, technical schematics, and UI visualizations.
                </p>
              </div>

              {/* Preset Quick Chips */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  'RAG Vector Search Flowchart',
                  'FastAPI Microservices Architecture',
                  'Autonomous Agent State Machine',
                  'Isometric Cloud Cluster'
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setGenPrompt(preset);
                      handleGenerateImage(preset);
                    }}
                    disabled={isGeneratingImg}
                    style={{
                      background: 'rgba(255, 231, 118, 0.08)',
                      border: '1px solid rgba(255, 231, 118, 0.25)',
                      borderRadius: 14,
                      padding: '4px 10px',
                      color: '#ffe776',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerateImage();
              }}
              style={{ display: 'flex', gap: 8, marginTop: 10 }}
            >
              <input
                type="text"
                placeholder="Describe your diagram, visual schematic, or graphic asset (e.g. 'Kubernetes cluster topology diagram detailed')..."
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={isGeneratingImg || !genPrompt.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #ffe776, #78d0cd)',
                  color: '#121212',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: isGeneratingImg || !genPrompt.trim() ? 'not-allowed' : 'pointer',
                  opacity: isGeneratingImg || !genPrompt.trim() ? 0.6 : 1,
                }}
              >
                {isGeneratingImg ? (
                  <>
                    <span className="green-dot" />
                    <span>Synthesizing…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Generate Visual</span>
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {genImgError && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255, 68, 68, 0.1)', border: '1px solid rgba(255, 68, 68, 0.3)', borderRadius: 6, color: '#ff6b6b', fontSize: '0.82rem' }}>
                ⚠️ {genImgError}
              </div>
            )}

            {/* Generated Image Showcase */}
            {generatedImgUrl && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.84rem', color: '#ffe776', fontWeight: 600 }}>
                    🎨 Generated Visual Asset
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={generatedImgUrl}
                      download={`nexus_visual_${Date.now()}.jpg`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--hairline)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#fff',
                        fontSize: '0.78rem',
                        textDecoration: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + generatedImgUrl);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--hairline)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#fff',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Copy size={13} />
                      <span>Copy URL</span>
                    </button>
                  </div>
                </div>

                <img
                  src={generatedImgUrl}
                  alt={genPrompt || 'AI Generated Asset'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 480,
                    borderRadius: 8,
                    border: '1px solid rgba(255, 231, 118, 0.2)',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
                    objectFit: 'contain',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

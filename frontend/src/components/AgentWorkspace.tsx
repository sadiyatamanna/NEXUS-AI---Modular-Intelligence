import React, { useState, useEffect } from 'react';
import { Bot, Play, Wrench, CheckCircle, Clock, Terminal, AlertTriangle, RefreshCw, Cpu, Layers } from 'lucide-react';
import { AgentTaskResponse } from '../types';
import { api } from '../services/api';

interface AgentWorkspaceProps {
  selectedModel?: string;
}

export const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({ selectedModel = 'gemini-2.5-flash' }) => {
  const [tools, setTools] = useState<any[]>([]);
  const [history, setHistory] = useState<AgentTaskResponse[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [maxSteps, setMaxSteps] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
  const [activeRun, setActiveRun] = useState<AgentTaskResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadToolsAndHistory = async () => {
    try {
      const toolList = await api.getAgentTools();
      if (Array.isArray(toolList)) {
        setTools(toolList);
      }
    } catch (err) {
      console.error('Failed to load agent tools:', err);
    }

    try {
      const histList = await api.getAgentHistory();
      if (Array.isArray(histList)) {
        setHistory(histList);
        if (histList.length > 0 && !activeRun) {
          setActiveRun(histList[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load agent history:', err);
    }
  };

  useEffect(() => {
    loadToolsAndHistory();
  }, []);

  const handleRunTask = async (taskToRun?: string) => {
    const text = (taskToRun || taskInput).trim();
    if (!text || isRunning) return;

    setIsRunning(true);
    setErrorMessage(null);

    try {
      const run = await api.executeAgentTask(text, selectedModel, maxSteps);
      setActiveRun(run);
      setHistory((prev) => [run, ...prev.filter((h) => h.id !== run.id)]);
    } catch (err: any) {
      console.error('Agent execution error:', err);
      setErrorMessage(err.message || 'Agent execution encountered an error. Please verify backend services.');
    } finally {
      setIsRunning(false);
    }
  };

  const sampleTasks = [
    {
      title: '🧮 Math Evaluation',
      desc: 'Calculate 25 * (14.5 + 2.5)',
      prompt: 'Calculate 25 * (14.5 + 2.5) using the sandboxed math engine and verify the result.',
    },
    {
      title: '🩺 Telemetry Diagnostics',
      desc: 'Inspect system platform health',
      prompt: 'Inspect active system health, database connections, and platform telemetry status.',
    },
    {
      title: '🔍 Architecture Query',
      desc: 'Verify safety boundaries',
      prompt: 'Search domain documentation to verify the multi-tenant security and safety boundaries.',
    },
  ];

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h1 className="panel-title">Autonomous Agent Engine & Tool Execution</h1>
        <p className="panel-subtitle">
          Bounded multi-step autonomous agent execution with sandboxed AST tool invocation, step-by-step trace logging, and live telemetry.
        </p>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div style={{ background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', padding: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, color: '#ff6b6b', fontSize: '0.88rem' }}>
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Top Grid: Objective Composer & Tool Catalog */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Launch Agent Card */}
        <div className="card-box">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Play size={18} color="#ffe776" />
            <span>Launch Agent Workflow</span>
          </h2>

          {/* Quick-Action Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {sampleTasks.map((st, i) => (
              <button
                key={i}
                type="button"
                className="quick-chip"
                onClick={() => {
                  setTaskInput(st.prompt);
                  handleRunTask(st.prompt);
                }}
                title={st.desc}
                style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              >
                {st.title}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleRunTask(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#999', display: 'block', marginBottom: 6 }}>
                Target Objective / Goal:
              </label>
              <textarea
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="e.g. Calculate 25 * (14.5 + 2.5) and verify platform telemetry status…"
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: 'white',
                  fontSize: '0.88rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.78rem', color: '#999', display: 'block', marginBottom: 4 }}>
                  Maximum Steps Bound: <strong style={{ color: '#ffe776' }}>{maxSteps}</strong>
                </label>
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#ffe776' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#aaa', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--hairline)' }}>
                <Cpu size={14} color="#ffe776" />
                <span>{selectedModel}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isRunning || !taskInput.trim()}
              style={{
                background: isRunning ? 'rgba(255,255,255,0.1)' : 'var(--grad-solid)',
                color: isRunning ? '#fff' : '#0c0c0c',
                border: 'none',
                borderRadius: 8,
                padding: '11px 16px',
                fontWeight: 600,
                cursor: isRunning || !taskInput.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: !taskInput.trim() && !isRunning ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {isRunning ? <RefreshCw size={16} className="animate-spin" /> : <Bot size={16} />}
              <span>{isRunning ? 'Executing Agent Loop…' : 'Execute Autonomous Plan'}</span>
            </button>
          </form>
        </div>

        {/* Permitted Tool Catalog */}
        <div className="card-box">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Wrench size={18} color="#78d0cd" />
            <span>Permitted Tool Catalog ({tools.length})</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tools.length === 0 ? (
              <div style={{ color: '#777', fontSize: '0.85rem', padding: '16px 0', textAlign: 'center' }}>
                Loading tool registry…
              </div>
            ) : (
              tools.map((t) => (
                <div
                  key={t.name}
                  onClick={() => setTaskInput(`Use tool '${t.name}' to execute verification task.`)}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                  title="Click to draft a prompt for this tool"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ fontSize: '0.85rem', color: '#ffe776' }}>{t.name}</strong>
                    <span style={{ fontSize: '0.65rem', background: 'rgba(35,217,44,0.1)', color: '#23d92c', padding: '2px 6px', borderRadius: 4 }}>
                      {t.read_only ? 'READ-ONLY' : 'MUTATING'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#999' }}>{t.description}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Active Run Execution Trace */}
      {activeRun && (
        <div className="card-box" style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={18} color="#23d92c" />
              <span>Active Execution Trace: {activeRun.task}</span>
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#23d92c' }}>
              <CheckCircle size={14} />
              <span>{activeRun.status.toUpperCase()} ({activeRun.steps?.length || 0} steps)</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeRun.steps?.map((step, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ffe776', marginBottom: 6 }}>
                  <Clock size={13} />
                  <strong>Step {step.step_number}: {step.action} {step.tool_name ? `(${step.tool_name})` : ''}</strong>
                </div>
                {step.thought && (
                  <div style={{ color: '#ccc', marginBottom: 6 }}>
                    <span style={{ color: '#888' }}>Thought: </span>{step.thought}
                  </div>
                )}
                {step.tool_output && (
                  <div style={{ color: '#86ca8a', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, marginTop: 4 }}>
                    <span style={{ color: '#888' }}>Output: </span>{step.tool_output}
                  </div>
                )}
              </div>
            ))}

            {activeRun.result && (
              <div style={{ background: 'rgba(255,232,120,0.05)', border: '1px solid rgba(255,232,120,0.22)', padding: 16, borderRadius: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <CheckCircle size={15} color="#ffe776" />
                  <strong style={{ color: '#ffe776', fontSize: '0.88rem', letterSpacing: '0.02em' }}>
                    Final Synthesis Report
                  </strong>
                </div>
                <div style={{ color: '#eaeaea', fontSize: '0.86rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {activeRun.result.replace(/###\s*/g, '').replace(/\*\*/g, '')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Execution Run History */}
      {history.length > 0 && (
        <div className="card-box" style={{ marginTop: 8 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Layers size={18} color="#ffe776" />
            <span>Execution Run History ({history.length})</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h) => (
              <div
                key={h.id}
                onClick={() => setActiveRun(h)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: activeRun?.id === h.id ? 'rgba(255,232,120,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${activeRun?.id === h.id ? 'rgba(255,232,120,0.3)' : 'var(--hairline)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bot size={18} color={activeRun?.id === h.id ? '#ffe776' : '#888'} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.88rem', color: '#fff' }}>{h.task}</div>
                    <div style={{ fontSize: '0.74rem', color: '#777' }}>
                      {h.agent_name} • {h.steps?.length || 0} steps • {new Date(h.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#23d92c' }}>
                  <CheckCircle size={13} />
                  <span>{h.status.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

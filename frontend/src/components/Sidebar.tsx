import React, { useEffect, useRef } from 'react';
import { MessageSquare, BookOpen, CheckSquare, Plus, Trash2, X } from 'lucide-react';
import { Conversation } from '../types';

interface SidebarProps {
  activeTab: 'chat' | 'docs' | 'workflows';
  setActiveTab: (tab: 'chat' | 'docs' | 'workflows') => void;
  conversations: Conversation[];
  activeConvId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  conversations,
  activeConvId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isOpen,
  onClose,
}) => {
  const raysRef = useRef<SVGGElement>(null);

  // Generate 24 sunburst rays at runtime
  useEffect(() => {
    if (!raysRef.current) return;
    raysRef.current.innerHTML = '';
    const total = 24;
    const cx = 26, cy = 26;
    const innerR = 10.4, outerR = 22.6;
    const startAngle = -Math.PI / 2;
    const step = (2 * Math.PI) / total;

    for (let i = 0; i < total; i++) {
      const angle = startAngle + i * step;
      const x1 = cx + innerR * Math.cos(angle);
      const y1 = cy + innerR * Math.sin(angle);
      const x2 = cx + outerR * Math.cos(angle);
      const y2 = cy + outerR * Math.sin(angle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      raysRef.current.appendChild(line);
    }
  }, []);

  const handleTabClick = (tab: 'chat' | 'docs' | 'workflows') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      onClose();
    }
  };

  const handleConvClick = (id: string) => {
    onSelectConversation(id);
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      onClose();
    }
  };

  const handleNewClick = () => {
    onNewConversation();
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      onClose();
    }
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open mobile-open' : 'closed'}`}>
        {/* Brand Header */}
        <div className="brand-section">
          <div className="brand-left">
            <svg className="brand-logo-svg" viewBox="0 0 52 52">
              <g ref={raysRef} stroke="#f4f4f4" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="26" cy="26" r="7.4" fill="#fbfbfb" />
            </svg>
            <div className="brand-text">
              <div className="brand-title">
                <span>NEXUS AI</span>
                <span className="brand-badge">PROD</span>
              </div>
              <span className="brand-sub">Modular Intelligence</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle-close"
            onClick={onClose}
            aria-label="Close sidebar"
            title="Close sidebar (Ctrl+B)"
          >
            <X size={17} />
          </button>
        </div>

        {/* Workspace Mode Tabs */}
        <nav className="nav-modes">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => handleTabClick('chat')}
          >
            <MessageSquare size={17} />
            <span>Chat Workspace</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'docs' ? 'active' : ''}`}
            onClick={() => handleTabClick('docs')}
          >
            <BookOpen size={17} />
            <span>Knowledge Base (RAG)</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'workflows' ? 'active' : ''}`}
            onClick={() => handleTabClick('workflows')}
          >
            <CheckSquare size={17} />
            <span>Workflows & Tasks</span>
          </button>
        </nav>

        {/* New Conversation Button */}
        <button
          type="button"
          className="btn-new-chat"
          onClick={handleNewClick}
        >
          <Plus size={16} />
          <span>New Conversation</span>
        </button>

        {/* Conversations History List */}
        <div className="sidebar-section-title">Conversations</div>
        <div className="conversation-list">
          {conversations.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: '#666', padding: '12px 8px', textAlign: 'center' }}>
              No conversations yet
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`conv-item ${c.id === activeConvId ? 'active' : ''}`}
                onClick={() => handleConvClick(c.id)}
              >
                <span className="conv-title">{c.title || 'Untitled Session'}</span>
                <button
                  className="conv-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(c.id);
                  }}
                  title="Delete conversation"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Telemetry Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-status-chip">
            <span className="green-dot" />
            <span>System Operational</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#555' }}>v2.4.0</span>
        </div>
      </aside>
    </>
  );
};

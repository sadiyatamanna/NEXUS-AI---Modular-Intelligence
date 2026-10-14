import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';
import { ModelInfo } from '../types';

interface HeaderProps {
  activeTab: 'chat' | 'docs' | 'workflows';
  models: ModelInfo[];
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  models,
  selectedModel,
  setSelectedModel,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'chat': return 'Chat Workspace';
      case 'docs': return 'Knowledge Base (RAG)';
      case 'workflows': return 'Workflows & Tasks Management';
      default: return 'NEXUS Workspace';
    }
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          type="button"
          className={`btn-sidebar-toggle ${isSidebarOpen ? 'active' : ''}`}
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          title={isSidebarOpen ? "Close sidebar (Ctrl+B)" : "Open sidebar (Ctrl+B)"}
          aria-expanded={isSidebarOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="header-title-badge">
          {getTabTitle()}
        </div>
      </div>

      <div className="header-right">
        {activeTab !== 'docs' && models.length > 0 && (
          <div className="model-selector-wrap">
            <Cpu size={14} color="#ffe776" />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              aria-label="Select active AI model"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="tenant-chip">
          <ShieldCheck size={13} color="#23d92c" />
          <span>Tenant Verified</span>
        </div>
      </div>
    </header>
  );
};

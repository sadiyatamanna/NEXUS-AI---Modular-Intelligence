import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileText, Trash2, Search, CheckCircle, AlertTriangle, BookOpen } from 'lucide-react';
import { DocumentItem } from '../types';
import { api } from '../services/api';

export const DocumentWorkspace: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // RAG query tester state
  const [query, setQuery] = useState('');
  const [ragResult, setRagResult] = useState<{ answer: string; citations: any[] } | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const loadDocuments = async () => {
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getHealth()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
    loadDocuments();
  }, []);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const res = await api.uploadDocument(file);
      setUploadSuccess(`"${file.name}" successfully indexed! (${res.chunk_count || 1} chunks)`);
      await loadDocuments();
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Please check file format.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDocument(id);
      await loadDocuments();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRagSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsQuerying(true);
    try {
      const res = await api.queryRag(query);
      setRagResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h1 className="panel-title">Knowledge Base & Document Intelligence</h1>
        <p className="panel-subtitle">
          Secure document ingestion pipeline with semantic text chunking, vector indexing, and grounded retrieval.
        </p>
      </div>

      {backendOnline === false && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: '0.86rem',
          color: '#fca5a5'
        }}>
          <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
          <div>
            <strong>Backend API is currently offline:</strong> Cannot connect to backend server. 
            To upload files and query the Knowledge Base, please start the backend with <code style={{ color: '#fff', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>python start_nexus.py</code> or double-click <code style={{ color: '#fff', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>run.bat</code>. 
            (If hosted on Netlify, configure <code style={{ color: '#fff', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>VITE_API_BASE_URL</code> in Netlify Environment Variables to point to your deployed backend).
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Upload Card */}
        <div className="card-box">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <UploadCloud size={18} color="#ffe776" />
            <span>Upload Document</span>
          </h2>

          <div
            className="upload-dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              cursor: 'pointer',
              borderColor: isDragging ? '#ffe776' : undefined,
              backgroundColor: isDragging ? 'rgba(255, 231, 118, 0.08)' : undefined,
              transition: 'all 0.2s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.csv,.json,.py,.js,.ts,.html,.css,.png,.jpg,.jpeg,.webp"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              disabled={isUploading}
            />
            <FileText size={32} color={isDragging ? '#ffe776' : '#78d0cd'} />
            <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
              {isUploading ? 'Ingesting and Indexing...' : isDragging ? 'Drop file to ingest now' : 'Click or drop files here'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#888' }}>
              Supports PDF, DOCX, TXT, MD, CSV, JSON, Code & Images (Max 25MB)
            </div>
            <button
              type="button"
              disabled={isUploading}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              style={{
                marginTop: 6,
                padding: '4px 12px',
                fontSize: '0.76rem',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--hairline)',
                color: '#ddd',
                cursor: 'pointer'
              }}
            >
              Browse Files
            </button>
          </div>

          {uploadSuccess && (
            <div style={{ marginTop: 10, color: '#23d92c', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {uploadError && (
            <div style={{ marginTop: 10, color: '#ff6b6b', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Semantic Query Card */}
        <div className="card-box">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Search size={18} color="#78d0cd" />
            <span>Semantic Knowledge Query (RAG)</span>
          </h2>
          <form onSubmit={handleRagSearch} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              type="text"
              placeholder="Ask a question across indexed documents…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--hairline)',
                borderRadius: 8,
                padding: '8px 12px',
                color: 'white',
              }}
            />
            <button
              type="submit"
              disabled={isQuerying || !query.trim()}
              style={{
                background: 'var(--grad-solid)',
                color: '#0c0c0c',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isQuerying ? 'Searching…' : 'Query'}
            </button>
          </form>

          {ragResult && (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, border: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: '0.82rem', color: '#ffe776', fontWeight: 600, marginBottom: 4 }}>Synthesized Answer:</div>
              <p style={{ fontSize: '0.88rem', color: '#eaeaea', lineHeight: 1.45 }}>{ragResult.answer}</p>
              {ragResult.citations && ragResult.citations.length > 0 && (
                <div style={{ marginTop: 8, borderTop: '1px solid var(--hairline)', paddingTop: 6 }}>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Citations ({ragResult.citations.length}):</div>
                  {ragResult.citations.map((c, i) => (
                    <div key={i} style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 2 }}>
                      • {c.filename} (Score: {(c.similarity_score * 100).toFixed(0)}%)
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Indexed Documents Table */}
      <div className="card-box" style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <BookOpen size={18} color="#ffe776" />
          <span>Indexed Corpus ({documents.length})</span>
        </h2>

        {documents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#777', fontSize: '0.88rem' }}>
            No documents indexed yet. Upload a document to start grounding your queries.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={18} color="#78d0cd" />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.88rem', color: '#fff' }}>{doc.title}</div>
                    <div style={{ fontSize: '0.74rem', color: '#777' }}>
                      {doc.chunk_count} chunks • {(doc.file_size / 1024).toFixed(1)} KB • {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', color: '#23d92c' }}>
                    <CheckCircle size={13} />
                    <span>Ready</span>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    style={{ color: '#888', padding: 4, cursor: 'pointer' }}
                    title="Delete document"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import api from '../api';

// ─── Simple markdown renderer (bold + newlines only — no external deps) ───────
const renderMarkdown = (text) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return p.split('\n').map((line, j) => (
      <React.Fragment key={`${i}-${j}`}>
        {j > 0 && <br />}
        {line}
      </React.Fragment>
    ));
  });
};

const ChatAssistant = () => {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Load history when panel opens for the first time
  useEffect(() => {
    if (open && messages.length === 0) {
      loadHistory();
    }
  }, [open]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const res = await api.get('/api/ai/history');
      if (res.data.success && res.data.data.length > 0) {
        setMessages(res.data.data.map(m => ({ role: m.role, text: m.content })));
      } else {
        // Show a welcome message if no history
        setMessages([{
          role: 'assistant',
          text: "Hello! I'm **Nova**, your NexaBank AI assistant. I can help you check your account balances, review recent transactions, and answer any banking questions. How can I help you today? 😊",
        }]);
      }
    } catch {
      setMessages([{
        role: 'assistant',
        text: "Hello! I'm **Nova**, your NexaBank AI assistant. How can I help you today?",
      }]);
    } finally {
      setHistLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    try {
      const res = await api.post('/api/ai/chat', { message: text });
      if (res.data.success) {
        setMessages(prev => [...prev, { role: 'assistant', text: res.data.data.reply }]);
      }
    } catch (err) {
      const errMsg = err.response?.status === 429
        ? "You're sending messages too quickly. Please wait a moment."
        : 'I apologize, I am temporarily unavailable. Please try again shortly.';
      setMessages(prev => [...prev, { role: 'assistant', text: errMsg, isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      await api.delete('/api/ai/chat');
      setMessages([{
        role: 'assistant',
        text: "Chat history cleared. How can I help you?",
      }]);
    } catch { /* silent fail */ }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Floating trigger button ─────────────────────────────────────── */}
      <button
        id="chat-assistant-toggle"
        onClick={() => setOpen(o => !o)}
        style={styles.fab}
        title="Open NexaBank AI Assistant"
      >
        {open ? '✕' : '💬'}
        {!open && <span style={styles.fabBadge}>Nova</span>}
      </button>

      {/* ── Chat panel ─────────────────────────────────────────────────── */}
      {open && (
        <div style={styles.panel} className="fade-in">
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={styles.avatar}>N</div>
              <div>
                <div style={styles.headerTitle}>Nova</div>
                <div style={styles.headerSub}>NexaBank AI Assistant</div>
              </div>
            </div>
            <div style={styles.headerActions}>
              <button style={styles.iconBtn} onClick={clearChat} title="Clear history">🗑</button>
              <button style={styles.iconBtn} onClick={() => setOpen(false)} title="Close">✕</button>
            </div>
          </div>

          {/* Messages */}
          <div style={styles.messages} className="scrollbar-thin">
            {histLoading ? (
              <div style={styles.loadingRow}>
                <div className="spinner spinner-navy" style={{ width: 20, height: 20 }} />
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.bubble,
                    ...(msg.role === 'user' ? styles.userBubble : styles.aiBubble),
                    ...(msg.isError ? styles.errorBubble : {}),
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={styles.bubbleIcon}>N</div>
                  )}
                  <div style={styles.bubbleText}>
                    {renderMarkdown(msg.text)}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div style={{ ...styles.bubble, ...styles.aiBubble }}>
                <div style={styles.bubbleIcon}>N</div>
                <div style={styles.typingDots}>
                  <span style={{ ...styles.dot, animationDelay: '0ms' }} />
                  <span style={{ ...styles.dot, animationDelay: '160ms' }} />
                  <span style={{ ...styles.dot, animationDelay: '320ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={styles.inputArea}>
            <div style={styles.inputWrap}>
              <textarea
                ref={inputRef}
                id="chat-input"
                value={input}
                onChange={e => setInput(e.target.value.slice(0, 500))}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your balance, transactions..."
                style={styles.textarea}
                rows={1}
                disabled={loading}
              />
              <span style={styles.charCount}>{input.length}/500</span>
            </div>
            <button
              id="chat-send-btn"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                ...styles.sendBtn,
                opacity: (!input.trim() || loading) ? 0.5 : 1,
              }}
            >
              ➤
            </button>
          </div>

          <div style={styles.disclaimer}>
            🔒 Responses are AI-generated. Always verify important financial decisions.
          </div>
        </div>
      )}

      {/* Typing animation keyframes */}
      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </>
  );
};

const styles = {
  fab: {
    position: 'fixed',
    bottom: '28px',
    right: '28px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #003087 0%, #001F5A 100%)',
    color: '#FFFFFF',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 6px 24px rgba(0,48,135,0.40)',
    fontSize: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  fabBadge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    background: '#C8962E',
    color: '#FFFFFF',
    fontSize: '9px',
    fontWeight: '800',
    padding: '2px 5px',
    borderRadius: '8px',
    letterSpacing: '0.05em',
  },

  panel: {
    position: 'fixed',
    bottom: '96px',
    right: '28px',
    width: '380px',
    height: '540px',
    background: '#FFFFFF',
    borderRadius: '20px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
    border: '1px solid #DDE3ED',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1999,
  },

  header: {
    background: 'linear-gradient(135deg, #003087 0%, #001F5A 100%)',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.20)',
    border: '2px solid rgba(255,255,255,0.30)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerTitle: { fontSize: '15px', fontWeight: '700', color: '#FFFFFF', lineHeight: 1.2 },
  headerSub: { fontSize: '11px', color: 'rgba(255,255,255,0.65)', marginTop: '1px' },
  headerActions: { display: 'flex', gap: '4px' },
  iconBtn: {
    background: 'rgba(255,255,255,0.12)',
    border: 'none',
    color: '#FFFFFF',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: '#F8FAFC',
  },
  loadingRow: { display: 'flex', justifyContent: 'center', padding: '20px' },

  bubble: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    maxWidth: '88%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiBubble: {
    alignSelf: 'flex-start',
  },
  errorBubble: {},
  bubbleIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #003087, #001F5A)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '800',
    flexShrink: 0,
  },
  bubbleText: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '10px 14px',
    fontSize: '13.5px',
    lineHeight: '1.55',
    color: '#0D1B2E',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  typingDots: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '12px 16px',
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  dot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#003087',
    animation: 'dotBounce 1.2s ease infinite',
  },

  inputArea: {
    padding: '12px 16px',
    borderTop: '1px solid #EEF2F7',
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
    background: '#FFFFFF',
    flexShrink: 0,
  },
  inputWrap: { flex: 1, position: 'relative' },
  textarea: {
    width: '100%',
    border: '1.5px solid #DDE3ED',
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '13.5px',
    fontFamily: 'Inter, sans-serif',
    color: '#0D1B2E',
    resize: 'none',
    outline: 'none',
    lineHeight: 1.5,
    background: '#FAFBFD',
    transition: 'border-color 0.18s',
  },
  charCount: {
    position: 'absolute',
    bottom: '6px',
    right: '8px',
    fontSize: '10px',
    color: '#8A99B0',
  },
  sendBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #003087, #001F5A)',
    color: '#FFFFFF',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.18s ease',
  },
  disclaimer: {
    padding: '8px 16px',
    fontSize: '10px',
    color: '#8A99B0',
    textAlign: 'center',
    background: '#F8FAFC',
    borderTop: '1px solid #EEF2F7',
    flexShrink: 0,
  },
};

export default ChatAssistant;

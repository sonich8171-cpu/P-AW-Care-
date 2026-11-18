import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import {
  createOrOpenConversation,
  sendConversationMessage,
} from '../../lib/firestoreService';
import type { ChatMessage, Conversation } from '../../types/pawcare';

interface FloatingSupportStackProps {
  onRequireAuth: () => void;
}

interface AiChatMsg {
  role: 'user' | 'model';
  text: string;
}

export function FloatingSupportStack({ onRequireAuth }: FloatingSupportStackProps) {
  const { firebaseUser, userProfile, effectiveRole, services } = useAuth();

  const [activeDrawer, setActiveDrawer] = useState<'none' | 'ai' | 'support'>('none');

  // PawCare AI state
  const [aiMessages, setAiMessages] = useState<AiChatMsg[]>([
    {
      role: 'model',
      text: 'Hello! I am PawCare Smart Help. Ask me about our pet-care services in Dehradun, how to add pet profiles, booking statuses, or caregiver verification. (For medical emergencies, please contact a veterinarian directly.)',
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatusError, setAiStatusError] = useState('');

  // Support inbox state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportError, setSupportError] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveDrawer('none');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Load user's support conversations when drawer opens
  useEffect(() => {
    if (activeDrawer !== 'support' || !firebaseUser) return;
    const q = query(
      collection(db, 'conversations'),
      where('customerId', '==', firebaseUser.uid),
      limit(50)
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Conversation, 'id'>),
          }))
          .filter((c) => c.type === 'support');
        list.sort(
          (a, b) => (b.lastMessageAt?.toMillis?.() ?? 0) - (a.lastMessageAt?.toMillis?.() ?? 0)
        );
        setConversations(list);
        if (list.length > 0 && !selectedConvId) {
          setSelectedConvId(list[0].id);
        }
      },
      (err) => {
        setSupportError(err.message);
      }
    );
  }, [activeDrawer, firebaseUser, selectedConvId]);

  useEffect(() => {
    if (activeDrawer !== 'support' || !selectedConvId || !firebaseUser) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'conversations', selectedConvId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    return onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, 'id'>),
        }))
      );
    });
  }, [activeDrawer, selectedConvId, firebaseUser]);

  const handleSendAi = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = aiInput.trim();
    if (!trimmed || aiBusy) return;
    setAiStatusError('');
    const nextHistory = [...aiMessages, { role: 'user' as const, text: trimmed }];
    setAiMessages(nextHistory);
    setAiInput('');
    setAiBusy(true);

    try {
      const resp = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: aiMessages.slice(-6),
          userRole: effectiveRole || 'visitor',
          services: services.map((s) => ({
            name: s.name,
            durationLabel: s.durationLabel,
            customerPriceInr: s.customerPriceInr,
            active: s.active,
          })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAiStatusError(
          data.error || 'PawCare AI is currently unavailable. Please message PawCare Support.'
        );
      } else if (data.reply) {
        setAiMessages((prev) => [...prev, { role: 'model', text: data.reply }]);
      }
    } catch {
      setAiStatusError('Network issue reaching PawCare AI. Please try again.');
    } finally {
      setAiBusy(false);
    }
  };

  const handleCreateSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      onRequireAuth();
      return;
    }
    if (!firebaseUser.emailVerified) {
      setSupportError('Please verify your email before sending support messages.');
      return;
    }
    setSupportError('');
    setSupportBusy(true);
    try {
      const convId = await createOrOpenConversation({
        type: 'support',
        customerId: firebaseUser.uid,
        customerName: userProfile?.fullName || firebaseUser.displayName || 'Customer',
        subject: supportSubject.trim() || 'PawCare Support Request',
        initialMessage: supportMessage.trim(),
        senderId: firebaseUser.uid,
        senderName: userProfile?.fullName || firebaseUser.displayName || 'Customer',
        senderRole: effectiveRole || 'customer',
      });
      setSupportSubject('');
      setSupportMessage('');
      setSelectedConvId(convId);
    } catch (err: unknown) {
      setSupportError(err instanceof Error ? err.message : 'Unable to send support message.');
    } finally {
      setSupportBusy(false);
    }
  };

  const handleReplySupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !selectedConvId || !replyText.trim()) return;
    setSupportBusy(true);
    setSupportError('');
    try {
      await sendConversationMessage({
        conversationId: selectedConvId,
        senderId: firebaseUser.uid,
        senderName: userProfile?.fullName || firebaseUser.displayName || 'Customer',
        senderRole: effectiveRole || 'customer',
        text: replyText.trim(),
      });
      setReplyText('');
    } catch (err: unknown) {
      setSupportError(err instanceof Error ? err.message : 'Failed to send reply.');
    } finally {
      setSupportBusy(false);
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  return (
    <>
      {/* Stacked Floating Buttons */}
      <div className="fixed bottom-20 right-4 lg:bottom-5 lg:right-5 z-40 flex flex-col items-end gap-2.5">
        <button
          type="button"
          onClick={() => setActiveDrawer((d) => (d === 'ai' ? 'none' : 'ai'))}
          aria-label="Ask PawCare AI"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white text-xs sm:text-sm font-semibold shadow-lg hover:shadow-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332] cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#FBBF24]" aria-hidden="true" />
          <span className="whitespace-nowrap">Ask PawCare AI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDrawer((d) => (d === 'support' ? 'none' : 'support'))}
          aria-label="Message Admin"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#FAF8F4] text-[#1A221D] border border-[#C9C3B6] text-xs sm:text-sm font-semibold shadow-lg hover:bg-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332] cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 text-[#1B4332]" aria-hidden="true" />
          <span className="whitespace-nowrap">Message Admin</span>
        </button>
      </div>

      {/* Ask PawCare AI Drawer */}
      {activeDrawer === 'ai' && (
        <div
          className="fixed bottom-36 right-4 lg:bottom-24 lg:right-5 z-50 w-[min(92vw,390px)] h-[min(68vh,500px)] bg-white border border-[#D8D3C8] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Ask PawCare AI Assistant"
        >
          <div className="px-4 py-3.5 bg-[#1B4332] text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FBBF24]" />
              <div>
                <div className="text-sm font-semibold font-display">Ask PawCare AI</div>
                <div className="text-[11px] text-emerald-100">
                  Services, booking &amp; platform guidance
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveDrawer('none')}
              aria-label="Close PawCare AI"
              className="p-1 rounded-lg hover:bg-white/15 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF8F4]">
            {aiMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'ml-auto bg-[#1B4332] text-white'
                    : 'mr-auto bg-white border border-[#E6E2D8] text-[#1A221D]'
                }`}
              >
                {msg.text}
              </div>
            ))}
            {aiBusy && (
              <div className="mr-auto bg-white border border-[#E6E2D8] rounded-2xl px-3.5 py-2.5 text-xs text-[#526057]">
                Thinking...
              </div>
            )}
            {aiStatusError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{aiStatusError}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSendAi} className="p-3 border-t border-[#E6E2D8] bg-white flex gap-2">
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask about services, booking, care..."
              className="flex-1 px-3 py-2 rounded-xl border border-[#D8D3C8] text-xs sm:text-sm focus:outline-2 focus:outline-[#1B4332]"
            />
            <button
              type="submit"
              disabled={aiBusy || !aiInput.trim()}
              aria-label="Send question to PawCare AI"
              className="px-3.5 py-2 rounded-xl bg-[#1B4332] text-white hover:bg-[#143326] disabled:opacity-45 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Message PawCare Support Drawer */}
      {activeDrawer === 'support' && (
        <div
          className="fixed bottom-36 right-4 lg:bottom-24 lg:right-5 z-50 w-[min(92vw,410px)] h-[min(70vh,520px)] bg-white border border-[#D8D3C8] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Message Admin Support"
        >
          <div className="px-4 py-3.5 bg-[#FAF8F4] border-b border-[#E6E2D8] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#1B4332]" />
              <div>
                <div className="text-sm font-semibold font-display text-[#1A221D]">
                  PawCare Support Inbox
                </div>
                <div className="text-[11px] text-[#526057]">
                  Direct conversation with PawCare Admin team
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveDrawer('none')}
              aria-label="Close PawCare Support"
              className="p-1 rounded-lg text-[#526057] hover:bg-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!firebaseUser ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <MessageSquare className="w-8 h-8 text-[#1B4332]" />
              <h3 className="text-base font-semibold text-[#1A221D]">
                Sign in to message PawCare Support
              </h3>
              <p className="text-xs text-[#526057]">
                Your messages and admin replies are stored securely in your account history.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveDrawer('none');
                  onRequireAuth();
                }}
                className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-medium cursor-pointer"
              >
                Sign In / Get Started
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {supportError && (
                <div className="mx-3 mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {supportError}
                </div>
              )}

              {/* Thread Selector */}
              <div className="px-3 py-2 border-b border-[#E6E2D8] flex items-center gap-2 overflow-x-auto bg-white">
                <button
                  type="button"
                  onClick={() => setSelectedConvId(null)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                    !selectedConvId
                      ? 'bg-[#1B4332] text-white'
                      : 'bg-[#FAF8F4] text-[#445249] hover:bg-[#EFECE4]'
                  }`}
                >
                  + New Inquiry
                </button>
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedConvId(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap cursor-pointer ${
                      selectedConvId === c.id
                        ? 'bg-[#E8F3EC] text-[#1B4332] font-semibold'
                        : 'bg-[#FAF8F4] text-[#526057] hover:bg-[#EFECE4]'
                    }`}
                  >
                    {c.subject.slice(0, 22)} · {c.status}
                  </button>
                ))}
              </div>

              {!selectedConvId ? (
                <form
                  onSubmit={handleCreateSupportTicket}
                  className="p-4 space-y-3 flex-1 overflow-y-auto"
                >
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                      placeholder="Booking help, caregiver question, or feedback"
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Message
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Describe how our team can help..."
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] text-xs sm:text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={supportBusy}
                    className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-xs sm:text-sm font-medium hover:bg-[#143326] disabled:opacity-55 cursor-pointer"
                  >
                    {supportBusy ? 'Sending...' : 'Send to PawCare Support'}
                  </button>
                </form>
              ) : (
                <>
                  <div className="px-4 py-2 bg-[#FAF8F4] border-b border-[#E6E2D8] flex items-center justify-between text-xs">
                    <span className="font-medium text-[#1A221D] truncate">
                      {selectedConversation?.subject}
                    </span>
                    <span className="font-mono text-[11px] text-[#526057] uppercase">
                      {selectedConversation?.status}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-[#FAF8F4]">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                          m.senderId === firebaseUser.uid
                            ? 'ml-auto bg-[#1B4332] text-white'
                            : 'mr-auto bg-white border border-[#E6E2D8] text-[#1A221D]'
                        }`}
                      >
                        <div className="text-[10px] opacity-75 mb-0.5">
                          {m.senderName} ({m.senderRole})
                        </div>
                        <div>{m.text}</div>
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={handleReplySupport}
                    className="p-3 border-t border-[#E6E2D8] bg-white flex gap-2"
                  >
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      className="flex-1 px-3 py-2 rounded-xl border border-[#D8D3C8] text-xs sm:text-sm"
                    />
                    <button
                      type="submit"
                      disabled={supportBusy || !replyText.trim()}
                      aria-label="Send support reply"
                      className="px-3.5 py-2 rounded-xl bg-[#1B4332] text-white hover:bg-[#143326] disabled:opacity-45 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

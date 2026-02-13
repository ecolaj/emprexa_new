import React, { useState, useRef, useEffect } from 'react';
import { View, NavProps, ID, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { MentionDropdown } from '../components/MentionDropdown';
import { supabase } from '../utils/supabase';
import { formatMessageTime, formatRelativeTime } from '../utils/timeUtils';
import { renderContent } from '../utils/renderers';

interface Message {
  id: string;
  text: string;
  senderId: number | string;
  time: string;
  createdAt: string;
}

export const Messages: React.FC<NavProps> = ({ navigate, params }) => {
  const { user: authUser, markAsRead, unreadConversations, followedUserIds } = useAuth();
  const currentUser = authUser;

  if (!authUser) return null;

  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [activeUser, setActiveUser] = useState<User | null>(null);

  // Initial setup: resolve active user from params or last conversation
  useEffect(() => {
    const initMessages = async () => {
      if (!authUser) return;

      // 1. Fetch conversations (Unique senders/receivers I've chatted with)
      const { data: convData, error: rpcError } = await supabase
        .rpc('get_user_conversations', { p_user_id: authUser.id });

      let finalConversations = [];
      let targetId = params?.userId;

      if (convData && !rpcError) {
        // Use RPC data
        finalConversations = convData.map((c: any) => ({
          ...c,
          lastMessageTime: c.last_message_time
        }));
      } else {
        // Fallback: Fetch all messages involving me and derive unique users.
        const { data: allMsgs } = await supabase
          .from('messages')
          .select('sender_id, receiver_id, created_at')
          .or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`)
          .order('created_at', { ascending: false });

        const uniqueUserIds = new Map<string, string>(); // userId -> last_created_at
        if (allMsgs) {
          allMsgs.forEach(m => {
            const otherId = m.sender_id === authUser.id ? m.receiver_id : m.sender_id;
            const currentTimestamp = uniqueUserIds.get(otherId);
            if (!currentTimestamp || new Date(m.created_at) > new Date(currentTimestamp)) {
              uniqueUserIds.set(otherId, m.created_at);
            }
          });
        }

        const userIdsArray = Array.from(uniqueUserIds.keys());

        if (targetId && !uniqueUserIds.has(targetId)) {
          userIdsArray.unshift(targetId);
        }

        if (userIdsArray.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIdsArray);
          if (profiles) {
            finalConversations = profiles.map(p => ({
              ...p,
              lastMessageTime: uniqueUserIds.get(p.id)
            })).sort((a, b) => {
              const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
              const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
              return timeB - timeA;
            });
          }
        }
      }

      setConversations(finalConversations);

      // Resolve active user
      if (targetId) {
        const found = finalConversations.find(p => p.id === targetId);
        if (found) {
          setActiveUser(found);
        } else {
          // If not in conversations, fetch it
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', targetId).single();
          if (profile) {
            setActiveUser(profile);
            setConversations(prev => [profile, ...prev]);
          }
        }
      } else if (!activeUser && finalConversations.length > 0) {
        setActiveUser(finalConversations[0]);
      }
      setIsLoading(false);
    };

    initMessages();
  }, [authUser?.id, params?.userId]);

  // Update read status when active user changes
  useEffect(() => {
    if (activeUser?.id && unreadConversations[activeUser.id]) {
      markAsRead(activeUser.id);
    }
  }, [activeUser?.id, unreadConversations, markAsRead]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch Message History
  useEffect(() => {
    const fetchMessages = async () => {
      if (!authUser?.id || !activeUser?.id) return;
      setIsLoading(true);

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${activeUser.id}),and(sender_id.eq.${activeUser.id},receiver_id.eq.${authUser.id})`)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data.map(m => ({
          id: m.id,
          text: m.content,
          senderId: m.sender_id,
          time: formatMessageTime(m.created_at),
          createdAt: m.created_at
        })));
      }
      setIsLoading(false);
    };

    fetchMessages();

    // Potential Realtime Subscription
    const channel = supabase
      .channel(`chat:${activeUser?.id}`) // Use more specific channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${activeUser?.id}` // Only listen for incoming messages from THEM
      }, payload => {
        // If we are currently chatting with the sender
        if (payload.new.receiver_id === authUser?.id) {
          setMessages(prev => {
            // Prevent duplicates if already added optimistically (though here we filter by sender_id=activeUser)
            if (prev.some(msg => msg.id === payload.new.id)) return prev;
            return [...prev, {
              id: payload.new.id,
              text: payload.new.content,
              senderId: payload.new.sender_id,
              time: formatMessageTime(payload.new.created_at),
              createdAt: payload.new.created_at
            }];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser?.id, activeUser?.id]);

  // Mention State
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSuggestedUsers([]);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', authUser?.id)
      .ilike('name', `%${query}%`)
      .limit(10);

    if (profiles) {
      // Prioritize followed users
      const sorted = [...profiles].sort((a, b) => {
        const aFollow = followedUserIds.includes(a.id);
        const bFollow = followedUserIds.includes(b.id);
        if (aFollow && !bFollow) return -1;
        if (!aFollow && bFollow) return 1;
        return 0;
      });
      setSuggestedUsers(sorted);
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);

    const cursor = textareaRef.current?.selectionStart || 0;
    const lastAtIndex = text.lastIndexOf('@', cursor - 1);

    if (lastAtIndex !== -1) {
      const query = text.slice(lastAtIndex + 1, cursor);
      if (!query.includes(' ') && !query.includes('\n')) {
        // Use suggestedUsers if they were recently fetched, or just filter conversations
        const filtered = conversations
          .filter(u => u.name.toLowerCase().replace(/\s/g, '').includes(query.toLowerCase()))
          .slice(0, 5);

        setMentionSuggestions(filtered);
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setMentionPosition({ top: rect.top - 200, left: rect.left });
        }
        return;
      }
    }
    setMentionSuggestions([]);
  };

  const handleSelectMention = (user: User) => {
    const cursor = textareaRef.current?.selectionStart || 0;
    const lastAtIndex = inputText.lastIndexOf('@', cursor - 1);
    const username = user.name.replace(/\s/g, '');

    const newText = inputText.slice(0, lastAtIndex) + `@${username} ` + inputText.slice(cursor);
    setInputText(newText);
    setMentionSuggestions([]);
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectMention(mentionSuggestions[activeMentionIndex]);
      } else if (e.key === 'Escape') {
        setMentionSuggestions([]);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderBadge = (plan: string) => {
    switch (plan) {
      case 'basic': return <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Basic</span>;
      case 'pro': return <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1"><span className="material-symbols-outlined text-[10px] filled">verified</span> Pro</span>;
      case 'enterprise': return <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1"><span className="material-symbols-outlined text-[10px] filled">verified_user</span> Enterprise</span>;
      default: return null;
    }
  };

  const formatTime = (date: Date) => {
    return formatMessageTime(date);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !authUser?.id || !activeUser?.id) return;

    const textToSend = inputText;
    setInputText('');

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      text: textToSend,
      senderId: authUser.id,
      time: formatMessageTime(new Date()),
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { data, error } = await supabase
      .from('messages')
      .insert([{
        sender_id: authUser.id,
        receiver_id: activeUser.id,
        content: textToSend,
        read: false
      }])
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      alert('Error al enviar el mensaje: ' + error.message);
      // Remove the optimistic message if it failed
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInputText(textToSend); // Restore text on error
    } else if (data) {
      // Replace temp message with real one from DB (to get correct ID/Timestamp)
      setMessages(prev => prev.map(m => m.id === tempId ? {
        id: data.id,
        text: data.content,
        senderId: data.sender_id,
        time: formatMessageTime(data.created_at),
        createdAt: data.created_at
      } : m));
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* List */}
      <div className={`w-full md:w-80 border-r border-slate-200 bg-white flex-col ${!activeUser ? 'flex' : 'hidden md:flex'}`}>
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400 material-symbols-outlined text-sm">search</span>
            <input
              className="w-full bg-slate-50 rounded-lg py-2 pl-9 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary"
              placeholder="Buscar usuarios..."
              value={searchQuery}
              onChange={(e) => handleSearchUsers(e.target.value)}
            />
            {suggestedUsers.length > 0 && (
              <div className="absolute top-full left-0 w-full bg-white border border-slate-200 mt-1 rounded-lg shadow-xl z-50 overflow-hidden">
                {suggestedUsers.map(u => (
                  <div
                    key={u.id}
                    className="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 border-b border-slate-50 last:border-0"
                    onClick={() => {
                      setActiveUser(u);
                      if (!conversations.some(c => c.id === u.id)) {
                        setConversations([u, ...conversations]);
                      }
                      setSuggestedUsers([]);
                      setSearchQuery('');
                    }}
                  >
                    <div className="size-8 rounded-full bg-cover bg-center" style={{ backgroundImage: `url("${u.avatar}")` }}></div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{u.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{u.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map(u => {
            const isActive = activeUser?.id === u.id;
            const unreadCount = unreadConversations[u.id] || 0;
            return (
              <div
                key={u.id}
                className={`p-3 cursor-pointer border-l-4 transition-colors ${isActive ? 'bg-primary/5 border-primary' : 'hover:bg-slate-50 border-transparent'}`}
                onClick={() => setActiveUser(u)}
              >
                <div className="flex gap-3">
                  <div className="size-12 rounded-full bg-cover bg-center shrink-0 relative" style={{ backgroundImage: `url("${u.avatar}")` }}>
                    <div className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-white rounded-full"></div>
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 size-5 bg-red-500 border-2 border-white rounded-full text-white text-[8px] flex items-center justify-center font-bold animate-bounce">
                        {unreadCount}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className={`font-bold text-sm truncate ${unreadCount > 0 ? 'text-slate-900' : 'text-slate-700'}`}>{u.name}</span>
                      <span className="text-[10px] text-slate-400">{u.lastMessageTime ? formatRelativeTime(u.lastMessageTime) : ''}</span>
                    </div>
                    <p className={`text-xs truncate ${unreadCount > 0 ? 'text-black font-bold' : 'text-slate-500'}`}>
                      {unreadCount > 0 ? 'Mensaje nuevo...' : 'Haz clic para chatear'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex-col bg-slate-50 relative ${!activeUser ? 'hidden md:flex' : 'flex'}`}>
        {!activeUser ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
            <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl text-primary">chat_bubble</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Tus Mensajes</h3>
            <p className="text-slate-500 max-w-xs">Selecciona una conversación o busca un usuario para empezar a chatear.</p>
          </div>
        ) : (
          <>
            <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveUser(null)}
                  className="md:hidden p-1 mr-1 text-slate-500 hover:text-slate-700"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(View.PROFILE, { userId: activeUser.id })}>
                  <div className="size-10 rounded-full bg-cover bg-center" style={{ backgroundImage: `url("${activeUser.avatar}")` }}></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900">{activeUser.name}</h3>
                      {renderBadge(activeUser.plan || 'free')}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{activeUser.role}</p>
                  </div>
                </div>
              </div>

            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4 flex flex-col">
              {messages.map((msg, index) => {
                const isMe = msg.senderId === currentUser?.id;
                const prevMsg = messages[index - 1];
                const msgDate = new Date(msg.createdAt).toLocaleDateString();
                const prevMsgDate = prevMsg ? new Date(prevMsg.createdAt).toLocaleDateString() : null;
                const showDivider = msgDate !== prevMsgDate;

                return (
                  <React.Fragment key={msg.id}>
                    {showDivider && (
                      <div className="flex justify-center my-4">
                        <span className="bg-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                          {new Date(msg.createdAt).toDateString() === new Date().toDateString() ? 'Hoy' : msgDate}
                        </span>
                      </div>
                    )}
                    <div className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="size-8 rounded-full bg-cover bg-center shrink-0 mt-auto mb-5" style={{ backgroundImage: `url("${isMe ? currentUser?.avatar : activeUser.avatar}")` }}></div>

                      <div className="flex flex-col max-w-[75%] gap-1">
                        <div className={`p-4 rounded-2xl shadow-sm text-sm border whitespace-pre-wrap ${isMe ? 'bg-primary text-white rounded-br-none border-primary' : 'bg-white text-slate-800 rounded-bl-none border-slate-200'}`}>
                          <p>{renderContent(msg.text, navigate)}</p>
                        </div>
                        <span className={`text-[10px] text-slate-400 font-bold px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          {msg.time}
                        </span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <div className="max-w-4xl mx-auto flex gap-3 items-end">

                <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 px-4 py-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all relative">
                  <textarea
                    ref={textareaRef}
                    className="w-full bg-transparent text-sm outline-none resize-none pt-1 overflow-y-auto max-h-32 no-scrollbar"
                    placeholder={`Mensaje a ${activeUser.name}...`}
                    rows={1}
                    value={inputText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                  <MentionDropdown
                    suggestions={mentionSuggestions}
                    onSelect={handleSelectMention}
                    position={mentionPosition}
                    activeIndex={activeMentionIndex}
                  />
                </div>
                <button
                  onClick={handleSend}
                  className={`mb-2.5 transition-all p-1.5 rounded-full ${inputText.trim() ? 'bg-primary text-white shadow-md hover:scale-105 active:scale-95' : 'text-slate-300'}`}
                  disabled={!inputText.trim()}
                >
                  <span className="material-symbols-outlined filled">send</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import { getAssetUrl } from '../utils/assetHelper';

import DarkModeToggle from '../components/DarkModeToggle';
import { Send, Search, UserPlus, ShieldAlert, ArrowLeft, MessageSquare, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@radix-ui/react-dialog';
import { toast } from 'sonner';

interface Conversation {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string;
  last_message: string;
  last_message_time: string;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  media_path?: string;
  media_type?: string;
  created_at: string;
  sender_username: string;
  receiver_username: string;
}

export default function Messages() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeChatUser, setActiveChatUser] = useState<Conversation | null>(null);
  const [msgText, setMsgText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Search user to DM
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // DM safety block
  const [dmBlock, setDmBlock] = useState<{
    violation_type: string;
    reason: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch active conversations
  const { data: conversations = [], refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      const res = await api.get(`/api/messages/conversations?user_id=${user?.id}`);
      return res.data;
    },
    enabled: !!user,
  });

  // Fetch chat history
  const { data: chatMessages = [], refetch: refetchChatHistory } = useQuery<Message[]>({
    queryKey: ['chat-history', activeChatUser?.id, user?.id],
    queryFn: async () => {
      if (!activeChatUser) return [];
      const res = await api.get(`/api/messages/${activeChatUser.id}?current_user_id=${user?.id}`);
      return res.data;
    },
    enabled: !!activeChatUser && !!user,
  });

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Polling chat history for simulated real-time updates
  useEffect(() => {
    if (!activeChatUser) return;
    const interval = setInterval(() => {
      refetchChatHistory();
      refetchConversations();
    }, 3000);
    return () => clearInterval(interval);
  }, [activeChatUser, refetchChatHistory, refetchConversations]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChatUser || !msgText.trim()) return;

    setIsSending(true);
    setDmBlock(null);

    try {
      const res = await api.post('/api/messages', {
        sender_id: user.id,
        receiver_id: activeChatUser.id,
        content: msgText
      });

      if (res.status === 200) {
        setMsgText('');
        refetchChatHistory();
        refetchConversations();
      }
    } catch (err: any) {
      console.error("DM send error", err);
      if (err.response && err.response.status === 400) {
        const detail = err.response.data.detail;
        if (detail && detail.error === "Security Blocked") {
          setDmBlock({
            violation_type: detail.violation_type,
            reason: detail.reason
          });
          toast.error(`Security Blocked: Direct Message rejected.`);
        } else {
          toast.error(err.response.data.detail || "Error sending message.");
        }
      } else {
        toast.error("Failed to send message.");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      // Find matching users
      const res = await api.get(`/api/posts?search_query=${encodeURIComponent(searchQuery)}`);
      const usersMap: Record<number, any> = {};
      
      res.data.forEach((p: any) => {
        if (p.user_id !== user?.id) {
          usersMap[p.user_id] = {
            id: p.user_id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url
          };
        }
      });
      
      setSearchResults(Object.values(usersMap));
    } catch (e) {
      console.error("Error searching users for DM", e);
    }
  };

  const startNewConversation = (targetUser: any) => {
    const convoUser: Conversation = {
      id: targetUser.id,
      username: targetUser.username,
      display_name: targetUser.display_name,
      avatar_url: targetUser.avatar_url,
      last_message: '',
      last_message_time: ''
    };
    setActiveChatUser(convoUser);
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    refetchChatHistory();
  };

  return (
    <div className="min-h-screen bg-cream-light dark:bg-darkbg-main transition-colors flex justify-center">
      <div className="w-full max-w-[1200px] flex">
        {/* Left Nav */}
        <Sidebar onOpenNewPostModal={() => {}} />

        {/* Messaging Layout Panel */}
        <main className="flex-grow min-h-screen border-r border-fine-light dark:border-fine-dark flex transition-colors">
          {/* DM Sidebar - Conversations List */}
          <div className={`w-80 border-r border-fine-light dark:border-fine-dark flex flex-col flex-shrink-0 bg-cream-light dark:bg-darkbg-main ${activeChatUser ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-fine-light dark:border-fine-dark flex items-center justify-between">
              <h1 className="font-serif font-black text-xl text-ink-dark dark:text-ink-light">Messages</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 rounded-full hover:bg-cream-dark dark:hover:bg-darkbg-pill text-slate-muted"
                  title="New chat"
                >
                  <UserPlus className="h-4.5 w-4.5" />
                </button>
                <DarkModeToggle />
              </div>
            </div>

            {/* Conversations list container */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="py-20 px-4 text-center">
                  <MessageSquare className="h-8 w-8 text-slate-muted mx-auto opacity-40 mb-2" />
                  <span className="font-serif font-bold text-sm text-ink-dark dark:text-ink-light">No messages yet</span>
                  <p className="text-xs text-slate-muted mt-1">Start a conversation with recommended users!</p>
                </div>
              ) : (
                conversations.map((convo) => {
                  const isActive = activeChatUser?.id === convo.id;
                  return (
                    <div
                      key={convo.id}
                      onClick={() => {
                        setActiveChatUser(convo);
                        setDmBlock(null);
                      }}
                      className={`flex items-center gap-3 p-4 border-b border-fine-light/40 dark:border-fine-dark/40 cursor-pointer text-left transition-colors ${
                        isActive
                          ? 'bg-cream-dark dark:bg-darkbg-pill font-medium'
                          : 'hover:bg-cream-dark/30 dark:hover:bg-darkbg-pill/20'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="h-10 w-10 rounded-full bg-cream-dark dark:bg-darkbg-pill overflow-hidden flex items-center justify-center border border-fine-light flex-shrink-0">
                        {convo.avatar_url ? (
                          <img src={getAssetUrl(convo.avatar_url)} alt={convo.username} className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-serif font-bold text-slate-muted uppercase text-sm">{convo.username[0]}</span>
                        )}
                      </div>
                      
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="font-semibold text-xs text-ink-dark dark:text-ink-light truncate">{convo.display_name}</span>
                          <span className="text-[0.65rem] text-slate-muted">
                            {convo.last_message_time && new Date(convo.last_message_time.replace(" ", "T")).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-muted truncate pr-2">{convo.last_message || 'Start chatting...'}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* DM Active Chat Panel */}
          <div className={`flex-1 flex flex-col bg-cream-light dark:bg-darkbg-main transition-colors ${activeChatUser ? 'flex' : 'hidden md:flex'}`}>
            {activeChatUser ? (
              <div className="flex-grow flex flex-col h-screen">
                {/* Chat Header */}
                <div className="p-4 border-b border-fine-light dark:border-fine-dark flex items-center gap-3 bg-cream-light/80 dark:bg-darkbg-main/80 backdrop-blur-md sticky top-0 z-10 transition-colors">
                  <button
                    onClick={() => setActiveChatUser(null)}
                    className="p-1 rounded-full hover:bg-cream-dark dark:hover:bg-darkbg-pill text-slate-muted md:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  {/* Chat Avatar */}
                  <div className="h-9 w-9 rounded-full bg-cream-dark dark:bg-darkbg-pill overflow-hidden flex items-center justify-center border border-fine-light flex-shrink-0">
                    {activeChatUser.avatar_url ? (
                      <img src={getAssetUrl(activeChatUser.avatar_url)} alt={activeChatUser.username} className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-serif font-bold text-slate-muted uppercase text-sm">{activeChatUser.username[0]}</span>
                    )}
                  </div>
                  {/* Chat Info */}
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-sm text-ink-dark dark:text-ink-light">{activeChatUser.display_name}</span>
                    <span className="text-[0.65rem] text-slate-muted">@{activeChatUser.username}</span>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {chatMessages.length === 0 ? (
                    <div className="py-20 text-center text-slate-muted italic text-xs">This is the start of your message history.</div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isOutgoing = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-left ${
                            isOutgoing
                              ? 'self-end bg-ink-dark text-cream-light dark:bg-ink-light dark:text-darkbg-main rounded-tr-none'
                              : 'self-start bg-cream-dark dark:bg-darkbg-pill text-ink-dark dark:text-ink-light rounded-tl-none border border-fine-light dark:border-fine-dark'
                          }`}
                        >
                          <div>{msg.content}</div>
                          <div className={`text-[0.6rem] mt-1 text-right ${isOutgoing ? 'opacity-85 text-cream-dark' : 'text-slate-muted'}`}>
                            {new Date(msg.created_at.replace(" ", "T")).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Footer compose box */}
                <div className="p-4 border-t border-fine-light dark:border-fine-dark bg-cream-light dark:bg-darkbg-main transition-colors flex flex-col gap-2">
                  {dmBlock && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex flex-col gap-1 text-xs text-left">
                      <div className="flex items-center gap-1 font-bold">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>Blocked Direct Message: {dmBlock.violation_type}</span>
                      </div>
                      <span>{dmBlock.reason}</span>
                    </div>
                  )}
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={msgText}
                      onChange={(e) => {
                        setMsgText(e.target.value);
                        if (dmBlock) setDmBlock(null);
                      }}
                      className="flex-grow bg-cream-dark/40 dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark rounded-full py-2 px-4 focus:outline-none placeholder-slate-muted text-sm text-ink-dark dark:text-ink-light"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !msgText.trim()}
                      className="p-2.5 rounded-full bg-ink-dark dark:bg-ink-light text-cream-light dark:text-darkbg-main disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-cream-light dark:bg-darkbg-main">
                <MessageSquare className="h-10 w-10 text-slate-muted mb-2 opacity-50" />
                <span className="font-serif font-bold text-lg text-ink-dark dark:text-ink-light">Choose a Chat</span>
                <p className="text-sm text-slate-muted mt-1">Select an active conversation or click new chat to contact another user.</p>
              </div>
            )}
          </div>
        </main>

        {/* New Chat User Dialog Search */}
        {isSearchOpen && (
          <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <DialogContent className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-cream-light dark:bg-darkbg-card border border-fine-light dark:border-fine-dark w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative p-6">
                <div className="flex items-center justify-between pb-3 border-b border-fine-light dark:border-fine-dark">
                  <DialogTitle className="font-serif font-bold text-lg text-ink-dark dark:text-ink-light font-serif">New Message</DialogTitle>
                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="p-1 rounded-full hover:bg-cream-dark dark:hover:bg-darkbg-pill text-slate-muted"
                  >
                    <X className="h-5 w-5 transform rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleSearchUsers} className="mt-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="Search by username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-grow bg-cream-dark/40 dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark rounded-full py-1.5 px-3 text-sm focus:outline-none placeholder-slate-muted text-ink-dark dark:text-ink-light"
                  />
                  <button
                    type="submit"
                    className="text-xs px-4 py-2 bg-ink-dark dark:bg-ink-light text-cream-light dark:text-darkbg-main font-bold rounded-full"
                  >
                    Find
                  </button>
                </form>

                <div className="mt-4 flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <span className="text-xs text-slate-muted italic py-4">Search for users above (type names like 'iris' or 'mateo').</span>
                  ) : (
                    searchResults.map(targetUser => (
                      <div
                        key={targetUser.id}
                        onClick={() => startNewConversation(targetUser)}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-cream-dark dark:hover:bg-darkbg-pill cursor-pointer text-left border border-transparent hover:border-fine-light dark:hover:border-fine-dark"
                      >
                        <div className="h-8 w-8 rounded-full bg-cream-dark overflow-hidden flex items-center justify-center border border-fine-light">
                          {targetUser.avatar_url ? (
                            <img src={getAssetUrl(targetUser.avatar_url)} alt={targetUser.username} className="h-full w-full object-cover" />
                          ) : (
                            <span className="font-serif font-bold text-slate-muted text-xs uppercase">{targetUser.username[0]}</span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-ink-dark dark:text-ink-light">{targetUser.display_name}</span>
                          <span className="text-[0.65rem] text-slate-muted">@{targetUser.username}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import DarkModeToggle from '../components/DarkModeToggle';
import { Heart, MessageSquare, UserPlus, AtSign, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: number;
  user_id: number;
  type: 'like' | 'reply' | 'follow' | 'mention';
  sender_id: number;
  sender_username: string;
  sender_display_name: string;
  sender_avatar_url?: string;
  post_id?: number;
  post_content?: string;
  is_read: number;
  created_at: string;
}

export default function Notifications() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const res = await api.get(`/api/notifications?user_id=${user?.id}`);
      return res.data;
    },
    enabled: !!user,
  });

  // Mark all as read on mount
  useEffect(() => {
    if (!user) return;
    api.post(`/api/notifications/read?user_id=${user.id}`)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .catch(err => console.error("Error marking notifications read", err));
  }, [user, queryClient]);

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="h-4.5 w-4.5 text-red-500 fill-current" />;
      case 'reply':
        return <MessageSquare className="h-4.5 w-4.5 text-blue-500" />;
      case 'follow':
        return <UserPlus className="h-4.5 w-4.5 text-green-500" />;
      case 'mention':
        return <AtSign className="h-4.5 w-4.5 text-purple-500" />;
      default:
        return <Bell className="h-4.5 w-4.5 text-slate-muted" />;
    }
  };

  const formatNotifText = (notif: Notification) => {
    const name = `@${notif.sender_username}`;
    switch (notif.type) {
      case 'like':
        return <span><strong>{name}</strong> liked your post {notif.post_content && `"${notif.post_content.substring(0, 30)}..."`}</span>;
      case 'reply':
        return <span><strong>{name}</strong> replied to your post {notif.post_content && `"${notif.post_content.substring(0, 30)}..."`}</span>;
      case 'follow':
        return <span><strong>{name}</strong> followed you</span>;
      case 'mention':
        return <span><strong>{name}</strong> mentioned you in a post</span>;
      default:
        return <span>Interaction from <strong>{name}</strong></span>;
    }
  };

  return (
    <div className="min-h-screen bg-cream-light dark:bg-darkbg-main transition-colors flex justify-center">
      <div className="w-full max-w-[1200px] flex">
        {/* Left Nav */}
        <Sidebar onOpenNewPostModal={() => {}} />

        {/* Middle Column Notifications */}
        <main className="flex-1 min-h-screen border-r border-fine-light dark:border-fine-dark flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-cream-light/80 dark:bg-darkbg-main/80 backdrop-blur-md z-10 px-5 py-4 border-b border-fine-light dark:border-fine-dark flex items-center justify-between transition-colors">
            <h1 className="font-serif font-black text-2xl text-ink-dark dark:text-ink-light">Notifications</h1>
            <div className="flex items-center gap-3">
              <span className="bg-cream-dark dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark text-[0.7rem] font-bold px-3 py-1 rounded-full text-slate-muted dark:text-slate-mutedDark flex items-center gap-1 uppercase select-none tracking-wider">
                🛡️ Moderated
              </span>
              <DarkModeToggle />
            </div>
          </div>

          {/* List */}
          <div className="flex-grow flex flex-col bg-cream-light dark:bg-darkbg-main transition-colors">
            {isLoading ? (
              <div className="py-20 text-center text-slate-muted">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="py-24 px-6 text-center">
                <Bell className="h-10 w-10 text-slate-muted mx-auto mb-2 opacity-50" />
                <span className="font-serif font-bold text-lg text-ink-dark dark:text-ink-light">Quiet in here</span>
                <p className="text-sm text-slate-muted mt-1">Interactions, follows, and mentions will appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => notif.post_id && navigate(`/home`)} // navigate to home/post
                    className={`flex items-start gap-4 p-4 border-b border-fine-light dark:border-fine-dark hover:bg-cream-dark/20 dark:hover:bg-darkbg-pill/10 cursor-pointer transition-colors text-left ${
                      notif.is_read === 0 ? 'bg-accent-warm/5 dark:bg-accent-warm/5 font-medium' : ''
                    }`}
                  >
                    {/* Icon wrapper */}
                    <div className="mt-1 flex-shrink-0">
                      {getNotifIcon(notif.type)}
                    </div>

                    {/* Avatar */}
                    <div
                      className="h-8 w-8 rounded-full bg-cream-dark dark:bg-darkbg-pill overflow-hidden flex items-center justify-center border border-fine-light flex-shrink-0 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${notif.sender_username}`);
                      }}
                    >
                      {notif.sender_avatar_url ? (
                        <img src={notif.sender_avatar_url.startsWith('http') ? notif.sender_avatar_url : `http://127.0.0.1:8000${notif.sender_avatar_url}`} alt={notif.sender_username} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-serif font-bold text-slate-muted text-xs uppercase">{notif.sender_username[0]}</span>
                      )}
                    </div>

                    {/* Text Details */}
                    <div className="flex-1 flex flex-col text-sm text-ink-dark dark:text-ink-light">
                      <div>{formatNotifText(notif)}</div>
                      <span className="text-[0.7rem] text-slate-muted mt-1">
                        {new Date(notif.created_at.replace(" ", "T")).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar */}
        <RightPanel />
      </div>
    </div>
  );
}

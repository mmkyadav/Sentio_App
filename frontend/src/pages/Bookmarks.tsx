import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import PostCard, { Post } from '../components/PostCard';
import DarkModeToggle from '../components/DarkModeToggle';
import { Bookmark } from 'lucide-react';

export default function Bookmarks() {
  const { user } = useAuthStore();
  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>([]);

  useEffect(() => {
    // Get bookmarks from localStorage
    const saved = localStorage.getItem('sentio_bookmarks') || '[]';
    try {
      setBookmarkedIds(JSON.parse(saved));
    } catch (e) {
      setBookmarkedIds([]);
    }
  }, []);

  // Fetch all posts to filter bookmarks
  const { data: posts = [], isLoading, refetch } = useQuery<Post[]>({
    queryKey: ['bookmarks-feed', user?.id],
    queryFn: async () => {
      const res = await api.get(`/api/posts?current_user_id=${user?.id}`);
      return res.data;
    },
    enabled: !!user,
  });

  const bookmarkedPosts = posts.filter(p => bookmarkedIds.includes(p.id));

  return (
    <div className="min-h-screen bg-cream-light dark:bg-darkbg-main transition-colors flex justify-center">
      <div className="w-full max-w-[1200px] flex">
        {/* Left Nav */}
        <Sidebar onOpenNewPostModal={() => {}} />

        {/* Middle Column Bookmarks */}
        <main className="flex-1 min-h-screen border-r border-fine-light dark:border-fine-dark flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-cream-light/80 dark:bg-darkbg-main/80 backdrop-blur-md z-10 px-5 py-4 border-b border-fine-light dark:border-fine-dark flex items-center justify-between transition-colors">
            <h1 className="font-serif font-black text-2xl text-ink-dark dark:text-ink-light">Bookmarks</h1>
            <div className="flex items-center gap-3">
              <span className="bg-cream-dark dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark text-[0.7rem] font-bold px-3 py-1 rounded-full text-slate-muted dark:text-slate-mutedDark flex items-center gap-1 uppercase select-none tracking-wider">
                🛡️ Moderated
              </span>
              <DarkModeToggle />
            </div>
          </div>

          {/* Bookmarks feed list */}
          <div className="flex-grow flex flex-col bg-cream-light dark:bg-darkbg-main transition-colors">
            {isLoading ? (
              <div className="py-20 text-center text-slate-muted">Loading bookmarks...</div>
            ) : bookmarkedPosts.length === 0 ? (
              <div className="py-24 px-6 text-center">
                <Bookmark className="h-10 w-10 text-slate-muted mx-auto mb-2 opacity-50" />
                <span className="font-serif font-bold text-lg text-ink-dark dark:text-ink-light">You haven't saved any posts yet</span>
                <p className="text-sm text-slate-muted mt-1">Bookmark posts to easily find them again in the future.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {bookmarkedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onPostDeleted={refetch}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right Panel */}
        <RightPanel />
      </div>
    </div>
  );
}

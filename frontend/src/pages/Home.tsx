import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import PostComposer from '../components/PostComposer';
import PostCard, { Post } from '../components/PostCard';
import DarkModeToggle from '../components/DarkModeToggle';
import { AlertCircle, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@radix-ui/react-dialog';

export default function Home() {
  const { user } = useAuthStore();
  const [feedType, setFeedType] = useState<'following' | 'latest'>('following');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading, isError, refetch } = useQuery<Post[]>({
    queryKey: ['feed', feedType, user?.id],
    queryFn: async () => {
      const res = await api.get(
        `/api/posts?current_user_id=${user?.id || ''}&feed_type=${feedType}`
      );
      return res.data;
    },
    enabled: !!user,
  });

  const handlePostCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  return (
    <div className="min-h-screen bg-cream-light dark:bg-darkbg-main transition-colors flex justify-center">
      <div className="w-full max-w-[1200px] flex">
        {/* Left Sidebar Nav */}
        <Sidebar onOpenNewPostModal={() => setIsComposerOpen(true)} />

        {/* Middle Column Feed */}
        <main className="flex-1 min-h-screen border-r border-fine-light dark:border-fine-dark flex flex-col">
          {/* Top Header */}
          <div className="sticky top-0 bg-cream-light/80 dark:bg-darkbg-main/80 backdrop-blur-md z-10 px-5 py-4 border-b border-fine-light dark:border-fine-dark flex items-center justify-between transition-colors">
            <h1 className="font-serif font-black text-2xl text-ink-dark dark:text-ink-light">Home</h1>
            
            {/* Moderated Indicator + DarkMode Toggle */}
            <div className="flex items-center gap-3">
              <span className="bg-cream-dark dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark text-[0.7rem] font-bold px-3 py-1 rounded-full text-slate-muted dark:text-slate-mutedDark flex items-center gap-1 uppercase select-none tracking-wider">
                🛡️ Moderated
              </span>
              <DarkModeToggle />
            </div>
          </div>

          {/* Following vs Latest Tabs */}
          <div className="flex border-b border-fine-light dark:border-fine-dark text-sm bg-cream-light dark:bg-darkbg-main transition-colors">
            <button
              onClick={() => setFeedType('following')}
              className="flex-1 py-4 text-center font-medium relative hover:bg-cream-dark/20 dark:hover:bg-darkbg-pill/10 transition-colors"
            >
              <span className={feedType === 'following' ? 'text-accent-warm font-bold' : 'text-slate-muted dark:text-slate-mutedDark'}>
                Following
              </span>
              {feedType === 'following' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-accent-warm rounded-full" />
              )}
            </button>
            <button
              onClick={() => setFeedType('latest')}
              className="flex-1 py-4 text-center font-medium relative hover:bg-cream-dark/20 dark:hover:bg-darkbg-pill/10 transition-colors"
            >
              <span className={feedType === 'latest' ? 'text-accent-warm font-bold' : 'text-slate-muted dark:text-slate-mutedDark'}>
                Latest
              </span>
              {feedType === 'latest' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-accent-warm rounded-full" />
              )}
            </button>
          </div>

          {/* Inline Post Composer */}
          <PostComposer onPostCreated={handlePostCreated} />

          {/* Feed List */}
          <div className="flex-1 flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center py-20 text-slate-muted dark:text-slate-mutedDark">
                <span>Loading feed...</span>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center gap-2 py-16 text-red-500">
                <AlertCircle className="h-8 w-8" />
                <span className="text-sm font-semibold">Error retrieving feed</span>
                <button onClick={() => refetch()} className="text-xs text-accent-warm font-bold underline">Try again</button>
              </div>
            ) : posts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-24 px-6 text-center">
                <span className="font-serif font-bold text-lg text-ink-dark dark:text-ink-light">No thoughts in this feed yet</span>
                <p className="text-sm text-slate-muted dark:text-slate-mutedDark mt-1 max-w-sm">
                  {feedType === 'following'
                    ? "Posts from people you follow will appear here. Try switching to the 'Latest' tab or search for users to follow!"
                    : "Share your thoughts or upload files to start the conversation."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} onPostDeleted={handlePostCreated} />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar Trends/Follow */}
        <RightPanel />

        {/* Dialog Modal for Floating "New Post" */}
        {isComposerOpen && (
          <Dialog open={isComposerOpen} onOpenChange={setIsComposerOpen}>
            <DialogContent className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-cream-light dark:bg-darkbg-card border border-fine-light dark:border-fine-dark w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative">
                <div className="flex items-center justify-between px-5 py-4 border-b border-fine-light dark:border-fine-dark">
                  <DialogTitle className="font-serif font-bold text-lg text-ink-dark dark:text-ink-light">Compose New Post</DialogTitle>
                  <button
                    onClick={() => setIsComposerOpen(false)}
                    className="p-1 rounded-full hover:bg-cream-dark dark:hover:bg-darkbg-pill text-slate-muted"
                  >
                    <Plus className="h-5 w-5 transform rotate-45" />
                  </button>
                </div>
                <PostComposer
                  onPostCreated={() => {
                    handlePostCreated();
                    setIsComposerOpen(false);
                  }}
                  modalMode
                  onCloseModal={() => setIsComposerOpen(false)}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import PostComposer from '../components/PostComposer';
import PostCard, { Post } from '../components/PostCard';
import DarkModeToggle from '../components/DarkModeToggle';
import { Users, Plus, X, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@radix-ui/react-dialog';
import { toast } from 'sonner';

interface Community {
  id: number;
  name: string;
  slug: string;
  description: string;
  avatar_url?: string;
  banner_url?: string;
  creator_id: number;
  created_at: string;
  members_count: number;
  user_joined: number;
}

export default function Communities() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states for creating community
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch all communities
  const { data: communities = [], isLoading: isCommsLoading, refetch: refetchComms } = useQuery<Community[]>({
    queryKey: ['communities', user?.id],
    queryFn: async () => {
      const res = await api.get(`/api/communities?current_user_id=${user?.id}`);
      return res.data;
    },
    enabled: !!user,
  });

  // Fetch community posts if active community is set
  const { data: commPosts = [], isLoading: isPostsLoading, refetch: refetchCommPosts } = useQuery<Post[]>({
    queryKey: ['community-feed', activeCommunity?.id, user?.id],
    queryFn: async () => {
      if (!activeCommunity) return [];
      const res = await api.get(`/api/posts`, {
        params: {
          current_user_id: user?.id,
          filter_community_id: activeCommunity.id
        }
      });
      return res.data;
    },
    enabled: !!activeCommunity,
  });

  const handleJoinToggle = async (e: React.MouseEvent, comm: Community) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const res = await api.post(`/api/communities/${comm.id}/join?user_id=${user.id}`);
      toast.success(res.data.joined ? `Joined c/${comm.slug}` : `Left c/${comm.slug}`);
      
      // Update active community stats if currently viewing it
      if (activeCommunity?.id === comm.id) {
        setActiveCommunity(prev => prev ? {
          ...prev,
          user_joined: res.data.joined ? 1 : 0,
          members_count: res.data.joined ? prev.members_count + 1 : prev.members_count - 1
        } : null);
      }
      
      refetchComms();
    } catch (err) {
      console.error("Error joining community", err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim() || !slug.trim()) {
      toast.warning("Name and slug are required.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await api.post('/api/communities', {
        name,
        slug,
        description,
        creator_id: user.id
      });
      
      if (res.status === 200) {
        toast.success(`Community c/${slug} created successfully!`);
        setName('');
        setSlug('');
        setDescription('');
        setIsCreateOpen(false);
        refetchComms();
      }
    } catch (err: any) {
      console.error("Community creation error", err);
      if (err.response && err.response.data && err.response.data.detail) {
        const detail = err.response.data.detail;
        if (detail.error === "Security Blocked") {
          toast.error(`Blocked: ${detail.reason}`);
        } else {
          toast.error(detail || "Error creating community.");
        }
      } else {
        toast.error("Failed to create community.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-light dark:bg-darkbg-main transition-colors flex justify-center">
      <div className="w-full max-w-[1200px] flex">
        {/* Left Nav */}
        <Sidebar onOpenNewPostModal={() => {}} />

        {/* Middle Column Communities */}
        <main className="flex-grow min-h-screen border-r border-fine-light dark:border-fine-dark flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-cream-light/80 dark:bg-darkbg-main/80 backdrop-blur-md z-10 px-5 py-4 border-b border-fine-light dark:border-fine-dark flex items-center justify-between transition-colors">
            <div className="flex items-center gap-3">
              {activeCommunity && (
                <button
                  onClick={() => setActiveCommunity(null)}
                  className="p-1 rounded-full hover:bg-cream-dark dark:hover:bg-darkbg-pill text-slate-muted"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <h1 className="font-serif font-black text-2xl text-ink-dark dark:text-ink-light">
                {activeCommunity ? `c/${activeCommunity.slug}` : 'Communities'}
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              {!activeCommunity && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="flex items-center gap-1 text-xs font-bold px-4 py-2 bg-ink-dark dark:bg-ink-light text-cream-light dark:text-darkbg-main rounded-full hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create</span>
                </button>
              )}
              <span className="bg-cream-dark dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark text-[0.7rem] font-bold px-3 py-1 rounded-full text-slate-muted dark:text-slate-mutedDark flex items-center gap-1 uppercase select-none tracking-wider">
                🛡️ Moderated
              </span>
              <DarkModeToggle />
            </div>
          </div>

          {/* Tab Views */}
          <div className="flex-1 flex flex-col bg-cream-light dark:bg-darkbg-main transition-colors">
            {activeCommunity ? (
              // Active Community View
              <div className="flex flex-col text-left">
                {/* Banner/Intro Card */}
                <div className="p-6 bg-cream-dark/20 dark:bg-darkbg-card border-b border-fine-light dark:border-fine-dark flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-serif font-black text-2xl text-ink-dark dark:text-ink-light">{activeCommunity.name}</h2>
                      <span className="text-xs text-slate-muted">c/{activeCommunity.slug}</span>
                    </div>
                    <button
                      onClick={(e) => handleJoinToggle(e, activeCommunity)}
                      className={`text-xs font-bold px-5 py-2 rounded-full border transition-all ${
                        activeCommunity.user_joined > 0
                          ? 'border-fine-light dark:border-fine-dark text-slate-muted hover:border-red-500 hover:text-red-500'
                          : 'bg-ink-dark dark:bg-ink-light border-transparent text-cream-light dark:text-darkbg-main hover:opacity-90'
                      }`}
                    >
                      {activeCommunity.user_joined > 0 ? 'Joined' : 'Join'}
                    </button>
                  </div>
                  <p className="text-sm text-ink-dark dark:text-ink-light">{activeCommunity.description || 'Welcome to this community!'}</p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-muted dark:text-slate-mutedDark">
                    <Users className="h-4 w-4" />
                    <span>{activeCommunity.members_count} members</span>
                  </div>
                </div>

                {/* Posting composer inside community */}
                {activeCommunity.user_joined > 0 ? (
                  <PostComposer
                    communityId={activeCommunity.id}
                    placeholder={`Post to ${activeCommunity.name}...`}
                    onPostCreated={refetchCommPosts}
                  />
                ) : (
                  <div className="p-4 border-b border-fine-light dark:border-fine-dark bg-cream-dark/10 text-center text-xs text-slate-muted">
                    You must join this community to write posts.
                  </div>
                )}

                {/* Posts Feed */}
                <div className="flex-1 flex flex-col">
                  {isPostsLoading ? (
                    <div className="py-20 text-center text-slate-muted">Loading posts...</div>
                  ) : commPosts.length === 0 ? (
                    <div className="py-24 text-center text-slate-muted italic text-sm">
                      No posts in this community yet. Be the first to share something!
                    </div>
                  ) : (
                    commPosts.map(post => (
                      <PostCard key={post.id} post={post} onPostDeleted={refetchCommPosts} />
                    ))
                  )}
                </div>
              </div>
            ) : (
              // Explore Communities List View
              <div className="p-5 flex flex-col gap-4 text-left">
                <h3 className="font-serif font-black text-xl text-ink-dark dark:text-ink-light flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-accent-warm" />
                  <span>Explore Communities</span>
                </h3>

                {isCommsLoading ? (
                  <div className="py-20 text-center text-slate-muted">Loading communities...</div>
                ) : communities.length === 0 ? (
                  <div className="py-24 text-center text-slate-muted italic">No communities created yet. Click create to start the first group!</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {communities.map((comm) => (
                      <div
                        key={comm.id}
                        onClick={() => setActiveCommunity(comm)}
                        className="p-5 bg-cream-dark/25 dark:bg-darkbg-card border border-fine-light dark:border-fine-dark rounded-2xl cursor-pointer hover:border-accent-warm/40 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between min-h-[160px]"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-serif font-bold text-lg text-ink-dark dark:text-ink-light hover:text-accent-warm transition-colors truncate">
                              c/{comm.slug}
                            </h4>
                            <button
                              onClick={(e) => handleJoinToggle(e, comm)}
                              className={`text-[0.7rem] font-bold px-3 py-1.5 rounded-full border transition-all ${
                                comm.user_joined > 0
                                  ? 'border-fine-light dark:border-fine-dark text-slate-muted'
                                  : 'bg-ink-dark dark:bg-ink-light border-transparent text-cream-light dark:text-darkbg-main'
                              }`}
                            >
                              {comm.user_joined > 0 ? 'Joined' : 'Join'}
                            </button>
                          </div>
                          <span className="text-[0.7rem] font-bold text-slate-muted uppercase tracking-wider block mt-1">{comm.name}</span>
                          <p className="text-xs text-slate-muted mt-2 line-clamp-2">{comm.description || 'Welcome to this group...'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-muted mt-4">
                          <Users className="h-3.5 w-3.5" />
                          <span>{comm.members_count} members</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar */}
        <RightPanel />

        {/* Create Community Dialog */}
        {isCreateOpen && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-cream-light dark:bg-darkbg-card border border-fine-light dark:border-fine-dark w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative p-6">
                <div className="flex items-center justify-between pb-3 border-b border-fine-light dark:border-fine-dark">
                  <DialogTitle className="font-serif font-bold text-lg text-ink-dark dark:text-ink-light">Create Community</DialogTitle>
                  <button
                    onClick={() => setIsCreateOpen(false)}
                    className="p-1 rounded-full hover:bg-cream-dark dark:hover:bg-darkbg-pill text-slate-muted"
                  >
                    <X className="h-5 w-5 transform rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 text-left">
                  <div className="flex flex-col gap-3">
                    {/* Name */}
                    <div>
                      <label className="text-xs font-bold text-slate-muted uppercase">Community Name</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none"
                        placeholder="e.g. Slow Tech Society"
                      />
                    </div>
                    {/* Slug */}
                    <div>
                      <label className="text-xs font-bold text-slate-muted uppercase">slug handle (c/slug)</label>
                      <input
                        type="text"
                        required
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.replace(/\s+/g, '-'))}
                        className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none"
                        placeholder="e.g. slow-tech"
                      />
                    </div>
                    {/* Description */}
                    <div>
                      <label className="text-xs font-bold text-slate-muted uppercase">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none h-16 resize-none"
                        placeholder="What is this community about?"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full mt-2 py-3 bg-ink-dark dark:bg-ink-light text-cream-light dark:text-darkbg-main font-semibold rounded-xl disabled:opacity-50"
                  >
                    {isCreating ? 'Creating...' : 'Create Community'}
                  </button>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

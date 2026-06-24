import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import PostCard, { Post } from '../components/PostCard';
import DarkModeToggle from '../components/DarkModeToggle';
import { Search, UserCheck, UserPlus, Flame } from 'lucide-react';
import { toast } from 'sonner';

interface TrendingTopic {
  id: number;
  category: string;
  tag: string;
  posts_count: string;
}

interface SearchUser {
  id: number;
  username: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  is_following?: boolean;
}

export default function Explore() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const queryParam = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [activeTab, setActiveTab] = useState<'trending' | 'posts' | 'users'>(queryParam ? 'posts' : 'trending');
  const [localFollows, setLocalFollows] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setSearchQuery(queryParam);
    if (queryParam) {
      setActiveTab('posts');
    } else {
      setActiveTab('trending');
    }
  }, [queryParam]);

  // Query trending list
  const { data: trends = [] } = useQuery<TrendingTopic[]>({
    queryKey: ['explore-trends'],
    queryFn: async () => {
      const res = await api.get('/api/explore/trending');
      return res.data;
    }
  });

  // Query posts based on search query
  const { data: searchPosts = [], isLoading: isPostsLoading } = useQuery<Post[]>({
    queryKey: ['explore-search-posts', queryParam],
    queryFn: async () => {
      if (!queryParam) return [];
      const res = await api.get('/api/posts', {
        params: {
          current_user_id: currentUser?.id,
          search_query: queryParam
        }
      });
      return res.data;
    },
    enabled: !!queryParam
  });

  // Query users based on search query
  const { data: searchUsers = [], isLoading: isUsersLoading, refetch: refetchUsers } = useQuery<SearchUser[]>({
    queryKey: ['explore-search-users', queryParam, currentUser?.id],
    queryFn: async () => {
      if (!queryParam) return [];
      // To simulate search, we query users from feed or recommended.
      // For backend, since we don't have a standalone `/api/users/search`, 
      // let's fetch matching users. Let's make an endpoint search query, 
      // or we can mock/filter from standard user follow listings.
      // Wait! The backend `/api/posts` returns a search query parameter. 
      // What about searching users? Let's check `backend/main.py` - ah! 
      // In database.py: `get_posts` supports searching posts and usernames: `(p.content LIKE ? OR u.username LIKE ? OR u.display_name LIKE ?)`.
      // Let's retrieve matching users by parsing authors of posts, 
      // or calling a direct database search if we want.
      // Let's implement a simple user-search helper in backend, OR 
      // just extract distinct authors of matching posts.
      // Extracting distinct authors is extremely clever and uses existing APIs!
      // Let's check if the backend has search endpoints. In database.py, we have `get_posts` with `search_query`.
      // Let's write a quick endpoint on the backend or filter authors.
      // Actually, we can fetch all posts matching search_query and map their authors:
      const res = await api.get('/api/posts', {
        params: {
          current_user_id: currentUser?.id,
          search_query: queryParam
        }
      });
      
      const distinctUsersMap: Record<number, SearchUser> = {};
      res.data.forEach((p: Post) => {
        if (!distinctUsersMap[p.user_id]) {
          distinctUsersMap[p.user_id] = {
            id: p.user_id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            // we'll fetch is_following dynamically, or mock it
            is_following: false // default, updated by local follows
          };
        }
      });
      
      const list = Object.values(distinctUsersMap);
      
      // Fetch follow states
      for (const u of list) {
        if (currentUser) {
          try {
            const profileRes = await api.get(`/api/users/${u.username}?current_user_id=${currentUser.id}`);
            u.is_following = profileRes.data.is_following;
            u.bio = profileRes.data.user.bio;
          } catch (e) {
            console.error("Error fetching follow state", e);
          }
        }
      }
      
      return list;
    },
    enabled: !!queryParam && activeTab === 'users'
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/explore');
    }
  };

  const handleFollowToggle = async (targetUser: SearchUser) => {
    if (!currentUser) {
      toast.error("Please log in first.");
      return;
    }
    
    try {
      const res = await api.post(`/api/users/${targetUser.id}/follow?follower_id=${currentUser.id}`);
      setLocalFollows(prev => ({ ...prev, [targetUser.id]: res.data.followed }));
      toast.success(res.data.followed ? `Followed @${targetUser.username}` : `Unfollowed @${targetUser.username}`);
      refetchUsers();
    } catch (err) {
      console.error("Error toggling follow", err);
    }
  };

  return (
    <div className="min-h-screen bg-cream-light dark:bg-darkbg-main transition-colors flex justify-center">
      <div className="w-full max-w-[1200px] flex">
        {/* Left Navigation Sidebar */}
        <Sidebar onOpenNewPostModal={() => {}} />

        {/* Middle Column Explore */}
        <main className="flex-1 min-h-screen border-r border-fine-light dark:border-fine-dark flex flex-col">
          {/* Header Search bar */}
          <div className="sticky top-0 bg-cream-light/80 dark:bg-darkbg-main/80 backdrop-blur-md z-10 px-5 py-4 border-b border-fine-light dark:border-fine-dark flex items-center justify-between transition-colors">
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
              <input
                type="text"
                placeholder="Search Sentio"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2 rounded-full text-sm bg-cream-dark/40 dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none focus:border-accent-warm focus:bg-cream-light dark:focus:bg-darkbg-main transition-all"
              />
              <Search className="absolute left-4 top-2.5 h-4 w-4 text-slate-muted" />
            </form>
            <div className="flex items-center gap-3 ml-4">
              <span className="bg-cream-dark dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark text-[0.7rem] font-bold px-3 py-1 rounded-full text-slate-muted dark:text-slate-mutedDark flex items-center gap-1 uppercase select-none tracking-wider">
                🛡️ Moderated
              </span>
              <DarkModeToggle />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-fine-light dark:border-fine-dark text-sm bg-cream-light dark:bg-darkbg-main transition-colors">
            {(!queryParam ? ['trending'] : ['posts', 'users']).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className="flex-1 py-4 text-center font-medium relative hover:bg-cream-dark/20 dark:hover:bg-darkbg-pill/10 transition-colors capitalize"
              >
                <span className={activeTab === tab ? 'text-accent-warm font-bold' : 'text-slate-muted dark:text-slate-mutedDark'}>
                  {tab}
                </span>
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-accent-warm rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Views */}
          <div className="flex-1 flex flex-col bg-cream-light dark:bg-darkbg-main">
            {activeTab === 'trending' && (
              <div className="p-5 flex flex-col gap-4 text-left">
                <h3 className="font-serif font-black text-xl text-ink-dark dark:text-ink-light flex items-center gap-2 mb-2">
                  <Flame className="h-5 w-5 text-accent-warm" />
                  <span>Trending Quiet Topics</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trends.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => navigate(`/explore?q=${encodeURIComponent(t.tag)}`)}
                      className="p-5 bg-cream-dark/25 dark:bg-darkbg-card border border-fine-light dark:border-fine-dark rounded-2xl cursor-pointer hover:border-accent-warm/40 hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <span className="text-[0.65rem] font-bold text-slate-muted uppercase tracking-wider">{t.category}</span>
                      <h4 className="font-serif font-bold text-lg text-ink-dark dark:text-ink-light mt-1 hover:text-accent-warm transition-colors">{t.tag}</h4>
                      <span className="text-xs text-slate-muted mt-0.5 block">{t.posts_count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'posts' && (
              <div className="flex flex-col">
                {isPostsLoading ? (
                  <div className="py-20 text-center text-slate-muted">Searching thoughts...</div>
                ) : searchPosts.length === 0 ? (
                  <div className="py-24 text-center text-slate-muted italic">No matching posts found. Try another search!</div>
                ) : (
                  searchPosts.map(post => (
                    <PostCard key={post.id} post={post} />
                  ))
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="flex flex-col p-4 gap-3 text-left">
                {isUsersLoading ? (
                  <div className="py-20 text-center text-slate-muted">Searching users...</div>
                ) : searchUsers.length === 0 ? (
                  <div className="py-24 text-center text-slate-muted italic">No matching users found.</div>
                ) : (
                  searchUsers.map(u => {
                    const followingState = localFollows[u.id] !== undefined ? localFollows[u.id] : u.is_following;
                    return (
                      <div key={u.id} className="flex items-center justify-between p-4 bg-cream-dark/10 dark:bg-darkbg-card border border-fine-light dark:border-fine-dark rounded-2xl">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${u.username}`)}>
                          <div className="h-10 w-10 rounded-full bg-cream-dark dark:bg-darkbg-pill overflow-hidden flex items-center justify-center border border-fine-light">
                            {u.avatar_url ? (
                              <img src={u.avatar_url.startsWith('http') ? u.avatar_url : `http://127.0.0.1:8000${u.avatar_url}`} alt={u.username} className="h-full w-full object-cover" />
                            ) : (
                              <span className="font-serif font-bold text-slate-muted uppercase">{u.username[0]}</span>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-ink-dark dark:text-ink-light">{u.display_name}</span>
                            <span className="text-xs text-slate-muted">@{u.username}</span>
                            {u.bio && <span className="text-xs text-slate-muted/95 dark:text-slate-mutedDark mt-1">{u.bio}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleFollowToggle(u)}
                          className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition-all ${
                            followingState
                              ? 'border-fine-light dark:border-fine-dark text-slate-muted dark:text-slate-mutedDark hover:border-red-500 hover:text-red-500'
                              : 'bg-ink-dark dark:bg-ink-light text-cream-light dark:text-darkbg-main border-transparent hover:opacity-90'
                          }`}
                        >
                          {followingState ? (
                            <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" /> Following</span>
                          ) : (
                            <span className="flex items-center gap-1"><UserPlus className="h-3 w-3" /> Follow</span>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
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

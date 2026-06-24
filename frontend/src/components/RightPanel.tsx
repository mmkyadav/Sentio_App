import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

interface Trend {
  id: number;
  category: string;
  tag: string;
  posts_count: string;
}

interface RecommendedUser {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  is_following?: boolean;
}

export default function RightPanel() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch static trending list
    api.get('/api/explore/trending')
      .then(res => setTrends(res.data))
      .catch(err => console.error("Error fetching trends", err));
      
    // Fetch recommended users to follow
    fetchRecommendations();
  }, [user]);

  const fetchRecommendations = () => {
    if (!user) return;
    // We can fetch user profiles of popular users
    // For the demo, we will check Iris Lang and Mateo Reyes, registering/retrieving them if they exist
    // and querying follow state. If they don't exist, we fallback to mock recommendations.
    api.get(`/api/users/irislang?current_user_id=${user.id}`)
      .then(res1 => {
        const iris = {
          id: res1.data.user.id,
          username: res1.data.user.username,
          display_name: res1.data.user.display_name,
          avatar_url: res1.data.user.avatar_url,
          is_following: res1.data.is_following
        };
        
        api.get(`/api/users/mateo?current_user_id=${user.id}`)
          .then(res2 => {
            const mateo = {
              id: res2.data.user.id,
              username: res2.data.user.username,
              display_name: res2.data.user.display_name,
              avatar_url: res2.data.user.avatar_url,
              is_following: res2.data.is_following
            };
            setRecommendations([iris, mateo]);
          })
          .catch(() => {
            // fallback if mateo doesn't exist yet
            setRecommendations([iris]);
          });
      })
      .catch(() => {
        // Fallback static mock users if database is fresh and they aren't registered yet
        setRecommendations([
          { id: 999, username: 'irislang', display_name: 'Iris Lang', is_following: false },
          { id: 998, username: 'mateo', display_name: 'Mateo Reyes', is_following: false }
        ]);
      });
  };

  const handleFollowToggle = async (recUser: RecommendedUser) => {
    if (!user) {
      navigate('/');
      return;
    }
    
    try {
      // Toggle follow
      const res = await api.post(`/api/users/${recUser.id}/follow?follower_id=${user.id}`);
      
      // Update recommendation state
      setRecommendations(prev =>
        prev.map(item =>
          item.id === recUser.id ? { ...item, is_following: res.data.followed } : item
        )
      );
      
      // Trigger a profile refresh custom event if on the profile page
      window.dispatchEvent(new CustomEvent('user-follow-toggled', { detail: { userId: recUser.id } }));
    } catch (err) {
      console.error("Error toggling follow", err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="w-80 h-screen overflow-y-auto sticky top-0 py-6 px-4 flex flex-col gap-6 select-none border-l border-fine-light dark:border-fine-dark">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <input
          type="text"
          placeholder="Search Sentio"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 rounded-full text-sm bg-cream-dark/50 dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light placeholder-slate-muted focus:outline-none focus:border-accent-warm focus:bg-cream-light dark:focus:bg-darkbg-main transition-all duration-200"
        />
        <Search className="absolute left-4 top-3 h-4 w-4 text-slate-muted" />
      </form>

      {/* Trends Section */}
      <div className="bg-cream-light dark:bg-darkbg-card border border-fine-light dark:border-fine-dark rounded-2xl p-5 shadow-sm">
        <h3 className="font-serif font-bold text-[1.2rem] text-ink-dark dark:text-ink-light mb-4 tracking-wide">
          What's quiet today
        </h3>
        <div className="flex flex-col gap-4">
          {trends.map((trend) => (
            <div
              key={trend.id}
              onClick={() => navigate(`/explore?q=${encodeURIComponent(trend.tag)}`)}
              className="group flex flex-col items-start cursor-pointer hover:opacity-85 transition-opacity"
            >
              <span className="text-[0.7rem] font-bold tracking-wider text-slate-muted dark:text-slate-mutedDark uppercase">
                {trend.category}
              </span>
              <span className="font-serif font-bold text-[1rem] text-ink-dark dark:text-ink-light mt-0.5 group-hover:text-accent-warm transition-colors">
                {trend.tag}
              </span>
              <span className="text-xs text-slate-muted dark:text-slate-mutedDark mt-0.5">
                {trend.posts_count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Who to Follow Section */}
      <div className="bg-cream-light dark:bg-darkbg-card border border-fine-light dark:border-fine-dark rounded-2xl p-5 shadow-sm">
        <h3 className="font-serif font-bold text-[1.2rem] text-ink-dark dark:text-ink-light mb-4 tracking-wide">
          People to follow
        </h3>
        <div className="flex flex-col gap-4">
          {recommendations.map((recUser) => (
            <div key={recUser.id} className="flex items-center justify-between gap-3">
              <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => navigate(`/profile/${recUser.username}`)}
              >
                <div className="h-9 w-9 rounded-full bg-cream-dark dark:bg-darkbg-pill overflow-hidden flex items-center justify-center border border-fine-light dark:border-fine-dark">
                  {recUser.avatar_url ? (
                    <img src={recUser.avatar_url.startsWith('http') ? recUser.avatar_url : `http://127.0.0.1:8000${recUser.avatar_url}`} alt={recUser.username} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-serif font-semibold text-slate-muted uppercase text-sm">{recUser.username[0]}</span>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-xs text-ink-dark dark:text-ink-light group-hover:text-accent-warm transition-colors">
                    {recUser.display_name}
                  </span>
                  <span className="text-[0.7rem] text-slate-muted dark:text-slate-mutedDark">
                    @{recUser.username}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleFollowToggle(recUser)}
                className={`text-xs px-3.5 py-1.5 rounded-full font-semibold border transition-all duration-200 ${
                  recUser.is_following
                    ? 'border-fine-light dark:border-fine-dark text-slate-muted dark:text-slate-mutedDark hover:border-red-500 hover:text-red-500 hover:bg-red-50/10'
                    : 'bg-ink-dark dark:bg-ink-light border-transparent text-cream-light dark:text-darkbg-main hover:opacity-85'
                }`}
              >
                {recUser.is_following ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import PostCard, { Post } from '../components/PostCard';
import DarkModeToggle from '../components/DarkModeToggle';
import { MapPin, Link as LinkIcon, Calendar, Edit3, X, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@radix-ui/react-dialog';
import { toast } from 'sonner';

const sanitizeError = (errMessage: any): string => {
  if (!errMessage) return "An unexpected error occurred.";
  if (typeof errMessage !== 'string') {
    return "An unexpected error occurred.";
  }
  const lower = errMessage.toLowerCase();
  if (
    lower.includes("quota") ||
    lower.includes("exhausted") ||
    lower.includes("api error") ||
    lower.includes("rate limit") ||
    lower.includes("genai") ||
    lower.includes("key") ||
    lower.includes("internal") ||
    lower.includes("sqlite") ||
    lower.includes("operationalerror") ||
    lower.includes("locked")
  ) {
    return "The safety moderation service is temporarily busy. Please try again in a few moments.";
  }
  return errMessage;
};

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'media' | 'files'>('posts');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Edit Profile Form States
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Fetch target user profile details
  const { data: profileData, isLoading: isProfileLoading, isError: isProfileError, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', username, currentUser?.id],
    queryFn: async () => {
      const res = await api.get(
        `/api/users/${username}?current_user_id=${currentUser?.id || ''}`
      );
      return res.data;
    },
    enabled: !!username && !!currentUser,
  });

  // Listen to external follow events to synchronize feeds
  useEffect(() => {
    const handleFollowEvent = () => {
      refetchProfile();
    };
    window.addEventListener('user-follow-toggled', handleFollowEvent);
    return () => {
      window.removeEventListener('user-follow-toggled', handleFollowEvent);
    };
  }, [refetchProfile]);

  // Fetch posts filtered by username
  const { data: posts = [], isLoading: isPostsLoading } = useQuery<Post[]>({
    queryKey: ['user-posts', username, activeTab],
    queryFn: async () => {
      let feedType = 'latest';
      let filterUsername = username;
      let filterCommunityId = undefined;
      
      const res = await api.get('/api/posts', {
        params: {
          current_user_id: currentUser?.id,
          feed_type: feedType,
          filter_username: filterUsername,
        }
      });
      
      // Client-side tab filter
      const allPosts: Post[] = res.data;
      if (activeTab === 'media') {
        return allPosts.filter(p => p.file_type === 'image');
      } else if (activeTab === 'files') {
        return allPosts.filter(p => p.file_type === 'document');
      } else if (activeTab === 'replies') {
        // for simplicity, replies could show posts with comments_count > 0, 
        // or posts where this user commented (we'll show posts with comments > 0)
        return allPosts.filter(p => p.comments_count > 0);
      }
      return allPosts;
    },
    enabled: !!username,
  });

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && currentUser) {
      const file = e.target.files[0];
      setIsUploadingAvatar(true);
      const formData = new FormData();
      formData.append('user_id', String(currentUser.id));
      formData.append('username', currentUser.username);
      formData.append('image_type', 'avatar');
      formData.append('file', file);
      
      try {
        const res = await api.post('/api/users/profile/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setEditAvatarUrl(res.data.url);
        toast.success("Avatar image uploaded safely!");
      } catch (err: any) {
        console.error("Avatar upload failed", err);
        if (err.response && err.response.data && err.response.data.detail) {
          const detail = err.response.data.detail;
          if (detail.error === "Security Blocked") {
            toast.error(`Security Blocked: ${sanitizeError(detail.reason)}`);
          } else {
            toast.error(sanitizeError(err.response.data.detail) || "Failed to upload avatar.");
          }
        } else {
          toast.error("Failed to upload avatar image.");
        }
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && currentUser) {
      const file = e.target.files[0];
      setIsUploadingCover(true);
      const formData = new FormData();
      formData.append('user_id', String(currentUser.id));
      formData.append('username', currentUser.username);
      formData.append('image_type', 'cover');
      formData.append('file', file);
      
      try {
        const res = await api.post('/api/users/profile/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setEditCoverUrl(res.data.url);
        toast.success("Cover image uploaded safely!");
      } catch (err: any) {
        console.error("Cover upload failed", err);
        if (err.response && err.response.data && err.response.data.detail) {
          const detail = err.response.data.detail;
          if (detail.error === "Security Blocked") {
            toast.error(`Security Blocked: ${sanitizeError(detail.reason)}`);
          } else {
            toast.error(sanitizeError(err.response.data.detail) || "Failed to upload cover.");
          }
        } else {
          toast.error("Failed to upload cover image.");
        }
      } finally {
        setIsUploadingCover(false);
      }
    }
  };

  // Setup form states when edit modal opens
  const openEditModal = () => {
    if (!profileData?.user) return;
    const u = profileData.user;
    setEditDisplayName(u.display_name || '');
    setEditBio(u.bio || '');
    setEditLocation(u.location || '');
    setEditWebsite(u.website || '');
    setEditAvatarUrl(u.avatar_url || '');
    setEditCoverUrl(u.cover_url || '');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setIsSavingProfile(true);
    try {
      const res = await api.put('/api/users/profile', {
        user_id: currentUser.id,
        display_name: editDisplayName,
        bio: editBio,
        location: editLocation,
        website: editWebsite,
        avatar_url: editAvatarUrl,
        cover_url: editCoverUrl
      });
      
      if (res.status === 200) {
        toast.success("Profile updated successfully!");
        updateUser(res.data);
        queryClient.invalidateQueries({ queryKey: ['profile', username] });
        setIsEditModalOpen(false);
      }
    } catch (err) {
      console.error("Profile update error", err);
      toast.error("Failed to update profile details.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleFollowClick = async () => {
    if (!currentUser || !profileData?.user) return;
    try {
      const res = await api.post(`/api/users/${profileData.user.id}/follow?follower_id=${currentUser.id}`);
      toast.success(res.data.followed ? `Followed @${profileData.user.username}` : `Unfollowed @${profileData.user.username}`);
      refetchProfile();
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (err) {
      console.error("Error following user", err);
    }
  };

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-cream-light dark:bg-darkbg-main flex justify-center items-center">
        <span className="text-slate-muted">Loading profile...</span>
      </div>
    );
  }

  if (isProfileError || !profileData) {
    return (
      <div className="min-h-screen bg-cream-light dark:bg-darkbg-main flex justify-center items-center flex-col gap-3">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <span className="text-slate-muted">User profile not found.</span>
        <button onClick={() => navigate('/home')} className="text-xs text-accent-warm font-bold underline">Go Home</button>
      </div>
    );
  }

  const { user, stats, is_following } = profileData;
  const isMe = currentUser?.id === user.id;

  const joinDate = user.created_at
    ? new Date(user.created_at.replace(" ", "T")).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : 'March 2024';

  return (
    <div className="min-h-screen bg-cream-light dark:bg-darkbg-main transition-colors flex justify-center">
      <div className="w-full max-w-[1200px] flex">
        {/* Left Nav Sidebar */}
        <Sidebar onOpenNewPostModal={() => {}} />

        {/* Middle Profile Panel */}
        <main className="flex-1 min-h-screen border-r border-fine-light dark:border-fine-dark flex flex-col">
          {/* Header bar */}
          <div className="sticky top-0 bg-cream-light/80 dark:bg-darkbg-main/80 backdrop-blur-md z-10 px-5 py-4 border-b border-fine-light dark:border-fine-dark flex items-center justify-between transition-colors">
            <div className="flex flex-col text-left">
              <h1 className="font-serif font-black text-2xl text-ink-dark dark:text-ink-light">{user.display_name}</h1>
              <span className="text-xs text-slate-muted dark:text-slate-mutedDark">{stats.posts_count} posts</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-cream-dark dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark text-[0.7rem] font-bold px-3 py-1 rounded-full text-slate-muted dark:text-slate-mutedDark flex items-center gap-1 uppercase select-none tracking-wider">
                🛡️ Moderated
              </span>
              <DarkModeToggle />
            </div>
          </div>

          {/* Profile Banner */}
          <div className="h-44 w-full bg-gradient-to-r from-cream-dark to-slate-200 dark:from-darkbg-card dark:to-darkbg-pill relative overflow-hidden flex-shrink-0">
            {user.cover_url && (
              <img src={user.cover_url} alt="profile cover" className="h-full w-full object-cover" />
            )}
          </div>

          {/* Profile Details Area */}
          <div className="px-5 pb-5 relative border-b border-fine-light dark:border-fine-dark bg-cream-light dark:bg-darkbg-main transition-colors">
            {/* Overlapping Avatar */}
            <div className="h-24 w-24 rounded-full bg-cream-light dark:bg-darkbg-main border-[3px] border-cream-light dark:border-darkbg-main overflow-hidden flex items-center justify-center -mt-12 shadow-md relative z-10">
              {user.avatar_url ? (
                <img src={user.avatar_url.startsWith('http') ? user.avatar_url : `http://127.0.0.1:8000${user.avatar_url}`} alt={user.username} className="h-full w-full object-cover" />
              ) : (
                <span className="font-serif font-bold text-slate-muted text-3xl uppercase">{user.username[0]}</span>
              )}
            </div>

            {/* Profile Action Buttons */}
            <div className="absolute right-5 top-4 flex gap-2">
              {isMe ? (
                <button
                  onClick={openEditModal}
                  className="flex items-center gap-2 text-xs font-bold px-4 py-2 border border-fine-light dark:border-fine-dark rounded-full hover:bg-cream-dark dark:hover:bg-darkbg-pill text-ink-dark dark:text-ink-light transition-colors"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit profile</span>
                </button>
              ) : (
                <button
                  onClick={handleFollowClick}
                  className={`text-xs font-bold px-5 py-2 rounded-full border transition-all duration-200 ${
                    is_following
                      ? 'border-fine-light dark:border-fine-dark text-slate-muted dark:text-slate-mutedDark hover:border-red-500 hover:text-red-500 hover:bg-red-50/10'
                      : 'bg-ink-dark dark:bg-ink-light border-transparent text-cream-light dark:text-darkbg-main hover:opacity-85'
                  }`}
                >
                  {is_following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* User description metadata */}
            <div className="flex flex-col items-start mt-3 text-left">
              <span className="font-serif font-black text-xl text-ink-dark dark:text-ink-light">{user.display_name}</span>
              <span className="text-xs text-slate-muted dark:text-slate-mutedDark">@{user.username}</span>

              {user.bio ? (
                <p className="text-sm text-ink-dark dark:text-ink-light mt-3 whitespace-pre-wrap">{user.bio}</p>
              ) : (
                <p className="text-sm text-slate-muted italic mt-3">No bio written yet.</p>
              )}

              {/* Location, link, join date */}
              <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-xs text-slate-muted dark:text-slate-mutedDark mt-3.5">
                {user.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{user.location}</span>
                  </div>
                )}
                {user.website && (
                  <div className="flex items-center gap-1">
                    <LinkIcon className="h-3.5 w-3.5 text-accent-warm" />
                    <a href={user.website.startsWith('http') ? user.website : `https://${user.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-accent-warm">
                      {user.website.replace(/(^\w+:|^)\/\//, '')}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Joined {joinDate}</span>
                </div>
              </div>

              {/* Follower Stats */}
              <div className="flex gap-4 mt-4 text-sm text-ink-dark dark:text-ink-light">
                <div className="cursor-pointer hover:underline">
                  <strong className="font-bold">{stats.following_count}</strong>
                  <span className="text-slate-muted dark:text-slate-mutedDark text-xs ml-1">Following</span>
                </div>
                <div className="cursor-pointer hover:underline">
                  <strong className="font-bold">{stats.followers_count}</strong>
                  <span className="text-slate-muted dark:text-slate-mutedDark text-xs ml-1">Followers</span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Navigation Tabs */}
          <div className="flex border-b border-fine-light dark:border-fine-dark text-sm bg-cream-light dark:bg-darkbg-main transition-colors">
            {['posts', 'replies', 'media', 'files'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className="flex-1 py-4 text-center font-medium relative hover:bg-cream-dark/20 dark:hover:bg-darkbg-pill/10 transition-colors capitalize"
              >
                <span className={activeTab === tab ? 'text-accent-warm font-bold' : 'text-slate-muted dark:text-slate-mutedDark'}>
                  {tab}
                </span>
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-accent-warm rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Profile Tab Feeds */}
          <div className="flex-1 flex flex-col bg-cream-light dark:bg-darkbg-main">
            {isPostsLoading ? (
              <div className="py-16 text-center text-slate-muted">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="py-20 px-6 text-center italic text-slate-muted">
                No posts found under the '{activeTab}' category.
              </div>
            ) : (
              <div className="flex flex-col">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} onPostDeleted={() => queryClient.invalidateQueries({ queryKey: ['user-posts'] })} />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right Panel */}
        <RightPanel />

        {/* Edit Profile Modal Dialog */}
        {isEditModalOpen && (
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-cream-light dark:bg-darkbg-card border border-fine-light dark:border-fine-dark w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative p-6">
                <div className="flex items-center justify-between pb-4 border-b border-fine-light dark:border-fine-dark">
                  <DialogTitle className="font-serif font-bold text-lg text-ink-dark dark:text-ink-light">Edit Profile</DialogTitle>
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="p-1 rounded-full hover:bg-cream-dark dark:hover:bg-darkbg-pill text-slate-muted"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <form onSubmit={handleEditSubmit} className="mt-4 space-y-4 text-left">
                  <div className="flex flex-col gap-3">
                    {/* Display Name */}
                    <div>
                      <label className="text-xs font-bold text-slate-muted uppercase">Display Name</label>
                      <input
                        type="text"
                        required
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none"
                      />
                    </div>
                    {/* Bio */}
                    <div>
                      <label className="text-xs font-bold text-slate-muted uppercase">Bio</label>
                      <textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none h-16 resize-none"
                      />
                    </div>
                    {/* Location */}
                    <div>
                      <label className="text-xs font-bold text-slate-muted uppercase">Location</label>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none"
                      />
                    </div>
                    {/* Website */}
                    <div>
                      <label className="text-xs font-bold text-slate-muted uppercase">Website</label>
                      <input
                        type="text"
                        value={editWebsite}
                        onChange={(e) => setEditWebsite(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none"
                      />
                    </div>
                    {/* Avatar URL & Upload */}
                    <div>
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-muted uppercase">Avatar Image</label>
                        <label className="text-xs font-bold text-accent-warm hover:underline cursor-pointer">
                          {isUploadingAvatar ? 'Uploading...' : 'Upload File'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarFileChange}
                            disabled={isUploadingAvatar}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        value={editAvatarUrl}
                        onChange={(e) => setEditAvatarUrl(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none placeholder-slate-400"
                        placeholder="Or enter URL: https://..."
                      />
                    </div>
                    {/* Cover URL & Upload */}
                    <div>
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-muted uppercase">Cover Image</label>
                        <label className="text-xs font-bold text-accent-warm hover:underline cursor-pointer">
                          {isUploadingCover ? 'Uploading...' : 'Upload File'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCoverFileChange}
                            disabled={isUploadingCover}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        value={editCoverUrl}
                        onChange={(e) => setEditCoverUrl(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none placeholder-slate-400"
                        placeholder="Or enter URL: https://..."
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="w-full mt-2 py-3 bg-ink-dark dark:bg-ink-light text-cream-light dark:text-darkbg-main font-semibold rounded-xl disabled:opacity-50"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
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

import { useState } from 'react';
import { MessageCircle, Heart, Bookmark, Share2, Repeat2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export interface Post {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  avatar_url?: string;
  content: string;
  file_path?: string;
  file_type?: 'image' | 'document' | 'other';
  community_id?: number;
  community_name?: string;
  community_slug?: string;
  likes_count: number;
  comments_count: number;
  user_liked: number;
  created_at: string;
}

interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  username: string;
  display_name: string;
  avatar_url?: string;
  content: string;
  created_at: string;
}

interface PostCardProps {
  post: Post;
  onPostDeleted?: () => void;
}

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

export default function PostCard({ post: initialPost, onPostDeleted }: PostCardProps) {
  const { user } = useAuthStore();
  const [post, setPost] = useState<Post>(initialPost);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [repostCount, setRepostCount] = useState(Math.floor((post.likes_count + 3) / 4)); // mock reposts
  const [hasReposted, setHasReposted] = useState(false);
  
  // Safety warn state for DMs/Comments
  const [commentSecurityBlock, setCommentSecurityBlock] = useState<{
    violation_type: string;
    reason: string;
  } | null>(null);

  const formatTime = (tsStr: string) => {
    try {
      const date = new Date(tsStr.replace(" ", "T"));
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      
      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return tsStr;
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast.error("Please log in first.");
      return;
    }
    
    try {
      const res = await api.post(`/api/posts/${post.id}/like?user_id=${user.id}`);
      const isLikedNow = res.data.liked;
      setPost(prev => ({
        ...prev,
        user_liked: isLikedNow ? 1 : 0,
        likes_count: isLikedNow ? prev.likes_count + 1 : prev.likes_count - 1
      }));
    } catch (err) {
      console.error("Error liking post", err);
    }
  };

  const handleRepost = () => {
    if (hasReposted) {
      setRepostCount(prev => prev - 1);
      setHasReposted(false);
    } else {
      setRepostCount(prev => prev + 1);
      setHasReposted(true);
      toast.success("Reposted!");
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    toast.success(isBookmarked ? "Bookmark removed" : "Post bookmarked!");
  };

  const handleShare = () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(postUrl);
    toast.success("Link copied to clipboard!");
  };

  const fetchReplies = async () => {
    try {
      const res = await api.get(`/api/posts/${post.id}/comments`);
      setReplies(res.data);
    } catch (err) {
      console.error("Error fetching replies", err);
    }
  };

  const toggleReplies = () => {
    const nextState = !showReplies;
    setShowReplies(nextState);
    if (nextState) {
      fetchReplies();
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please log in first.");
      return;
    }
    if (!replyText.trim()) return;

    setIsReplying(true);
    setCommentSecurityBlock(null);

    try {
      const res = await api.post(`/api/posts/${post.id}/comments`, {
        user_id: user.id,
        content: replyText
      });

      if (res.status === 200) {
        toast.success("Reply posted safely!");
        setReplyText('');
        fetchReplies();
        setPost(prev => ({ ...prev, comments_count: prev.comments_count + 1 }));
      }
    } catch (err: any) {
      console.error("Error creating comment", err);
      if (err.response && err.response.status === 400) {
        const detail = err.response.data.detail;
        if (detail && detail.error === "Security Blocked") {
          setCommentSecurityBlock({
            violation_type: detail.violation_type,
            reason: sanitizeError(detail.reason)
          });
          toast.error(`Blocked: ${detail.violation_type.replace('_', ' ').toUpperCase()}`);
        } else {
          toast.error(sanitizeError(err.response.data.detail) || "Error posting comment.");
        }
      } else {
        toast.error("Failed to post reply.");
      }
    } finally {
      setIsReplying(false);
    }
  };

  const fileUrl = post.file_path ? `http://127.0.0.1:8000${post.file_path}` : null;
  const filename = post.file_path ? post.file_path.split('/').pop() : '';

  return (
    <div className="w-full flex flex-col p-5 tweet-card-border bg-cream-light dark:bg-darkbg-main hover:bg-cream-dark/10 dark:hover:bg-darkbg-pill/5 transition-colors">
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="h-10 w-10 rounded-full bg-cream-dark dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark overflow-hidden flex items-center justify-center flex-shrink-0">
          {post.avatar_url ? (
            <img src={post.avatar_url.startsWith('http') ? post.avatar_url : `http://127.0.0.1:8000${post.avatar_url}`} alt={post.username} className="h-full w-full object-cover" />
          ) : (
            <span className="font-serif font-semibold text-slate-muted uppercase text-sm">{post.username[0]}</span>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-[0.95rem] text-ink-dark dark:text-ink-light">{post.display_name}</span>
              <span className="text-xs text-slate-muted dark:text-slate-mutedDark">@{post.username}</span>
              <span className="text-xs text-slate-muted dark:text-slate-mutedDark">•</span>
              <span className="text-xs text-slate-muted dark:text-slate-mutedDark">{formatTime(post.created_at)}</span>
              {post.community_name && (
                <span className="bg-cream-dark dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark text-xs px-2 py-0.5 rounded-full text-slate-muted">
                  in {post.community_name}
                </span>
              )}
            </div>
            {/* Moderation tag in green */}
            <div className="flex items-center gap-1 text-[0.7rem] font-bold text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>SAFE</span>
            </div>
          </div>

          {/* Post Content */}
          <div className="text-[1.05rem] text-left leading-relaxed text-ink-dark dark:text-ink-light mt-2 whitespace-pre-wrap">
            {post.content}
          </div>

          {/* Attachments */}
          {fileUrl && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-fine-light dark:border-fine-dark max-w-xl">
              {post.file_type === 'image' && (
                <img
                  src={fileUrl}
                  alt="post attachment"
                  className="max-h-[350px] w-full object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-300"
                  onClick={() => window.open(fileUrl, '_blank')}
                />
              )}
              {post.file_type === 'document' && (
                <div
                  onClick={() => window.open(fileUrl, '_blank')}
                  className="p-4 bg-cream-dark/20 dark:bg-darkbg-pill/20 hover:bg-cream-dark/40 dark:hover:bg-darkbg-pill/40 transition-colors flex items-center gap-3 cursor-pointer"
                >
                  <Bookmark className="h-6 w-6 text-accent-warm" />
                  <div className="flex flex-col items-start">
                    <span className="font-semibold text-sm text-ink-dark dark:text-ink-light truncate max-w-xs">{filename}</span>
                    <span className="text-xs text-slate-muted dark:text-slate-mutedDark">Open attached document</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between text-slate-muted dark:text-slate-mutedDark mt-4 max-w-md border-t border-fine-light/35 dark:border-fine-dark/35 pt-3">
            {/* Reply Icon */}
            <button
              onClick={toggleReplies}
              className="flex items-center gap-1.5 hover:text-accent-warm transition-colors text-sm group"
            >
              <div className="p-2 rounded-full group-hover:bg-accent-warm/10 transition-colors">
                <MessageCircle className="h-4 w-4" />
              </div>
              <span>{post.comments_count}</span>
            </button>

            {/* Repost Icon */}
            <button
              onClick={handleRepost}
              className={`flex items-center gap-1.5 hover:text-green-500 transition-colors text-sm group ${
                hasReposted ? 'text-green-500' : ''
              }`}
            >
              <div className="p-2 rounded-full group-hover:bg-green-500/10 transition-colors">
                <Repeat2 className="h-4 w-4" />
              </div>
              <span>{repostCount}</span>
            </button>

            {/* Like Icon */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 hover:text-red-500 transition-colors text-sm group ${
                post.user_liked > 0 ? 'text-red-500 font-semibold' : ''
              }`}
            >
              <div className="p-2 rounded-full group-hover:bg-red-500/10 transition-colors">
                <Heart className={`h-4 w-4 ${post.user_liked > 0 ? 'fill-current text-red-500' : ''}`} />
              </div>
              <span>{post.likes_count}</span>
            </button>

            {/* Bookmark Icon */}
            <button
              onClick={handleBookmark}
              className={`hover:text-yellow-500 transition-colors text-sm group ${
                isBookmarked ? 'text-yellow-500' : ''
              }`}
            >
              <div className="p-2 rounded-full group-hover:bg-yellow-500/10 transition-colors">
                <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </div>
            </button>

            {/* Share Icon */}
            <button
              onClick={handleShare}
              className="hover:text-blue-500 transition-colors text-sm group"
            >
              <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                <Share2 className="h-4 w-4" />
              </div>
            </button>
          </div>

          {/* Interactive Comments/Replies Drawer */}
          <AnimatePresence>
            {showReplies && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden mt-4 pl-4 border-l border-fine-light dark:border-fine-dark flex flex-col gap-3"
              >
                {/* Reply Form */}
                <form onSubmit={handleReplySubmit} className="flex flex-col gap-2.5 mt-2 bg-cream-dark/10 p-2 rounded-xl border border-fine-light/40 dark:border-fine-dark/40">
                  {commentSecurityBlock && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex flex-col gap-1 text-xs">
                      <div className="flex items-center gap-1 font-bold">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>Blocked: {commentSecurityBlock.violation_type}</span>
                      </div>
                      <span>{commentSecurityBlock.reason}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a reply..."
                      value={replyText}
                      onChange={(e) => {
                        setReplyText(e.target.value);
                        if (commentSecurityBlock) setCommentSecurityBlock(null);
                      }}
                      className="flex-1 bg-transparent text-sm py-2 px-3 focus:outline-none placeholder-slate-muted border border-fine-light dark:border-fine-dark rounded-full text-ink-dark dark:text-ink-light"
                    />
                    <button
                      type="submit"
                      disabled={isReplying || !replyText.trim()}
                      className="text-xs px-4 py-2 bg-ink-dark dark:bg-ink-light text-cream-light dark:text-darkbg-main font-bold rounded-full disabled:opacity-50"
                    >
                      {isReplying ? 'Replying...' : 'Reply'}
                    </button>
                  </div>
                </form>

                {/* Replies List */}
                <div className="flex flex-col gap-3 mt-1 max-h-72 overflow-y-auto pr-1">
                  {replies.length === 0 ? (
                    <span className="text-xs text-slate-muted dark:text-slate-mutedDark text-left py-2 italic pl-2">No replies yet.</span>
                  ) : (
                    replies.map((comm) => (
                      <div key={comm.id} className="flex gap-3 bg-cream-dark/20 dark:bg-darkbg-pill/10 p-3 rounded-xl border border-fine-light/30">
                        {/* Reply Avatar */}
                        <div className="h-8 w-8 rounded-full bg-cream-dark dark:bg-darkbg-pill overflow-hidden flex items-center justify-center border border-fine-light dark:border-fine-dark flex-shrink-0">
                          {comm.avatar_url ? (
                            <img src={comm.avatar_url.startsWith('http') ? comm.avatar_url : `http://127.0.0.1:8000${comm.avatar_url}`} alt={comm.username} className="h-full w-full object-cover" />
                          ) : (
                            <span className="font-serif font-semibold text-slate-muted uppercase text-xs">{comm.username[0]}</span>
                          )}
                        </div>
                        <div className="flex-grow flex flex-col items-start">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-ink-dark dark:text-ink-light">{comm.display_name}</span>
                            <span className="text-[0.65rem] text-slate-muted">@{comm.username}</span>
                            <span className="text-[0.65rem] text-slate-muted">•</span>
                            <span className="text-[0.65rem] text-slate-muted">{formatTime(comm.created_at)}</span>
                          </div>
                          <span className="text-[0.9rem] text-left text-ink-dark dark:text-ink-light mt-1 whitespace-pre-wrap">{comm.content}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

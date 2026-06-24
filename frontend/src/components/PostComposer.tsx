import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Paperclip, X, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import { toast } from 'sonner';

interface PostComposerProps {
  onPostCreated: () => void;
  communityId?: number | null;
  placeholder?: string;
  modalMode?: boolean;
  onCloseModal?: () => void;
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

export default function PostComposer({
  onPostCreated,
  communityId = null,
  placeholder = "What are you thinking about?",
  modalMode = false,
  onCloseModal
}: PostComposerProps) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'document' | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  
  // Security Block state (displayed when safety engine triggers)
  const [securityBlock, setSecurityBlock] = useState<{
    violation_type: string;
    reason: string;
  } | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (securityBlock) setSecurityBlock(null); // Clear violation warning on edit
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setFileType('image');
      setFilePreview(URL.createObjectURL(selected));
      setSecurityBlock(null);
    }
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setFileType('document');
      setFilePreview(null);
      setSecurityBlock(null);
    }
  };

  const removeAttachment = () => {
    setFile(null);
    setFileType(null);
    setFilePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please log in first.");
      return;
    }

    if (!content.trim() && !file) {
      toast.warning("Post content cannot be empty.");
      return;
    }

    setIsPosting(true);
    setSecurityBlock(null);

    try {
      const formData = new FormData();
      formData.append('user_id', String(user.id));
      formData.append('username', user.username);
      formData.append('content', content);
      
      if (file) {
        formData.append('file', file);
      }
      if (communityId) {
        formData.append('community_id', String(communityId));
      }

      const res = await api.post('/api/posts', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.status === 200) {
        toast.success("Thought shared safely!");
        setContent('');
        removeAttachment();
        onPostCreated();
        if (modalMode && onCloseModal) {
          onCloseModal();
        }
      }
    } catch (err: any) {
      console.error("Posting error", err);
      if (err.response && err.response.status === 400) {
        const detail = err.response.data.detail;
        if (detail && detail.error === "Security Blocked") {
          // Safety violation detected! Show warning panel
          setSecurityBlock({
            violation_type: detail.violation_type,
            reason: sanitizeError(detail.reason),
          });
          toast.error(`Blocked: ${detail.violation_type.replace('_', ' ').toUpperCase()}`);
        } else {
          toast.error(sanitizeError(err.response.data.detail) || "Error creating post.");
        }
      } else {
        toast.error("Network error. Cannot reach backend API.");
      }
    } finally {
      setIsPosting(false);
    }
  };

  const maxChars = 280;
  const progressPercent = Math.min((content.length / maxChars) * 100, 100);

  return (
    <div className="w-full flex flex-col p-4 border-b border-fine-light dark:border-fine-dark bg-cream-light dark:bg-darkbg-main transition-colors">
      {/* Security Block Alert */}
      {securityBlock && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex flex-col gap-1.5 animate-pulse">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>🛡️ SECURITY INTRUSION DETECTED & BLOCKED</span>
            <span className="ml-auto bg-red-500 text-white text-[0.7rem] px-2 py-0.5 rounded-full uppercase font-black">
              {securityBlock.violation_type}
            </span>
          </div>
          <span className="text-xs text-ink-dark/80 dark:text-ink-light/80">
            <strong>Reason:</strong> {securityBlock.reason}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-4">
        {/* Avatar */}
        <div className="h-11 w-11 rounded-full bg-cream-dark dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark overflow-hidden flex items-center justify-center flex-shrink-0 mt-1">
          {user?.avatar_url ? (
            <img src={user.avatar_url.startsWith('http') ? user.avatar_url : `http://127.0.0.1:8000${user.avatar_url}`} alt={user.username} className="h-full w-full object-cover" />
          ) : (
            <span className="font-serif font-semibold text-slate-muted uppercase text-sm">{user?.username[0] || 'Y'}</span>
          )}
        </div>

        {/* Input & Actions */}
        <div className="flex-1 flex flex-col gap-3">
          <textarea
            value={content}
            onChange={handleTextChange}
            placeholder={placeholder}
            className="w-full bg-transparent resize-none border-none text-[1.1rem] placeholder-slate-muted dark:placeholder-slate-mutedDark focus:outline-none min-h-[75px] text-ink-dark dark:text-ink-light"
          />

          {/* Attachment Previews */}
          {file && (
            <div className="relative rounded-xl overflow-hidden border border-fine-light dark:border-fine-dark max-w-md bg-cream-dark/30 dark:bg-darkbg-pill/30">
              {fileType === 'image' && filePreview && (
                <img src={filePreview} alt="upload preview" className="w-full max-h-60 object-cover" />
              )}
              {fileType === 'document' && (
                <div className="p-4 flex items-center gap-3 text-sm text-slate-muted dark:text-slate-mutedDark">
                  <Paperclip className="h-5 w-5 text-accent-warm" />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-ink-dark dark:text-ink-light truncate max-w-xs">{file.name}</span>
                    <span>{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={removeAttachment}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/65 text-white hover:bg-black/80 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Composer Footer Actions */}
          <div className="flex items-center justify-between border-t border-fine-light/40 dark:border-fine-dark/40 pt-3">
            <div className="flex items-center gap-1.5">
              {/* Image Input Trigger */}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="p-2 rounded-full hover:bg-cream-dark dark:hover:bg-darkbg-pill text-accent-warm transition-colors"
                title="Add photo"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageChange}
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="hidden"
              />

              {/* Doc Input Trigger */}
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="p-2 rounded-full hover:bg-cream-dark dark:hover:bg-darkbg-pill text-accent-warm transition-colors"
                title="Attach document"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                type="file"
                ref={docInputRef}
                onChange={handleDocChange}
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-4">
              {/* Circular Character Counter */}
              {content.length > 0 && (
                <div className="relative h-5 w-5 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="transparent"
                      className="text-cream-dark dark:text-darkbg-pill"
                    />
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 8}
                      strokeDashoffset={2 * Math.PI * 8 * (1 - progressPercent / 100)}
                      className={`${
                        content.length >= maxChars - 20
                          ? 'text-red-500'
                          : 'text-accent-warm'
                      } transition-all duration-150`}
                    />
                  </svg>
                  <span className="hidden text-[0.6rem] font-bold text-slate-muted">
                    {maxChars - content.length}
                  </span>
                </div>
              )}

              {/* Post Submit Button */}
              <button
                type="submit"
                disabled={isPosting || (!content.trim() && !file) || content.length > maxChars}
                className="px-5 py-2 rounded-full bg-slate-400 dark:bg-darkbg-pill text-white dark:text-slate-mutedDark font-semibold text-sm disabled:opacity-50 enabled:bg-ink-dark enabled:dark:bg-ink-light enabled:dark:text-darkbg-main enabled:hover:opacity-90 active:scale-95 transition-all"
              >
                {isPosting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

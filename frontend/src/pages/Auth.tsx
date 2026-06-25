import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import { toast } from 'sonner';
import { ShieldCheck, Mail, Lock, User, Sparkles } from 'lucide-react';

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

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        // Log In
        if (!username || !password) {
          toast.warning("Username/Email and Password are required.");
          setIsLoading(false);
          return;
        }
        
        const res = await api.post('/api/auth/login', {
          identifier: username,
          password
        });
        
        login(res.data);
        toast.success(`Welcome back, @${res.data.username}!`);
        navigate('/home');
      } else {
        // Register
        if (!username || !email || !password || !displayName) {
          toast.warning("All fields are required to create an account.");
          setIsLoading(false);
          return;
        }
        
        if (password.length < 6) {
          toast.warning("Password must be at least 6 characters long.");
          setIsLoading(false);
          return;
        }
        
        const res = await api.post('/api/auth/register', {
          username,
          email,
          password,
          display_name: displayName
        });
        
        // Auto login on success
        const loginRes = await api.post('/api/auth/login', {
          identifier: res.data.username,
          password
        });
        
        login(loginRes.data);
        toast.success("Account created successfully! Welcome to Sentio.");
        navigate('/home');
      }
    } catch (err: any) {
      console.error("Auth error", err);
      if (err.response && err.response.data && err.response.data.detail) {
        const detail = err.response.data.detail;
        if (detail.error === "Security Blocked") {
          toast.error(`Security Blocked: ${sanitizeError(detail.reason)}`);
        } else {
          toast.error(sanitizeError(detail) || "Authentication failed.");
        }
      } else {
        toast.error("Network error. Backend API is unreachable.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-light dark:bg-darkbg-main py-12 px-4 sm:px-6 lg:px-8 select-none transition-colors">
      <div className="max-w-md w-full space-y-8 bg-cream-light dark:bg-darkbg-card border border-fine-light dark:border-fine-dark p-8 rounded-3xl shadow-premium dark:shadow-premiumDark relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-accent-warm/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-accent-warm/10 blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center">
          <div className="h-14 w-14 rounded-full bg-ink-dark dark:bg-ink-light text-cream-light dark:text-darkbg-main font-serif font-black text-2xl flex items-center justify-center shadow-md">
            S
          </div>
          <h2 className="mt-4 text-center font-serif text-3xl font-bold tracking-tight text-ink-dark dark:text-ink-light">
            {isLogin ? 'Sign in to Sentio' : 'Join Sentio today'}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-muted dark:text-slate-mutedDark">
            Feel Heard. Stay Safe.
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleAuthSubmit}>
          <div className="flex flex-col gap-3">
            {/* Display Name Input (Register Only) */}
            {!isLogin && (
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none focus:border-accent-warm transition-all"
                />
                <Sparkles className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-muted" />
              </div>
            )}

            {/* Username / Identifier Input */}
            <div className="relative">
              <input
                type="text"
                required
                placeholder={isLogin ? "Username or Email" : "Username"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none focus:border-accent-warm transition-all"
              />
              <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-muted" />
            </div>

            {/* Email Input (Register Only) */}
            {!isLogin && (
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none focus:border-accent-warm transition-all"
                />
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-muted" />
              </div>
            )}

            {/* Password Input */}
            <div className="relative">
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-cream-dark/30 dark:bg-darkbg-pill/30 border border-fine-light dark:border-fine-dark text-ink-dark dark:text-ink-light focus:outline-none focus:border-accent-warm transition-all"
              />
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-muted" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs py-1">
            <div className="flex items-center gap-1 text-slate-muted dark:text-slate-mutedDark">
              <ShieldCheck className="h-4.5 w-4.5 text-green-500" />
              <span>Real-time AI Moderation active</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 rounded-xl bg-ink-dark dark:bg-ink-light text-cream-light dark:text-darkbg-main font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
            }}
            className="text-xs text-accent-warm font-semibold hover:underline"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

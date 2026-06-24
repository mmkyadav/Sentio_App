import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Compass, Bell, Bookmark, User, PenSquare, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface SidebarProps {
  onOpenNewPostModal: () => void;
}

export default function Sidebar({ onOpenNewPostModal }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Explore', path: '/explore', icon: Compass },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Bookmarks', path: '/bookmarks', icon: Bookmark },
    { name: 'Profile', path: `/profile/${user?.username || 'you'}`, icon: User },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="w-64 h-screen sticky top-0 flex flex-col justify-between py-6 px-4 border-r border-fine-light dark:border-fine-dark select-none sidebar-blur">
      <div className="flex flex-col gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 cursor-pointer" onClick={() => navigate('/home')}>
          <div className="h-10 w-10 rounded-full bg-ink-dark dark:bg-ink-light flex items-center justify-center text-cream-light dark:text-darkbg-main font-serif font-bold text-xl">
            S
          </div>
          <span className="font-serif font-bold text-2xl tracking-wide text-ink-dark dark:text-ink-light">Sentio</span>
        </div>

        {/* Navigation links */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-full font-medium transition-all duration-200 text-[1.05rem] ${
                  isActive
                    ? 'bg-cream-dark dark:bg-darkbg-pill text-accent-warm font-semibold'
                    : 'text-slate-muted dark:text-slate-mutedDark hover:bg-cream-dark/50 dark:hover:bg-darkbg-pill/40 hover:text-ink-dark dark:hover:text-ink-light'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* New Post Button */}
        <button
          onClick={onOpenNewPostModal}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-full bg-ink-dark dark:bg-ink-light text-cream-light dark:text-darkbg-main font-semibold text-[1.05rem] hover:opacity-90 active:scale-95 transition-all duration-200 shadow-md"
        >
          <PenSquare className="h-4 w-4" />
          <span>New post</span>
        </button>
      </div>

      {/* User Footer Profile */}
      {user && (
        <div className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-fine-light dark:hover:border-fine-dark hover:bg-cream-dark/30 dark:hover:bg-darkbg-pill/20 transition-all duration-200">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${user.username}`)}>
            <div className="h-10 w-10 rounded-full bg-cream-dark dark:bg-darkbg-pill border border-fine-light dark:border-fine-dark overflow-hidden flex items-center justify-center">
              {user.avatar_url ? (
                <img src={user.avatar_url.startsWith('http') ? user.avatar_url : `http://127.0.0.1:8000${user.avatar_url}`} alt={user.username} className="h-full w-full object-cover" />
              ) : (
                <span className="font-serif font-semibold text-slate-muted uppercase">{user.username[0]}</span>
              )}
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-sm text-ink-dark dark:text-ink-light">{user.display_name}</span>
              <span className="text-xs text-slate-muted dark:text-slate-mutedDark">@{user.username}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-cream-dark dark:hover:bg-darkbg-pill text-slate-muted dark:text-slate-mutedDark hover:text-red-500 dark:hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}

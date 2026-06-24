import { create } from 'zustand';

export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  location?: string;
  website?: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Load initial user from localStorage if present
  const storedUser = localStorage.getItem('sentio_user');
  let initialUser: User | null = null;
  
  if (storedUser) {
    try {
      initialUser = JSON.parse(storedUser);
    } catch (e) {
      console.error("Failed to parse stored user session", e);
    }
  }

  return {
    user: initialUser,
    login: (user) => {
      localStorage.setItem('sentio_user', JSON.stringify(user));
      set({ user });
    },
    logout: () => {
      localStorage.removeItem('sentio_user');
      set({ user: null });
    },
    updateUser: (updatedFields) => {
      set((state) => {
        if (!state.user) return state;
        const newUser = { ...state.user, ...updatedFields };
        localStorage.setItem('sentio_user', JSON.stringify(newUser));
        return { user: newUser };
      });
    },
  };
});

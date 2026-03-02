import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { api, type AuthenticatedUser, configureApiAuth } from '@/lib/api';

interface AuthState {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      async login(email, password) {
        const result = await api.auth.login({ email, password });
        set({
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
      },

      async logout() {
        const token = get().refreshToken;
        if (token) {
          try {
            await api.auth.logout(token);
          } catch {
            // Ignore logout request errors and clear client state.
          }
        }

        set({ user: null, accessToken: null, refreshToken: null });
      },

      setTokens(tokens) {
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });
      },
    }),
    {
      name: 'radvault-auth',
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? noopStorage : sessionStorage,
      ),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);

configureApiAuth({
  getTokens: () => {
    const state = useAuthStore.getState();
    return {
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
    };
  },
  setTokens: (tokens) => {
    useAuthStore.getState().setTokens(tokens);
  },
  clearAuth: () => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
  },
});

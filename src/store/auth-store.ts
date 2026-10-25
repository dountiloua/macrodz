import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

type AuthState = {
  initialized: boolean;
  session: Session | null;
  user: User | null;
  setSession: (session: Session | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
};

let authSubscriptionInitialized = false;

export const useAuthStore = create<AuthState>((set) => ({
  initialized: false,
  session: null,
  user: null,

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
    });
  },

  initialize: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      set({
        session: data.session,
        user: data.session?.user ?? null,
        initialized: true,
      });

      if (!authSubscriptionInitialized) {
        authSubscriptionInitialized = true;
        supabase.auth.onAuthStateChange((_event, session) => {
          set({
            session,
            user: session?.user ?? null,
            initialized: true,
          });
        });
      }
    } catch {
      set({ initialized: true });
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      set({ session: null, user: null });
    }
  },
}));

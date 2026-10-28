import type { AuthError, Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { AuthCredentials, SignUpCredentials } from '@/features/auth';
import {
  fetchProfileFromSupabase,
  syncProfileAndUpdatePending,
} from '@/features/auth/sync-profile';
import { supabase } from '@/lib/supabase';
import { useProfileStore, waitForProfileHydration } from '@/store/profile-store';

type AuthActionResult = {
  error: AuthError | null;
  session: Session | null;
};

type AuthState = {
  initialized: boolean;
  session: Session | null;
  user: User | null;
  setSession: (session: Session | null) => void;
  initialize: () => Promise<void>;
  signIn: (credentials: AuthCredentials) => Promise<AuthActionResult>;
  signUp: (credentials: SignUpCredentials) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
};

let authSubscriptionInitialized = false;
const userProfileOperations = new Map<string, Promise<void>>();

function isCurrentUser(userId: string): boolean {
  return useAuthStore.getState().user?.id === userId;
}

function processAuthenticatedUser(userId: string): Promise<void> {
  const existingOperation = userProfileOperations.get(userId);
  if (existingOperation) {
    return existingOperation;
  }

  const operation = (async () => {
    await waitForProfileHydration();
    if (!isCurrentUser(userId)) {
      return;
    }

    const profileStore = useProfileStore.getState();
    profileStore.setUserId(userId);
    const { profile, targets, pendingSync } = useProfileStore.getState();

    if (profile && targets) {
      if (pendingSync) {
        const result = await syncProfileAndUpdatePending(profile, targets, userId);
        if (!result.ok) {
          console.warn('Pending profile sync will be retried later.', result.error);
        }
      }
      return;
    }

    const result = await fetchProfileFromSupabase(userId);
    if (!result.ok) {
      console.warn('Unable to fetch the signed-in user profile.', result.error);
      return;
    }

    if (result.data && isCurrentUser(userId)) {
      useProfileStore
        .getState()
        .saveProfile(result.data.profile, result.data.targets, userId, false);
    }
  })().finally(() => {
    userProfileOperations.delete(userId);
  });

  userProfileOperations.set(userId, operation);
  return operation;
}

async function clearSignedOutProfile() {
  await waitForProfileHydration();
  if (useAuthStore.getState().user !== null) {
    return;
  }

  useProfileStore.getState().resetProfile();
}

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
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }

      const session = data.session;
      set({
        session,
        user: session?.user ?? null,
      });

      if (session?.user) {
        await processAuthenticatedUser(session.user.id);
      } else {
        await waitForProfileHydration();
        useProfileStore.getState().setUserId(null);
      }

      set({ initialized: true });

      if (!authSubscriptionInitialized) {
        authSubscriptionInitialized = true;
        supabase.auth.onAuthStateChange((_event, nextSession) => {
          set({
            session: nextSession,
            user: nextSession?.user ?? null,
            initialized: true,
          });

          void Promise.resolve().then(async () => {
            if (nextSession?.user) {
              await processAuthenticatedUser(nextSession.user.id);
            } else {
              await clearSignedOutProfile();
            }
          });
        });
      }
    } catch (error) {
      console.error('Unable to initialize authentication.', error);
      set({ initialized: true, session: null, user: null });
      await waitForProfileHydration();
      useProfileStore.getState().setUserId(null);
    }
  },

  signIn: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error, session: null };
    }

    set({
      session: data.session,
      user: data.session?.user ?? null,
      initialized: true,
    });
    if (data.session?.user) {
      await processAuthenticatedUser(data.session.user.id);
    }
    return { error: null, session: data.session };
  },

  signUp: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { error, session: null };
    }

    if (data.session) {
      set({
        session: data.session,
        user: data.session.user,
        initialized: true,
      });
      await processAuthenticatedUser(data.session.user.id);
    }
    return { error: null, session: data.session };
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } finally {
      set({ session: null, user: null });
      await clearSignedOutProfile();
    }
  },
}));

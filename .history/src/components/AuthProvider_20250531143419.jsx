"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

// Create auth context
const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check for user session on initial load
  useEffect(() => {
    async function getSession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Error getting session:", error);
        setUser(null);
      } else if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }

      setLoading(false);
    }

    getSession();

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Get the latest user data after sign in
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    // Return both the auth data and the user
    return { ...data, user };
  };

  // Sign up with email and password
  const signUp = async (email, password, metadata = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error("Detailed signup error:", error);
        throw error;
      }

      return data;
    } catch (err) {
      console.error("Signup exception:", err);
      throw err;
    }
  };

  // Sign in with OAuth provider
  const signInWithProvider = async (provider) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
    return data;
  };

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    router.push("/");
  };

  // Reset password
  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) throw error;
    return data;
  };

  // Update user profile
  const updateProfile = async (updates) => {
    const { data, error } = await supabase.auth.updateUser({
      data: updates,
    });

    if (error) throw error;
    return data;
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signInWithProvider,
    signOut,
    resetPassword,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// assets/js/auth.js
import { supabase } from './supabase.js';

export const Auth = {
    async signUp(email, password, displayName, role = 'student') {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName,
                    role: role
                }
            }
        });
        return { data, error };
    },

    async signInWithGoogle() {
        // Dynamically build the redirect URL based on the current domain and path.
        // This ensures it works on localhost, GitHub Pages, and Vercel without domain mismatch.
        const redirectUrl = window.location.origin + window.location.pathname;
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
        });
        return { data, error };
    },

    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        return { data, error };
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        return { error };
    },

    async getSession() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },

    async getProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        return { data, error };
    },

    async updateProfile(userId, data) {
        const { error } = await supabase
            .from('profiles')
            .update(data)
            .eq('id', userId);
        return { error };
    },

    async updateProfileRole(userId, role) {
        const { error } = await supabase
            .from('profiles')
            .update({ role: role })
            .eq('id', userId);
        return { error };
    },

    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange(callback);
    }
};

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
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
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

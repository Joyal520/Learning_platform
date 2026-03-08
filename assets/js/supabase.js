// assets/js/supabase.js

// IMPORTANT: Replace with your actual project URL and Anon Key
const SUPABASE_URL = 'https://scwvbyfnnufnlimbswnk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_C2V14zNYsM-H5jtRZOQahw_yxdhpV9z';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

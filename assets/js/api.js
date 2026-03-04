// assets/js/api.js
import { supabase } from './supabase.js';

// Helper: wrap a promise with a timeout
function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`TIMEOUT: ${label} took more than ${ms / 1000}s`)), ms)
        )
    ]);
}

export const API = {
    // Submissions
    async getSubmissions(category = null, sort = 'created_at', limit = 20) {
        // Optimized: only select fields needed for the card grid to save bandwidth/memory
        let query = supabase
            .from('submissions')
            .select(`
                id,
                title,
                category,
                author_id,
                thumbnail_path,
                status,
                created_at,
                profiles!author_id (display_name)
            `)
            .eq('status', 'approved');

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query
            .order(sort, { ascending: false })
            .limit(limit);

        return { data, error };
    },


    async uploadSubmission(submissionData, file = null) {
        console.log('[API] === UPLOAD START ===');
        console.log('[API] Origin:', window.location.origin);
        console.log('[API] Data:', JSON.stringify(submissionData, null, 2));

        try {
            // Step 1: Plain INSERT — no .select() to avoid any RLS/hang issues
            console.log('[API] Step 1: Inserting into submissions table...');

            const insertResult = await withTimeout(
                supabase.from('submissions').insert([submissionData]),
                15000,
                'Database INSERT'
            );

            console.log('[API] Step 1 raw result:', insertResult);

            if (insertResult.error) {
                console.error('[API] ❌ INSERT FAILED:', insertResult.error);
                return { error: insertResult.error };
            }

            console.log('[API] ✅ INSERT succeeded!');

            // Step 2: If we need the ID (for file upload), query it separately
            if (file) {
                console.log('[API] Step 2: Getting submission ID...');
                const { data: rows } = await withTimeout(
                    supabase
                        .from('submissions')
                        .select('id')
                        .eq('author_id', submissionData.author_id)
                        .eq('title', submissionData.title)
                        .order('created_at', { ascending: false })
                        .limit(1),
                    10000,
                    'Get submission ID'
                );

                const sub = rows?.[0];
                if (!sub) {
                    console.warn('[API] Could not find inserted submission for file upload');
                    return { data: { id: 'unknown' }, error: null };
                }

                console.log('[API] Step 3: Uploading file to storage...');
                console.log('[API] File:', { name: file.name, type: file.type, size: file.size });

                const { data: { user } } = await supabase.auth.getUser();
                const fileExt = file.name.split('.').pop();
                const filePath = `${user.id}/${sub.id}.${fileExt}`;

                const { error: uploadError } = await withTimeout(
                    supabase.storage
                        .from('submissions_private')
                        .upload(filePath, file),
                    30000,
                    'File upload to storage'
                );

                if (uploadError) {
                    console.error('[API] ❌ File upload failed:', uploadError);
                    await supabase.from('submissions').delete().eq('id', sub.id);
                    return { error: uploadError };
                }

                console.log('[API] Step 4: Updating file path...');
                await supabase
                    .from('submissions')
                    .update({ file_path: filePath, file_type: file.type })
                    .eq('id', sub.id);
            }

            console.log('[API] === UPLOAD COMPLETE ✅ ===');
            return { data: { id: 'success' }, error: null };

        } catch (err) {
            console.error('[API] ❌ UNEXPECTED ERROR:', err);
            UI.showToast(`Upload failed: ${err.message}`, 'error');
            return { error: { message: err.message || 'Upload failed unexpectedly' } };
        }
    },

    async updateSubmission(id, updateData) {
        console.log('[API] === UPDATE START ===', id, updateData);
        try {
            // Remove .select() to speed up and avoid potential RLS/returning issues
            // Increase timeout to 30s for larger payloads
            const { data, error } = await withTimeout(
                supabase
                    .from('submissions')
                    .update(updateData)
                    .eq('id', id),
                30000,
                'Database UPDATE'
            );

            if (error) {
                console.error('[API] ❌ UPDATE FAILED:', error);
                return { error };
            }

            console.log('[API] ✅ UPDATE succeeded!');
            return { data, error: null };
        } catch (err) {
            console.error('[API] ❌ UNEXPECTED UPDATE ERROR:', err);
            return { error: { message: err.message || 'Update failed unexpectedly' } };
        }
    }
};

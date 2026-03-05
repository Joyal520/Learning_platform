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
        // Optimized: only select fields needed for the card grid
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

        if (error || !data || data.length === 0) return { data, error };

        // Initialize stats to 0 so UI renders immediately without waiting for the slow view query
        data.forEach(sub => {
            sub.submission_stats = [{ avg_rating: 0, like_count: 0 }];
        });

        return { data, error };
    },

    async getStatsForSubmissions(ids) {
        if (!ids || ids.length === 0) return {};
        try {
            const { data: statsData } = await supabase
                .from('submission_stats')
                .select('id, avg_rating, like_count')
                .in('id', ids);

            const statsMap = {};
            if (statsData) {
                statsData.forEach(s => { statsMap[s.id] = s; });
            }
            return statsMap;
        } catch (e) {
            console.warn('[API] Could not fetch stats:', e.message);
            return {};
        }
    },



    async uploadSubmission(submissionData, file = null) {
        console.log('[API] === UPLOAD START ===');
        console.log('[API] Origin:', window.location.origin);
        console.log('[API] Data:', JSON.stringify(submissionData, null, 2));

        try {
            // Step 1: Insert with .select() to get the ID directly
            console.log('[API] Step 1: Inserting into submissions table...');

            const insertResult = await withTimeout(
                supabase.from('submissions').insert([submissionData]).select(),
                60000,
                'Database INSERT'
            );

            console.log('[API] Step 1 raw result:', insertResult);

            if (insertResult.error) {
                console.error('[API] ❌ INSERT FAILED:', insertResult.error);
                return { error: insertResult.error };
            }

            console.log('[API] ✅ INSERT succeeded!');

            // Step 2: Use the returned ID for file upload
            if (file) {
                const sub = insertResult.data?.[0];
                if (!sub) {
                    console.warn('[API] Could not find inserted submission for file upload');
                    return { data: { id: 'unknown' }, error: null };
                }

                console.log('[API] Step 3: Uploading file to storage...');
                console.log('[API] File:', { name: file.name, type: file.type, size: file.size });

                const fileExt = file.name.split('.').pop();
                const filePath = `${submissionData.author_id}/${sub.id}.${fileExt}`;

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
                await withTimeout(
                    supabase
                        .from('submissions')
                        .update({ file_path: filePath, file_type: file.type })
                        .eq('id', sub.id),
                    10000,
                    'Update file path'
                );
            }

            console.log('[API] === UPLOAD COMPLETE ✅ ===');
            return { data: { id: 'success' }, error: null };

        } catch (err) {
            console.error('[API] ❌ UNEXPECTED ERROR:', err);
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
                20000, // Reduced from 30s to be more aggressive in timing out
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

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
                thumbnail_url,
                status,
                created_at,
                updated_at,
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



    async uploadSubmission(submissionData, file = null, thumbnailBlob = null, displayBlob = null) {
        console.log('[API] === UPLOAD START ===');
        try {
            // Step 1: Insert to get the ID
            const { data: sub, error: insertError } = await withTimeout(
                supabase.from('submissions').insert([submissionData]).select().single(),
                30000,
                'Database INSERT'
            );

            if (insertError) throw insertError;
            const subId = sub.id;
            const updateObject = {};

            // Step 2: Handle high-performance images
            if (thumbnailBlob) {
                const thumbPath = `thumbnails/${subId}.webp`;
                console.log('[API] 📤 Uploading thumbnail...');
                const { error: tErr } = await supabase.storage.from('approved_public').upload(thumbPath, thumbnailBlob, {
                    contentType: 'image/webp', upsert: true
                });
                if (tErr) console.error('[API] ❌ Thumbnail storage error:', tErr);
                else {
                    const { data } = supabase.storage.from('approved_public').getPublicUrl(thumbPath);
                    updateObject.thumbnail_url = data.publicUrl;
                }
            }

            if (displayBlob) {
                const imgPath = `images/${subId}.webp`;
                console.log('[API] 📤 Uploading display image...');
                const { error: iErr } = await supabase.storage.from('approved_public').upload(imgPath, displayBlob, {
                    contentType: 'image/webp', upsert: true
                });
                if (iErr) console.error('[API] ❌ Display storage error:', iErr);
                else {
                    const { data } = supabase.storage.from('approved_public').getPublicUrl(imgPath);
                    updateObject.image_url = data.publicUrl;
                }
            }

            // Step 3: Upload main file if present
            if (file) {
                const fileExt = file.name.split('.').pop();
                const filePath = `${submissionData.author_id}/${subId}.${fileExt}`;
                const { error: fErr } = await supabase.storage.from('submissions_private').upload(filePath, file);
                if (!fErr) {
                    updateObject.file_path = filePath;
                    updateObject.file_type = file.type;
                    updateObject.file_size = file.size;
                }
            }

            // Step 4: Final DB sync
            if (Object.keys(updateObject).length > 0) {
                await supabase.from('submissions').update(updateObject).eq('id', subId);
            }

            console.log('[API] === UPLOAD COMPLETE ✅ ===');
            return { data: sub, error: null };
        } catch (err) {
            console.error('[API] ❌ Upload failed:', err);
            return { error: err };
        }
    },

    async updateSubmission(id, updateData, thumbnailBlob = null, displayBlob = null) {
        console.log('[API] === UPDATE START ===', id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) console.warn('[API] No session found.');

            delete updateData.thumbnail_path;

            if (thumbnailBlob) {
                const thumbPath = `thumbnails/${id}.webp`;
                console.log('[API] 📤 Uploading thumbnail to Storage...');
                const { error: tErr } = await supabase.storage.from('approved_public').upload(thumbPath, thumbnailBlob, {
                    contentType: 'image/webp', upsert: true
                });
                if (tErr) {
                    console.error('[API] ❌ Thumbnail Storage Error:', tErr);
                    // Do not update the URL if upload failed
                } else {
                    const { data } = supabase.storage.from('approved_public').getPublicUrl(thumbPath);
                    updateData.thumbnail_url = data.publicUrl;
                    console.log('[API] ✅ Thumbnail stored:', data.publicUrl);
                }
            }

            if (displayBlob) {
                const imgPath = `images/${id}.webp`;
                console.log('[API] 📤 Uploading display image to Storage...');
                const { error: iErr } = await supabase.storage.from('approved_public').upload(imgPath, displayBlob, {
                    contentType: 'image/webp', upsert: true
                });
                if (iErr) {
                    console.error('[API] ❌ Display Storage Error:', iErr);
                } else {
                    const { data } = supabase.storage.from('approved_public').getPublicUrl(imgPath);
                    updateData.image_url = data.publicUrl;
                    console.log('[API] ✅ Display image stored:', data.publicUrl);
                }
            }

            console.log('[API] 💾 Updating database record...');
            const { data, error } = await withTimeout(
                supabase.from('submissions').update(updateData).eq('id', id).select(),
                30000,
                'Database UPDATE'
            );

            if (error) {
                console.error('[API] ❌ DB Update Error:', error);
                throw error;
            }

            console.log('[API] 🎊 Update succeeded!');
            return { data, error: null };
        } catch (err) {
            console.error('[API] ❌ Error in updateSubmission:', err);
            return { error: err };
        }
    }
};

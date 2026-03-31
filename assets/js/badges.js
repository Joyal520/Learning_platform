import { supabase } from './supabase.js';
import { API } from './api.js';

const CREATOR_AVERAGE_MIN_RATINGS = 5;
const QUALITY_STREAK_MIN_RATINGS = 3;

export const BADGE_DEFINITIONS = Object.freeze([
    {
        key: 'first_spark',
        name: 'First Spark',
        icon: '🚀',
        description: 'First published work',
        xp_bonus: 10,
        display_order: 1,
        is_active: true
    },
    {
        key: 'first_reaction',
        name: 'First Reaction',
        icon: '👀',
        description: 'Received your first like',
        xp_bonus: 15,
        display_order: 2,
        is_active: true
    },
    {
        key: 'first_impact',
        name: 'First Impact',
        icon: '💬',
        description: 'Earned 5 likes on one work',
        xp_bonus: 20,
        display_order: 3,
        is_active: true
    },
    {
        key: 'engaged_mind',
        name: 'Engaged Mind',
        icon: '🔁',
        description: 'Made 10 meaningful interactions on others’ work',
        xp_bonus: 20,
        display_order: 4,
        is_active: true
    },
    {
        key: 'consistent_creator',
        name: 'Consistent Creator',
        icon: '✍️',
        description: 'Published 5 works',
        xp_bonus: 25,
        display_order: 5,
        is_active: true
    },
    {
        key: 'creative_streak',
        name: 'Creative Streak',
        icon: '🔥',
        description: 'Published on 3 consecutive days',
        xp_bonus: 30,
        display_order: 6,
        is_active: true
    },
    {
        key: 'skill_builder',
        name: 'Skill Builder',
        icon: '🧠',
        description: 'Created in 3 different categories',
        xp_bonus: 30,
        display_order: 7,
        is_active: true
    },
    {
        key: 'rising_creator',
        name: 'Rising Creator',
        icon: '📈',
        description: 'Reached 50 total likes',
        xp_bonus: 35,
        display_order: 8,
        is_active: true
    },
    {
        key: 'crowd_favourite',
        name: 'Crowd Favourite',
        icon: '❤️',
        description: 'Reached 50 likes on one work',
        xp_bonus: 40,
        display_order: 9,
        is_active: true
    },
    {
        key: 'top_rated',
        name: 'Top Rated',
        icon: '🌟',
        description: 'Maintained a 4.5+ average rating',
        xp_bonus: 40,
        display_order: 10,
        is_active: true
    },
    {
        key: 'impact_creator',
        name: 'Impact Creator',
        icon: '💡',
        description: 'Built 3 works with 25+ likes each',
        xp_bonus: 45,
        display_order: 11,
        is_active: true
    },
    {
        key: 'quality_streak',
        name: 'Quality Streak',
        icon: '🏅',
        description: 'Created 3 works rated 4.0+',
        xp_bonus: 45,
        display_order: 12,
        is_active: true
    },
    {
        key: 'top_performer',
        name: 'Top Performer',
        icon: '📊',
        description: 'Reached the top 20 leaderboard',
        xp_bonus: 50,
        display_order: 13,
        is_active: true
    },
    {
        key: 'top_creator',
        name: 'Top Creator',
        icon: '👑',
        description: 'Reached the top 10 leaderboard',
        xp_bonus: 60,
        display_order: 14,
        is_active: true
    },
    {
        key: 'master_creator',
        name: 'Master Creator',
        icon: '🧩',
        description: '20 works, 150 likes, and a 4.2+ rating',
        xp_bonus: 75,
        display_order: 15,
        is_active: true
    },
    {
        key: 'edtechra_legend',
        name: 'EdTechra Legend',
        icon: '🏆',
        description: '50 works, 500 likes, top 10, and elite quality',
        xp_bonus: 120,
        display_order: 16,
        is_active: true
    }
]);

function isSchemaMissingError(error) {
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    const hint = String(error?.hint || '').toLowerCase();
    const combined = `${message} ${details} ${hint}`;
    return error?.code === '42P01'
        || error?.code === '42703'
        || error?.code === 'PGRST116'
        || error?.code === 'PGRST204'
        || combined.includes('badge_definitions')
        || combined.includes('user_badges')
        || combined.includes('equipped_badge_key')
        || combined.includes('relation')
        || combined.includes('column');
}

function createDefinitionMap(definitions = BADGE_DEFINITIONS) {
    return new Map(definitions.map((badge) => [badge.key, badge]));
}

function shouldWarnAboutBadgeState() {
    const host = String(window?.location?.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

function mergeRemoteDefinitions(remoteDefinitions = []) {
    const fallbackMap = createDefinitionMap();
    if (!Array.isArray(remoteDefinitions) || remoteDefinitions.length === 0) {
        return [...BADGE_DEFINITIONS];
    }

    const unknownKeys = remoteDefinitions
        .map((row) => row?.key)
        .filter((key) => key && !fallbackMap.has(key));

    if (unknownKeys.length > 0 && shouldWarnAboutBadgeState()) {
        console.warn('[BadgeEngine] Ignoring non-canonical badge definitions:', unknownKeys);
    }

    const merged = remoteDefinitions
        .filter((row) => fallbackMap.has(row?.key))
        .map((row) => ({
        ...(fallbackMap.get(row.key) || {}),
        ...row
        }));

    BADGE_DEFINITIONS.forEach((fallbackBadge) => {
        if (!merged.some((row) => row.key === fallbackBadge.key)) {
            merged.push({ ...fallbackBadge });
        }
    });

    return merged
        .filter((badge) => badge.is_active !== false)
        .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
}

function toDateKey(dateValue) {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
}

function computeLongestDayStreak(submissions = []) {
    const uniqueDayKeys = [...new Set(
        submissions
            .map((submission) => toDateKey(submission.created_at))
            .filter(Boolean)
    )].sort();

    if (uniqueDayKeys.length === 0) return 0;

    let longest = 1;
    let current = 1;

    for (let index = 1; index < uniqueDayKeys.length; index += 1) {
        const previous = new Date(uniqueDayKeys[index - 1]);
        const next = new Date(uniqueDayKeys[index]);
        const diffInDays = Math.round((next.getTime() - previous.getTime()) / 86400000);

        if (diffInDays === 1) {
            current += 1;
            longest = Math.max(longest, current);
        } else {
            current = 1;
        }
    }

    return longest;
}

function normalizeCategory(submission = {}) {
    return String(submission.category || submission.content_type || '')
        .trim()
        .toLowerCase();
}

function ensureNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function resolveCreatorAverage(statsBySubmission = []) {
    const totals = statsBySubmission.reduce((accumulator, stats) => {
        const ratingCount = ensureNumber(stats.rating_count);
        const averageRating = ensureNumber(stats.avg_rating);
        if (ratingCount <= 0 || averageRating <= 0) return accumulator;

        accumulator.ratingCount += ratingCount;
        accumulator.ratingSum += averageRating * ratingCount;
        return accumulator;
    }, { ratingCount: 0, ratingSum: 0 });

    return {
        averageRating: totals.ratingCount > 0 ? totals.ratingSum / totals.ratingCount : 0,
        ratingCount: totals.ratingCount
    };
}

async function fetchSubmissionStats(submissionIds = []) {
    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
        return new Map();
    }

    const baseColumns = 'id, like_count, avg_rating, view_count';
    const extendedColumns = `${baseColumns}, rating_count`;

    const primaryResult = await supabase
        .from('submission_stats')
        .select(extendedColumns)
        .in('id', submissionIds);

    if (!primaryResult.error) {
        return new Map((primaryResult.data || []).map((row) => [row.id, {
            ...row,
            rating_count: ensureNumber(row.rating_count)
        }]));
    }

    const fallbackResult = await supabase
        .from('submission_stats')
        .select(baseColumns)
        .in('id', submissionIds);

    if (fallbackResult.error) {
        throw primaryResult.error;
    }

    const ratingsResult = await supabase
        .from('ratings')
        .select('submission_id')
        .in('submission_id', submissionIds);

    const ratingCounts = new Map();
    (ratingsResult.data || []).forEach((row) => {
        ratingCounts.set(row.submission_id, (ratingCounts.get(row.submission_id) || 0) + 1);
    });

    return new Map((fallbackResult.data || []).map((row) => [row.id, {
        ...row,
        rating_count: ratingCounts.get(row.id) || 0
    }]));
}

function computeProgress({
    userId,
    submissions = [],
    submissionStatsMap = new Map(),
    userLikes = [],
    userRatings = [],
    interactionAuthorMap = new Map(),
    creatorRankings = [],
    unlockedRows = []
}) {
    const totalWorks = submissions.length;
    const distinctCategories = new Set(submissions.map(normalizeCategory).filter(Boolean));
    const longestStreak = computeLongestDayStreak(submissions);
    const statsList = submissions.map((submission) => ({
        id: submission.id,
        ...(submissionStatsMap.get(submission.id) || {
            like_count: 0,
            avg_rating: 0,
            rating_count: 0,
            view_count: 0
        })
    }));

    const totalLikes = statsList.reduce((sum, stats) => sum + ensureNumber(stats.like_count), 0);
    const maxLikesOnWork = statsList.reduce((max, stats) => Math.max(max, ensureNumber(stats.like_count)), 0);
    const worksWithTwentyFiveLikes = statsList.filter((stats) => ensureNumber(stats.like_count) >= 25).length;
    const worksWithFiftyLikes = statsList.filter((stats) => ensureNumber(stats.like_count) >= 50).length;
    const qualityWorks = statsList.filter((stats) => (
        ensureNumber(stats.avg_rating) >= 4
        && ensureNumber(stats.rating_count) >= QUALITY_STREAK_MIN_RATINGS
    )).length;

    const creatorRating = resolveCreatorAverage(statsList);
    const leaderboardRankIndex = Array.isArray(creatorRankings)
        ? creatorRankings.findIndex((creator) => creator?.id === userId)
        : -1;
    const currentRank = leaderboardRankIndex >= 0 ? leaderboardRankIndex + 1 : 0;
    const unlockedKeys = new Set((unlockedRows || []).map((row) => row.badge_key));

    const likedOthersCount = (userLikes || []).filter((row) => {
        const authorId = interactionAuthorMap.get(row.submission_id);
        return authorId && authorId !== userId;
    }).length;
    const ratedOthersCount = (userRatings || []).filter((row) => {
        const authorId = interactionAuthorMap.get(row.submission_id);
        return authorId && authorId !== userId;
    }).length;

    return {
        totalWorks,
        totalLikes,
        maxLikesOnWork,
        longestStreak,
        categoryCount: distinctCategories.size,
        creatorAverageRating: creatorRating.averageRating,
        creatorRatingCount: creatorRating.ratingCount,
        qualityWorks,
        worksWithTwentyFiveLikes,
        worksWithFiftyLikes,
        currentRank,
        totalMeaningfulInteractions: likedOthersCount + ratedOthersCount,
        hasReachedTopTen: currentRank > 0 && currentRank <= 10 || unlockedKeys.has('top_creator')
    };
}

function resolveUnlockableKeys(progress) {
    const creatorAverageReady = progress.creatorRatingCount >= CREATOR_AVERAGE_MIN_RATINGS;

    return BADGE_DEFINITIONS.filter((badge) => {
        switch (badge.key) {
        case 'first_spark':
            return progress.totalWorks >= 1;
        case 'first_reaction':
            return progress.totalLikes >= 1;
        case 'first_impact':
            return progress.maxLikesOnWork >= 5;
        case 'engaged_mind':
            return progress.totalMeaningfulInteractions >= 10;
        case 'consistent_creator':
            return progress.totalWorks >= 5;
        case 'creative_streak':
            return progress.longestStreak >= 3;
        case 'skill_builder':
            return progress.categoryCount >= 3;
        case 'rising_creator':
            return progress.totalLikes >= 50;
        case 'crowd_favourite':
            return progress.maxLikesOnWork >= 50;
        case 'top_rated':
            return creatorAverageReady && progress.creatorAverageRating >= 4.5;
        case 'impact_creator':
            return progress.worksWithTwentyFiveLikes >= 3;
        case 'quality_streak':
            return progress.qualityWorks >= 3;
        case 'top_performer':
            return progress.currentRank > 0 && progress.currentRank <= 20;
        case 'top_creator':
            return progress.currentRank > 0 && progress.currentRank <= 10;
        case 'master_creator':
            return creatorAverageReady
                && progress.totalWorks >= 20
                && progress.totalLikes >= 150
                && progress.creatorAverageRating >= 4.2;
        case 'edtechra_legend':
            return creatorAverageReady
                && progress.totalWorks >= 50
                && progress.totalLikes >= 500
                && progress.worksWithFiftyLikes >= 5
                && progress.creatorAverageRating >= 4.3
                && progress.hasReachedTopTen;
        default:
            return false;
        }
    }).map((badge) => badge.key);
}

export const BadgeEngine = {
    _queuedUserJobs: new Map(),

    getDefinitions() {
        return [...BADGE_DEFINITIONS];
    },

    getFallbackPanelState() {
        return this.buildBadgePanelState({
            definitions: [...BADGE_DEFINITIONS],
            unlockedRows: [],
            equippedBadgeKey: null,
            schemaReady: false
        });
    },

    enqueueUserJob(userId, job) {
        const previousJob = this._queuedUserJobs.get(userId) || Promise.resolve();
        const nextJob = previousJob
            .catch(() => undefined)
            .then(job)
            .finally(() => {
                if (this._queuedUserJobs.get(userId) === nextJob) {
                    this._queuedUserJobs.delete(userId);
                }
            });

        this._queuedUserJobs.set(userId, nextJob);
        return nextJob;
    },

    async fetchDefinitions() {
        try {
            const { data, error } = await supabase
                .from('badge_definitions')
                .select('key, name, icon, description, xp_bonus, display_order, is_active')
                .eq('is_active', true)
                .order('display_order', { ascending: true });

            if (error) {
                if (isSchemaMissingError(error)) {
                    return { definitions: [...BADGE_DEFINITIONS], schemaReady: false };
                }
                throw error;
            }

            return {
                definitions: mergeRemoteDefinitions(data || []),
                schemaReady: true
            };
        } catch (error) {
            if (isSchemaMissingError(error)) {
                return { definitions: [...BADGE_DEFINITIONS], schemaReady: false };
            }
            throw error;
        }
    },

    async getProgressSnapshot({ userId, creatorRankings = null } = {}) {
        const definitionsPromise = this.fetchDefinitions();
        const profilePromise = supabase
            .from('profiles')
            .select('equipped_badge_key')
            .eq('id', userId)
            .maybeSingle();
        const unlockedPromise = supabase
            .from('user_badges')
            .select('badge_key, unlocked_at, metadata')
            .eq('user_id', userId);
        const submissionsPromise = supabase
            .from('submissions')
            .select('id, category, content_type, status, created_at')
            .eq('author_id', userId)
            .neq('status', 'rejected');
        const userLikesPromise = supabase
            .from('likes')
            .select('submission_id')
            .eq('user_id', userId);
        const userRatingsPromise = supabase
            .from('ratings')
            .select('submission_id')
            .eq('user_id', userId);
        const creatorRankingsPromise = creatorRankings
            ? Promise.resolve({ data: creatorRankings, error: null })
            : API.getTopCreators(500);

        const [
            definitionsResult,
            profileResult,
            unlockedResult,
            submissionsResult,
            userLikesResult,
            userRatingsResult,
            creatorRankingsResult
        ] = await Promise.all([
            definitionsPromise,
            profilePromise,
            unlockedPromise,
            submissionsPromise,
            userLikesPromise,
            userRatingsPromise,
            creatorRankingsPromise
        ]);

        let schemaReady = !!definitionsResult.schemaReady;

        const profileError = profileResult.error;
        const unlockedError = unlockedResult.error;
        const submissionsError = submissionsResult.error;
        const likesError = userLikesResult.error;
        const ratingsError = userRatingsResult.error;
        const rankingsError = creatorRankingsResult.error;

        [profileError, unlockedError].forEach((error) => {
            if (error && isSchemaMissingError(error)) {
                schemaReady = false;
            }
        });

        if (submissionsError) throw submissionsError;
        if (likesError) throw likesError;
        if (ratingsError) throw ratingsError;
        if (rankingsError) throw rankingsError;
        if (profileError && !isSchemaMissingError(profileError)) throw profileError;
        if (unlockedError && !isSchemaMissingError(unlockedError)) throw unlockedError;

        const submissions = submissionsResult.data || [];
        const statsMap = await fetchSubmissionStats(submissions.map((submission) => submission.id));

        const interactionSubmissionIds = [...new Set([
            ...(userLikesResult.data || []).map((row) => row.submission_id),
            ...(userRatingsResult.data || []).map((row) => row.submission_id)
        ])].filter(Boolean);

        const interactionAuthorMap = new Map();
        if (interactionSubmissionIds.length > 0) {
            const { data: interactedSubmissions, error: interactionError } = await supabase
                .from('submissions')
                .select('id, author_id')
                .in('id', interactionSubmissionIds);

            if (interactionError) throw interactionError;

            (interactedSubmissions || []).forEach((submission) => {
                interactionAuthorMap.set(submission.id, submission.author_id);
            });
        }

        return {
            schemaReady,
            definitions: definitionsResult.definitions,
            equippedBadgeKey: profileResult.data?.equipped_badge_key || null,
            unlockedRows: unlockedError && isSchemaMissingError(unlockedError) ? [] : (unlockedResult.data || []),
            submissions,
            submissionStatsMap: statsMap,
            userLikes: userLikesResult.data || [],
            userRatings: userRatingsResult.data || [],
            interactionAuthorMap,
            creatorRankings: creatorRankingsResult.data || []
        };
    },

    buildBadgePanelState({
        definitions = BADGE_DEFINITIONS,
        unlockedRows = [],
        equippedBadgeKey = null,
        schemaReady = true
    } = {}) {
        const unlockedMap = new Map((unlockedRows || []).map((row) => [row.badge_key, row]));
        const seenKeys = new Set();
        const duplicateKeys = [];
        const orderedBadges = [...definitions]
            .filter((badge) => badge.is_active !== false)
            .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
            .filter((badge) => {
                if (!badge?.key) return false;
                if (seenKeys.has(badge.key)) {
                    duplicateKeys.push(badge.key);
                    return false;
                }
                seenKeys.add(badge.key);
                return true;
            })
            .map((badge) => ({
                ...badge,
                unlocked: unlockedMap.has(badge.key),
                equipped: badge.key === equippedBadgeKey && unlockedMap.has(badge.key)
            }));

        if (duplicateKeys.length > 0 && shouldWarnAboutBadgeState()) {
            console.warn('[BadgeEngine] Duplicate badge keys filtered from panel state:', duplicateKeys);
        }

        const currentBadge = orderedBadges.find((badge) => badge.equipped) || null;
        const topRow = orderedBadges.slice(0, 6);
        const remaining = orderedBadges.slice(6);

        return {
            schemaReady,
            totalUnlocked: orderedBadges.filter((badge) => badge.unlocked).length,
            equippedBadgeKey: currentBadge?.key || null,
            currentBadge,
            topRow,
            remainingBadges: remaining,
            allBadges: orderedBadges
        };
    },

    async getPanelState({ userId, creatorRankings = null } = {}) {
        const snapshot = await this.getProgressSnapshot({ userId, creatorRankings });
        return {
            panelState: this.buildBadgePanelState(snapshot),
            schemaReady: snapshot.schemaReady
        };
    },

    async evaluateAndSyncBadges({ userId, creatorRankings = null } = {}) {
        if (!userId) {
            return {
                panelState: this.getFallbackPanelState(),
                newlyUnlockedBadges: []
            };
        }

        return this.enqueueUserJob(userId, async () => {
            const snapshot = await this.getProgressSnapshot({ userId, creatorRankings });
            const progress = computeProgress({
                userId,
                submissions: snapshot.submissions,
                submissionStatsMap: snapshot.submissionStatsMap,
                userLikes: snapshot.userLikes,
                userRatings: snapshot.userRatings,
                interactionAuthorMap: snapshot.interactionAuthorMap,
                creatorRankings: snapshot.creatorRankings,
                unlockedRows: snapshot.unlockedRows
            });

            const unlockedKeys = new Set((snapshot.unlockedRows || []).map((row) => row.badge_key));
            const eligibleKeys = resolveUnlockableKeys(progress);
            const nextUnlockKeys = eligibleKeys.filter((badgeKey) => !unlockedKeys.has(badgeKey));
            let presentableUnlockKeys = [];

            if (snapshot.schemaReady && nextUnlockKeys.length > 0) {
                const insertRows = nextUnlockKeys.map((badgeKey) => ({
                    user_id: userId,
                    badge_key: badgeKey,
                    metadata: {}
                }));

                const { data: insertedRows, error: insertError } = await supabase
                    .from('user_badges')
                    .insert(insertRows)
                    .select('badge_key, unlocked_at, metadata');

                if (insertError) {
                    if (!isSchemaMissingError(insertError) && insertError.code !== '23505') {
                        throw insertError;
                    }
                    snapshot.schemaReady = snapshot.schemaReady && !isSchemaMissingError(insertError);
                } else {
                    const appendedRows = insertedRows || [];
                    snapshot.unlockedRows = [...snapshot.unlockedRows, ...appendedRows];
                    presentableUnlockKeys = appendedRows.map((row) => row.badge_key);
                }

                if (insertError?.code === '23505') {
                    const refetchUnlocked = await supabase
                        .from('user_badges')
                        .select('badge_key, unlocked_at, metadata')
                        .eq('user_id', userId);

                    if (!refetchUnlocked.error) {
                        snapshot.unlockedRows = refetchUnlocked.data || snapshot.unlockedRows;
                    }
                }
            }

            const definitionMap = createDefinitionMap(snapshot.definitions);
            const newlyUnlockedBadges = presentableUnlockKeys
                .map((badgeKey) => definitionMap.get(badgeKey))
                .filter(Boolean);

            return {
                panelState: this.buildBadgePanelState(snapshot),
                newlyUnlockedBadges,
                progress
            };
        });
    },

    async equipBadge({ userId, badgeKey = null, creatorRankings = null } = {}) {
        if (!userId) {
            return {
                error: new Error('Authentication required.'),
                panelState: this.getFallbackPanelState()
            };
        }

        return this.enqueueUserJob(userId, async () => {
            const snapshot = await this.getProgressSnapshot({ userId, creatorRankings });
            const unlockedKeys = new Set((snapshot.unlockedRows || []).map((row) => row.badge_key));

            if (badgeKey && !unlockedKeys.has(badgeKey)) {
                return {
                    error: new Error('Only unlocked badges can be equipped.'),
                    panelState: this.buildBadgePanelState(snapshot)
                };
            }

            if (!snapshot.schemaReady) {
                return {
                    error: new Error('Badge schema is not ready yet. Run the SQL migration first.'),
                    panelState: this.buildBadgePanelState(snapshot)
                };
            }

            if ((snapshot.equippedBadgeKey || null) === (badgeKey || null)) {
                return {
                    error: null,
                    panelState: this.buildBadgePanelState(snapshot)
                };
            }

            const { error } = await supabase
                .from('profiles')
                .update({ equipped_badge_key: badgeKey || null })
                .eq('id', userId);

            if (error) {
                return {
                    error,
                    panelState: this.buildBadgePanelState(snapshot)
                };
            }

            snapshot.equippedBadgeKey = badgeKey || null;

            return {
                error: null,
                panelState: this.buildBadgePanelState(snapshot)
            };
        });
    }
};

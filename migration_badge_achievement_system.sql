-- EdTechra Creative Lab
-- Achievement badge system migration
-- Safe to paste into the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.badge_definitions (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT NOT NULL,
    xp_bonus INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_key TEXT NOT NULL REFERENCES public.badge_definitions(key) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT user_badges_user_badge_unique UNIQUE (user_id, badge_key),
    CONSTRAINT user_badges_metadata_is_object CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS equipped_badge_key TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_equipped_badge_key_fkey'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_equipped_badge_key_fkey
            FOREIGN KEY (equipped_badge_key)
            REFERENCES public.badge_definitions(key)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_badge_definitions_active_order
    ON public.badge_definitions (is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id
    ON public.user_badges (user_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_unlocked_at
    ON public.user_badges (user_id, unlocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_equipped_badge_key
    ON public.profiles (equipped_badge_key);

ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'badge_definitions'
          AND policyname = 'Badge definitions are viewable by everyone'
    ) THEN
        CREATE POLICY "Badge definitions are viewable by everyone"
            ON public.badge_definitions
            FOR SELECT
            USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_badges'
          AND policyname = 'Users can view own badges'
    ) THEN
        CREATE POLICY "Users can view own badges"
            ON public.user_badges
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_badges'
          AND policyname = 'Users can unlock own badges'
    ) THEN
        CREATE POLICY "Users can unlock own badges"
            ON public.user_badges
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'profiles'
          AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile"
            ON public.profiles
            FOR UPDATE
            USING (auth.uid() = id);
    END IF;
END $$;

GRANT SELECT ON public.badge_definitions TO anon, authenticated;
GRANT SELECT, INSERT ON public.user_badges TO authenticated;

INSERT INTO public.badge_definitions (key, name, icon, description, xp_bonus, display_order, is_active)
VALUES
    ('first_spark', 'First Spark', '🚀', 'First published work', 10, 1, true),
    ('first_reaction', 'First Reaction', '👀', 'Received your first like', 15, 2, true),
    ('first_impact', 'First Impact', '💬', 'Earned 5 likes on one work', 20, 3, true),
    ('engaged_mind', 'Engaged Mind', '🔁', 'Made 10 meaningful interactions on others’ work', 20, 4, true),
    ('consistent_creator', 'Consistent Creator', '✍️', 'Published 5 works', 25, 5, true),
    ('creative_streak', 'Creative Streak', '🔥', 'Published on 3 consecutive days', 30, 6, true),
    ('skill_builder', 'Skill Builder', '🧠', 'Created in 3 different categories', 30, 7, true),
    ('rising_creator', 'Rising Creator', '📈', 'Reached 50 total likes', 35, 8, true),
    ('crowd_favourite', 'Crowd Favourite', '❤️', 'Reached 50 likes on one work', 40, 9, true),
    ('top_rated', 'Top Rated', '🌟', 'Maintained a 4.5+ average rating', 40, 10, true),
    ('impact_creator', 'Impact Creator', '💡', 'Built 3 works with 25+ likes each', 45, 11, true),
    ('quality_streak', 'Quality Streak', '🏅', 'Created 3 works rated 4.0+', 45, 12, true),
    ('top_performer', 'Top Performer', '📊', 'Reached the top 20 leaderboard', 50, 13, true),
    ('top_creator', 'Top Creator', '👑', 'Reached the top 10 leaderboard', 60, 14, true),
    ('master_creator', 'Master Creator', '🧩', '20 works, 150 likes, and a 4.2+ rating', 75, 15, true),
    ('edtechra_legend', 'EdTechra Legend', '🏆', '50 works, 500 likes, top 10, and elite quality', 120, 16, true)
ON CONFLICT (key) DO UPDATE
SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    xp_bonus = EXCLUDED.xp_bonus,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

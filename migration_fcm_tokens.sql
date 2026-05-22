CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    device_id TEXT NOT NULL,
    user_agent TEXT,
    platform TEXT,
    permission TEXT NOT NULL DEFAULT 'granted',
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fcm_tokens_user_token_hash_key
    ON public.fcm_tokens (user_id, token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS fcm_tokens_user_device_id_key
    ON public.fcm_tokens (user_id, device_id);

CREATE INDEX IF NOT EXISTS fcm_tokens_user_id_idx
    ON public.fcm_tokens (user_id);

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'fcm_tokens'
          AND policyname = 'Users can read their own FCM tokens'
    ) THEN
        CREATE POLICY "Users can read their own FCM tokens"
            ON public.fcm_tokens
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'fcm_tokens'
          AND policyname = 'Users can insert their own FCM tokens'
    ) THEN
        CREATE POLICY "Users can insert their own FCM tokens"
            ON public.fcm_tokens
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'fcm_tokens'
          AND policyname = 'Users can update their own FCM tokens'
    ) THEN
        CREATE POLICY "Users can update their own FCM tokens"
            ON public.fcm_tokens
            FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'fcm_tokens'
          AND policyname = 'Admins can read FCM tokens'
    ) THEN
        CREATE POLICY "Admins can read FCM tokens"
            ON public.fcm_tokens
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.profiles
                    WHERE profiles.id = auth.uid()
                      AND profiles.role = 'admin'
                )
            );
    END IF;
END $$;

-- Run this in your Supabase SQL Editor to enable mobile remote control for presentations.

ALTER TABLE public.submissions
    ADD COLUMN IF NOT EXISTS presentation_notes JSONB;

CREATE TABLE IF NOT EXISTS public.presentation_remote_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presentation_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    host_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    presentation_notes JSONB,
    current_slide_index INTEGER NOT NULL DEFAULT 0,
    slide_count INTEGER NOT NULL DEFAULT 1,
    is_presenting BOOLEAN NOT NULL DEFAULT false,
    active_remote_id UUID,
    remote_connected BOOLEAN NOT NULL DEFAULT false,
    pairing_code CHAR(6) NOT NULL,
    access_token TEXT NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '20 minutes'),
    laser_pointer_visible BOOLEAN NOT NULL DEFAULT false,
    laser_pointer_x DOUBLE PRECISION,
    laser_pointer_y DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT presentation_remote_sessions_pairing_code_format CHECK (pairing_code ~ '^[0-9]{6}$'),
    CONSTRAINT presentation_remote_sessions_slide_index_non_negative CHECK (current_slide_index >= 0),
    CONSTRAINT presentation_remote_sessions_slide_count_positive CHECK (slide_count > 0),
    CONSTRAINT presentation_remote_sessions_pointer_x_range CHECK (laser_pointer_x IS NULL OR (laser_pointer_x >= 0 AND laser_pointer_x <= 1)),
    CONSTRAINT presentation_remote_sessions_pointer_y_range CHECK (laser_pointer_y IS NULL OR (laser_pointer_y >= 0 AND laser_pointer_y <= 1))
);

CREATE TABLE IF NOT EXISTS public.presentation_remote_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.presentation_remote_sessions(id) ON DELETE CASCADE,
    presentation_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    remote_id UUID NOT NULL,
    command_type TEXT NOT NULL,
    slide_index INTEGER,
    pointer_x DOUBLE PRECISION,
    pointer_y DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT presentation_remote_commands_type_check CHECK (
        command_type IN ('next', 'prev', 'goto', 'start', 'end', 'pointer_move', 'pointer_hide')
    ),
    CONSTRAINT presentation_remote_commands_slide_index_non_negative CHECK (slide_index IS NULL OR slide_index >= 0),
    CONSTRAINT presentation_remote_commands_pointer_x_range CHECK (pointer_x IS NULL OR (pointer_x >= 0 AND pointer_x <= 1)),
    CONSTRAINT presentation_remote_commands_pointer_y_range CHECK (pointer_y IS NULL OR (pointer_y >= 0 AND pointer_y <= 1))
);

CREATE INDEX IF NOT EXISTS presentation_remote_sessions_host_idx
    ON public.presentation_remote_sessions(host_user_id, presentation_id);

CREATE INDEX IF NOT EXISTS presentation_remote_sessions_expires_idx
    ON public.presentation_remote_sessions(expires_at);

CREATE INDEX IF NOT EXISTS presentation_remote_sessions_pairing_code_idx
    ON public.presentation_remote_sessions(pairing_code);

CREATE INDEX IF NOT EXISTS presentation_remote_commands_session_idx
    ON public.presentation_remote_commands(session_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_presentation_remote_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_presentation_remote_sessions_updated_at ON public.presentation_remote_sessions;
CREATE TRIGGER trg_presentation_remote_sessions_updated_at
    BEFORE UPDATE ON public.presentation_remote_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_presentation_remote_sessions_updated_at();

ALTER TABLE public.presentation_remote_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_remote_commands ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'presentation_remote_sessions'
          AND policyname = 'Hosts can manage their own presentation remote sessions'
    ) THEN
        CREATE POLICY "Hosts can manage their own presentation remote sessions"
            ON public.presentation_remote_sessions
            FOR ALL
            TO authenticated
            USING (auth.uid() = host_user_id)
            WITH CHECK (auth.uid() = host_user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'presentation_remote_commands'
          AND policyname = 'Hosts can manage commands for their own presentation remote sessions'
    ) THEN
        CREATE POLICY "Hosts can manage commands for their own presentation remote sessions"
            ON public.presentation_remote_commands
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.presentation_remote_sessions prs
                    WHERE prs.id = presentation_remote_commands.session_id
                      AND prs.host_user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1
                    FROM public.presentation_remote_sessions prs
                    WHERE prs.id = presentation_remote_commands.session_id
                      AND prs.host_user_id = auth.uid()
                )
            );
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_remote_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_remote_commands TO authenticated;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.presentation_remote_sessions;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;
END $$;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.presentation_remote_commands;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;
END $$;

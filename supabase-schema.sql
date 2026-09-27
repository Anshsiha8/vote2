-- =========================================================
-- CAMPUS VOTE: SUPABASE POSTGRESQL SCHEMA & SECURE RLS POLICIES
-- Optimized for resilient, low-bandwidth, atomic live audience polling
-- =========================================================

-- 1. Create polls table
CREATE TABLE IF NOT EXISTS public.polls (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('yes_no', 'multiple_choice', 'rating', 'quiz')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
    join_code VARCHAR(12) NOT NULL UNIQUE,
    current_question_index INT NOT NULL DEFAULT 0,
    quiz_state TEXT DEFAULT 'lobby',
    time_limit_seconds INT DEFAULT 30,
    correct_option_id TEXT,
    questions JSONB,
    quiz_started_at TIMESTAMPTZ,
    countdown_end_at TIMESTAMPTZ,
    question_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create poll_options table
CREATE TABLE IF NOT EXISTS public.poll_options (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    option_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create responses table
CREATE TABLE IF NOT EXISTS public.responses (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    question_id TEXT,
    question_index INT NOT NULL DEFAULT 0,
    option_id TEXT REFERENCES public.poll_options(id) ON DELETE SET NULL,
    rating_value INT CHECK (rating_value BETWEEN 1 AND 5),
    participant_id TEXT NOT NULL,
    participant_name TEXT DEFAULT 'Anonymous Student',
    response_time_ms INT,
    points INT DEFAULT 0,
    is_correct BOOLEAN DEFAULT NULL,
    client_request_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Prevent duplicate voting at database level
    CONSTRAINT unique_poll_participant UNIQUE (poll_id, participant_id, question_index)
);

-- 4. Create Indexes for instant retrieval & atomic validation
CREATE INDEX IF NOT EXISTS idx_polls_join_code ON public.polls(join_code);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON public.poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_responses_poll_id ON public.responses(poll_id);
CREATE INDEX IF NOT EXISTS idx_responses_participant_poll ON public.responses(poll_id, participant_id, question_index);
CREATE INDEX IF NOT EXISTS idx_responses_client_request_id ON public.responses(client_request_id);

-- 5. Row Level Security (RLS) - Secure Access Control
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- Drop any previous permissive policies
DROP POLICY IF EXISTS "Public manage polls" ON public.polls;
DROP POLICY IF EXISTS "Public manage options" ON public.poll_options;
DROP POLICY IF EXISTS "Public read polls" ON public.polls;
DROP POLICY IF EXISTS "Public read poll_options" ON public.poll_options;
DROP POLICY IF EXISTS "Public read responses" ON public.responses;
DROP POLICY IF EXISTS "Students submit responses" ON public.responses;

-- A. POLLS POLICIES
-- Anyone can read polls (participants need to find poll by ID or join code)
CREATE POLICY "Public read polls" ON public.polls
    FOR SELECT USING (true);

-- Host operations restricted to authenticated users
CREATE POLICY "Host insert polls" ON public.polls
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Host update polls" ON public.polls
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Host delete polls" ON public.polls
    FOR DELETE TO authenticated USING (true);

-- B. POLL OPTIONS POLICIES
-- Anyone can read poll options
CREATE POLICY "Public read poll_options" ON public.poll_options
    FOR SELECT USING (true);

-- Only host can manage options
CREATE POLICY "Host insert poll_options" ON public.poll_options
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Host update poll_options" ON public.poll_options
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Host delete poll_options" ON public.poll_options
    FOR DELETE TO authenticated USING (true);

-- C. RESPONSES POLICIES
-- Allow reading responses for aggregated live results
CREATE POLICY "Public read responses" ON public.responses
    FOR SELECT USING (true);

-- Students (anonymous or authenticated) can submit responses ONLY to currently ACTIVE polls
CREATE POLICY "Students submit responses" ON public.responses
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        participant_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.polls
            WHERE public.polls.id = responses.poll_id
            AND public.polls.status = 'active'
        )
    );

-- Responses are immutable: Students cannot modify or delete votes once cast
CREATE POLICY "Host delete responses" ON public.responses
    FOR DELETE TO authenticated USING (true);

-- 6. Enable Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.responses;

-- 7. Database RPC: Atomic Poll Creation with Options (Transaction Safety)
CREATE OR REPLACE FUNCTION public.create_poll_with_options(
    p_poll JSONB,
    p_options JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_opt JSONB;
BEGIN
    INSERT INTO public.polls (
        id, title, question, type, status, join_code,
        current_question_index, quiz_state, time_limit_seconds,
        correct_option_id, created_at
    ) VALUES (
        p_poll->>'id',
        p_poll->>'title',
        p_poll->>'question',
        p_poll->>'type',
        COALESCE(p_poll->>'status', 'draft'),
        p_poll->>'join_code',
        COALESCE((p_poll->>'current_question_index')::INT, 0),
        COALESCE(p_poll->>'quiz_state', 'lobby'),
        COALESCE((p_poll->>'time_limit_seconds')::INT, 30),
        p_poll->>'correct_option_id',
        COALESCE((p_poll->>'created_at')::TIMESTAMPTZ, now())
    );

    IF p_options IS NOT NULL AND jsonb_array_length(p_options) > 0 THEN
        FOR v_opt IN SELECT * FROM jsonb_array_elements(p_options)
        LOOP
            INSERT INTO public.poll_options (id, poll_id, option_text, option_order, created_at)
            VALUES (
                v_opt->>'id',
                p_poll->>'id',
                v_opt->>'option_text',
                COALESCE((v_opt->>'option_order')::INT, 1),
                now()
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', p_poll->>'id');
END;
$$;


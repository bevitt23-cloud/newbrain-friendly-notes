CREATE OR REPLACE FUNCTION public.claim_next_background_job()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content_chunk text,
  folder text,
  tags text[],
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH next_job AS (
    SELECT bj.id
    FROM public.background_jobs bj
    WHERE bj.status = 'pending'
    ORDER BY bj.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  ), claimed AS (
    UPDATE public.background_jobs bj
    SET status = 'processing',
        error_message = NULL
    WHERE bj.id IN (SELECT id FROM next_job)
    RETURNING bj.id, bj.user_id, bj.content_chunk, bj.folder, bj.tags, bj.created_at
  )
  SELECT claimed.id, claimed.user_id, claimed.content_chunk, claimed.folder, claimed.tags, claimed.created_at
  FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_background_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_background_job() TO service_role;

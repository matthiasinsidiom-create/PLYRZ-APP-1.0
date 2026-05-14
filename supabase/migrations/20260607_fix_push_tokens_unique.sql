-- 1. Alte doppelte push_tokens pro user_id + platform löschen.
-- Behalten wird immer der neueste Eintrag:
DELETE FROM public.push_tokens
WHERE id NOT IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, platform 
                   ORDER BY last_seen_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST 
               ) as rn
        FROM public.push_tokens
    ) sub
    WHERE rn = 1
);

-- 2. Danach alte Unique Constraints/Indexes entfernen, falls vorhanden.
ALTER TABLE public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_user_id_token_key;
ALTER TABLE public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_user_id_platform_key;
DROP INDEX IF EXISTS push_tokens_user_id_token_key;
DROP INDEX IF EXISTS push_tokens_user_id_platform_key;

-- 3. Sicherstellen, dass es einen Unique Constraint für user_id, platform gibt.
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_user_id_platform_key UNIQUE (user_id, platform);

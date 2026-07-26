-- Rewrite photo.url from Supabase Storage public URLs to local /media/ paths.
--
-- The Photos bucket is mirrored to MEDIA_DIR with its directory structure intact,
-- so a bucket-relative path is identical to a /media/-relative one and this is a
-- pure prefix swap.
--
-- Percent-encoding note: Supabase encodes spaces as %20 in object URLs. Keeping
-- the encoding in the DB is correct (express.static decodes the request path),
-- but the DECODED filename must be what exists on disk. scripts/db/check-media.sh
-- verifies that.
--
-- Idempotent: re-running is a no-op once every row starts with /media/.

BEGIN;

-- Public object URLs.
UPDATE photo
SET url = '/media/' || regexp_replace(
      url,
      '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/Photos/',
      ''
    )
WHERE url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/Photos/';

-- Signed object URLs, in case any rows carry one. Strip the ?token=... query too.
UPDATE photo
SET url = '/media/' || split_part(
      regexp_replace(
        url,
        '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/sign/Photos/',
        ''
      ),
      '?',
      1
    )
WHERE url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/sign/Photos/';

COMMIT;

-- Audit: anything still pointing off-box needs manual attention.
\echo ''
\echo 'Rows NOT rewritten to /media/ (should be empty):'
SELECT id, url FROM photo WHERE url NOT LIKE '/media/%';

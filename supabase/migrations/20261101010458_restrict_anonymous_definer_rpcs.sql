-- Anonymous callers do not need access to privileged public-schema functions.
-- Keep the explicit authenticated grants so the existing, membership-guarded
-- web RPC contract continues to work. Trigger functions remain attached.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
      fn.signature
    );
  END LOOP;
END;
$$;

-- Prevent future functions created by the migration owner from inheriting an
-- anonymous/PUBLIC EXECUTE grant. Authenticated grants are intentionally kept.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

DO $migration$
DECLARE
 definition text;
 original text;
 marker text := 'jsonb_build_array(d.record_id::text)';
 replacement text := $safe$CASE WHEN d.record_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(d.record_id::text) END$safe$;
 marker_count integer;
BEGIN
 SELECT pg_get_functiondef('public.get_project_coordination()'::regprocedure) INTO definition;
 IF position(replacement IN definition) > 0 THEN RETURN; END IF;
 marker_count := (length(definition) - length(replace(definition, marker, ''))) / length(marker);
 IF marker_count <> 1 THEN RAISE EXCEPTION 'COORDINATION_REFERENCE_PATCH_PRECONDITION_FAILED: expected one nullable reference expression, found %', marker_count; END IF;
 original := definition;
 definition := replace(definition, marker, replacement);
 IF definition = original OR position(replacement IN definition) = 0 THEN RAISE EXCEPTION 'COORDINATION_REFERENCE_PATCH_FAILED'; END IF;
 EXECUTE definition;
END;
$migration$;
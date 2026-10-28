-- CLI-created follow-up, ordered after 20261028120001. Never silently reclassify legacy stages.
DO $boundary$
DECLARE signature text; definition text; marker text; guarded text;
BEGIN
 marker:=' IF NOT FOUND THEN RAISE EXCEPTION ''PROJECT_NOT_FOUND''; END IF;';
 guarded:=marker||chr(10)||' IF r.stage IS NOT NULL AND NOT public.is_valid_canonical_stage(r.stage) THEN RAISE EXCEPTION ''LEGACY_LIFECYCLE_REVIEW_REQUIRED: Retain legacy history until a reviewed plan adoption''; END IF;';
 FOREACH signature IN ARRAY ARRAY['private.activate_canonical_stage(jsonb)','private.request_canonical_stage_review(jsonb)'] LOOP
   definition:=pg_get_functiondef(signature::regprocedure);
   IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'LEGACY_BOUNDARY_PATCH_PRECONDITION_FAILED'; END IF;
   definition:=replace(definition,marker,guarded);
   EXECUTE definition;
 END LOOP;
END $boundary$;
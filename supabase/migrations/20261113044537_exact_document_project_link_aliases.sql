-- Keep document registration's project association check aligned with the
-- shared coordination projection. Only exact project IDs/references are valid;
-- conflicting populated aliases remain a hard failure.
DO $patch$
DECLARE d text; old text; replacement text;
BEGIN
 d:=pg_get_functiondef('public.register_controlled_document(jsonb,uuid)'::regprocedure);

 old:=$source$NULLIF(context_record.fields->>'projectId','') IS NOT NULL$source$;
 replacement:=$target$EXISTS (
   SELECT 1
   FROM unnest(ARRAY['projectId','project_id','linkedProjectId','projectCode','project_code','projectReference','project']::text[]) AS alias(key)
   WHERE NULLIF(btrim(context_record.fields->>alias.key),'') IS NOT NULL
  )$target$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'DOCUMENT_PROJECT_SCOPE_ALIAS_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);

 old:=$source$IF project IS NOT NULL AND source<>project$source$;
 replacement:=$target$IF project IS NOT NULL AND source<>project
   AND EXISTS (
    SELECT 1 FROM jsonb_each_text(context_record.fields) AS alias(key,value)
    WHERE alias.key=ANY(ARRAY['projectId','project_id','linkedProjectId','projectCode','project_code','projectReference','project']::text[])
      AND NULLIF(btrim(alias.value),'') IS NOT NULL
      AND btrim(alias.value) NOT IN (project::text,parent.reference)
   )
   THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_PROJECT_MISMATCH'; END IF;
 IF project IS NOT NULL AND source<>project$target$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'DOCUMENT_PROJECT_CONFLICT_GUARD_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);

 old:=$source$COALESCE(context_record.fields->>'projectId','') NOT IN (project::text,parent.reference)$source$;
 replacement:=$target$NOT EXISTS (
     SELECT 1 FROM jsonb_each_text(context_record.fields) AS alias(key,value)
     WHERE alias.key=ANY(ARRAY['projectId','project_id','linkedProjectId','projectCode','project_code','projectReference','project']::text[])
       AND NULLIF(btrim(alias.value),'') IS NOT NULL
       AND btrim(alias.value) IN (project::text,parent.reference)
    )$target$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'DOCUMENT_PROJECT_SOURCE_ALIAS_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 EXECUTE d;
END
$patch$;

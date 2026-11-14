-- Save generated document structure as an unissued source snapshot in the controlled vault.
-- The snapshot is bound to the same project and optional source record as registration.
DO $patch$
DECLARE d text; old text; replacement text;
BEGIN
 d:=pg_get_functiondef('public.register_controlled_document(jsonb,uuid)'::regprocedure);
 old:=$source$ IF kind IN ('Panel ZIP','Stencil PCB fab') THEN$source$;
 replacement:=$target$
 IF p_payload ? 'draftSnapshot' THEN
  IF jsonb_typeof(p_payload->'draftSnapshot')<>'object'
   OR length((p_payload->'draftSnapshot')::text)>10000
   OR p_payload->'draftSnapshot'->>'releaseStatus' IS DISTINCT FROM 'Unissued'
   OR COALESCE(NULLIF(p_payload->'draftSnapshot'->>'templateType',''),'')=''
   OR COALESCE(NULLIF(p_payload->'draftSnapshot'->>'templateVersion',''),'')=''
   OR NULLIF(p_payload->'draftSnapshot'->>'projectRecordId','') IS DISTINCT FROM NULLIF(p_payload->>'projectId','')
   OR NULLIF(p_payload->'draftSnapshot'->>'sourceRecordId','') IS DISTINCT FROM NULLIF(p_payload->>'recordId','')
   THEN RAISE EXCEPTION 'DOCUMENT_DRAFT_SNAPSHOT_INVALID'; END IF;
  meta:=meta||jsonb_build_object('draftSnapshot',p_payload->'draftSnapshot');
 END IF;
 IF kind IN ('Panel ZIP','Stencil PCB fab') THEN$target$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'DOCUMENT_DRAFT_SNAPSHOT_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 EXECUTE d;
END
$patch$;

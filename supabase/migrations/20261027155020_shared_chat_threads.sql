-- Extend only message metadata in the existing authenticated business writer.
-- Preserve its financial, HR, ticket, idempotency and notification rules.
DO $migration$
DECLARE definition text; anchor text; replacement text;
BEGIN
 definition := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
 IF position('CHAT_THREAD_METADATA_V1' in definition)>0 THEN RETURN; END IF;
 anchor := $needle$ ELSIF p_action='send_message' THEN$needle$;
 replacement := $patch$ ELSIF p_action='send_message' THEN
  -- CHAT_THREAD_METADATA_V1: never accept a foreign channel or reply parent.
  IF a.role='viewer' THEN RAISE EXCEPTION 'CHAT_INTERNAL_ONLY'; END IF;
  IF data ? 'isUrgent' AND jsonb_typeof(data->'isUrgent')<>'boolean' THEN RAISE EXCEPTION 'INVALID_URGENCY'; END IF;
  IF NULLIF(data->>'replyToId','') IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM business_items parent WHERE parent.id=(data->>'replyToId')::uuid
      AND parent.organization_id=org AND parent.kind='message'
      AND parent.payload->>'channelId'=data->>'channelId'
      AND NULLIF(parent.payload->>'replyToId','') IS NULL
      AND COALESCE(private.business_visible(parent,to_jsonb(a)),false)
  ) THEN RAISE EXCEPTION 'REPLY_PARENT_DENIED'; END IF;
$patch$;
 IF position(anchor in definition)=0 THEN RAISE EXCEPTION 'CHAT_MIGRATION_SOURCE_MISMATCH'; END IF;
 definition:=replace(definition,anchor,replacement);
 anchor:=$needle$'senderDept',a.department_code,'type',COALESCE(data->>'type','update')$needle$;
 replacement:=$patch$'senderDept',a.department_code,'replyToId',NULLIF(data->>'replyToId','')::uuid,'isUrgent',COALESCE((data->>'isUrgent')::boolean,false),'type',COALESCE(data->>'type','update')$patch$;
 IF position(anchor in definition)=0 THEN RAISE EXCEPTION 'CHAT_MIGRATION_INSERT_MISMATCH'; END IF;
 definition:=replace(definition,anchor,replacement);
 EXECUTE definition;
END $migration$;
REVOKE ALL ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_expense_catalogue(p_department uuid,p_value jsonb,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; current jsonb; persist jsonb; k text; category_manager boolean; service_manager boolean;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION 'EXPENSE_SETTINGS_ACCESS_DENIED'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=a.organization_id FOR UPDATE;
 current:=public.get_expense_catalogue(p_department);
 category_manager:=coalesce((current->>'canManage')::boolean,false);
 service_manager:=coalesce((current->>'canManageServices')::boolean,false);
 IF NOT category_manager AND NOT service_manager THEN RAISE EXCEPTION 'EXPENSE_SETTINGS_MANAGE_DENIED'; END IF;
 IF (current->>'version')::int IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'SETTINGS_CHANGED_RELOAD_BEFORE_SAVE'; END IF;
 IF category_manager THEN
  FOR k IN SELECT unnest(ARRAY['categories','purposes']) LOOP
   IF p_value ? k AND (jsonb_typeof(p_value->k) IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->k) NOT BETWEEN 1 AND 100) THEN RAISE EXCEPTION 'INVALID_EXPENSE_OPTIONS'; END IF;
   IF p_value ? k AND (EXISTS(SELECT 1 FROM jsonb_array_elements(p_value->k) x WHERE jsonb_typeof(x)<>'string' OR length(trim(x #>> '{}')) NOT BETWEEN 1 AND 160) OR (SELECT count(*) FROM jsonb_array_elements_text(p_value->k))<>(SELECT count(DISTINCT lower(trim(x))) FROM jsonb_array_elements_text(p_value->k) x)) THEN RAISE EXCEPTION 'INVALID_OR_DUPLICATE_EXPENSE_OPTIONS'; END IF;
  END LOOP;
  IF a.role<>'admin' AND p_value ? 'operationsEnabled' AND (p_value->>'operationsEnabled')::boolean IS DISTINCT FROM (current->>'operationsEnabled')::boolean THEN RAISE EXCEPTION 'ADMIN_REQUIRED_TO_CHANGE_SETTINGS_ACCESS'; END IF;
 ELSE
  IF (p_value ? 'categories' AND p_value->'categories' IS DISTINCT FROM current->'categories') OR (p_value ? 'purposes' AND p_value->'purposes' IS DISTINCT FROM current->'purposes') OR (p_value ? 'operationsEnabled' AND (p_value->>'operationsEnabled')::boolean IS DISTINCT FROM (current->>'operationsEnabled')::boolean) THEN RAISE EXCEPTION 'FINANCE_OPTIONS_MANAGE_DENIED'; END IF;
 END IF;
 IF p_value ? 'services' AND NOT service_manager AND p_value->'services' IS DISTINCT FROM current->'services' THEN RAISE EXCEPTION 'SERVICE_CATALOGUE_MANAGE_DENIED'; END IF;
 IF service_manager AND p_value ? 'services' THEN
  IF p_department IS NULL AND a.role<>'admin' THEN RAISE EXCEPTION 'DEPARTMENT_SCOPE_REQUIRED_FOR_SERVICES'; END IF;
  IF jsonb_typeof(p_value->'services') IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->'services')>80 THEN RAISE EXCEPTION 'INVALID_SERVICE_OPTIONS'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_value->'services') s WHERE
    jsonb_typeof(s) IS DISTINCT FROM 'object' OR
    jsonb_typeof(s->'id') IS DISTINCT FROM 'string' OR length(trim(s->>'id')) NOT BETWEEN 1 AND 80 OR
    jsonb_typeof(s->'name') IS DISTINCT FROM 'string' OR length(trim(s->>'name')) NOT BETWEEN 1 AND 160 OR
    jsonb_typeof(s->'category') IS DISTINCT FROM 'string' OR length(trim(s->>'category')) NOT BETWEEN 1 AND 100 OR
    jsonb_typeof(s->'provider') IS DISTINCT FROM 'string' OR length(s->>'provider')>120 OR
    jsonb_typeof(s->'cycle') IS DISTINCT FROM 'string' OR length(s->>'cycle') NOT BETWEEN 1 AND 40 OR
    jsonb_typeof(s->'owner') IS DISTINCT FROM 'string' OR length(s->>'owner') NOT BETWEEN 1 AND 100
  ) OR (SELECT count(*) FROM jsonb_array_elements(p_value->'services'))<>(SELECT count(DISTINCT lower(trim(s->>'id'))) FROM jsonb_array_elements(p_value->'services') s) THEN RAISE EXCEPTION 'INVALID_OR_DUPLICATE_SERVICE_OPTIONS'; END IF;
 END IF;
 persist:=jsonb_build_object(
  'categories',CASE WHEN category_manager THEN coalesce(p_value->'categories',current->'categories') ELSE current->'categories' END,
  'purposes',CASE WHEN category_manager THEN coalesce(p_value->'purposes',current->'purposes') ELSE current->'purposes' END,
  'operationsEnabled',CASE WHEN p_department IS NULL AND a.role='admin' AND p_value ? 'operationsEnabled' THEN (p_value->>'operationsEnabled')::boolean ELSE (current->>'operationsEnabled')::boolean END,
  'services',CASE WHEN service_manager AND p_value ? 'services' THEN p_value->'services' ELSE current->'services' END);
 INSERT INTO private.expense_catalogues(organization_id,scope,value,updated_by) VALUES(a.organization_id,coalesce(p_department::text,'company'),persist,auth.uid())
 ON CONFLICT(organization_id,scope) DO UPDATE SET value=excluded.value,version=expense_catalogues.version+1,updated_by=auth.uid(),updated_at=now();
 RETURN public.get_expense_catalogue(p_department);
END $$;

REVOKE ALL ON FUNCTION public.save_expense_catalogue(uuid,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_expense_catalogue(uuid,jsonb,integer) TO authenticated;

-- Shared TEST expense configuration; original requests and approval routing remain intact.
CREATE TABLE private.expense_catalogues (
 organization_id uuid NOT NULL REFERENCES public.organizations(id), scope text NOT NULL,
 value jsonb NOT NULL, version integer NOT NULL DEFAULT 1, updated_by uuid NOT NULL REFERENCES auth.users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,scope)
);
ALTER TABLE private.expense_catalogues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.expense_catalogues FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.get_expense_catalogue(p_department uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; root jsonb; chosen jsonb; v integer:=0;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION 'EXPENSE_SETTINGS_ACCESS_DENIED'; END IF;
 IF p_department IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.departments WHERE id=p_department AND organization_id=a.organization_id AND active) THEN RAISE EXCEPTION 'INVALID_DEPARTMENT'; END IF;
 SELECT value INTO root FROM private.expense_catalogues WHERE organization_id=a.organization_id AND scope='company';
 root:=coalesce(root,'{"categories":["Consumables & Lab Supplies","Travel & Transport","Accommodation & Stay","Equipment & Tools (CapEx)","Software & Subscriptions","Maintenance & Calibration","Training & Certifications","Office & Operations","Electronic Components & Sensors","PCB Fabrication & Assembly","Harnesses, Cables & Connectors","Mechanical Prototypes & Enclosures","Testing & External Laboratory Services","Product Certification & Compliance","Cloud Hosting & Connectivity","Engineering & Professional Services","Freight, Courier & Logistics","Production Tooling & Fixtures","Facilities & Utilities","Recruitment & Employee Welfare","Marketing & Customer Demonstrations","Other"],"purposes":["Requirements & Feasibility Study","Architecture & Proof of Concept","Prototype Component Procurement","PCB Fabrication / Assembly / Rework","Harness & Connector Development","Enclosure / Mechanical Prototyping","Firmware / Software Development","Development Tools & Licences","Cloud / Data / SIM Services","Bench Testing & Design Verification","EMC / Environmental / Reliability Testing","Product Certification & Regulatory Submission","Pilot Build & Bring-up","Field Trials & Customer Demonstration","Production Tooling & Test Fixtures","Production Support & Quality Improvement","Repair / Service / Warranty Investigation","Equipment Purchase / Replacement","Equipment Maintenance & Calibration","Customer / Supplier / Site Visit","Training & Skills Development","Freight / Courier / Material Movement","Office / Facility Operations","Recruitment & Employee Activities","Other"],"operationsEnabled":false}'::jsonb);
 SELECT value,version INTO chosen,v FROM private.expense_catalogues WHERE organization_id=a.organization_id AND scope=coalesce(p_department::text,'company');
 RETURN jsonb_build_object('categories',coalesce(chosen->'categories',root->'categories'),'purposes',coalesce(chosen->'purposes',root->'purposes'),'operationsEnabled',coalesce((root->>'operationsEnabled')::boolean,false),'version',coalesce(v,0),'canManage',coalesce(a.role='admin' OR (a.role='department_lead' AND (a.department_code='FIN' OR (a.department_code IN ('OPS','HROPS') AND coalesce((root->>'operationsEnabled')::boolean,false)))),false),'isAdmin',a.role='admin');
END $$;
CREATE FUNCTION public.save_expense_catalogue(p_department uuid,p_value jsonb,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; current jsonb; existing private.expense_catalogues%ROWTYPE; k text;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION 'EXPENSE_SETTINGS_ACCESS_DENIED'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=a.organization_id FOR UPDATE;
 current:=public.get_expense_catalogue(p_department);
 IF NOT coalesce((current->>'canManage')::boolean,false) THEN RAISE EXCEPTION 'EXPENSE_SETTINGS_MANAGE_DENIED'; END IF;
 IF (current->>'version')::int IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'SETTINGS_CHANGED_RELOAD_BEFORE_SAVE'; END IF;
 FOR k IN SELECT unnest(ARRAY['categories','purposes']) LOOP
  IF jsonb_typeof(p_value->k) IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->k) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'INVALID_EXPENSE_OPTIONS'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_value->k) x WHERE jsonb_typeof(x)<>'string' OR length(trim(x #>> '{}')) NOT BETWEEN 1 AND 160) OR (SELECT count(*) FROM jsonb_array_elements_text(p_value->k))<>(SELECT count(DISTINCT lower(trim(x))) FROM jsonb_array_elements_text(p_value->k) x) THEN RAISE EXCEPTION 'INVALID_OR_DUPLICATE_EXPENSE_OPTIONS'; END IF;
 END LOOP;
 IF a.role<>'admin' AND p_value ? 'operationsEnabled' AND (p_value->>'operationsEnabled')::boolean IS DISTINCT FROM (current->>'operationsEnabled')::boolean THEN RAISE EXCEPTION 'ADMIN_REQUIRED_TO_CHANGE_SETTINGS_ACCESS'; END IF;
 p_value:=jsonb_build_object('categories',p_value->'categories','purposes',p_value->'purposes','operationsEnabled',CASE WHEN p_department IS NULL AND a.role='admin' THEN coalesce((p_value->>'operationsEnabled')::boolean,false) ELSE (current->>'operationsEnabled')::boolean END);
 INSERT INTO private.expense_catalogues(organization_id,scope,value,updated_by) VALUES(a.organization_id,coalesce(p_department::text,'company'),p_value,auth.uid())
 ON CONFLICT(organization_id,scope) DO UPDATE SET value=excluded.value,version=expense_catalogues.version+1,updated_by=auth.uid(),updated_at=now();
 RETURN public.get_expense_catalogue(p_department);
END $$;
REVOKE ALL ON FUNCTION public.get_expense_catalogue(uuid),public.save_expense_catalogue(uuid,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_expense_catalogue(uuid),public.save_expense_catalogue(uuid,jsonb,integer) TO authenticated;

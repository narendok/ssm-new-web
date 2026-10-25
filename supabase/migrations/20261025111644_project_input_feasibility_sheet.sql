CREATE TABLE public.project_input_sheets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 source_record_id uuid NOT NULL REFERENCES public.operational_records(id), project_record_id uuid REFERENCES public.operational_records(id),
 scope text NOT NULL CHECK(scope IN ('Client','Internal')), input_owner_id uuid NOT NULL REFERENCES public.organization_members(id),
 revision integer NOT NULL DEFAULT 1, version integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Approved')),
 custom_parameters jsonb NOT NULL DEFAULT '[]', parameter_values jsonb NOT NULL DEFAULT '{}', client_evidence text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,source_record_id)
);
CREATE UNIQUE INDEX project_input_one_sheet_per_project ON public.project_input_sheets(organization_id,project_record_id) WHERE project_record_id IS NOT NULL;
CREATE TABLE public.project_input_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sheet_id uuid NOT NULL REFERENCES public.project_input_sheets(id),
 actor_id uuid NOT NULL REFERENCES public.organization_members(id), action text NOT NULL, revision integer NOT NULL,
 details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_input_events_sheet_idx ON public.project_input_events(sheet_id,created_at DESC);
ALTER TABLE public.project_input_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_input_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_input_sheets,public.project_input_events FROM PUBLIC,anon,authenticated;
-- No direct table writes or reads. Checked RPCs enforce source visibility and field ownership.
CREATE FUNCTION private.project_input_template() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT '[{"id": "system_voltage", "section": "Power & Electrical Protection", "label": "System voltage", "hint": "Nominal supply in V (12 / 24 / 48 V are examples, not defaults).", "lead": "EHW", "reviewers": ["QA"], "consumers": ["PUR", "EMF"], "required": true}, {"id": "operating_range", "section": "Power & Electrical Protection", "label": "Operating voltage range", "hint": "Minimum / maximum V, crank and brownout conditions.", "lead": "EHW", "reviewers": ["QA"], "consumers": ["FW", "PUR"], "required": true}, {"id": "transient_noise", "section": "Power & Electrical Protection", "label": "Transient noise", "hint": "Motors, pumps, switching loads and operating environment; source evidence.", "lead": "EHW", "reviewers": ["QA"], "consumers": ["MECH", "PUR"], "required": true}, {"id": "sleep_current", "section": "Power & Electrical Protection", "label": "Sleep current", "hint": "Maximum target in mA and sleep / wake conditions.", "lead": "EHW", "reviewers": ["FW", "QA"], "consumers": ["PUR", "SIT"], "required": true}, {"id": "supply_protection", "section": "Power & Electrical Protection", "label": "Supply protection", "hint": "Reverse polarity, overcurrent, overvoltage and load-dump requirement; applicable test specification.", "lead": "EHW", "reviewers": ["QA"], "consumers": ["PUR", "EMF"], "required": true}, {"id": "cellular", "section": "Processing & Connectivity", "label": "Cellular network", "hint": "Network technology, bands, coverage and operator requirements.", "lead": "EHW", "reviewers": ["FW", "SW"], "consumers": ["PUR", "QA"], "required": true}, {"id": "region", "section": "Processing & Connectivity", "label": "Usage region", "hint": "Country / region, deployment and roaming constraints.", "lead": "SAL", "reviewers": ["QA", "SIT"], "consumers": ["EHW", "FW", "PUR"], "required": true}, {"id": "sim", "section": "Processing & Connectivity", "label": "SIM type", "hint": "Removable SIM / eSIM, provisioning and service owner.", "lead": "EHW", "reviewers": ["FW", "SIT"], "consumers": ["PUR", "SW"], "required": true}, {"id": "gnss", "section": "Processing & Connectivity", "label": "Satellite / GNSS", "hint": "GPS / NavIC or other required constellations, antenna and accuracy.", "lead": "EHW", "reviewers": ["FW", "QA"], "consumers": ["PUR", "MECH"], "required": true}, {"id": "can", "section": "Processing & Connectivity", "label": "CAN lines", "hint": "Count, Classic / FD, speed and purpose such as UDS / IVN.", "lead": "EHW", "reviewers": ["FW", "SW"], "consumers": ["QA", "TST"], "required": true}, {"id": "can_termination", "section": "Processing & Connectivity", "label": "CAN termination", "hint": "Whether / where 120-ohm termination is required; topology.", "lead": "EHW", "reviewers": ["FW", "QA"], "consumers": ["EMF", "TST"], "required": true}, {"id": "storage", "section": "Processing & Connectivity", "label": "Storage / memory", "hint": "Capacity, retention, endurance, offline data and SD / flash / eMMC constraints.", "lead": "EHW", "reviewers": ["FW", "SW"], "consumers": ["PUR", "QA"], "required": true}, {"id": "digital_inputs", "section": "Physical Interfaces & Quantities", "label": "Digital inputs", "hint": "Count, signal levels, ignition / switches, thresholds and protection.", "lead": "EHW", "reviewers": ["FW"], "consumers": ["QA", "TST"], "required": true}, {"id": "digital_outputs", "section": "Physical Interfaces & Quantities", "label": "Digital outputs", "hint": "Count, voltage, current, load type and safe state.", "lead": "EHW", "reviewers": ["FW", "QA"], "consumers": ["PUR", "TST"], "required": true}, {"id": "switching", "section": "Physical Interfaces & Quantities", "label": "High / low switching", "hint": "Separate high-side and low-side counts, current and protection.", "lead": "EHW", "reviewers": ["FW", "QA"], "consumers": ["PUR", "TST"], "required": true}, {"id": "analog_inputs", "section": "Physical Interfaces & Quantities", "label": "Analog inputs", "hint": "Count, sensor voltage / current ranges, accuracy and sampling.", "lead": "EHW", "reviewers": ["FW", "QA"], "consumers": ["TST"], "required": true}, {"id": "serial_ports", "section": "Physical Interfaces & Quantities", "label": "External serial ports", "hint": "USB / UART / RS232 / RS485, counts, speed and connector / isolation.", "lead": "EHW", "reviewers": ["FW", "SW"], "consumers": ["MECH", "QA"], "required": true}, {"id": "ip", "section": "Physical, Thermal & Compliance", "label": "IP rating", "hint": "Required ingress rating, installation conditions and test evidence.", "lead": "MECH", "reviewers": ["EHW", "QA"], "consumers": ["PUR", "EMF"], "required": true}, {"id": "dimensions", "section": "Physical, Thermal & Compliance", "label": "Dimensions & weight", "hint": "Maximum L × W × H in mm, weight, mounting and connector clearance.", "lead": "MECH", "reviewers": ["EHW"], "consumers": ["PUR", "EMF"], "required": true}, {"id": "battery", "section": "Physical, Thermal & Compliance", "label": "Internal battery", "hint": "Required or not; runtime in h, capacity, chemistry, charging and safety.", "lead": "EHW", "reviewers": ["MECH", "FW", "QA"], "consumers": ["PUR"], "required": true}, {"id": "certifications", "section": "Physical, Thermal & Compliance", "label": "Certifications", "hint": "Client / region requirements and applicable editions; no certification is inferred.", "lead": "QA", "reviewers": ["SAL", "EHW"], "consumers": ["MECH", "PUR"], "required": true}, {"id": "temperature", "section": "Physical, Thermal & Compliance", "label": "Operating temperature", "hint": "Explicit minimum / maximum °C, duty cycle and any required grade.", "lead": "EHW", "reviewers": ["MECH", "QA"], "consumers": ["PUR", "TST"], "required": true}, {"id": "use_case", "section": "Project, Delivery & Department Readiness", "label": "Use case & acceptance", "hint": "Intended use, user / vehicle interfaces, acceptance criteria and exclusions.", "lead": "SAL", "reviewers": ["EHW", "SW", "QA"], "consumers": ["SIT", "FIN"], "required": true}, {"id": "quantity", "section": "Project, Delivery & Department Readiness", "label": "Volumes & build stages", "hint": "PoC, pilot and production quantities; milestones do not authorize bulk release.", "lead": "SAL", "reviewers": ["PUR", "EMF"], "consumers": ["FIN", "QA"], "required": true}, {"id": "delivery", "section": "Project, Delivery & Department Readiness", "label": "Delivery milestones", "hint": "Required dates, dependencies, installation and handover acceptance.", "lead": "SAL", "reviewers": ["PUR", "EMF", "SIT"], "consumers": ["FIN", "QA"], "required": true}, {"id": "cost", "section": "Project, Delivery & Department Readiness", "label": "Cost & commercial constraints", "hint": "Target cost, currency and commercial constraints; restricted financial records remain separate.", "lead": "SAL", "reviewers": ["PUR", "FIN"], "consumers": ["EHW", "MECH"], "required": true}, {"id": "sourcing", "section": "Project, Delivery & Department Readiness", "label": "Sourcing & component availability", "hint": "Lead times, lifecycle, approved alternates and supplier / part master references.", "lead": "PUR", "reviewers": ["EHW", "QA"], "consumers": ["EMF", "FIN"], "required": true}, {"id": "firmware", "section": "Project, Delivery & Department Readiness", "label": "Firmware & software integration", "hint": "Protocols, API / HSI, update method, cybersecurity and ownership.", "lead": "FW", "reviewers": ["SW", "EHW", "SIT"], "consumers": ["QA", "TST"], "required": true}, {"id": "manufacturing", "section": "Project, Delivery & Department Readiness", "label": "Manufacturing readiness", "hint": "Assembly process, capacity, tooling, traceability and process controls.", "lead": "EMF", "reviewers": ["MECH", "EHW", "QA"], "consumers": ["PUR", "TST"], "required": true}, {"id": "testing", "section": "Project, Delivery & Department Readiness", "label": "Validation & production testing", "hint": "Acceptance limits, methods, sample size, jig / EOL needs and evidence references.", "lead": "QA", "reviewers": ["EHW", "FW", "TST"], "consumers": ["EMF", "PUR"], "required": true}, {"id": "data_security", "section": "Project, Delivery & Department Readiness", "label": "Data & infrastructure", "hint": "Hosting, data access, retention, privacy, deployment and backup expectations.", "lead": "SIT", "reviewers": ["SW", "FW"], "consumers": ["QA", "SAL"], "required": true}, {"id": "training", "section": "Project, Delivery & Department Readiness", "label": "Training & support readiness", "hint": "Required skills, installation / operator training, support handover and resource gaps.", "lead": "HR", "reviewers": ["SIT", "EMF"], "consumers": ["SAL", "QA"], "required": true}, {"id": "service", "section": "Project, Delivery & Department Readiness", "label": "Service & maintainability", "hint": "Diagnostics, repair, spare parts, warranty assumptions and escalation.", "lead": "SIT", "reviewers": ["EHW", "FW", "PUR"], "consumers": ["SAL", "QA"], "required": true}, {"id": "special", "section": "Special Requirements", "label": "Special requirements & open questions", "hint": "Additional requirements, unresolved assumptions and who must supply clarification.", "lead": "SAL", "reviewers": ["EHW", "QA"], "consumers": ["PUR", "MECH", "FW", "SW"], "required": true}]'::jsonb $$;
REVOKE ALL ON FUNCTION private.project_input_template() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.project_input_visible(p_sheet uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM project_input_sheets s JOIN organization_members m ON m.organization_id=s.organization_id AND m.user_id=auth.uid() AND m.active AND m.role<>'viewer'
 WHERE s.id=p_sheet AND private.is_shared_test_org(s.organization_id) AND (m.role='admin' OR m.id=s.input_owner_id OR private.shared_test_record_visible(s.source_record_id) OR private.shared_test_record_visible(s.project_record_id)
 OR EXISTS(SELECT 1 FROM operational_records r WHERE r.organization_id=s.organization_id AND r.archived_at IS NULL AND r.fields->>'enquiryId'=s.source_record_id::text AND private.shared_test_record_visible(r.id))))
$$;
REVOKE ALL ON FUNCTION private.project_input_visible(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.get_project_input_sheets() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION 'INPUT_ACCESS_DENIED'; END IF;
 RETURN jsonb_build_object('sheets',COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM project_input_sheets s WHERE s.organization_id=a.organization_id AND private.project_input_visible(s.id)),'[]'),
 'events',COALESCE((SELECT jsonb_agg(e) FROM (SELECT e.*,m.display_name AS actor_name FROM project_input_events e JOIN organization_members m ON m.id=e.actor_id WHERE private.project_input_visible(e.sheet_id) ORDER BY e.created_at DESC LIMIT 100) e),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.get_project_input_sheets() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_input_sheets() TO authenticated;
CREATE FUNCTION public.mutate_project_input_sheet(p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; s project_input_sheets%ROWTYPE; src operational_records%ROWTYPE; p jsonb; row_value jsonb; response jsonb; review_dept text; param text; dept text; reviewer text; val jsonb; owner uuid; new_project uuid;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.role='viewer' OR a.is_client THEN RAISE EXCEPTION 'INPUT_WRITE_DENIED'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>65536 THEN RAISE EXCEPTION 'INVALID_INPUT_REQUEST'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text||'project_inputs',0));
 IF p_action='create' THEN
  SELECT * INTO src FROM operational_records WHERE id=(p_payload->>'sourceId')::uuid AND organization_id=a.organization_id AND archived_at IS NULL;
  IF src.id IS NULL OR src.record_type NOT IN ('Project','Enquiry','Opportunity') OR NOT private.shared_test_record_visible(src.id) THEN RAISE EXCEPTION 'INPUT_SOURCE_DENIED'; END IF;
  IF a.role NOT IN ('admin','department_lead') THEN RAISE EXCEPTION 'INPUT_CREATE_DENIED'; END IF;
  IF a.role<>'admin' AND NOT (src.created_by=auth.uid() OR src.department_id=private.shared_test_member_department(a.membership_id)) THEN RAISE EXCEPTION 'INPUT_OWNER_REQUIRED'; END IF;
  IF p_payload->>'scope' NOT IN ('Client','Internal') OR p_payload->>'scope' IS NULL THEN RAISE EXCEPTION 'INPUT_SCOPE_REQUIRED'; END IF;
  IF src.record_type='Project' THEN
   SELECT * INTO s FROM project_input_sheets WHERE organization_id=a.organization_id AND project_record_id=src.id;
   IF FOUND THEN RETURN to_jsonb(s); END IF;
  END IF;
  INSERT INTO project_input_sheets(organization_id,source_record_id,project_record_id,scope,input_owner_id)
  VALUES(a.organization_id,src.id,CASE WHEN src.record_type='Project' THEN src.id END,p_payload->>'scope',a.membership_id)
  ON CONFLICT(organization_id,source_record_id) DO NOTHING RETURNING * INTO s;
  IF s.id IS NULL THEN SELECT * INTO s FROM project_input_sheets WHERE organization_id=a.organization_id AND source_record_id=src.id; RETURN to_jsonb(s); END IF;
  FOR param,review_dept IN SELECT key,value FROM jsonb_each_text('{"system_voltage": "systemVoltage", "operating_range": "operatingRange", "sleep_current": "sleepCurrent", "cellular": "cellularNetwork", "region": "region", "sim": "simType", "gnss": "gnss", "can": "canLines", "storage": "storage", "ip": "ipRating", "dimensions": "dimensions", "battery": "internalBattery", "temperature": "operatingTemperature", "use_case": "scope", "quantity": "quantity", "delivery": "targetDate"}'::jsonb) LOOP
   IF trim(COALESCE(src.fields->>review_dept,''))<>'' THEN
    s.parameter_values:=s.parameter_values || jsonb_build_object(param,jsonb_build_object('input',src.fields->>review_dept,'source',src.reference||' / '||review_dept,'finalValue','','required',true,'responses','{}'::jsonb));
   END IF;
  END LOOP;
  UPDATE project_input_sheets SET parameter_values=s.parameter_values WHERE id=s.id;
 ELSE
  SELECT * INTO s FROM project_input_sheets WHERE id=(p_payload->>'sheetId')::uuid AND organization_id=a.organization_id FOR UPDATE;
  IF s.id IS NULL OR NOT private.project_input_visible(s.id) THEN RAISE EXCEPTION 'INPUT_ACCESS_DENIED'; END IF;
  IF (p_payload->>'expectedVersion')::integer IS DISTINCT FROM s.version THEN RAISE EXCEPTION 'INPUT_STALE_VERSION: Reload before saving; another contributor changed this sheet'; END IF;
  IF p_action='revise' THEN
   IF a.role<>'admin' AND s.input_owner_id<>a.membership_id THEN RAISE EXCEPTION 'INPUT_OWNER_REQUIRED'; END IF;
   IF s.status<>'Approved' OR length(trim(COALESCE(p_payload->>'reason','')))<5 THEN RAISE EXCEPTION 'REVISION_REASON_REQUIRED'; END IF;
   s.revision:=s.revision+1; s.status:='Draft'; s.client_evidence:='';
   -- Carry source values forward, but invalidate every departmental review for the changed baseline.
   FOR p IN SELECT value FROM jsonb_array_elements(private.project_input_template() || s.custom_parameters) LOOP
    param:=p->>'id';row_value:=s.parameter_values->param;
    IF row_value IS NOT NULL THEN
     FOR review_dept IN SELECT jsonb_object_keys(COALESCE(row_value->'responses','{}')) LOOP
      row_value:=jsonb_set(row_value,ARRAY['responses',review_dept,'reviewedBy'],'""');
     END LOOP;
     s.parameter_values:=jsonb_set(s.parameter_values,ARRAY[param],row_value);
    END IF;
   END LOOP;
  ELSE
   IF s.status='Approved' THEN RAISE EXCEPTION 'INPUT_BASELINE_LOCKED'; END IF;
   IF p_action='add_parameter' THEN
    IF a.role NOT IN ('admin','department_lead') OR a.department_code IS NULL THEN RAISE EXCEPTION 'INPUT_PARAMETER_CREATE_DENIED'; END IF;
    IF length(trim(COALESCE(p_payload->>'label','')))<3 THEN RAISE EXCEPTION 'INPUT_PARAMETER_LABEL_REQUIRED'; END IF;
    val:=COALESCE(to_jsonb(string_to_array(NULLIF(p_payload->>'reviewers',''),',')),'[]'::jsonb);
    FOR review_dept IN SELECT jsonb_array_elements_text(val) LOOP
     IF NOT EXISTS(SELECT 1 FROM departments d WHERE d.organization_id=s.organization_id AND d.active AND d.code=review_dept AND d.code<>'CLIENT') THEN RAISE EXCEPTION 'INPUT_REVIEWER_INVALID'; END IF;
    END LOOP;
    s.custom_parameters:=s.custom_parameters || jsonb_build_array(jsonb_build_object('id','custom_'||gen_random_uuid(),'section','Additional Department Questions','label',left(trim(p_payload->>'label'),150),'hint',left(COALESCE(p_payload->>'hint',''),2000),'lead',a.department_code,'reviewers',val,'consumers','[]'::jsonb,'required',true));
   ELSIF p_action='assign_owner' THEN
    IF a.role<>'admin' THEN RAISE EXCEPTION 'INPUT_OWNER_ASSIGNMENT_DENIED'; END IF;
    owner:=(p_payload->>'ownerId')::uuid;
    IF NOT EXISTS(SELECT 1 FROM organization_members m WHERE m.id=owner AND m.organization_id=a.organization_id AND m.active AND m.role='department_lead') THEN RAISE EXCEPTION 'INPUT_OWNER_INVALID'; END IF;
    s.input_owner_id:=owner;
   ELSIF p_action='link_project' THEN
    IF a.role<>'admin' AND a.department_code IS DISTINCT FROM 'SAL' THEN RAISE EXCEPTION 'INPUT_LINK_DENIED'; END IF;
    new_project:=(p_payload->>'projectId')::uuid;
    IF s.project_record_id IS NOT NULL AND s.project_record_id<>new_project THEN RAISE EXCEPTION 'INPUT_PROJECT_ALREADY_LINKED'; END IF;
    IF NOT EXISTS(SELECT 1 FROM operational_records r WHERE r.id=new_project AND r.organization_id=s.organization_id AND r.record_type='Project' AND r.archived_at IS NULL AND private.shared_test_record_visible(r.id)) THEN RAISE EXCEPTION 'INPUT_PROJECT_REQUIRED'; END IF;
    IF EXISTS(SELECT 1 FROM project_input_sheets other WHERE other.organization_id=s.organization_id AND other.project_record_id=new_project AND other.id<>s.id) THEN RAISE EXCEPTION 'INPUT_PROJECT_HAS_SHEET'; END IF;
    s.project_record_id:=new_project;
   ELSIF p_action='client_evidence' THEN
    IF a.role<>'admin' AND s.input_owner_id<>a.membership_id THEN RAISE EXCEPTION 'INPUT_OWNER_REQUIRED'; END IF;
    s.client_evidence:=left(trim(COALESCE(p_payload->>'evidence','')),2000);
   ELSIF p_action='approve' THEN
    IF a.role<>'admin' THEN RAISE EXCEPTION 'INPUT_APPROVAL_DENIED'; END IF;
    IF a.membership_id=s.input_owner_id THEN RAISE EXCEPTION 'INPUT_SELF_APPROVAL_DENIED'; END IF;
    IF s.scope='Client' AND trim(s.client_evidence)='' THEN RAISE EXCEPTION 'CLIENT_APPROVAL_EVIDENCE_REQUIRED'; END IF;
    FOR p IN SELECT value FROM jsonb_array_elements(private.project_input_template() || s.custom_parameters) LOOP
     row_value:=s.parameter_values->(p->>'id');
     IF COALESCE((row_value->>'required')::boolean,true)=false THEN
      IF length(trim(COALESCE(row_value->>'exclusionReason','')))<5 THEN RAISE EXCEPTION 'INPUT_EXCLUSION_REASON_REQUIRED: %',p->>'label'; END IF;
      CONTINUE;
     END IF;
     IF trim(COALESCE(row_value->>'input',''))='' OR trim(COALESCE(row_value->>'finalValue',''))='' THEN RAISE EXCEPTION 'INPUT_INCOMPLETE: %',p->>'label'; END IF;
     FOR review_dept IN SELECT p->>'lead' UNION SELECT jsonb_array_elements_text(p->'reviewers') LOOP
      response:=row_value->'responses'->review_dept;
      IF COALESCE(response->>'status','Pending') NOT IN ('Feasible','Not applicable') OR COALESCE(response->>'reviewedBy','')='' THEN RAISE EXCEPTION 'INPUT_REVIEW_PENDING: % / %',p->>'label',review_dept; END IF;
     END LOOP;
    END LOOP;
    s.status:='Approved';
   ELSE
    param:=p_payload->>'parameterId'; SELECT value INTO p FROM jsonb_array_elements(private.project_input_template() || s.custom_parameters) WHERE value->>'id'=param;
    IF p IS NULL THEN RAISE EXCEPTION 'INPUT_PARAMETER_INVALID'; END IF;
    row_value:=COALESCE(s.parameter_values->param,'{"input":"","source":"","finalValue":"","required":true,"responses":{}}');
    IF p_action='input' THEN
     IF a.role<>'admin' AND s.input_owner_id<>a.membership_id THEN RAISE EXCEPTION 'INPUT_OWNER_REQUIRED'; END IF;
     row_value:=row_value||jsonb_build_object('input',left(COALESCE(p_payload->>'input',''),4000),'source',left(COALESCE(p_payload->>'source',''),2000),'finalValue',left(COALESCE(p_payload->>'finalValue',''),4000),'required',COALESCE((p_payload->>'required')::boolean,true),'exclusionReason',left(COALESCE(p_payload->>'exclusionReason',''),2000));
     -- Changed requirements invalidate prior review confirmations on this parameter.
     FOR review_dept IN SELECT jsonb_object_keys(COALESCE(row_value->'responses','{}')) LOOP
      row_value:=jsonb_set(row_value,ARRAY['responses',review_dept,'reviewedBy'],'""');
     END LOOP;
    ELSIF p_action IN ('respond','review_response') THEN
     review_dept:=p_payload->>'department';
     IF review_dept IS NULL OR NOT (review_dept=p->>'lead' OR (p->'reviewers') ? review_dept) THEN RAISE EXCEPTION 'INPUT_DEPARTMENT_NOT_ASSIGNED'; END IF;
     IF a.department_code IS DISTINCT FROM review_dept THEN RAISE EXCEPTION 'INPUT_DEPARTMENT_DENIED'; END IF;
     IF p_action='review_response' THEN
      IF a.role<>'department_lead' THEN RAISE EXCEPTION 'INPUT_REVIEW_LEAD_REQUIRED'; END IF;
      response:=row_value->'responses'->review_dept;
      IF response IS NULL OR COALESCE(response->>'status','Pending')='Pending' OR trim(COALESCE(response->>'remarks',''))='' THEN RAISE EXCEPTION 'INPUT_RESPONSE_REQUIRED'; END IF;
      response:=response||jsonb_build_object('reviewedBy',a.membership_id,'reviewedAt',now());
     ELSE
      IF COALESCE(p_payload->>'status','') NOT IN ('Pending','Feasible','Conditional','Not feasible','Clarification needed','Not applicable') THEN RAISE EXCEPTION 'INPUT_STATUS_INVALID'; END IF;
      IF trim(COALESCE(p_payload->>'remarks',''))='' THEN RAISE EXCEPTION 'INPUT_REMARK_REQUIRED'; END IF;
      owner:=NULLIF(p_payload->>'ownerId','')::uuid;
      IF owner IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organization_members m WHERE m.id=owner AND m.organization_id=a.organization_id AND m.active AND m.role<>'viewer' AND private.shared_test_member_department(m.id)=private.shared_test_member_department(a.membership_id)) THEN RAISE EXCEPTION 'INPUT_ASSIGNEE_DENIED'; END IF;
      response:=jsonb_build_object('status',p_payload->>'status','remarks',left(p_payload->>'remarks',4000),'evidence',left(COALESCE(p_payload->>'evidence',''),2000),'ownerId',owner,'dueDate',NULLIF(p_payload->>'dueDate','')::date,'authorId',a.membership_id,'reviewedBy','');
     END IF;
     row_value:=jsonb_set(row_value,'{responses}',COALESCE(row_value->'responses','{}')||jsonb_build_object(review_dept,response));
    ELSE RAISE EXCEPTION 'INPUT_ACTION_INVALID'; END IF;
    s.parameter_values:=jsonb_set(s.parameter_values,ARRAY[param],row_value);
   END IF;
  END IF;
  s.version:=s.version+1;s.updated_at:=clock_timestamp();
  UPDATE project_input_sheets SET custom_parameters=s.custom_parameters,input_owner_id=s.input_owner_id,project_record_id=s.project_record_id,revision=s.revision,version=s.version,status=s.status,parameter_values=s.parameter_values,client_evidence=s.client_evidence,updated_at=s.updated_at WHERE id=s.id;
 END IF;
 INSERT INTO project_input_events(sheet_id,actor_id,action,revision,details) VALUES(s.id,a.membership_id,p_action,s.revision,
 CASE WHEN p_action='approve' THEN jsonb_build_object('baseline',s.parameter_values,'parameters',private.project_input_template() || s.custom_parameters,'clientEvidence',s.client_evidence,'scope',s.scope,'sourceId',s.source_record_id,'projectId',s.project_record_id)
 ELSE jsonb_build_object('parameterId',p_payload->>'parameterId','department',p_payload->>'department','payload',p_payload-'expectedVersion','version',s.version) END);
 RETURN to_jsonb(s);
END $$;
REVOKE ALL ON FUNCTION public.mutate_project_input_sheet(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_project_input_sheet(text,jsonb) TO authenticated;

-- Bind selected Smart Upload role profiles to the owning TEST department.
-- Unknown-to-chart profile scopes stay unavailable to employees until an
-- authoritative role/department mapping exists; Admin may choose the owner.
CREATE OR REPLACE FUNCTION private.smart_upload_profile_department(p_profile_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE p_profile_id
    WHEN 'qa_calibration_cert' THEN 'QA'
    WHEN 'qa_lab_tac_report' THEN 'QA'
    WHEN 'mech_cad_assembly' THEN 'MECH'
    WHEN 'mech_2d_drawing' THEN 'MECH'
    WHEN 'mmfg_fai_report' THEN 'MMF'
    WHEN 'sit_rma_fault_sheet' THEN 'SIT'
    WHEN 'pur_vendor_quote' THEN 'PUR'
    WHEN 'pur_distributor_cart' THEN 'PUR'
    WHEN 'str_delivery_challan' THEN 'PUR'
    WHEN 'dsp_eway_bill' THEN 'PUR'
    WHEN 'sal_customer_sor' THEN 'SAL'
    WHEN 'sal_customer_po' THEN 'SAL'
    WHEN 'ehw_schematic_gerber' THEN 'EHW'
    WHEN 'ehw_component_datasheet' THEN 'EHW'
    WHEN 'ehw_bringup_sop' THEN 'EHW'
    WHEN 'ehw_bringup_report' THEN 'EHW'
    WHEN 'fw_release_binary' THEN 'FW'
    WHEN 'fw_pin_matrix' THEN 'FW'
    WHEN 'sw_be_api_contract' THEN 'SW'
    WHEN 'sw_fe_design_tokens' THEN 'SW'
    WHEN 'sw_app_bundle' THEN 'SW'
    WHEN 'emf_pnp_centroid' THEN 'EMF'
    WHEN 'tst_eol_telemetry' THEN 'EMF'
    WHEN 'fin_vendor_invoice' THEN 'FIN'
    WHEN 'ops_audit_sheet' THEN 'HR'
    WHEN 'pm_schedule_mpp' THEN 'HR'
    WHEN 'hr_skill_matrix' THEN 'HR'
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION private.smart_upload_profile_department(text) FROM PUBLIC, anon, authenticated;

DO $patch$
DECLARE d text; old text; replacement text;
BEGIN
 d:=pg_get_functiondef('public.register_controlled_document(jsonb,uuid)'::regprocedure);
 old:=$source$scope text; title text; kind text; meta jsonb; entity uuid;$source$;
 replacement:=$target$scope text; title text; kind text; profile_department text; meta jsonb; entity uuid;$target$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'SMART_UPLOAD_PROFILE_DECLARATION_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 old:=$source$scope:=p_payload->>'scope'; title:=trim(p_payload->>'title'); kind:=trim(p_payload->>'documentType');$source$;
 replacement:=$target$scope:=p_payload->>'scope'; title:=trim(p_payload->>'title'); kind:=trim(p_payload->>'documentType');
 IF p_payload ? 'uploadProfileId' THEN
  profile_department:=private.smart_upload_profile_department(p_payload->>'uploadProfileId');
  IF profile_department IS NULL THEN
   IF a.role<>'admin' THEN RAISE EXCEPTION 'SMART_UPLOAD_PROFILE_UNMAPPED'; END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM public.departments WHERE id=department AND organization_id=org AND active AND code=profile_department) THEN
   RAISE EXCEPTION 'SMART_UPLOAD_PROFILE_DEPARTMENT_MISMATCH';
  END IF;
 END IF;$target$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'SMART_UPLOAD_PROFILE_VALIDATION_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 old:=$source$IF kind IN ('Panel ZIP','Stencil PCB fab') THEN$source$;
 replacement:=$target$IF p_payload ? 'uploadProfileId' THEN
  meta:=meta||jsonb_build_object('uploadProfileId',p_payload->>'uploadProfileId');
 END IF;
 IF kind IN ('Panel ZIP','Stencil PCB fab') THEN$target$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'SMART_UPLOAD_PROFILE_METADATA_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 EXECUTE d;
END
$patch$;

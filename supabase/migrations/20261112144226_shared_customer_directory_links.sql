-- Return minimal customer/supplier directories needed by cross-department forms.
-- Full master records remain subject to the existing department-scoped RLS.
CREATE OR REPLACE FUNCTION public.get_shared_test_workspace()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; result jsonb;
BEGIN
 SELECT * INTO a FROM resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL THEN RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED'; END IF;
 SELECT jsonb_build_object(
 'membership',to_jsonb(a),'serverTime',now(),
 'departments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'name',d.name,'lead_member_id',d.lead_member_id) ORDER BY d.sort_order) FROM departments d WHERE d.organization_id=a.organization_id AND d.active AND d.code<>'CLIENT'),'[]'::jsonb),
 'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'display_name',m.display_name,'role',m.role,'department_id',private.shared_test_member_department(m.id))) FROM organization_members m WHERE m.organization_id=a.organization_id AND m.active AND (a.role='admin' OR private.shared_test_scope(a.organization_id,private.shared_test_member_department(m.id)))),'[]'::jsonb),
 'customerOptions',CASE WHEN a.role<>'viewer' AND NOT a.is_client THEN COALESCE((
   SELECT jsonb_agg(jsonb_build_object('id',r.id,'reference',r.reference,'title',r.title,'status',r.status::text) ORDER BY r.reference)
   FROM operational_records r WHERE r.organization_id=a.organization_id AND r.record_type='Customer' AND r.archived_at IS NULL
     AND lower(r.status::text) NOT IN ('archived','obsolete','rejected')
 ),'[]'::jsonb) ELSE '[]'::jsonb END,
 'supplierOptions',CASE WHEN a.role<>'viewer' AND NOT a.is_client THEN COALESCE((
   SELECT jsonb_agg(jsonb_build_object('id',r.id,'reference',r.reference,'title',r.title,'status',r.status::text) ORDER BY r.reference)
   FROM operational_records r WHERE r.organization_id=a.organization_id AND r.record_type='Supplier' AND r.archived_at IS NULL
     AND lower(r.status::text) NOT IN ('archived','obsolete','rejected')
 ),'[]'::jsonb) ELSE '[]'::jsonb END,
 'partOptions',CASE WHEN a.role<>'viewer' AND NOT a.is_client THEN COALESCE((
   SELECT jsonb_agg(jsonb_build_object('id',r.id,'reference',r.reference,'title',r.title,'status',r.status::text,'mpn',NULLIF(r.fields->>'mpn','')) ORDER BY r.reference)
   FROM operational_records r WHERE r.organization_id=a.organization_id AND r.record_type='Part' AND r.archived_at IS NULL
     AND lower(r.status::text) NOT IN ('archived','obsolete','rejected')
 ),'[]'::jsonb) ELSE '[]'::jsonb END,
 'productOptions',CASE WHEN a.role<>'viewer' AND NOT a.is_client THEN COALESCE((
   SELECT jsonb_agg(jsonb_build_object('id',r.id,'reference',r.reference,'title',r.title,'status',r.status::text) ORDER BY r.reference)
   FROM operational_records r WHERE r.organization_id=a.organization_id AND r.record_type='Product' AND r.archived_at IS NULL
     AND lower(r.status::text) NOT IN ('archived','obsolete','rejected')
 ),'[]'::jsonb) ELSE '[]'::jsonb END,
 'records',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM operational_records r WHERE r.organization_id=a.organization_id AND r.archived_at IS NULL AND private.shared_test_record_visible(r.id)),'[]'::jsonb),
 'tasks',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FROM tasks t WHERE t.organization_id=a.organization_id AND (private.shared_test_scope(t.organization_id,t.department_id) OR t.assignee_id=a.membership_id)),'[]'::jsonb),
 'approvals',COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC) FROM approvals p WHERE p.organization_id=a.organization_id AND a.role<>'viewer' AND (p.created_by=auth.uid() OR private.shared_test_scope(p.organization_id,p.department_id) OR private.shared_test_scope(p.organization_id,p.reviewer_department_id))),'[]'::jsonb),
 'documents',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at DESC) FROM documents d WHERE d.organization_id=a.organization_id AND private.shared_test_scope(d.organization_id,d.department_id)),'[]'::jsonb),
 'audit',COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT * FROM audit_events WHERE organization_id=a.organization_id AND (a.role='admin' OR actor_id=auth.uid()) ORDER BY created_at DESC LIMIT 100)e),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_shared_test_workspace() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_shared_test_workspace() TO authenticated;

-- A selected customer ID is authoritative; reject foreign/archived IDs and
-- refresh display labels from the canonical master row on every linked write.
CREATE OR REPLACE FUNCTION private.validate_customer_master_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE customer operational_records%ROWTYPE; customer_id_text text; customer_link_changed boolean;
BEGIN
 IF NEW.record_type='Customer' OR NOT (COALESCE(NEW.fields,'{}'::jsonb) ? 'customerId') THEN RETURN NEW; END IF;
 customer_id_text:=NULLIF(trim(NEW.fields->>'customerId'),'');
 IF customer_id_text IS NULL THEN
  NEW.fields:=COALESCE(NEW.fields,'{}'::jsonb)-'customer'-'customerCode'-'customer_id';
  RETURN NEW;
 END IF;
 customer_link_changed:=TG_OP='INSERT' OR NEW.fields->>'customerId' IS DISTINCT FROM OLD.fields->>'customerId';
 SELECT * INTO customer FROM operational_records r
  WHERE r.id::text=customer_id_text AND r.organization_id=NEW.organization_id
    AND r.record_type='Customer';
 IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_LINK_INVALID'; END IF;
 IF customer_link_changed AND (customer.archived_at IS NOT NULL OR lower(customer.status::text) IN ('archived','obsolete','rejected')) THEN
  RAISE EXCEPTION 'CUSTOMER_LINK_INVALID';
 END IF;
 NEW.fields:=COALESCE(NEW.fields,'{}'::jsonb)||jsonb_build_object(
  'customerId',customer.id,'customer_id',customer.id,'customer',customer.title,'customerCode',customer.reference
 );
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_customer_master_link() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS validate_customer_master_link ON public.operational_records;
CREATE TRIGGER validate_customer_master_link
 BEFORE INSERT OR UPDATE OF fields,organization_id,record_type ON public.operational_records
 FOR EACH ROW EXECUTE FUNCTION private.validate_customer_master_link();

-- Supplier IDs are used by many departmental records, not only purchase orders.
-- Validate every selected link while keeping approval/qualification gates on
-- the specific purchasing actions that require them.
CREATE OR REPLACE FUNCTION private.validate_supplier_master_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE supplier operational_records%ROWTYPE; supplier_id_text text; supplier_link_changed boolean;
BEGIN
 IF NEW.record_type='Supplier' OR NOT (COALESCE(NEW.fields,'{}'::jsonb) ? 'supplierId') THEN RETURN NEW; END IF;
 supplier_id_text:=NULLIF(trim(NEW.fields->>'supplierId'),'');
 IF supplier_id_text IS NULL THEN
  NEW.fields:=COALESCE(NEW.fields,'{}'::jsonb)-'supplier'-'supplierCode'-'supplier_id';
  RETURN NEW;
 END IF;
 supplier_link_changed:=TG_OP='INSERT' OR NEW.fields->>'supplierId' IS DISTINCT FROM OLD.fields->>'supplierId';
 SELECT * INTO supplier FROM operational_records r
  WHERE r.id::text=supplier_id_text AND r.organization_id=NEW.organization_id
    AND r.record_type='Supplier';
 IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLIER_LINK_INVALID'; END IF;
 IF supplier_link_changed AND (supplier.archived_at IS NOT NULL OR lower(supplier.status::text) IN ('archived','obsolete','rejected')) THEN
  RAISE EXCEPTION 'SUPPLIER_LINK_INVALID';
 END IF;
 NEW.fields:=COALESCE(NEW.fields,'{}'::jsonb)||jsonb_build_object(
  'supplierId',supplier.id,'supplier_id',supplier.id,'supplier',supplier.title,'supplierCode',supplier.reference
 );
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_supplier_master_link() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS validate_supplier_master_link ON public.operational_records;
CREATE TRIGGER validate_supplier_master_link
 BEFORE INSERT OR UPDATE OF fields,organization_id,record_type ON public.operational_records
 FOR EACH ROW EXECUTE FUNCTION private.validate_supplier_master_link();

CREATE OR REPLACE FUNCTION private.validate_part_master_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE part_record operational_records%ROWTYPE; part_id_text text; part_link_changed boolean;
BEGIN
 IF NEW.record_type='Part' OR NOT (COALESCE(NEW.fields,'{}'::jsonb) ? 'partId') THEN RETURN NEW; END IF;
 part_id_text:=NULLIF(trim(NEW.fields->>'partId'),'');
 IF part_id_text IS NULL THEN
  NEW.fields:=COALESCE(NEW.fields,'{}'::jsonb)-'part'-'part_id'-'mpn';
  RETURN NEW;
 END IF;
 part_link_changed:=TG_OP='INSERT' OR NEW.fields->>'partId' IS DISTINCT FROM OLD.fields->>'partId';
 SELECT * INTO part_record FROM operational_records r
  WHERE r.id::text=part_id_text AND r.organization_id=NEW.organization_id AND r.record_type='Part';
 IF NOT FOUND THEN RAISE EXCEPTION 'PART_LINK_INVALID'; END IF;
 IF part_link_changed AND (part_record.archived_at IS NOT NULL OR lower(part_record.status::text) IN ('archived','obsolete','rejected')) THEN
  RAISE EXCEPTION 'PART_LINK_INVALID';
 END IF;
 NEW.fields:=jsonb_strip_nulls(COALESCE(NEW.fields,'{}'::jsonb)||jsonb_build_object(
  'partId',part_record.id,'part_id',part_record.id,'part',part_record.id,'mpn',NULLIF(part_record.fields->>'mpn','')
 ));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_part_master_link() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS validate_part_master_link ON public.operational_records;
CREATE TRIGGER validate_part_master_link
 BEFORE INSERT OR UPDATE OF fields,organization_id,record_type ON public.operational_records
 FOR EACH ROW EXECUTE FUNCTION private.validate_part_master_link();

CREATE OR REPLACE FUNCTION private.validate_product_master_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE product_record operational_records%ROWTYPE; product_id_text text; product_link_changed boolean;
BEGIN
 IF NEW.record_type='Product' OR NOT (COALESCE(NEW.fields,'{}'::jsonb) ? 'productId') THEN RETURN NEW; END IF;
 product_id_text:=NULLIF(trim(NEW.fields->>'productId'),'');
 IF product_id_text IS NULL THEN
  NEW.fields:=COALESCE(NEW.fields,'{}'::jsonb)-'product'-'productCode';
  RETURN NEW;
 END IF;
 product_link_changed:=TG_OP='INSERT' OR NEW.fields->>'productId' IS DISTINCT FROM OLD.fields->>'productId';
 SELECT * INTO product_record FROM operational_records r
  WHERE r.id::text=product_id_text AND r.organization_id=NEW.organization_id AND r.record_type='Product';
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_LINK_INVALID'; END IF;
 IF product_link_changed AND (product_record.archived_at IS NOT NULL OR lower(product_record.status::text) IN ('archived','obsolete','rejected')) THEN
  RAISE EXCEPTION 'PRODUCT_LINK_INVALID';
 END IF;
 NEW.fields:=COALESCE(NEW.fields,'{}'::jsonb)||jsonb_build_object(
  'productId',product_record.id,'product',product_record.id,'productCode',product_record.reference
 );
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_product_master_link() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS validate_product_master_link ON public.operational_records;
CREATE TRIGGER validate_product_master_link
 BEFORE INSERT OR UPDATE OF fields,organization_id,record_type ON public.operational_records
 FOR EACH ROW EXECUTE FUNCTION private.validate_product_master_link();

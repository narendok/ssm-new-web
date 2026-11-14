-- Keep server-side master selectors and link validation in lockstep with the
-- web application's selectable-master status rule.
CREATE OR REPLACE FUNCTION private.is_selectable_master_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT COALESCE(lower(btrim(p_status)), '') NOT IN (
    'archived', 'obsolete', 'rejected', 'inactive', 'cancelled', 'canceled', 'retired', 'disabled'
  )
$$;
REVOKE ALL ON FUNCTION private.is_selectable_master_status(text) FROM PUBLIC, anon, authenticated;

-- Patch the existing guarded functions rather than replacing their access
-- checks, data shape, or write behavior.
DO $master_status$
DECLARE
  item record;
  definition text;
  old_expression text;
  new_expression text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('public.get_business_workspace()'::regprocedure,
       $old$lower(r.status::text) NOT IN ('archived','obsolete','rejected')$old$,
       $new$private.is_selectable_master_status(r.status::text)$new$),
      ('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure,
       $old$lower(r.status::text) NOT IN ('archived','obsolete','rejected')$old$,
       $new$private.is_selectable_master_status(r.status::text)$new$),
      ('public.get_expense_catalogue(uuid)'::regprocedure,
       $old$lower(r.status::text) NOT IN ('archived','obsolete','rejected')$old$,
       $new$private.is_selectable_master_status(r.status::text)$new$),
      ('public.save_expense_catalogue(uuid,jsonb,integer)'::regprocedure,
       $old$lower(r.status::text) NOT IN ('archived','obsolete','rejected')$old$,
       $new$private.is_selectable_master_status(r.status::text)$new$),
      ('public.get_shared_test_workspace()'::regprocedure,
       $old$lower(r.status::text) NOT IN ('archived','obsolete','rejected')$old$,
       $new$private.is_selectable_master_status(r.status::text)$new$),
      ('private.validate_customer_master_link()'::regprocedure,
       $old$lower(customer.status::text) IN ('archived','obsolete','rejected')$old$,
       $new$NOT private.is_selectable_master_status(customer.status::text)$new$),
      ('private.validate_supplier_master_link()'::regprocedure,
       $old$lower(supplier.status::text) IN ('archived','obsolete','rejected')$old$,
       $new$NOT private.is_selectable_master_status(supplier.status::text)$new$),
      ('private.validate_part_master_link()'::regprocedure,
       $old$lower(part_record.status::text) IN ('archived','obsolete','rejected')$old$,
       $new$NOT private.is_selectable_master_status(part_record.status::text)$new$),
      ('private.validate_product_master_link()'::regprocedure,
       $old$lower(product_record.status::text) IN ('archived','obsolete','rejected')$old$,
       $new$NOT private.is_selectable_master_status(product_record.status::text)$new$)
    ) AS patches(signature, old_expression, new_expression)
  LOOP
    definition := pg_get_functiondef(item.signature);
    old_expression := item.old_expression;
    new_expression := item.new_expression;
    IF strpos(definition, old_expression) = 0 THEN
      RAISE EXCEPTION 'SELECTABLE_MASTER_STATUS_PATCH_PRECONDITION_FAILED: %', item.signature;
    END IF;
    EXECUTE replace(definition, old_expression, new_expression);
  END LOOP;
END
$master_status$;

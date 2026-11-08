BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.customer_change_requests) THEN
    RAISE EXCEPTION 'CUSTOMER_CHANGE_ROLLBACK_BLOCKED: export/reconcile request history before rollback';
  END IF;
END;
$$;

DROP FUNCTION public.mutate_customer_change_request(text, jsonb, uuid);
DROP FUNCTION public.get_customer_change_requests(uuid);
DROP FUNCTION private.customer_change_visible(uuid);
DROP FUNCTION private.customer_change_scope_valid(jsonb);
DROP TABLE public.customer_change_events;
DROP TABLE public.customer_change_impacts;
DROP TABLE public.customer_change_requests;
DROP FUNCTION private.reject_customer_change_event_mutation();

COMMIT;

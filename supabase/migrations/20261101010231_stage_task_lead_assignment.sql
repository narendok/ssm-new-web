-- Default assignment for canonical lifecycle work in the isolated TEST backend.
-- Generated work is owned by the department lead; leads can reassign to active
-- department members through the existing guarded task mutation contract.

CREATE INDEX IF NOT EXISTS tasks_assignee_id_idx
  ON public.tasks (assignee_id)
  WHERE assignee_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.assign_generated_stage_task_to_department_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.assignee_id IS NULL
     AND NEW.stage_code IS NOT NULL
     AND NEW.is_custom = false
     AND NEW.department_id IS NOT NULL THEN
    SELECT d.lead_member_id
      INTO NEW.assignee_id
      FROM public.departments d
      JOIN public.organization_members lead
        ON lead.id = d.lead_member_id
       AND lead.organization_id = d.organization_id
       AND lead.active
       AND lead.role = 'department_lead'
     WHERE d.id = NEW.department_id
       AND d.organization_id = NEW.organization_id
       AND d.active
       AND d.code <> 'CLIENT';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.assign_generated_stage_task_to_department_lead()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tasks_assign_generated_stage_to_lead ON public.tasks;
CREATE TRIGGER tasks_assign_generated_stage_to_lead
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION private.assign_generated_stage_task_to_department_lead();

-- Fill only unassigned, generated canonical tasks. Preserve every explicit
-- employee assignment, custom task, completion state, and task history.
UPDATE public.tasks t
   SET assignee_id = d.lead_member_id,
       updated_at = now()
  FROM public.departments d
  JOIN public.organization_members lead
    ON lead.id = d.lead_member_id
   AND lead.organization_id = d.organization_id
   AND lead.active
   AND lead.role = 'department_lead'
 WHERE t.assignee_id IS NULL
   AND t.stage_code IS NOT NULL
   AND t.is_custom = false
   AND t.department_id = d.id
   AND t.organization_id = d.organization_id
   AND d.active
   AND d.code <> 'CLIENT';

-- Keep the stage catalogue helpers' lookup path fixed. They are invoker
-- functions and remain readable only to authenticated users via the existing
-- table policy/grants.
ALTER FUNCTION public.is_valid_canonical_stage(text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_stage_applicable_to_track(text, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.resolve_canonical_stage_prerequisites(text, text)
  SET search_path = public, pg_temp;

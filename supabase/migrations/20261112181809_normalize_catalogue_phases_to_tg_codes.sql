-- Normalize the canonical catalogue's legacy track-phase labels to the fixed
-- company tollgates while preserving every stable stage code and project snapshot.
DO $preflight$
BEGIN
 IF EXISTS (
   SELECT 1
   FROM public.canonical_stage_templates c
   WHERE CASE
     WHEN c.stage_code ~ '^G[0-9]_' THEN 'TG_'||substring(c.stage_code FROM 2 FOR 1)
     WHEN c.stage_code ~ '^CM_[0-9]+$' THEN CASE WHEN substring(c.stage_code FROM 4)::int<=2 THEN 'TG_0' ELSE 'TG_1' END
     WHEN c.stage_code ~ '^HW_[0-9]+$' THEN CASE
       WHEN substring(c.stage_code FROM 4)::int<=5 THEN 'TG_1'
       WHEN substring(c.stage_code FROM 4)::int IN (6,9,12) THEN 'TG_2'
       WHEN substring(c.stage_code FROM 4)::int IN (7,8,25,26,29,30,31) THEN 'TG_4'
       WHEN substring(c.stage_code FROM 4)::int IN (27,28,32) THEN 'TG_5'
       WHEN substring(c.stage_code FROM 4)::int IN (33,37) THEN 'TG_6'
       WHEN substring(c.stage_code FROM 4)::int>=34 THEN 'TG_7'
       ELSE 'TG_3' END
     WHEN c.stage_code ~ '^FW_[0-9]+$' THEN CASE
       WHEN substring(c.stage_code FROM 4)::int<=2 THEN 'TG_1'
       WHEN substring(c.stage_code FROM 4)::int<=4 THEN 'TG_2'
       WHEN substring(c.stage_code FROM 4)::int<=7 THEN 'TG_3'
       WHEN substring(c.stage_code FROM 4)::int<=9 THEN 'TG_4'
       WHEN substring(c.stage_code FROM 4)::int<=11 THEN 'TG_5'
       WHEN substring(c.stage_code FROM 4)::int=12 THEN 'TG_7'
       ELSE 'TG_6' END
     WHEN c.stage_code ~ '^SW_[0-9]+$' THEN CASE
       WHEN substring(c.stage_code FROM 4)::int<=2 THEN 'TG_1'
       WHEN substring(c.stage_code FROM 4)::int<=4 THEN 'TG_2'
       WHEN substring(c.stage_code FROM 4)::int<=7 THEN 'TG_3'
       WHEN substring(c.stage_code FROM 4)::int=8 THEN 'TG_4'
       WHEN substring(c.stage_code FROM 4)::int=9 THEN 'TG_5'
       WHEN substring(c.stage_code FROM 4)::int=10 THEN 'TG_6'
       ELSE 'TG_7' END
     WHEN c.stage_code ~ '^C[0-9]+$' THEN CASE
       WHEN substring(c.stage_code FROM 2)::int<=4 THEN 'TG_1'
       WHEN substring(c.stage_code FROM 2)::int<=9 THEN 'TG_5'
       ELSE 'TG_6' END
     WHEN c.stage_code ~ '^CL_[0-9]+$' THEN CASE
       WHEN substring(c.stage_code FROM 4)::int=1 THEN 'TG_7'
       WHEN substring(c.stage_code FROM 4)::int=2 THEN 'TG_8'
       ELSE 'TG_9' END
     WHEN c.stage_code ~ '^INT_[0-9]+$' THEN CASE
       WHEN substring(c.stage_code FROM 5)::int=1 THEN 'TG_1'
       WHEN substring(c.stage_code FROM 5)::int=2 THEN 'TG_5'
       ELSE 'TG_6' END
     WHEN c.stage_code ~ '^RM_[0-9]+$' THEN CASE
       WHEN substring(c.stage_code FROM 4)::int=1 THEN 'TG_0'
       WHEN substring(c.stage_code FROM 4)::int=2 THEN 'TG_4'
       ELSE 'TG_8' END
     WHEN c.phase_code ~ '^TG_[0-9]$' THEN c.phase_code
     ELSE NULL
   END IS NULL
 ) THEN RAISE EXCEPTION 'UNMAPPED_STAGE_PHASE_CODE';
 END IF;
END $preflight$;

UPDATE public.canonical_stage_templates c
SET phase_code = CASE
 WHEN c.stage_code ~ '^G[0-9]_' THEN 'TG_'||substring(c.stage_code FROM 2 FOR 1)
 WHEN c.stage_code ~ '^CM_[0-9]+$' THEN CASE WHEN substring(c.stage_code FROM 4)::int<=2 THEN 'TG_0' ELSE 'TG_1' END
 WHEN c.stage_code ~ '^HW_[0-9]+$' THEN CASE
   WHEN substring(c.stage_code FROM 4)::int<=5 THEN 'TG_1'
   WHEN substring(c.stage_code FROM 4)::int IN (6,9,12) THEN 'TG_2'
   WHEN substring(c.stage_code FROM 4)::int IN (7,8,25,26,29,30,31) THEN 'TG_4'
   WHEN substring(c.stage_code FROM 4)::int IN (27,28,32) THEN 'TG_5'
   WHEN substring(c.stage_code FROM 4)::int IN (33,37) THEN 'TG_6'
   WHEN substring(c.stage_code FROM 4)::int>=34 THEN 'TG_7'
   ELSE 'TG_3' END
 WHEN c.stage_code ~ '^FW_[0-9]+$' THEN CASE
   WHEN substring(c.stage_code FROM 4)::int<=2 THEN 'TG_1'
   WHEN substring(c.stage_code FROM 4)::int<=4 THEN 'TG_2'
   WHEN substring(c.stage_code FROM 4)::int<=7 THEN 'TG_3'
   WHEN substring(c.stage_code FROM 4)::int<=9 THEN 'TG_4'
   WHEN substring(c.stage_code FROM 4)::int<=11 THEN 'TG_5'
   WHEN substring(c.stage_code FROM 4)::int=12 THEN 'TG_7'
   ELSE 'TG_6' END
 WHEN c.stage_code ~ '^SW_[0-9]+$' THEN CASE
   WHEN substring(c.stage_code FROM 4)::int<=2 THEN 'TG_1'
   WHEN substring(c.stage_code FROM 4)::int<=4 THEN 'TG_2'
   WHEN substring(c.stage_code FROM 4)::int<=7 THEN 'TG_3'
   WHEN substring(c.stage_code FROM 4)::int=8 THEN 'TG_4'
   WHEN substring(c.stage_code FROM 4)::int=9 THEN 'TG_5'
   WHEN substring(c.stage_code FROM 4)::int=10 THEN 'TG_6'
   ELSE 'TG_7' END
 WHEN c.stage_code ~ '^C[0-9]+$' THEN CASE
   WHEN substring(c.stage_code FROM 2)::int<=4 THEN 'TG_1'
   WHEN substring(c.stage_code FROM 2)::int<=9 THEN 'TG_5'
   ELSE 'TG_6' END
 WHEN c.stage_code ~ '^CL_[0-9]+$' THEN CASE
   WHEN substring(c.stage_code FROM 4)::int=1 THEN 'TG_7'
   WHEN substring(c.stage_code FROM 4)::int=2 THEN 'TG_8'
   ELSE 'TG_9' END
 WHEN c.stage_code ~ '^INT_[0-9]+$' THEN CASE
   WHEN substring(c.stage_code FROM 5)::int=1 THEN 'TG_1'
   WHEN substring(c.stage_code FROM 5)::int=2 THEN 'TG_5'
   ELSE 'TG_6' END
 WHEN c.stage_code ~ '^RM_[0-9]+$' THEN CASE
   WHEN substring(c.stage_code FROM 4)::int=1 THEN 'TG_0'
   WHEN substring(c.stage_code FROM 4)::int=2 THEN 'TG_4'
   ELSE 'TG_8' END
 ELSE c.phase_code
END
WHERE c.phase_code !~ '^TG_[0-9]$';

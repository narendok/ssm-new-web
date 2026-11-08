CREATE TABLE private.controlled_original_verifications(
 file_id uuid PRIMARY KEY REFERENCES public.controlled_document_files(id), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 checksum text NOT NULL, size_bytes bigint NOT NULL, storage_path text NOT NULL, storage_object_id uuid NOT NULL,
 verified_by uuid NOT NULL REFERENCES auth.users(id), verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.controlled_original_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.controlled_original_verifications FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.original_has_verified_receipt(p_file uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.controlled_document_files f JOIN private.controlled_original_verifications v ON v.file_id=f.id AND v.organization_id=f.organization_id AND v.checksum=lower(f.checksum) AND v.size_bytes=f.size_bytes AND v.storage_path=f.storage_path
  JOIN storage.objects o ON o.id=v.storage_object_id AND o.bucket_id='controlled-documents' AND o.name=f.storage_path WHERE f.id=p_file)
$$;
REVOKE ALL ON FUNCTION private.original_has_verified_receipt(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.get_controlled_original_verification(p_file_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.get_controlled_file_access(p_file_id);
 RETURN jsonb_build_object('verified',private.original_has_verified_receipt(p_file_id),'fileId',p_file_id);
END $$;
REVOKE ALL ON FUNCTION public.get_controlled_original_verification(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_controlled_original_verification(uuid) TO authenticated;

-- Only the authenticated Edge verifier's server credential may attest actual downloaded bytes.
CREATE FUNCTION public.attest_controlled_original(p_file_id uuid,p_actor_id uuid,p_checksum text,p_size_bytes bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.controlled_document_files%ROWTYPE; object_id uuid;
BEGIN
 IF coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' AND coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' THEN RAISE EXCEPTION 'SERVER_VERIFIER_REQUIRED'; END IF;
 SELECT * INTO f FROM public.controlled_document_files WHERE id=p_file_id FOR UPDATE;
 IF NOT FOUND OR NOT private.is_shared_test_org(f.organization_id) OR lower(f.checksum) IS DISTINCT FROM lower(p_checksum) OR f.size_bytes IS DISTINCT FROM p_size_bytes OR p_size_bytes<=0 OR p_checksum !~ '^[a-fA-F0-9]{64}$' THEN RAISE EXCEPTION 'ORIGINAL_DIGEST_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members m WHERE m.user_id=p_actor_id AND m.organization_id=f.organization_id AND m.active) THEN RAISE EXCEPTION 'VERIFIER_ACTOR_REQUIRED'; END IF;
 SELECT id INTO object_id FROM storage.objects WHERE bucket_id='controlled-documents' AND name=f.storage_path;
 IF object_id IS NULL THEN RAISE EXCEPTION 'ORIGINAL_UPLOAD_INCOMPLETE'; END IF;
 INSERT INTO private.controlled_original_verifications(file_id,organization_id,checksum,size_bytes,storage_path,storage_object_id,verified_by)
 VALUES(f.id,f.organization_id,lower(p_checksum),p_size_bytes,f.storage_path,object_id,p_actor_id)
 ON CONFLICT(file_id) DO UPDATE SET checksum=excluded.checksum,size_bytes=excluded.size_bytes,storage_path=excluded.storage_path,storage_object_id=excluded.storage_object_id,verified_by=excluded.verified_by,verified_at=now();
 RETURN jsonb_build_object('verified',true,'fileId',f.id,'checksum',lower(p_checksum),'sizeBytes',p_size_bytes);
END $$;
REVOKE ALL ON FUNCTION public.attest_controlled_original(uuid,uuid,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attest_controlled_original(uuid,uuid,text,bigint) TO service_role;

DO $patch$
DECLARE d text;
BEGIN
 d:=pg_get_functiondef('private.has_record_original_object(uuid)'::regprocedure);
 d:=replace(d,'AND length(f.checksum)=64','AND length(f.checksum)=64 AND private.original_has_verified_receipt(f.id)');EXECUTE d;
 d:=pg_get_functiondef('private.require_reusable_original_object()'::regprocedure);
 d:=replace(d,'AND length(f.checksum)=64','AND length(f.checksum)=64 AND private.original_has_verified_receipt(f.id)');EXECUTE d;
END $patch$;

CREATE FUNCTION private.require_verified_asset_use() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.reusable_asset_revisions a WHERE a.id=NEW.asset_id AND a.organization_id=NEW.organization_id AND private.original_has_verified_receipt(a.file_id)) THEN RAISE EXCEPTION 'VERIFIED_ORIGINAL_RECEIPT_REQUIRED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.require_verified_asset_use() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_verified_asset_use BEFORE INSERT ON private.project_asset_uses FOR EACH ROW EXECUTE FUNCTION private.require_verified_asset_use();

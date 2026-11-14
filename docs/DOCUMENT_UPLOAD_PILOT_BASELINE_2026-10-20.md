# Document upload pilot — baseline, scope and release gates

Date: 20 October 2026. Status: local implementation; browser and shared-storage verification pending. This is the first rollout slice, not completion of all document-automation phases.

## Baseline

| Item | Result |
|---|---|
| Initial local commit | `549a83a` on `main` |
| GitHub update discovered | `9a6085a`: documentation consolidation only; fast-forwarded without rewriting history or replacing local edits |
| Baseline regression suite | 88 tests passed, 0 failed |
| Baseline production build | Passed; existing large-chunk / Vite configuration warnings |
| Existing working-tree material | Untracked plans, demo files and screenshots retained; not staged as part of this pilot |
| Browser baseline | Old localhost tab had stale module/HMR errors; server was not running. Started the existing Vite app on `127.0.0.1:8080`. The browser origin approval later timed out, so live behavior remains unverified |
| Shared backend | Historical 20 October baseline target: Lovable-managed `rzskhndweihuczbdhoxk`. Current web TEST configuration later moved to `jiqbxcqlywvvmhbgirzl`; this baseline describes the earlier environment. |

## First implementation slice

- Existing Documents & Deliverables layout retained; add/drag-drop opens a compact original-upload form.
- Generic document types: schematic, PCB layout, Gerber ZIP, panel Gerber ZIP, stencil fabrication files, mechanical drawing, STEP, STL, DXF, external certificate/report and other original documents.
- Product names are project metadata, never separate reusable upload types.
- Explicit common/internal-project/client-project/department scope, active project where applicable, owning department and revision. No sample project/device/stage injected by upload.
- Files saved as Internal Draft with actual browser-local author identity, SHA-256 and original bytes in the existing IndexedDB store.
- Existing documents are not matched or overwritten by filename. The former drive shortcut could attach by fuzzy filename and mark a new document Approved; the pilot removes this behavior from that shortcut.
- Panel and stencil packages require an explicitly selected pilot Gerber package from the same project. Save the source document ID, project ID, revision and checksum together. Existing legacy ZIPs are not silently treated as eligible sources.
- Recheck active project/department and exact source Gerber revision against latest local state at record commit. Record and local audit event saved together.
- Await record-save success; attempt attachment cleanup if record save is rejected. No success message on rejected save.
- One current project filter uses existing project-workspace link resolution, including existing linked records. Default All keeps the current library visible.
- Pilot originals can be viewed/downloaded in the existing detail screen; legacy replace/archive controls stay available for legacy documents. Pilot originals remain unchanged; a new draft upload is used for the next artifact pending the controlled-revision workflow.
- Authenticated TEST users retain their existing shared workspace and memberships. This local pilot is read-only in their restored local-example view. It does not introduce partial shared persistence or claim Android synchronization.

## Compatibility boundary

No authentication, account switcher, employee membership, task assignment, task status, stage gate, approval RPC, inventory, Android code, database schema, storage policy or live Lovable configuration changes in this slice. Existing metadata and files are not migrated, deleted or assigned approval automatically. This is a source-scope statement; live regression verification is still required.

Generated editable DOCX/XLSX documents, Admin PDF finalization and client-release enforcement are later phases. Nothing here grants external file access or marks an external certificate as newly issued. Extensions are checked for basic pilot compatibility; this does not certify package contents or substitute for future server-side scanning/content verification.

## Verification

| Check | Result / boundary |
|---|---|
| Regression suite after pilot | 95 passed, 0 failed: original 88 plus 7 upload-model/commit-context tests |
| New tests | Generic type reuse; Internal Draft only; actual author/original metadata; explicit project and own department; common scope without hidden project; allowed extension/size/revision/hash; exact same-project source links; stale project/department/source revision rejection |
| TypeScript / production build | Both passed after the pilot changes; existing bundle-size / Vite configuration warnings remain |
| Browser create/open/reload/download | Pending: automatic browser-origin approval timed out without an approval decision; no unsafe-action determination |
| Live web/Android shared storage and RLS | Pending: actual portal backend not exposed through current Supabase connector |
| UI preservation | Change limited to document uploader, local metadata, project filter and pilot detail labels; no broad redesign. Visual comparison pending |

## Next verification and rollout gates

1. Browser DEMO/local account: take baseline screenshots; upload a disposable schematic and Gerber to one existing test project; create linked panel/stencil draft; open and download originals; reload and verify persistence. No real manufacturing evidence fabricated.
2. Switch departments: own uploads remain scoped; unrelated departments and client cannot open internal originals. Verify ordinary tasks, project selection and approvals still behave as recorded. Recheck signed-in employee versus lead identities.
3. Verify actual Lovable TEST document/file contract, recipient and storage policies before connecting this original-layout uploader. Keep the existing shared workspace working throughout. No cross-project backend substitution.
4. Add real DOCX/XLSX templates for a small generation pilot; then exact-revision lead review, Admin approval, PDF conversion and explicit client release. Confirm revised files require reapproval.
5. Only after browser and shared-contract checks pass, release a small reviewed commit to connected `main` and verify Lovable imported it. Broader UI work and other departments follow separately.

## Rollback

Keep this code on an isolated local feature branch while live checks are pending. Production `main` remains at the imported documentation baseline. Roll back a later published implementation with a normal revert commit, never force push. No schema rollback is required for this slice. Existing document records/attachments are preserved. Any local pilot drafts created during later testing remain explicit drafts; do not silently delete user data during rollback.

# Shared business repair — 24 October 2026

This is implementation/verification evidence. The consolidated handoff remains the specification; this is not a replacement prompt or a claim that every master-plan feature is finished.

## Source and backend

Baseline: web `b6de4c3`, Android `5d10316`. GitHub fetch on 24 October found both local baselines equal to origin/main before these edits. Existing unrelated local files were preserved.

The approved backend remains `rzskhndweihuczbdhoxk`. The Supabase connector lacked access to it; no substitute project was used. Migration `20261021134427_business_workspace_contract.sql` was tested in a rollback-only transaction through Lovable, then deployed through its SQL editor. Verification showed RLS enabled, anonymous RPC access false, direct authenticated table access false, 27 memberships preserved, and zero seeded business items immediately after deployment.

Migration `20261024084915_business_workspace_validation_guards.sql` contains the final RPC corrections. **Deployed on 24 October after explicit user approval.** The initial automatic-review rejection was resolved by that approval. Lovable returned `validation guards deployed`, with 27 memberships and the one synthetic claim preserved. Source tests include both migrations.

## Implemented in this repair

| Area | Result |
|---|---|
| Identity | TEST profiles use exact authenticated membership; missing employment details stay Not recorded. Android no longer converts failed sign-in into a synthetic authenticated session. |
| Session restoration | Web initialization no longer calls a persona callback from an uninitialized render. Failed verification blocks access without silently replacing it with DEMO data or signing out a valid session for a transient failure. |
| Operational workspace | Reuses the existing colored DepartmentProjectWorkspace with shared records, member identities, tasks, documents and approvals. Employee task projection contains the actual assignee's work. Compact record edits write the original record. |
| Finance | Guarded server transactions, exact allocation matching, self-approval denial, version checks and idempotent retries. Approval reserves commitment; evidence-backed posting clears commitment and posts actual expenditure once. Finance employees do not inherit Finance-lead authority. |
| Tickets | Actual requester IDs; internal tickets exclude Sales; client-ticket notes are stripped from client results; Service controls transitions. No inferred email or organization-name identity. |
| HR | Shared directory/employment details, immutable policy/training/form publications, real responses, required-answer validation including false/zero, audiences and recurring assignment cycles. Training submission requires separate evidence-backed HR verification. |
| Response privacy | Anonymous answer rows do not store member/assignment IDs. Completion is separate; detailed reports are withheld below five responses. No claim of operator-proof anonymity or automatic certification. |
| Communication | Explicit private channel membership, real senders, tags, polls, vote switching/deduplication, closed-poll denial and recipient events. Admin does not receive private channels automatically. |
| Search | Compact popup; authenticated search uses permitted shared sources, excludes personnel profiles and raw survey answers, and does not substitute local examples. |
| Project Analysis | Real original records/project links, tasks and authorized document metadata. Explicit dependencies and enquiry associations; missing mappings remain unknown. Removed hardcoded AI4T/readiness fallback. |
| Tasks/layout | Today and Tomorrow/Planned, priority ordering, collapsed Completed; no third admin review lane. Calendar refresh while open; overdue retains deadlines. Smaller DEMO badge and operational lifecycle walkthrough removed from the dashboard. |

The final validation migration additionally fixes the existing record_fields SQL ambiguity, preserves task priority at creation, blocks direct completion of In review tasks, and rejects missing ticket states. These backend corrections were deployed in the approved follow-up migration.

## Evidence

- Web: final regression suite 123/123 passed and production build succeeded after the session fix. Focused database integration tests pass including final migration, original record editing, task priorities and review lock, budget ledger, privacy, recurring assignments and permission failures. TypeScript passed after session correction.
- Android: 54 unit tests, zero failures/errors; testDebugUnitTest and assembleDebug succeeded. This is not a physical-device round trip.
- Browser: authenticated EHW employee opened its actual shared project/task rather than lead examples. My Profile showed that employee and Not recorded for absent verified details, without lead letters.
- A single clearly labelled synthetic TEST claim, INR 1.23, was created for the persistence scenario: visible reference `EXP-f6fbf5f9`, purpose `TEST verification only — persistence 24 Oct`. It is test evidence, not an approved payable, and no allocation/payment was created.
- Browser reload after session correction retained the authenticated EHW identity. Reload preserved the same EXP-f6fbf5f9 claim; the EHW lead then saw the same reference, requester, INR 1.23 and Pending_Dept_Review state with review actions. The employee had no self-approval controls.
- Earlier screenshots: `portal-popup-search-verified.png`, `shared-business-lovable-deployment.png`. Final deployment result: `final-migration-deployed-2026-10-24.png`; cross-account evidence: `shared-claim-lead-verified-2026-10-24.png` in the SSM-new working folder.

## Explicit limits / pending inputs

- Both migrations are deployed. Frontend Git/Lovable import is a separate delivery step; see the final delivery status rather than inferring it from a local build.
- Device installation and web↔Android same-record verification have not been performed in this repair.
- HR letter generation/issue requires the actual approved templates, verified employee fields and designated signer policy. No signatures or employment facts were invented.
- The shared builder currently supports text, number, date, choice, rating and boolean. Attachments, conditional sections, advanced quiz scoring, configurable reminder delivery and attendance capture remain unverified/incomplete; basic training submission is not an issued certificate.
- Recurring assignments catch up idempotently on authorized reads; the owner-only scheduler function is prepared, but an unattended background job and email/push transport have not been configured.
- Existing inventory/asset registers and document binaries were not replaced or duplicated. Shared asset linkage/custody and ticket attachments require their existing canonical backend contract; they are not proved complete by this business adapter.
- Project Analysis derives explicit dependency links and authorized summaries. Missing company mappings and source inputs are not manufactured. Full enquiry authoring before project creation and inline editing of every analysis field are not established by this read adapter.
- Decision Log and the other R01–R15 refinements retain their existing implementations; this repair does not claim every browser-local module has been migrated to shared persistence.
- Private PDF/OCR and PCB tooling integrations remain excluded from this fixing batch.

## Recovery / rollout

The migrations add guarded business storage and replace RPC bodies without deleting existing organizations, members, operational records, tasks, documents, inventory or assets. Do not run DROP/CASCADE as a rollback after real data exists. Revert the client integration to the previous Git commit if necessary; preserve new business records and restore previous RPC definitions from Git inside a reviewed migration. The browser-local DEMO store is never imported into authenticated tables.

Stage only the source/tests/migrations for this repair. Never add the unrelated screenshots, launch scripts, sample files, supabase/.temp or local credentials. Use normal Git pushes without rewriting history.

Source implementation commits: web `149ff0c`; Android `81bb41e`. This follow-up changes verification notes only.

## Live cloud follow-up — 25 October 2026

Forward migration 20261025091500_harden_downstream_master_guards.sql deployed atomically through the existing Lovable SQL editor to backend rzskhndweihuczbdhoxk. Exact source commit: bf4b4da; normalized-LF SHA256: 2ba62202533d68c4bfabda2c5db5a444430ccab2fa61fd949422692edf958422. Recorded in supabase_migrations.schema_migrations and drizzle.__drizzle_migrations (created_at 1792919700000). Live rollback validation passed before commit.

Narrow safety fixes before deployment restrict the direct scenario seeder and manifest visibility to Admin, require TEST-prefixed run IDs, retain policy history via create/update rather than DROP, and revoke direct authenticated manifest writes before granting SELECT. Full regression run: 155 tests passed; final policy/grant changes also passed the focused three transactional tests. No frontend or Android source was changed in this cloud follow-up.

Live post-commit verification: migration recorded true; Admin fixture guard true; anonymous fixture execution denied true; direct authenticated manifest writes denied true. Existing memberships 27, operational records 4 and business items 1 preserved; fixture manifest entries 0. The fixture generator was NOT executed. This establishes deployment, not full portal workflow completion or device parity. Screenshot: lovable-guards-deployed-2026-10-25.png in the working folder.

## Connected sample lifecycle run — 25 October 2026

Executed TEST-LIFECYCLE-20261025-001 in the existing dedicated synthetic organization through the Admin-only fixture RPC. Added 17 real department-lead-owned task records with stable request IDs, persisted stage remarks/history and seven original-ID dependencies. Preserved existing user records. Five new sample projects plus one declined pre-project enquiry; S02 has zero project records. Total database counts after setup: 27 memberships, 27 operational records, 19 tasks (17 new sample tasks plus two existing), one original business item. No ledger, stock, actual PO issue/payment/shipment or client notification was executed. Sample approved statuses/history are simulated starting evidence, not real certifications or gate signatures.

Manual repeatable setup files are supabase/fixtures/connected_lifecycle_examples.sql and connected_lifecycle_links.sql; never run them as automatic production migrations. Replay is tested without duplicate tasks and does not reset initialized sample stage snapshots. Canonical current-phase examples use existing lifecycle stages: S01 Stage 4, S03 Stage 4, S04 Stage 5, S05 Stage 6, S06 Stage 8. Native binaries/certificates were not fabricated; existing sample document metadata is not proof of a valid engineering file.

Forward read-projection migrations 20261025103000 and 20261025110000 deployed atomically through Lovable and recorded in both existing migration ledgers. Existing authorization filters retained for saved history, outcomes and numerical disposition fields. Removed the hardcoded declined-enquiry card from operational intake; the actual saved enquiry and linked sourcing response are displayed. Dependency graph now shows original references instead of raw UUIDs. Source commits aeac895, 472216d and 9cbaccc contain the setup/view work; the following commit includes this evidence note and reference-label cleanup.

Verification: 156 web tests passed, TypeScript and production build passed. Browser Sales session showed six actual projects (five samples plus the original project), its two sample tasks, saved declined outcome with no project and one original linked feasibility response. Purchasing session showed six actual projects and its own task scope, with the production project's saved Stage 8, stage history and explicit dependencies. No physical Android device round trip or full 88-type automation completion is claimed. The six connected sample stories are populated; broader unresolved domain-form work remains governed by the consolidated plan.


## Project Input & Feasibility Sheet — 2026-10-25

Implemented under Project Analysis → Inputs & Feasibility for authenticated shared TEST accounts. Client and internal scopes use the same sheet. Source is an existing enquiry, opportunity or project UUID; no dummy project is created. Existing matching source facts are copied with their original reference, never as final decisions. An enquiry sheet can be linked to its accepted project, including after approval, without copying or unlocking the baseline.

The versioned template in `src/lib/project-input-template.json` contains the 22 supplied technical parameters and 12 additional project/department questions. Each defines primary and supporting review departments plus dependent teams. Department leads can add scoped questions. Admin can assign an internal-project input coordinator. These template review mappings do not modify lifecycle RACI configuration or constitute technical compliance/certification.

Input coordinator maintains requirements, source references, final values and explained exclusions. Contributors assess only their assigned department; leads confirm their department review. Source/evidence selectors use authorized existing record/document IDs. Admin baseline approval is separate, prohibits the input coordinator from self-approval, and rejects missing required values, unresolved conditions or missing lead reviews. Approved snapshots are immutable; a new revision preserves history and clears prior review confirmations. Client approval evidence is a reference recorded for review, not an automatically verified digital signature.

Cloud deployed exact migrations:
- `20261025111644_project_input_feasibility_sheet.sql` SHA-256 `9004e62e6e458a6345835de4a0776ae4ee2230ba7d7f7117fc9a03a2dbbb9c66`.
- `20261025152001_link_approved_input_baseline.sql` SHA-256 `6671ee85753da76b10377f2c5a6dbb91ad3197f75271592fce22e57d93ee7f91`.
Both recorded in Supabase and Drizzle migration ledgers. First migration passed a live rollback validation and existing-row-count preservation check before commit. RLS is enabled; direct table reads/writes are denied to anon/authenticated and RPCs enforce authenticated TEST membership, organization/source visibility, per-department writes and optimistic version checks. Clients cannot read this internal assessment sheet.

Verification: 166 web tests passed; TypeScript and production build passed. Isolated transactional tests cover department/owner denial, stale saves, conditional and unreviewed approval rejection, snapshot immutability, revisions, custom questions, client isolation and linking an approved pre-project baseline without reopening it. Live Sales test created one Draft sheet for existing synthetic `TEST-POC-01`, saved `12 V nominal` with explicit synthetic/client-confirmation-pending source, and cloud query confirmed persistence. Existing operational records remained 28; no real approval, payment, stock movement, shipment or project stage change was performed. Android UI for this new worksheet has not been implemented or device-tested in this change.

# SSM One Web Implementation Plan

**Updated:** 10 November 2026
**Status:** Active web subplan. The cross-platform master plan is the authority for shared product, lifecycle and governance decisions. This document contains only the web delivery approach and acceptance checks.

## Read these sources

- [Cross-platform master plan](https://github.com/narendok/SSM-new/blob/main/SSM_ONE_MASTER_PLAN.md) — shared scope, phase names, departments, RACI, lifecycle and acceptance authority.
- [Document catalogue](https://github.com/narendok/SSM-new/blob/main/SSM%20One%20Document%20Catalogue%20-%20Auto-Drafting%20Audit%20and%20Native%20Upload%20Rules.md) — the single document-family, drafting, revision, upload and release reference.
- [Android implementation plan](https://github.com/narendok/SSM-new-app/blob/main/docs/planning/SSM_ONE_ANDROID_BUILD_PLAN.md) — mobile implementation and parity checks.
- Verification evidence is not retained in the repository. Repeatable checks and acceptance criteria are listed below; generated temporary artifacts stay outside the project folder.

Older portal-master, lifecycle-only and Antigravity review documents are superseded by these sources. Do not use them as active instructions or copy their old assumptions into code.

## Web architecture and safeguards

- The authenticated shared backend is authoritative for people, organizations, permissions, settings, projects, tasks, approvals, records, documents and audit history. Browser-local fixtures are useful for isolated UI work only; they do not prove shared or cloud behavior.
- Use existing authenticated APIs, database objects, RLS and private-file flows. Inspect deployed schema and migration ownership before proposing changes. Never weaken authorization or invent a parallel source of truth to make a demo work.
- RACI describes responsibility; it does not grant access or sign-off authority. Enforce membership, record scope and capability on the server. Gate decisions remain attributable, auditable and idempotent.
- Enforce document visibility separately at list, metadata and original-file download. A selected project, `?role=client`, display filter, document scope label, filename or metadata link is never authorization. Verify the actor's project/department entitlement and exact document revision server-side; client access requires an explicitly released revision and matching project grant. Fail closed on conflicting links and repeat the checks before issuing a private-file URL. Cross-department access requires an explicit server-authorized grant.
- Changes to lifecycle, departments, RACI or catalogues are versioned. New projects use the selected current configuration; existing projects retain their pinned version until an explicit reviewed change. Do not silently rewrite completed work, IDs, evidence or signed decisions.

## Project lifecycle and configurable settings

1. Keep the company overview at fixed phases TG-0 through TG-9 using the names and placement reconciled from the supplied Hexa format. A tollgate is the decision at the phase boundary, not an extra work level.
2. Within each phase, authorized settings users can configure applicable department stages, stage descriptions, dependencies, deliverable links, RACI and default task templates. Settings show only stages for the selected phase. Tasks are defaults, not mandatory copies for every project.
3. The initial organization has 12 configurable departments. Preserve stable IDs and historical ownership. CFT and PM belong to Operations; MMF owns the confirmed mechanical manufacturing work. Department merging changes workspace presentation and routing only through configuration; it must not merge unrelated records or permissions.
4. Sales intake creates an enquiry. Dispatch for feasibility creates or updates the opportunity and the configured review work. Departments provide their scoped inputs. Select the engineering track after feasibility; create the project only after the authorized feasibility decision.
5. At project start, pin the approved lifecycle/RACI/settings versions. Create eligible default tasks once from those settings when their stages become ready. Prerequisites and evidence control readiness; completing tasks never auto-approves a phase. Only an authorized recorded decision passes a tollgate.
6. Allow applicable engineering, purchasing, quality, production, service and operations work to run in parallel when configured dependencies permit. A department sees its authorized part of the project; the project view shows the overall dependency and evidence status.

The latest master-plan checkpoint records a shared TEST configuration of 110 stages and 478 default tasks, including the source-derived 82 lifecycle rows and supporting stages. Treat these as a dated TEST measurement, not a production guarantee. Full TG-0–TG-9 business acceptance and cross-platform parity remain open until separately verified.

## Records, controlled documents and reuse

- Use one compact record dialog. Infer the project, phase and eligible current/previous stage from context; map record type to its fixed stage rule instead of asking users to choose a stage manually.
- In that dialog, let the user draft the record, upload an original file, or select an eligible reusable revision. Common documents can be created without a project; project deliverables require the selected project. Show upload outcome and draft/revision state immediately.
- Use the existing 38-family document catalogue as the type source. Link a phase/stage exit to a catalogue family and exact revision. Drafting, upload, reuse or a task completion never implies review, approval, release, certification or customer acceptance.
- Preserve native original bytes and immutable revisions. A derivative points to its source revision; changing a source never silently updates consuming projects. PCB, harness, enclosure/3D, firmware and document revisions can be reused when authorized and compatible. Digital reuse changes no inventory quantity; physical receipts, issues and reservations use governed stock transactions.
- Keep common, internal-project, client-project and department-operation contexts distinct. Do not expose private client, Finance, HR or IT information through a shared workspace or a cross-department request.
- Inventory and receiving stay Procurement-owned. Track a part's controlled category, manufacturer/part identity, specifications, storage location/bin, project and asset links, quantity by location, allocation and movement history. A goods-received entry links supplier/PO, lot or reel, location, quantity and quality-hold state; held/rejected stock is unavailable, and only an authorized accepted receipt changes available stock.
- Support typed quantities for receipts, issues, returns, transfers, adjustments and multi-part assignments. Validate against available stock; require a reason and audit actor; derive a selected person's department instead of asking the requester to enter it separately. Do not copy records from reference/demo projects.

## Department workflows and low-effort entry

- Keep department overview, tasks, projects, team, records and documents easy to find. Overview is compact; Tasks supports synchronized Checklist, Kanban and Table presentations over the same task set. Project/team lists remain their own destinations, and task filters and favourites preserve scope.
- The task board uses Today / In Progress, Review, and To Do; Completed starts collapsed. A task appears once, and each presentation mode keeps the same filters, project scope, owners and approval guards.
- Each supported department record type opens its own full-page register from canonical navigation. Purchase destinations (Stores, Smart BOM, ingestion, quotations, purchase orders and suppliers) stay separate; do not repeat a second module switcher inside each register.
- Keep training/demo lifecycle walkthroughs in Help or Training, separate from ordinary project status and operational navigation.
- Preserve the current theme, sidebar behavior, responsive layout, approval guards and existing working interactions while compacting repeated headings and descriptions.
- Service and IT may share one configured workspace while retaining distinct ticket types and registers. A ticket can request scoped help from another department; the response is linked to the ticket without exposing protected details or changing its status. Highlight recurring issue candidates from distinct matching tickets for human technical review; frequency alone never diagnoses a cause or creates a release/change.
- Keep the expense request choices clear: Travel, Reimbursement, or Purchase. Travel and reimbursement route to Finance; goods/services requests route to Procurement. Finance category is selected by the requester where required; do not duplicate it with a second business-purpose field. Project/stage may suggest a purpose or category, but the requester can correct suggestions. The shared service catalogue is settings-managed by authorized leads.

### TG-0 Settings-driven feasibility routing — 10 November 2026

Browser-local dispatch now reads CM_02 RACI, active departments, configured leads and default task templates from the current Settings revision. It generates coordinator and selected reviewer tasks with stable template links, retains dispatch instructions and pins the review baseline. Missing configuration blocks dispatch; dispatch does not select an engineering track or overwrite an existing project's stage. Twenty focused checks and TypeScript passed, including variable task counts and one lead owning multiple departments. Live visual dispatch/reload and authenticated shared routing remain pending; this increment does not establish complete lifecycle acceptance.

Live browser-local follow-up: dispatched fictional `HLPL-ROLE-DEMO-ENQ-06` with the saved Settings revision. The Sales projection became an Opportunity with 0/11 sign-offs and no engineering track decision. After reload, the EHW workspace showed the generated default review task assigned to Avery Vale, completion disabled pending approval. Task details retained CM_02, the lifecycle revision, stable template key, enquiry/contract/approval links and entered dispatch remarks. This proves local dispatch and persistence; shared TEST deployment and complete tollgate progression remain unverified. The full web regression completed with 283 passing tests and no failures.

## Delivery order

Browser-local project-start increment: the Project form requires a client/internal source enquiry, engineering track and decision reason. The save transaction checks the linked review approvals, pinned Accountable department and Admin/lead authority, rejects duplicate starts and preserves enquiry/review/approval links. It records the decision actor/time and generates configured CM_01 entry tasks from the pinned lifecycle. The department approval register now opens the existing review screen; missing project context no longer falls back to a sample project. Approval failures retain notes and show an error.

Live local TEST: pending ENQ-06 reviews blocked project creation. All 11 fictional reviews were then signed through the normal UI with explicit TEST comments. Admin created `HLPL-PRJ-0001` on the HW/FW/SW track with CM_01/TG_0 and recorded decision metadata. Reload retained Project Started and the department task count rose by two. Exact generated-task provenance, non-Admin authority, duplicate retry, stale review revisions, other tracks and deployed shared TEST still require live acceptance. Later display changes summarize the saved snapshot and propagate the selected track to the Sales projection; their live readback remains pending. This is not complete lifecycle or shared-client verification.

1. Reconcile this subplan to the cross-platform master and remove duplicate/stale plan copies; preserve code and unrelated local work.
2. Verify current web routes, data contracts, settings editor, RACI matrix, migration state and access boundaries before changing implementation.
3. Complete settings-driven lifecycle configuration and project-specific version pinning without altering existing projects silently.
4. Complete the enquiry → feasibility → opportunity → authorized project-start flow and progressive phase task generation.
5. Complete contextual record creation, document upload/draft/reuse, document-catalogue links and revision-safe asset reuse.
6. Complete configured department workspaces, ticket handoffs, recurring issue review, service catalogue and expense routing.
7. Verify in isolated shared TEST with realistic fictional records. Keep production untouched. Record web, hosted preview, backend and Android evidence separately.

## Acceptance checklist

- Changing an authorized setting is audited, versioned and reflected in the relevant new-project flow; existing pinned projects remain stable.
- Selecting a project automatically shows its phase and eligible stage. Record type fixes the record stage; one save can create the record and attach its original. Reload confirms the saved row and draft file.
- Enquiry dispatch, feasibility contributions, track selection and project start create the expected linked opportunity, review work and eligible defaults exactly once. No project exists before the decision; no task completion bypasses a tollgate.
- RACI assignments produce correct scoped owners across the configured departments without granting data access. Unauthorized roles cannot view or mutate records, files or approvals.
- A common document works without a project; a project deliverable requires one. Reuse links the exact revision across two projects and preserves lineage; digital reuse makes no stock movement.
- Procurement receipts and assignments reconcile quantities by location; held or rejected goods cannot be allocated, and every stock movement has a linked reason and audit entry.
- Service-to-department help reveals only the approved request summary and response. Recurring issue candidates show evidence and require an explicit reviewer action.
- Travel/reimbursement and purchase routes reach the correct teams; service selection is limited to the configured catalogue. Suggested values remain editable.
- Light/dark, collapsed/expanded sidebar, keyboard use, narrow layout, loading/error/empty states and approval guards remain usable.
- Run relevant web checks after implementation. For live claims, capture the environment, role, saved record and reload/readback evidence. Do not claim production, Android or hosted-preview parity from local tests alone.

## Current verified limits

The master plan reports live shared TEST settings/readback and a fictional phase-0 record with an original file. On 8 November, local browser TEST showed a ticket-to-department help request, a recurring-issue candidate and a linked follow-up draft. These are scoped checks, not complete TG-0–TG-9 acceptance. Hosted Lovable parity, Android parity, all role/RACI cases, every phase exit and production deployment are not claimed complete.

## Department role implementation checkpoint — 10 November 2026

### Sample-loader checkpoint — 10 November 2026

Pre-sync verification: production client, SSR and Nitro build completed successfully on 10 November. The earlier `.output/public` EPERM was resolved by building with access to generated output directories. This supersedes earlier build-blocked notes below; warnings about chunk size and deprecated validator calls remain non-fatal. Git synchronization does not apply the pending shared TEST migration or deploy/publish the frontend.

TG-0 live browser-local walkthrough: dispatched fresh `HLPL-ROLE-DEMO-ENQ-04`; the Sales projection became `OPP-HLPL-ROLE-DEMO-ENQ-04`, Sent for Feasibility, with 0/11 reviews complete and no linked Project or selected engineering track. The EHW task linked `HLPL-ROLE-DEMO-ENQ-04-CONTRACT-01` and a pending approval, displayed assignee Avery Vale, and remained after reload. No approval was decided. Fixed Sales' pre-project shortcut by passing the intake-source callback into the pipeline and preserving that source when opening local Inputs & Feasibility. Live click selected the exact enquiry; created its Draft sheet with 34 unanswered inputs, reloaded and reopened the same enquiry/revision. No unrelated project data or approved baseline was selected. Configurable dispatch ownership/default-task routing and authenticated shared parity still need their own acceptance.

Added a separate additive **Lifecycle demos** loader for browser-local TEST. Initial seven-track slice loaded 40 rows: seven pre-project enquiries, seven explicit synthetic-feasibility project checkpoints, fourteen Settings-derived entry tasks and twelve department document-readiness tasks. The pack pins the saved lifecycle revision and leaves existing records/configuration intact. Live readback after refresh retained the pack and the same revision; repeating verification kept 40 rows. Hardware-only checkpoint opened with two entry tasks active. Fourteen focused checks and TypeScript passed. This verifies local loading/persistence, not shared deployment, authenticated role access, later-phase execution, document generation/original files or the supplemental declined/research/production scenarios; those remain pending.

### Lifecycle delivery increment 1 — Settings and revision demo

Subsequent live demonstrations use the [current role-action and seven-track sample pack](https://github.com/narendok/SSM-new/blob/main/Feature%20Roadmap/Sample%20Data%20and%20Test%20Plan.md#current-demo-pack-for-role-actions-and-lifecycle-automation), pack key `SCMS-ROLE-LIFECYCLE-2026-11-10-v1`. Extend versioned walkthrough/checkpoint manifests from Settings, role-scoped actions and record/profile mappings, deterministic task/file links, and separate Planned/Verified/Failed/gap coverage. Show each feature's saved record and reload result for user confirmation before the next demo. The initial local slice is loaded as recorded above; full shared TEST acceptance remains pending.

Implemented configured department selectors, department/stage/task filtering within the ten fixed phases, one Accountable department per stage, automatic inclusion of selected stage/task owners in Responsible, active-department validation, changed-stage preview, discard and no-change save protection. The local department adapter uses canonical aliases, including HROPS → HR. Existing project baselines retain their pinned revisions.

Live browser-local TEST verification: filtered TG-3/HW_18, edited one default task, previewed one changed stage, saved revision `LC-TG-f331ef8d-4f9f-4ce4-8bac-a3678dfd54bd`, refreshed and read the same revision/task back. Thirteen focused lifecycle checks and TypeScript passed before final formatting. This proves local Settings behavior; shared deployment, scoped lead editing and full lifecycle/Android acceptance remain pending. User review of this increment precedes TG-0 enquiry dispatch → feasibility routing → task-owner demonstration, followed by document-control delivery from the consolidated catalogue.

Auto-drafting delivery follows the [consolidated generation and role Docs Vault plan](https://github.com/narendok/SSM-new/blob/main/SSM%20One%20Document%20Catalogue%20-%20Auto-Drafting%20Audit%20and%20Native%20Upload%20Rules.md#consolidated-generation-and-role-docs-vault-plan). Implement one versioned profile registry and scoped Settings; reconcile the supplied role/stage aliases and missing question-bank JSON; bind the ten customer profiles and later-stage source records; use the supplied header/footer layout; expose draft/upload/reuse in the contextual dialog; connect role vaults and the central audit index; then add event-driven stale-draft diffs, review reminders and superseding revisions. Render/inspect supported DOCX/PDF/XLSX outputs and verify persistence, permissions and update behavior against fictional TEST data. These are planned requirements; the reference files do not establish deployed support.

Follow the [master department/lead rules](https://github.com/narendok/SSM-new/blob/main/SSM_ONE_MASTER_PLAN.md#department-ownership-and-multiple-lead-roles) and [multi-track lifecycle](https://github.com/narendok/SSM-new/blob/main/Electronics%20Multi-Track%20Lifecycle%20and%20APQP%20Roadmap.md#fixed-phases-and-configurable-department-execution). Support one authenticated lead across assigned departments in Settings, navigation, related record creation, task ownership and authorized RACI actions. Enforce scope on the server.

Local code adds multi-department lead selection, workspace routing and a forward TEST authorization migration. The 35 focused checks and TypeScript passed. Shared TEST migration deployment and live cross-department task creation remain unverified. Production build is blocked by Windows EPERM on `.output/public`; localhost visual verification is incomplete. Verify scoped record/task creation, default-task assignment, independent approvals, draft/upload and save/reload after deployment before marking this feature live.

# SSM One Web Implementation Plan

**Updated:** 8 November 2026
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

## Delivery order

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

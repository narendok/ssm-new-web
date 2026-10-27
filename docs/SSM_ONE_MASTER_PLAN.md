# SSM One Cross-Platform Master Plan

Last reconciled: 27 October 2026 — current execution/status table and latest lifecycle decisions in consolidated handoff §§16.6–16.7
Status: Active planning baseline. This file is the shared authority for the SSM-new project. Detailed platform documents below implement this plan and must not redefine its cross-platform decisions.

## Scope and authority

SSM One includes the web portal and its backend, the Android client, and shared operational data/document contracts. The web and Android plans are implementation-specific subplans. Where details conflict, this root plan governs shared scope, terminology, sequencing, and acceptance; each platform plan governs its own technical implementation. The former SSMone Web plan at `C:\Users\Admin\AndroidStudioProjects\SSMone\SSMone-Web\docs\planning\SSM_ONE_WEB_PORTAL_MASTER_PLAN.md` is an older source, not a parallel active plan. It is reviewed as historical input; reconcile any unique still-valid requirements into these SSM-new plans before archiving or deleting anything. New planning updates go only to this root and the relevant platform handoff.

- Reference Web implementation: [SSM_ONE_WEB_PORTAL_MASTER_PLAN.md](ssm-new-web/SSM_ONE_WEB_PORTAL_MASTER_PLAN.md)
- Document standards: [DOCUMENT_STANDARDIZATION_PLAN.md](ssm-new-web/docs/DOCUMENT_STANDARDIZATION_PLAN.md)
- Antigravity/Codex handoff and evidence: [ANTIGRAVITY_SYNC_STATUS.md](ssm-new-web/docs/ANTIGRAVITY_SYNC_STATUS.md)
- Android implementation: [SSM_ONE_ANDROID_BUILD_PLAN.md](SSM-new-app/docs/planning/SSM_ONE_ANDROID_BUILD_PLAN.md)
- Document-control reference: [SSM One Document Catalogue — Auto-Drafting, Audit, and Native Upload Rules](SSM_ONE_PLANNING_LIBRARY/SSM%20One%20Document%20Catalogue%20-%20Auto-Drafting%20Audit%20and%20Native%20Upload%20Rules.md) ([source mapping JSON](SSM_ONE_PLANNING_LIBRARY/SSM%20One%20Document%20Catalogue%20-%20Auto-Drafting%20Audit%20and%20Native%20Upload%20Rules.json))
- Electronics-specific product lifecycle and APQP crosswalk: [Electronics Project Lifecycle and APQP Roadmap](SSM_ONE_PLANNING_LIBRARY/Electronics%20Project%20Lifecycle%20and%20APQP%20Roadmap.md)
- Generic SSM One software/product delivery sequence: [Product Build Roadmap](SSM_ONE_PLANNING_LIBRARY/Feature%20Roadmap/Product%20Build%20Roadmap.md)

## Product and architecture decisions

1. **One extensible department model across platforms.** The current baseline departments are SAL, EHW, FW, SW, MECH, PUR, QA, EMF, MMF, FIN, SIT, and HR/OPS. This is the present organization, not a permanent limit. Departments are managed as stable-ID registry records; future departments can be added through governed configuration. A department sees its own records and records explicitly assigned to it; filters and role assignments must never widen authorization.
2. **Final engineering names.** `FW` means Firmware. `SW` means Cloud & Application Software. Do not use EFW, CSW, or ESW as active department labels, new department codes, or new document-ID prefixes. Treat old EFW/CSW values as transitional aliases and ESW as a legacy merged-data alias. Preserve existing entity/document IDs until a reference-safe migration is explicitly specified. Map aliases only from explicit ownership evidence; quarantine ambiguous legacy records for review.
3. **Web/backend is the source of truth.** Authenticated membership and server-side policy determine identity, department, permissions, records, approvals, official numbering, audit history, and private files. A URL role or browser-local demo role is not authentication or authorization.
4. **Android consumes verified contracts.** It must use the same project, department, task, document, approval, and permission semantics as web. Do not implement a second independent source of truth or claim parity before authenticated cross-platform tests pass.
5. **Project and lifecycle evidence must be real and traceable.** Project selection uses stable project identity and explicit links. A screen transition, fixture, generated document, or simulated approval is not proof of an operational lifecycle. Stage gates require recorded authorized decisions and linked evidence.
6. **Document-specific output.** Documents use controlled, type-specific formats populated only from the selected project's verified information. Missing or conflicting values remain explicit; no sample specifications, prices, results, certificates, dates, or signatures are invented. Preview and exported files must agree and preserve revision history.

## Production department model

Production has exactly two manufacturing departments: **EMF — Electronics Manufacturing** and **MMF — Mechanical Manufacturing**. The existing TST/EOL Testing department is retired as a separate department; test execution becomes an assigned production process in EMF or MMF, while QA owns independent test criteria, quality disposition, nonconformance control, and release authority. Do not automatically reassign historical TST records or its lead; map each record by explicit ownership or quarantine it for review.

EMF owns receiving and traceability of accepted outsourced PCB assemblies (PCBAs), enclosure integration/box-build, harness and accessory installation, controlled firmware loading, in-line functional checks, final assembly, packaging, and production travelers. In-house bare-board fabrication and SMT/PCBA assembly (placement, reflow, SPI/AOI) are out of scope for now. If PCBA is outsourced, PUR owns supplier/PO/commercial coordination, QA owns supplier-quality acceptance criteria and disposition, and EHW owns the released design/specification package. MMF owns mechanical part fabrication/finishing and mechanical subassembly/inspection; exact in-house versus supplier operations are configured per capability and project. EMF and MMF coordinate the final product integration handoff.

**Naming and boundaries:** MECH remains Mechanical Engineering (design); MMF is Mechanical Manufacturing (production). Keep any dedicated test-lab capability as a QA-owned function unless a separately approved organization decision creates a stand-alone test department.

## Lifecycle stages, department registry, and responsibility assignments

Keep the lifecycle stage model independent from the organization chart. The approved lifecycle template defines stable stage IDs, order, gate intent, evidence, and transition rules. Department and role assignments are configured against a stage template and the applicable project, product, process, and capability; changing the organization chart must not require renaming or rebuilding lifecycle stages. The current 12 departments are the initial registry, and the model must support adding, splitting, renaming, deactivating, or merging departments as the company grows.

Use a versioned responsibility matrix keyed by lifecycle template/version, stage ID, department ID, role/capability, and applicability. It records RACI responsibility and separately identifies required approver/signatory authority. Each project pins the matrix/template version accepted at its baseline. A governed change may take effect for new projects or through an explicit project change with impact review and re-approval; it must not silently rewrite historical decisions, completed work, or signed records. Preserve stable IDs and effective dates; renames use aliases, and splits/merges require explicit record ownership mapping.

HR/OPS, Finance, Service/IT, QA, and other shared functions can contribute horizontally wherever applicable; they are not forced into every stage as sequential gates. Stage events create work only when the matrix says it applies and an authorized owner is assigned. HR/OPS examples include staffing/capacity, competency and training, onboarding, and safety/compliance readiness, with confidential personnel fields restricted to authorized HR users. An assignment or RACI entry does not itself grant data access: authenticated membership, project/record scope, and capability policy remain independent authorization checks. “Informed” means notification eligibility, never automatic read permission.

Governance rules: normally one Accountable owner per decision/work package; Responsible, Consulted, and Informed assignments may be multiple. Every required gate must have an accountable owner and authorized signer or be explicitly marked not applicable with rationale. Configuration changes require an authorized admin, effective date, impact preview, audit record, and tests for old-project stability and new-project routing. New departments receive no inherited project, document, team, or approval access by default. Web and Android consume the same backend-owned registry and matrix contract.

## Master lifecycle data table — 27 October 2026

Latest user decision: **project track (lifecycle) → phases → stages → tasks**. This extends the existing Chronicles, responsibility matrix and task/record models; it does not authorize another independent lifecycle system. Detailed defaults and acceptance are in [consolidated handoff §16.7](ANTIGRAVITY_READY_TO_USE_CONSOLIDATED_HANDOFF_2026-10-21.md). This table is the intended shared data contract, not evidence of deployed schema.

| Entity | Minimum governed data / relationship | Preservation and automation rule |
| --- | --- | --- |
| Lifecycle / track template | Stable ID, code/name, version, effective state, development-scope combination, applicable phase IDs | Explicit scopes: firmware only; hardware + firmware; hardware + firmware + software; software only; hardware only. Preserve ready-made/catalog and legacy mappings. Internal/client and PoC/pilot/bulk purpose are independent dimensions; Purchasing procurement track is separate. |
| Phase template | Stable ID, track version, name/order, applicability and stage template links | Fixed defaults per track, configurable through governed template changes. Broad legacy nine-stage labels need explicit mapping; do not blindly rename/reindex existing stage history as phases. |
| Stage template | Stable ID, phase version/link, order, inputs, expected outputs, dependencies, responsible department/owner rules and existing gate policy | Predefined defaults; authorized project-specific stages may be added at any time. Not-applicable stages need explicit applicability handling; adding a stage does not grant approval authority or unlock existing gates. |
| Task template | Stable ID, stage link, task type/title, applicability, assignee rule, required evidence, dependency and configured scheduling rule | Auto-create applicable draft/pending tasks once. Users may modify/add project tasks within existing permissions. No invented due dates, finished work, approvals or sample specifications. |
| Project lifecycle instance | Actual project ID, pinned template/matrix version, actual phase/stage instances, development scope and approved purpose | Prefill from approved intake where deterministic; generate only missing applicable work idempotently. Pre-project feasibility can exist without a project; declined enquiries remain no-project. |
| Project stage/task overrides | Instance ID, actual owner, additions/changes, dependency links, reason, author/time/version | Own-department lead edits only authorized responsibilities. Preserve completed work, document references and prior approvals. Shared common view does not imply cross-department editing rights. |
| Connected input / deliverable | Existing parameter/record/document/master IDs, actual value/status/evidence and owning department | Reuse the canonical input sheet and records; searchable selection and authorized inline creation preserve draft and return actual IDs. No second copy of project specifications. |
| Configuration / audit | Template change version, impact preview, effective date, authorized decision, project adoption event | New defaults affect new projects; active projects require explicit reviewed adoption. Track changes retain all history and require dependency/applicability impact review. Never silently regenerate or delete existing work. |

| Development scope | Primary engineering responsibility | Typical default progression (not invented mandatory gates) |
| --- | --- | --- |
| Firmware only | FW; EHW consulted only for actual board/interface dependencies | Requirements/feasibility → baseline → firmware development → integration/verification → release/support |
| Hardware + firmware | EHW + FW | Requirements/feasibility → baseline → parallel development → prototype/bring-up → integration/verification → applicable pilot/release |
| Hardware + firmware + software | EHW + FW + SW | Requirements/feasibility → baseline → parallel development → system integration → verification → applicable customer pilot/release |
| Software only | SW | Requirements/feasibility → baseline → software development → integration/verification → deployment/release/support |
| Hardware only | EHW | Requirements/feasibility → baseline → hardware development → prototype/verification → applicable pilot/production release |

QA, MECH, PUR, EMF, MMF and shared departments participate only when applicable through requirements, dependencies and the approved matrix. These defaults do not impose automotive tests/certification or manufacturing tasks on software-only, firmware-only, internal or ready-made work. Existing specification examples below are potential fields/topics, not prefilled company requirements or mandatory technical choices for every project. Exact standards, values and gates must come from the project's approved requirements.

Execution ownership: Antigravity works on repository code/tests and additive migration artifacts; an authorized operator handles Lovable-only application and runtime verification. Read the current execution/status table at the top of the consolidated handoff before any implementation. Completed features are preserved; pending acceptance is verified before changing code. Source push, cloud migration deployment, preview behaviour and Android parity are separate evidence gates.

## Departmental Requirement Sheets & Feasibility Freeze (Stage 2 Gate)

Each department that is applicable to the project prepares its domain-specific requirement sheet during Stage 2 Feasibility analysis before downstream engineering work begins. The responsibility matrix decides applicability and the accountable owner; shared-service contributions are included when relevant:
1. **SAL — Customer & Commercial Feasibility (SOR / mNDA)**: Validates customer SOR, commercial pricing, volume schedules, and contractual warranty/liability terms.
2. **EHW — Hardware Product Requirement Sheet (EHW-PRS)**: Defines electrical architecture, MCU selection, power regulation (9V–36V transient clamping), component obsolescence/AEC-Q ratings, and PCB layout constraints.
3. **FW — Firmware Product Requirement Sheet (FW-FRS)**: Defines RTOS kernel (FreeRTOS/Zephyr), memory map, HAL bring-up, interrupt priorities, protocol drivers (CAN J1939/OBD-II), and dual-bank bootloader fail-safe OTA requirements.
4. **SW — Software Requirement Specification (SW-SRS)**: Defines cloud telemetry ingestion protocols (AIS-140 MQTT/TLS 1.3), Bluetooth GATT schemas (TPMS/temperature), fleet APIs, webhooks, and production line diagnostic flashing GUI tools.
5. **MECH — Mechanical Requirement Sheet (MECH-MRS)**: Defines 3D form factor, enclosure IP67 sealing, vibration/drop dampening, thermal dissipation, connector clearance, and mold tooling feasibility.
6. **PUR — Sourcing & Supply Chain Feasibility (PUR-BOM)**: Verifies Approved Supplier List (ASL), long-lead component availability, MOQ, and dual-sourcing strategy.
7. **QA — Quality & Compliance Requirement Sheet (QA-QRS)**: Defines DVP&R test matrix, automotive compliance standards (AIS-140, ISO 7637-2, ISO 16750), type approvals (iCAT/ARAI), and incoming lot sampling plans.
8. **EMF — Electronics Manufacturing Feasibility (EMF-DFM)**: Verifies accepted outsourced PCBA supplier/lot interfaces, incoming traceability, box-build and line-integration capability, controlled programming, and in-line/final functional testing. In-house SMT, placement, reflow, SPI/AOI, and bare-board fabrication are outside the current scope.
9. **MMF — Mechanical Manufacturing Feasibility (MMF-DFM)**: Verifies plastic injection molding, CNC machining, gasket tooling, and mechanical assembly tolerances.
10. **FIN — Financial & Capital Feasibility**: Verifies payment credit terms, NRE tooling amortization, BOM margin threshold, and cash-flow requirements.
11. **SIT — Service & IT Infrastructure Feasibility**: Defines server hosting capacity, network security/ISMS, telemetry database backup, and field RMA diagnostic procedures.
12. **HR/OPS — Human Resources & Operational Competency Feasibility**: Assesses technician IPC-A-610 workmanship training, ESD certification, and staffing requirements.

Applicable departmental requirement points compile into the unified **Contract Review & Feasibility Report (`HLPL/F/MKT/01`)**. Record applicability and explicit rationale for excluded contributions; do not require all 12 departments for every track. Required sign-off and requirement freeze follow the approved project gate policy before the corresponding engineering kickoff.

## User-confirmed workflow and UX requirements

- All department roles use Today and Tomorrow / Planned task columns, priority-first, with Completed collapsed. Overdue unfinished work remains in Today with original due dates. Approvals have a separate queue. This supersedes earlier three/four-column alternatives.
- Department workspace is one project-aware view. A project selector scopes project identity, tasks, linked documents/references, approvals, and recorded owners to that project while leaving unlinked department records clearly separate.
- Team, task, approval, reference, and document views default to department-relevant information while retaining explicitly authorized collaboration.
- Lifecycle gates and document generation must be backed by real persistent records and attributable actions before the portal is described as operational end to end.

## Delivery sequence and current gate

1. **Batch 1 — department identity, migration, routing and preservation.** Antigravity reports 29 automated tests and TypeScript passing; Codex independently reproduced those results on 19 October. This batch is **not signed off**: the current local implementation uses FW/SW active IDs and adds schema-4 TST retirement/preservation; organization ownership and authenticated acceptance remain outstanding. See [local reconciliation](evidence/LOCAL_MASTER_PLAN_RECONCILIATION_2026-10-19.md). Codex could not verify localhost from this execution environment, and the local production build stopped at a sandbox EPERM while preparing a shared `node_modules` output directory. Antigravity must reconcile canonical role names and re-run build/browser evidence in its authorized environment.
2. **Batch 2 — document catalogue and type-specific templates.** The current catalogue records 38 logical families, 89 unique source blocks, and 90 family-source links because source block B0545 maps to two families; D02 and D04 are clarification-only. These are catalogue coverage counts, not required output-file quantities. Reconcile required outputs, project/department ownership, feasibility against actual project information, dependencies, acceptance evidence, and target phase.
3. **Batch 3 — authenticated backend and operational lifecycle.** Verify organization and users, authentication, server-side authorization/RLS, persistence, audit history, private file access, notifications, approval gates, and full project lifecycle in a non-production test environment before production deployment.
4. **Batch 4 — Android contract parity.** Implement only against verified web/backend contracts. Run separate Android build, device/navigation, offline/cache isolation, permissions, and cross-platform round-trip acceptance.

Lovable editor preview, localhost, published deployment, backend, and Android are separate environments; report evidence for each separately. A passing local test suite does not certify the live service or production data.

## Acceptance standard

Close a batch only when the exact source revision and changed files are identified; required automated checks pass; browser/runtime behavior is independently reproduced for relevant roles; negative access tests pass; persisted state and cross-links survive refresh; and evidence is recorded in the sync ledger. Keep unresolved risks and failed checks visible. Do not mark a simulated flow as complete operational functionality.

## Latest record-flow verification requirements — 25 October 2026

Read [the consolidated implementation and verification handoff](ANTIGRAVITY_READY_TO_USE_CONSOLIDATED_HANDOFF_2026-10-21.md), especially section 14, before further record-flow implementation. This is the latest scoped user-requirement expansion of this master plan, not a second competing work package. Its latest explicit user decisions supersede conflicting older UI/record-flow alternatives; compatible requirements remain. It contains per-type starting contracts, property/callback dictionaries, role and edge-case verification, 38-family document reconciliation, evidence gates and one final execution prompt. Nothing in a planning table is deployment or standards-certification evidence.
## 26 October implementation checkpoint

Read section 15 of [the consolidated handoff](ANTIGRAVITY_READY_TO_USE_CONSOLIDATED_HANDOFF_2026-10-21.md) for the complete latest requirement/evidence ledger and remaining gates. The October 19 delivery gate above is historical, not the current build or deployment status. This handoff is one work package with one final execution prompt.

Latest lifecycle hierarchy refinement (27 October 2026): see consolidated handoff section 16.7, authoritative track → phase → stage → task plan and legacy migration/acceptance rules. Section 16.6 records the search checkpoint and remaining inventory-source decision. Preserve the existing original layouts and shared account contracts.

Connected sample-data placement and latest sidebar/SOR/document refinements: consolidated handoff §16.8 and [Sample Data and Test Plan](https://github.com/narendok/SSM-new/blob/main/Feature%20Roadmap/Sample%20Data%20and%20Test%20Plan.md). Samples belong to canonical TEST registers with provenance; this planning update does not authorize new users, visibility grants, production fixtures or a database reset.

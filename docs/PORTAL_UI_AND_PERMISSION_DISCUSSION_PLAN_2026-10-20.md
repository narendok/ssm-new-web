# SSM New - consolidated UI, project and permission plan

Date: 20 October 2026 (India)
Status: DISCUSSION PLAN ONLY. No feature, UI, migration, permission or deployment change is authorized by this document alone. This consolidates the latest decisions in the live discussion; earlier alternatives below are explicitly superseded. The user's actual project folder will be mapped in a later appendix.

Implementation status is tracked separately in [the 21 October checkpoint](UI_REFINEMENT_CHECKPOINT_2026-10-21.md); this requirements document does not imply that every row is implemented.

## 1. Product and implementation boundaries

| Area | Final direction | Boundary |
|---|---|---|
| Target | Existing SSM-new-web Lovable project | SSMone is a read-only layout reference, not a migration target |
| Appearance | Preserve original colored portal, cards, tabs and theme | Never replace it with a raw shared-data screen |
| Data | One authoritative project/record/file identity across views | Restoring a layout does not establish backend integration |
| Shared sign-in | Preserve existing TEST accounts, employee identities and server-derived membership | Local persona, category, stage or folder never grants access |
| Backend | Reuse existing managed backend and verified contracts | Missing contracts remain explicit dependencies; no invented live endpoints |
| Current limits | Many restored legacy domain forms are still local demo, not shared operational forms | New layout must not imply those saves synchronize |
| Folder | Await user-supplied actual project structure | No files imported, moved, generated as evidence or relabeled as approved |
| Execution | Plan and map first; implement together after discussion | No automatic live schema/permission change from this plan |

## 2. Role and access matrix

Visibility is checked server-side using actual organization membership, department/project scope and record-specific grants. A common overview exposes only approved summary fields; it does not expose every department's files, finance or HR records.

| Capability | Employee | Department lead | Admin |
|---|---|---|---|
| Identity | Actual signed-in employee, never lead alias | Actual lead | Actual admin |
| Default work | Own assigned tasks and permitted department/project records | Own department queue and team workload | Authorized cross-department overview |
| Routine task status | Start/update/complete permitted tasks | Manage department tasks | Observe according to latest user task-assignment rule |
| Reassignment | Routine within-department reassignment is intended without a separate approval queue; exact employee eligibility rule must be confirmed before enabling broader writes | Reassign eligible employees within own department/project | User explicitly said Admin does not reassign tasks; implement this distinction in server policy, not only UI |
| Team | View relevant authorized project roster | Add/remove/reassign existing eligible department members for project | Manage identity/access configuration; does not silently override task assignment policy |
| Final stage/release | No final sign-off | Only designated authorized signer | Only designated authority, not implicit permission from overview access |
| Formal inter-department handoff | Prepare work/evidence | Submit/review formal handoff | Access/approval only where designated |
| Decision/deviation entry | Draft/submit; own submissions/status visible | Create official entry or approve department employee submission | Authorized visibility and management escalation |
| Other department files | Explicitly shared references/review grants only | Explicitly shared references/review grants only | Authorized scope, not unrestricted by assumption |
| Decision-log visibility mapping | Cannot change | Cannot change | Only Admin changes which departments can see which logs |
| Restricted commercial/HR/client data | Explicit field/record grant required | Lead title alone is insufficient | Explicit authorized scope |

Team changes must not create login accounts, widen role capabilities or grant confidential files automatically. Removing a team member must surface pending assigned tasks and resolve reassignment without destroying historical authorship. All assignment/team changes are attributable audit events.

## 3. Checklist and task interaction

| Element | Final behavior |
|---|---|
| Shared visual reference | Existing Admin compact colored checklist rows, reused in Admin and department views |
| Column 1 | Today / In Progress |
| Column 2 | Tomorrow / Planned |
| Column 3 | Review / Approval |
| Completed | Compact collapsed section below active columns with arrow/count; not a fourth column |
| Normal task checkbox | Complete permitted routine work and move it into Completed |
| Approval-dependent task checkbox | Submit to Review; not Complete until actual required approval succeeds |
| Unfinished Today task | Stays in Today; show overdue where relevant; user manually reschedules to Tomorrow |
| Compact row | Relevant badge, priority, title, assignee, due date; expand for project, next action and details |
| Badge | Admin may need department badge; department view can use record/document type. Exact final badge wording pending visual review |
| Views | Checklist, Kanban and Table use the same task records and permissions |
| Add action | Clear + Add Task inside task tab/header; no detour through generic Add Record |
| Read/write checks | Assignment, status and approval conditions rechecked on server with stale-version protection |

## 4. Record forms and contextual actions

| Context | Add action / form | Defaults and safeguards |
|---|---|---|
| Tasks | + Task -> compact modal | Current project/department/task type prefilled |
| Deliverables & Docs | + Deliverable -> compact modal | Current project/department; small type chooser only if several types apply |
| Team | + Member -> searchable existing eligible employees | Lead/project scope enforced; no account provisioning |
| Approvals | Automatically populated from real submissions/requests | No fabricated standalone approval/signature |
| Generic record | Context-specific create/edit modal | Preserve existing structured fields and linked record IDs |
| Existing record detail edit | Compact overlay, Save/Cancel, return to same list/project/scroll state | No mandatory full-page edit/back navigation |
| Project / assignee search | Searchable combobox with live results | Authorized projects and eligible assignees only; ID-based selection |
| Due date | Suggest from Chronicles / Department Flow rules | Manual override not silently overwritten; define base event, duration and calendar |
| Workflow settings | Stage/record-type default duration, working-day rule and reminder offsets | New defaults do not silently rewrite existing project deadlines or baselines |
| Notifications | On assignment, review outcome and configured deadline offsets | Correct recipient, idempotency and no duplicate reminder floods |
| Popup styling | Compact modern modal, consistent spacing, clear labels, responsive height | Preserve original colors; keyboard focus, validation and long-form scrolling |
| Card styling | Thin semi-transparent border, modest radius/shadow | Legible in light/dark themes, no heavy glow |

## 5. Sidebar, top bar and search

| Area | Final behavior |
|---|---|
| Active item | One canonical destination active; parent may expand but is not another selected item |
| Favorites | Mirror destinations without creating several independent active selections |
| Confirmed bug | PRS, Schematics and DFMEA currently share Deliverables active conditions and highlight together; fix destination identity |
| Record navigation | Clear department record-type destinations; deduplicate only if two entries truly open identical content |
| Scroll | Fix unnecessary horizontal overflow; thin scrollbar and lighter menu borders |
| Settings | Existing top Settings icon remains; sidebar has one expandable Settings group with department-related sub-options |
| Admin settings | All authorized options together; department users see only permitted options |
| Portal configuration | Remove duplicate standalone sidebar shortcut; retain inside grouped Settings/navigation |
| Cloud/Sync | Within relevant authorized Settings group, not another large top-level shortcut |
| Assets | Department-wise sidebar module; remove duplicate top-bar shortcut |
| Theme | Single toggle at sidebar bottom; remove duplicate top-bar toggle |
| Global search - wide screen | Compact search field in top bar |
| Global search - small screen | Search icon opens popup |
| Search results | Compact popup/dropdown; documents, tasks and process records; optional small type selector |
| Search navigation | Open actual result record; no forced full Unified Search page |
| Search access | Search cannot reveal records or snippets beyond actual backend permission |

## 6. Project navigation and analysis - two complementary routes

| Route | Default | Project selected | Editing |
|---|---|---|---|
| Manage Projects | Full-page list/cards of permitted projects with Add Project | Full project detail/workspace, information in tabs | Contextual edit forms according to field/department capability |
| Project Analysis Dashboard | Overview across all permitted projects | Detailed analysis for chosen project | Common read view by default; explicit Edit exposes only permitted fields |
| Department Project Workspace | All permitted projects for department | Department/project-specific records, tasks, documents, approvals and team | Existing workspace approach retained |

Manage Projects should expose code/name, client, owner, current stage, status and target date. Project detail starts with Overview/Insights containing recorded customer intake/scope and key information. List, analysis and workspace share the same entities; no copied project records. Internal/External type or separate client filters are NOT required for the general project dropdown in this increment. All means all permitted projects, not every company record.

## 7. Project detail tabs and GPS/OBD tracker reference

| Section | Contents | Access / evidence rule |
|---|---|---|
| Overview / Insights | Intake, scope, health, current stage, blockers, next action, deadlines | Recorded values only; summary access does not grant file access |
| Customer Inputs | Requirements, interfaces, customer references | Approved relevance to department; confidential commercial fields stripped |
| Lifecycle | Actual stages, evidence links, approvals, responsibility and milestones | Task completion is not stage clearance; authorized gate transaction required |
| Team | Relevant project people, role/responsibility, contact/handoff | Lead manages eligible own-department assignments |
| Physical Delivery | PoC/sample devices shipped, quantity, device/serial IDs, recipient, dates, receipt, feedback | Not confused with a document deliverable; link revision/baseline |
| Documents & Deliverables | Expected outputs, documents, versions and review status | User later confirmed this project tab remains; original file opens, no duplicate library |
| BOM | Tentative/review BOM and approved frozen baseline | Preserve revision history; proposed changes cannot overwrite a frozen baseline |
| Changes / Planning | Proposed component/design changes, impact review and next revision | Linked change/deviation records and approvals |
| Hardware | Architecture, schematic, PCB layout/Gerber, reviews, bring-up/test evidence | EHW owns edits; actual approved versions distinguish from drafts |
| Firmware | Compatible release/version, approved interface notes/build references | Hardware sees explicitly shared references, not all firmware source/files |
| Mechanical | Enclosure image, mounting/connector drawings, approved reference STEP | Hardware sees relevant shared files only, not full MECH library |
| Tasks | Project requirements review, selection, schematic/BOM/layout checks, bring-up, fixes, handoffs | Assigned/department scope; three consistent views |
| Reference Files | Other permitted project references | Original IDs, provenance and revision links |

Tracker example is illustrative, not a claim that these files, successful tests, approvals or certifications already exist. The SSMone reference tab structure was inspected only for planning; its old department labels, claims and data are not imported.

## 8. Initial department mapping - proposed content, not new permissions

| Department | Own work and possible record types | Relevant cross-department references | Lead responsibility |
|---|---|---|---|
| SAL | Enquiry/customer intake, requirements handover, quotation, scope/commercial change | Released feasibility summaries, approved delivery commitments | Commercial/requirements handoff and designated approval |
| EHW | Architecture, specs, schematics, PCB/Gerber, BOM, bring-up, design change | Approved FW interfaces, mechanical fit/connector references, QA findings, supplier evidence | Design reviews and hardware handoffs/gates |
| FW | Interface specification, bootloader/RTOS/CAN, release/build/test notes | Approved pin map, board revision and HW test evidence | Firmware release/designated handoff |
| SW | API/cloud/app requirements, integration/release/test records | Approved device protocol/data format and integration requirements | Software release/designated handoff |
| MECH | CAD/drawings, enclosure/harness fit, tolerance, tooling, mechanical changes | Approved PCB outline, connectors and QA requirements | Mechanical review/tooling handoff |
| PUR | PR/RFQ/quotation comparison, PO, supplier/lead-time/receipt references | Released sourcing BOM, authorized specs and supplier QA disposition | Procurement commitments and formal supplier/department handoff |
| QA | Review/inspection/test criteria, DVP&R, NCR/CAPA, disposition evidence | Explicitly submitted design/production/supplier evidence | Independent designated quality decisions |
| EMF | Accepted PCBA receipt references, box-build/assembly, checks, packaging and travelers | Released BOM, work instructions, approved FW and QA criteria | Production readiness and designated releases; no assumed in-house SMT |
| MMF | Mechanical production/tooling/assembly and inspection records | Released drawings, tooling baseline and QA criteria | Mechanical production readiness/sign-off |
| FIN | Authorized billing/payment/budget/tax/commercial records | Approved PO/delivery/milestone evidence with appropriate field scope | Designated financial approvals; restricted details stay protected |
| SIT | IT/service assets, maintenance/support, infrastructure change records | Approved project deployment/service requirements | Service/infrastructure handoffs and permitted changes |
| HR/OPS | Staffing, onboarding, skills/training, safety/readiness evidence | Limited project competency/staffing needs | Staffing/readiness management; private personnel data remains restricted |

Department registry must remain backend-owned and extensible. This initial twelve-row map does not create a fixed product limit or grant capability by record name. Legacy ESW/TST labels must not create new active departments or silently rewrite historical IDs.

## 9. Official Decision & Deviation Log - final simplified model

| Element | Final decision |
|---|---|
| Purpose | One official combined register for significant exceptions/decisions outside normal workflow |
| Detailed source | Department retains technical change/deviation note or commercial record; central entry links to it |
| Normal stage approvals | Remain in their source workflow; no duplicate entry requirement |
| Creation | Three compact buttons: Common / Department, Internal Project, Client Project |
| Forms | Same modal design/common fields; selected button fixes scope so user need not select it again |
| Common | No project or stage required |
| Project scopes | Searchable matching project and relevant stage |
| Header controls | Main search, Project selector and Stage dropdown; All stages and Not applicable where relevant |
| Category | Separate category filter and mandatory category field NOT required; supersedes earlier four-category proposal |
| Author | Actual authenticated author, never a freely chosen impersonated lead |
| Employee | Can draft/submit and see own submissions/status; cannot see entire restricted log |
| Lead | Approves department employee submission; may record own authored decision without invented second approval |
| Escalation | Lead may refer to management; mandatory criticality thresholds require later explicit Admin-configured rules |
| Visibility | Own department by default; additional department access only per Admin-maintained mapping |
| Common fields | Decision summary, reason, scope/project/stage as applicable, department, source record/evidence, author, approval/status, conditions/validity where relevant |
| Search | Title, reference, reason and linked-record reference within permitted scope |

These three log-creation scopes supersede the earlier proposal to force the documentation four-folder taxonomy on this register. Existing documentation grouping is not silently changed. A central summary must not duplicate approvals or claim a fake hash/immutable ledger from browser-only state.

## 10. Full-page versus popup map

| Full page / workspace | Compact popup |
|---|---|
| Manage Projects and project detail | Contextual Add/Edit record |
| Project Analysis Dashboard | Create/Edit task |
| Documents & Vault library with project/search/column list | Upload / metadata edit |
| Department record register with clear actual record-type name | Add/reassign project team member |
| Project tabs and large evidence/register views | Decision/deviation entry |

The earlier suggestion to remove project Deliverables & Docs was superseded: keep the current project tab and sidebar Documents route. Both open original linked documents; remove only redundant dashboard/top-bar shortcuts or indistinguishable duplicate destinations.

## 11. Execution mapping and acceptance

| Order | Work package | Acceptance |
|---|---|---|
| A | Inventory existing components/contracts; reconcile final plan with actual folder | Actual files mapped to stable project/department/stage/type/revision IDs; no guessed approvals |
| B | Sidebar active-state identity, duplicate settings/theme shortcuts, compact search | One destination active; correct role visibility; responsive search popup |
| C | Common three-column checklist and collapsed Completed | Manual reschedule, normal completion versus required review, same records in all views |
| D | Contextual create/edit modals and live project/assignee search | Correct defaults, no extra type selection, no access expansion, validation and focus handling |
| E | Project list/detail/analysis and full-page Vault | All/project filters propagate; references share original record/file; confidential fields absent |
| F | Server task reassignment/team capability changes | Explicit updated contract; negative cross-department/employee/admin tests; audit and concurrency |
| G | Chronicles deadline/reminder configuration and notifications | Explicit versioning/calendar/baseline; no surprise rewrite; recipient/idempotency tests |
| H | Decision/deviation register and Admin visibility mapping | Actual auth attribution, employee submission/lead decision, no fake approval/hash |
| I | Web/Android handoff and final regression | Desktop/mobile visual review, actual multi-account round trips and denials, tests/build; normal Git history |

No UI hiding alone establishes security. Existing backend TEST restrictions currently block employee reassignment and permit some Admin mutations; the agreed new assignment policy therefore needs an explicit verified backend change. UI work must not claim that mismatch is already solved. Stage, stock, approval, release and private-file operations remain checked server operations. Shared record-state integration into the preserved legacy UI is required rather than pretending browser-local samples are cloud records.

## 12. Pending inputs / decisions

| Item | Needed before affected implementation |
|---|---|
| Actual folder | User will provide/show project folder; map inventory before moving/importing anything |
| Employee reassignment | Clarify whether employees may reassign only their own tasks or any task in their department; unrelated records must remain protected |
| Badge in department checklist | Confirm record/document-type badge versus department badge using live visual review |
| Critical escalation | Exact management thresholds and designated role; not inferred from category or urgency |
| Cross-department common overview | Explicit safe summary fields versus restricted commercial/HR/source files |
| Due-date configuration | Base event, working-day calendar, override rights and effect on existing deadlines |
| Live deployment | Review any new schema/authorization requirements separately; this plan is not execution evidence |

## 13. Folder mapping template

| Actual relative path | Project/scope | Owner department | Record/file type | Stage | Revision/baseline | Access grant / reference audience | Linked task/source | Current status / gaps |
|---|---|---|---|---|---|---|---|---|
| Awaiting user folder | | | | | | | | |

## 26 October authoritative addendum

Latest decisions and implementation evidence are consolidated in section 15 of [the single handoff](ANTIGRAVITY_READY_TO_USE_CONSOLIDATED_HANDOFF_2026-10-21.md). In particular use Today / Tomorrow-Planned with collapsed Completed, not the older three-column execution row. Inputs & Feasibility uses one canonical shared sheet, source-only imports, controlled departmental edits and scoped recoverable drafts. Earlier discussion alternatives do not override these later user decisions.

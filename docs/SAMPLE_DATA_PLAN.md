# SSM connected sample-data plan

Updated: 27 October 2026. Planning only unless a row explicitly records executed evidence. This is the sample-data subplan linked to the consolidated handoff §§14.13–14.14 and §16.7, not another implementation prompt.

## Purpose and preservation

Show realistic, clearly synthetic TEST values in the actual relevant project, input, record, task, document, delivery, approval and analysis screens. Separate scenario cards are optional reference material, not substitutes for connected entries. Reuse existing manifest UUIDs and seed-run IDs before adding anything; never duplicate, clear, rename or reclassify existing company/project records to make a sample fit. The authenticated shared backend is authoritative; Android consumes the same IDs. Browser-local DEMO remains separate.

Sample project/product names are labels, not different business rules. Do not depend on VTU/XLC or a name substring. All people, customers, prices, requirements, signatures and outcomes must be explicitly synthetic or reused only with user-approved provenance. No actual regulatory certificate or client acceptance is invented.

## Existing lifecycle cases to reconcile first

| Existing case | Required actual linked state | Key invariant / proof |
| --- | --- | --- |
| S01 Internal equipment | Internal project, approved internal requirements where present, assigned department work, jig/test evidence and applicable common references | No invented external client; internal project documents remain linked to the actual project UUID. |
| S02 Declined feasibility | Enquiry/opportunity source, complete applicable feasibility remarks, reasoned terminal decline | No project exists; no downstream project, production or delivery is fabricated. |
| S03 Client PoC | Intake and requirement source → project → prototype tasks/BOM/design references → 10-unit delivery → pending client feedback | PoC completion does not authorize production release. |
| S04 System integration → customer pilot | Actual requirements, departmental inputs, dependencies, integration evidence, pilot deployment and ongoing field observation | Show provider/owner/waiting department/next action; pilot observation is not silently marked passed. |
| S05 Pilot needing refinement | Earlier completed phases plus open change/refinement tasks, revised firmware/design evidence where applicable, regression work | Preserve earlier approvals and revisions; project remains open despite completed earlier work. |
| S06 Bulk production | Released applicable engineering outputs, verified masters, procurement, incoming disposition, production lot, QC and deliveries | 150 accepted + 5 held + 45 pending = 200 in Lot 1; 300 of the 500 planned remain. Held/pending are not released as accepted. |

These cases have prior implementation reports and some persisted fixture evidence. Audit actual manifests and source records; do not claim all are fully accepted from this plan.

## Track coverage: six user-confirmed lifecycle types

| Track | Minimum distinctive sample evidence |
| --- | --- |
| Software only | Software requirements, API/data dependencies, implementation/test/deployment tasks and software release evidence; no mandatory PCB/BOM/fabrication work. |
| Firmware only | Existing board/platform reference, firmware interfaces, implementation/flashing/regression tasks; hardware consulted only for real dependency. No new PCB development by default. |
| Hardware only | Electrical parameters, schematic/layout/BOM/native fabrication references, prototype and test tasks; no firmware/software development tasks by default. |
| Hardware + Firmware | Linked board and firmware versions, bring-up dependencies, joint verification and applicable pilot/release. |
| Hardware + Firmware + Software | End-to-end hardware/firmware/software parameter inputs and integration dependencies. No Hardware + Software development combination that silently omits required Firmware under the user's scope rule. |
| Ready-made deployment | Existing product/model and original technical references; applicable configuration, integration, verification, fulfilment and support work. Do not generate custom hardware/firmware development merely because the product contains them. |

Map existing S01–S06 to tracks only from actual source evidence. If coverage is missing, add clearly labelled supplementary TEST cases under a new idempotent manifest version; do not overwrite a case's existing scope or assume the six outcome scenarios automatically cover the six tracks. Internal/client origin and PoC/pilot/production purpose are independent dimensions.

## Connected record and value manifest

Every sample entity needs: fixture key, canonical saved UUID, organization, owning department, project/source UUID if applicable, entity type, origin/track/template version, actual values, owner/assignee, state, revision, remark, upstream/downstream IDs, seed-run provenance and expected viewer/editor. Missing authoritative fields stay missing with a reason; samples must not introduce fake company rules.

| Actual portal location | Sample content / connection | Acceptance |
| --- | --- | --- |
| Project list / workspace | Actual project title/code, internal/client context, track, phases/stages, accountable team and linked intake | One canonical entry; selection updates the relevant workspace/analysis/document context. |
| Inputs & Feasibility / Analysis | Track-applicable power, voltage/range/protection, connectivity/network/region/SIM/GNSS/CAN, storage, I/O, mechanical/IP/thermal and compliance questions; each with value, unit, source, owner, feasibility remark, status and queries | Explicitly synthetic values, not defaults for real projects. Missing-input count updates after actual shared save/reload. Leads edit only owned inputs; others query/comment within permission. |
| Stages and tasks | Realistic completed, active, blocked, overdue and planned tasks; dependency, assignee, due date, priority, remark and evidence | Pinned lifecycle template; no duplicate auto-generation; added stages/tasks do not erase history or auto-approve gates. |
| Department record creation | Appropriate actual catalogue types in each applicable department, canonical supplier/part/customer selections, source/order/BOM/revision links | Automatic numbering preserved; no repeated prototype/mass-production choice; permitted inline creation returns selected canonical master and preserves parent draft. |
| Deliveries / PoC units | Actual synthetic lot/dispatch/serial evidence where supported, receiver and delivery status | Physical delivery records are distinct from document deliverables; reconcile quantities and link original evidence. |
| Approval / Decision & Deviation | Separate author/reviewer where required; pending, recorded, rejected or approved examples with meaningful synthetic reasons | Do not forge signatures or bypass required approval to seed final states. Use authorized existing workflow or clearly provenance-labelled fixture contract. |
| Team Chat | A permitted channel with realistic synthetic discussion, reply, open/closed poll and searchable tags related to a sample project | Use actual members only with permission; never auto-add every employee. Poll agreement does not approve a gate. No broadcast/import is authorized by this planning row. |
| Profiles / budgets / assets | Only safe synthetic account-owned data supported by actual canonical source | No fabricated private letters/assets or stock. Inventory source is still a separate unresolved decision. |

## Documents & Vault: samples in the original library

Keep the original full-page document library. Sidebar navigation must not expose a raw database utility. Avoid duplicated document menus, stacked dialogs and separate copies of the same file.

| Library grouping | Examples to plan | Link / permission rule |
| --- | --- | --- |
| Department / Common | Internal requirement checklist, approved template, reference guideline, test procedure | Owning department and explicit common scope; no forced dummy project. Cross-department sharing is explicit, not implied by the folder name. |
| Internal Project | Internal jig requirements, design/BOM, test evidence, internal delivery or commissioning report | Actual internal project UUID and applicable stage/task/source links. |
| Client Project | Requirement/PRS, feasibility review, linked BOM/design references, integration/pilot evidence, delivery and permitted client outputs | Actual client project UUID; client access requires explicit release/share, never a title, category or file extension. |

| Document source type | Sample handling |
| --- | --- |
| Auto-draftable DOCX / XLSX | Editable draft from provided/approved template and verified linked values; retain editable revision. After the configured Admin final approval, create the controlled non-editable client rendition (normally PDF) without destroying editable source/history. Mark draft and final states accurately; do not imply this pipeline is already implemented. |
| Native external engineering files | Schematic/layout, mechanical drawing/STEP, STL/DXF prototype files come from engineering software or suppliers. Link/upload original files; do not pretend the portal generates them. Keep project/revision/software provenance. |
| PCB fabrication packages | Gerber ZIP, panel ZIP and stencil/PCB fab outputs remain original generated packages; panel/stencil evidence links the actual source Gerber revision/hash. No automatic panel generation commitment. |
| Outsourced certificates / reports | Original uploaded synthetic clearly labelled specimen or user-supplied authorized sample. Never fabricate an issued certificate, test result, accreditation or approval. |
| Viewer references | Reuse authorized Altium viewer/design links when provided; KiKit/PCB viewer integration is not implied by this sample plan. |

## Sample delivery patches and evidence

1. Read current manifests/source and report coverage gaps without changing data.
2. Reconcile track → phase → stage → task mappings and permissions; preserve existing IDs/history.
3. Prepare idempotent supplementary TEST seed payloads and original-file manifest; validate locally first. No new users or permissions are implied.
4. Apply only authorized TEST fixtures through existing contracts, then verify actual registers, project inputs, documents and shared reload. Keep a fixture-only recovery/removal plan; no company-wide database clear.
5. Verify lead/employee/admin/client boundaries, exact quantity/revision links, cross-platform IDs and original layouts. Record source revision, run ID, actual counts and remaining failures. A screenshot or scenario card alone is not acceptance.

Current status: this update adds the requested sample coverage and placement plan only; it does not import lifecycle or document fixtures. A separate self-only Chat verification channel/message/reply/poll is recorded in consolidated handoff §16.9; it is not a scenario-pack import.

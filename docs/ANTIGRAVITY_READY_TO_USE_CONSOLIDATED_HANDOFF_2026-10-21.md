# SSM — consolidated implementation and correction handoff

Date: 21 October 2026; record-flow verification expansion: 25 October 2026. Owner: user-approved requirements from the current discussion.

## Start here: one prompt, one scope

Implement this handoff in the existing SSM web portal and Android companion. This is the single consolidated prompt for the current correction/refinement batch. It replaces earlier chat prompts and correction checklists for this batch, including the earlier three-column task arrangement. Do not run them as separate requests or duplicate their work.

This is an addendum to the existing master plan, not a replacement for unrelated established functionality. Where an earlier plan conflicts with a specific latest requirement here, use this handoff. Retain compatible requirements. Inspect the latest source and migrations first: earlier review findings describe specific checkpoints, and some may already be repaired. Do not reimplement a fix that is already correct.

Repositories last confirmed by the user:
- Web: `C:\Users\Test\Documents\GitHub\SSM-new-web`.
- Android: `C:\Users\Test\Documents\GitHub\SSM-new-app`.
- Lovable project: `https://lovable.dev/projects/a3399684-daab-4b38-8666-187b96b451af`.

Verify these locations and applicable repository instructions before editing. Work incrementally; preserve existing colored layouts, login, canonical department aliases, inventory, assets, purchasing, document revisions, client access rules and activity history. Do not force-push or rewrite published history. Do not seed operational data or broadcast production messages for testing.

## 1. Evidence and completion boundary

Previous source checkpoints: web `ba8c96a`; Android `8a8f469`. At the previous recheck, web had 117 passing helper/baseline tests and zero TypeScript diagnostics. These are historical results, not proof that the latest revision is tested or the backend is deployed.

Manual Lovable-preview observations at that checkpoint:
- New Budgets, My Profile and Team Chat navigation opened successfully.
- Sandbox expense `EXP-OPS-2026-481`, INR 123, showed submitted and increased request count from four to five; opening My Profile and returning reset it to four and removed that expense.
- Provisioned EHW TEST Employee login succeeded. Budget page identified the TEST employee, but My Profile displayed Avery Vale, lead employee ID `HLPL-EMP-103`, and Avery's example letters.
- Authenticated TEST budgets still loaded DEMO/sandbox data.
- EHW table displayed one scoped claim but global counts of four claims/seven allocations and an inconsistent project total.
- EHW visible chat channels were General and Engineering-HW. Admin self-approval UI restriction worked for the sandbox probe. These limited passes are not server authorization evidence.

These were synthetic examples, not evidence that real personnel information was disclosed. Reproduce only where still applicable. Prior reports/screenshots are supplementary evidence; this file contains the actual execution requirements.

## 2. Foundation fixes — must pass before calling the modules operational

| Area | Required behaviour |
|---|---|
| Identity | Bind private records to exact authenticated organization/member/user IDs. Never map an employee to a lead by shared department, role string, name substring or fallback Admin profile. No mapping means an empty/unlinked state, not another person's data. |
| DEMO | Keep clearly labelled replaceable examples in the existing canonical versioned local store, surviving ordinary navigation/reload. |
| TEST/shared | Use authenticated shared reads/writes, with complete server authorization. Do not mix independent local mutations with partial shared saving. Until a module is connected, disable its mutations with a concise explanation; do not claim it is complete. |
| Save feedback | Success only after durable save; failure preserves user input and offers retry. Stable IDs and idempotency prevent duplicate submissions. |
| Permissions | Enforce scopes server-side before rows, totals, counts, snippets, realtime events, attachments and exports. UI filters are presentation, not authorization. |
| Finance | Multi-department access requires explicit Finance review capability, not simply membership of the Finance department. Ordinary Finance employees retain their own employee scope. |
| Platform parity | Web and Android use the same canonical IDs, workflow states, document revisions and permission rules. Role URLs and local switchers never authorize shared operations. |

Revoke sensitive access/caches on account, membership or department change. Preserve the distinction between DEMO role switching and real authenticated account switching.

## 3. Budgets, expense/travel and asset requests

- Keep department-owned budget periods, categories, approved allocations, revisions/transfers and optional project/cost-centre links. Common department spending must not require an invented project.
- Employee/lead/Admin can request expenses, travel or assets, within their authority. Each keeps their own request/profile access; a management role does not eliminate personal employee functions.
- Normal flow: employee submission → department business review → Finance validation → designated Admin/alternate where configured → final approval. Lead/Admin/Finance personal claims use an authorized alternate. A self-approval denial is not proof that alternate routing happened: actually create the right review task/notification.
- Derive actors from authenticated membership. Do not authorize Android actions using an arbitrary `approverRole` argument or name matching.
- Configure thresholds, exception routes, allowances and categories; remove invented INR 100,000 rules and fabricated 60/30/10 travel cost splits. Collect actual estimates/evidence.
- Use an exact allocation ID with authorized department, category, active period, currency and applicable project checks. Do not choose the first vaguely matching allocation or approve with no allocation.
- Available balance = approved allocation − posted actual expenditure − outstanding unposted commitments.
- Final approval reserves committed funds. It does not post actual spending or establish payment. Web and Android must agree.
- Invoice/verified claim posting clears the associated reservation and records actuals atomically; payment must not subtract the same expense again. Track advances, settlement, excess/return and cancellation separately.
- Recheck balance and request version in the same server transaction. Prevent concurrent overspending, repeated commitments, terminal-state mutation and double posting. Record immutable actor/time/reason history.
- Assets continue through existing purchasing/PO/receiving/assignment; request approval alone does not create a received asset.
- Apply the same project/department scope to the register, counts and totals. Explicitly distinguish department-operational spend from project-linked spend.

## 4. Compact visual refinements

Keep the existing visual style; avoid a redesign. Most current UI is acceptable.

| Current problem | New visible presentation |
|---|---|
| Long header such as DEMO – Purchasing & SCM – PUR Lead – Authorized Department Scope (...) | `Purchasing`; role/person in account menu or compact secondary label only where useful |
| Large repeated sandbox/developer banners | Small DEMO/TEST badge; explanation in tooltip/info popup |
| Help & Training: AI4T Lifecycle Walkthrough | `Knowledge Base`; tooltip/description can mention help, training and project lifecycle |
| Department Budgets & Expense Requests | `Budgets & Expenses` |
| Employee Self-Service (My Profile) | `My Profile` |
| Team Channels, Discussions & Technical Polls | `Team Chat` |

Do not put the word `IATF` in ordinary interface headings, status badges, authorization labels, success messages or routine helper text. Keep necessary explanations in Knowledge Base/help. Do not erase genuine compliance references from original controlled documents or audit metadata; removing UI decoration is not changing documentary evidence or certification status. Do not replace one unsupported compliance claim with another.

Responsive text: full text when space permits, short labels as space shrinks, icon with accessible name/tooltip where necessary. Avoid redundant authority descriptions and oversized headings. Keep filters on one compact adjustable row; less relevant filters move to More. Preserve active filter indication and keyboard/touch usability. Tooltips must not be the only way to access essential actions on mobile.

An unavailable shared save must still be honestly indicated near the action. Moving an environment warning to a badge must not conceal loss of persistence.

## 5. Tasks: latest decision supersedes the earlier three-column plan

Use two columns: **Today** and **Tomorrow / Planned**. Keep a compact collapsed **Completed** section below. Checklist, Kanban and Table must reference the same tasks.

- Sort Critical → High → Normal → Low. Within equal priority, overdue first, then earliest applicable due date; use a stable final tie-breaker.
- Unfinished previous-day tasks remain in the new day's Today list, retaining priority and original deadlines. Show Overdue if applicable.
- Tomorrow's scheduled work becomes Today on that date. Later work remains Planned with its true date. Distinguish scheduled date from deadline.
- Do not automatically extend deadlines, mark work complete or rewrite history. Compute rollover in configured business timezone, including a page left open across midnight.
- Keep formal review actions in the separate **Approvals** section. Awaiting-approval tasks show status and a link to their original approval. No duplicate approval copy or third task column.
- Checking ordinary completed work moves it to Completed. Work requiring approval stays awaiting review until the designated authorized outcome is recorded. Task completion never bypasses a stage/document/financial approval.
- Keep contextual Add buttons and compact popup forms, with current project/department/type prefilled, searchable project/assignee fields and actual saved/error feedback.

## 6. Service tickets — primary Service/IT responsibility

Add a clear **Tickets** register using existing records/storage where possible.

| Source | Default access |
|---|---|
| Internal ticket | Requester can view their own; authorized Service team manages. Do not show these to Sales by default. |
| Client ticket | Requesting client sees its permitted ticket; authorized Service and Sales teams collaborate within relevant client/project scope. |
| Other staff | Explicit assignment/permission only; tags/mentions do not grant access. |

Minimum fields: stable ticket reference, source/requester/client organization, subject/description, category, priority, optional project/asset, Service owner, status, configured due/SLA information, attachments, replies and audit history.

Support Open → Assigned/In Progress → Waiting → Resolved → Closed, with controlled reopening and reason history. Keep internal notes separate from client-visible replies and attachments. Service owns triage/technical resolution; Sales can coordinate permitted client communication without universal Service administration. SLA values, automatic closure and escalation policies are configurable, not invented obligations.

Integrate authorized search, notifications and existing file access. Client IDs must never permit another client's tickets or internal notes through direct URLs/API/search.

## 7. Assets: reuse the existing register

| Team | Asset navigation/scope |
|---|---|
| Service/IT | IT Assets: authorized computers, networking and other IT equipment |
| Operations | Office Assets: authorized office/facility assets |
| Employees | Own assigned assets and explicitly shared permitted equipment |
| Admin/designated controller | Explicitly authorized broader management |

Use stable asset IDs, existing inventory-style register presentation and assignment/return/maintenance history. Connect tickets to assets. Confirm the current HR/OPS versus Operations role mapping and use scoped capabilities rather than creating a duplicate department or giving all HR users universal asset access.

Do not add InvenTree, Snipe-IT, another asset database or duplicate per-department copies.

## 8. HR administration and My Profile

**My Profile is for every employee, lead and Admin.** It includes own permitted details, letters, policies, training, forms/surveys, requests, assets and notifications. Private HR records are not general directory content. Leads see authorized operational team status, not unrestricted personnel files.

HR needs a separate authorized administration view:
- Employee/team directory and employment status/organizational assignments.
- HR letter templates/drafts/review/issue status.
- Policy creation, versioning, audience and acknowledgment tracking.
- Training/session/material/quiz creation, assignments, actual completion and refreshers.
- Survey and feedback form creation/editing, audience, schedules, reminders and permitted reports.

Web supplies advanced authoring/configuration; both web/app support reading, responding, acknowledgment, progress and authorized approvals. Use the same schema on both rather than separately coded questionnaires.

Builder: text, number, date, choices, rating, attachments and permitted record references; required fields, validation, sections and conditional questions. Published versions are immutable for historical submissions. Record real answers and evidence before Submitted/Completed; do not generate responses or attendance.

Recurring campaigns: configured monthly/quarterly/annual/custom/event cadence, business timezone, due/reminder offsets and authorized audience. One assignment per person/version/cycle, idempotent scheduling, preserved manual overrides, no repeated reminders after completion. Employee transfers/inactivity preserve past evidence while updating future audience/access correctly.

Declare survey response privacy before publication. Anonymous results must not expose identity via joins, search, exports, completion tracking or small-group reporting. Otherwise label the survey identified/confidential. Do not promise anonymity by a boolean alone.

Letters: verified employee data + approved DOCX/XLSX template → editable draft → HR review → designated Admin final issue/sign-off → controlled employee PDF. Missing templates/verified fields/signer rules remain explicit pending inputs. No fake signatures, attendance, approved compensation or certificates. Existing PDF output remains usable; the new private PDF/OCR service integration is deferred to a separate phase.

HR organizational editing does not silently elevate technical/security permissions. Admin-controlled access mapping remains separate.

## 9. Team chat, polls, tags and search

- Preserve basic app usage and advanced web audience/channel administration.
- Support selected people, teams, departments, authorized roles or project groups, with clearly defined server-validated membership and revocation.
- Keep message/thread IDs, actual sender, permitted attachments, unread/mention notifications, and conversation type (question/update/issue/project/expense/training/survey/proposed decision).
- Reusable tags and exact source links connect work without copying it. Mentions notify existing authorized participants; neither mentions nor tags/linking grant private-record access.
- Enforce poll membership, valid options, single/multiple-vote rules, close time, vote switching/deduplication and declared results/privacy. Closed polls cannot be voted through API or UI.
- Reactions, chat agreement and poll outcomes never become formal approvals automatically. Explicit conversion can draft a task/request/decision using its normal workflow.
- Do not give Admin silent blanket access to every private conversation. Follow explicit channel/administration policy.
- Shared search includes authorized records, metadata, tags and conversations. Exclude private personnel cases/raw survey responses from ordinary search. Apply permission checks before counts, suggestions and snippets, and again on open/download.
- Keep compact header search popup on web and mobile-friendly app results. Do not reintroduce a full-page unified-search destination.

## 10. Project Analysis — distinct from Project Workspace

| Destination | Purpose |
|---|---|
| Manage Projects / Project Workspace | Standard full project information, intake/insights, team, lifecycle, tasks, deliverables, files and authorized detailed management |
| Project Analysis | Consolidated common coordination view of real inputs, dependencies, readiness, blockers and progress |

Keep both destinations. Do not implement Project Analysis as a redirect to workspace.

**All Projects:** authorized portfolio overview with current stage, department readiness, pending inputs/reviews, blockers, overdue work, next actions and relevant milestones. Do not add unnecessary internal/client filters initially; a searchable project selector is enough. All means all authorized projects, not all company-private data.

**Selected project:** show real client/Sales intake and source enquiry/opportunity references; technical-team feasibility/requirements; relevant department inputs/deliverables; lifecycle review readiness; interdepartmental dependencies; responsible owners; related task/document/BOM revisions and physical delivery evidence where relevant.

Each dependency should communicate: **what is needed → provider/owner → who is waiting → current state → affected milestone/next action**. Use explicit Missing, Submitted, Under Review, Approved/Frozen, Returned/Rework and justified Not Applicable states. Do not infer approval from a file upload or progress solely from task counts. Missing mappings show Unknown/Missing, not fabricated readiness.

Enquiry may precede project creation. Keep client inputs and departmental feasibility attached to the enquiry. Explicit later association preserves original IDs, references, review outcomes and evidence; never invent a project or fall back to AI4T/sample project.

Default analysis is read-only common coordination information that the person is authorized to see. Share relevant cross-team references/summaries, not all departmental private files. Hardware may see an authorized mechanical reference image/file without browsing the full mechanical library.

An **Edit** mode exposes only authorized fields/actions, updating original records with their ordinary validation and audit. Employees can update permitted working records; leads retain formal review/release/handoff. Approved/frozen revisions require the existing revision/change procedure, not a silent overwrite. No separate analysis database or second approval path.

Preserve document library as full page; use compact standard popups for individual record/task edits. Files from workspace, Vault and analysis point to the same original document/revision. Separate physical deliveries from document deliverable status.

## 10A. Earlier accepted requirements — retain and reconcile explicitly

The following details must not be lost through the broad instruction to preserve existing features. Inspect each against the current code; retain working implementations and finish only demonstrated gaps. This is not permission to rebuild unrelated modules.

| ID | Requirement to retain / complete where missing |
|---|---|
| R01 | Department record types appear under clear sidebar groups and open proper full-page registers/tables with project filtering. Dashboard shortcuts may remain compact; do not repeat the same six-module navigation across every record page. Quotation shows quotations, PO shows orders, and receiving/GRN/BOM functions use their appropriate destinations rather than unrelated sections on the quotation page. |
| R02 | Only the actual destination is active in navigation. Parent groups may expand; Favorites must not make five unrelated record types appear selected. Preserve predictable back/return navigation and project context. |
| R03 | Documents & Vault is a full-page library. Project/workspace/deliverable links open the same original file/revision, not copies. Avoid a second dashboard document library or duplicate Deliverables menu; stage/project checklists show required submission and approval status. |
| R04 | Full-page Manage Projects lists authorized projects. Opening one shows its basic information/client intake, lifecycle, team, tasks, deliverables/documents and physical deliveries in a coherent detail view. Individual create/edit operations remain compact popups. Keep this standard management experience distinct from Project Analysis. |
| R05 | Hardware project information includes tentative/review BOM and approved/frozen BOM as distinct revisions, relevant reference files and authorized cross-team references, review/planned changes and prototype/device delivery records. Do not manufacture empty records to make a tab appear complete. |
| R06 | Contextual Add in Tasks, Deliverables/Docs and Team prefills the current project/department/type. Formal approvals originate from real submissions, not a generic Add Approval action. Leads can manage their department's project team and reassignment within scope. Surface pending work before removing its owner. |
| R07 | Routine task updates and permitted same-department reassignment are audited without introducing the previously discarded extra reassignment-approval workflow. Department leads manage their team's assignments; Admin's oversight view must not silently acquire ordinary department reassignment powers. Formal final approvals, releases and cross-department handoffs remain with designated leads/approvers. Broader exceptional administration is separately authorized and audited. |
| R08 | Record forms use searchable project and assignee selectors. Workflow/stage settings supply configured duration/deadline/reminder defaults by applicable record type; never overwrite a manually chosen date silently. Notify the actual assignee on successful assignment. Preserve the distinction between project Code and Title, unique references and optional pre-project enquiry context. |
| R09 | One combined Decision & Deviation Log records critical exceptions/important departures from normal workflow. Preserve detailed department technical change/deviation records and link their originals; do not duplicate routine stage approvals or require users to enter the same event twice. |
| R10 | Decision creation has three compact scope actions: Common / Department, Internal Project, Client Project. Each opens a consistent popup with scope preselected. Common needs no project/stage; project scopes use permitted searchable project and relevant stage. Do not restore the superseded mandatory four-scope/category UI. |
| R11 | Decision Log toolbar: compact search, project/context selector and stage dropdown with All Stages; no separate category filter initially. Include Common/Department context without forcing a fake project. Lead defaults to own department; other logs only if allowed. Only Admin changes interdepartmental visibility mapping. Employee can draft/submit and see own submission/status, without broad restricted-log access; actual author identity is recorded and designated lead approves. Do not add complex mandatory criticality escalation in this batch. |
| R12 | Consolidate settings under the existing top Settings entry and scoped sidebar Settings group; Admin sees authorized settings, departments their permitted ones. One theme toggle, no duplicate Cloud/Asset top shortcuts. Department asset navigation stays in sidebar. Move lifecycle autoplay/demo walkthrough content into Knowledge Base rather than normal operational pages. |
| R13 | Preserve subtle card borders, compact row/checklist presentation, assignee/project/next-action details and responsive filters without forcing a different design. Web-specific layout requirements are not an instruction to replace Android's established layout; share data/permissions while using appropriate mobile presentation. |
| R14 | Document catalogue distinguishes template-generated editable drafts from externally produced native files/certificates. Generate only from provided approved templates and verified inputs; unsupported items remain manual upload. After designated final approval, expose a controlled PDF to the authorized audience; retain editable source and revision history. HR letters are for their employee, not the client. PDF alone is not immutability or access control. |
| R15 | VTU/XLC were product/project examples, not extra mandatory record categories. Schematic/layout, certification, mechanical drawing/STEP and prototype STL/DXF remain external engineering/outsourced outputs unless a separately approved integration supports the real source format. Keep original Gerber ZIP, panel ZIP and stencil PCB-fabrication packages as distinct controlled types, with exact source Gerber/project/revision provenance where applicable. No automatic regeneration, certification or approval is inferred from an upload. |

For reference, project/department summaries and relevant shared files may be common coordination information; private technical source folders, HR records and finance details still require their own permissions. Do not solve common analysis visibility by opening every department's underlying files.

## 11. Delivery sequence and checkpoints

| Batch | Work | Exit gate |
|---|---|---|
| A | Identity, environment isolation, durable authorized operations and financial parity | Same-person/cross-account persistence and permission tests; no fake shared success |
| B | Compact labels/badges, Knowledge Base naming, task rollover and separate approvals | Two-column screenshots, date-boundary tests, no approval bypass |
| C | Service tickets and scoped existing assets | Requester/Service/Sales/client isolation, internal-note and asset access tests |
| D | HR administration/builders, assignments and recurring campaigns | Versioned real submissions, private recipients, scheduling/idempotency tests |
| E | Shared chat/polls/tags/search and project analysis | Membership/revocation and project dependency/source-identity tests |

Prepare schema changes, reversible migration steps and feature flags as required. Reconcile with live schema before deployment. Follow actual environment permissions; this handoff does not authorize credential changes, access expansion, production seeding or bypassing deployment safeguards. Server credentials stay server-only and untracked.

After each coherent batch: run relevant tests/typecheck/build and one focused browser/device scenario. Avoid repeatedly rerunning the entire suite without changes. Preserve existing localhost tabs and do not restart/replace services unnecessarily.

Before edits, record the exact baseline commits and existing working smoke flows. Preserve unrelated local changes. For data changes, prepare backup/restore or a verified reversible migration path; never discard old browser-local operational data or silently migrate examples into shared operations. Use feature flags per module so incomplete work can stay disabled without removing working functionality. If an existing feature regresses, repair or revert the isolated new batch before proceeding; do not reset the whole application or conceal the regression behind a replacement screen.

Maintain a small requirement ledger for sections 2–10 and R01–R15: **already working / needs change / deferred external dependency / verified**, linked to existing component/API, resulting commit and acceptance evidence. Before adding a table, route, approval or document type, check the existing equivalent and reuse its ID/contract. Record an actual conflict and resolution; do not silently drop a requirement or broadly refactor unrelated working features.

## 12. Required acceptance evidence

1. Two same-department employees and their lead retain distinct profiles/letters/assets. Unknown identity fails closed.
2. Create one synthetic TEST claim; same record ID persists after navigation/reload and appears to the correct second account and Android. Failure preserves input; retry does not duplicate.
3. Employee → lead → Finance transition follows configured routing; no self-approval. Approval changes committed, not spent. Actual posting releases reservation and records actuals once.
4. No/mismatched/insufficient allocation fails without balance mutation. Two concurrent approvals cannot reserve the same balance. Final approval retry is idempotent.
5. Unauthorized member/client cannot read/write through direct IDs, APIs, search, totals, realtime or attachment URLs.
6. Internal tickets remain requester/Service scoped; permitted client tickets are visible to Service/Sales/client with internal notes protected.
7. Service sees authorized IT assets, Operations office assets, employee own assignments; original asset IDs/history remain intact.
8. HR publishes versioned form/policy/training; actual employee response/acknowledgment persists. Edits preserve prior version evidence; recurring rerun creates no duplicate assignment/reminder.
9. Tasks roll across midnight correctly in business timezone, preserving due dates/overdue status and priority. Review-required task cannot complete without review.
10. Membership revocation removes chat/file access; closed/invalid/duplicate votes behave correctly. Private data cannot leak through tags/snippets.
11. Project Analysis shows real distinct Sales/client and departmental inputs/dependencies for two different projects plus a sparse project. No sample fallback; no unauthorized file disclosure; edits affect original permitted records.
12. Existing login, canonical departments, inventory, purchasing, controlled documents and approvals regressions pass; colored layout stays recognizable.
13. R01–R15 are each reconciled against current code, with retained or tested outcomes: record navigation, original document identity, contextual forms, configured dates, Decision Log scopes/access and external-file provenance do not regress.

Web: run TypeScript, production build and relevant automated tests. Android source changes: run `testDebugUnitTest assembleDebug` using configured JDK/SDK; record device/browser checks separately. Helper tests, compilation, screenshots and authenticated shared integration are different evidence: do not conflate them.

## 13. Final handoff and exclusions

Give one concise status table: requirement → implemented commit → tested evidence → deployed environment → remaining gap. State exact Git commits and actual Lovable import status. Do not claim publication or migration deployment from local files alone. Sync only coherent tested changes through normal Git history. Never publish a broken checkpoint just to report sync.

List any required verified templates, organization rules or external credentials without inventing defaults or exposing secrets. Disable incomplete shared actions rather than silently substituting local examples.

**Not in this batch:** private Gotenberg/OCRmyPDF integration, KiKit/panel generation, new PCB viewer, replacement inventory/asset system, graphic editor or social posting integrations. Keep existing Altium links attached to exact project/PCB revisions and existing linked PCB test reports. PDF/OCR has its own later plan after current acceptance gates pass.

## 14. Complete record-flow specification and regression verification programme — 25 October 2026

### 14.1 Authority, interpretation and honest completion

This section expands this same handoff; it is not another parallel prompt. Retain sections 1–13 and R01–R15. Latest explicit user decisions take precedence over older alternatives. This is a planning update, not a claim that any listed flow has been implemented, certified or verified. “Guaranteed” means enforced acceptance gates and traceable evidence, not a promise that a written plan eliminates all defects.

Use four requirement classes on every flow card: **U** = explicit user requirement/discussion; **E** = expert input actually provided in source material; **S** = sourced standards guidance; **P** = proposed engineering detail. No independently authenticated expert transcript, signature or clause-by-clause compliance assessment has been supplied here. Do not relabel assistant recommendations as expert approval. The supplied audit checklist is an input inventory, not proof of certification or universal requiredness. Unresolved company policies/templates remain **Blocked—clarification**, rather than guessed implementations.

Source precedence: current human decisions → this latest scoped consolidation → compatible master/specification/catalogue requirements → earlier source/history. Record conflicts explicitly. Existing master-plan pages remain reference context; add a pointer to this section rather than fork or duplicate authoritative instructions. The date in this file's name is retained for link stability; section 14 is updated on 25 October.

### 14.2 Confirmed discussion decisions (U)

| ID | Required outcome / superseded alternatives |
|---|---|
| U01 | Preserve original colored web UI, Android layout, working authentication, inventory, asset IDs, history, approved records and integrations. Shared backend adaptation must preserve existing functionality; a generic replacement screen is insufficient. |
| U02 | My Tasks has Today and Tomorrow/Planned only, priority first, collapsed Completed below. Separate Approvals remains. Incomplete work appears on the new day's Today with overdue indication and original due date; future rescheduling is explicit. Formal review-required work completes only after authorized review. |
| U03 | Daily task updates/permitted intra-department reassignment are audited without adding a new reassignment approval loop. Lead manages own team; Admin oversight does not automatically mean routine reassignment powers. Formal final approvals/releases/handoffs remain designated-authority actions. |
| U04 | Common project analysis is distinct from normal project management. All-permitted overview and selected-project dependencies show original Sales/client and department inputs. Edit mode exposes only authorized own-field controls. Common summaries do not expose all source files. |
| U05 | Full-page Manage Projects and Documents/Vault; compact modern popups for individual create/edit. Each tab has contextual Add with project/type prefilled. Approvals arise from submissions. Direct document links open the original item, not a duplicate register or copy. |
| U06 | Searchable authorized project/assignee/master selectors, clear empty/unconfigured states, configured due-date/reminder suggestions without overwriting manual dates; actual assignment notifications. Defaults are not fabricated company rules. |
| U07 | Compact responsive single-row toolbar: full labels when space allows, shorter/icon controls as space shrinks, lower role-priority actions in More. Top popup search, not a separate search page. Subtle borders, existing theme. Short role headings; Knowledge Base label; no ordinary IATF chrome. |
| U08 | One Settings entry/group with scoped suboptions, one theme toggle; department asset navigation stays in sidebar. Training/demo autoplay belongs in Knowledge Base. |
| U09 | One central Decision & Deviation Log for critical exceptions, linked to original department records. Three creation scopes: Common/Department, Internal Project, Client Project. Search/project/stage dropdown filters, no separate initial category filter. Only Admin changes cross-department log visibility. Employee submits own draft; lead approves; no invented mandatory escalation thresholds. |
| U10 | Template-generated editable DOCX/XLSX/software drafts use verified inputs and supplied templates. Unsupported formats upload manually. Designated final technical review remains; Admin final issue approval is required for the user-requested client-facing generated document publication, without replacing internal departmental authority. Employee letters are private to the employee/audience, not client documents. |
| U11 | External/native: schematic/layout, outsourced certificates, drawing/STEP, prototype STL/DXF. Original Gerber ZIP, panel ZIP and stencil PCB-fab package remain distinct, provenance-linked. Altium links reused. VTU/XLC are examples, not extra record categories. |
| U12 | Purchasing Prototype/Mass Production is chosen once, through record type; no separate Procurement Track selector for any Purchasing type. Request-type track metadata derives automatically. Supplier is searchable canonical master, not unverified free text/DEMO data. Automatic reference is separate from title; current/next revision controls preserve history. |
| U13 | Service: internal tickets requester/Service/Admin per contract; client tickets Service/Sales/authorized client; private diagnostic notes protected. Service sees IT assets; Operations office assets; canonical register retained. |
| U14 | HR controls directory/team, policies, recurring training, surveys/feedback forms on web. Every employee including leads/Admin has own profile/assigned items on both platforms. Team chat/polls/tags/search retain scoped membership and private data protections. |
| U15 | Budgets/claims: department, category, period, currency and project matching; employee → designated lead → Finance routing; no self-approval. Approval reserves commitment; verified posting transfers commitment to spent once. Company limits/policies are configured, not guessed. |

### 14.3 Standards and external-expert boundary (S/E)

Use the organization's accepted standards edition, customer-specific requirements, approved templates and applicability matrix. Do not silently migrate standards editions or claim legal/certification compliance from a code test. Public guidance is not a substitute for the licensed normative text or an authorized quality reviewer.

- [ISO documented-information guidance, explicitly for ISO 9001:2015](https://www.iso.org/files/live/sites/isoorg/files/standards/docs/en/iso_9001_2015_guidance_documented_information.pdf): documentation should support actual processes, with controlled information and retained evidence. This supports traceability and review evidence; it does not prescribe this portal's button labels or every proposed field.
- [AIAG overview of APQP documents](https://blog.aiag.org/helpful-documents-in-the-apqp-process): scope, feasibility, development, validation and feedback are relevant planning areas. It does not mandate our exact CRM labels or a universal project-creation point.
- [AIAG Control Plan resource](https://www.aiag.org/training-and-resources/manuals/details/CP-1): use the applicable customer/core-tool requirements for linked planning and submission evidence. Do not infer that every project requires PPAP Level 3.

Before a normative requirement is accepted, record source title, edition, exact applicable clause/reference, applicability, authorized reviewer and acceptance evidence. Unknown official form-code meanings, scoring methods, retention periods, supplier qualification, signing authority and statutory/tax rules are Blocked until supplied. Technical proposals below are P unless already supported by U or an identified source.

### 14.4 Mandatory flow card — instantiate for EVERY record type

Never use “same generic task form” as a completed flow specification. Every row in 14.7/14.8/14.9 needs a card containing all of these properties:

| Card section | Required detail |
|---|---|
| Identity and provenance | Stable flow/type ID, canonical department, aliases, U/E/S/P requirement IDs; prior working UI/component, backend contract, Android equivalent, template/version/source catalogue IDs. |
| Purpose and trigger | What real business event creates this record; scope Common/Department, Internal Project or Client Project; project required/optional/not applicable; duplicate detection and applicability. |
| Property dictionary | Every key/label/data type/UOM, required/conditional rule, default source, search/master source, allowed values, min/max/length if approved, visibility/editability per role, sensitive classification, persistence field and export/rendition mapping. Add title, ID/reference, project/client, stage, owner/assignee, dates, priority, revision, status, notes, links/evidence where applicable; do not force irrelevant properties on all types. |
| Dependencies | Upstream original IDs/revisions, required inputs, missing-data/blocked behavior, formal provider/consumer handoff, downstream effects and affected project-analysis summaries. No copying records into new authorities. |
| Actions / states | Explicit allowed actor + source state → action → resulting state, guards, comments/evidence requirements, returned/rejected/cancelled/reopened behavior; specify transactional side effects and notification recipients. Status names map to canonical backend values, not a new parallel state machine. |
| Approvals | Real author and requester IDs, designated reviewer/approver, independent review/self-approval policy, final issue authority, delegation/escalation only where actually configured. Selecting a person's name is not their approval. |
| Versions / files | Document identity vs record revision vs independent new instance, current/next sequence, concurrency, source artifact type/checksum, native/manual vs generated draft, approved rendition, supersession and retained history. |
| UI / platform | Entry points/sidebar filters, contextual Add defaults, direct open/edit/detail behavior, search, mobile controls, attachment actions, empty/error/loading behavior, navigation and account changes. |
| Verification / rollout | Concrete positive and negative cases, actual IDs/revisions, screenshots, backend assertions, second-account/platform observation, expected side effects/no side effects, baseline/repaired commits and deployed environment. |

Use an additional **property row** for every discovered UI prop/callback: component prop name, original caller/value, new caller/value, resulting user action, regression case. Include recordTypeFilter/onClear, projectScope/onProjectChange, onCreateRecord/Project/Task/Deliverable, onOpenRecord/Document, onUpdateTask and team/approval callbacks. Omitted prop wiring is a failure, even if the UI renders.

### 14.5 Universal execution / edge-case pack (V01–V20)

Run this pack per flow card and per applicable role; N/A requires a reason and reviewer. Helper tests are not manual evidence.

| Case | Required assertion |
|---|---|
| V01 baseline | Record exact commits; compare old working labels/options/properties/actions with current UI and master plan. Distinguish old DEMO functionality from actual shared functionality; do not claim local behavior previously synchronized. |
| V02 discoverability | Every intended type is reachable; correct context/type default; no Hardware fallback for unknown/MMF; one active sidebar destination, type filter preserved. |
| V03 properties | Every dictionary property renders/behaves correctly; required/conditional validation; no duplicate prototype/mass choice, hidden stale fields, misleading prefilled approval or frozen PRS. |
| V04 master / context | Search/select real permitted project/client/supplier/member/location; zero/one/many results; revoked/missing/deactivated master; changing type/project clears incompatible values but retains appropriate user input. |
| V05 reference / identity | Automatic code is distinct from title; format and uniqueness; same/different project/type, digits in form codes, missing context, collision and retry. Immutable original IDs survive rename/edit/export. |
| V06 revision / instance | Distinguish a new independent PO/inspection from revision of the SAME document. Never group all same-project/type records as revisions without an explicit family/instance identity. Current/next sequence, superseded and malformed legacy revisions; two editors cannot overwrite or allocate duplicate revision. Existing numeric reference generator needs review for this distinction before generalization. |
| V07 dates / defaults | Configured timing matrix, timezone Asia/Kolkata, midnight/year/period boundaries, manual override retention, missing SLA, recurring idempotency and notification delivery evidence. |
| V08 create / persist | Create synthetic record → durable backend success → navigate away → reload → reopen same ID/type/all fields; source links unchanged. Never show success from local state alone. |
| V09 edit / validation | Edit all permitted fields, not just notes; reject invalid/missing/oversized inputs and invalid enums; failure keeps draft; cancellation leaves original unchanged; approved evidence requires controlled revision. |
| V10 context navigation | All-permitted vs selected-project results, counts/totals/summaries match; tab Add prefilled; direct open selects exact record/file/task; Back and filters persist appropriately. |
| V11 authorization | Two own-department employees, lead, authorized foreign lead, unauthorized foreign member, Admin and client; direct API/ID guesses, forged requester/department/role, stale membership and account switch all server-checked. |
| V12 review | Submit, return, reject, revise, resubmit, approve/release, reopen/cancel as applicable. Verify actual evidence revision and actor, permitted self-review policy, no blanket invented rule. No task-checkbox bypass. |
| V13 side effects | Confirm actual inventory/ledger/budget/dependency effects exactly once through existing canonical services; denied/failed/cancelled operations do not post transactions. No fake automation from generic save. |
| V14 files | Original binary/metadata/checksum/version; allowed extensions/size policy, upload failure/retry, same filenames, signed links/expiry/revocation, unauthorized download, client-approved rendition, native format retained. |
| V15 privacy | Rows, aggregate counts, export, tags, search snippets, realtime events, client PDFs and caches all obey same scope; employee HR data/private notes and secrets excluded. |
| V16 concurrency | Double-click, timeout-after-commit, idempotent retry, stale update conflict, concurrent revision/approval/fund/stock race; no duplicate record, overspend or overwritten history. |
| V17 integration | Original linked supplier/customer/part/order/GRN/project/enquiry, actual downstream dependency and authorized recipient event; missing master/contract is Blocked, not empty-success. |
| V18 interface | Original colors/layout, compact responsive filters/search/popup, keyboard/focus/error labels, usable long text/options on desktop/small screen; changes do not remove working options. |
| V19 Android | Same original ID/revision/status visible after web create/edit and Android update where supported; exact user identity, permissions, offline pending vs saved distinction. Not supported or no device = Blocked/Not verified, not automatic pass. |
| V20 recovery | Reversible isolated code rollback, preserved records/history and uploads, actual deployment/import version; no destructive rollback/migration on populated tables; re-run affected neighboring flows. |

Safety: approved TEST environment and labelled synthetic records only; use actual permitted test accounts without printing credentials. No real orders, money movement, stock posting, production shipment, external client notification, HR issuance or credential/access changes merely to test. Exercise high-impact effects in isolated fixtures/rollback-only database tests. Acknowledge browser approval requirements where applicable. Do not delete user drafts or close localhost tabs. Do not seed DEMO suppliers/projects into TEST. Ask only for missing mandatory policy/template or consequential deployment approval; keep independent checks moving.

### 14.6 Execution order and status discipline

1. Inventory all routes/forms/type catalogues/template families/Android equivalents and old baseline; create requirement/property/callback ledger before more rewriting. Cross-check sidebar, generic Add, specialized workspaces, imports, legacy aliases and document catalogue; the current form list alone is not exhaustive.
2. Fix shared primitives and confirmed parity gaps: type/filter context, exact document/task opening, contextual deliverable creation, project input fields, master contracts, reference INSTANCE vs REVISION distinction, save/edit/retry behavior. Feature flags must preserve established functionality without mixed fake shared writes.
3. Purchasing then Sales/enquiry/PRS/feasibility, because their upstream data affects technical teams. Then EHW/FW/SW/MECH/QA/EMF/MMF, inventory/production interactions, Finance, Service, HR, chat/decisions/audit.
4. Test affected neighboring types and roles after each isolated repair; a UI fix is not approval of a new process model. Web checks: TypeScript/build/relevant tests. Android changes: unit tests/debug build and separate device evidence. Do not repeatedly run unchanged broad suites without reason.
5. Release only coherent tested batches; normal Git history, inspect remote changes, exact staged files, verify GitHub and Lovable import/deployment separately; database migrations require their own reviewed deployment evidence. Stop release of an affected flow on failed acceptance, but preserve unrelated working flows.

Allowed statuses: **Not verified**, **Verified—automated**, **Verified—browser**, **Verified—shared round trip**, **Failed**, **Blocked—dependency/policy**, **N/A—reason accepted**. A flow's overall status remains Not verified/Failed/Blocked until ALL applicable cases pass; do not average failures into a completion percentage. Previous 141 passing tests are historical coverage, not proof of this whole programme.

Evidence row schema: Requirement ID | department | type/family/instance | role/account ID (redacted where appropriate) | property/action/case ID | expected | actual | original backend IDs/revision | environment/deployed commit | evidence link | status | issue/root cause | fix commit | retest/reviewer. No blank status; no plan-only row marked verified. Keep raw secrets/personnel data out of the evidence bundle.

### 14.7 Per-record flow inventory and detailed starting contracts

All following flows start **Not verified** for this full programme. Each row inherits the full flow-card property dictionary and V01–V20 pack; its inputs/sequence/checks add record-specific behavior. Starting source field lists are implementation inventory, NOT declarations that all business-required fields already exist. Add omissions found in templates/discussions as explicit requirements. Preserve legacy IDs and do not create duplicate systems.

#### Shared tasks

Starting form properties: `controlledNumber` (Task number; required); `title` (Task title; required); `priority` (Priority; required; choices: Low, Normal, High, Critical); `dueDate` (Due date; optional/conditional).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Task | Project or authorized non-project context; task description, real assignee, priority, configured/manual due date | Create → assign → start/update → complete, or submit to original required review → authorized approval → completed | Owner changes audited; no hidden reassignment approval; overdue retains deadline; no completion bypass for review-required work |

#### Sales (SAL)

Starting form properties: `controlledNumber` (Enquiry number; required); `title` (Enquiry title; required); `customer` (Customer; optional/conditional; source: customers); `targetDate` (Target date; optional/conditional); `location` (Location; required; source: locations).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Enquiry | Customer/contact, requested product/application, source customer requirements and files, quantities/timing and missing-input questions | Capture without project → qualify → link/convert to opportunity preserving enquiry identity and attachments | Allow existing-project association for extension/change without renaming it; no dummy project; conversion retry creates no duplicate |
| Opportunity | Original enquiry, current commercial needs and requirements version, feasibility recipients and response due dates | Qualify → request department feasibility → consolidate responses → commercial decision → explicit project link/create when company gate permits | Feasibility rejection/return stays an opportunity; no automatic project, approved PRS or order |
| Order | Accepted offer/order and customer terms, approved commercial evidence, project/opportunity linkage | Record actual customer order → commercial review → authorized acceptance → handover | No order/payment inferred from uploaded quotation; changed terms require review; preserve currency and original external order reference |
| Handover | Accepted commercial/intake baseline, project, named receiving leads, required deliverables and dependencies | Sales prepares → receiving departments review/return → authorized lead accepts handoff → track outstanding items | Formal handoff is lead-controlled; acceptance cannot hide missing critical inputs or expose all private sales files |

#### Hardware (EHW)

Starting form properties: `controlledNumber` (Controlled number; required); `title` (Title; required); `hwStage` (HW stage; required; choices: HW_01, HW_02, HW_03, HW_04, HW_05, HW_06, HW_07, HW_08, HW_09, HW_10, HW_11, HW_12, HW_13, HW_14, HW_15, HW_16, HW_17, HW_18, HW_19, HW_20, HW_21, HW_22, HW_23, HW_24, HW_25, HW_26, HW_27, HW_28, HW_29, HW_30, HW_31, HW_32, HW_33, HW_34, HW_35, HW_36, HW_37); `projectId` (Project ID; optional/conditional; source: products); `location` (Location; required; source: locations).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| PRS | Original Sales/client inputs and their revisions; relevant feasibility findings; requirements IDs and acceptance criteria | Linked draft during requirements/feasibility → technical clarification → designated review → approved baseline → controlled changes | Title alone is not PRS content; missing source requirements block baseline approval; do not call a draft frozen; project timing is company policy, not a universal standard |
| Hardware tracker | Project, configured HW stage, owner, evidence links, dates and blockers | Create stage work → update evidence/progress → lead review → stage handoff | HW_01…HW_37 are existing configuration, not proof of completion; tracker progress does not automatically approve its evidence |
| Schematic | Project/PCB revision, externally authored design files and authorized viewer link | Upload/link native design → technical review → approve exact revision → retain source and permitted reference views | No portal CAD generation; native source access scoped; Altium links point to correct revision; replacement preserves history |
| BOM | Project/assembly, controlled component IDs, quantities/UOM, alternates and tentative/final classification | Prepare tentative/review BOM → reconcile components/changes → lead review → freeze final baseline → controlled change | Tentative and frozen BOM distinct; do not equate stock/price changes with design approval; no duplicate part masters |
| Gerber release | Reviewed PCB design revision, original Gerber ZIP, release checks and actual downstream package links | Upload original Gerber → review fabrication release → attach panel/stencil packages derived externally → authorized release | Gerber ZIP, panel ZIP and stencil PCB-fab package remain distinct; no regeneration claim; exact source/revision chain required |

#### Firmware (FW) and Software (SW)—verify separately, split authority and applicable types

Starting form properties: `controlledNumber` (Controlled number; required); `title` (Title; required); `gate` (SDLC gate; required; choices: G0, G1, G2, G3, G4, G5, G6, G7, G8, G9, G10, G11); `projectId` (Project ID; optional/conditional; source: products).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Software gate | Project/release, configured gate, commit/build identity and required evidence | Prepare gate submission → review findings → authorized decision → handoff | G0…G11 are configured labels; passing a build is not automatic gate approval; missing test evidence remains visible |
| HSI register | Hardware/software versions, interface requirements, protocol/pin mapping and owners | Record interface → cross-team review → approve baseline → link verified changes | Both sides reference same interface revision; only authorized leads sign formal cross-department changes |
| CI/CD telemetry | Actual repository/commit, pipeline/build/run IDs, timestamps and result evidence | Ingest or manually link actual run → inspect failures → link release/gate evidence | Never fabricate successful runs; distinguish recorded report from connected automation; secrets excluded from logs/search |
| Firmware release | Firmware/source commit, build artifact/checksum, hardware compatibility, test results and release notes | Prepare release candidate → technical/QA review → authorized release → scoped deployment/delivery evidence | FW source vs SW application release ownership explicit; download permission and exact build revision checked; no upload-triggered release |

#### Mechanical (MECH)

Starting form properties: `controlledNumber` (Controlled number; required); `title` (Title; required); `projectId` (Project ID; optional/conditional; source: products); `location` (Location; required; source: locations).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| STEP clearance | Project/part, native STEP or drawing file/version, dimensions/interfaces and review evidence | Upload externally authored file → interface/clearance review → approved reference/release | Hardware gets only explicitly shared references/images; no broad Mechanical folder access; review cannot modify native file silently |
| 2D drawing | Project/part, native STEP or drawing file/version, dimensions/interfaces and review evidence | Upload externally authored file → interface/clearance review → approved reference/release | Hardware gets only explicitly shared references/images; no broad Mechanical folder access; review cannot modify native file silently |
| Mold tooling | Project/tool/part IDs, external tool design, supplier, trials and fit/inspection evidence | Plan tooling → review design → trial → verify corrections → approve scoped release | Tooling approval is distinct from PO/payment; preserve tool asset/custody linkage |
| Mechanical release | Approved drawing/STEP revisions, fit and manufacturing evidence, release scope | Assemble release pack → designated review → approve exact revisions → formal handoff | Missing fit evidence blocks relevant release; no copying confidential native sources into shared overview |

#### Purchasing (PUR)

Starting form properties: `controlledNumber` (Controlled number; required); `title` (Title; required); `supplier` (Supplier; optional/conditional; source: suppliers).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Rapid prototype request | Project, tentative engineering/BOM inputs, quantities, need-by date and actual supplier when available | Select request type once → track inferred Rapid prototype → scoped review → link RFQ/PO/receipt evidence | No second track choice; no automatic spend/order; missing shared supplier master is Blocked, not replaced with DEMO names |
| Mass production request | Project, released BOM/design baseline, quantity/schedule and approved supplier applicability | Select request type once → track inferred Mass production → review readiness → linked procurement execution | No second track choice; prototype evidence cannot substitute for production readiness; no invented PPAP obligation |
| ASL/ACML | Existing supplier/component master IDs, applicability, qualification/evaluation and approval evidence | Reference existing master → evaluate/update → authorized approval → re-evaluation/history | One canonical supplier/component record; searchable real master; relationship does not create universal purchasing approval |
| F-PUR-10 | Exact approved company template and documented meaning of the form code; project/supplier/source links as applicable | Identify actual template purpose → map every property → review routing from company policy → controlled issue | BLOCKED for domain semantics until original template is verified; do not invent form purpose from number; FPUR10 and FPUR16 references remain distinct; no Procurement Track selector |
| F-PUR-16 | Exact approved company template and documented meaning of the form code; project/supplier/source links as applicable | Identify actual template purpose → map every property → review routing from company policy → controlled issue | BLOCKED for domain semantics until original template is verified; do not invent form purpose from number; FPUR10 and FPUR16 references remain distinct; no Procurement Track selector |
| PPAP Level 3 | Applicable customer submission requirement, project/part/BOM/process revisions, actual required evidence checklist | Prepare applicable submission pack → verify completeness → designated review → customer submission/result → retain exact revisions | Required level/content comes from applicable agreement; upload or stage completion is not customer approval; absent customer result remains pending |

#### Quality (QA)

Starting form properties: `controlledNumber` (Controlled number; required); `title` (Title; required); `qualityStage` (Quality stage; required; choices: APQP, DVP&R, IQC, IPQC, FQC, 8D).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| APQP gate | Configured applicable gate, customer requirements, required departmental evidence and unresolved risks | Collect linked evidence → multidisciplinary review → lead decision → next stage | No auto-complete from percentage or uploaded files; gate definitions come from accepted workflow/customer rules |
| DVP&R | Requirement IDs, test plan/version, method/conditions, acceptance criteria, actual results and deviations | Plan → approve plan where required → execute → review results → accepted report/change follow-up | Expected vs actual result distinct; no fabricated measurements; failed test cannot be reported passed by marking task done |
| IQC | Lot/serial/product/process revision, applicable inspection plan, sample/method, actual readings and acceptance criteria | Create inspection → record results → accept/hold/reject → authorized disposition → linked follow-up | IQC receipt, IPQC process and FQC final scope remain distinct; no stock-release side effects without canonical transaction; sampling rules not invented |
| IPQC | Lot/serial/product/process revision, applicable inspection plan, sample/method, actual readings and acceptance criteria | Create inspection → record results → accept/hold/reject → authorized disposition → linked follow-up | IQC receipt, IPQC process and FQC final scope remain distinct; no stock-release side effects without canonical transaction; sampling rules not invented |
| FQC | Lot/serial/product/process revision, applicable inspection plan, sample/method, actual readings and acceptance criteria | Create inspection → record results → accept/hold/reject → authorized disposition → linked follow-up | IQC receipt, IPQC process and FQC final scope remain distinct; no stock-release side effects without canonical transaction; sampling rules not invented |
| 8D CAPA | Actual nonconformance/finding, affected lot/project, containment, cause evidence, actions and accountable owner | Record issue → containment → investigation/actions → verification of effectiveness → designated closure | No closure just because task checkbox checked; concessions separately authorized; central exception log links original detailed record |

#### Electronics Manufacturing (EMF)

Starting form properties: `controlledNumber` (Controlled number; required); `title` (Title; required); `location` (Location; required; source: locations).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Line startup checklist | Line/tool/product revision, setup, readiness checks and actual verification evidence | Plan startup → perform checks → resolve blockers → authorized startup readiness | No production authorization from generic completed task; machine/operator competence restrictions respected |
| PFD | Applicable product/process revision and linked process/risks/controls with named owners | Draft linked process evidence → multidisciplinary review → approved baseline → maintain aligned revisions | PFD/PFMEA/control-plan cross-links verified; use approved scoring/risk methods, not invented numerical thresholds |
| PFMEA | Applicable product/process revision and linked process/risks/controls with named owners | Draft linked process evidence → multidisciplinary review → approved baseline → maintain aligned revisions | PFD/PFMEA/control-plan cross-links verified; use approved scoring/risk methods, not invented numerical thresholds |
| Control plan | Applicable product/process revision and linked process/risks/controls with named owners | Draft linked process evidence → multidisciplinary review → approved baseline → maintain aligned revisions | PFD/PFMEA/control-plan cross-links verified; use approved scoring/risk methods, not invented numerical thresholds |

#### Mechanical Manufacturing (MMF)

Starting form properties: `title` (Title; required); `location` (Location; required; source: locations); `targetDate` (Due / review date; optional/conditional).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Mechanical manufacturing process requirements | Project/part/drawing revisions, process/capability/fit requirements and real trial evidence | Review engineering inputs → assess capability or fit → record findings → authorized acceptance/return → manufacturing handoff | MMF retains manufacturing ownership; no Hardware fallback; accepted fit cannot imply all manufacturing requirements met |
| Manufacturing feasibility | Project/part/drawing revisions, process/capability/fit requirements and real trial evidence | Review engineering inputs → assess capability or fit → record findings → authorized acceptance/return → manufacturing handoff | MMF retains manufacturing ownership; no Hardware fallback; accepted fit cannot imply all manufacturing requirements met |
| Fit verification | Project/part/drawing revisions, process/capability/fit requirements and real trial evidence | Review engineering inputs → assess capability or fit → record findings → authorized acceptance/return → manufacturing handoff | MMF retains manufacturing ownership; no Hardware fallback; accepted fit cannot imply all manufacturing requirements met |
| Manufacturing inspection | Lot/serial/product/process revision, applicable inspection plan, sample/method, actual readings and acceptance criteria | Create inspection → record results → accept/hold/reject → authorized disposition → linked follow-up | IQC receipt, IPQC process and FQC final scope remain distinct; no stock-release side effects without canonical transaction; sampling rules not invented |

#### Finance (FIN)

Starting form properties: `controlledNumber` (Controlled number; required); `title` (Title; required); `ageingDays` (Ageing days; optional/conditional).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Commercial billing | Approved order/delivery evidence, invoice identifiers/lines, currency/tax data from authorized configuration | Prepare bill → Finance review → authorized issue → payment/reconciliation links | Do not invent tax/legal content; tests do not issue real invoices or send to customers; no fake paid status |
| PO & GRN validation | Original PO, receiving/GRN and invoice line IDs, quantities/prices/tolerances | Match originals → flag mismatch → authorized exception or correction → approved validation | No hidden tolerance defaults; successful validation is not actual payment; discrepancies preserve originals |
| Receivables review | Verified ledger/invoice/period data, ageing or reconciliation basis and supporting evidence | Read scoped balances → prepare review → investigate differences → designated sign-off/close | Do not compute from sandbox rows in TEST; financial periods/currency/scopes consistent; no assumed legal compliance |
| Tax close | Verified ledger/invoice/period data, ageing or reconciliation basis and supporting evidence | Read scoped balances → prepare review → investigate differences → designated sign-off/close | Do not compute from sandbox rows in TEST; financial periods/currency/scopes consistent; no assumed legal compliance |

#### Service / IT (SIT)

Starting form properties: `controlledNumber` (Controlled number; required); `title` (Title; required); `service` (Service / asset; optional/conditional).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Server telemetry | Actual system/asset, source timestamp and observed event/backup or control evidence | Capture/link evidence → assess failure/control → corrective ticket/action → verify | Backup success is not restore proof; secrets/internal diagnostics protected; missing integrations are explicit |
| Backup review | Actual system/asset, source timestamp and observed event/backup or control evidence | Capture/link evidence → assess failure/control → corrective ticket/action → verify | Backup success is not restore proof; secrets/internal diagnostics protected; missing integrations are explicit |
| IT support ticket | Internal or client origin, actual requester, issue/category/asset and authorized project link | Open → assign → in progress → waiting as needed → resolved → closed/reopen with reason | Internal only requester/Service/Admin per contract; client Service/Sales/authorized client; internal notes not visible to client |
| ISMS control | Actual system/asset, source timestamp and observed event/backup or control evidence | Capture/link evidence → assess failure/control → corrective ticket/action → verify | Backup success is not restore proof; secrets/internal diagnostics protected; missing integrations are explicit |

#### HR / Operations (HR)—distinct permitted HR/office-asset scopes

Starting form properties: `controlledNumber` (Controlled number; required); `title` (Title; required); `owner` (Owner; optional/conditional; source: people).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Skill matrix | Actual employee/role competencies, gap or training/version and evidence requirements | Identify gap → assign training → employee completes/submits → authorized verification → matrix update | Completion response is not certified competence; every employee including lead/Admin sees own assigned items; preserve training version |
| Training need | Actual employee/role competencies, gap or training/version and evidence requirements | Identify gap → assign training → employee completes/submits → authorized verification → matrix update | Completion response is not certified competence; every employee including lead/Admin sees own assigned items; preserve training version |
| License alert | Actual license/permit/contract, owner, expiry and configured reminder schedule | Record verified expiry → notify actual owner → renewal evidence → review/update | No invented regulatory expiry or successful notification claim; do not expose keys or secrets |
| DMAIC tollgate | Original problem, baseline measures, planned actions and actual measured results | Define/plan → execute → review measured evidence → authorized closure/next gate | No invented savings or metrics; improvement task completion is distinct from verified effectiveness |

#### Legacy R&D—confirm canonical ownership before writes

Starting form properties: `controlledNumber` (Project code; required); `title` (Project title; required); `category` (Type / category; required; choices: New product, Variant, Research, Sustaining engineering); `product` (Product; optional/conditional; source: products); `owner` (Owner; optional/conditional; source: people); `stage` (Stage; required; choices: Concept, Requirements, Prototype, Verification, Released); `targetDate` (Target date; optional/conditional); `location` (Location; required; source: locations).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Project | Internal/client context; client intake/enquiry links where applicable, separate code/title, accountable owner, team, target and lifecycle configuration | Explicit authorized create gate → permitted workspace/analysis → stages with evidence → release/closure | Do not create from an enquiry title or feasibility submission automatically; customer/owner/date/quantity inputs must persist; project code is not a document revision |
| Part | Existing master identifier, verified specification/contact details as applicable, classification and provenance | Search existing → create only when authorized and no duplicate → verify → activate/update with history | Never duplicate inventory/supplier systems; supplier payment/bank details require separate restricted contract; uncertain duplicate resolution does not merge automatically |
| BOM | Project/assembly, controlled component IDs, quantities/UOM, alternates and tentative/final classification | Prepare tentative/review BOM → reconcile components/changes → lead review → freeze final baseline → controlled change | Tentative and frozen BOM distinct; do not equate stock/price changes with design approval; no duplicate part masters |
| Prototype | Project/design/BOM revision, prototype objective, actual build or sample IDs and evaluation plan | Plan authorized prototype → record actual build/sample → evaluate → review findings → feed controlled design change | Prototype completion is not production release; identify tentative inputs and external STL/DXF/native artifacts; no fabricated devices or measurements |
| Engineering change | Original design/requirement/BOM revision, reason, affected parts/files/lots and impact assessment | Propose change → multidisciplinary impact review → designated approval → controlled implementation/revision → verify effectiveness | Do not overwrite released baseline; update affected dependencies with provenance; link critical exception decision without duplicate entry |
| Design review | Original requirements/design revision, reviewers, review criteria and actual findings | Prepare evidence → conduct review → return or accept with recorded conditions → track actions | Selecting reviewer names is not approval; unresolved critical findings prevent relevant baseline release; preserve reviewed revision |

#### Stores / legacy purchasing—integration with existing inventory, not replacement

Starting form properties: `controlledNumber` (Purchase request number; required); `title` (Request title; required); `supplier` (Supplier; optional/conditional; source: suppliers); `part` (Part; optional/conditional; source: parts); `location` (Delivery location; required; source: locations); `dueDate` (Required date; optional/conditional).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Purchase request | Canonical project/department need, items/UOM/quantity, supplier IDs where applicable, quote/currency/terms and authority policy | Request → permitted approval → RFQ/quote evaluation → authorized PO issue → receiving link | Treat each as separate existing business record, not repeated generic tasks; PO issue needs configured authority; do not place actual orders while testing |
| Part | Existing master identifier, verified specification/contact details as applicable, classification and provenance | Search existing → create only when authorized and no duplicate → verify → activate/update with history | Never duplicate inventory/supplier systems; supplier payment/bank details require separate restricted contract; uncertain duplicate resolution does not merge automatically |
| Supplier | Existing master identifier, verified specification/contact details as applicable, classification and provenance | Search existing → create only when authorized and no duplicate → verify → activate/update with history | Never duplicate inventory/supplier systems; supplier payment/bank details require separate restricted contract; uncertain duplicate resolution does not merge automatically |
| RFQ | Canonical project/department need, items/UOM/quantity, supplier IDs where applicable, quote/currency/terms and authority policy | Request → permitted approval → RFQ/quote evaluation → authorized PO issue → receiving link | Treat each as separate existing business record, not repeated generic tasks; PO issue needs configured authority; do not place actual orders while testing |
| Purchase order | Canonical project/department need, items/UOM/quantity, supplier IDs where applicable, quote/currency/terms and authority policy | Request → permitted approval → RFQ/quote evaluation → authorized PO issue → receiving link | Treat each as separate existing business record, not repeated generic tasks; PO issue needs configured authority; do not place actual orders while testing |
| Receiving | Canonical PO/part/lot/serial/location/UOM, quantities and quality/disposition | Record physical event → inspect/accept or hold → authorized inventory posting → traceability | Do not change stock from a generic record save; retries/concurrency cannot double-post; held inventory stays distinct from released |
| Stock movement | Canonical PO/part/lot/serial/location/UOM, quantities and quality/disposition | Record physical event → inspect/accept or hold → authorized inventory posting → traceability | Do not change stock from a generic record save; retries/concurrency cannot double-post; held inventory stays distinct from released |

#### Legacy Production—confirm canonical EMF/MMF mapping

Starting form properties: `controlledNumber` (Production order number; required); `title` (Production order title; required); `route` (Production route; optional/conditional; source: routes); `location` (Location; required; source: locations); `targetDate` (Planned completion; optional/conditional).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Production order | Released product/process/BOM revision, lot/serial, quantity, work/test/delivery evidence as applicable | Plan authorized production → execute/test → hold/release through designated gate → dispatch proof | Each transaction keeps its distinct stock/release/shipment effects; no external shipment or inventory posting during probes |
| Production test | Released product/process/BOM revision, lot/serial, quantity, work/test/delivery evidence as applicable | Plan authorized production → execute/test → hold/release through designated gate → dispatch proof | Each transaction keeps its distinct stock/release/shipment effects; no external shipment or inventory posting during probes |
| Release | Released product/process/BOM revision, lot/serial, quantity, work/test/delivery evidence as applicable | Plan authorized production → execute/test → hold/release through designated gate → dispatch proof | Each transaction keeps its distinct stock/release/shipment effects; no external shipment or inventory posting during probes |
| Dispatch | Released product/process/BOM revision, lot/serial, quantity, work/test/delivery evidence as applicable | Plan authorized production → execute/test → hold/release through designated gate → dispatch proof | Each transaction keeps its distinct stock/release/shipment effects; no external shipment or inventory posting during probes |

#### Legacy Quality—map to QA without duplicate records

Starting form properties: `controlledNumber` (Inspection number; required); `title` (Inspection title; required); `location` (Location; required; source: locations); `targetDate` (Target closure; optional/conditional).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Inspection | Lot/serial/product/process revision, applicable inspection plan, sample/method, actual readings and acceptance criteria | Create inspection → record results → accept/hold/reject → authorized disposition → linked follow-up | IQC receipt, IPQC process and FQC final scope remain distinct; no stock-release side effects without canonical transaction; sampling rules not invented |
| NCR | Actual nonconformance/finding, affected lot/project, containment, cause evidence, actions and accountable owner | Record issue → containment → investigation/actions → verification of effectiveness → designated closure | No closure just because task checkbox checked; concessions separately authorized; central exception log links original detailed record |
| CAPA | Actual nonconformance/finding, affected lot/project, containment, cause evidence, actions and accountable owner | Record issue → containment → investigation/actions → verification of effectiveness → designated closure | No closure just because task checkbox checked; concessions separately authorized; central exception log links original detailed record |
| Quality review | Original inspections/tests, findings, risk and disposition evidence | Prepare review → record comments/return → authorized decision → follow-up verification | Review is not an inspection measurement source; retain reviewer identity and evidence revision |

#### Legacy People—map to HR/asset ownership

Starting form properties: `controlledNumber` (Person number; required); `title` (Name; required); `location` (Location; required; source: locations); `dueDate` (Due date; optional/conditional).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Person | Authenticated member/employee ID, verified directory/employment fields and field-level privacy | Authorized HR create/link → verify → update with history → employee scoped self-view | Never substitute lead profile by department; no invented employment facts; private letters/fields excluded from general directory |
| Training | Actual employee/role competencies, gap or training/version and evidence requirements | Identify gap → assign training → employee completes/submits → authorized verification → matrix update | Completion response is not certified competence; every employee including lead/Admin sees own assigned items; preserve training version |
| Leave | Actual employee, dates/type, configured balance/calendar and reviewer | Submit → policy validation → designated review → approved/rejected/cancelled → audited balance effects | No invented leave policy; overlapping dates and retries checked; no broad employee access |
| Asset | Existing canonical asset ID, class/serial/location, custody and permitted assignment | Search master → authorized request/assignment/change → custody acknowledgment → return/history | SIT IT assets; Operations office assets; technical tooling by scope; no duplicate asset register or private HR leak |

#### Legacy TST—read-only until ownership confirmed

Starting form properties: `controlledNumber` (Controlled number; required); `title` (Title; required); `serialRange` (Serial range; optional/conditional); `fpy` (First-pass yield %; optional/conditional).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| EOL test run | Actual test run/jig/calibration/serial or yield source; approved test configuration | Record actual evidence → review exceptions → authorized disposition/report | TST is legacy/read-only until canonical ownership confirmed; never generate passing runs, serial collisions or yield from sample data |
| Test jig | Actual test run/jig/calibration/serial or yield source; approved test configuration | Record actual evidence → review exceptions → authorized disposition/report | TST is legacy/read-only until canonical ownership confirmed; never generate passing runs, serial collisions or yield from sample data |
| QR label batch | Actual test run/jig/calibration/serial or yield source; approved test configuration | Record actual evidence → review exceptions → authorized disposition/report | TST is legacy/read-only until canonical ownership confirmed; never generate passing runs, serial collisions or yield from sample data |
| FPY review | Actual test run/jig/calibration/serial or yield source; approved test configuration | Record actual evidence → review exceptions → authorized disposition/report | TST is legacy/read-only until canonical ownership confirmed; never generate passing runs, serial collisions or yield from sample data |

#### Admin / authorized audit functions—not a new department

Starting form properties: `controlledNumber` (Audit / document number; required); `title` (Title; required); `auditStatus` (Workflow status; required; choices: Draft, Planned, Scheduled, In progress, Awaiting closure, Closed, Overdue); `auditType` (Plan / finding type; required; choices: Internal, Supplier, Customer, Controlled document, Management review); `classification` (Finding / classification; optional/conditional; choices: Observation, Minor nonconformity, Major nonconformity, Confidential, Internal); `owner` (Owner; optional/conditional; source: people); `supplier` (Supplier; optional/conditional; source: suppliers); `customer` (Customer; optional/conditional; source: customers); `location` (Location; required; source: locations); `targetDate` (Due / review date; optional/conditional).

| Record type | Inputs and original links | Planned flow | Critical edge / acceptance boundary |
|---|---|---|---|
| Audit programme | Applicable audit scope/criteria, actual period/organization/supplier/customer, competent authorized auditor and schedule | Plan → review scope/schedule → conduct with linked evidence → findings/follow-up | Do not fabricate independent auditor qualification; customer/supplier confidentiality and project applicability preserved |
| Internal audit plan | Applicable audit scope/criteria, actual period/organization/supplier/customer, competent authorized auditor and schedule | Plan → review scope/schedule → conduct with linked evidence → findings/follow-up | Do not fabricate independent auditor qualification; customer/supplier confidentiality and project applicability preserved |
| Supplier audit plan | Applicable audit scope/criteria, actual period/organization/supplier/customer, competent authorized auditor and schedule | Plan → review scope/schedule → conduct with linked evidence → findings/follow-up | Do not fabricate independent auditor qualification; customer/supplier confidentiality and project applicability preserved |
| Customer audit plan | Applicable audit scope/criteria, actual period/organization/supplier/customer, competent authorized auditor and schedule | Plan → review scope/schedule → conduct with linked evidence → findings/follow-up | Do not fabricate independent auditor qualification; customer/supplier confidentiality and project applicability preserved |
| Audit finding | Audit/criterion reference, observed evidence, classification from actual rules and accountable owner | Record finding → acknowledge/contain as applicable → linked corrective action → verify closure | Observation/minor/major labels follow accepted policy, not automatic guessed severity; original evidence immutable |
| Corrective / preventive action | Actual nonconformance/finding, affected lot/project, containment, cause evidence, actions and accountable owner | Record issue → containment → investigation/actions → verification of effectiveness → designated closure | No closure just because task checkbox checked; concessions separately authorized; central exception log links original detailed record |
| Management review | Actual review period, authorized agenda/input records, attendees, decisions and action owners | Prepare scoped inputs → conduct actual review → record authorized decisions → track actions | Do not infer attendance/signatures or close actions from meeting upload; sensitive management inputs restricted |
| Improvement action | Original problem, baseline measures, planned actions and actual measured results | Define/plan → execute → review measured evidence → authorized closure/next gate | No invented savings or metrics; improvement task completion is distinct from verified effectiveness |
| Controlled document | Approved template/source, owner, applicability, classification, revision and reviewer/releaser | Editable draft → review/return → authorized final approval → controlled rendition/issue → supersession | Editable source retained; client sees only approved permitted rendition; PDF does not itself guarantee immutability |

### 14.8 Specialized records outside the generic type dropdown

These are part of the coverage target even if no generic Add option exists. Reuse the specialized module; never create duplicate authority through create_record.

| Record / flow | Properties / lifecycle / specific checks |
|---|---|
| Feasibility response / dependency | Source enquiry/opportunity requirements version, department provider, actual author/reviewer, findings, missing inputs, feasible/conditional/not feasible, evidence, next action and waiting consumer. Return/clarification before explicit approved project gate; no dummy project. |
| Project analysis / lifecycle | All permitted portfolio vs selected project, actual customer intake/team/deliveries/native file references/BOM baseline/tasks/approvals; department field edit authorization; explicit dependency readiness and missing data; no fabricated critical path/percentages or all-files access. |
| Project team membership | Lead adds/removes/reassigns own authorized members, shows pending tasks before removal; membership and task assignment distinct; team changes do not expand other departments' file access. |
| Sample / PoC device delivery | Original project/order, actual device/serial/quantity, sender/recipient and shipment/evaluation evidence. Separate from document deliverables; no physical delivery inferred from an uploaded document. |
| Template-generated draft | Template ID/version + verified source field IDs/revisions, editable source, regeneration behavior preserving human edits or explicit conflict, technical review and Admin final client-issue gate. No assumed signatures. Unsupported templates/manual upload explicitly marked. |
| External certificate / native file | Actual issuer/tool, project/part/PCB revision, artifact/checksum and applicable expiry/result. Upload/review is not issuer certification or CAD generation; expiry reminders from verified data. |
| Budget allocation | Authorized Finance/Admin policy, department/category/period/currency/project, original allocation ID and audited changes; committed/spent/available reconciliation. No allocation means blocked final approval. |
| Expense / travel / asset request | Authenticated requester, category/purpose/amount/currency/period/project, evidence and designated routing. Department review → Finance → approved commitment → evidence-backed posting; reject/return/cancel/retry with exact ledger effects. Asset request links canonical custody, not duplicate master. |
| Employee letter | Real employee data, supplied approved template/version, purpose, designated signer, draft/review/issue and private approved rendition; missing facts/signature policy block issuance. Employee sees own, HR/Admin only authorized scope. |
| Policy publication / acknowledgment | Policy version/effective date, audience, required acknowledgment, employee-specific receipt/completion and retained prior version; no forced disclosure of private personnel cases. |
| Survey / feedback / recurring form | Web builder question IDs/types/options/requiredness/versions/audience; validate false/zero correctly; employee submission/status, anonymity policy and minimum reporting rules; recurring assignment idempotency, actual reminders and absence of false anonymity guarantees. |
| Training assignment / verification | Verified employee/course/version, due/period/audience, submission evidence, reviewer verification and recurring cycle; no certificate inferred from self-response. |
| Team channel / message / poll | Explicit members and project/department scope, sender IDs, conversation tags, message original IDs, poll options/deadline/vote deduplication/switching/closed check; revocation and authorized search. Basic mobile, advanced web where agreed. |
| Decision & Deviation | Three scope actions; project/stage required only where applicable, actual author, reason, conditions, original detailed record and designated lead approval. Defaults own department; Admin-only visibility mapping. Employee own draft/status; no duplicate routine approval record. |
| Approval record | Original target ID, exact evidence revision, authenticated author/reviewer, configured transition and decision/comments/timestamp; stale/replaced evidence invalidates approval applicability; request action cannot approve itself. |
| Notification / reminder / tags | Actual event/recipient/entity link, permission at delivery/open, workflow schedule/timezone/manual overrides, deduplication and delivery status; tags are search metadata, never permissions. |
| Search / exports / knowledge base | Compact top popup, scoped snippets/counts and direct original links; no HR/private answer leakage. Approved reference content and training separate from operational controls; client exports authorized and revision-specific. |

### 14.9 Document-family reconciliation (existing 38-family catalogue)

Every family below requires subtype-by-subtype cards, templates/native upload mappings, canonical owners, applicability and V01–V20 evidence. A family is not a required separate file or completed feature. Keep 89 original source-block IDs / 90 family links from the existing JSON; do not turn catalogue counts into universal company obligations. D02/D04 remain clarification-only. Reconcile original worksheet rows against source IDs without assuming the historical extraction alone proves full workbook coverage.

| Family ID | Existing family | Owner | Artifact/source mode | Creation/applicability basis |
|---|---|---|---|---|
| D01 | Common operating pack: SOPs, authority matrix and work instructions | Each department | DOCX / approved references | Maintain one controlled pack per department/workstream; reuse its revision across projects. Includes engineering/SDLC/CI standards, FIFO and nonconformance procedures. |
| D02 | Customer Register and contacts | Sales | Software records → synced XLSX | One managed Customer Register.xlsx from Customer master; refresh additions/changes, retain revisions. Not one file per customer and not external Excel import. |
| D03 | Enquiries & Opportunities register / pipeline reviews | Sales | Software records / review log | One linked queue and stage/owner/review tracking; pipeline review uses the same records rather than duplicate forms. |
| D04 | Master Specification / customer inputs / SOR | Sales | Versioned fields + DOCX | Capture known requirements once, preserve source/customer/revision, reuse in feasibility and project start. SOR is a rendition, not another source of truth. |
| D05 | Feasibility / contract review | Sales coordinates assigned departments | Assigned review records + DOCX | Selected departments record scope, owner, due date, evidence, decision and conditions; one consolidated review links the contributions. |
| D06 | Quotation / commercial proposal | Sales | DOCX / commercial records | When an opportunity requires a commercial offer; scoped Finance input, explicit issuance and version history. |
| D07 | NDA and confidential agreement | Operations / Legal | DOCX + actual agreement evidence | Only when required by the customer/program. Template belongs to Legal/Common; executed agreement is scoped to its case/project. Sales initiates/links, without Legal access. |
| D08 | PRS / confirmed requirement baseline | Hardware / R&D | Versioned baseline + DOCX | After required feasibility/confirmation, pin the exact approved requirements for explicit project start and engineering. |
| D09 | Architecture / block diagram / HSI | Hardware / R&D | Design files / specification | Applicable engineering scope; architecture and HSI remain distinct linked subtypes and exact source revisions. |
| D10 | Design and release file package | Hardware / R&D | Externally authored native artifacts uploaded or controlled-linked | Upload or link engineer-authored schematic/PCB/Gerber, firmware/software source and build packages, enclosure/STEP, drawings and tooling files. The portal records file identity, revision and checksum and may generate a metadata index; it does not generate or edit the native artifacts. |
| D11 | Engineering BOM / cost tracker | Hardware / R&D | Portal-owned structured BOM + XLSX/CSV rendition | Create a tentative BOM in the portal by selecting controlled parts/inventory records and entering project quantities/designators. Procurement reviews the same pinned revision. Creating/exporting it does not reserve or move stock; release follows configured approval. |
| D12 | DFMEA | Hardware / R&D | Structured ratings/actions + DOCX | When design risk analysis is applicable; ratings, actions and closure come from actual engineers/reviewers. |
| D13 | POC / design verification / DVP&R | Hardware / R&D | Test records + evidence / DOCX | At applicable POC/validation stages; draft plans/checklists may be populated from approved requirements. Actual results and lab reports must be recorded from measured evidence or uploaded from the issuing test system, linked to source/firmware/sample revisions. Never generate a pass result. |
| D14 | Design change / ECO / ECN review | Hardware / R&D | Change register + evidence | On a change or failed review; preserve previous decisions and record impact/effectivity. Stage/ECO audits read this history. |
| D15 | Software quality / security / performance review | Hardware / R&D | Review records | Only firmware/software/cloud scopes that need these reviews; frequency is configured, not imposed on every project. |
| D16 | DRC / component-library review | Hardware / R&D | Review records | When hardware/library review is due or change-triggered; reference actual rules and evidence. |
| D17 | Tooling condition / custody / mold maintenance review | Production | Asset/tool review records | Production maintains process tools; Engineering supplies design evidence; Facility handles custody where authorized. |
| D18 | Supplier qualification / ASL / ACML / performance and capacity | Procurement | Supplier registers + review evidence | One supplier history with evaluation, on-site/system reviews, approved lists, scorecards/capacity/lead-time observations. No duplicate workbook per review title. |
| D19 | Supplier PPAP / submission warrant | Procurement | Checklist + supplier evidence | Only applicable customer/product/supplier programs; a document-type/project category, never a fifth department Drive group. |
| D20 | Calibration / MSA / expiration review | Production | Instrument register + evidence | Applicable instruments/gages/processes; Operations quality audit links the same authorized calibration evidence. |
| D21 | Line capacity / startup / process flow | Production | Readiness records / PFD | When preparing an actual build/line; use recorded capacity and readiness, retain separate process-flow subtype. |
| D22 | PFMEA / control plan | Production | Distinct structured templates / DOCX | Applicable manufacturing process; PFMEA and control plan retain their own fields/decisions and cross-references. |
| D23 | EOL / FQC / PDI | Production | Measured unit records + DOCX | For actual build/dispatch units; serial, firmware, test/inspector evidence and explicit disposition, never generated passes. |
| D24 | 5S / OEE / yield / scrap / defects / KPI reviews | Production | Operational registers + calculated views | When production observations/reviews exist; use defined formulas/time windows. Standards/templates are Common & Standards; completed non-project reviews are Department Operations & References, while project-specific evidence stays with its project and is linked from audit views. |
| D25 | NCR / 8D / CAPA / lessons learned | Operations | Linked case and action records | When nonconformance or learning occurs; originating departments retain evidence and Operations coordinates the case. |
| D26 | Receivables / MIS / financial KPI / closing / billing | Finance | Financial records + XLSX/DOCX renditions | Use Finance-owned records; Sales sees permitted commercial context. Tax invoice is a separate authorized rendition. IT tickets from the combined source note stay outside Finance records. |
| D27 | Skill matrix / TNI / training / manpower and workforce reviews | HR | Restricted HR records + matrix rendition | Recorded competence/training/assignment; corporate scope unless project-linked work is needed. License governance is linked to Operations, not another HR workbook. |
| D28 | Onboarding / BGV | HR | Restricted policy and case records | When an authorized onboarding/verification case exists; policy is Common, personnel evidence remains restricted. |
| D29 | Grievance / employee query | HR | Restricted case register | Only actual authorized employee cases; not a generally shared project document. |
| D30 | Linked risk registers / project risk matrix | Operations | Scoped risk records | Combine repeated enterprise-risk titles into one index, with separate authorized strategic, financial, infrastructure/security and project scopes. No blanket shared confidential register. |
| D31 | Certification / statutory applicability and validity evidence | Operations | Reference / actual external evidence | Maintain separate applicability/evidence scopes: component/asset certificate for the exact covered revision, and finished-product/project certification for the exact combined project configuration, customer/market, and authority/lab scope. Link authentic issuer, standard/edition, ID, sample/configuration/conditions, limitations, validity, and source file. Component evidence may support but never substitutes for finished-product tests/approval. References alone do not claim certification. |
| D32 | APQP / internal audits / governance / management review | Operations | Assigned checklist/review records | Applicable program/governance reviews; one schedule/history links scope, customer feedback, risks and decisions across the current 12-department registry. |
| D33 | DMAIC / improvement charter and tollgate evidence | Operations | Improvement project records | Only approved improvement work; real sign-offs/evidence, not a compulsory document for every client project. |
| D34 | Process-equipment PM / downtime / OEE | Production | Maintenance and performance records | For applicable production equipment and actual maintenance/observations; Facility supports infrastructure separately. |
| D35 | Utilities / DG / electricity and water | Facility / Maintenance | Facility records + evidence | Actual utilities/assets/consumption/maintenance, with scoped Finance payment review; unknown source shorthand requires field configuration. |
| D36 | IT backup / security review / project IT tickets | Facility / Maintenance | Authorized IT records | Infrastructure work only; privileged configuration remains administrator-controlled. Split project IT tickets from financial billing in the source note. |
| D37 | Facility/security service / waste disposal / pest control | Facility / Maintenance | Contracts, service and disposal evidence | Applicable services/assets/schedules; actual agreements/qualified disposal evidence and private commercial terms. Short reminders are work tasks, not templates. |
| D38 | Cross-department KPI definitions / dashboard | Operations | Definitions + authorized aggregate views | Reuse measured records and the reviewed formula from each department, not a second manually copied enterprise tracker. |

Catalogue references in repository: `docs/SSM One Document Catalogue - Auto-Drafting Audit and Native Upload Rules.json`, its Markdown companion and `src/lib/document-catalogue.ts`. Original user worksheet: `C:\Users\Test\Downloads\Smart Company document management system audit checklist .xlsx`; historical extraction: `audit-checklist-extracted.json` (Design Devlopment Support, Production & Assembly, Audit checklist). Source examples VTU/XLC are project names only. Check actual workbook availability and extraction completeness before marking source reconciliation verified; never recreate “missing” native files from guessed content.

### 14.10 Known gaps and corrections already identified—baseline, not new PASS claims

| Finding | Required disposition |
|---|---|
| Shared form lost original selector/fields | Repaired in earlier batch; recheck exact current commit, all types and every retained property; the prior fix does not close this whole matrix. |
| Purchasing duplicated track | Latest user rule removes track selector for all types; derive request metadata only. Retest both editors and DEMO. |
| Shared supplier master unavailable | Block supplier-dependent flows until actual canonical read/selection/ID validation contract exists. Search box alone is not integration; no invented suppliers. |
| Only one TEST project visible | Verify authorized backend project membership/counts and expected dataset. Do not copy DEMO projects or enlarge permissions just to show more options. |
| Auto reference / next numeric revision | Existing implementation needs explicit independent-instance vs document-revision contract before broad use; different new requests are not automatically revisions of one document. Preserve existing IDs and history if format is corrected. |
| Sidebar type filters / direct document / task detail | Restore original contextual behavior in shared adapter; list callbacks before repair and prove same original IDs open. |
| Add Deliverable redirects register | Restore contextual creation/draft behavior against canonical contract; opening a list is not equivalent. |
| Project input parity / pre-project enquiry / PRS source | Restore missing properties with persistence and explicit intake/feasibility/project gates; no fake approvals/baselines or dummy project. |
| Shared vs local modules | Inventory each module's actual contract; unsupported TEST mutation explicitly disabled, not falsely successful. Do not market the shared portal as complete while these are blocked. |
| Standards/expert/form-code inputs incomplete | Source and record exact approved requirements, not assistant inference. Do not invent F-PUR-10/F-PUR-16 meaning, thresholds, compliance applicability or legal signers. |

### 14.11 Stop / completion gates and final delivery

A batch is acceptable only when its requirement/field/callback diff has no silently omitted working behavior; applicable positive and denied paths persist correctly; original IDs/revisions and canonical side effects are proven; no unauthorized disclosure or business action occurs; and affected neighboring flows pass. Any unresolved requirement remains visible as Blocked or Not verified with dependency/owner.

The overall programme is **not complete** until every discovered type, subtype, specialized flow and property is accounted for, every applicable role/platform/context case has evidence or explicit accepted exclusion, original regression gaps are closed, and actual deployed versions match tested versions. A clean build, helper-test count, screenshot or “all synced” statement alone is insufficient.

Deliver one status ledger and one concise summary: verified flows, exact failures, blocked policy/master/template dependencies, original synthetic record IDs, tests and browser/device evidence, commits, GitHub/Lovable/backend deployment state and remaining limitations. No claim of certification, guaranteed absence of bugs, or completed financial/HR/native automation without its actual evidence. Keep PDF/OCR, KiKit/new PCB tooling, social publishing and replacement inventory out of this programme unless explicitly separately authorized.

### 14.12 Connected, automation-first implementation contract — latest user clarification

This is an implementation requirement, not merely a verification checklist. Antigravity must implement the connected business flows, then verify them. Automate deterministic preparation and linkage wherever verified sources and configured rules permit. Do not automate business judgment, approval, certification or consequential execution simply because the UI can perform it.

**Default interaction:** resolve from existing context → obtain authorized existing record/data through its canonical connector → prefill/link → offer searchable selection when a choice remains → offer scoped inline creation only to an authorized responsible user → save original entry and select it back in the parent form. Manual re-entry is the last supported fallback, not the default for data already held by the system.

| Requirement | Required implementation / acceptance |
|---|---|
| Existing-record authority | Reuse original canonical IDs and approved revisions for project, client, enquiry/opportunity, supplier, part, BOM, employee, asset, order, receipt, document and other dependencies. Store relationships by ID, not display-name matching or copied free text. Clearly identify intentional snapshots such as issued invoice details or approved requirement baselines. |
| Contextual defaults | Prefill logged-in author/department, selected project/client, applicable upstream record/stage, configured due date, reference/revision and actual assigned owner where unambiguous. Author identity is server-derived. Show provenance for important inherited values; do not overwrite manual editable choices or invent missing facts. |
| Search instead of retyping | Use searchable dropdown/combobox with meaningful code/name/context; query only permitted existing records. Support loading, no matches, unavailable connector and deactivated/restricted entries. Account/organization changes clear inappropriate cached options. Do not expose unauthorized counts/snippets while searching. |
| Authorized Add new | When a required entry does not exist, show Add new [supplier/client/part/etc.] only if the authenticated user's configured responsibility AND create capability cover that entity and scope. Same department, lead label or role URL alone is insufficient. Backend independently checks creation, field and linking permissions. |
| Inline creation return | Open the correct compact entity form with context prefilled; preserve the unsaved parent draft. Search for duplicates first. After a durable successful create, refresh authorized options, select/link the returned original ID, and resume the parent form. Cancel/failure leaves parent unchanged. No fake temporary ID treated as saved. |
| Other responsible owner | If the user cannot create the missing entity, offer a request to its configured responsible team where supported, or clearly show the blocking dependency. Do not grant access, create a shadow master or fall back to unrestricted free text to bypass responsibility. Any routed request remains pending until the actual master is created/approved. |
| Draft vs approved master | Inline creation may produce a draft/pending verification master. It must not imply approved supplier status, released part/BOM or authority to transact. Downstream actions requiring an approved master remain blocked until their real approval gate passes. |
| Connector reuse | First inspect existing internal backend/API/master contracts. Reuse them; do not build a duplicate database/register. A new external connector is not implicitly authorized. Define source ownership, read/write direction, authentication/scopes, deduplication/external ID, sync/freshness/failure behavior and audit before enabling it. Missing connector stays an explicit dependency. |
| Automated derivation | Derive totals, applicable links, reference/instance/revision suggestions, workflow timing/reminders, dependency readiness and draft document fields from verified data and configured rules. Distinguish suggested, saved, queued and actually delivered/completed states. No fabricated testing results or approval from a derived percentage. |
| Changes after linking | Original-record edits remain traceable; historical approved/issued snapshots do not silently change. Record selected source revision; flag relevant source changes for re-review. Prevent stale updates, cross-project association, incompatible UOM/currency, duplicate creation and concurrent numbering collisions through canonical validation. |
| Manual/external fallback | Native CAD, certificates and other unsupported outputs remain manual upload/link with provenance. User-entered external identifiers or observations are allowed only where the flow dictionary explicitly defines them; they are not substitutes for missing internal master integrations. |
| Automation safeguards | Preserve existing final approvals, role boundaries, inventory/ledger transactions, controlled release and client visibility. Automatic preparation is not automatic PO issue, payment, stock posting, shipment, HR letter signature or final publication. |

For EVERY property in the flow card add: **source entity/connector + original ID/revision; automatic derivation/default rule; editable/locked behavior; search/filter scope; permitted inline-create action/form; approval prerequisite; parent-return mapping; source-update rule; empty/error fallback; evidence cases**. Use explicit Not applicable with a reason rather than leave cells blank. This property-level mapping is required before claiming a flow is implemented.

Concrete paths to implement and verify:

- Sales: search existing client → authorized Sales user may add a missing client and return selected → enquiry captures actual requirements → opportunity/department feasibility reuses those original inputs → explicitly authorized project creation links them → PRS draft derives available source fields and flags missing requirements. No automatic project or frozen PRS from a title.
- Purchasing: select project → link relevant released/tentative BOM or request as applicable → search canonical parts/suppliers → authorized responsible user may add missing master through the existing master workflow → pending supplier/part approval blocks applicable procurement execution. A generic ASL document is not a substitute for the supplier master.
- Technical teams: link original requirement/interface/design/BOM/test inputs and actual file revisions → derive relevant checklist/draft fields → create only authorized missing technical records → designated review/release remains explicit. Reference views expose only permitted cross-department files.
- HR/Service/Finance: reuse verified employee/asset/allocation/requester IDs; inline creation is restricted to the actual entity owner/capability. Profile, ticket, claim or approval forms cannot silently create employees, assets, budget allocations or elevated membership.

Additional mandatory tests per applicable property: auto-prefill from correct source; choose another permitted existing entry; no match; responsible authorized inline create and return; duplicate detected/reused; cancel/failure preserves parent; unprivileged direct API create denied; draft master does not satisfy approved-master gate; connector timeout/stale source; source revision change; account switch; concurrent create/retry without duplicate. Record blocked connectors/policies explicitly rather than mark a searchable empty control complete.

### 14.13 Connected lifecycle example and reusable synthetic test-data pack

Implement a reproducible connected example, not unrelated sample cards. Use **TEST OEM OBD Tracker** as the main external/client project and **TEST Internal Test Jig** as the contrasting internal project. Names are examples, not new product/record categories. This is a fixture specification; no records are seeded by this document update.

#### A. Fixture modes and safety

- **DEMO:** replaceable, versioned local scenario with a visible DEMO indicator. Demonstrates navigation, relationships and role views; never claims backend synchronization or security enforcement.
- **Automated integration fixture:** isolated database/test environment, synthetic identities and artifacts, repeatable setup and rollback/cleanup. Exercise transactional financial/stock/concurrency failures here, not on real operations.
- **Authenticated TEST:** minimal labelled synthetic records in the approved tenant/environment, created through actual authorized contracts. Use existing provisioned test accounts and real returned IDs. Do not create accounts, expand permissions, import DEMO records or run bulk production seeds merely to make the example work. Missing test capability or master contract is Blocked. No production money, PO issue, shipment, client message or HR letter issuance.

Assign a unique run ID such as `TEST-OBD-YYYYMMDD-001` and stable fixture keys. Persist fixture-key → actual canonical ID mapping outside business display names; labels are not authorization or deduplication keys. Re-running the same run must reuse/verify existing fixtures, not duplicate them. New independent requests get independent instance IDs; revision 02 belongs to the same explicitly identified document instance. Actual reference format uses approved configuration, not invented official company form numbers.

Fixture manifest properties: run ID, schema/fixture version, organization/environment, mode, canonical entity type, stable fixture key, actual ID, owner/member IDs, project/source IDs and revisions, classification, expected initial state, source artifact/checksum where applicable, setup result, verification case IDs and retention/cleanup disposition. Do not store passwords, access tokens or real personal data in the manifest. If using this shared deployment, retain test evidence or use supported reversible archival with appropriate authorization; never DROP/CASCADE or delete by name prefix.

#### B. Seed/data manifest—dependency order

All values below are synthetic inputs, not approved company policies, real certifications or operational results. Use known provisioned memberships rather than inventing people. At least two employees in one department are needed for isolation/reassignment testing; if unavailable, record the dependency.

| Fixture key | Example / properties | Required original links / expected state |
|---|---|---|
| ACCOUNT-SET | Admin; Sales lead/member; each canonical technical lead/member; Purchasing; QA; Finance reviewer; Service; HR/Ops; authorized client and unauthorized client | Existing actual IDs, distinct memberships, configured capabilities. Never infer authority from example names or URL role. |
| CLIENT-A / CLIENT-B | TEST Fleet Client A; TEST Other Client B; synthetic contact details only when needed | Authorized client masters. B provides negative isolation context; same names cannot grant shared access. |
| ENQ-A | TEST OBD enquiry: 12/24 V vehicle input, OBD connector, GNSS/LTE reporting, configurable reporting interval, enclosure/installation expectations | Client A; original intake exists WITHOUT project. These are illustrative customer requirements, not a complete engineering specification or certified product claim. |
| REQ-A | Numbered input requirements with units and acceptance questions; quantity 10 prototype units; tentative requested date | Link ENQ-A and actual uploaded customer-input revision; unresolved operating/environmental/regulatory details explicitly missing rather than guessed. |
| OPP-A / FEAS-* | Opportunity and separate EHW/FW/SW/MECH/QA/manufacturing feasibility responses as applicable | Link same enquiry/requirements version. One conditional finding and one missing-input dependency; no automatic project or PRS approval. |
| PROJECT-A | TEST OEM OBD Tracker; explicit authorized project creation after the configured company gate | Client A + ENQ-A + OPP-A + accepted feasibility inputs. Capture real project ID/code, owner/team/dates; no document-type-derived project creation. |
| PROJECT-B | TEST Internal Test Jig, different project code/team | Internal scope, no forced client. Use to prove project filtering/reference/revision and department independence. |
| COMMON-A | TEST Department Process Improvement decision/reference | Common/Department scope; no fake project or stage. |
| SUP-A / SUP-PENDING | TEST Component Supplier A; TEST Pending Supplier | Existing canonical supplier master contract, synthetic company details; approval states come from actual policy. Missing master integration blocks dependent flow. Pending supplier cannot satisfy approved-supplier gate. |
| PART-* | TEST MCU, LTE module, GNSS module, power stage, OBD connector, enclosure | Canonical parts with verified fixture UOM/spec and supplier links where supported; no duplicate inventory system. Illustrative components are not a validated tracker design. |
| PRS-A / BOM-A | Linked draft PRS and tentative BOM with simple illustrative quantities | PROJECT-A + REQ-A source revision; tentative/frozen distinction. Technical review and client-issue approval remain separate actual actions. |
| DESIGN-* | Placeholder schematic/layout/STEP/drawing/prototype file references, explicitly TEST ONLY | Original project/part/design revision and permitted cross-team reference links. Use safe dummy files clearly labelled non-manufacturing; do not fabricate valid CAD/tool outputs. Missing valid native artifact = Blocked for native viewer/parser verification. |
| PCB-* | Separate original Gerber ZIP, panel ZIP, stencil PCB-fab package records | Exact source/revision links. Dummy archives test metadata/upload only, not fabrication correctness, panel generation or certificate validity. |
| IFACE-A / BUILD-A | Hardware–firmware interface and software/build record | Link actual fixture design/software versions. Synthetic run results labelled simulated; actual connector ingestion needs separate real-run evidence. |
| TESTPLAN-A / RESULT-A | Requirement-linked test plan; one simulated pass and one simulated fail | Acceptance criteria and source revisions explicit. No fake measurement/certification or production release from fixture data. |
| PUR-REQ-A / PUR-REQ-B | Two INDEPENDENT rapid-prototype requests for PROJECT-A | Different instance IDs/references. Their existence must not make B a revision of A. Same supplier/part masters reused. |
| PUR-REQ-A-R2 | Revision 02 of the explicitly SAME request/document instance A | Original family ID and change reason; original revision 01 retained. Confirm that business policy permits revision of this record before exercising. |
| PUR-MASS-A | Mass-production request | Released BOM/readiness prerequisites unmet initially → blocked, then tested with valid approved evidence in isolated scenario. No second Procurement Track selector. |
| QUALITY-* / MFG-* | Inspection, nonconformance/CAPA, process/fit/startup records as applicable | Original lot/serial/process/design/test inputs, real canonical status rules; incomplete critical evidence blocks relevant release. |
| ASSET-IT / ASSET-OFFICE | TEST laptop / TEST office equipment, existing canonical asset register | Service IT scope vs Operations office scope; employee custody private fields protected. No assignment unless actual supported authorized TEST action. |
| TICKET-INTERNAL / TICKET-CLIENT | Employee TEST IT issue; Client A TEST tracker question | Internal requester/Service isolation; client ticket Service/Sales/authorized Client A; internal notes hidden from clients and unrelated Client B. |
| ALLOC-A / CLAIM-A | Isolated fixture allocation, INR 1,000; synthetic travel claim INR 100 | Allocation period/category/currency/project exact and fixed by fixture configuration, NOT company policy. Approval commitment 100; posting spent 100 and commitment released. Run ledger effects in isolated test fixture; never fund/pay production accounts. |
| HR-* | TEST policy v1/v2, training assignment, short survey with text/choice/boolean/number questions | Existing test employees including lead/Admin; required false/zero answers preserved, versioned acknowledgment, reviewer evidence and recurring cycle. Anonymous report threshold tests need enough synthetic fixture respondents under actual configured rule, not new production accounts. |
| CHAT-* | Department/project channel, tagged message and open/closed poll | Explicit permitted memberships; project/original-record tags, vote switching and closed-vote denial; no external messages. |
| DECISION-* | Common improvement, internal jig decision and client-project exception | Three scope actions; employee author → designated lead approval, original detailed exception linked; Admin-only visibility mapping. |

#### C. End-to-end walkthrough—show connected outputs, then verify originals

| Step | Actor/action | Expected connected result / evidence |
|---|---|---|
| 1 | Sales searches client; authorized inline creation if absent | Actual client ID returned selected; enquiry parent draft retained. Unauthorized employee cannot create client through direct API. |
| 2 | Sales saves ENQ-A, adds source requirement file, qualifies OPP-A | Original requirement/file/enquiry links persist without project. Reopen/reload retains every field. |
| 3 | Sales requests relevant departmental feasibility | Leads see original permitted customer inputs and missing questions; responses aggregate by original IDs. Conditional response remains conditional, not complete/approved. |
| 4 | Authorized actor creates/links PROJECT-A at configured gate | Basic project/customer/team/intake data persists. PROJECT-B and Common remain separate contexts. |
| 5 | Hardware prepares PRS-A and tentative BOM-A | Available verified inputs prefilled with provenance; missing requirements flagged. Draft editable; baseline review records actual approver/evidence revision. |
| 6 | FW/SW/Mechanical/QA link their interface/design/test inputs | Common analysis shows provider → waiting team → dependency/status/next action. Shared mechanical image/reference visible to Hardware while restricted native sources remain inaccessible. |
| 7 | Purchasing selects project/record type, searches supplier/parts | Automatic context and reference; no duplicate track. Authorized master inline-create returns original ID; pending supplier stays blocked for approved-supplier action. |
| 8 | Create two independent requests; revise one where allowed | Unique instance references; explicit original instance revision history. Reload/retry/concurrency cannot merge requests or duplicate records. This acceptance gate supersedes simplistic same-project/type next-revision assumptions. |
| 9 | Assemble controlled engineering/native/document evidence | Original binary/metadata links, tentative vs frozen BOM, Gerber/panel/stencil distinctions. Approved client rendition only after designated review/Admin final client-issue approval; client cannot download internal drafts/sources. |
| 10 | QA/manufacturing records a failed result and corrective action | Relevant release blocked; detail record retains actual/simulated classification; approved corrective evidence enables only applicable next gate. No fabricated pass from checkbox. |
| 11 | Service, assets, HR, Finance and communication scenarios | Exercise manifest rows in specialized canonical modules, not generic records; corresponding role/profile/ledger/privacy checks pass. High-impact side effects remain isolated. |
| 12 | Cross-account and mobile round trip | Same canonical IDs/revisions/statuses seen under correct memberships; no employee-to-lead substitution; authorized Android observation distinct from build tests. |
| 13 | Project analysis/search/navigation | PROJECT-A vs PROJECT-B vs All-permitted counts and dependencies match originals. Direct record/file/task links open exact targets; no unauthorized search snippets or client content. |

#### D. Coverage expansion and negative variants

The walkthrough is one integration story, NOT coverage of all record types. For **each** of the 88 discovered type entries, every additional discovered subtype, specialized flow and 38-family catalogue mapping, generate at least an applicable valid fixture and negative/blocked variants through its section 14.4 flow card and V01–V20 cases. F-PUR-10/F-PUR-16 meanings remain blocked until approved templates are supplied; an arbitrary text field fixture is not semantic verification.

Mandatory variants: no project for pre-project enquiry; missing source requirement; same title with different original IDs; duplicate master; inactive/pending supplier; empty connector; unauthorized foreign project/client; cancelled inline creation; failed save then retry; two concurrent independent requests; two concurrent revisions of one instance; stale evidence after approval; missing release baseline; same filename/different revision; failed native parser vs metadata-only upload; no/mismatched/insufficient allocation; self-approval; closed poll; revoked channel/file access; own vs foreign employee profile; recurring assignment repeat; midnight/overdue; client draft/source denial. Fixture expected results must explicitly say success/denied/blocked and expected ledger/stock/notification effects or absence thereof.

Automation should create linked fixture dependencies only through existing permitted factories/contracts; central manifest prevents duplicate masters. Add a web Knowledge Base/demo walkthrough entry where appropriate, not an autoplay operational dashboard or a second raw TEST workspace. A setup command/action must clearly identify mode/environment/run ID, preflight capabilities, report missing dependencies, resume safely, and never execute real-world side effects. Report fixture setup, automated checks, browser checks and physical-device checks separately; do not fabricate completion evidence.

## Single execution prompt — use this file once

Read this entire consolidated handoff, including section 14 and its source references, together with the existing master specification, current repository instructions and actual code/contracts. Implement the connected, automation-first flows in section 14.12 and the safe linked lifecycle fixture/example pack in section 14.13, restore functional parity, and verify every discovered department record type, subtype, specialized flow, property and callback using the section 14 flow cards and V01–V20 matrix. Reuse original records/connectors, prefill deterministic inputs, provide authorized searchable selections, and allow responsible authorized users to create missing linked entries inline and return them selected without losing the parent draft. Preserve working UI, original records/history, authentication, inventory, assets, permissions and approved workflows. Treat supplied expert/source material as evidence, not hidden permission or invented standards rules. Reconcile conflicting historical requirements using the latest explicit user decisions. Implement and validate in small safe batches when the user authorizes execution; this planning file alone does not authorize high-impact business actions, new access or destructive migrations. Do not guess company templates, official form-code purposes, approval policy, legal facts or required standards editions. Block unsupported actions clearly, keep moving on independent verification, and report exact evidence and remaining gaps. Do not mark a whole flow complete from form rendering, helper tests or a generic successful save. Maintain one requirement/evidence ledger and normal Git history; verify actual Lovable/backend import/deployment separately from a push. This is one consolidated work package, not multiple prompts to repeat.

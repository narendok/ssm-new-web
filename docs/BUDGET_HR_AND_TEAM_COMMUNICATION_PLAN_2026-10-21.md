# Supporting source — budgets, people services and team communication

Date: 21 October 2026. **Historical feature requirements, not a seventh active plan.** The current shared decisions are in the [SSM One Master Plan](https://github.com/narendok/SSM-new/blob/main/SSM_ONE_MASTER_PLAN.md); platform delivery belongs in the web and Android subplans. Keep this source for the detailed acceptance cases still referenced by code comments. Where it conflicts with the newer master plan, the master plan wins.

The existing UI/inquiry checkpoint is a separate release. These new modules must not be silently bundled into that release or mistaken for completed functionality.

## 1. One shared model, different presentation

| Area | Web: administration and advanced work | Android: everyday work |
|---|---|---|
| Department budgets | Periods, categories, allocations, revisions/transfers, approval rules, forecasts, reports | Authorized department summary; own requests and status; authorized quick approvals |
| Travel/expense/asset requests | Full request, approval, procurement, claim and settlement registers | Create request, attach receipt/photo, track status, respond to queries, permitted approve/return actions |
| My Profile | Full employee self-service profile and permitted administration views | The same person's own letters, policies, trainings, surveys, requests and assigned assets |
| HR templates and letters | Approved templates, employee-field mapping, preview, review, final issue and version history | Request/view own letters, receive notices and acknowledge where required |
| Policies and training | Publish policy versions; build courses, quizzes and recurring assignment campaigns; competency matrix | Read/acknowledge assigned policy; view training, participate in quiz and see completion/renewal status |
| Forms and surveys | Create/version questions, validation, conditional sections, audience and schedules; permitted response analysis | Fill/submit assigned forms, answer survey, see own submission status |
| Chat, discussion and polls | Channel/audience administration, threads, advanced filters, poll creation, links to work, moderation and reports | Basic channels/messages, replies, attachments, mentions, voting, unread notifications and permitted search |
| Search and tags | Existing compact header search opens a popup; search/filter permitted records, documents and discussions | The same authorized search data; compact search entry and mobile-friendly results |

Both platforms use the same stable user/member, department, project and record IDs, approval outcomes, document revisions and search semantics. Web authors the advanced configuration; the app consumes it. A URL role, tag, mention, assignment or linked record never grants access.

## 2. Department budgets and expense requests

Budget ownership is a department; a project/cost centre may additionally be linked. Travel, HR administration and general department spending must not require an invented project.

| Record | Minimum content | Owner/control |
|---|---|---|
| Budget period | Financial year and chosen monthly/quarterly/annual period; currency | Finance configuration, approved by authorized Admin |
| Allocation | Department, optional project, category, approved amount, version and effective dates | Department lead proposes; Finance validates; designated approver authorizes |
| Revision/transfer | Original allocation, increase/decrease or source/destination, reason and approval | Separate auditable approval; never silently overwrite the original budget |
| Expense request | Requester, purpose, category, estimate/currency, department, optional project, required date, evidence | Actual signed-in employee, lead or Admin |
| Travel detail | Destination, dates, purpose, estimated transport/stay/other costs and requested advance | Request-specific form; no invented rates or automatic bookings |
| Asset detail | Required item/specification, quantity, replacement/new justification, required date | Link to existing asset, purchasing and inventory processes |
| Claim/settlement | Approved request, actual receipts/amounts, advance, excess/return, Finance posting/payment references | Employee submits actual evidence; Finance verifies and settles |

Initial categories can include travel, accommodation, local transport, consumables, equipment/assets, software/subscriptions, maintenance/services, and training. Finance can configure categories and distinguish operating expenditure from capital purchases; no thresholds, tax rates or allowances are invented by the system.

### Workflow

1. Employee/lead/Admin creates a request.
2. Department lead reviews business purpose and department allocation.
3. Finance validates budget, evidence and policy. Configured high-value, capital or over-budget exceptions go to Admin/designated authority.
4. Final approval creates an outstanding budget commitment atomically. A displayed estimate or a pending request is not actual spending.
5. Asset purchasing continues through the existing purchase/PO/receiving/asset assignment flow. An approved request alone does not create a received asset or mark a payment complete.
6. Actual invoice/claim is verified and posted by Finance; payment/advance settlement is tracked separately.
7. Cancellation, rejection, returns and settlement release or adjust the remaining commitment with an audit trail.

Budget display: **Available = approved allocation − posted actual expenditure − outstanding unposted commitments**. Posting an invoice reduces its reservation at the same time; paying that already-posted invoice must not deduct the budget again. Advances are tracked separately from final expense recognition. Currency conversion requires a recorded rate/source/date; do not combine currencies silently.

Final approval must recheck current available budget to prevent concurrent approvals overspending it. Finance decides any approved exception through the configured rule; a warning is not an approval. No requester approves/verifies their own claim: lead/Admin/Finance personal requests go to an authorized alternate.

## 3. My Profile for every internal person

Every employee, department lead, HR user and Admin has **their own** self-service profile. A management role does not remove personal employee functions.

| Profile section | What the person sees/does |
|---|---|
| My details | Own permitted employment/contact information; request correction; HR verifies controlled changes |
| My letters | Requested, draft-status and issued personal letters; download permitted final versions |
| My policies | Assigned policy versions, effective date, acknowledgment and pending deadline |
| My training | Assigned courses/sessions, material, quiz, actual attendance/completion, refreshers and evidence |
| My forms/surveys | Assigned forms, due dates, own submission status and permitted results |
| My requests | Expense/travel/asset and other configured employee requests with review history |
| My assets | Equipment assigned to that person, acknowledgment, condition and return request |
| My notifications | Upcoming/overdue activities, review outcomes and relevant mentions |

The employee's private documents are not visible to all colleagues because they share a department or chat channel. Lead views show operational team training/completion and requests within their authority. HR/Finance/Admin access is capability-based; sensitive personnel records are not exposed through a general directory, team view, or broad search.

## 4. HR letters and policies

Reuse the controlled document catalogue, company header/footer and private-file workflow. Do not create a second independent document vault.

| Item | Safe automation | Human control |
|---|---|---|
| Routine employment letters | Draft from approved template + verified employee fields; flag missing data; assign review task | HR reviews; designated Admin final release/sign-off by default; no automatic signature or issue |
| Confirmation/transfer/promotion/change letter | Prepare only from a recorded approved employment event | HR/authorized Admin confirms the underlying change before issuing |
| Experience/relieving/reference letter | Draft from verified tenure and approved details | Authorized review/issue; generated text is not proof of facts |
| Policy/SOP notice | Prepare audience, effective date, assignment and acknowledgment tasks from an approved version | HR/Admin approves publication and target audience |
| Training assignment/material | Generate assignments and approved material/template drafts | Trainer/owner confirms delivery and actual results |
| Training completion certificate/record | Populate from verified attendance and required assessment evidence | Authorized completion/release; never fabricate attendance or pass results |

An editable DOCX/XLSX/master draft is retained under revision control. Final approved output is a controlled PDF rendition in the recipient's profile, with issuer, approval, version and access history. A PDF format alone is not access control or guaranteed immutability. HR documents go to the employee/authorized staff, not the client portal. Routine assignment/reminder generation can be automatic; official letter release remains a real approval action.

Actual HR letter/policy templates, field mapping and final signer/delegation policy are required before enabling automated generation. Existing sample letterhead text is not an approved employee template pack.

## 5. Recurring training, policies, forms and surveys

| Configuration | Behavior |
|---|---|
| Audience | Selected employees, departments, teams or roles, including leads/Admin when applicable; resolve actual active memberships |
| Cadence | Configurable monthly/quarterly/annual/custom cycle, or joining/anniversary/approved employment-event trigger; examples are not mandatory company rules |
| Assignment | One occurrence per person/template version/cycle; repeated scheduler execution must not duplicate it |
| Deadlines/reminders | Recorded timezone, due date and configured reminder/escalation offsets; completion stops reminders; preserve manual overrides |
| Employee transfer/inactivity | Apply approved rules to future audience; revoke access appropriately; retain prior assignment/completion history |
| Policy acknowledgment | Tied to the exact published policy revision; publishing a revision does not rewrite older acknowledgments |
| Training | Course/session, owner, material, participation evidence, assessment rule, completion and optional refresher/expiry |
| Survey | Published questionnaire version, audience, open/close dates, response mode and results permissions |

Web form builder: text, number, date, single/multiple choice, rating, attachment and authorized project/record reference; required fields, validation, sections and conditional questions. Publish a version before assigning it; do not rewrite submitted answers when the form changes. App users fill the same schema rather than a separately coded questionnaire.

Survey privacy must be declared before launch. Identifiable responses have explicit access permissions. An anonymous survey needs genuinely separated response and completion tracking, no identity in results/search/export, and suitable small-group reporting controls; do not label an identifiable response table “anonymous.” Automated assignments never generate employee answers or attendance.

## 6. Team chat, discussion and polls

| Element | Proposed rule |
|---|---|
| Conversation scope | Named team/project/department, selected role audience, selected people or explicitly permitted multi-department group |
| Membership | Stable member IDs and server-validated access. Define whether an audience follows approved role membership or is an explicit member list; show its audience clearly |
| Conversation type | General, question, work update, issue, project discussion, expense/travel, training, survey or proposed decision |
| Structured links | Optional project/task/document/request/training IDs; reference original records, not copied attachments or invented authority |
| Tags | Normalized reusable keywords such as travel, asset, onboarding, training and project topics; optional controlled aliases |
| Mentions | Notify selected authorized participants; mentioning someone does not admit them to a private channel |
| Threads | Keep replies with the original topic; retain message ID, real sender and edit history where enabled |
| Polls | Audience, choices, single/multiple vote rule, closing time, result visibility and permitted privacy mode; enforce participation server-side |
| Work conversion | Explicit action can draft a task/request/official decision from a discussion and retain the source link; its normal owner/approval rules still apply |
| Formal approvals | Chat agreement, a reaction, or a poll result never replaces financial approval, document release or project stage sign-off |
| Notifications | Unread/mention and relevant activity notices; avoid revealing confidential message/document content in phone previews |

Removing a participant or changing their authority must revoke API, realtime and attachment access. A member may see a linked record only if separately authorized for that record. Confidential HR cases are separate restricted conversations, not general department channels. An Admin profile does not automatically imply silent access to every private conversation.

The Android repository already has Team/Chat and Search screen scaffolding, but its current chat send path appends to a local in-memory list. This must be replaced by a verified shared contract before claiming web/app chat synchronization. No production messages are to be seeded or broadcast as part of development testing.

## 7. Tags and shared search

Use one shared tagging/link model for records, documents, expense requests, HR activities and conversations. Keep tags, @mentions, record links and conversation type distinct; they serve different purposes.

- Search normal text, tag names/aliases, exact record references, permitted document metadata and authorized conversation content.
- Return source record/thread, project/department context where allowed, and a direct authorized destination. A tag result is not another copy of the record.
- Apply access checks **before** matches, snippets, counts, suggestions and facets are returned. Never download all HR/chat data and rely on a UI filter to hide it.
- Private salary/HR cases and raw survey answers are excluded from ordinary search; authorized specialist searches are separate where needed. Anonymous answers are not indexed as employee records.
- Linking a public conversation to a private file must not reveal that file's title/snippet/contents. File opening uses the existing authorized private download path.
- Recheck access on open/download and after account/role changes. Clear sensitive mobile caches on logout/context changes; confidential offline access needs its own explicit policy.

## 8. Roles at a glance

| Person | Department budgets/requests | Employee services | Chat/search |
|---|---|---|---|
| Employee | Own requests and outcomes; no implicit whole-department financial access | Own profile, issued letters and assigned policies/training/forms | Authorized channels and records only |
| Department lead | Own department budget/work requests; approval within configured authority; no self-approval | Own profile plus permitted team training/status; not blanket private HR files | Authorized department/project/team conversations |
| HR | Authorized HR records and campaigns; own personal requests | Templates/drafts, policy/training/form administration; controlled issue/review | Restricted HR conversations; only permitted search |
| Finance | Budget validation, commitments, verified actuals and settlement within authority | Own employee profile; no automatic access to all private HR responses | Authorized finance/request conversations |
| Admin | Company allocation/rules and configured exceptions; own claims use an alternate approver | Own profile and explicitly authorized HR approval/reporting | Authorized administration, not access granted merely by a tag/mention |
| Client | No internal budget, personnel or team-chat access | Only separately released client deliverables | Explicit client-facing scope, if later provided |

## 9. Implementation sequence

| Phase | Deliverable | Exit evidence |
|---|---|---|
| R0 | Finish existing UI/inquiry release checks; sync tested changes to GitHub and Lovable editor separately from these new features | Exact commit, regression results, role navigation/access checks, Git/Lovable revision confirmation; no claim of production backend certification |
| 1 | Shared profile identities, request/assignment records, permissions, controlled documents, tags and notification contracts | Authenticated server permission tests, real audit, account isolation and cross-platform read/write round trip |
| 2 | Department allocations and travel/expense/asset request through settlement | Budget concurrency, no double counting, alternate approval, receipt/private-file checks and web/app status agreement |
| 3 | Employee profile, template-driven HR letters and policy issue/acknowledgment | Correct recipient, verified fields, real review/release and revision-specific acknowledgment |
| 4 | Web form/survey/course builder and recurring campaigns | Versioned submissions, actual completion evidence, idempotent scheduler/reminders, declared response privacy and mobile completion |
| 5 | Shared channels/messages, mentions, polls and record/topic links | Participant isolation, membership revocation, message ordering/retry handling, vote rules and private attachment checks |
| 6 | Combined search, reports and operational hardening | No restricted snippets/counts, cross-platform search parity, account/cache isolation and end-to-end lifecycle tests |

Reuse existing Finance, HR, document, asset and Android screen structures where they fit, but do not confuse their current local examples with completed shared capabilities. Ship feature flags and reversible module-by-module releases; avoid another global layout/auth replacement.

## 10. Acceptance cases

1. Two concurrent expense approvals cannot spend the same available allocation.
2. Posting a reserved invoice, paying it, settling an advance or cancelling a request never double-counts expenditure.
3. A lead/Admin/Finance employee cannot approve their own personal request; the configured alternate receives it.
4. An employee cannot read another person's letters/claims/responses through direct IDs, search, tags, attachments or chat links.
5. Generated drafts identify missing verified fields; approved PDF release requires the actual signer and correct recipient.
6. A recurring campaign rerun creates no duplicate assignments/reminders; prior responses remain tied to their questionnaire version.
7. Claimed anonymous responses cannot be traced to a person in normal results, exports, search or completion views.
8. Training certificates cannot be issued merely because a task checkbox was clicked.
9. Chat mentions/links/polls never grant record access or approve an expense, document or lifecycle stage.
10. Channel membership revocation also removes message, realtime and private attachment access.
11. Web-created requests/forms and app submissions use the same IDs/outcomes; offline retries cannot duplicate records or votes.
12. Existing project/task/document, TEST identity and colored-layout regression checks still pass after each module release.

## Expense settings delivery — 4 November 2026

Shared TEST Budgets & Expenses now has company and department category/purpose settings (22 categories, 25 purposes), editable by Admin/Finance leads; Operations (OPS/HROPS leads) requires Admin enablement. The actual shared expense popup reads these options and supports Other purpose details. One fictional INR 1,250 request saved and survived reload as Pending Finance. TypeScript/build/whitespace checks passed; unauthorized SW settings write was rejected. Verification screenshots/reports were intentionally removed from the repository; Android/hosted parity remains unverified. Earlier claims that the shared submission path was blocked were based on a separate legacy local modal and are superseded.

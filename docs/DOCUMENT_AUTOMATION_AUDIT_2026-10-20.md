# Document automation and audit coverage review

Reviewed: 20 October 2026. Analysis/implementation specification only. Source workbook and portal code were not edited. No documents were generated as approved evidence; no backend or permission changes deployed.

## Result and source coverage

| Source | Inventory / interpretation |
|---|---|
| Design Devlopment Support | 128 document-name rows, across 11 source department groups |
| Production & Assembly | 18 document-name rows |
| Audit checklist | 40 evidence/activity request rows; separate audit mapping, not extra unique documents |
| Inventory total | 146 source entries; preserve project variants and repeated monthly reports |
| Actual templates | No individual DOCX/XLSX templates included; template eligibility only until the originals are supplied |
| Existing portal reference | 38 logical document families; coverage does not prove all subtypes/forms/generators are implemented |

| Mode | Count of inventory rows | What the portal can do | What people/providers must do |
|---|---:|---|---|
| G - Template draft | 57 | Prefill an editable DOCX narrative/plan/policy from verified master/project data | Supply approved template; author missing content, verify, review and approve |
| H - Evidence-backed draft | 82 | Prepare editable XLSX/DOCX register, checklist, report structure, calculations and permitted source-linked fields | Supply actual readings, observations, scores, findings, historical data, drawings and decisions |
| U - Original upload | 7 | Record metadata, reference, revision and provenance; optionally draft a cover/index | Upload original specialist artifact/presentation; no automatic regeneration assumed |

These counts classify source rows, not unique templates. The 7 U inventory entries are four schematic/layout PDFs, two architecture diagram JPGs and one existing handbook PPT. The audit agenda additionally requests certificates, signed agreements and OEM-issued outcomes; those external originals are listed separately below. The source format alone is not the classifier: an internally authored PDF policy can have a DOCX master, while a schematic PDF comes from an engineering tool.

## Confirmed clarification: project names and external engineering outputs

VTU and XLC identify example products/projects, not reusable document types. The source workbook uses VCU for one example; retain that source wording for audit traceability without changing real project identifiers. The reusable register removes these example names from the document-type field. Different projects use the same document type/template with their own project metadata, revision and approvals. Schematic and PCB layout each remain one reusable type, irrespective of how many product examples appear in the workbook.

| Reusable upload type | Original files | Origin |
|---|---|---|
| Schematic | EDA native package and PDF export | Design software / outsourced provider |
| PCB layout | EDA native package, manufacturing exports and PDF preview | Layout software / outsourced provider |
| PCB fabrication - Gerber package | Gerber ZIP | PCB design/CAM software / outsourced provider |
| PCB fabrication - panelized Gerber package | Panel Gerber ZIP derived from the approved board Gerber revision | Panelization/CAM software / outsourced provider |
| PCB fabrication - stencil package | Supplied stencil fabrication files/package; paste-layer Gerber where applicable | PCB/CAM or stencil software / outsourced provider |
| Certification / external report | Authentic issuer original, usually PDF | Certification body / outsourced laboratory or provider |
| Mechanical drawing | Native drawing and PDF export | Mechanical design software / outsourced provider |
| Mechanical 3D model | STEP / STP and applicable native CAD source | Mechanical CAD software / outsourced provider |
| Prototype mesh | STL | CAD/prototyping software / outsourced provider |
| Prototype / fabrication profile | DXF | CAD/fabrication software / outsourced provider |

These are external-source uploads. The portal manages project association, metadata, version, review, approval, evidence links and permitted previews; it does not generate the engineering model, fabrication file or issuer certification. These types are requirements even where the workbook has no individual row for them. Architecture diagrams and legacy presentations remain additional original-upload cases. Do not interpret the seven raw U inventory rows as the number or limit of reusable upload types.

Group Gerber ZIP, panel Gerber ZIP and stencil files under PCB Fabrication Files. Keep each as a separately versioned artifact linked to the same project and PCB revision, with panel/stencil packages referencing their source Gerber package revision. Upload these actual outputs from the relevant software/provider; retain the original ZIP/file rather than replacing it with a PDF. A fabrication summary or preview may accompany the package. Native package sharing remains subject to explicit recipient permission.

Generated DOCX/XLSX documents retain one canonical editable master and follow Admin-approved PDF release. Uploaded STEP/STL/DXF/native files retain their originals; a PDF/image preview is a linked rendition and cannot replace the actual engineering file. Client document viewing uses the authorized PDF rendition; delivery of native engineering files requires separately authorized sharing.

## 1. Requested controlled document lifecycle

| Step | Editable source / output | Required control |
|---|---|---|
| Template setup | Controlled DOCX or XLSX template, version and field mapping | Department owner maintains draft template; authorized approval before activation |
| Prepare | One authoritative editable document instance revision; generate from approved template and permitted source records | Record source IDs/revisions; leave missing/conflicting inputs explicit; never invent measurements/signatures |
| Edit | Author/assigned employee edits permitted content; native upload fallback is available | Preserve edits during refresh; regenerate only deliberate sections or new revision |
| Department review | Lead verifies content, evidence and confidentiality; return for corrections if needed | Review is bound to the exact instance/template/source revision |
| Final approval | Admin approves the exact revision for finalization | Any subsequent content/source change invalidates approval for the changed revision |
| Produce PDF | Convert the approved frozen editable source to PDF; inspect pages/tables/diagrams | PDF and source hashes, conversion status and approval receipt linked; conversion failure blocks release |
| Client release | Release only eligible PDF to the explicitly authorized client/project/recipient | Admin approval alone is not automatic client publication; no client source-DOCX/XLSX endpoint |
| Revise | New editable revision; prior released PDF preserved or visibly superseded | Re-review, Admin reapproval and new release; no overwriting old approved files |

The editable source remains internally retained under controlled permissions. 'Non-editable' means no editing through the client portal and no editable original delivered by this workflow; ordinary PDFs can still be copied/altered outside the portal. Do not claim tamper-proof protection. A checksum/release receipt and optional authenticity verification help identify the authoritative version. Any signature mechanism must be real, not an inserted signature image or fabricated approval label.

For XLSX documents, retain real formulas, typed dates/units, validation, totals and print areas in the editable source; the approved PDF is a frozen presentation, not a substitute for internal calculations. Freeze the applicable as-of date and source-data snapshot so a later live refresh cannot silently change an approved release.

For uploaded external certificates, keep the issuer's original bytes, signature and scope. Internal verification/Admin release may authorize client access to that original PDF but cannot make it a newly issued certificate. Native drawings, CAD, firmware and ZIPs remain controlled originals; a PDF preview is a separate rendition and may not contain all source information. Native delivery exceptions require explicit separate permission, not a silent exception to PDF-only client viewing.

## 2. Separate manually uploaded evidence types

| Type | Examples / checklist source | Portal-generated part | Required original |
|---|---|---|---|
| External certification | Environmental certificate (Audit row 17), QMS certificate (row 18); licence tracker (Design row 9) | Applicability, issuer, scope, number, validity, expiry reminder and evidence index | Issuer certificate PDF; if not obtained, actual plan/status rather than claimed certification |
| Calibration / lab evidence | Calibration list (Production row 12); gauge evidence (Audit row 33); outsourced test facilities (row 38) | Instrument/test register, due dates, internal report cover and results copied from verified data | Actual provider calibration/test report and attachments |
| Specialist engineering files | Design rows 59,64,78-80,82; audit engineering/prototype rows 37-38 | Design review/requirements/BOM/index drafts | Engineering-tool schematic/layout/CAD/diagram exports and relevant native sources; real simulations/builds/results |
| Signed external agreements | JV/ownership evidence (Audit row 8), aftermarket/OEM agreement (row 28), maintenance agreement (row 34), supplier agreements (row 42) | Editable internal agreement draft/index and status tracker | Actually executed agreement; approvals do not fabricate legal execution |
| External audit/OEM outcomes | Audit rows 4,40,44-45 | Agenda, evidence packet, response/action tracker | Actual OEM score, auditor conclusion and issued report |
| Customer/supplier responses | Audit rows 12,15,22,25-26,42-43 | Questionnaire, complaint/SCAR/scorecard draft and summary | Actual received response, acknowledgement, EDI receipt or supplier PPAP content |
| Operational proof | Actual attendance, training, production/test/cleaning/maintenance/security observations | Form/register plus summaries from valid records | Actual event entries, readings, images, acknowledgements and human verification; never auto-mark performed |

An internal employee handbook listed as PDF is not automatically an external-upload-only document: generate a controlled DOCX source and approved PDF if a template is supplied. The existing PPT row remains upload/native until a PPTX generator and presentation template are specifically included.

## 3. Comparison with portal plan and inspected source

| Finding | Existing reference / source | Required completion |
|---|---|---|
| Logical catalogue coverage exists | Existing 38-family catalogue maps broadly to the checklist | Register each exact checklist subtype/project variant; preserve every source row instead of claiming 146 templates already exist |
| Drafting is a partial foundation | document-draft.ts defines structured fields, missing values, template version and unissued snapshots | Build real per-template DOCX/XLSX field bindings and verification; template names do not prove native editable export |
| Checklist is not template pack | Workbook names DOCX/Excel/PDF artifacts but does not contain their layouts | Obtain actual templates; inventory versions, required fields, tables, formulas, print areas and images |
| Editable versus PDF lifecycle is not proved end-to-end | Existing docs discuss review/release; draft builder returns Unissued; client UI includes DOCX/XLSX sample links | Enforce Admin-approved exact-revision PDF-only release server-side, remove source-file sample downloads from released client routes |
| Approval and publication must be separate | Recent shared TEST core handles evidence-bound decisions; no reviewed universal document-render/release acceptance shown | Dedicated document review/approval/conversion/release contract and tests, without changing routine task/stage authorities |
| Download fallback needs review | controlled-documents.functions.ts falls back to direct file query when get_controlled_file_access is denied or fails | Eliminate authorization bypass/fallback semantics; enforce recipient, release, MIME/role and exact rendition in one checked contract; validate storage RLS too |
| Native uploader/index exists as a foundation | Controlled document private-file upload/list/download adapters | Upload provenance/issuer validation, file scanning/quarantine, immutable revisions, allowed-type/size checks and release verification |
| Domain forms remain partly local | Preserved legacy UI and local draft snapshots are explicitly browser-local | Connect actual project/department/record/source IDs before claiming shared document automation |
| Audit evidence is more than forms | Audit agenda requests multi-year trends, implementation evidence, actual review and provider/OEM results | Evidence-completeness matrix and source snapshots; no report-only or AI-only 'pass' |
| Access is not blanket publication | HR, financial, security and source design information are confidential | Distinct internal/audit/client projections; Admin finalization does not make every document client-visible |

The classification is grounded in the supplied inventory and existing target catalogue. Exact field/formula/template compatibility, live generation and released client-file denial were not executed in this review. No compliance certification or legal sufficiency is asserted.

## 4. Data-quality and ownership gaps to resolve

| Source issue | Required handling |
|---|---|
| Design sheet row 1 column A says Admin, followed by section labels and numeric indexes | Carry forward only recognized section names; retain source section/row alongside proposed canonical owner |
| 'EM & MM' and 'E & M Manufacturing' | Proposed EMF/MMF owners, QA review; split by actual process applicability; do not assume in-house SMT/PCBA scope |
| Firmware section includes software-named templates and product variants | Keep FW ownership for now; confirm actual product owner before remapping to SW |
| Software rows 119 and 128 both name a Helios verification document | Possible duplicate/mislabel (row 128 follows Amatya PRD); preserve both pending owner confirmation |
| Source IDs/titles have inconsistent spellings and encodings | Preserve raw source wording and legacy IDs; create reviewed display aliases, not destructive renaming |
| Monthly report entries Apr-Aug 2026 | One controlled monthly-report template with period-specific instances; no invented values for other periods |
| Handbook appears as PDF and PPT | Separate output roles; common content should derive from approved source, not uncontrolled duplicate copies |
| Financial/survey/PPM/capacity trends require historical actuals | Define time window, numerator/denominator, units and zero-versus-missing; do not create historical results from templates |
| Source QMS level/review status columns | Retain recorded labels; blank review status/remarks does not mean reviewed or approved; classification does not validate the taxonomy |
| Common versus project context | Policies/templates in Common & Standards; project evidence stays linked to its project; non-project operations stay in Department Operations & References |

## 5. Implementation sequence (not deployed)

| Priority | Package | Acceptance evidence |
|---|---|---|
| 1 | Actual template collection + exact subtype/owner/access register | Every inventory row mapped; original templates identified or missing explicitly |
| 2 | DOCX/XLSX draft generation and manual upload fallback | Real editable outputs preserve layout/tables/formulas; no fake results; source/revision traceability |
| 3 | Department review and Admin finalization | Employee cannot self-approve; lead review and Admin exact-revision receipt; stale/concurrent edits invalidate approval |
| 4 | PDF rendition service and immutable release | First/last/wide pages verified; errors block release; bytes/hash/revision match approved source |
| 5 | Client-view contract | Only released PDF for explicitly allowed client; guessed IDs/source file requests denied; no cross-client/revoked access |
| 6 | Audit evidence and reminders | Real issuer/expiry/measurement evidence linked; missing evidence shown; no automatic pass or certification |

## 6. Release verification checklist

- Verify source template + instance + source-data revisions are frozen together.
- Retain editable internal source while client endpoints expose only authorized final PDF rendition.
- Check approvals bind author/reviewer/Admin identities and exact revision/checksum, never a free-text name.
- Deny draft/rejected/superseded/revoked releases and unauthorized cross-department/client requests.
- Test DOCX/XLSX source download denial for client, even by direct file ID/storage path.
- PDF conversion must succeed and preserve content; formulas, wide matrices, images and pagination must be inspected.
- No automatic email sending or external publication; client release is a distinct authorized action.
- Revisions after approval require a new review/finalization; historical issued PDFs remain traceable.

Detailed inventory and agenda mapping: [Document automation register](DOCUMENT_AUTOMATION_REGISTER_2026-10-20.md). Structured version: [JSON register](DOCUMENT_AUTOMATION_REGISTER_2026-10-20.json).

## Sources inspected

- Supplied workbook: `C:\Users\Test\Downloads\Smart Company document management system audit checklist .xlsx`. SHA-256: `c69eb31c1d17e94e7d3794c025201ad7822951e7bbce5191275da94ff820092c`.
- Canonical catalogue: [SSM One Document Catalogue](https://github.com/narendok/SSM-new/blob/main/SSM%20One%20Document%20Catalogue%20-%20Auto-Drafting%20Audit%20and%20Native%20Upload%20Rules.md) and its source mapping JSON in the planning repository (38 logical families, target/reference only).
- Current requirements: the [cross-platform master plan](https://github.com/narendok/SSM-new/blob/main/SSM_ONE_MASTER_PLAN.md), the [web implementation plan](../SSM_ONE_WEB_IMPLEMENTATION_PLAN.md), and the single [document catalogue](https://github.com/narendok/SSM-new/blob/main/SSM%20One%20Document%20Catalogue%20-%20Auto-Drafting%20Audit%20and%20Native%20Upload%20Rules.md). This audit remains historical evidence.
- Inspected code: `src/lib/document-catalogue.ts`, `src/lib/document-draft.ts`, `src/lib/controlled-documents.functions.ts`, `src/components/ClientOEMPortal.tsx`, relevant document UI sections in `src/routes/index.tsx`.

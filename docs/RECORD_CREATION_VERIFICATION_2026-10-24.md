# Record creation regression repair — 24 October 2026

The authenticated shared workspace had replaced the original department record-type selector with a free-text input and omitted department-specific fields. DEMO still used the earlier form, which explained the inconsistent Purchasing/Hardware experience.

## Delivered

- Extracted the existing department form specifications into one catalogue used by DEMO and both shared record creation editors.
- Restored controlled record-type selection and department-specific fields in the compact shared popup and alternative register editor.
- Saved applicable fields, validated required fields and configured choices, and excluded hidden fields belonging to other types.
- Reopening the original shared record now exposes its department-specific editable fields.
- Unknown department catalogues fail closed; MMF has manufacturing records instead of falling back to Hardware.
- Task and project creation retain their separate shared actions and existing permissions. No migration or permission changes.

## Evidence

- 136 web tests passed, including 13 additional catalogue regression cases covering all 12 current departments, every configured type, required fields, choice validation, aliases, PRS field handling and unrelated-field exclusion.
- TypeScript check passed; production build passed.
- Actual Purchasing TEST session: created `HLPL-OBD0374783-PUR-VERIFY-01`, titled `TEST record selector verification`, under the existing synthetic OEM OBD tracker project. Selected `Mass production request` and procurement track `Mass production`.
- Shared save succeeded. Reload retained the record/type; reopening its original record showed procurement track `Mass production` and the verification notes.
- No supplier, approval, purchase order, allocation or payment was created. The synthetic record remains Draft.

## Limits / remaining functional work

- This is not a claim of live create/save testing for every type under every department account. Catalogue and field validation coverage is automated; the live persistence round trip was Purchasing.
- Shared generic records currently require an existing project. Pre-project enquiry/opportunity and feasibility intake must use a dedicated source-linked workflow; forcing a dummy project is not acceptable. That end-to-end flow is not verified complete by this repair.
- A PRS title alone does not compile customer requirements, establish feasibility or freeze an approved baseline. Source linkage and approval provenance need end-to-end verification.
- Authenticated master fields must use real configured shared master data; DEMO supplier/location names must not be substituted. Fields without a shared master source currently accept explicit manual values.

## Workflow interpretation

Enquiry → opportunity → feasibility → explicit project gate → controlled requirements baseline is a reasonable company workflow. Customer requirements must already be available for feasibility; a PRS draft may develop during feasibility. Exact CRM labels and the project-creation point are company rules, not a universal mandatory sequence.

Primary reference: [AIAG — Helpful Documents in the APQP Process](https://blog.aiag.org/helpful-documents-in-the-apqp-process).

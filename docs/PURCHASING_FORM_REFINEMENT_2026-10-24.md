# Purchasing form refinement — 24 October 2026

- Rapid prototype request and Mass production request imply their procurement tracks; the duplicate field is hidden and the derived value is saved. Other Purchasing types retain an explicit track choice.
- Both shared editors use a searchable supplier selector populated only by accessible Supplier records. The shared snapshot currently exposes no dedicated supplier master contract; no DEMO or inferred supplier list is imported. Empty state explicitly identifies the missing shared master connection. Supplier-master integration remains incomplete.
- Revision choices are scoped to the same controlled reference family, not all records of a type or all projects. A new reference starts at 01; existing family revisions suggest the next number. Editing offers current and next revisions. Numeric trailing reference revisions are updated to match creation payloads. Backend conflict/approval validation remains authoritative; this is not a new server-side revision allocator or reservation mechanism.
- Purchasing's current authenticated snapshot contains one permitted project. This does not establish whether unexposed projects exist elsewhere. The selector shows its available count; no DEMO projects are added to TEST.

Verification: 139 automated tests passed; TypeScript and production build passed. Browser confirmed the duplicate track field is absent for Rapid prototype request, supplier search opens, and new-reference revision displays 01 / Initial revision. The user's existing draft was preserved; no new business record, supplier or revision was submitted in this refinement.

Existing broader parity findings in REGRESSION_PARITY_AUDIT_2026-10-24.md remain open. This focused refinement does not claim to resolve them.

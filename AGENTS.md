# Antigravity Agent Guidelines: XYZ Pvt Ltd SCMS

## Execution & Tool Permission Rules
- **Allow All Operations**: The user has granted full blanket permission for this project. Execute all commands, file updates, and browser automation tasks autonomously without blocking for manual confirmations.
- **Automotive Integrity**: Ensure all generated models and documentation strictly follow IATF 16949:2016, ISO 9001:2015, AIS-140, and AEC-Q100 standards.
- **Naming Standard**: Strictly adhere to `HLPL-[PROJ_ID]-[DEPT]-[DOC_TYPE]-[REV]`.
- **Hosting direction**: The user paused Lovable synchronization/deployment. Do not publish or rely on a Lovable preview for acceptance until the user resumes that path.

<!-- SHARED-GIT:BEGIN -->

> [!IMPORTANT]
> Avoid rewriting published Git history — force pushing, or rebasing/amending/squashing
> commits already pushed to a shared repository can disrupt collaborators and connected tools.
>
> Do not assume a Git push deploys or updates a hosted preview. Verify hosting separately
> and only deploy when the user has directed that hosting path.

<!-- SHARED-GIT:END -->

## Portal Runtime
- Keep fictional interactive walkthroughs and replaceable demo fixtures in a versioned browser-local store. Label them as local examples; they do not represent shared account data.
- Authenticated Shared TEST records, approvals, settings and controlled documents use the secured shared database and Supabase Storage contracts. Never silently fall back to local writes when shared persistence fails.
- Portal record forms use structured fields, controlled master options and explicit record links so saved data stays traceable without inventing business facts.
- Keep local demo state separate from configured operational and authenticated TEST data; demo reset must not affect either.
- Department ownership and access authority come from authenticated membership and server-side permissions. Browser role query parameters and presentation filters never grant access.
- Private controlled-document binaries use Supabase Storage; server functions create short-lived signed upload/download links only after authenticated database policies authorize the department-scoped document.
- Model department hubs through a canonical SCMS area map, migrating legacy browser-local area IDs at read time so existing records remain usable.
- Keep interactive lifecycle walkthroughs and competency examples in the replaceable DEMO browser-local state, so feature tests never affect configured operational records.
- Keep demo task, project, alert, and document samples inside the replaceable browser-local DEMO state so no illustrative activity can affect configured operations.
- Present connected workflow recommendations as derived, human-reviewable actions; auto-draft templates remain clearly marked DEMO drafts until a person saves and approves them.
- Keep TEST email/password access separate from browser-local DEMO state: derive its persona only from an authenticated active membership in the dedicated TEST organization.
- Provision synthetic TEST identities only through a server-only administrative utility; it must be idempotent and must never create a public provisioning endpoint.

## Android Companion Handoff
- For Android companion work, read `docs/ANDROID_ANTIGRAVITY_HANDOFF.md` and master plan §25 before changing app code.
- The Android Studio project currently resides at `C:\Users\Test\Documents\GitHub\SSM-new-app`; it is a separate Git repository (`https://github.com/narendok/SSM-new-app.git`) and is not inside this SSM-new web workspace. Do not assume Android source changes are synced with this folder's Git repository.
- Current web and Android local TEST target: Supabase project `jiqbxcqlywvvmhbgirzl` (`https://jiqbxcqlywvvmhbgirzl.supabase.co`). Web local env and Android TEST config should use this same project. Historical backend evidence naming `rzskhndweihuczbdhoxk` must remain dated historical evidence. Never put publishable keys or privileged credentials in tracked files.
- Keep safe-view reads, stock RPCs, local-role elevation, and private document links fail-closed until the schema, RLS permissions, and authenticated signed-URL path are verified. A local prototype mutation is not a portal sync.
- After Android source changes, run `testDebugUnitTest assembleDebug` from the Android project using Android Studio's bundled JDK, then report the outcome and any remaining integration gates.

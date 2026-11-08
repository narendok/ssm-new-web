const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const route = fs.readFileSync(path.join(root, "src/routes/index.tsx"), "utf8");
const clientPortal = fs.readFileSync(
  path.join(root, "src/components/ClientOEMPortal.tsx"),
  "utf8",
);
const localTestWorkspace = fs.readFileSync(
  path.join(root, "src/components/LocalTestWorkspace.tsx"),
  "utf8",
);
const localTestWorkspaceHelper = fs.readFileSync(
  path.join(root, "src/lib/local-test-workspace.ts"),
  "utf8",
);
const sharedTestScreen = fs.readFileSync(
  path.resolve(root, "../ssm-new-app/app/src/main/java/com/example/myapplication/ui/screens/SharedTestScreen.kt"),
  "utf8",
);
const sharedTestWorkspace = fs.readFileSync(
  path.join(root, "src/components/SharedTestWorkspace.tsx"),
  "utf8",
);

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("URL role=client selects presentation only; verified release still requires TEST membership", () => {
  assert.match(route, /const \[testMembership, setTestMembership\] = useState<TestMembership \| null>\(null\)/);
  const roleSelection = between(route, "const initialRole =", "const safeUnassignedPersona");
  assert.match(roleSelection, /new URLSearchParams\(window\.location\.search\)\.get\("role"\)/);
  assert.match(roleSelection, /normalizePersonaId\(urlRole\)/);
  assert.doesNotMatch(roleSelection, /setTestMembership|grant|authorized release/i);

  const membershipResolution = between(
    route,
    "const resolveTestMembership = async",
    "const handleTestLogin = async",
  );
  assert.match(membershipResolution, /await getTestMembershipFn\(\)/);
  assert.match(membershipResolution, /setTestMembership\(membership\)/);

  assert.match(
    route,
    /<ClientOEMPortal demoMode=\{!testMembership && portal\.demoLoaded\}/,
  );
  assert.match(
    clientPortal,
    /if \(!demoMode\) return[\s\S]*?No verified customer release is available in this workspace/,
  );
});

test("client-facing data remains gated until authenticated session verification completes", () => {
  const pendingGate = route.indexOf('if (!testAuthReady) return');
  const authErrorGate = route.indexOf("if(testAuthError)return");
  const signedOutGate = route.indexOf("if (signedOut) return");
  const clientRender = route.indexOf("persona.kind === \"client\" ?", signedOutGate);

  assert.ok(pendingGate >= 0);
  assert.ok(authErrorGate > pendingGate);
  assert.ok(signedOutGate > authErrorGate);
  assert.ok(clientRender > signedOutGate);
  assert.match(route.slice(pendingGate, authErrorGate), /Checking authenticated session/);
  assert.match(route.slice(authErrorGate, signedOutGate), /No local examples are used/);
  assert.match(route.slice(signedOutGate, clientRender), /Sign in with a provisioned TEST account/);
});

test("client preview uses a fictional in-portal test card and never exposes sample releases", () => {
  const emptyState = between(route, "const emptyPortal = (): PortalState => ({", "const demoPortal =");
  assert.match(emptyState, /demoLoaded: false/);
  assert.match(route, /demoLoaded: value\.demoLoaded === true/);
  assert.match(
    route,
    /<ClientOEMPortal demoMode=\{!testMembership && portal\.demoLoaded\}/,
  );

  assert.match(
    clientPortal,
    /if \(!demoMode\) return[\s\S]*?No verified customer release is available in this workspace/,
  );
  assert.match(clientPortal, /TEST DATA · FICTIONAL PROJECT VIEW/);
  assert.match(clientPortal, /Northstar Mobility Systems · Fleet Gateway feasibility/);
  assert.match(clientPortal, /No customer-facing documents have been released/);
  assert.match(clientPortal, /if \(demoMode\) return/);
});

test("legacy signed-release sample gallery is unreachable from the client preview", () => {
  const demoGuard = clientPortal.indexOf("if (demoMode) return");
  const oldGallery = clientPortal.indexOf("const deliverables: DeliverableDoc[]");
  assert.ok(demoGuard >= 0 && oldGallery > demoGuard);
  assert.match(clientPortal.slice(0, oldGallery), /No customer-facing documents have been released/);
  assert.match(clientPortal.slice(0, oldGallery), /no customer acceptance, executed agreement, issued invoice, shipment, certification or approved release/i);
});

test("the normal portal is the sample-data experience; the standalone browser-local shell is not in navigation", () => {
  const vaultBranch = between(
    route,
    ') : view === "vault" ? (',
    ') : view === "index" ? (',
  );
  assert.match(vaultBranch, /Documents &amp; Vault/);
  assert.match(vaultBranch, /<HardwareDeliverablesDrive/);
  assert.doesNotMatch(route, /LocalTestWorkspace|localTestWorkspaceOpen|Open browser-local TEST Documents|label="TEST Workspace"/);
  assert.match(route, /portal\?\.demoLoaded && !testMembership/);
  assert.match(route, />TEST DATA<\/span>/);
  assert.match(route, /label="Reset sample"/);
  assert.equal((route.match(/label="Reset sample"/g) || []).length, 1, "sample reset has one portal location");
  assert.match(route, /persona\.kind === "admin" && <Action label="Reset sample"/);
  assert.doesNotMatch(route, /label="Reset sample data"|onResetDemo/);
  assert.match(route, /label="Shared TEST data"/);
  assert.match(route, /<DemoDataPanel loaded=\{portal\.demoLoaded\} onLoad=\{onLoadDemo\}/);
  assert.match(localTestWorkspace, /id="local-test-documents-register"/);
  const sampleSeed = between(route, "const demoPortal = (): PortalState => {", "const createId =");
  assert.match(sampleSeed, /sampleDataVersion: 3/);
  assert.match(sampleSeed, /\["XYZ Pvt Ltd", "Northstar Mobility Systems"\]/);
  assert.match(sampleSeed, /Northstar Mobility Systems \(fictional\)/);
  assert.match(sampleSeed, /\(key === "status" \|\| key === "lifecycle" \|\| key === "outcome"\)/);
  assert.match(route, /value\.demoLoaded === true && value\.sampleDataVersion !== 3/);
  assert.match(sharedTestWorkspace, /sync_canonical_sample_pack/);
  assert.match(sharedTestWorkspace, /p_run_id: "LC2-2026-10-28"/);
  assert.match(sharedTestScreen, /sync_canonical_sample_pack/);
  assert.match(sharedTestScreen, /put\("p_run_id", "LC2-2026-10-28"\)/);
});

test("sample banner and reset stay out of authenticated account views", () => {
  assert.match(route, /if \(testMembership\) \{ setNotice\("This view contains browser-local examples\./);
  const headerActions = between(route, "{portal\?\.demoLoaded && !testMembership && (", "<PersonaSwitcher");
  assert.match(headerActions, />TEST DATA<\/span>/);
  assert.match(headerActions, /persona\.kind === "admin" && <Action label="Reset sample"/);
  assert.match(headerActions, /!testMembership/);

  const authenticatedVaultBranch = between(
    route,
    ') : view === "vault" && testMembership ? (',
    ') : view === "vault" ? (',
  );
  assert.match(authenticatedVaultBranch, /<SharedDocumentVault/);
  assert.doesNotMatch(authenticatedVaultBranch, /browser-local|TEST DATA · THIS BROWSER/);
});

test("local register storage remains separate from authenticated document and upload contracts", () => {
  assert.match(localTestWorkspace, /localStorage\.getItem\(LOCAL_TEST_WORKSPACE_STORAGE_KEY\)/);
  assert.match(localTestWorkspace, /localStorage\.setItem\(\s*LOCAL_TEST_WORKSPACE_STORAGE_KEY/);
  assert.doesNotMatch(localTestWorkspace, /supabase|fetch\(|XMLHttpRequest|useServerFn/i);
  assert.doesNotMatch(localTestWorkspaceHelper, /supabase|fetch\(|XMLHttpRequest|https?:\/\//i);
  assert.match(localTestWorkspaceHelper, /Selected locally · not uploaded or shared/);
  assert.match(localTestWorkspace, /selected locally, not uploaded\/shared/);
});

import { recordFormSpec, recordFields, recordFieldValues } from "@/lib/record-form-catalogue";
import type { StageGateInput } from "@/lib/operational-gate.schema";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedTestWorkspace, mutateSharedTestWorkspace } from "@/lib/shared-test.functions";
import { advanceOperationalStageGate } from "@/lib/operational-gate.functions";
import {
  beginControlledDocumentUpload,
  completeControlledDocumentUpload,
  getControlledDocumentDownload,
  listControlledDocumentFiles,
} from "@/lib/controlled-documents.functions";
import type { SharedJson, SharedTestAction, SharedTestSnapshot } from "@/lib/shared-test.schema";
import type { TestMembership } from "@/lib/test-auth.functions";

type Tab = "Projects" | "Records" | "Tasks" | "Approvals" | "Documents" | "Activity";
const tabs: Tab[] = ["Projects", "Records", "Tasks", "Approvals", "Documents", "Activity"];
const taskStatuses = ["Open", "In Progress", "In review", "Complete"];
const input = "rounded-md border border-input bg-background px-3 py-2 text-sm";
const button =
  "rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-40 hover:bg-accent";
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—";

export function SharedTestWorkspace({
  membership,
  onLogout,
  darkMode,
  initialTab = "Tasks",
}: {
  membership: TestMembership;
  onLogout: () => Promise<void>;
  darkMode: boolean;
  initialTab?: Tab | undefined;
}) {
  const load = useServerFn(getSharedTestWorkspace),
    write = useServerFn(mutateSharedTestWorkspace),
    advance = useServerFn(advanceOperationalStageGate);
  const beginUpload = useServerFn(beginControlledDocumentUpload),
    completeUpload = useServerFn(completeControlledDocumentUpload),
    download = useServerFn(getControlledDocumentDownload),
    listFiles = useServerFn(listControlledDocumentFiles);
  const query = useQuery({
    queryKey: ["shared-test-workspace", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const [tab, setTab] = useState<Tab>(initialTab),
    [projectId, setProjectId] = useState("all");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [form, setForm] = useState<SharedTestAction | null>(null),
    [values, setValues] = useState<Record<string, string>>({});
  const [reviewer, setReviewer] = useState(""),
    [decisionNotes, setDecisionNotes] = useState("");
  const [fileDocument, setFileDocument] = useState<SharedTestSnapshot["documents"][number] | null>(
    null,
  );
  const [files, setFiles] = useState<Awaited<ReturnType<typeof listFiles>>>([]),
    [file, setFile] = useState<File | null>(null),
    [revision, setRevision] = useState("01");
  const [stageTarget, setStageTarget] = useState<Record<string, string>>({});
  const pendingRequest = useRef<{ signature: string; id: string } | null>(null);
  async function run(action: SharedTestAction, payload: Record<string, SharedJson>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const signature = JSON.stringify([action, payload]);
      if (pendingRequest.current?.signature !== signature)
        pendingRequest.current = { signature, id: crypto.randomUUID() };
      await write({ data: { action, payload, requestId: pendingRequest.current.id } });
      pendingRequest.current = null;
      await query.refetch();
      setNotice("Saved to shared TEST database.");
      setForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      await query.refetch();
    } finally {
      setBusy(false);
    }
  }
  const data = query.data!;
  if (query.isPending)
    return (
      <main
        className={`${darkMode ? "dark" : ""} grid min-h-screen place-items-center bg-background text-foreground`}
      >
        Loading authenticated shared TEST records…
      </main>
    );
  if (query.error || !data)
    return (
      <main
        className={`${darkMode ? "dark" : ""} grid min-h-screen place-items-center bg-background p-6 text-foreground`}
      >
        <section className="max-w-xl space-y-4">
          <h1 className="text-xl font-semibold">Shared TEST workspace unavailable</h1>
          <p role="alert">
            {query.error instanceof Error
              ? query.error.message
              : "The backend returned no workspace."}
          </p>
          <p>Changes require the shared backend. Your browser-local demo is preserved.</p>
          <button className={button} onClick={() => void query.refetch()}>
            Retry connection
          </button>{" "}
          <button className={button} onClick={() => void onLogout()}>
            Sign out
          </button>
        </section>
      </main>
    );
  const actor = data.membership,
    admin = actor.role === "admin",
    lead = actor.role === "department_lead",
    viewer = actor.role === "viewer";
  const ownDepartment = data.departments.find((d) => d.code === actor.department_code)?.id;
  const selectedDepartment = values["department_id"] || ownDepartment || "";
  const spec = recordFormSpec(data.departments.find(d => d.id === selectedDepartment)?.code || "");
  const projects = data.records.filter((r) => r.record_type === "Project");
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.reference || "—";
  const deptName = (id: string | null) => data.departments.find((d) => d.id === id)?.code || "—";
  const memberName = (id: string | null) =>
    data.members.find((m) => m.id === id)?.display_name || "Unassigned";
  const filteredTasks = data.tasks.filter((t) => projectId === "all" || t.record_id === projectId);
  const filteredRecords = data.records.filter((r) => r.record_type !== "Project");
  const pending = data.approvals.filter((a) => a.outcome === "pending");
  const myTasks = data.tasks.filter(
    (t) => t.assignee_id === actor.membership_id && t.status !== "Complete",
  );
  function open(action: SharedTestAction, initial: Record<string, string> = {}) {
    setError("");
    setForm(action);
    setValues({
      project_id: projectId === "all" ? projects[0]?.id || "" : projectId,
      department_id: ownDepartment || data.departments[0]?.id || "",
      fields: '{"revision":"01"}',
      revision: "01",
      ...initial,
    });
  }
  function field(key: string, label: string, type = "text") {
    return (
      <label className="grid gap-1 text-xs" key={key}>
        {label}
        <input
          className={input}
          type={type}
          value={values[key] || ""}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        />
      </label>
    );
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let payload: Record<string, SharedJson> = { ...values };
    try {
      if (form === "create_record" || form === "update_record")
        payload["fields"] = {
          ...JSON.parse(values["fields"] || "{}"),
          revision: values["revision"] || "01",
          scope: values["scope"] || "",
          requirements: values["requirements"] || "",
          acceptanceCriteria: values["acceptanceCriteria"] || "",
        };
      if (form === "create_record") {
        if (!spec) throw new Error("No record types configured for this department.");
        payload["fields"] = {...payload["fields"] as Record<string, SharedJson>, ...recordFieldValues(spec, values["record_type"] || "", values)};
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "The saved record fields could not be read.");
      return;
    }
    if (values["due_at"]) payload["due_at"] = values["due_at"] + "T12:00:00+05:30";
    if (form) await run(form, payload);
  }
  async function openFiles(doc: SharedTestSnapshot["documents"][number]) {
    setBusy(true);
    setError("");
    try {
      setFiles(await listFiles({ data: { documentId: doc.id } }));
      setFileDocument(doc);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "File list failed.");
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!file || !fileDocument) return;
    setBusy(true);
    setError("");
    try {
      const checksum = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const result = await beginUpload({
        data: {
          documentId: fileDocument.id,
          revision,
          name: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          checksum,
        },
      });
      if (result.signedUploadUrl) {
        const response = await fetch(result.signedUploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) throw new Error("Private upload failed. Retry before using this file.");
      }
      await completeUpload({ data: { fileId: result.file.id } });
      setFiles(await listFiles({ data: { documentId: fileDocument.id } }));
      setFile(null);
      setNotice("Private attachment uploaded and checked.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function advanceProject(project: SharedTestSnapshot["records"][number]) {
    setBusy(true);
    setError("");
    try {
      const deliverables = data.approvals
        .filter((a) => a.outcome === "approved" && a.evidence_revision)
        .flatMap<StageGateInput["evidenceManifest"]["deliverables"][number]>((a) =>
          a.evidence_record_id
            ? [
                {
                  record_id: a.evidence_record_id,
                  revision: a.evidence_revision!,
                  approval_id: a.id,
                },
              ]
            : a.evidence_document_id
              ? [
                  {
                    document_id: a.evidence_document_id,
                    revision: a.evidence_revision!,
                    approval_id: a.id,
                  },
                ]
              : [],
        );
      await advance({
        data: {
          recordId: project.id,
          targetStage: stageTarget[project.id] || "Stage 2",
          evidenceManifest: { deliverables, naRationale: {} },
        },
      });
      await query.refetch();
      setNotice("Stage updated by the verified server gate.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gate check failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={`${darkMode ? "dark" : ""} min-h-screen bg-background text-foreground`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <p className="text-xs font-bold uppercase text-primary">
            Shared TEST · {actor.organization_name}
          </p>
          <h1 className="text-lg font-semibold">
            {actor.display_name} · {actor.department_code || "Administration"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {actor.role} · Updated {date(data.serverTime)} · refreshes every 10 seconds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs">
            Inbox: {pending.length} reviews · {myTasks.length} assigned tasks
          </span>
          <button
            className={button}
            disabled={busy || query.isFetching}
            onClick={() => void query.refetch()}
          >
            Refresh
          </button>
          <button className={button} onClick={() => void onLogout()}>
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
        <nav aria-label="Shared TEST sections" className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item}
              className={`${button} ${tab === item ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => {
                setTab(item);
                setForm(null);
                setError("");
              }}
            >
              {item}
              {item === "Approvals" ? ` (${pending.length})` : ""}
            </button>
          ))}
        </nav>
        {error && (
          <p
            role="alert"
            className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded border border-primary/30 p-3 text-sm">
            {notice}
          </p>
        )}
        {viewer ? (
          <section className="rounded-lg border p-6">
            No client releases have been granted. Internal projects, tasks and documents remain
            restricted.
          </section>
        ) : (
          <>
            {tab === "Projects" && (
              <section className="space-y-3">
                <div className="flex justify-between">
                  <h2 className="font-semibold">Shared projects</h2>
                  {(admin || (lead && actor.department_code === "SAL")) && (
                    <button className={button} onClick={() => open("create_project")}>
                      New project
                    </button>
                  )}
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Project</th>
                        <th>Title</th>
                        <th>Stage</th>
                        <th>Stage gate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => (
                        <tr className="border-t" key={p.id}>
                          <td className="p-2 font-mono">{p.reference}</td>
                          <td>{p.title}</td>
                          <td>{p.stage || "Stage 1"}</td>
                          <td>
                            {(admin || (lead && p.department_id === ownDepartment)) && (
                              <div className="flex gap-2">
                                <select
                                  aria-label={`Target stage ${p.reference}`}
                                  className={input}
                                  value={stageTarget[p.id] || "Stage 2"}
                                  onChange={(e) =>
                                    setStageTarget((v) => ({ ...v, [p.id]: e.target.value }))
                                  }
                                >
                                  {Array.from({ length: 9 }, (_, i) => `Stage ${i + 1}`).map(
                                    (s) => (
                                      <option key={s}>{s}</option>
                                    ),
                                  )}
                                </select>
                                <button
                                  className={button}
                                  disabled={busy}
                                  onClick={() => void advanceProject(p)}
                                >
                                  Verify & advance
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!projects.length && (
                  <p className="text-sm text-muted-foreground">
                    No shared projects yet. An administrator or Sales lead can create the first
                    project.
                  </p>
                )}
              </section>
            )}
            {tab === "Records" && (
              <section className="space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="font-semibold">Department records & evidence</h2>
                  <button
                    className={button}
                    disabled={!projects.length}
                    onClick={() => open("create_record")}
                  >
                    New record
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  Review department
                  <select
                    className={input}
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                  >
                    <option value="">Choose reviewer</option>
                    {data.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} · {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Reference</th>
                        <th>Record</th>
                        <th>Department</th>
                        <th>Revision</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((r) => (
                        <tr className="border-t" key={r.id}>
                          <td className="p-2 font-mono">{r.reference}</td>
                          <td>
                            {r.title}
                            <details>
                              <summary className="text-xs text-muted-foreground">Fields</summary>
                              <pre className="max-w-lg whitespace-pre-wrap text-xs">
                                {JSON.stringify(r.fields, null, 2)}
                              </pre>
                              <p>{r.notes}</p>
                            </details>
                          </td>
                          <td>{deptName(r.department_id)}</td>
                          <td>{String(r.fields["revision"] || "—")}</td>
                          <td>{r.status}</td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              {(admin || r.department_id === ownDepartment) && (
                                <button
                                  className={button}
                                  disabled={busy}
                                  onClick={() =>
                                    open("update_record", {
                                      record_id: r.id,
                                      expected_updated_at: r.updated_at,
                                      fields: JSON.stringify(r.fields, null, 2),
                                      revision: String(r.fields["revision"] || "01"),
                                      scope: String(r.fields["scope"] || ""),
                                      requirements: String(r.fields["requirements"] || ""),
                                      acceptanceCriteria: String(
                                        r.fields["acceptanceCriteria"] || "",
                                      ),
                                      notes: r.notes,
                                    })
                                  }
                                >
                                  Edit / revise
                                </button>
                              )}
                              {(admin || (lead && r.department_id === ownDepartment)) && (
                                <button
                                  className={button}
                                  disabled={busy || !reviewer}
                                  onClick={() =>
                                    void run("request_approval", {
                                      record_id: r.id,
                                      reviewer_department_id: reviewer,
                                    })
                                  }
                                >
                                  Request review
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filteredRecords.length && (
                  <p className="text-sm text-muted-foreground">
                    No department evidence records are available in your authorized scope.
                  </p>
                )}
              </section>
            )}
            {tab === "Tasks" && (
              <section className="space-y-3">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Task checklist</h2>
                    <p className="text-xs text-muted-foreground">
                      Assignments and progress are shared between signed-in devices.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      aria-label="Task project"
                      className={input}
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                    >
                      <option value="all">All projects</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.reference}
                        </option>
                      ))}
                    </select>
                    <button
                      className={button}
                      disabled={!projects.length}
                      onClick={() => open("create_task")}
                    >
                      New task
                    </button>
                  </div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Done</th>
                        <th>Task</th>
                        <th>Project</th>
                        <th>Assigned to</th>
                        <th>Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => {
                        const canEdit =
                          admin ||
                          (lead && task.department_id === ownDepartment) ||
                          (actor.role === "member" && task.assignee_id === actor.membership_id);
                        return (
                          <tr className="border-t" key={task.id}>
                            <td className="p-2">
                              <input
                                aria-label={`Complete ${task.title}`}
                                type="checkbox"
                                checked={task.status === "Complete"}
                                disabled={busy || !canEdit}
                                onChange={(e) =>
                                  void run("update_task", {
                                    id: task.id,
                                    expected_updated_at: task.updated_at,
                                    status: e.target.checked ? "Complete" : "Open",
                                  })
                                }
                              />
                            </td>
                            <td>{task.title}</td>
                            <td className="font-mono text-xs">{projectName(task.record_id)}</td>
                            <td>
                              {admin || lead ? (
                                <select
                                  aria-label={`Assignee ${task.title}`}
                                  className={input}
                                  disabled={busy || !canEdit}
                                  value={task.assignee_id || ""}
                                  onChange={(e) =>
                                    void run("update_task", {
                                      id: task.id,
                                      status: task.status,
                                      expected_updated_at: task.updated_at,
                                      assignee_id: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Unassigned</option>
                                  {data.members
                                    .filter(
                                      (m) =>
                                        m.department_id === task.department_id &&
                                        m.role !== "viewer",
                                    )
                                    .map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.display_name}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                memberName(task.assignee_id)
                              )}
                            </td>
                            <td className="text-xs">{date(task.due_at)}</td>
                            <td>
                              <select
                                aria-label={`Status ${task.title}`}
                                className={input}
                                disabled={busy || !canEdit}
                                value={task.status}
                                onChange={(e) =>
                                  void run("update_task", {
                                    id: task.id,
                                    status: e.target.value,
                                    expected_updated_at: task.updated_at,
                                  })
                                }
                              >
                                {taskStatuses.map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!filteredTasks.length && (
                  <p className="text-sm text-muted-foreground">No shared tasks in this scope.</p>
                )}
              </section>
            )}
            {tab === "Approvals" && (
              <section className="space-y-3">
                <h2 className="font-semibold">Cross-department reviews</h2>
                <label className="grid gap-1 text-xs">
                  Decision notes
                  <input
                    className={input}
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                  />
                </label>
                {data.approvals.map((a) => {
                  const canDecide =
                    admin ||
                    (lead && (a.reviewer_department_id || a.department_id) === ownDepartment);
                  return (
                    <article
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                      key={a.id}
                    >
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {deptName(a.department_id)} →{" "}
                          {deptName(a.reviewer_department_id || a.department_id)} · Rev{" "}
                          {a.evidence_revision || "—"} · {a.outcome}
                        </p>
                        {a.decision_notes && <p className="text-sm">{a.decision_notes}</p>}
                      </div>
                      {a.outcome === "pending" && canDecide && (
                        <div className="flex gap-2">
                          {(["approved", "returned", "rejected"] as const).map((outcome) => (
                            <button
                              key={outcome}
                              className={button}
                              disabled={busy}
                              onClick={() =>
                                void run("decide_approval", {
                                  id: a.id,
                                  outcome,
                                  expected_updated_at: a.updated_at,
                                  notes: decisionNotes,
                                })
                              }
                            >
                              {outcome === "approved"
                                ? "Approve"
                                : outcome === "returned"
                                  ? "Return"
                                  : "Reject"}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
                {!data.approvals.length && (
                  <p className="text-sm text-muted-foreground">
                    No reviews in your authorized scope. Request a department review from Records.
                  </p>
                )}
              </section>
            )}
            {tab === "Documents" && (
              <section className="space-y-3">
                <div className="flex justify-between">
                  <h2 className="font-semibold">Private document register</h2>
                  <button
                    className={button}
                    disabled={!data.records.some((r) => r.department_id === ownDepartment || admin)}
                    onClick={() =>
                      open("create_document", {
                        record_id:
                          data.records.find((r) => r.department_id === ownDepartment || admin)
                            ?.id || "",
                      })
                    }
                  >
                    Register document
                  </button>
                </div>
                {data.documents.map((d) => (
                  <article key={d.id} className="flex justify-between rounded border p-4">
                    <div>
                      <p>{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.document_type} · {deptName(d.department_id)}
                      </p>
                    </div>
                    <button className={button} disabled={busy} onClick={() => void openFiles(d)}>
                      Files & revisions
                    </button>
                  </article>
                ))}
                {!data.documents.length && (
                  <p className="text-sm text-muted-foreground">
                    No shared document metadata in this scope. Browser-local attachments have not
                    been imported.
                  </p>
                )}
              </section>
            )}
            {tab === "Activity" && (
              <section className="space-y-3">
                <h2 className="font-semibold">Server audit activity</h2>
                {data.audit.map((e) => (
                  <article className="border-b py-3 text-sm" key={e.id}>
                    <p>
                      {e.action.replaceAll("_", " ")} · {date(e.created_at)}
                    </p>
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {JSON.stringify(e.detail)}
                    </pre>
                  </article>
                ))}
                {!data.audit.length && (
                  <p className="text-sm text-muted-foreground">No server activity in your scope.</p>
                )}
              </section>
            )}
          </>
        )}
        {form && (
          <section
            role="dialog"
            aria-label="Shared TEST editor"
            className="rounded-lg border bg-card p-5"
          >
            <form onSubmit={(e) => void submit(e)} className="grid gap-3 md:grid-cols-2">
              <h2 className="font-semibold md:col-span-2">{form.replaceAll("_", " ")}</h2>
              {form !== "update_record" && field("title", "Title")}
              {(form === "create_project" || form === "create_record") &&
                field("reference", "Controlled reference (HLPL-…)")}
              {form === "create_record" && <>
                <label className="grid gap-1 text-xs">Record type
                  <select className={input} required value={values["record_type"] || ""} onChange={e => setValues(v => ({...v, record_type:e.target.value}))}>
                    <option value="">Choose record type…</option>{(spec?.types || []).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                {spec && recordFields(spec,values["record_type"] || "").map(item => <label key={item.key} className="grid gap-1 text-xs">{item.label}
                  {item.options ? <select className={input} required={item.required} value={values[item.key] || ""} onChange={e => setValues(v => ({...v,[item.key]:e.target.value}))}><option value="">Choose…</option>{item.options.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input className={input} type={item.kind === "date" ? "date" : "text"} required={item.required} value={values[item.key] || ""} onChange={e => setValues(v => ({...v,[item.key]:e.target.value}))} />}
                </label>)}
              </>}
              {(form === "create_record" || form === "create_task") && (
                <label className="grid gap-1 text-xs">
                  Project
                  <select
                    required
                    className={input}
                    value={values["project_id"] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, project_id: e.target.value }))}
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.reference} · {p.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {admin && (form === "create_record" || form === "create_task") && (
                <label className="grid gap-1 text-xs">
                  Department
                  <select
                    className={input}
                    value={selectedDepartment}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, department_id: e.target.value, assignee_id: "" }))
                    }
                  >
                    {data.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} · {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {form === "create_task" && (
                <>
                  {field("due_at", "Due date", "date")}
                  {actor.role !== "member" && (
                    <label className="grid gap-1 text-xs">
                      Assign to
                      <select
                        className={input}
                        value={values["assignee_id"] || ""}
                        onChange={(e) => setValues((v) => ({ ...v, assignee_id: e.target.value }))}
                      >
                        <option value="">Unassigned</option>
                        {data.members
                          .filter(
                            (m) => m.department_id === selectedDepartment && m.role !== "viewer",
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.display_name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              {form === "create_document" && (
                <>
                  <label className="grid gap-1 text-xs">
                    Source record
                    <select
                      className={input}
                      value={values["record_id"] || ""}
                      onChange={(e) => setValues((v) => ({ ...v, record_id: e.target.value }))}
                    >
                      {data.records
                        .filter((r) => admin || r.department_id === ownDepartment)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.reference}
                          </option>
                        ))}
                    </select>
                  </label>
                  {field("document_type", "Document type")}
                </>
              )}
              {(form === "create_record" || form === "update_record") && (
                <>
                  {field("revision", "Revision")}
                  {field("scope", "Scope")}
                  {field("requirements", "Requirements / review findings")}
                  {field("acceptanceCriteria", "Acceptance criteria")}
                </>
              )}
              {(form === "create_project" ||
                form === "create_record" ||
                form === "update_record") &&
                field("notes", "Notes")}
              <div className="flex gap-2 md:col-span-2">
                <button
                  className={`${button} bg-primary text-primary-foreground`}
                  disabled={busy}
                  type="submit"
                >
                  Save to shared TEST
                </button>
                <button className={button} type="button" onClick={() => setForm(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}
        {fileDocument && (
          <section
            role="dialog"
            aria-label="Private document files"
            className="space-y-3 rounded-lg border bg-card p-5"
          >
            <div className="flex justify-between">
              <h2 className="font-semibold">{fileDocument.title} · private revisions</h2>
              <button className={button} onClick={() => setFileDocument(null)}>
                Close
              </button>
            </div>
            {files.map((f) => (
              <div key={f.id} className="flex justify-between border-b py-2 text-sm">
                <span>
                  Rev {f.revision} · {f.original_name}
                </span>
                <button
                  className={button}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const result = await download({ data: { fileId: f.id } });
                      window.open(result.url, "_blank", "noopener,noreferrer");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Download denied.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Download
                </button>
              </div>
            ))}
            {(admin || lead) && (
              <div className="flex flex-wrap gap-2">
                <input
                  aria-label="Private attachment"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <input
                  aria-label="Attachment revision"
                  className={input}
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                />
                <button className={button} disabled={busy || !file} onClick={() => void upload()}>
                  Upload private file
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

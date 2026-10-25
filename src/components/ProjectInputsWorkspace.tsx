import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProjectInputs, mutateProjectInputs } from "@/lib/project-inputs.functions";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import {
  PROJECT_INPUT_PARAMETERS,
  FEASIBILITY_STATES,
  inputReadiness,
  type InputSheet,
  type ParameterValue,
  type ParameterResponse,
} from "@/lib/project-inputs";
import type { TestMembership } from "@/lib/test-auth.functions";
import type { AnalysisRecord } from "@/lib/project-analysis-data";
import { SharedMasterSelect } from "./SharedMasterSelect";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
const field = "w-full rounded border border-input bg-background p-2 text-xs";
const emptyRow: ParameterValue = {
  input: "",
  source: "",
  finalValue: "",
  required: true,
  responses: {},
};
const emptyResponse: ParameterResponse = {
  status: "Pending",
  remarks: "",
  evidence: "",
  ownerId: "",
  dueDate: "",
  authorId: "",
  reviewedBy: "",
};
type Action =
  | "create"
  | "input"
  | "respond"
  | "review_response"
  | "approve"
  | "revise"
  | "client_evidence"
  | "link_project"
  | "assign_owner"
  | "add_parameter";
export function ProjectInputsWorkspace({
  membership,
  sources,
  initialSourceId,
}: {
  membership: TestMembership;
  sources: AnalysisRecord[];
  initialSourceId?: string | undefined;
}) {
  const load = useServerFn(getProjectInputs),
    write = useServerFn(mutateProjectInputs),
    loadMembers = useServerFn(getSharedTestWorkspace);
  const query = useQuery({
    queryKey: ["project-inputs", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 15000,
  });
  const people = useQuery({
    queryKey: ["shared-test-workspace", membership.organizationId, membership.membershipId],
    queryFn: () => loadMembers(),
  });
  const [sourceId, setSourceId] = useState(
    initialSourceId && initialSourceId !== "all" ? initialSourceId : "",
  );
  const [scope, setScope] = useState<"Client" | "Internal">("Client"),
    [filter, setFilter] = useState(""),
    [section, setSection] = useState("All"),
    [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<{
      id: string;
      mode: "input" | "respond";
      version: number;
    } | null>(null),
    [draft, setDraft] = useState<Record<string, string>>({});
  const [newQuestion, setNewQuestion] = useState(false),
    [questionLabel, setQuestionLabel] = useState(""),
    [questionHint, setQuestionHint] = useState(""),
    [questionReviewers, setQuestionReviewers] = useState<string[]>([]);
  const [reason, setReason] = useState(""),
    [clientEvidence, setClientEvidence] = useState(""),
    [linkId, setLinkId] = useState("");
  const sheet = query.data?.sheets.find(
    (s) => s.source_record_id === sourceId || s.project_record_id === sourceId,
  );
  const inputOwner =
    !!sheet && (sheet.input_owner_id === membership.membershipId || membership.role === "admin");
  const editable = sheet?.status === "Draft";
  const dept = membership.departmentCode || "";
  const members =
    people.data?.members.filter(
      (m) => m.department_id === people.data?.departments.find((d) => d.code === dept)?.id,
    ) || [];
  const parameters = [...PROJECT_INPUT_PARAMETERS, ...(sheet?.custom_parameters || [])];
  const stats = inputReadiness(sheet?.parameter_values || {}, parameters);
  async function save(
    action: Action,
    payload: Record<string, string | number | boolean | null>,
    version = sheet?.version,
  ) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await write({
        data: {
          action,
          payload: {
            ...(sheet ? { sheetId: sheet.id, expectedVersion: version! } : {}),
            ...payload,
          },
        },
      });
      await query.refetch();
      setNotice("Saved to shared project inputs.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Your input is preserved.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const rows = parameters.filter(
    (p) =>
      (section === "All" || p.section === section) &&
      (!mine || [p.lead, ...p.reviewers, ...p.consumers].includes(dept)) &&
      `${p.label} ${p.hint} ${sheet?.parameter_values[p.id]?.input || ""}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
  );
  function edit(id: string, mode: "input" | "respond") {
    if (!sheet) return;
    const row = sheet.parameter_values[id] || emptyRow;
    setDraft(
      mode === "input"
        ? {
            input: row.input,
            source: row.source,
            finalValue: row.finalValue,
            required: String(row.required !== false),
            exclusionReason:
              (row as ParameterValue & { exclusionReason?: string }).exclusionReason || "",
          }
        : { ...emptyResponse, ...row.responses[dept] },
    );
    setError("");
    setEditing({ id, mode, version: sheet.version });
  }
  return (
    <section className="space-y-4" aria-label="Project inputs and feasibility">
      <div>
        <h2 className="font-semibold">Inputs & Feasibility</h2>
        <p className="text-xs text-muted-foreground">
          Client or internal requirements, departmental assessments and an approved specification
          baseline. Example hints are not decided values.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <SharedMasterSelect
            label="Enquiry or project"
            options={sources
              .filter((s) => ["Project", "Enquiry", "Opportunity"].includes(s.type))
              .map((s) => ({ value: s.id, label: `${s.reference} · ${s.title}` }))}
            value={sourceId}
            onChange={(id) => {
              setSourceId(id);
              setError("");
              setNotice("");
            }}
          />
        </div>
        {sheet && (
          <span className="text-xs">
            {sheet.scope} · Rev {String(sheet.revision).padStart(2, "0")} · {sheet.status}
          </span>
        )}
      </div>
      {query.isPending && <p className="text-xs">Loading saved inputs…</p>}
      {query.error && (
        <p role="alert" className="text-xs text-destructive">
          Shared input service unavailable:{" "}
          {query.error instanceof Error ? query.error.message : "Unable to load"}. No local save is
          used.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-xs text-emerald-600">
          {notice}
        </p>
      )}
      {!sheet && sourceId && !query.isPending && !query.error && (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs">
            No sheet exists for this entry. The source owner or Admin can start it without creating
            a new project.
          </p>
          {["admin", "department_lead"].includes(membership.role) && (
            <div className="flex gap-2">
              <select
                aria-label="Project origin"
                className={field}
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
              >
                <option>Client</option>
                <option>Internal</option>
              </select>
              <Button disabled={busy} onClick={() => void save("create", { sourceId, scope })}>
                Start input sheet
              </Button>
            </div>
          )}
        </div>
      )}
      {sheet && (
        <>
          {editable && membership.role === "admin" && (
            <label className="grid gap-1 text-xs">
              Input coordinator (department lead)
              <select
                className={field}
                value={sheet.input_owner_id}
                disabled={busy}
                onChange={(e) => void save("assign_owner", { ownerId: e.target.value })}
              >
                <option value={sheet.input_owner_id}>
                  {people.data?.members.find((m) => m.id === sheet.input_owner_id)?.display_name ||
                    "Current coordinator"}
                </option>
                {people.data?.members
                  .filter((m) => m.role === "department_lead" && m.id !== sheet.input_owner_id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              ["Missing inputs", stats.missing],
              ["Blocked / conditional", stats.blocked],
              ["Awaiting department review", stats.pending],
              ["Ready parameters", stats.ready],
            ].map(([label, n]) => (
              <div className="rounded-lg border p-3" key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold">{n}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Search input parameters"
              className={`${field} flex-1 min-w-40`}
              placeholder="Search parameters or requirements…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <select
              aria-label="Parameter section"
              className="rounded border bg-background p-2 text-xs max-w-64"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              {["All", ...new Set(parameters.map((p) => p.section))].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
              My responsibilities
            </label>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left">
                <tr>
                  {[
                    "Parameter / responsibility",
                    "Required input & source",
                    "Department responses",
                    "Final agreed value",
                    "Details",
                  ].map((t) => (
                    <th className="p-3" key={t}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const row = sheet.parameter_values[p.id] || emptyRow;
                  const assigned = [p.lead, ...p.reviewers];
                  return (
                    <tr key={p.id} className="border-t align-top">
                      <td className="p-3 min-w-48">
                        <p className="text-muted-foreground text-[10px]">{p.section}</p>
                        <p className="font-semibold">{p.label}</p>
                        <p>Primary: {p.lead}</p>
                        <p className="text-muted-foreground">Review: {p.reviewers.join(", ")}</p>
                      </td>
                      <td className="p-3 min-w-48 whitespace-pre-wrap">
                        {row.input || (
                          <span className="text-muted-foreground">To be confirmed</span>
                        )}
                        {row.source && (
                          <p className="mt-1 text-muted-foreground">Source: {row.source}</p>
                        )}
                        {row.required === false && (
                          <p>
                            Excluded:{" "}
                            {(row as ParameterValue & { exclusionReason?: string }).exclusionReason}
                          </p>
                        )}
                      </td>
                      <td className="p-3 min-w-48 space-y-1">
                        {assigned.map((d) => (
                          <p key={d}>
                            {d}: {row.responses[d]?.status || "Pending"}
                            {row.responses[d]?.reviewedBy ? " · Reviewed" : ""}
                          </p>
                        ))}
                      </td>
                      <td className="p-3 min-w-40 whitespace-pre-wrap">
                        {row.finalValue || "Not agreed"}
                      </td>
                      <td className="p-3 min-w-64">
                        <details>
                          <summary className="cursor-pointer font-medium">
                            Requirements & assessments
                          </summary>
                          <p className="mt-2 text-muted-foreground">{p.hint}</p>
                          <p className="mt-1">Dependent teams: {p.consumers.join(", ")}</p>
                          {assigned.map((d) => {
                            const response = row.responses[d];
                            return (
                              <div className="mt-2 border-t pt-2" key={d}>
                                <p className="font-medium">
                                  {d} · {response?.status || "Awaiting assessment"}
                                </p>
                                <p className="whitespace-pre-wrap">
                                  {response?.remarks || "No technical remarks yet."}
                                </p>
                                {response?.evidence && <p>Evidence: {response.evidence}</p>}
                                {response?.ownerId && (
                                  <p>
                                    Owner:{" "}
                                    {people.data?.members.find((m) => m.id === response.ownerId)
                                      ?.display_name || "Assigned member"}
                                  </p>
                                )}
                                {response?.dueDate && <p>Target: {response.dueDate}</p>}
                              </div>
                            );
                          })}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {editable && inputOwner && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => edit(p.id, "input")}
                              >
                                Edit requirement
                              </Button>
                            )}
                            {editable && assigned.includes(dept) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => edit(p.id, "respond")}
                              >
                                My assessment
                              </Button>
                            )}
                            {editable &&
                              assigned.includes(dept) &&
                              membership.role === "department_lead" &&
                              row.responses[dept] &&
                              !row.responses[dept]?.reviewedBy && (
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    void save("review_response", {
                                      parameterId: p.id,
                                      department: dept,
                                    })
                                  }
                                >
                                  Confirm department review
                                </Button>
                              )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editable && inputOwner && sheet.scope === "Client" && (
            <div className="rounded border p-3 space-y-2">
              <p className="text-xs font-medium">Client approval evidence reference</p>
              <p className="text-xs text-muted-foreground">
                Reference the signed approval document or record. Entering a reference does not
                create or verify a client signature.
              </p>
              <input
                aria-label="Client approval evidence"
                className={field}
                placeholder={sheet.client_evidence || "Signed document / approval record reference"}
                value={clientEvidence}
                onChange={(e) => setClientEvidence(e.target.value)}
              />
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void save("client_evidence", { evidence: clientEvidence })}
              >
                Save evidence reference
              </Button>
            </div>
          )}
          {!sheet.project_record_id && (membership.role === "admin" || dept === "SAL") && (
            <div className="flex gap-2">
              <div className="flex-1">
                <SharedMasterSelect
                  label="Link accepted project"
                  options={sources
                    .filter((s) => s.type === "Project")
                    .map((s) => ({ value: s.id, label: `${s.reference} · ${s.title}` }))}
                  value={linkId}
                  onChange={setLinkId}
                />
              </div>
              <Button
                disabled={busy || !linkId}
                onClick={() => void save("link_project", { projectId: linkId })}
              >
                Link existing project
              </Button>
            </div>
          )}
          {editable && membership.role === "admin" && (
            <Button
              disabled={busy || sheet.input_owner_id === membership.membershipId}
              onClick={() => void save("approve", {})}
            >
              Approve baseline
            </Button>
          )}
          {sheet.status === "Approved" && inputOwner && (
            <div className="flex gap-2">
              <input
                aria-label="Revision reason"
                className={field}
                placeholder="Reason for a new revision"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                disabled={busy || reason.trim().length < 5}
                onClick={() => void save("revise", { reason })}
              >
                Start revision
              </Button>
            </div>
          )}
          <details className="rounded border p-3">
            <summary className="cursor-pointer text-xs font-medium">
              Revision & activity history
            </summary>
            {query.data?.events
              .filter((e) => e.sheet_id === sheet.id)
              .map((e) => (
                <div className="mt-2 text-xs" key={e.id}>
                  <p>
                    Rev {e.revision} · {e.action} · {e.actor_name} ·{" "}
                    {new Date(e.created_at).toLocaleString()}
                  </p>
                  {e.action === "approve" && (
                    <details>
                      <summary className="cursor-pointer">Approved specification snapshot</summary>
                      <pre className="overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
          </details>
        </>
      )}
      {editable && ["admin", "department_lead"].includes(membership.role) && dept && (
        <Button variant="outline" onClick={() => setNewQuestion(true)}>
          Add department question
        </Button>
      )}
      <Dialog
        open={newQuestion}
        onOpenChange={(open) => {
          if (!busy) setNewQuestion(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add department question</DialogTitle>
            <DialogDescription>
              {dept} is responsible for the assessment. Select supporting reviewers only where
              needed.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await save("add_parameter", {
                  label: questionLabel,
                  hint: questionHint,
                  reviewers: questionReviewers.join(","),
                })
              ) {
                setNewQuestion(false);
                setQuestionLabel("");
                setQuestionHint("");
                setQuestionReviewers([]);
              }
            }}
          >
            <label className="grid gap-1 text-xs">
              Parameter / question
              <input
                className={field}
                required
                minLength={3}
                value={questionLabel}
                onChange={(e) => setQuestionLabel(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs">
              Information needed
              <textarea
                className={field}
                value={questionHint}
                onChange={(e) => setQuestionHint(e.target.value)}
              />
            </label>
            <fieldset className="flex flex-wrap gap-2 text-xs">
              <legend>Supporting department reviews</legend>
              {people.data?.departments
                .filter((d) => d.code !== "CLIENT" && d.code !== dept)
                .map((d) => (
                  <label key={d.id} className="flex gap-1">
                    <input
                      type="checkbox"
                      checked={questionReviewers.includes(d.code)}
                      onChange={(e) =>
                        setQuestionReviewers((prev) =>
                          e.target.checked ? [...prev, d.code] : prev.filter((c) => c !== d.code),
                        )
                      }
                    />
                    {d.code}
                  </label>
                ))}
            </fieldset>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <Button disabled={busy}>Add question</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{parameters.find((p) => p.id === editing?.id)?.label}</DialogTitle>
            <DialogDescription>
              {editing?.mode === "input"
                ? "Record source facts and the proposed final requirement. Changes invalidate prior department review confirmations."
                : `${dept} assessment only. Other departments' responses are preserved.`}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editing) return;
              const payload: Record<string, string | number | boolean | null> = {
                parameterId: editing.id,
                ...draft,
              };
              if (editing.mode === "input") payload["required"] = draft["required"] !== "false";
              else payload["department"] = dept;
              if (await save(editing.mode, payload, editing.version)) setEditing(null);
            }}
          >
            {(editing?.mode === "input"
              ? [
                  ["input", "Required input"],
                  ["source", "Source reference"],
                  ["finalValue", "Final agreed value"],
                ]
              : [
                  ["remarks", "Technical remarks / constraints / clarification needed"],
                  ["evidence", "Evidence reference"],
                ]
            ).map(([key, label]) => (
              <label key={key} className="grid gap-1 text-xs">
                {label}
                <textarea
                  className={field}
                  required={key === "remarks"}
                  value={draft[key!] || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [key!]: e.target.value }))}
                />
              </label>
            ))}
            <SharedMasterSelect
              label="Use an existing source or evidence"
              value=""
              options={[
                ...(people.data?.records || []).map((r) => ({
                  value: `record:${r.id}`,
                  label: `${r.reference} · ${r.title}`,
                })),
                ...(people.data?.documents || []).map((d) => ({
                  value: `document:${d.id}`,
                  label: `Document · ${d.title}`,
                })),
              ]}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  [editing?.mode === "input" ? "source" : "evidence"]: value,
                }))
              }
            />
            {editing?.mode === "input" ? (
              <>
                <label className="flex gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draft["required"] !== "false"}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, required: String(e.target.checked) }))
                    }
                  />
                  Required for this project
                </label>
                {draft["required"] === "false" && (
                  <label className="grid gap-1 text-xs">
                    Exclusion reason
                    <textarea
                      required
                      minLength={5}
                      className={field}
                      value={draft["exclusionReason"] || ""}
                      onChange={(e) => setDraft((d) => ({ ...d, exclusionReason: e.target.value }))}
                    />
                  </label>
                )}
              </>
            ) : (
              <>
                <label className="grid gap-1 text-xs">
                  Feasibility
                  <select
                    className={field}
                    value={draft["status"] || "Pending"}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                  >
                    {FEASIBILITY_STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs">
                  Responsible member
                  <select
                    className={field}
                    value={draft["ownerId"] || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, ownerId: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs">
                  Target date
                  <input
                    type="date"
                    className={field}
                    value={draft["dueDate"] || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                  />
                </label>
              </>
            )}
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

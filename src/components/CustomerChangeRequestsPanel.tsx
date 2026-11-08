import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerChangeRequests, mutateCustomerChangeRequest } from "@/lib/customer-change.functions";
import { customerChangeMutationSchema, type CustomerChangeImpact, type CustomerChangeRequest } from "@/lib/customer-change.schema";
import { PROJECT_INPUT_PARAMETERS, type InputSheet } from "@/lib/project-inputs";
import type { TestMembership } from "@/lib/test-auth.functions";
import { Button } from "./ui/button";

const field = "w-full rounded border border-input bg-background p-2 text-xs";
const impactCategories = [
  ["tracks", "Affected tracks"],
  ["stages", "Affected stages"],
  ["documents", "Affected document references"],
  ["bom", "Affected BOM references"],
  ["reusableAssets", "Affected reusable-asset references"],
] as const;
type DepartmentOption = { code: string; name: string };

function references(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function changedParameters(request: CustomerChangeRequest) {
  return Object.keys(request.proposed_values).filter(
    (key) => JSON.stringify(request.before_values[key]) !== JSON.stringify(request.proposed_values[key]),
  );
}

function valueFor(values: Record<string, unknown>, key: string) {
  const row = values[key];
  if (!row || typeof row !== "object" || Array.isArray(row)) return "";
  const value = (row as Record<string, unknown>)["input"];
  return typeof value === "string" ? value : "";
}

function ImpactAssessment({
  impact,
  request,
  onAssess,
}: {
  impact: CustomerChangeImpact;
  request: CustomerChangeRequest;
  onAssess: (impact: CustomerChangeImpact, request: CustomerChangeRequest, outcome: string, assessment: string) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState("Impact identified");
  const [assessment, setAssessment] = useState("");
  return (
    <form
      className="mt-2 grid gap-2 rounded border border-border/60 p-2"
      onSubmit={(event) => {
        event.preventDefault();
        void onAssess(impact, request, outcome, assessment);
      }}
    >
      <label className="grid gap-1 text-[11px]">
        Department outcome
        <select className={field} value={outcome} onChange={(event) => setOutcome(event.target.value)}>
          <option>Impact identified</option>
          <option>No impact</option>
          <option>Return for rework</option>
        </select>
      </label>
      <label className="grid gap-1 text-[11px]">
        Assessment and evidence references
        <textarea className={field} rows={2} minLength={5} value={assessment} onChange={(event) => setAssessment(event.target.value)} />
      </label>
      <Button size="sm" type="submit" disabled={assessment.trim().length < 5}>
        Record department assessment
      </Button>
    </form>
  );
}

function ChangeDecision({
  request,
  onDecide,
}: {
  request: CustomerChangeRequest;
  onDecide: (request: CustomerChangeRequest, decision: string, notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  return (
    <div className="mt-2 grid gap-2 rounded border border-border/60 p-2">
      <label className="grid gap-1 text-[11px]">
        Decision rationale
        <textarea className={field} rows={2} minLength={5} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {[
          ["approve", "Approve revision"],
          ["return", "Return for rework"],
          ["reject", "Reject request"],
        ].map(([decision, label]) => (
          <Button
            key={decision}
            size="sm"
            variant={decision === "approve" ? "default" : "outline"}
            disabled={notes.trim().length < 5}
            onClick={() => void onDecide(request, decision!, notes)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function CustomerChangeRequestsPanel({
  membership,
  sheet,
  departments,
}: {
  membership?: TestMembership | undefined;
  sheet: InputSheet;
  departments: DepartmentOption[];
}) {
  const load = useServerFn(getCustomerChangeRequests);
  const mutate = useServerFn(mutateCustomerChangeRequest);
  const queryClient = useQueryClient();
  const projectId = sheet.project_record_id || "";
  const queryKey = ["customer-change-requests", membership?.organizationId, membership?.membershipId, projectId];
  const query = useQuery({
    queryKey,
    queryFn: () => load({ data: { projectId } }),
    enabled: Boolean(membership && projectId),
    retry: false,
    refetchInterval: (current) => current.state.error ? false : membership ? 15000 : false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<CustomerChangeRequest>();
  const [title, setTitle] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [parameterId, setParameterId] = useState("system_voltage");
  const [proposedValue, setProposedValue] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [scopeValues, setScopeValues] = useState<Record<(typeof impactCategories)[number][0], string>>({
    tracks: "",
    stages: "",
    documents: "",
    bom: "",
    reusableAssets: "",
  });

  const allowedDepartments = departments.filter((department) => department.code !== "CLIENT");
  const canAuthor = Boolean(
    membership &&
      !membership.isClient &&
      (membership.role === "admin" ||
        (membership.role === "department_lead" && membership.departmentCode === "SAL")),
  );
  const parameters = [...PROJECT_INPUT_PARAMETERS, ...sheet.custom_parameters];

  function startEditing(request: CustomerChangeRequest) {
    const changed = changedParameters(request)[0] || "system_voltage";
    setEditing(request);
    setTitle(request.title);
    setCustomerReference(request.customer_reference);
    setDescription(request.description);
    setRationale(request.rationale);
    setParameterId(changed);
    setProposedValue(valueFor(request.proposed_values, changed));
    setSelectedDepartments(request.impacts?.map((impact) => impact.department_code) || []);
    const firstScope = request.impacts?.[0]?.impact_scope;
    if (firstScope) {
      setScopeValues({
        tracks: firstScope.tracks.join(", "),
        stages: firstScope.stages.join(", "),
        documents: firstScope.documents.join(", "),
        bom: firstScope.bom.join(", "),
        reusableAssets: firstScope.reusableAssets.join(", "),
      });
    }
  }

  function resetEditor() {
    setEditing(undefined);
    setTitle("");
    setCustomerReference("");
    setDescription("");
    setRationale("");
    setProposedValue("");
    setSelectedDepartments([]);
    setScopeValues({ tracks: "", stages: "", documents: "", bom: "", reusableAssets: "" });
  }

  async function send(
    action: "create" | "update_draft" | "submit" | "assess_impact" | "decide",
    payload: Record<string, unknown>,
  ) {
    if (!membership || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate({
        data: customerChangeMutationSchema.parse({ action, payload, operationId: crypto.randomUUID() }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({
          queryKey: ["project-inputs", membership.organizationId, membership.membershipId],
        }),
      ]);
      await query.refetch();
      setNotice("Saved to the authenticated shared customer-change workflow.");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Customer change request was not saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership || !projectId || !canAuthor || !selectedDepartments.length) return;
    const current = sheet.parameter_values[parameterId] || {
      input: "",
      source: "",
      finalValue: "",
      required: true,
      responses: {},
    };
    const proposedValues = {
      ...sheet.parameter_values,
      [parameterId]: { ...current, input: proposedValue.trim(), finalValue: proposedValue.trim() },
    };
    const scope = Object.fromEntries(
      impactCategories.map(([key]) => [key, references(scopeValues[key])]),
    );
    const impacts = selectedDepartments.map((departmentCode) => ({ departmentCode, scope }));
    const basePayload = {
      title: title.trim(),
      customerReference: customerReference.trim(),
      description: description.trim(),
      rationale: rationale.trim(),
      proposedValues,
      impacts,
    };
    const payload = editing
      ? { requestId: editing.id, expectedVersion: editing.version, ...basePayload }
      : {
          ...basePayload,
          projectId,
          sheetId: sheet.id,
          expectedSheetVersion: sheet.version,
          expectedSheetRevision: sheet.revision,
        };
    const saved = await send(editing ? "update_draft" : "create", payload);
    if (saved) resetEditor();
  }

  async function assessImpact(
    impact: CustomerChangeImpact,
    request: CustomerChangeRequest,
    outcome: string,
    assessment: string,
  ) {
    await send("assess_impact", {
      requestId: request.id,
      expectedVersion: request.version,
      expectedImpactVersion: impact.version,
      outcome,
      assessment: assessment.trim(),
    });
  }

  async function decide(request: CustomerChangeRequest, decision: string, notes: string) {
    await send("decide", {
      requestId: request.id,
      expectedVersion: request.version,
      decision,
      notes: notes.trim(),
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-border/70 bg-card p-3" aria-label="Customer requirements change requests">
      <div>
        <h3 className="text-sm font-semibold">Customer requirements change & impact review</h3>
        <p className="text-[11px] text-muted-foreground">
          Web-authoritative authoring. Approval creates the next canonical input-sheet revision and invalidates prior department confirmations. Artifact entries are references for assessment, not verified links.
        </p>
      </div>
      {!membership && (
        <p className="rounded border border-dashed p-2 text-xs text-muted-foreground">
          Shared customer-change requests are unavailable in browser demo mode. No local or synthetic request is created.
        </p>
      )}
      {membership && !projectId && (
        <p className="rounded border border-dashed p-2 text-xs text-muted-foreground">
          Link this input sheet to an authorized project before opening a change request.
        </p>
      )}
      {query.isPending && membership && projectId && <p className="text-xs">Loading shared change requests…</p>}
      {query.error && (
        <p role="alert" className="rounded border border-destructive/40 p-2 text-xs text-destructive">
          Shared change workflow unavailable: {query.error instanceof Error ? query.error.message : "The backend did not return the contract."} No local request is used; verify migration deployment before retrying.
        </p>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {notice && <p role="status" className="text-xs text-emerald-600">{notice}</p>}
      {membership && projectId && canAuthor && sheet.status === "Approved" && (
        <details open={Boolean(editing)} className="rounded border border-border/60 p-2">
          <summary className="cursor-pointer text-xs font-medium">
            {editing ? `Update returned request · ${editing.title}` : "Record requirements change"}
          </summary>
          <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={(event) => void saveDraft(event)}>
            <label className="grid gap-1 text-[11px]">
              Request title
              <input className={field} minLength={3} maxLength={150} required value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="grid gap-1 text-[11px]">
              Customer reference (if supplied; not verified)
              <input className={field} maxLength={200} value={customerReference} onChange={(event) => setCustomerReference(event.target.value)} />
            </label>
            <label className="grid gap-1 text-[11px] md:col-span-2">
              Requested change
              <textarea className={field} rows={2} minLength={5} maxLength={4000} required value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label className="grid gap-1 text-[11px] md:col-span-2">
              Reason / customer feedback
              <textarea className={field} rows={2} minLength={5} maxLength={4000} required value={rationale} onChange={(event) => setRationale(event.target.value)} />
            </label>
            <label className="grid gap-1 text-[11px]">
              Requirement parameter
              <select className={field} value={parameterId} onChange={(event) => {
                setParameterId(event.target.value);
                setProposedValue(valueFor(sheet.parameter_values, event.target.value));
              }}>
                {parameters.map((parameter) => <option key={parameter.id} value={parameter.id}>{parameter.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[11px]">
              Proposed requirement value
              <textarea className={field} rows={2} minLength={1} required value={proposedValue} onChange={(event) => setProposedValue(event.target.value)} />
            </label>
            <fieldset className="grid gap-1 text-[11px] md:col-span-2">
              <legend>Assign impact review departments</legend>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {allowedDepartments.map((department) => (
                  <label key={department.code} className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selectedDepartments.includes(department.code)}
                      onChange={(event) => setSelectedDepartments((current) =>
                        event.target.checked
                          ? [...current, department.code]
                          : current.filter((code) => code !== department.code),
                      )}
                    />
                    {department.code} · {department.name}
                  </label>
                ))}
              </div>
            </fieldset>
            {impactCategories.map(([key, label]) => (
              <label key={key} className="grid gap-1 text-[11px]">
                {label}
                <input
                  className={field}
                  placeholder="Comma-separated references"
                  value={scopeValues[key]}
                  onChange={(event) => setScopeValues((current) => ({ ...current, [key]: event.target.value }))}
                />
              </label>
            ))}
            <div className="flex flex-wrap items-center gap-2 md:col-span-2">
              <Button type="submit" size="sm" disabled={busy || !selectedDepartments.length || proposedValue.trim().length === 0}>
                {busy ? "Saving…" : editing ? "Save rework draft" : "Save change request"}
              </Button>
              {editing && <Button type="button" size="sm" variant="outline" onClick={resetEditor}>Cancel edit</Button>}
            </div>
          </form>
        </details>
      )}
      {membership && projectId && sheet.status !== "Approved" && (
        <p className="text-xs text-muted-foreground">A customer change request requires an approved project input baseline. Current baseline: Rev {sheet.revision} · {sheet.status}.</p>
      )}
      <div className="space-y-2">
        {(query.data?.requests || []).map((request) => {
          const isRequester = membership?.membershipId === request.requested_by;
          const canReviewImpact = membership?.role === "department_lead" && request.status === "Impact review";
          const canDecide = membership?.role === "admin" &&
            membership.membershipId !== request.requested_by &&
            request.status === "Pending approval";
          return (
            <article key={request.id} className="rounded border border-border/60 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold">{request.title}</h4>
                  <p className="text-[10px] text-muted-foreground">
                    {request.customer_reference || "No customer reference"} · Rev {request.baseline_revision} · {request.status} · v{request.version}
                  </p>
                </div>
                {isRequester && ["Draft", "Returned"].includes(request.status) && canAuthor && (
                  <Button size="sm" variant="outline" onClick={() => startEditing(request)}>Edit / rework</Button>
                )}
                {isRequester && request.status === "Draft" && canAuthor && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void send("submit", { requestId: request.id, expectedVersion: request.version })}
                  >
                    Submit for impact review
                  </Button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[11px]">{request.description}</p>
              <p className="mt-1 whitespace-pre-wrap text-[10px] text-muted-foreground">{request.rationale}</p>
              <div className="mt-2 space-y-1">
                {changedParameters(request).map((key) => (
                  <p className="text-[10px]" key={key}>
                    {parameters.find((parameter) => parameter.id === key)?.label || key}: “{valueFor(request.before_values, key)}” → “{valueFor(request.proposed_values, key)}”
                  </p>
                ))}
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {(request.impacts || []).map((impact) => (
                  <div key={impact.id} className="rounded bg-muted/40 p-2 text-[10px]">
                    <p className="font-medium">{impact.department_code} · {impact.status}{impact.outcome ? ` · ${impact.outcome}` : ""}</p>
                    <p className="mt-1 text-muted-foreground">
                      Tracks: {impact.impact_scope.tracks.join(", ") || "—"} · Stages: {impact.impact_scope.stages.join(", ") || "—"}
                    </p>
                    <p className="text-muted-foreground">
                      Docs: {impact.impact_scope.documents.join(", ") || "—"} · BOM: {impact.impact_scope.bom.join(", ") || "—"} · Assets: {impact.impact_scope.reusableAssets.join(", ") || "—"}
                    </p>
                    {canReviewImpact && impact.department_code === membership?.departmentCode && impact.status === "Pending" && (
                      <ImpactAssessment impact={impact} request={request} onAssess={assessImpact} />
                    )}
                    {impact.assessment && <p className="mt-1 whitespace-pre-wrap">{impact.assessment}</p>}
                  </div>
                ))}
              </div>
              {request.decision_notes && <p className="mt-2 text-[10px]">Decision / rework notes: {request.decision_notes}</p>}
              {canDecide && <ChangeDecision request={request} onDecide={decide} />}
              {request.approved_revision && (
                <p className="mt-2 text-[10px] font-medium text-emerald-700">
                  Applied to canonical project input revision {request.approved_revision}; department confirmations must be repeated.
                </p>
              )}
              {(request.events || []).length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] font-medium">Immutable activity history · {request.events?.length}</summary>
                  {request.events?.map((event) => (
                    <p key={event.id} className="mt-1 text-[10px] text-muted-foreground">
                      {event.action} · {event.actor_name || event.actor_id} · {new Date(event.created_at).toLocaleString()}
                    </p>
                  ))}
                </details>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

import { automaticRecordReference, procurementTrack, revisionOptions, referenceAtRevision, sharedSupplierOptions } from "@/lib/record-form-options";
import { SharedSupplierSelect } from "./SharedSupplierSelect";
import { InlineSupplierModal, InlinePartModal, type SupplierRecordItem, type PartRecordItem } from "./InlineMasterModals";
import type { RecordField } from "@/lib/record-form-catalogue";
import { recordFormSpec, recordFields, recordFieldValues } from "@/lib/record-form-catalogue";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedTestWorkspace, mutateSharedTestWorkspace } from "@/lib/shared-test.functions";
import { getCoordination } from "./SharedProjectAnalysis";
import { DepartmentProjectWorkspace } from "./DepartmentProjectWorkspace";
import { SharedTestWorkspace } from "./SharedTestWorkspace";
import { ApprovalsFullPageView, type ApprovalRecord } from "./ApprovalsFullPageView";
import type { TaskRecord, TeamMember } from "./DepartmentLeadCoordinationCenter";
import type { TestMembership } from "@/lib/test-auth.functions";
import type { SharedJson, SharedTestAction } from "@/lib/shared-test.schema";
import { businessDate } from "@/lib/business-date";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
type Register = "Projects" | "Records" | "Tasks" | "Approvals" | "Documents";
export function SharedOperationalWorkspace({
  membership,
  view,
  darkMode,
  onLogout,
}: {
  membership: TestMembership;
  view: string;
  darkMode: boolean;
  onLogout: () => Promise<void>;
}) {
  const load = useServerFn(getSharedTestWorkspace),
    coordination = useServerFn(getCoordination),
    write = useServerFn(mutateSharedTestWorkspace);
  const query = useQuery({
    queryKey: ["shared-test-workspace", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 15000,
    retry: 1,
  });
  const common = useQuery({
    queryKey: ["project-coordination", membership.organizationId, membership.membershipId],
    queryFn: () => coordination(),
    refetchInterval: 15000,
    retry: 1,
  });
  const [scope, setScope] = useState("all"),
    [department, setDepartment] = useState(""),
    [advanced, setAdvanced] = useState<Register | null>(view === "vault" ? "Documents" : null);
  const [form, setForm] = useState<"create_project" | "create_record" | "update_record" | null>(
      null,
    ),
    [recordId, setRecordId] = useState(""),
    [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [inlineSupplierOpen, setInlineSupplierOpen] = useState(false),
    [inlinePartOpen, setInlinePartOpen] = useState(false);


  const lock = useRef(false),
    retry = useRef<{ signature: string; id: string } | null>(null);
  async function save(action: SharedTestAction, payload: Record<string, SharedJson>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    const signature = JSON.stringify([action, payload]);
    if (retry.current?.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    try {
      await write({ data: { action, payload, requestId: retry.current.id } });
      retry.current = null;
      setNotice("Saved to the shared workspace.");
      setForm(null);
      await Promise.all([query.refetch(), common.refetch()]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Your input is preserved.");
      void query.refetch();
      return false;
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  if (query.isPending)
    return <p className="text-sm text-muted-foreground">Loading your shared workspace…</p>;
  if (query.error || !query.data)
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p role="alert">
          {query.error instanceof Error ? query.error.message : "Shared data unavailable"}
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  const data = query.data,
    actor = data.membership;
  const actorDeptId = data.departments.find((d) => d.code === actor.department_code)?.id || "";
  const purDeptId = data.departments.find((d) => d.code === "PUR")?.id || actorDeptId || "";

  const canAddSupplier = actor.role === "admin" || actor.department_code === "PUR";
  const canAddPart = actor.role === "admin" || ["EHW", "FW", "SW", "MECH", "PUR"].includes(actor.department_code || "");

  async function handleSharedSupplierCreated(supplier: SupplierRecordItem) {
    const res = (await write({
      data: {
        action: "create_record",
        payload: {
          title: supplier.name,
          reference: `HLPL-SUP-${Date.now().toString().slice(-4)}`,
          record_type: "Supplier",
          department_id: purDeptId,
          fields: {
            name: supplier.name,
            category: supplier.category,
            spocName: supplier.spocName,
            spocEmail: supplier.spocEmail || "",
            spocPhone: supplier.spocPhone || "",
            verification_status: "Pending_Verification",
            revision: "01",
          },
          notes: "Inline registered supplier · Pending Verification",
        },
        requestId: crypto.randomUUID(),
      },
    })) as { id?: string } | null;
    await Promise.all([query.refetch(), common.refetch()]);
    const createdId = res?.id || supplier.id;
    setValues((prev) => ({
      ...prev,
      supplier: createdId,
      supplierId: createdId,
      supplierName: supplier.name,
    }));
    setNotice(`Supplier ${supplier.name} saved to Supplier Master.`);
    setInlineSupplierOpen(false);
  }

  async function handleSharedPartCreated(part: PartRecordItem) {
    const res = (await write({
      data: {
        action: "create_record",
        payload: {
          title: `${part.mpn} · ${part.description}`,
          reference: `HLPL-PRT-${Date.now().toString().slice(-4)}`,
          record_type: "Part",
          department_id: actorDeptId,
          fields: {
            mpn: part.mpn,
            description: part.description,
            manufacturer: part.manufacturer || "",
            packageFootprint: part.packageFootprint || "",
            category: part.category,
            release_status: "Engineering_Only",
            revision: "01",
          },
          notes: "Inline registered component · Engineering Only",
        },
        requestId: crypto.randomUUID(),
      },
    })) as { id?: string } | null;
    await Promise.all([query.refetch(), common.refetch()]);
    const createdId = res?.id || part.id;
    setValues((prev) => ({
      ...prev,
      part: createdId,
      partId: createdId,
      mpn: part.mpn,
    }));
    setNotice(`Component ${part.mpn} saved to Part Master.`);
    setInlinePartOpen(false);
  }
  const selectedDepartment =
    department || data.departments.find((d) => d.code === actor.department_code)?.id || "";
  const dept = data.departments.find((d) => d.id === selectedDepartment);
  const spec = recordFormSpec(dept?.code || actor.department_code || "");
  const supplierOptions = sharedSupplierOptions(data.records);
  const originalRecord = data.records.find(r => r.id === recordId);
  const generatedReferenceBase = automaticRecordReference(data.records.find(r => r.id === values["projectId"] && r.record_type === "Project")?.reference || "", dept?.code || "", values["record_type"] || "");
  const revisions = revisionOptions(form === "update_record" ? originalRecord?.reference || "" : generatedReferenceBase, data.records, form === "update_record" ? String(originalRecord?.fields["revision"] || "01") : undefined);
  const selectedRevision = revisions.some(option => option.value === values["revision"]) ? values["revision"]! : revisions[0]!.value;

  const renderFieldInput = (field: RecordField) => {
    if (field.master === "suppliers") {
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SharedSupplierSelect
              options={supplierOptions}
              value={values[field.key] || ""}
              onChange={(value) => setValues({ ...values, [field.key]: value, supplierId: value })}
            />
          </div>
          {canAddSupplier && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 h-9 text-xs"
              onClick={() => setInlineSupplierOpen(true)}
            >
              + Add Supplier
            </Button>
          )}
        </div>
      );
    }
    if (field.master === "parts") {
      const partOptions = Array.from(
        new Set(
          data.records
            .filter((r) => r.record_type.toLowerCase() === "part" && !["archived", "obsolete"].includes(r.status.toLowerCase()))
            .map((r) => String(r.fields["mpn"] || r.reference || r.title))
            .filter(Boolean),
        ),
      );
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            {partOptions.length > 0 ? (
              <select
                className={fieldClass}
                required={field.required}
                value={values[field.key] || ""}
                onChange={(e) => {
                  const selectedPart = data.records.find(
                    (r) =>
                      r.record_type.toLowerCase() === "part" &&
                      (r.id === e.target.value ||
                        String(r.fields["mpn"] || "") === e.target.value ||
                        r.reference === e.target.value),
                  );
                  setValues({
                    ...values,
                    [field.key]: e.target.value,
                    partId: selectedPart?.id || e.target.value,
                    mpn: (selectedPart?.fields["mpn"] as string) || e.target.value,
                  });
                }}
              >
                <option value="">Choose part / MPN…</option>
                {partOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={fieldClass}
                type="text"
                required={field.required}
                placeholder="Enter MPN or click + Add Part"
                value={values[field.key] || ""}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value, mpn: e.target.value })}
              />
            )}
          </div>
          {canAddPart && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 h-9 text-xs"
              onClick={() => setInlinePartOpen(true)}
            >
              + Add Part
            </Button>
          )}
        </div>
      );
    }
    if (field.options) {
      return (
        <select
          className={fieldClass}
          required={field.required}
          value={values[field.key] || ""}
          onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
        >
          <option value="">Choose…</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        className={fieldClass}
        type={field.kind === "date" ? "date" : "text"}
        required={field.required}
        value={values[field.key] || ""}
        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
      />
    );
  };

  const generatedReference = generatedReferenceBase ? referenceAtRevision(generatedReferenceBase, selectedRevision) : "";
  const source = data.records.filter(
    (r) =>
      !selectedDepartment || r.department_id === selectedDepartment || r.record_type === "Project",
  );
  const byId = new Map((common.error ? [] : common.data?.records || []).map((r) => [r.id, r]));
  const status = (value: string): TaskRecord["status"] =>
    (({
      draft: "Draft",
      open: "Open",
      "in progress": "Open",
      "in review": "In review",
      approved: "Approved",
      released: "Released",
      complete: "Released",
      completed: "Released",
      archived: "Archived",
    })[value.toLowerCase()] || "Open") as TaskRecord["status"];
  const projectRows: TaskRecord[] = source
    .filter((r) => r.record_type === "Project")
    .map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      type: r.record_type,
      status: status(r.status),
      priority: "Normal",
      area: actor.department_code?.toLowerCase() || "home",
      createdAt: r.updated_at,
      updatedAt: r.updated_at,
      notes: r.notes,
      fields: {
        ...Object.fromEntries(
          Object.entries(r.fields).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        ),
        lifecycleStage: r.stage || "",
      },
    }));
  const records: TaskRecord[] = [
    ...source
      .filter((r) => r.record_type !== "Project")
      .map((r) => ({
        id: r.id,
        reference: r.reference,
        title: r.title,
        type: r.record_type,
        status: status(r.status),
        priority: "Normal" as const,
        area: actor.department_code?.toLowerCase() || "home",
        createdAt: r.updated_at,
        updatedAt: r.updated_at,
        notes: r.notes,
        fields: {
          ...Object.fromEntries(
            Object.entries(r.fields).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          ),
          projectId: byId.get(r.id)?.fields["projectId"] || "",
        },
      })),
    ...data.tasks
      .filter(
        (t) =>
          (!selectedDepartment || t.department_id === selectedDepartment) &&
          (actor.role !== "member" || t.assignee_id === actor.membership_id),
      )
      .map((t) => ({
        id: t.id,
        reference: `TASK-${t.id.slice(0, 8)}`,
        title: t.title,
        type: "Task",
        status: status(t.status),
        priority: (["Critical", "High", "Normal", "Low"].includes(t.priority)
          ? t.priority
          : "Normal") as TaskRecord["priority"],
        area: actor.department_code?.toLowerCase() || "home",
        createdAt: t.updated_at,
        updatedAt: t.updated_at,
        notes: "",
        fields: {
          projectId: t.record_id || "",
          assignee: data.members.find((m) => m.id === t.assignee_id)?.display_name || "Unassigned",
          dueDate: t.due_at ? businessDate(new Date(t.due_at)) : "",
          workStatus: t.status === "In Progress" ? "In progress" : "To do",
        },
      })),
  ];
  const team: TeamMember[] = data.members
    .filter((m) => !selectedDepartment || m.department_id === selectedDepartment)
    .map((m) => ({
      name: m.display_name || m.id,
      area: actor.department_code?.toLowerCase() || "home",
      role: m.role,
      score: "Not recorded",
      level: "Not recorded",
      skills: [],
    }));
  const approvals: ApprovalRecord[] = data.approvals.map((a) => ({
    id: a.id,
    title: a.title,
    recordId: a.record_id || "",
    outcome: ({
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      returned: "Returned",
    }[a.outcome] || "Pending") as ApprovalRecord["outcome"],
    updatedAt: a.updated_at,
    comments: a.decision_notes,
    department: data.departments.find((d) => d.id === a.reviewer_department_id)?.code,
    description: a.evidence_revision
      ? `Evidence revision ${a.evidence_revision}`
      : "Evidence not recorded",
  }));
  function openCreate(kind: "create_project" | "create_record") {
    setForm(kind);
    setRecordId("");
    setValues({
      revision: "01",
      projectId: projectRows.find((p) => [p.id, p.reference].includes(scope))?.id || "",
      record_type: spec?.types[0] || "",
      procurementTrack: procurementTrack(spec?.types[0] || "") || "",
    });
    setError("");
  }
  function openRecord(id: string) {
    const r = data.records.find((r) => r.id === id);
    if (!r) {
      setAdvanced("Tasks");
      return;
    }
    if (r.record_type === "Project") {
      setScope(r.reference);
      return;
    }
    setRecordId(r.id);
    setValues({
      ...Object.fromEntries(
        Object.entries(r.fields).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
      notes: r.notes,
    });
    setError("");
    setForm("update_record");
  }
  async function updateTask(id: string, patch: Partial<TaskRecord>) {
    const task = data.tasks.find((t) => t.id === id);
    if (!task) return;
    const targetStatus =
      patch.status === "Released"
        ? "Complete"
        : patch.status === "In review"
          ? "In review"
          : patch.fields?.["workStatus"] === "In progress"
            ? "In Progress"
            : patch.status === "Open"
              ? "Open"
              : task.status;
    const payload: Record<string, SharedJson> = {
      id,
      status: targetStatus,
      expected_updated_at: task.updated_at,
    };
    if (patch.fields?.["assignee"] !== undefined) {
      if (actor.role !== "department_lead") {
        setError("Only the department lead can reassign tasks.");
        return;
      }
      const matches = data.members.filter(
        (m) =>
          m.display_name === patch.fields!["assignee"] && m.department_id === task.department_id,
      );
      if (matches.length !== 1) {
        setError("Choose one verified department member.");
        return;
      }
      payload["assignee_id"] = matches[0]!.id;
    }
    await save("update_task", payload);
  }
  async function decide(id: string, outcome: string, notes?: string) {
    const approval = data.approvals.find((a) => a.id === id);
    return approval
      ? save("decide_approval", {
          id,
          outcome,
          notes: notes || "",
          expected_updated_at: approval.updated_at,
        })
      : false;
  }
  if (advanced)
    return (
      <section className="space-y-3">
        <Button variant="outline" onClick={() => setAdvanced(null)}>
          Back to project workspace
        </Button>
        <SharedTestWorkspace
          membership={membership}
          initialTab={advanced}
          darkMode={darkMode}
          onLogout={onLogout}
        />
      </section>
    );
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded border border-primary/30 bg-primary/10 px-2 py-1 text-xs">
          TEST · {actor.display_name}
        </span>
        <div className="flex gap-2">
          {actor.role === "admin" && (
            <select
              aria-label="Workspace department"
              className={fieldClass}
              value={selectedDepartment}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All departments</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={() => setAdvanced("Documents")}>
            Document files
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-600">
          {notice}
        </p>
      )}
      {busy && <p className="text-xs">Saving…</p>}
      {view === "approvals" ? (
        <ApprovalsFullPageView
          approvals={approvals}
          projects={projectRows}
          records={records}
          currentUser={actor.display_name}
          userRole={actor.role === "member" ? "Employee" : "Lead"}
          onBack={() => setAdvanced("Tasks")}
          onApprove={(id, notes) => decide(id, "approved", notes)}
          onReject={(id, reason) => decide(id, "rejected", reason)}
          onReturn={(id, reason) => decide(id, "returned", reason)}
        />
      ) : (
        <DepartmentProjectWorkspace
          departmentCode={dept?.code || actor.department_code || "ALL"}
          departmentName={dept?.name || actor.department_name || "Projects"}
          lead={
            data.members.find((m) => m.id === dept?.lead_member_id)?.display_name || "Not recorded"
          }
          records={records}
          projects={projectRows}
          documents={data.documents
            .filter((d) => !selectedDepartment || d.department_id === selectedDepartment)
            .map((d) => ({
              id: d.id,
              title: d.title,
              type: d.document_type,
              linkedRecordRefs: d.record_id ? [d.record_id] : [],
            }))}
          approvals={approvals}
          team={team}
          projectScope={scope}
          onProjectChange={setScope}
          initialTab={
            view === "assignee"
              ? "tasks"
              : view === "records"
                ? "records"
                : view === "deliverables"
                  ? "deliverables"
                  : undefined
          }
          onCreateRecord={() => openCreate("create_record")}
          onCreateDeliverable={() => setAdvanced("Documents")}
          onCreateProject={
            actor.role === "admin" ||
            (actor.role === "department_lead" && actor.department_code === "SAL")
              ? () => openCreate("create_project")
              : undefined
          }
          onOpenRecord={openRecord}
          onOpenDocument={() => setAdvanced("Documents")}
          onUpdateTask={(id, patch) => void updateTask(id, patch)}
          onCreateTask={async (task) => {
            const project = projectRows.find((p) => [p.id, p.reference].includes(task.projectId));
            if (!project) {
              setError("Select a saved project first.");
              return false;
            }
            const matches = data.members.filter(
              (m) =>
                m.display_name === task.assignee &&
                (!selectedDepartment || m.department_id === selectedDepartment),
            );
            if (task.assignee && matches.length !== 1) {
              setError("Choose one verified member.");
              return false;
            }
            return save("create_task", {
              project_id: project.id,
              department_id: selectedDepartment,
              title: task.title,
              priority: task.priority,
              assignee_id: actor.role === "member" ? actor.membership_id : matches[0]?.id || null,
              due_at: task.dueDate
                ? new Date(`${task.dueDate}T17:00:00+05:30`).toISOString()
                : null,
            });
          }}
        />
      )}
      <Dialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setForm(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form === "update_record"
                ? "Edit original record"
                : form === "create_project"
                  ? "New project"
                  : "New record"}
            </DialogTitle>
            <DialogDescription>
              Saved using your authenticated identity. Formal approvals use their original workflow.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form) return;
              if (form === "update_record") {
                const original = data.records.find((r) => r.id === recordId);
                if (!original) return;
                const fields: Record<string,string> = {...values, revision:selectedRevision}; const notes = fields["notes"]; delete fields["notes"];
                void save("update_record", {
                  record_id: recordId,
                  expected_updated_at: original.updated_at,
                  fields: { ...original.fields, ...fields },
                  notes: notes || "",
                });
              } else {
                let fields;
                try {
                  if (form === "create_record" && !spec) throw new Error("No record types configured for this department.");
                  fields = form === "create_record" ? recordFieldValues(spec!, values["record_type"] || "", {...values, revision:selectedRevision, ...(procurementTrack(values["record_type"] || "") ? {procurementTrack:procurementTrack(values["record_type"] || "")!} : {})}) : {};
                } catch (error) { setError(error instanceof Error ? error.message : "Invalid record fields."); return; }
                void save(form, {
                  title: values["title"] || "",
                  reference: form === "create_record" ? generatedReference : values["reference"] || "",
                  project_id: values["projectId"] || null,
                  department_id: selectedDepartment,
                  record_type: values["record_type"] || "",
                  fields,
                  notes: values["notes"] || "",
                });
              }
            }}
          >
            {form !== "update_record" && (
              <>
                {["title", "reference"].map((key) => (
                  <label key={key} className="grid gap-1 text-xs">
                    {key === "reference" ? (form === "create_record" ? "Reference · Automatic" : "Project code") : "Title"}
                    <input
                      className={fieldClass}
                      required
                      value={key === "reference" && form === "create_record" ? generatedReference : values[key] || ""}
                      readOnly={key === "reference" && form === "create_record"}
                      placeholder={key === "reference" && form === "create_record" ? "Select project and record type" : undefined}
                      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                    />
                  </label>
                ))}
                {form === "create_record" && (
                  <>
                    <label className="grid gap-1 text-xs">
                      Project ({projectRows.length} available)
                      <select
                        className={fieldClass}
                        required
                        value={values["projectId"] || ""}
                        onChange={(e) => setValues({ ...values, projectId: e.target.value })}
                      >
                        <option value="">Choose…</option>
                        {projectRows.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.reference} · {p.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs">
                      Record type
                      <select className={fieldClass} required value={values["record_type"] || ""}
                        onChange={(e) => setValues({title: values["title"] || "", reference: form === "create_record" ? generatedReference : values["reference"] || "", projectId: values["projectId"] || "", revision: values["revision"] || "01", notes: values["notes"] || "", record_type: e.target.value, procurementTrack: procurementTrack(e.target.value) || ""})}>
                        <option value="">Choose record type…</option>
                        {(spec?.types || []).map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    {spec && recordFields(spec, values["record_type"] || "").filter(field => field.key !== "procurementTrack" || !procurementTrack(values["record_type"] || "")).map(field => (
                      <label key={field.key} className="grid gap-1 text-xs">{field.label}
                        {renderFieldInput(field)}
                      </label>
                    ))}
                  </>
                )}
              </>
            )}
                    {form === "update_record" && spec && recordFields(spec, data.records.find(r => r.id === recordId)?.record_type || "").filter(field => field.key !== "procurementTrack" || !procurementTrack(originalRecord?.record_type || "")).map(field => (
                      <label key={field.key} className="grid gap-1 text-xs">{field.label}
                        {renderFieldInput(field)}
                      </label>
                    ))}
            {form !== "create_project" && (
              <label className="grid gap-1 text-xs">
                Revision
                <select className={fieldClass} required value={selectedRevision} onChange={e => setValues({...values,revision:e.target.value})}>
                  {revisions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">Sequence is based on this record reference, not other projects or record types.</span>
              </label>
            )}
            <label className="grid gap-1 text-xs">
              Notes
              <textarea
                className={fieldClass}
                value={values["notes"] || ""}
                onChange={(e) => setValues({ ...values, notes: e.target.value })}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button disabled={busy}>Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {inlineSupplierOpen && (
        <InlineSupplierModal
          onClose={() => setInlineSupplierOpen(false)}
          onSupplierCreated={handleSharedSupplierCreated}
        />
      )}
      {inlinePartOpen && (
        <InlinePartModal
          onClose={() => setInlinePartOpen(false)}
          onPartCreated={handleSharedPartCreated}
        />
      )}
    </section>
  );
}

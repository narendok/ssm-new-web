import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import type { TestMembership } from "@/lib/test-auth.functions";
import { isSelectableMasterStatus } from "@/lib/shared-master-options";
import { SharedMasterSelect } from "./SharedMasterSelect";
import { Button } from "./ui/button";

const card = "rounded-xl border border-border bg-card p-4";
const text = (value: unknown) => (typeof value === "string" ? value : "");

export function SharedSupplyChainWorkspace({
  membership,
  view,
  onOpenRecords,
  onOpenOrders,
}: {
  membership: TestMembership;
  view: "smart_bom" | "ingestion_gate";
  onOpenRecords: (recordType: string) => void;
  onOpenOrders: () => void;
}) {
  const load = useServerFn(getSharedTestWorkspace);
  const query = useQuery({
    queryKey: ["shared-test-workspace", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 15000,
    retry: false,
  });
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const data = query.data;
  const projects =
    data?.records.filter(
      (record) => record.record_type === "Project" && isSelectableMasterStatus(record.status),
    ) ?? [];
  const projectId = projects.some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : (projects[0]?.id ?? "");
  const project = projects.find((record) => record.id === projectId);
  const selectedProjectReferences = new Set(
    [
      project?.id,
      project?.reference,
      project?.fields["projectId"],
      project?.fields["project_id"],
    ].filter((value): value is string => typeof value === "string" && value.length > 0),
  );
  const linkedToProject = (record: (typeof projects)[number]) =>
    [record.fields["projectId"], record.fields["project_id"], record.fields["project"]].some(
      (value) => typeof value === "string" && selectedProjectReferences.has(value),
    );
  const linkedRecords = data?.records.filter((record) => linkedToProject(record)) ?? [];
  const bomRecords = linkedRecords.filter((record) =>
    /\bbom\b|bill of materials/i.test(record.record_type),
  );
  const purchaseRecords = linkedRecords.filter((record) =>
    /purchase order|supplier quotation|goods receipt|supplier invoice/i.test(record.record_type),
  );
  const parts = data?.partOptions.filter((part) => isSelectableMasterStatus(part.status)) ?? [];
  const suppliers =
    data?.supplierOptions.filter((supplier) => isSelectableMasterStatus(supplier.status)) ?? [];

  if (query.isPending)
    return <section className={card}>Loading shared supply-chain records…</section>;
  if (query.isError || !data) {
    return (
      <section className={card}>
        <h1 className="text-lg font-semibold">Shared supply-chain records unavailable</h1>
        <p role="alert" className="mt-2 text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : "No shared data returned."}
        </p>
        <Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </section>
    );
  }

  const isBom = view === "smart_bom";
  return (
    <main className="space-y-4">
      <header className={card}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Authenticated Shared TEST
        </p>
        <h1 className="mt-1 text-lg font-semibold">
          {isBom ? "Shared project BOM records" : "Shared purchasing and ingestion status"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {isBom
            ? "This view reads only saved project and component records. It does not show the browser-local sample BOM or imply that a BOM revision has been released."
            : "This view reads saved supplier, component, quotation and purchase records. File parsing and automatic PO creation are not connected to Shared TEST yet."}
        </p>
      </header>

      <section className={`${card} space-y-4`}>
        <SharedMasterSelect
          label="Project"
          value={projectId}
          options={projects.map((record) => ({
            value: record.id,
            label: `${record.reference} · ${record.title}`,
          }))}
          onChange={setSelectedProjectId}
          required
        />
        {project && (
          <p className="text-xs text-muted-foreground">
            Selected {project.reference} ·{" "}
            {text(project.fields["customerName"]) || "Customer link not recorded"}
          </p>
        )}
      </section>

      {isBom ? (
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">Saved BOM records · {bomRecords.length}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Canonical component masters available to this account: {parts.length}. No separate
                line-item ledger is installed in Shared TEST.
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenRecords("BOM")}>
              Open shared BOM records
            </Button>
          </div>
          {bomRecords.length ? (
            <ul className="mt-4 divide-y divide-border">
              {bomRecords.map((record) => (
                <li key={record.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                  <span>
                    {record.reference} · {record.title}
                  </span>
                  <span className="text-muted-foreground">
                    {record.status} · rev {text(record.fields["revision"]) || "not recorded"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No linked BOM record is currently visible for this project.
            </p>
          )}
        </section>
      ) : (
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">Shared supply records · {purchaseRecords.length}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Selectable supplier masters: {suppliers.length} · selectable part masters:{" "}
                {parts.length}. No file was parsed or saved here.
              </p>
            </div>
            <Button variant="outline" onClick={onOpenOrders}>
              Open shared PO drafts
            </Button>
          </div>
          {purchaseRecords.length ? (
            <ul className="mt-4 divide-y divide-border">
              {purchaseRecords.map((record) => (
                <li key={record.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                  <span>
                    {record.reference} · {record.title}
                  </span>
                  <span className="text-muted-foreground">
                    {record.record_type} · {record.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No linked shared purchasing record is currently visible for this project.
            </p>
          )}
        </section>
      )}
    </main>
  );
}

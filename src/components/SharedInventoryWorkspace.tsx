import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LiveInventoryWorkspace, type LiveInventoryWorkspaceProps } from "./LiveInventoryWorkspace";
import { getSharedInventoryPartCatalog, recordSharedInventoryEvent } from "@/lib/shared-inventory.functions";
import type { SharedInventoryEventInput } from "@/lib/shared-inventory.schema";

type Props = Omit<LiveInventoryWorkspaceProps,
  | "sharedPartMasters" | "sharedPartCatalogState" | "sharedInventoryProjects"
  | "sharedInventoryRoles" | "sharedInventoryReceiptOptions" | "sharedInventoryAssignments"
  | "sharedInventoryMovements" | "onSharedInventoryEvent" | "sharedInventoryActionPending" | "sharedInventoryActionError"
> & {
  membershipId: string;
};

export function SharedInventoryWorkspace({ membershipId, ...workspaceProps }: Props) {
  const loadCatalog = useServerFn(getSharedInventoryPartCatalog);
  const writeEvent = useServerFn(recordSharedInventoryEvent);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const catalog = useQuery({
    queryKey: ["shared-inventory-part-catalog", membershipId],
    queryFn: () => loadCatalog(),
    retry: false,
  });
  const state = catalog.isPending ? "loading" : catalog.isError ? "error" : "ready";

  async function recordEvent(input: SharedInventoryEventInput) {
    setActionPending(true);
    setActionError("");
    try {
      const result = await writeEvent({ data: input });
      if (!result.eventId) throw new Error("Shared TEST did not confirm the inventory event.");
      await catalog.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shared inventory event failed.";
      setActionError(message);
      throw new Error(message);
    } finally {
      setActionPending(false);
    }
  }

  return (
    <LiveInventoryWorkspace
      {...workspaceProps}
      sharedPartMasters={catalog.data?.items}
      sharedPartCatalogState={state}
      sharedInventoryProjects={catalog.data?.projects}
      sharedInventoryRoles={catalog.data?.roles}
      sharedInventoryReceiptOptions={catalog.data?.receiptOptions}
      sharedInventoryAssignments={catalog.data?.assignments}
      sharedInventoryMovements={catalog.data?.movements}
      onSharedInventoryEvent={recordEvent}
      sharedInventoryActionPending={actionPending}
      sharedInventoryActionError={actionError}
    />
  );
}

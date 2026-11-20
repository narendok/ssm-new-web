import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LiveInventoryWorkspace, type LiveInventoryWorkspaceProps } from "./LiveInventoryWorkspace";
import { getSharedInventoryPartCatalog, issueSharedInventoryBomKit, recordSharedInventoryEvent } from "@/lib/shared-inventory.functions";
import type { SharedInventoryEventInput, SharedInventoryKitIssueInput } from "@/lib/shared-inventory.schema";

type Props = Omit<LiveInventoryWorkspaceProps,
  | "sharedPartMasters" | "sharedPartCatalogState" | "sharedInventoryProjects"
  | "sharedInventoryRoles" | "sharedInventoryReceiptOptions" | "sharedInventoryAssignments"
  | "sharedInventoryMovements" | "sharedInventoryKitBoms" | "onSharedInventoryEvent" | "onIssueSharedInventoryKit" | "sharedInventoryActionPending" | "sharedInventoryActionError"
  | "canAdjustSharedInventory"
> & {
  membershipId: string;
  canAdjustSharedInventory: boolean;
};

export function SharedInventoryWorkspace({ membershipId, canAdjustSharedInventory, ...workspaceProps }: Props) {
  const loadCatalog = useServerFn(getSharedInventoryPartCatalog);
  const writeEvent = useServerFn(recordSharedInventoryEvent);
  const writeKitIssue = useServerFn(issueSharedInventoryBomKit);
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

  async function issueKit(input: SharedInventoryKitIssueInput) {
    setActionPending(true);
    setActionError("");
    try {
      const result = await writeKitIssue({ data: input });
      if (!result.kitIssueId) throw new Error("Shared TEST did not confirm the BOM kit issue.");
      await catalog.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "BOM kit issue failed.";
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
      sharedInventoryKitBoms={catalog.data?.kitBoms ?? []}
      assetRegistryMode="unavailable"
      canAdjustSharedInventory={canAdjustSharedInventory}
      onSharedInventoryEvent={recordEvent}
      onIssueSharedInventoryKit={issueKit}
      sharedInventoryActionPending={actionPending}
      sharedInventoryActionError={actionError}
    />
  );
}

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LiveInventoryWorkspace, type LiveInventoryWorkspaceProps } from "./LiveInventoryWorkspace";
import { getSharedInventoryPartCatalog } from "@/lib/shared-inventory.functions";

type Props = Omit<LiveInventoryWorkspaceProps, "sharedPartMasters" | "sharedPartCatalogState"> & {
  membershipId: string;
};

export function SharedInventoryWorkspace({ membershipId, ...workspaceProps }: Props) {
  const loadCatalog = useServerFn(getSharedInventoryPartCatalog);
  const catalog = useQuery({
    queryKey: ["shared-inventory-part-catalog", membershipId],
    queryFn: () => loadCatalog(),
    retry: false,
  });
  const state = catalog.isPending ? "loading" : catalog.isError ? "error" : "ready";

  return (
    <LiveInventoryWorkspace
      {...workspaceProps}
      sharedPartMasters={catalog.data?.items}
      sharedPartCatalogState={state}
    />
  );
}

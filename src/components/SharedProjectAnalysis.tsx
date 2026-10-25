import { useQuery } from "@tanstack/react-query";
import { useServerFn, createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ProjectAnalysisOverview } from "./ProjectAnalysisOverview";
import type { TestMembership } from "@/lib/test-auth.functions";
import type { AnalysisRecord, AnalysisDocument } from "@/lib/project-analysis-data";
import type { Json } from "@/integrations/supabase/types";

export const getCoordination = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rpc = context.supabase as unknown as {
      rpc(name: string): Promise<{ data: Json; error: { message: string } | null }>;
    };
    const { data, error } = await rpc.rpc("get_project_coordination");
    if (error) throw new Error(error.message);
    return data as unknown as { records: AnalysisRecord[]; documents: AnalysisDocument[] };
  });

export function SharedProjectAnalysis({
  membership,
  onOpenProject,
}: {
  membership: TestMembership;
  onOpenProject?: ((project: AnalysisRecord) => void) | undefined;
}) {
  const load = useServerFn(getCoordination);
  const query = useQuery({
    queryKey: ["project-coordination", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 15000,
    retry: 1,
  });

  const serverRecords = query.data?.records || [];
  const serverDocuments = query.data?.documents || [];

  return (
    <div className="space-y-4">
      {query.isPending && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Syncing shared project inputs from database…
        </p>
      )}
      {query.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>
            Shared database coordination unavailable (
            {query.error instanceof Error ? query.error.message : "network/auth error"}
            ).
          </span>
          <button
            type="button"
            className="underline font-semibold cursor-pointer"
            onClick={() => void query.refetch()}
          >
            Retry sync
          </button>
        </div>
      )}
      <ProjectAnalysisOverview
        showReferenceScenarios={false}
        projects={serverRecords.filter((r) => r.type === "Project")}
        records={serverRecords}
        documents={serverDocuments}
        onOpenProject={onOpenProject}
      />
    </div>
  );
}

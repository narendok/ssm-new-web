import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn, createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ProjectAnalysisOverview } from "./ProjectAnalysisOverview";
import type { TestMembership } from "@/lib/test-auth.functions";
import type { AnalysisRecord, AnalysisDocument } from "@/lib/project-analysis-data";
import { getAllScenarioFixtures } from "@/lib/lifecycle-scenarios";
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

  const scenarioFixtures = useMemo(() => getAllScenarioFixtures(), []);

  // Seamlessly merge server records with scenario fixtures without reference duplication
  const combinedRecords = useMemo(() => {
    const serverRecords = query.data?.records || [];
    const serverRefs = new Set(serverRecords.map((r) => r.reference));
    const uniqueFixtures = scenarioFixtures.records.filter((r) => !serverRefs.has(r.reference));
    return [...serverRecords, ...uniqueFixtures];
  }, [query.data?.records, scenarioFixtures]);

  const combinedDocuments = useMemo(() => {
    const serverDocs = query.data?.documents || [];
    const serverTitles = new Set(serverDocs.map((d) => d.title));
    const uniqueDocs = scenarioFixtures.documents.filter((d) => !serverTitles.has(d.title));
    return [...serverDocs, ...uniqueDocs];
  }, [query.data?.documents, scenarioFixtures]);

  return (
    <div className="space-y-4">
      {query.isPending && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Syncing shared project inputs from database…
        </p>
      )}
      {query.error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <span>
            Shared database coordination offline (
            {query.error instanceof Error ? query.error.message : "unavailable"}
            ). Displaying connected lifecycle scenario fixtures (§14.13 &amp; §14.14).
          </span>
          <button
            className="underline font-semibold"
            onClick={() => void query.refetch()}
          >
            Retry sync
          </button>
        </div>
      )}
      <ProjectAnalysisOverview
        projects={combinedRecords.filter((r) => r.type === "Project")}
        records={combinedRecords}
        documents={combinedDocuments}
        onOpenProject={onOpenProject}
      />
    </div>
  );
}

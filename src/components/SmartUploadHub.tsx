import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Layers3,
  PackageSearch,
  Upload,
  ShieldCheck,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ROLE_USE_CASE_PROFILES,
  type RoleCode,
  type RoleUseCaseProfile,
} from "@/lib/document-ingestion-profiles";
import { normalizeUploadDepartment, roleProfileAvailableToDepartment, smartUploadChoiceAvailable } from "@/lib/smart-upload-access";

const choices = [
  {
    id: "sor",
    title: "Customer SOR / requirements",
    destination: "SOR Importer → Opportunity Workspace",
    description:
      "Review client requirements and prepare an Opportunity with 426-parameter atomic intake.",
    icon: ClipboardList,
    badge: "Opportunity",
  },
  {
    id: "bom",
    title: "Project BOM / parts list",
    destination: "Purchasing Smart BOM Workspace",
    description: "Open the BOM workspace for project components, ASL check, and revision review.",
    icon: Layers3,
    badge: "Engineering BOM",
  },
  {
    id: "technical",
    title: "Drawings, datasheets & technical files",
    destination: "Document Vault (Technical Packages)",
    description: "Add controlled project or department documents with SHA-256 integrity and DRC checks.",
    icon: PackageSearch,
    badge: "ECAD / MCAD",
  },
  {
    id: "quotation",
    title: "Supplier quotation",
    destination: "Purchasing & Finance Review",
    description: "Keep the vendor offer for 3-quote comparative review without automatic PO creation.",
    icon: FileText,
    badge: "Sourcing",
  },
  {
    id: "invoice",
    title: "Supplier invoice",
    destination: "Finance Invoice Register",
    description: "Add invoice evidence as a draft for 3-way match without automatic payment release.",
    icon: FileText,
    badge: "Finance",
  },
  {
    id: "receipt",
    title: "Goods receipt / delivery evidence",
    destination: "Stores Gate Receipt Queue",
    description:
      "Attach receipt evidence and delivery challan without adjusting inventory balances.",
    icon: PackageSearch,
    badge: "Stores",
  },
  {
    id: "role",
    title: "Role / audit supporting document",
    destination: "Department Docs Vault",
    description: "File role-specific evidence in the document vault under its owning department.",
    icon: ClipboardList,
    badge: "Audit & QMS",
  },
  {
    id: "other",
    title: "Other role-related document",
    destination: "Document Vault Workbench",
    description: "Choose a document type, scope, and owning department in the shared upload form.",
    icon: FileText,
    badge: "Controlled File",
  },
] as const;

export type SmartUploadChoice = (typeof choices)[number]["id"];

export function SmartUploadHub({
  open,
  onClose,
  onChoose,
  onChooseRoleProfile,
  activeDepartmentCode,
  isAdmin = false,
  fullPage = false,
  sidebarExpanded = true,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (choice: SmartUploadChoice) => void;
  onChooseRoleProfile?: ((profile: RoleUseCaseProfile) => void) | undefined;
  activeDepartmentCode?: string | undefined;
  isAdmin?: boolean | undefined;
  fullPage?: boolean | undefined;
  sidebarExpanded?: boolean | undefined;
}) {
  const [activeTab, setActiveTab] = useState<"standard" | "roles">("standard");
  const departmentProfiles=ROLE_USE_CASE_PROFILES.filter(profile=>roleProfileAvailableToDepartment(profile,activeDepartmentCode,isAdmin));
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");

  const availableRoles = Array.from(
    new Set(departmentProfiles.map((p) => p.roleCode)),
  ).sort();
  const roleFilter:RoleCode|"ALL"=availableRoles.includes(selectedRoleFilter as RoleCode)?selectedRoleFilter as RoleCode:"ALL";
  const filteredProfiles = roleFilter === "ALL"
    ? departmentProfiles
    : departmentProfiles.filter((p) => p.roleCode === roleFilter);

  return (
    <Dialog open={open} modal={!fullPage} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        hideOverlay={fullPage}
        className={fullPage
          ? `!fixed !inset-x-0 !top-14 !bottom-0 !z-10 !h-auto !max-h-none !max-w-none !translate-x-0 !translate-y-0 !overflow-y-auto !rounded-none !border-0 !px-4 !py-5 !shadow-none sm:!px-6 ${sidebarExpanded ? "lg:!left-64" : "lg:!left-16"}`
          : "max-h-[90vh] overflow-y-auto sm:max-w-3xl"}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Upload className="size-5 text-primary" />
              Smart Upload & Document Ingestion
            </DialogTitle>
            <div className="flex items-center rounded-lg border border-input p-0.5 text-xs">
              <button
                type="button"
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  activeTab === "standard"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("standard")}
              >
                Standard Workflows
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  activeTab === "roles"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("roles")}
              >
                Role Profiles ({departmentProfiles.length})
              </button>
            </div>
          </div>
          <DialogDescription>
            One unified intake. Every upload preserves original file integrity, extracts structured
            fields, matches canonical masters, and saves as Draft without automatic side effects.
          </DialogDescription>
        </DialogHeader>

        {activeTab === "standard" && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {choices.filter(choice=>smartUploadChoiceAvailable(choice.id,activeDepartmentCode,isAdmin)).map(({ id, title, destination, description, icon: Icon, badge }) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                className="h-auto min-h-28 justify-start whitespace-normal border border-border/80 p-3.5 text-left transition-all hover:border-primary/50 hover:bg-muted/40"
                onClick={() => onChoose(id)}
              >
                <span className="flex w-full items-start gap-3">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="size-4 shrink-0" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-1 text-sm font-semibold text-foreground">
                      {title}
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </span>
                    <span className="mt-0.5 block text-[11px] font-medium text-primary/80">
                      → {destination}
                    </span>
                    <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">
                      {description}
                    </span>
                    <span className="mt-2 inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      <ShieldCheck className="size-3 text-emerald-600" />
                      Saved as Draft · {badge}
                    </span>
                  </span>
                </span>
              </Button>
            ))}
          </div>
        )}

        {activeTab === "roles" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 border-b pb-2">
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <SlidersHorizontal className="size-3" /> Filter Role:
              </span>
              <button
                type="button"
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  roleFilter === "ALL"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSelectedRoleFilter("ALL")}
              >
                {isAdmin?"All Roles (25)":`${normalizeUploadDepartment(activeDepartmentCode)} Roles`}
              </button>
              {availableRoles.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    roleFilter === code
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setSelectedRoleFilter(code)}
                >
                  {code}
                </button>
              ))}
            </div>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {filteredProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/50 hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] font-bold">
                        {profile.roleCode}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">
                        {profile.title}
                      </span>
                      <span className="text-xs text-muted-foreground">· {profile.roleName}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {profile.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5">
                        Formats: {profile.acceptedExtensions.join(", ")}
                      </span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                        Family: {profile.catalogueFamilyId} ({profile.catalogueFamilyName})
                      </span>
                      {profile.interlocksChecked.length > 0 && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
                          Interlock: {profile.interlocksChecked.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => {
                      if (onChooseRoleProfile) {
                        onChooseRoleProfile(profile);
                      } else {
                        onChoose("role");
                      }
                    }}
                  >
                    Select <ArrowRight className="ml-1 size-3" />
                  </Button>
                </div>
              ))}
              {!filteredProfiles.length&&<p role="note" className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-muted-foreground">No Smart Upload role profiles are mapped to this department. Ask Admin to configure an authoritative department mapping; another department’s profiles are hidden.</p>}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Guarded Intake Boundary:</strong> Uploading never automatically approves
              documents, releases to clients, creates purchase orders, or adjusts inventory.
            </span>
          </span>
          <span className="text-[11px] font-medium text-primary">
            Department-scoped choices · Draft-only
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

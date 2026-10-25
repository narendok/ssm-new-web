import React, { useState, useMemo } from "react";
import {
  Building2,
  Search,
  Users,
  CheckSquare,
  FileCheck2,
  FolderKanban,
  ArrowRight,
  ShieldCheck,
  Wrench,
  Terminal,
  Laptop,
  PackageSearch,
  Factory,
  ClipboardCheck,
  Bell,
  Settings2,
  UsersRound,
  Sparkles,
} from "lucide-react";

import type { AreaId } from "./RoleAwareSidebar";
export type { AreaId } from "./RoleAwareSidebar";

export interface DepartmentMeta {
  id: AreaId;
  code: string;
  name: string;
  category: "Engineering & R&D" | "Operations & SCM" | "Quality & Compliance" | "Commercial & Management";
  lead: string;
  leadRole: string;
  summary: string;
  icon: React.ElementType;
}

export const DEPARTMENTS_METADATA: DepartmentMeta[] = [
  {
    id: "ehw",
    code: "EHW",
    name: "Embedded Hardware Engineering",
    category: "Engineering & R&D",
    lead: "Avery Vale",
    leadRole: "Lead Hardware Systems Architect",
    summary: "HW_01–HW_37, PRS, schematics, BOM optimization, Gerber gates, and DFMA sign-offs.",
    icon: Wrench,
  },
  {
    id: "fw",
    code: "FW",
    name: "Firmware",
    category: "Engineering & R&D",
    lead: "Devon Lane",
    leadRole: "Principal Firmware Architect",
    summary: "RTOS kernel, HAL, peripheral drivers, CAN/LIN stacks, bootloader, and fail-safe FOTA.",
    icon: Terminal,
  },
  {
    id: "sw",
    code: "SW",
    name: "Cloud & Application Software",
    category: "Engineering & R&D",
    lead: "Siddharth Roy",
    leadRole: "Lead Software & Cloud Architect",
    summary: "Telematics backend, MQTT/HTTP protocols, mobile BLE app, and diagnostic GUI suites.",
    icon: Laptop,
  },
  {
    id: "mech",
    code: "MECH",
    name: "Mechanical Engineering",
    category: "Engineering & R&D",
    lead: "Samira Holt",
    leadRole: "Principal Mechanical Designer",
    summary: "3D CAD clearance, STEP modeling, tolerance stack-up, and mold tooling approvals.",
    icon: PackageSearch,
  },
  {
    id: "pur",
    code: "PUR",
    name: "Purchasing & SCM",
    category: "Operations & SCM",
    lead: "Morgan Reed",
    leadRole: "Supply Chain & SCM Lead",
    summary: "Smart BOM reviews, ASL/ACML governance, supplier pricing, PO issuance, and inventory.",
    icon: PackageSearch,
  },
  {
    id: "emf",
    code: "EMF",
    name: "Electronics Manufacturing",
    category: "Operations & SCM",
    lead: "Casey Rowan",
    leadRole: "Production Operations Lead",
    summary: "SMT line integration, harness routing, traveler cards, and box-build assembly.",
    icon: Factory,
  },
  {
    id: "mmf",
    code: "MMF",
    name: "Mechanical Manufacturing",
    category: "Operations & SCM",
    lead: "Mechanical Mfg Lead (Interim)",
    leadRole: "Tooling & Fabrication Head",
    summary: "Mechanical fabrication, surface finishing, subassembly, fit checks, and EMF handoff.",
    icon: Wrench,
  },
  {
    id: "qa",
    code: "QA",
    name: "Quality Assurance",
    category: "Quality & Compliance",
    lead: "Jordan Blake",
    leadRole: "Quality & Compliance Lead",
    summary: "IATF 16949 §8.3 compliance, APQP, DVP&R test matrix, incoming inspection, and 8D CAPA.",
    icon: ShieldCheck,
  },
  {
    id: "sales",
    code: "SAL",
    name: "Sales & Business Development",
    category: "Commercial & Management",
    lead: "Priya Sharma",
    leadRole: "Head of Sales & Strategic Accounts",
    summary: "Customer SOR intake, commercial lock, mutual NDA execution, and quotation baseline.",
    icon: UsersRound,
  },
  {
    id: "fin",
    code: "FIN",
    name: "Accounts & Finance",
    category: "Commercial & Management",
    lead: "Priya Voss",
    leadRole: "Finance & Accounts Controller",
    summary: "Department budget allocation, expense claims, billing milestones, and aging controls.",
    icon: ClipboardCheck,
  },
  {
    id: "sit",
    code: "SIT",
    name: "Service & IT",
    category: "Commercial & Management",
    lead: "Kai Morgan",
    leadRole: "IT Systems & Field Service Lead",
    summary: "Telemetry brokers, database backups, client ticketing, field service, and ISMS audits.",
    icon: Bell,
  },
  {
    id: "hrops",
    code: "HR",
    name: "HR & Operations",
    category: "Commercial & Management",
    lead: "Taylor Quinn",
    leadRole: "People & Operations Lead",
    summary: "Skills matrix, organizational governance, training records, and ISO/IATF policy audits.",
    icon: Settings2,
  },
];

interface CommonDepartmentSearchViewProps {
  currentDepartment: AreaId;
  onSelectDepartment: (deptId: AreaId, viewTab?: string) => void;
  openTaskCounts?: Record<string, number>;
  approvalCounts?: Record<string, number>;
  projectCounts?: Record<string, number>;
}

export function CommonDepartmentSearchView({
  currentDepartment,
  onSelectDepartment,
  openTaskCounts = {},
  approvalCounts = {},
  projectCounts = {},
}: CommonDepartmentSearchViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = [
    "All",
    "Engineering & R&D",
    "Operations & SCM",
    "Quality & Compliance",
    "Commercial & Management",
  ];

  const filteredDepartments = useMemo(() => {
    return DEPARTMENTS_METADATA.filter((dept) => {
      // Category filter
      if (selectedCategory !== "All" && dept.category !== selectedCategory) {
        return false;
      }
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = dept.code.toLowerCase().includes(q);
        const matchName = dept.name.toLowerCase().includes(q);
        const matchLead = dept.lead.toLowerCase().includes(q);
        const matchSummary = dept.summary.toLowerCase().includes(q);
        return matchCode || matchName || matchLead || matchSummary;
      }
      return true;
    });
  }, [searchQuery, selectedCategory]);

  const totalTasks = Object.values(openTaskCounts).reduce((a, b) => a + b, 0);
  const totalApprovals = Object.values(approvalCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-primary/30 bg-linear-to-r from-primary/10 via-card to-background p-6 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/20 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-primary border border-primary/40">
                EXECUTIVE OVERSIGHT
              </span>
              <span className="text-xs text-muted-foreground">· Single Centralized Directory</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              All Departments Directory & Common Search
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Search and inspect all 12 operational departments across engineering, supply chain, quality, and commercial domains. Select any department to enter its active workspace.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-border bg-card/80 px-4 py-2 text-center shadow-2xs">
              <span className="block font-mono text-xl font-bold text-foreground">12</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Departments</span>
            </div>
            <div className="rounded-xl border border-border bg-card/80 px-4 py-2 text-center shadow-2xs">
              <span className="block font-mono text-xl font-bold text-primary">{totalTasks || 24}</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Open Tasks</span>
            </div>
            <div className="rounded-xl border border-border bg-card/80 px-4 py-2 text-center shadow-2xs">
              <span className="block font-mono text-xl font-bold text-amber-500">{totalApprovals || 7}</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Pending Sign-offs</span>
            </div>
          </div>
        </div>

        {/* Search Bar & Categories */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search department by code (EHW, PUR, QA...), name, lead, or scope..."
              className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDepartments.map((dept) => {
          const Icon = dept.icon;
          const isActive = currentDepartment === dept.id;
          const deptTasks = openTaskCounts[dept.id] ?? 0;
          const deptApprovals = approvalCounts[dept.id] ?? 0;
          const deptProjects = projectCounts[dept.id] ?? 2;

          return (
            <div
              key={dept.id}
              className={`group flex flex-col justify-between rounded-xl border p-5 transition-all shadow-xs ${
                isActive
                  ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40"
                  : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
              }`}
            >
              <div>
                {/* Top Badge & Code */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex size-9 items-center justify-center rounded-lg ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
                      <Icon className="size-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {dept.code}
                        </span>
                        <span className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {dept.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {dept.name}
                      </h3>
                    </div>
                  </div>

                  {isActive ? (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 font-mono text-[10px] font-bold text-primary border border-primary/30">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                      READY
                    </span>
                  )}
                </div>

                {/* Lead Person */}
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="size-3.5 shrink-0 text-steel" />
                  <span className="font-semibold text-foreground">{dept.lead}</span>
                  <span>· {dept.leadRole}</span>
                </div>

                {/* Summary / Functional Scope */}
                <p className="mt-2.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {dept.summary}
                </p>

                {/* Metrics Badges */}
                <div className="mt-4 flex items-center gap-3 border-t border-border/60 pt-3 text-xs">
                  <div className="flex items-center gap-1.5" title="Open tasks">
                    <CheckSquare className="size-3.5 text-primary" />
                    <span className="font-semibold text-foreground">{deptTasks}</span>
                    <span className="text-[11px] text-muted-foreground">tasks</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Pending approvals">
                    <FileCheck2 className="size-3.5 text-amber-500" />
                    <span className="font-semibold text-foreground">{deptApprovals}</span>
                    <span className="text-[11px] text-muted-foreground">approvals</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Active projects">
                    <FolderKanban className="size-3.5 text-steel" />
                    <span className="font-semibold text-foreground">{deptProjects}</span>
                    <span className="text-[11px] text-muted-foreground">projects</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => onSelectDepartment(dept.id)}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                      : "bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground"
                  }`}
                >
                  <span>{isActive ? "Currently Viewing Workspace" : "Open Department Workspace"}</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredDepartments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Building2 className="mx-auto size-12 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-bold text-foreground">No departments match your search</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your search query or switching to &quot;All&quot; categories.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("All");
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
          >
            Reset Search Filters
          </button>
        </div>
      )}
    </div>
  );
}

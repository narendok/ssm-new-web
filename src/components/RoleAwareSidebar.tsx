import { singleActiveDestination } from "@/lib/sidebar-selection";
import {
  ChevronDown,
  ChevronRight,
  Star,
  LayoutDashboard,
  CheckSquare,
  Briefcase,
  Package,
  ShoppingCart,
  ShieldCheck,
  FolderOpen,
  Users,
  History,
  ShieldAlert,
  Building,
  UsersRound,
  Bell,
  PlayCircle,
  LifeBuoy,
  Wrench,
  Terminal,
  Box,
  Factory,
  CheckCircle2,
  FileText,
  Building2,
  Laptop,
  CheckCircle,
  AlertTriangle,
  Award,
  Wallet,
  MessageSquare,
  FileSpreadsheet,
  Scale,
  UserCheck,
  ClipboardCheck,
  Sliders,
  Settings2,
  Cpu,
  Layers,
  PackageSearch,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type AreaId =
  | "home"
  | "sales"
  | "ehw"
  | "fw"
  | "sw"
  | "efw"
  | "csw"
  | "esw"
  | "mech"
  | "pur"
  | "qa"
  | "emf"
  | "mmf"
  | "tst"
  | "fin"
  | "sit"
  | "hrops"
  | "rnd"
  | "stores"
  | "production"
  | "quality"
  | "people"
  | "audit";

export type Persona = {
  id: string;
  label: string;
  person: string;
  departmentId?: AreaId | undefined;
  kind: "admin" | "lead" | "member" | "client";
};

export type SidebarMenuItem = {
  id: string;
  label: string;
  shortLabel?: string | undefined;
  icon: LucideIcon;
  badge?: string | number | undefined;
  onClick: () => void;
  isActive: boolean;
  pinCategory?: string | undefined;
};

export type SidebarWorkGroup = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: SidebarMenuItem[];
};

export type RoleAwareSidebarProps = {
  persona: Persona;
  activeArea: AreaId;
  view: string;
  recordTypeFilter?: string | null | undefined;
  onRecordTypeFilterChange?: ((filter:string|null)=>void) | undefined;
  sidebarExpanded: boolean;
  onToggleExpanded: () => void;
  purchasingSubView?: "recordage" | "smart_bom" | "ingestion_gate" | "quotations" | "orders" | "suppliers" | undefined;
  onSelectPurchasingSubView?: ((subView: "recordage" | "smart_bom" | "ingestion_gate" | "quotations" | "orders" | "suppliers") => void) | undefined;
  onNavigate: (
    area: AreaId,
    view?:
      | "departments"
      | "queue"
      | "detail"
      | "summary"
      | "project"
      | "assignee"
      | "index"
      | "pmss"
      | "inventory"
      | "orders"
      | "quotations"
      | "suppliers"
      | "customers"
      | "smart_bom"
      | "ingestion_gate"
      | "records"
      | "deliverables"
      | "vault"
      | "analysis"
      | "approvals"
      | "budgets"
      | "profile"
      | "communication"
      | "tickets"
      | "hr_admin"
  ) => void;
  onOpenCustomerRegister?: (() => void) | undefined;
  onOpenAi4tLifecycle?: (() => void) | undefined;
  onOpenProjectAnalysis?: (() => void) | undefined;
  onOpenDrive?: (() => void) | undefined;
  onOpenDraftHub?: (() => void) | undefined;
  onOpenDirectory?: (() => void) | undefined;
  onOpenLegalHub?: (() => void) | undefined;
  onOpenDecisionLog?: (() => void) | undefined;
  onOpenAdminSettings?: (() => void) | undefined;
  onOpenWizard?: (() => void) | undefined;
  onOpenAssetCatalog?: (() => void) | undefined;
  onOpenApprovals?: (() => void) | undefined;
  onOpenBudgets?: (() => void) | undefined;
  onOpenProfile?: (() => void) | undefined;
  onOpenCommunication?: (() => void) | undefined;
  onOpenTickets?: (() => void) | undefined;
  onOpenHrAdmin?: (() => void) | undefined;
  onOpenAlerts?: (() => void) | undefined;
  onOpenHistory?: (() => void) | undefined;
  setupStep?: number | undefined;
  totalSetupSteps?: number | undefined;
  openTaskCounts?: Record<string, number> | undefined;
  approvalCounts?: Record<string, number> | undefined;
  isMobile?: boolean | undefined;
  onCloseMobile?: (() => void) | undefined;
};

// Sensible default favorites per role kind
const DEFAULT_FAVORITES_BY_ROLE: Record<string, string[]> = {
  admin: [
    "adm-overview",
    "adm-projects",
    "adm-workqueue",
    "adm-inventory",
    "adm-procurement",
    "adm-quality",
    "adm-documents",
    "adm-people",
  ],
  pur: ["dept-mywork", "pur-inventory", "pur-orders", "pur-quotations", "pur-suppliers"],
  ehw: ["dept-mywork", "ehw-hub", "ehw-specs", "ehw-schematics", "dept-projects"],
  sales: ["dept-mywork", "sales-opps", "sales-customers", "dept-projects", "dept-drive"],
  qa: ["dept-mywork", "qa-hub", "qa-dvpr", "dept-projects", "dept-drive"],
  mech: ["dept-mywork", "mech-hub", "mech-cad", "dept-projects"],
  fw: ["dept-mywork", "fw-hub", "dept-projects", "dept-drive"],
  sw: ["dept-mywork", "sw-hub", "dept-projects", "dept-drive"],
  efw: ["dept-mywork", "fw-hub", "dept-projects", "dept-drive"],
  csw: ["dept-mywork", "sw-hub", "dept-projects", "dept-drive"],
  esw: ["dept-mywork", "fw-hub", "dept-projects", "dept-drive"],
  emf: ["dept-mywork", "emf-hub", "dept-projects"],
  mmf: ["dept-mywork", "mmf-hub", "dept-projects"],
  tst: ["dept-mywork", "tst-hub", "dept-projects"],
  fin: ["dept-mywork", "fin-hub", "fin-customers", "dept-projects"],
  sit: ["dept-mywork", "sit-hub", "dept-projects"],
  hrops: ["dept-mywork", "hrops-hub", "dept-projects"],
  client: ["client-milestones", "client-documents"],
};

export function RoleAwareSidebar({
  persona,
  activeArea,
  view,
  recordTypeFilter, onRecordTypeFilterChange,
  sidebarExpanded,
  onToggleExpanded,
  purchasingSubView = "recordage",
  onSelectPurchasingSubView,
  onNavigate,
  onOpenCustomerRegister,
  onOpenAi4tLifecycle,
  onOpenProjectAnalysis,
  onOpenDrive,
  onOpenDraftHub,
  onOpenDirectory,
  onOpenLegalHub,
  onOpenDecisionLog,
  onOpenAdminSettings,
  onOpenWizard,
  onOpenAssetCatalog,
  onOpenApprovals,
  onOpenBudgets,
  onOpenProfile,
  onOpenCommunication,
  onOpenTickets,
  onOpenHrAdmin,
  onOpenAlerts,
  onOpenHistory,
  setupStep = 0,
  totalSetupSteps = 6,
  openTaskCounts = {},
  approvalCounts = {},
  isMobile = false,
  onCloseMobile,
  adminDepartment,
}: RoleAwareSidebarProps) {
  const isAdmin = persona.kind === "admin";
  const userRoleKey = (persona.kind === "lead" || persona.kind === "member") && persona.departmentId
    ? persona.departmentId
    : (activeArea && activeArea !== "home" && activeArea !== "rnd" ? activeArea : "ehw");

  // 1. Favorites State Management with LocalStorage persistence
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_FAVORITES_BY_ROLE[userRoleKey] ?? [];
    try {
      const stored = window.localStorage.getItem(`scms_user_favorites_${persona.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    const adminDefaults = DEFAULT_FAVORITES_BY_ROLE["admin"] ?? [];
    return DEFAULT_FAVORITES_BY_ROLE[userRoleKey] ?? (isAdmin ? adminDefaults : ["dept-mywork", "dept-projects"]);
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(`scms_user_favorites_${persona.id}`, JSON.stringify(favoriteIds));
    } catch {
      // ignore
    }
  }, [favoriteIds, persona.id]);

  useEffect(() => {
    if (isAdmin) {
      setFavoriteIds(DEFAULT_FAVORITES_BY_ROLE[userRoleKey] ?? DEFAULT_FAVORITES_BY_ROLE["admin"] ?? []);
    }
  }, [isAdmin, userRoleKey]);

  const toggleFavorite = (itemId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setFavoriteIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // 2. Expandable Accordion Groups State
  // RULE:
  // - Admin: Overview is expanded by default (with arrow), all other groups unexpanded (collapsed)
  // - Others: All groups expanded by default
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    if (isAdmin) {
      return {
        favorites: true,
        dept_mywork: true,
        dept_projects: true,
        dept_workspace: true,
        dept_reference: true,
        administration: false,
      };
    } else if (persona.kind === "client") {
      return {
        favorites: true,
        client_delivery: true,
        client_documents: true,
      };
    } else {
      return {
        favorites: true,
        dept_mywork: true,
        dept_projects: true,
        dept_workspace: true,
        dept_reference: true,
      };
    }
  });

  // Reset/switch defaults when persona changes
  useEffect(() => {
    if (isAdmin) {
      setExpandedGroups({
        favorites: true,
        executive_oversight: true,
        dept_mywork: true,
        dept_projects: true,
        dept_workspace: true,
        dept_reference: true,
        administration: false,
      });
    } else if (persona.kind === "client") {
      setExpandedGroups({
        favorites: true,
        client_delivery: true,
        client_documents: true,
      });
    } else {
      setExpandedGroups({
        favorites: true,
        dept_mywork: true,
        dept_projects: true,
        dept_workspace: true,
        dept_reference: true,
      });
    }
  }, [isAdmin, persona.id, persona.kind]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Helper to handle item navigation & close mobile drawer if applicable
  const handleItemClick = (callback: () => void) => {
    callback();
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  // 3. Define all Available Work Groups & Items for Admin
  const adminWorkGroups: SidebarWorkGroup[] = useMemo(() => {
    return [
      {
        id: "overview",
        title: "Overview",
        icon: LayoutDashboard,
        items: [
          {
            id: "adm-overview",
            label: "Dashboard / Command Center",
            shortLabel: "Overview",
            icon: LayoutDashboard,
            isActive: activeArea === "home" && ["index","summary"].includes(view),
            onClick: () => handleItemClick(() => onNavigate("home", "index")),
          },
          {
            id: "adm-workqueue",
            label: "Work Queue & Approvals",
            shortLabel: "Queue",
            icon: CheckSquare,
            badge: openTaskCounts["home"] ?? 12,
            isActive: activeArea === "home" && view === "queue",
            onClick: () => handleItemClick(() => onNavigate("home", "queue")),
          },
          {
            id: "adm-approvals",
            label: "Pending Sign-offs",
            shortLabel: "Approvals",
            icon: ShieldAlert,
            badge: 3,
            isActive: view === "approvals",
            onClick: () => handleItemClick(() => onOpenApprovals?.()),
          },
          {
            id: "adm-audit",
            label: "Audit & Decision Feed",
            shortLabel: "Audit",
            icon: History,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenHistory?.()),
          },
        ],
      },
      {
        id: "commercial",
        title: "Commercial & Projects",
        icon: Briefcase,
        items: [
          {
            id: "adm-customers",
            label: "Customers & Accounts",
            shortLabel: "Customers",
            icon: Building,
            isActive: view === "customers",
            onClick: () => handleItemClick(() => onNavigate("sales", "customers")),
          },
          {
            id: "adm-opps",
            label: "Opportunities & Enquiries",
            shortLabel: "SAL",
            icon: UsersRound,
            badge: openTaskCounts["sales"],
            isActive: activeArea === "sales",
            onClick: () => handleItemClick(() => onNavigate("sales")),
          },
          {
            id: "adm-projects",
            label: "Manage Projects",
            shortLabel: "Projects",
            icon: Briefcase,
            isActive: activeArea === "rnd" && ["index","project"].includes(view),
            onClick: () => handleItemClick(() => onNavigate("rnd", "index")),
          },
          {id:"adm-analysis",label:"Project Analysis",shortLabel:"Analysis",icon:Layers,isActive:view === "analysis",onClick:()=>handleItemClick(()=>onOpenProjectAnalysis?.())},
          {
            id: "adm-lifecycle",
            label: "Knowledge Base",
            shortLabel: "Knowledge Base",
            icon: PlayCircle,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenAi4tLifecycle?.()),
          },
          {
            id: "adm-service",
            label: "Customer Service & Field (SIT)",
            shortLabel: "SIT",
            icon: Bell,
            badge: openTaskCounts["sit"],
            isActive: activeArea === "sit" && view !== "tickets",
            onClick: () => handleItemClick(() => onNavigate("sit")),
          },
          {
            id: "adm-service-tickets",
            label: "Service Tickets",
            shortLabel: "Tickets",
            icon: LifeBuoy,
            isActive: view === "tickets",
            onClick: () => handleItemClick(() => onOpenTickets ? onOpenTickets() : onNavigate("sit", "tickets")),
          },
        ],
      },
      {
        id: "engineering",
        title: "Engineering & Delivery",
        icon: Wrench,
        items: [
          {
            id: "adm-ehw",
            label: "Hardware Engineering (EHW)",
            shortLabel: "EHW",
            icon: Wrench,
            badge: openTaskCounts["ehw"],
            isActive: activeArea === "ehw",
            onClick: () => handleItemClick(() => onNavigate("ehw")),
          },
          {
            id: "adm-fw",
            label: "Firmware (FW)",
            shortLabel: "FW",
            icon: Terminal,
            badge: openTaskCounts["fw"] ?? openTaskCounts["efw"] ?? openTaskCounts["esw"],
            isActive: activeArea === "fw" || activeArea === "efw" || activeArea === "esw",
            onClick: () => handleItemClick(() => onNavigate("fw")),
          },
          {
            id: "adm-sw",
            label: "Cloud & Application Software (SW)",
            shortLabel: "SW",
            icon: Laptop,
            badge: openTaskCounts["sw"] ?? openTaskCounts["csw"],
            isActive: activeArea === "sw" || activeArea === "csw",
            onClick: () => handleItemClick(() => onNavigate("sw")),
          },
          {
            id: "adm-mech",
            label: "Mechanical Engineering (MECH)",
            shortLabel: "MECH",
            icon: Box,
            badge: openTaskCounts["mech"],
            isActive: activeArea === "mech",
            onClick: () => handleItemClick(() => onNavigate("mech")),
          },
          {
            id: "adm-emf",
            label: "Electronics Mfg (EMF)",
            shortLabel: "EMF",
            icon: Factory,
            badge: openTaskCounts["emf"],
            isActive: activeArea === "emf",
            onClick: () => handleItemClick(() => onNavigate("emf")),
          },
          {
            id: "adm-mmf",
            label: "Mechanical Mfg (MMF)",
            shortLabel: "MMF",
            icon: Wrench,
            badge: openTaskCounts["mmf"],
            isActive: activeArea === "mmf",
            onClick: () => handleItemClick(() => onNavigate("mmf")),
          },
          {
            id: "adm-tst",
            label: "Legacy TST · ownership review",
            shortLabel: "Legacy",
            icon: CheckCircle2,
            badge: openTaskCounts["tst"],
            isActive: activeArea === "tst",
            onClick: () => handleItemClick(() => onNavigate("tst")),
          },
        ],
      },
      {
        id: "inventory",
        title: "Inventory & Procurement",
        icon: Package,
        items: [
          {
            id: "adm-inventory",
            label: "Governed Parts & Stock",
            shortLabel: "Stock",
            icon: Package,
            isActive: activeArea === "pur" && (view === "inventory" || (view === "queue" && purchasingSubView === "recordage")),
            onClick: () =>
              handleItemClick(() => {
                onSelectPurchasingSubView?.("recordage");
                onNavigate("pur", "inventory");
              }),
          },
          {
            id: "adm-smart-bom",
            label: "Smart BOM (Dual-Lifecycle)",
            shortLabel: "Smart BOM",
            icon: Layers,
            isActive: activeArea === "pur" && (view === "smart_bom" || (view === "queue" && purchasingSubView === "smart_bom")),
            onClick: () =>
              handleItemClick(() => {
                onSelectPurchasingSubView?.("smart_bom");
                onNavigate("pur", "smart_bom");
              }),
          },
          {
            id: "adm-ingestion-gate",
            label: "Adaptive Ingestion & Gate",
            shortLabel: "Ingestion",
            icon: Truck,
            isActive: activeArea === "pur" && (view === "ingestion_gate" || (view === "queue" && purchasingSubView === "ingestion_gate")),
            onClick: () =>
              handleItemClick(() => {
                onSelectPurchasingSubView?.("ingestion_gate");
                onNavigate("pur", "ingestion_gate");
              }),
          },
          {
            id: "adm-procurement",
            label: "Purchase Orders (POs)",
            shortLabel: "POs",
            icon: ShoppingCart,
            isActive: activeArea === "pur" && (view === "orders" || (view === "queue" && purchasingSubView === "orders")),
            onClick: () =>
              handleItemClick(() => {
                onSelectPurchasingSubView?.("orders");
                onNavigate("pur", "orders");
              }),
          },
          {
            id: "adm-quotations",
            label: "Quotations & Pricing",
            shortLabel: "Quotes",
            icon: FileText,
            isActive: activeArea === "pur" && (view === "quotations" || (view === "queue" && purchasingSubView === "quotations")),
            onClick: () =>
              handleItemClick(() => {
                onSelectPurchasingSubView?.("quotations");
                onNavigate("pur", "quotations");
              }),
          },
          {
            id: "adm-suppliers",
            label: "Suppliers & ASL Governance",
            shortLabel: "Suppliers",
            icon: Building2,
            isActive: activeArea === "pur" && (view === "suppliers" || (view === "queue" && purchasingSubView === "suppliers")),
            onClick: () =>
              handleItemClick(() => {
                onSelectPurchasingSubView?.("suppliers");
                onNavigate("pur", "suppliers");
              }),
          },
          {
            id: "adm-assets",
            label: "Asset Register & Machinery",
            shortLabel: "Assets",
            icon: Laptop,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenAssetCatalog?.()),
          },
        ],
      },
      {
        id: "quality",
        title: "Quality & Compliance",
        icon: ShieldCheck,
        items: [
          {
            id: "adm-quality",
            label: "Quality Hub & APQP (QA)",
            shortLabel: "Quality",
            icon: ShieldCheck,
            badge: openTaskCounts["qa"],
            isActive: activeArea === "qa",
            onClick: () => handleItemClick(() => onNavigate("qa")),
          },
          {
            id: "adm-dvpr",
            label: "DVP&R Compliance Matrix",
            shortLabel: "DVP&R",
            icon: CheckCircle,
            isActive: false,
            onClick: () => handleItemClick(() => onNavigate("qa")),
          },
          {
            id: "adm-capa",
            label: "Non-conformances & 8D CAPA",
            shortLabel: "8D CAPA",
            icon: AlertTriangle,
            isActive: false,
            onClick: () => handleItemClick(() => onNavigate("qa")),
          },
        ],
      },
      {
        id: "documents",
        title: "Documents & Collaboration",
        icon: FolderOpen,
        items: [
          {
            id: "adm-documents",
            label: "Document Drive & Vault",
            shortLabel: "Drive",
            icon: FolderOpen,
            isActive: view === "vault",
            onClick: () => handleItemClick(() => onOpenDrive?.()),
          },
          {
            id: "adm-templates",
            label: "Auto-Draft Templates",
            shortLabel: "Templates",
            icon: FileSpreadsheet,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenDraftHub?.()),
          },
          {
            id: "adm-legal",
            label: "Legal & Bilateral Agreements",
            shortLabel: "Legal",
            icon: Scale,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenLegalHub?.()),
          },
          {
            id: "adm-decisions",
            label: "Decision & Rationale Log",
            shortLabel: "Decisions",
            icon: FileText,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenDecisionLog?.()),
          },
        ],
      },
      {
        id: "people",
        title: "People & Organization",
        icon: Users,
        items: [
          {
            id: "adm-people",
            label: "Employee Directory & Skills",
            shortLabel: "Directory",
            icon: Users,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenDirectory?.()),
          },
          {
            id: "adm-budgets",
            label: "Budgets & Expenses",
            shortLabel: "Budgets",
            icon: Wallet,
            isActive: view === "budgets",
            onClick: () => handleItemClick(() => onOpenBudgets?.()),
          },
          {
            id: "adm-profile",
            label: "My Profile",
            shortLabel: "Profile",
            icon: UserCheck,
            isActive: view === "profile",
            onClick: () => handleItemClick(() => onOpenProfile?.()),
          },
          {
            id: "adm-communication",
            label: "Team Chat",
            shortLabel: "Chat",
            icon: MessageSquare,
            isActive: view === "communication",
            onClick: () => handleItemClick(() => onOpenCommunication?.()),
          },
          {
            id: "adm-hrops",
            label: "HR & Operations (HR/OPS)",
            shortLabel: "HR/OPS",
            icon: UserCheck,
            badge: openTaskCounts["hrops"],
            isActive: activeArea === "hrops",
            onClick: () => handleItemClick(() => onNavigate("hrops")),
          },
          {
            id: "adm-hrops-admin",
            label: "HR Administration Hub",
            shortLabel: "HR Admin",
            icon: UserCheck,
            isActive: view === "hr_admin",
            onClick: () => handleItemClick(() => onOpenHrAdmin ? onOpenHrAdmin() : onNavigate("hrops", "hr_admin")),
          },
          {
            id: "adm-fin",
            label: "Accounts & Finance (FIN)",
            shortLabel: "Finance",
            icon: ClipboardCheck,
            badge: openTaskCounts["fin"],
            isActive: activeArea === "fin" && view !== "customers",
            onClick: () => handleItemClick(() => onNavigate("fin")),
          },
          {
            id: "adm-fin-customers",
            label: "Customer Billing & Credit Terms",
            shortLabel: "Billing",
            icon: Building,
            isActive: activeArea === "fin" && view === "customers",
            onClick: () => handleItemClick(() => onNavigate("fin", "customers")),
          },
        ],
      },
      {
        id: "administration",
        title: "Settings",
        icon: Sliders,
        items: [
          {
            id: "adm-settings",
            label: "Organization & RACI Settings",
            shortLabel: "Settings",
            icon: Sliders,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenAdminSettings?.()),
          },
          {
            id: "adm-wizard",
            label: "Portal Setup Wizard",
            shortLabel: "Wizard",
            icon: Settings2,
            badge: `${setupStep + 1}/${totalSetupSteps}`,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenWizard?.()),
          },
        ],
      },
    ];
  }, [
    activeArea,
    view,
    openTaskCounts,
    approvalCounts,
    purchasingSubView,
    recordTypeFilter, onRecordTypeFilterChange,
    onNavigate,
    onOpenApprovals,
  onOpenBudgets,
  onOpenProfile,
  onOpenCommunication,
    onOpenHistory,
    onOpenCustomerRegister,
    onOpenProjectAnalysis,
    onOpenAi4tLifecycle,
    onSelectPurchasingSubView,
    onOpenAssetCatalog,
    onOpenDrive,
    onOpenDraftHub,
    onOpenLegalHub,
    onOpenDecisionLog,
    onOpenDirectory,
    onOpenAdminSettings,
    onOpenWizard,
    setupStep,
    totalSetupSteps,
    isMobile,
    onCloseMobile,
  ]);

  // 4. Define Department-Specific Work Groups for Department Leads / Client / Admin
  const deptWorkGroups: SidebarWorkGroup[] = useMemo(() => {
    const deptId = (persona.kind === "lead" || persona.kind === "member") && persona.departmentId
      ? persona.departmentId
      : (activeArea && activeArea !== "home" && activeArea !== "rnd" ? activeArea : "ehw");

    // Build department primary workspace items
    const getWorkspaceItems = (): SidebarMenuItem[] => {
      if (persona.kind === "client") {
        return [
          {
            id: "client-milestones",
            label: "OEM Delivery Dashboard",
            shortLabel: "Dashboard",
            icon: CheckCircle2,
            isActive: activeArea === "home",
            onClick: () => handleItemClick(() => onNavigate("home")),
          },
          {
            id: "client-documents",
            label: "Released Specifications & TAC",
            shortLabel: "Docs",
            icon: Award,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenDrive?.()),
          },
        ];
      }

      switch (deptId) {
        case "pur":
          return [
            {
              id: "pur-inventory",
              label: "Recordage & Governed Stock",
              shortLabel: "Recordage",
              icon: Package,
              isActive: activeArea === "pur" && (view === "inventory" || (view === "queue" && purchasingSubView === "recordage")),
              onClick: () =>
                handleItemClick(() => {
                  onSelectPurchasingSubView?.("recordage");
                  onNavigate("pur", "inventory");
                }),
            },
            {
              id: "pur-smart-bom",
              label: "Smart BOM (Dual-Lifecycle)",
              shortLabel: "Smart BOM",
              icon: Layers,
              isActive: activeArea === "pur" && (view === "smart_bom" || (view === "queue" && purchasingSubView === "smart_bom")),
              onClick: () =>
                handleItemClick(() => {
                  onSelectPurchasingSubView?.("smart_bom");
                  onNavigate("pur", "smart_bom");
                }),
            },
            {
              id: "pur-ingestion-gate",
              label: "Adaptive Ingestion & Gate",
              shortLabel: "Ingestion",
              icon: Truck,
              isActive: activeArea === "pur" && (view === "ingestion_gate" || (view === "queue" && purchasingSubView === "ingestion_gate")),
              onClick: () =>
                handleItemClick(() => {
                  onSelectPurchasingSubView?.("ingestion_gate");
                  onNavigate("pur", "ingestion_gate");
                }),
            },
            {
              id: "pur-orders",
              label: "Purchase Orders (POs)",
              shortLabel: "POs",
              icon: ShoppingCart,
              isActive: activeArea === "pur" && (view === "orders" || (view === "queue" && purchasingSubView === "orders")),
              onClick: () =>
                handleItemClick(() => {
                  onSelectPurchasingSubView?.("orders");
                  onNavigate("pur", "orders");
                }),
            },
            {
              id: "pur-quotations",
              label: "Quotations & Vendor Pricing",
              shortLabel: "Quotes",
              icon: FileText,
              isActive: activeArea === "pur" && (view === "quotations" || (view === "queue" && purchasingSubView === "quotations")),
              onClick: () =>
                handleItemClick(() => {
                  onSelectPurchasingSubView?.("quotations");
                  onNavigate("pur", "quotations");
                }),
            },
            {
              id: "pur-suppliers",
              label: "Suppliers (ASL) & Governance",
              shortLabel: "Suppliers",
              icon: Building2,
              isActive: activeArea === "pur" && (view === "suppliers" || (view === "queue" && purchasingSubView === "suppliers")),
              onClick: () =>
                handleItemClick(() => {
                  onSelectPurchasingSubView?.("suppliers");
                  onNavigate("pur", "suppliers");
                }),
            },
          ];
        case "ehw":
          return [
            {
              id: "ehw-hub",
              label: "Hardware Engineering (HW_01-HW_37)",
              shortLabel: "EHW Hub",
              icon: Wrench,
              isActive: activeArea === "ehw" && view === "queue",
              onClick: () => handleItemClick(() => onNavigate("ehw")),
            },
            {
              id: "ehw-specs",
              label: "PRS & Technical Specs",
              shortLabel: "PRS",
              icon: FileText,
              isActive: activeArea === "ehw" && view === "deliverables" && recordTypeFilter === "PRS",
              onClick: () => handleItemClick(() => { onNavigate("ehw", "deliverables"); onRecordTypeFilterChange?.("PRS"); }),
            },
            {
              id: "ehw-schematics",
              label: "Schematics & Preliminary BOM",
              shortLabel: "Schematics",
              icon: Cpu,
              isActive: activeArea === "ehw" && view === "deliverables" && recordTypeFilter === "SCHEMATIC",
              onClick: () => handleItemClick(() => { onNavigate("ehw", "deliverables"); onRecordTypeFilterChange?.("SCHEMATIC"); }),
            },
            {
              id: "ehw-gerber",
              label: "DFMEA & Gerber Gates",
              shortLabel: "DFMEA",
              icon: Layers,
              isActive: activeArea === "ehw" && view === "deliverables" && recordTypeFilter === "DFMEA",
              onClick: () => handleItemClick(() => { onNavigate("ehw", "deliverables"); onRecordTypeFilterChange?.("DFMEA"); }),
            },
          ];
        case "sales":
          return [
            {
              id: "sales-opps",
              label: "Sales Opportunities & Leads",
              shortLabel: "Opps",
              icon: UsersRound,
              isActive: activeArea === "sales" && view === "queue",
              onClick: () => handleItemClick(() => onNavigate("sales", "queue")),
            },
            {
              id: "sales-customers",
              label: "Customer Register & Accounts",
              shortLabel: "Customers",
              icon: Building,
              isActive: activeArea === "sales" && view === "customers",
              onClick: () => handleItemClick(() => onNavigate("sales", "customers")),
            },
            {
              id: "sales-quotations",
              label: "Commercial Quotations (SAL-QUO)",
              shortLabel: "Quotes",
              icon: FileText,
              isActive: false,
              onClick: () => handleItemClick(() => onOpenDraftHub?.()),
            },
          ];
        case "fin":
          return [
            {
              id: "fin-hub",
              label: "Accounts & Financial Queue",
              shortLabel: "Queue",
              icon: ClipboardCheck,
              isActive: activeArea === "fin" && view === "queue",
              onClick: () => handleItemClick(() => onNavigate("fin", "queue")),
            },
            {
              id: "fin-customers",
              label: "Customer Master & Credit Accounts",
              shortLabel: "Customers",
              icon: Building,
              isActive: activeArea === "fin" && view === "customers",
              onClick: () => handleItemClick(() => onNavigate("fin", "customers")),
            },
            {
              id: "fin-invoices",
              label: "Commercial Tax Invoices (FIN-INV)",
              shortLabel: "Invoices",
              icon: FileText,
              isActive: false,
              onClick: () => handleItemClick(() => onOpenDraftHub?.()),
            },
          ];
        case "qa":
          return [
            {
              id: "qa-hub",
              label: "Quality Assurance Hub (APQP)",
              shortLabel: "QA Hub",
              icon: ShieldCheck,
              isActive: activeArea === "qa",
              onClick: () => handleItemClick(() => onNavigate("qa")),
            },
            {
              id: "qa-dvpr",
              label: "DVP&R Compliance Matrix",
              shortLabel: "DVP&R",
              icon: CheckCircle,
              isActive: false,
              onClick: () => handleItemClick(() => onNavigate("qa")),
            },
            {
              id: "qa-capa",
              label: "8D CAPA & Non-conformances",
              shortLabel: "8D CAPA",
              icon: AlertTriangle,
              isActive: false,
              onClick: () => handleItemClick(() => onNavigate("qa")),
            },
          ];
        case "sit":
          return [
            {
              id: "sit-hub",
              label: "Service and IT Infrastructure Hub",
              shortLabel: "SIT Hub",
              icon: Bell,
              isActive: activeArea === "sit" && view === "queue",
              onClick: () => handleItemClick(() => onNavigate("sit", "queue")),
            },
            {
              id: "sit-tickets",
              label: "Service and Support Tickets",
              shortLabel: "Tickets",
              icon: LifeBuoy,
              isActive: view === "tickets",
              onClick: () => handleItemClick(() => onOpenTickets ? onOpenTickets() : onNavigate("sit", "tickets")),
            },
            {
              id: "sit-assets",
              label: "Governed IT Assets Register",
              shortLabel: "IT Assets",
              icon: Laptop,
              isActive: view === "inventory",
              onClick: () => handleItemClick(() => onNavigate("sit", "inventory")),
            },
          ];
        case "mech":
          return [
            {
              id: "mech-hub",
              label: "Mechanical Engineering Hub",
              shortLabel: "MECH Hub",
              icon: Box,
              isActive: activeArea === "mech" && view === "queue",
              onClick: () => handleItemClick(() => onNavigate("mech")),
            },
            {
              id: "mech-cad",
              label: "STEP Clearance & 3D CAD",
              shortLabel: "3D STEP",
              icon: Layers,
              isActive: activeArea === "mech" && view === "deliverables",
              onClick: () => handleItemClick(() => onNavigate("mech", "deliverables")),
            },
          ];
        case "fw":
        case "efw":
        case "esw":
          return [
            {
              id: "fw-hub",
              label: "Firmware Requirements & RTOS Hub",
              shortLabel: "FW Hub",
              icon: Terminal,
              isActive: (activeArea === "fw" || activeArea === "efw" || activeArea === "esw") && view === "queue",
              onClick: () => handleItemClick(() => onNavigate("fw")),
            },
            {
              id: "fw-fota",
              label: "FOTA & Dual-Bank Bootloader",
              shortLabel: "FOTA",
              icon: ShieldAlert,
              isActive: (activeArea === "fw" || activeArea === "efw" || activeArea === "esw") && view === "deliverables",
              onClick: () => handleItemClick(() => onNavigate("fw", "deliverables")),
            },
          ];
        case "sw":
        case "csw":
          return [
            {
              id: "sw-hub",
              label: "Software Requirements & Telematics Hub",
              shortLabel: "SW Hub",
              icon: Laptop,
              isActive: (activeArea === "sw" || activeArea === "csw") && view === "queue",
              onClick: () => handleItemClick(() => onNavigate("sw")),
            },
            {
              id: "sw-ble",
              label: "Mobile BLE 5.2 & Telemetry Stacks",
              shortLabel: "BLE & Cloud",
              icon: Layers,
              isActive: (activeArea === "sw" || activeArea === "csw") && view === "deliverables",
              onClick: () => handleItemClick(() => onNavigate("sw", "deliverables")),
            },
          ];
        default:
          return [
            {
              id: `${deptId}-workspace`,
              label: `${persona.label} Primary Workspace`,
              shortLabel: persona.label.slice(0, 4),
              icon: LayoutDashboard,
              isActive: activeArea === deptId,
              onClick: () => handleItemClick(() => onNavigate(deptId as AreaId)),
            },
          ];
      }
    };

    if (persona.kind === "client") {
      return [
        {
          id: "client_delivery",
          title: "Project Delivery & Milestones",
          icon: CheckCircle2,
          items: [
            {
              id: "client-milestones",
              label: "OEM Delivery Dashboard",
              shortLabel: "Dashboard",
              icon: CheckCircle2,
              isActive: activeArea === "home" && view !== "tickets",
              onClick: () => handleItemClick(() => onNavigate("home")),
            },
            {
              id: "client-tickets",
              label: "Service and Support Tickets",
              shortLabel: "Tickets",
              icon: LifeBuoy,
              isActive: view === "tickets",
              onClick: () => handleItemClick(() => onOpenTickets ? onOpenTickets() : onNavigate("home", "tickets")),
            },
          ],
        },
        {
          id: "client_documents",
          title: "Released Deliverables",
          icon: Award,
          items: [
            {
              id: "client-documents",
              label: "Released Specifications & TAC",
              shortLabel: "Specifications",
              icon: Award,
              isActive: false,
              onClick: () => handleItemClick(() => onOpenDrive?.()),
            },
          ],
        },
      ];
    }

    return [
      {
        id: "dept_mywork",
        title: "My work",
        icon: CheckSquare,
        items: [
          {
            id: "dept-mywork",
            label: "My Tasks & Action Queue",
            shortLabel: "My Work",
            icon: CheckSquare,
            badge: openTaskCounts[deptId] ?? 0,
            isActive: activeArea === deptId && view === "assignee",
            onClick: () => handleItemClick(() => onNavigate(deptId as AreaId, "assignee")),
          },
          {
            id: "dept-approvals",
            label: "Department Approvals & Reviews",
            shortLabel: "Approvals",
            icon: ShieldAlert,
            badge: approvalCounts[deptId] ?? 0,
            isActive: view === "approvals",
            onClick: () => handleItemClick(() => onOpenApprovals?.()),
          },
        ],
      },
      {
        id: "dept_projects",
        title: "Projects & Records",
        icon: Briefcase,
        items: [{id:"dept-analysis",label:"Project Analysis",shortLabel:"Analysis",icon:Layers,isActive:view === "analysis",onClick:()=>handleItemClick(()=>onOpenProjectAnalysis?.())},
          {
            id: "dept-projects",
            label: "Department Project Workspace",
            shortLabel: "Projects",
            icon: Briefcase,
            isActive: view === "project",
            onClick: () => handleItemClick(() => onNavigate(deptId as AreaId, "project")),
          },
          {
            id: "dept-records",
            label: "Department Records Register",
            shortLabel: "Records",
            icon: Layers,
            isActive: view === "records",
            onClick: () => handleItemClick(() => onNavigate(deptId as AreaId, "records")),
          },
          {
            id: "dept-drive",
            label: "Project Documents & Vault",
            shortLabel: "Vault",
            icon: FolderOpen,
            isActive: view === "vault",
            onClick: () => handleItemClick(() => onOpenDrive?.()),
          },
        ],
      },
      {
        id: "dept_workspace",
        title: "Department workspace",
        icon: LayoutDashboard,
        items: getWorkspaceItems(),
      },
      {
        id: "dept_reference",
        title: "Reference & Training",
        icon: BookOpen,
        items: [{id:"dept-decisions",label:persona.kind === "member" ? "My Decision Submissions" : "Decision & Deviation Log",shortLabel:"Decisions",icon:BookOpen,isActive:false,onClick:()=>handleItemClick(()=>onOpenDecisionLog?.())},
          ...(deptId === "pur"
            ? [
                {
                  id: "dept-ref-parts",
                  label: "Governed Parts & Stock (Read-only)",
                  shortLabel: "Parts",
                  icon: PackageSearch,
                  isActive: activeArea === "pur" && (view === "inventory" || (view === "queue" && purchasingSubView === "recordage")),
                  onClick: () =>
                    handleItemClick(() => {
                      onSelectPurchasingSubView?.("recordage");
                      onNavigate("pur", "inventory");
                    }),
                },
              ]
            : []),
          {
            id: "dept-ref-templates",
            label: "Controlled Templates & Standards",
            shortLabel: "Templates",
            icon: FileSpreadsheet,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenDraftHub?.()),
          },
          {
            id: "dept-ref-directory",
            label: "Department Team Directory",
            shortLabel: "Directory",
            icon: Users,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenDirectory?.()),
          },
          {
            id: "adm-budgets",
            label: "Budgets & Expenses",
            shortLabel: "Budgets",
            icon: Wallet,
            isActive: view === "budgets",
            onClick: () => handleItemClick(() => onOpenBudgets?.()),
          },
          {
            id: "adm-profile",
            label: "My Profile",
            shortLabel: "Profile",
            icon: UserCheck,
            isActive: view === "profile",
            onClick: () => handleItemClick(() => onOpenProfile?.()),
          },
          {
            id: "adm-communication",
            label: "Team Chat",
            shortLabel: "Chat",
            icon: MessageSquare,
            isActive: view === "communication",
            onClick: () => handleItemClick(() => onOpenCommunication?.()),
          },
          {
            id: "dept-ref-training-lifecycle",
            label: "Knowledge Base",
            shortLabel: "Knowledge Base",
            icon: PlayCircle,
            isActive: false,
            onClick: () => handleItemClick(() => onOpenAi4tLifecycle?.()),
          },
        ],
      },
    ];
  }, [
    persona,
    activeArea,
    view,
    openTaskCounts,
    approvalCounts,
    purchasingSubView,
    recordTypeFilter, onRecordTypeFilterChange,
    onNavigate,
    onOpenApprovals,
  onOpenBudgets,
  onOpenProfile,
  onOpenCommunication,
    onOpenAlerts,
    onOpenProjectAnalysis,
    onOpenAi4tLifecycle,
    onOpenDrive,
    onOpenDraftHub,
    onOpenDirectory,
    onOpenDecisionLog,
    onOpenCustomerRegister,
    onSelectPurchasingSubView,
    isMobile,
    onCloseMobile,
  ]);

  const adminSettingsGroup: SidebarWorkGroup = useMemo(() => ({
    id: "administration",
    title: "Settings & System",
    icon: Sliders,
    items: [
      {
        id: "adm-settings",
        label: "Organization & RACI Settings",
        shortLabel: "Settings",
        icon: Sliders,
        isActive: false,
        onClick: () => handleItemClick(() => onOpenAdminSettings?.()),
      },
      {
        id: "adm-wizard",
        label: "Portal Setup Wizard",
        shortLabel: "Wizard",
        icon: Settings2,
        badge: `${setupStep + 1}/${totalSetupSteps}`,
        isActive: false,
        onClick: () => handleItemClick(() => onOpenWizard?.()),
      },
    ],
  }), [setupStep, totalSetupSteps, onOpenAdminSettings, onOpenWizard]);

  const executiveGroup: SidebarWorkGroup = useMemo(() => ({
    id: "executive_oversight",
    title: "Executive Command",
    icon: Building2,
    items: [
      {
        id: "adm-departments",
        label: "All Departments Directory",
        shortLabel: "Departments",
        icon: Building2,
        isActive: view === "departments",
        onClick: () => handleItemClick(() => onNavigate("home", "departments")),
      },
    ],
  }), [view, onNavigate]);

  const activeWorkGroups = useMemo(
    () => singleActiveDestination(isAdmin ? [executiveGroup, ...deptWorkGroups, adminSettingsGroup] : deptWorkGroups),
    [isAdmin, executiveGroup, deptWorkGroups, adminSettingsGroup]
  );

  // Auto-expand group containing active item
  useEffect(() => {
    for (const group of activeWorkGroups) {
      if (group.items.some((item) => item.isActive)) {
        setExpandedGroups((prev) => (prev[group.id] ? prev : { ...prev, [group.id]: true }));
      }
    }
  }, [activeWorkGroups]);

  // Flatten all items for Favorites lookup
  const allAvailableItems = useMemo(() => {
    const map = new Map<string, SidebarMenuItem>();
    for (const group of activeWorkGroups) {
      for (const item of group.items) {
        map.set(item.id, item);
      }
    }
    return map;
  }, [activeWorkGroups]);

  const favoriteItems = useMemo(() => {
    const list: SidebarMenuItem[] = [];
    for (const id of favoriteIds) {
      const item = allAvailableItems.get(id);
      if (item) list.push({ ...item, isActive: false });
    }
    return list;
  }, [favoriteIds, allAvailableItems]);

  const isCollapsed = !sidebarExpanded && !isMobile;

  // 5. Render Compact Icon-Only Rail View
  if (isCollapsed) {
    return (
      <div className="flex h-full w-16 flex-col items-center justify-between py-3">
        {/* Top: Brand & Toggle */}
        <div className="relative flex flex-col items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-steel font-sans text-sm font-bold leading-none tracking-[0.08em] text-primary-foreground shadow-sm shadow-primary/20">
            SS
          </div>
          <button
            aria-label="Expand navigation"
            title="Expand navigation ([)"
            onClick={onToggleExpanded}
            className="grid size-7 place-items-center rounded-md text-current/75 transition-colors hover:bg-sidebar-primary-foreground/15 hover:text-current"
          >
            <PanelLeftOpen className="size-3.5" />
          </button>
        </div>

        {/* Middle: Compact Icons Rail */}
        <div className="my-4 flex flex-1 flex-col items-center gap-1.5 overflow-y-auto no-scrollbar">
          {/* Favorites Star Indicator */}
          <div className="py-1">
            <span
              title="Favorites (Expand sidebar to customize)"
              className="grid size-7 place-items-center text-amber-400"
            >
              <Star className="size-3.5 fill-amber-400" />
            </span>
          </div>

          {/* Favorited Icons */}
          {favoriteItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                data-sidebar-id={item.id}
                onClick={item.onClick}
                aria-label={item.label}
                title={item.label}
                className={`group relative grid size-9 place-items-center rounded-lg transition-colors ${
                  item.isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {item.badge ? (
                  <span className="absolute -top-1 -right-1 grid min-w-3.5 place-items-center rounded-full bg-primary-foreground px-1 font-mono text-[8px] font-bold text-primary shadow">
                    {item.badge}
                  </span>
                ) : null}
                {/* Popover tooltip */}
                <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
                  {item.label}
                </span>
              </button>
            );
          })}

          <div className="my-1.5 h-px w-6 bg-sidebar-border/80" />

          {/* Department / Primary Area Icons */}
          {activeWorkGroups.map((group) => {
            const Icon = group.icon;
            const hasActiveItem = group.items.some((i) => i.isActive);
            return (
              <button
                key={group.id}
                onClick={() => {
                  onToggleExpanded();
                  setExpandedGroups((prev) => ({ ...prev, [group.id]: true }));
                }}
                aria-label={group.title}
                title={`${group.title} (Click to expand)`}
                className={`group relative grid size-9 place-items-center rounded-lg transition-colors ${
                  hasActiveItem
                    ? "border border-primary/40 bg-sidebar-accent text-primary font-semibold"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
                  {group.title}
                </span>
              </button>
            );
          })}
        </div>


      </div>
    );
  }

  // 6. Render Expanded Sidebar View (Desktop or Mobile Drawer)
  return (
    <div className="flex h-full w-full flex-col justify-between overflow-hidden">
      {/* Sidebar Header: Brand & Collapse Toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-sidebar-border/60">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-steel font-sans text-sm font-bold leading-none tracking-[0.08em] text-primary-foreground shadow-sm shadow-primary/20">
            SS
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight truncate">XYZ Pvt Ltd</p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground truncate">
              {isAdmin ? "Global Executive SCMS" : `${persona.label}`}
            </p>
          </div>
        </div>
        {isMobile ? (
          <button
            aria-label="Close menu"
            onClick={onCloseMobile}
            className="grid size-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-sidebar-accent"
          >
            <X className="size-4" />
          </button>
        ) : (
          <button
            aria-label="Collapse navigation"
            title="Collapse navigation ([)"
            onClick={onToggleExpanded}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <PanelLeftClose className="size-3.5" />
          </button>
        )}
      </div>

      {/* Main Navigation Scroll Area */}
      <nav
        className="flex-1 overflow-y-auto pr-1 py-3 space-y-4 text-xs no-scrollbar"
        aria-label="Primary role-aware navigation"
      >
        {/* Section 1: Favorites */}
        <div className="space-y-1">
          <div
            onClick={() => toggleGroup("favorites")}
            className="flex items-center justify-between px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase text-amber-500/90 dark:text-amber-400 hover:bg-sidebar-accent/50 cursor-pointer select-none"
          >
            <span className="flex items-center gap-1.5">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              <span>Favorites</span>
              <span className="font-mono text-[9px] text-muted-foreground">({favoriteItems.length})</span>
            </span>
            {expandedGroups["favorites"] ? (
              <ChevronDown className="size-3 text-muted-foreground transition-transform" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground transition-transform" />
            )}
          </div>

          {expandedGroups["favorites"] && (
            <div className="space-y-0.5 pt-0.5">
              {favoriteItems.length === 0 ? (
                <p className="px-2 py-1.5 text-[11px] text-muted-foreground italic">
                  Hover any menu item and click ★ to pin to favorites.
                </p>
              ) : (
                favoriteItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={`fav-${item.id}`}
                      className="group relative flex items-center justify-between rounded-md transition-colors"
                    >
                      <button
                        onClick={item.onClick}
                        className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                          item.isActive
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <Icon className="size-3.5 shrink-0" />
                        <span className="truncate flex-1">{item.label}</span>
                        {item.badge ? (
                          <span
                            className={`grid min-w-4 place-items-center rounded-full px-1 font-mono text-[9px] leading-4 ${
                              item.isActive
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-sidebar-accent text-sidebar-accent-foreground"
                            }`}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </button>
                      <button
                        title="Unpin from favorites"
                        onClick={(e) => toggleFavorite(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-amber-400 hover:text-amber-500 transition-opacity"
                      >
                        <Star className="size-3 fill-amber-400" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section 2: Work Groups Accordion */}
        <div className="space-y-3 pt-1 border-t border-sidebar-border/40">
          {activeWorkGroups.map((group) => {
            const isGroupExpanded = !!expandedGroups[group.id];
            const hasActiveItem = group.items.some((i) => i.isActive);

            return (
              <div key={group.id} className="space-y-1">
                {/* Accordion Group Header with Chevron Arrow */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`flex w-full items-center justify-between px-2 py-1 rounded text-[11px] font-semibold tracking-wide transition-colors ${
                    hasActiveItem
                      ? "text-primary font-bold bg-sidebar-accent/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 uppercase text-[10px] tracking-wider truncate">
                    <span>{group.title}</span>
                  </span>
                  <span className="shrink-0 ml-1">
                    {isGroupExpanded ? (
                      <ChevronDown className="size-3 text-muted-foreground transition-transform duration-200" />
                    ) : (
                      <ChevronRight className="size-3 text-muted-foreground transition-transform duration-200" />
                    )}
                  </span>
                </button>

                {/* Accordion Group Items */}
                {isGroupExpanded && (
                  <div className="space-y-0.5 pl-1.5 border-l-2 border-sidebar-border/50 ml-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isFavorited = favoriteIds.includes(item.id);

                      return (
                        <div
                          key={item.id}
                          className="group relative flex items-center justify-between rounded-md"
                        >
                          <button
                            data-sidebar-id={item.id}
                            onClick={item.onClick}
                            className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-medium transition-colors ${
                              item.isActive
                                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            }`}
                          >
                            <Icon className="size-3.5 shrink-0" />
                            <span className="truncate flex-1">{item.label}</span>
                            {item.badge ? (
                              <span
                                className={`grid min-w-4 place-items-center rounded-full px-1 font-mono text-[9px] leading-4 ${
                                  item.isActive
                                    ? "bg-primary-foreground/20 text-primary-foreground"
                                    : "bg-sidebar-accent text-sidebar-accent-foreground"
                                }`}
                              >
                                {item.badge}
                              </span>
                            ) : null}
                          </button>
                          {/* Pin / Unpin star button on hover */}
                          <button
                            title={isFavorited ? "Unpin from favorites" : "Pin to favorites"}
                            onClick={(e) => toggleFavorite(item.id, e)}
                            className={`p-1 transition-opacity ${
                              isFavorited
                                ? "text-amber-400 opacity-90 hover:opacity-100"
                                : "opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground"
                            }`}
                          >
                            <Star
                              className={`size-3 ${
                                isFavorited ? "fill-amber-400 text-amber-400" : "hover:text-amber-400"
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {isAdmin && (
        <div className="mt-auto pt-2.5 pb-1 border-t border-sidebar-border/60 px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground bg-sidebar-accent/20 rounded-lg mx-2 mb-2">
          <span className="font-mono uppercase tracking-wider text-[10px] text-primary font-bold">Admin Authority</span>
          <span className="font-mono text-[10px] text-muted-foreground">Full Rights</span>
        </div>
      )}
    </div>
  );
}

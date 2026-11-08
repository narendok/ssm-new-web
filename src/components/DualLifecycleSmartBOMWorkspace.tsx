import React, { useMemo, useState } from "react";
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Filter,
  Search,
  ExternalLink,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Building,
  RefreshCw,
  SlidersHorizontal,
  Lock,
  Unlock,
  GitCompare,
  FileCheck,
  Plus,
  ArrowRight,
  Eye,
  AlertCircle,
  Copy,
  Check,
  FileSpreadsheet,
  Boxes,
  Cpu,
} from "lucide-react";
import type { InventoryItem } from "./LiveInventoryWorkspace";

// =============================================================================
// 1. DATA CONTRACTS: DUAL-LIFECYCLE SMART BOM
// =============================================================================

export type BOMLifecycleState = "tentative" | "released";

export type BOMItem = {
  id: string;
  line: string;
  referenceDesignator: string; // e.g. "U1", "C1-C10, C25", "R1-R8"
  category: "Microcontroller" | "RF & Modem" | "Power & Protection" | "Connectors" | "Passives" | "Mechanical" | "Sensors" | "Wire Harnesses";
  mpn: string;
  description: string;
  packageCase: string;
  qtyPerDevice: number;
  manufacturer: string;
  sourcedSupplier: string;
  leadTimeWeeks: number;
  targetCostUsd: number;
  quotedCostUsd: number;
  aecQualified: boolean;
  qualificationStandard: string;
  status: "Approved" | "Alternate Recommended" | "Long Lead Buffer Required" | "Provisional Candidate" | "Pending R&D Clarification";
  notes: string;
  substitutes: string[];
  isProvisional?: boolean;
};

export type BOMRevision = {
  id: string;
  projectId: string;
  projectName: string;
  revisionCode: string; // e.g. "v0.3-tentative" or "Rev A (ECO-2026-004)"
  lifecycleState: BOMLifecycleState;
  author: string;
  approver?: string;
  createdAt: string;
  lockedAt?: string;
  ecoNumber?: string;
  changeRationale?: string;
  items: BOMItem[];
};

// =============================================================================
// 2. DEFAULT DUAL-LIFECYCLE BOM REVISIONS
// =============================================================================

export const defaultBOMRevisions: BOMRevision[] = [
  // --- TENTATIVE BOM: HLPL-AI4T-01 (Engineering Draft / Provisional Exploration) ---
  {
    id: "bom-ai4t-tentative",
    projectId: "HLPL-AI4T-01",
    projectName: "Tata Ace EV 4G Telematics Gateway",
    revisionCode: "v0.3-tentative",
    lifecycleState: "tentative",
    author: "Avery Vale (EHW Lead)",
    createdAt: "2026-10-15 11:30",
    changeRationale: "Early prototype feasibility and costing exploration. Contains provisional passive arrays and candidate modem.",
    items: [
      {
        id: "T-01",
        line: "L01",
        referenceDesignator: "U1",
        category: "Microcontroller",
        mpn: "STM32G0B1VCT6",
        description: "Main Host MCU, ARM Cortex-M0+ 64MHz, 512KB Flash, 144KB RAM, dual CAN FD",
        packageCase: "LQFP-100",
        qtyPerDevice: 1,
        manufacturer: "STMicroelectronics",
        sourcedSupplier: "Arrow Electronics (Authorized)",
        leadTimeWeeks: 6,
        targetCostUsd: 4.80,
        quotedCostUsd: 4.65,
        aecQualified: true,
        qualificationStandard: "AEC-Q100 Grade 1 (-40°C to +125°C)",
        status: "Approved",
        notes: "Direct contract allocation for 50,000 units locked. 15,000 safety stock at Arrow Pune warehouse.",
        substitutes: ["STM32G0B1VET6", "GD32F303VCT6"],
      },
      {
        id: "T-02",
        line: "L02",
        referenceDesignator: "U2",
        category: "RF & Modem",
        mpn: "EG915N-EU",
        description: "LTE Cat-1 bis Cellular Wireless Modem + GNSS Receiver, Multi-band, eSIM ready",
        packageCase: "LGA-126",
        qtyPerDevice: 1,
        manufacturer: "Quectel Wireless Solutions",
        sourcedSupplier: "Quectel Direct / Rutronik",
        leadTimeWeeks: 14,
        targetCostUsd: 12.50,
        quotedCostUsd: 11.90,
        aecQualified: true,
        qualificationStandard: "Automotive PPAP Level 3 / IATF 16949",
        status: "Long Lead Buffer Required",
        notes: "14-week lead time requires advance long-lead buffer PO for initial batch of 10,000 units.",
        substitutes: ["SIM7672S", "EC200U-CN"],
      },
      {
        id: "T-03",
        line: "L03",
        referenceDesignator: "U3",
        category: "Power & Protection",
        mpn: "LMR14050SDDAR",
        description: "Step-Down Switching Buck Regulator 40V/5A, 9V-36V nominal operating input",
        packageCase: "SO-PowerPAD-8",
        qtyPerDevice: 1,
        manufacturer: "Texas Instruments",
        sourcedSupplier: "Avnet Logistics (Dual-source: Rutronik)",
        leadTimeWeeks: 4,
        targetCostUsd: 1.85,
        quotedCostUsd: 1.72,
        aecQualified: true,
        qualificationStandard: "AEC-Q100 Grade 1",
        status: "Approved",
        notes: "Dual-sourcing approved with Microchip MCP16301 alternate verified by Avery Vale (EHW).",
        substitutes: ["LM5164-Q1", "MCP16301"],
      },
      {
        id: "T-04",
        line: "L04",
        referenceDesignator: "D1, D2",
        category: "Power & Protection",
        mpn: "SM5S36AHE3_A/I",
        description: "Automotive Transient Voltage Suppressor (TVS) 36V, 3600W PAR, ISO 7637-2 Pulse 5a/5b",
        packageCase: "DO-218AB",
        qtyPerDevice: 2,
        manufacturer: "Vishay Intertechnology",
        sourcedSupplier: "Mouser Electronics India",
        leadTimeWeeks: 8,
        targetCostUsd: 1.45,
        quotedCostUsd: 1.38,
        aecQualified: true,
        qualificationStandard: "AEC-Q101 Qualified / ISO 16750-2",
        status: "Approved",
        notes: "ISO 7637-2 Load Dump clamp confirmed with XYZ Pvt Ltd surge testing jig in Noida R&D Lab.",
        substitutes: ["TPSMD36A", "SLD36U-017"],
      },
      {
        id: "T-05",
        line: "L05",
        referenceDesignator: "J1",
        category: "Connectors",
        mpn: "19418-0014",
        description: "16-Circuit Hybrid OBD-II Sealed Right-Angle Header Assembly, Automotive Grade",
        packageCase: "Panel Mount 16-Pin",
        qtyPerDevice: 1,
        manufacturer: "Molex Automotive",
        sourcedSupplier: "Molex Direct / TTI India",
        leadTimeWeeks: 12,
        targetCostUsd: 3.20,
        quotedCostUsd: 2.95,
        aecQualified: true,
        qualificationStandard: "USCAR-2 Class 2 / IP67",
        status: "Approved",
        notes: "Tata Ace EV wiring harness counterpart pre-approved by Samira Holt (MECH).",
        substitutes: ["TE-776262-1", "Amphenol AT04-16PA"],
      },
      {
        id: "T-06",
        line: "L06",
        referenceDesignator: "C1-C10, C15-C24",
        category: "Passives",
        mpn: "C0603C104K5RACTU (PROVISIONAL)",
        description: "0.1uF 50V 10% X7R 0603 MLCC Automotive Capacitor Array",
        packageCase: "0603 (1608 Metric)",
        qtyPerDevice: 20,
        manufacturer: "KEMET / Yageo",
        sourcedSupplier: "Mouser / Digikey",
        leadTimeWeeks: 2,
        targetCostUsd: 0.012,
        quotedCostUsd: 0.015,
        aecQualified: false,
        qualificationStandard: "Commercial Grade (Candidate for AEC-Q200 upgrade)",
        status: "Provisional Candidate",
        notes: "Provisional engineering selection. Must replace with AEC-Q200 part before production release.",
        substitutes: ["GCM188R71H104KA57D"],
        isProvisional: true,
      },
      {
        id: "T-07",
        line: "L07",
        referenceDesignator: "W1",
        category: "Wire Harnesses",
        mpn: "HLPL-HARN-AI4T-PWR-01",
        description: "High-Voltage 4-Pin Sealed Automotive Battery & BMS Harness Assembly, IP67 Loom",
        packageCase: "Custom Loom Assembly",
        qtyPerDevice: 1,
        manufacturer: "XYZ Pvt Ltd Cable Division",
        sourcedSupplier: "XYZ Pvt Ltd Greater Noida Plant 2",
        leadTimeWeeks: 3,
        targetCostUsd: 4.50,
        quotedCostUsd: 4.10,
        aecQualified: true,
        qualificationStandard: "AIS-140 / SAE J1128 Type SXL",
        status: "Approved",
        notes: "In-house harness production scheduled for Batch 1 ramp-up.",
        substitutes: ["HLPL-HARN-OBD2-16P"],
      },
    ],
  },

  // --- RELEASED BOM: HLPL-AI4T-01 Rev A (Governed Baseline / ECO-2026-004) ---
  {
    id: "bom-ai4t-rev-a",
    projectId: "HLPL-AI4T-01",
    projectName: "Tata Ace EV 4G Telematics Gateway",
    revisionCode: "Rev A (ECO-2026-004)",
    lifecycleState: "released",
    author: "Avery Vale (EHW Lead)",
    approver: "Executive Admin / MD",
    createdAt: "2026-10-16 16:45",
    lockedAt: "2026-10-16 17:00",
    ecoNumber: "ECO-2026-004",
    changeRationale: "TEST candidate baseline for Phase 2 PoC and Phase 4 pilot integration; component qualification requires linked evidence and review.",
    items: [
      {
        id: "R-01",
        line: "L01",
        referenceDesignator: "U1",
        category: "Microcontroller",
        mpn: "STM32G0B1VCT6",
        description: "Main Host MCU, ARM Cortex-M0+ 64MHz, 512KB Flash, 144KB RAM, dual CAN FD",
        packageCase: "LQFP-100",
        qtyPerDevice: 1,
        manufacturer: "STMicroelectronics",
        sourcedSupplier: "Arrow Electronics (Authorized)",
        leadTimeWeeks: 6,
        targetCostUsd: 4.80,
        quotedCostUsd: 4.65,
        aecQualified: true,
        qualificationStandard: "AEC-Q100 Grade 1 (-40°C to +125°C)",
        status: "Approved",
        notes: "Direct contract allocation for 50,000 units locked.",
        substitutes: ["STM32G0B1VET6"],
      },
      {
        id: "R-02",
        line: "L02",
        referenceDesignator: "U2",
        category: "RF & Modem",
        mpn: "EG915N-EU",
        description: "LTE Cat-1 bis Cellular Wireless Modem + GNSS Receiver, Multi-band, eSIM ready",
        packageCase: "LGA-126",
        qtyPerDevice: 1,
        manufacturer: "Quectel Wireless Solutions",
        sourcedSupplier: "Quectel Direct / Rutronik",
        leadTimeWeeks: 14,
        targetCostUsd: 12.50,
        quotedCostUsd: 11.90,
        aecQualified: true,
        qualificationStandard: "Automotive PPAP Level 3 / IATF 16949",
        status: "Approved",
        notes: "Long lead buffer PO issued. Sourced via Quectel direct.",
        substitutes: ["SIM7672S"],
      },
      {
        id: "R-03",
        line: "L03",
        referenceDesignator: "U3",
        category: "Power & Protection",
        mpn: "LMR14050SDDAR",
        description: "Step-Down Switching Buck Regulator 40V/5A, 9V-36V nominal operating input",
        packageCase: "SO-PowerPAD-8",
        qtyPerDevice: 1,
        manufacturer: "Texas Instruments",
        sourcedSupplier: "Avnet Logistics",
        leadTimeWeeks: 4,
        targetCostUsd: 1.85,
        quotedCostUsd: 1.72,
        aecQualified: true,
        qualificationStandard: "AEC-Q100 Grade 1",
        status: "Approved",
        notes: "Verified by EHW lead.",
        substitutes: ["LM5164-Q1"],
      },
      {
        id: "R-04",
        line: "L04",
        referenceDesignator: "D1, D2",
        category: "Power & Protection",
        mpn: "SM5S36AHE3_A/I",
        description: "Automotive Transient Voltage Suppressor (TVS) 36V, 3600W PAR, ISO 7637-2 Pulse 5a/5b",
        packageCase: "DO-218AB",
        qtyPerDevice: 2,
        manufacturer: "Vishay Intertechnology",
        sourcedSupplier: "Mouser Electronics India",
        leadTimeWeeks: 8,
        targetCostUsd: 1.45,
        quotedCostUsd: 1.38,
        aecQualified: true,
        qualificationStandard: "AEC-Q101 Qualified / ISO 16750-2",
        status: "Approved",
        notes: "Surge protection verified.",
        substitutes: ["TPSMD36A"],
      },
      {
        id: "R-05",
        line: "L05",
        referenceDesignator: "J1",
        category: "Connectors",
        mpn: "19418-0014",
        description: "16-Circuit Hybrid OBD-II Sealed Right-Angle Header Assembly, Automotive Grade",
        packageCase: "Panel Mount 16-Pin",
        qtyPerDevice: 1,
        manufacturer: "Molex Automotive",
        sourcedSupplier: "Molex Direct / TTI India",
        leadTimeWeeks: 12,
        targetCostUsd: 3.20,
        quotedCostUsd: 2.95,
        aecQualified: true,
        qualificationStandard: "USCAR-2 Class 2 / IP67",
        status: "Approved",
        notes: "Tooling locked with Tata Motors MECH counterpart.",
        substitutes: ["TE-776262-1"],
      },
      {
        id: "R-06",
        line: "L06",
        referenceDesignator: "C1-C10, C15-C24",
        category: "Passives",
        mpn: "GCM188R71H104KA57D",
        description: "0.1uF 50V 10% X7R 0603 Automotive AEC-Q200 Qualified MLCC",
        packageCase: "0603 (1608 Metric)",
        qtyPerDevice: 20,
        manufacturer: "Murata Electronics",
        sourcedSupplier: "Arrow / Mouser",
        leadTimeWeeks: 4,
        targetCostUsd: 0.018,
        quotedCostUsd: 0.016,
        aecQualified: true,
        qualificationStandard: "AEC-Q200 Grade 1 (-55°C to +125°C)",
        status: "Approved",
        notes: "AEC-Q200 verified replacement for provisional KEMET candidate.",
        substitutes: ["CGA3E2X7R1H104K080AA"],
      },
      {
        id: "R-07",
        line: "L07",
        referenceDesignator: "W1",
        category: "Wire Harnesses",
        mpn: "HLPL-HARN-AI4T-PWR-01",
        description: "High-Voltage 4-Pin Sealed Automotive Battery & BMS Harness Assembly, IP67 Loom",
        packageCase: "Custom Loom Assembly",
        qtyPerDevice: 1,
        manufacturer: "XYZ Pvt Ltd Cable Division",
        sourcedSupplier: "XYZ Pvt Ltd Greater Noida Plant 2",
        leadTimeWeeks: 3,
        targetCostUsd: 4.50,
        quotedCostUsd: 4.10,
        aecQualified: true,
        qualificationStandard: "AIS-140 / SAE J1128 Type SXL",
        status: "Approved",
        notes: "In-house harness assembly.",
        substitutes: [],
      },
    ],
  },
];

// =============================================================================
// 3. WORKSPACE PROPS
// =============================================================================

export type DualLifecycleSmartBOMWorkspaceProps = {
  projectId?: string;
  inventoryItems?: InventoryItem[];
  onReleaseBOM?: (releasedBOM: BOMRevision) => void;
  readOnly?: boolean;
};

// =============================================================================
// 4. MAIN WORKSPACE COMPONENT
// =============================================================================

export function DualLifecycleSmartBOMWorkspace({
  projectId = "HLPL-AI4T-01",
  inventoryItems = [],
  onReleaseBOM,
  readOnly = false,
}: DualLifecycleSmartBOMWorkspaceProps) {
  // Active revision state
  const [revisions, setRevisions] = useState<BOMRevision[]>(defaultBOMRevisions);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>("bom-ai4t-tentative");
  
  // Filter and simulation controls
  const [plannedBuildQty, setPlannedBuildQty] = useState<number>(1000);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Revision comparison state
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [compareBaseId, setCompareBaseId] = useState<string>("bom-ai4t-rev-a");
  const [compareTargetId, setCompareTargetId] = useState<string>("bom-ai4t-tentative");

  // ECO Promotion modal state
  const [ecoModalOpen, setEcoModalOpen] = useState<boolean>(false);
  const [ecoNumber, setEcoNumber] = useState<string>("ECO-2026-018");
  const [ecoRationale, setEcoRationale] = useState<string>("Upgraded all provisional passives to AEC-Q200 and locked supplier pricing for 50,000 unit production run.");
  const [ecoSignoff, setEcoSignoff] = useState<string>("Avery Vale (EHW Lead)");

  // Active revision
  const activeRevision: BOMRevision = useMemo(() => {
    return (revisions.find((r) => r.id === selectedRevisionId) || revisions[0]) as BOMRevision;
  }, [revisions, selectedRevisionId]);

  // Inventory lookup map for live stock simulation
  const inventoryStockMap = useMemo(() => {
    const map = new Map<string, { onHand: number; released: number; held: number; unitCost: number }>();
    inventoryItems.forEach((item) => {
      map.set(item.partNumber.trim().toUpperCase(), {
        onHand: item.onHand,
        released: item.released ?? item.onHand,
        held: item.held ?? 0,
        unitCost: item.tentativeUnitCostUsd ?? 0,
      });
    });
    return map;
  }, [inventoryItems]);

  // Enriched items with live stock simulation
  const enrichedItems = useMemo(() => {
    return activeRevision.items.map((item) => {
      const stockInfo = inventoryStockMap.get(item.mpn.trim().toUpperCase());
      const releasedStock = stockInfo ? stockInfo.released : 0;
      const totalRequired = item.qtyPerDevice * plannedBuildQty;
      const shortage = Math.max(0, totalRequired - releasedStock);
      const isShort = shortage > 0;
      const totalLineCost = item.quotedCostUsd * item.qtyPerDevice;
      const shortageCost = shortage * item.quotedCostUsd;

      return {
        ...item,
        releasedStock,
        totalRequired,
        shortage,
        isShort,
        totalLineCost,
        shortageCost,
      };
    });
  }, [activeRevision, inventoryStockMap, plannedBuildQty]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return enrichedItems.filter((item) => {
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesSearch =
        item.mpn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.referenceDesignator.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.manufacturer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [enrichedItems, categoryFilter, searchQuery]);

  // Aggregate Metrics for Active BOM
  const metrics = useMemo(() => {
    const totalLines = activeRevision.items.length;
    const totalComponentsPerBoard = activeRevision.items.reduce((acc, i) => acc + i.qtyPerDevice, 0);
    const totalBoardCostUsd = activeRevision.items.reduce((acc, i) => acc + i.quotedCostUsd * i.qtyPerDevice, 0);
    const targetBoardCostUsd = activeRevision.items.reduce((acc, i) => acc + i.targetCostUsd * i.qtyPerDevice, 0);
    const costVarianceUsd = totalBoardCostUsd - targetBoardCostUsd;
    const percentSavings = targetBoardCostUsd > 0 ? ((targetBoardCostUsd - totalBoardCostUsd) / targetBoardCostUsd) * 100 : 0;

    const shortLines = enrichedItems.filter((i) => i.isShort).length;
    const totalShortageCost = enrichedItems.reduce((acc, i) => acc + i.shortageCost, 0);
    const provisionalCount = activeRevision.items.filter((i) => i.isProvisional).length;

    return {
      totalLines,
      totalComponentsPerBoard,
      totalBoardCostUsd,
      targetBoardCostUsd,
      costVarianceUsd,
      percentSavings,
      shortLines,
      totalShortageCost,
      provisionalCount,
    };
  }, [activeRevision, enrichedItems]);

  // Comparison Diff Engine between Base and Target Revisions
  const diffData = useMemo(() => {
    const baseRev = revisions.find((r) => r.id === compareBaseId);
    const targetRev = revisions.find((r) => r.id === compareTargetId);
    if (!baseRev || !targetRev) return null;

    const baseMap = new Map(baseRev.items.map((i) => [i.mpn, i]));
    const targetMap = new Map(targetRev.items.map((i) => [i.mpn, i]));

    const added: BOMItem[] = [];
    const removed: BOMItem[] = [];
    const modified: Array<{
      base: BOMItem;
      target: BOMItem;
      qtyDiff: number;
      costDiff: number;
      leadDiff: number;
    }> = [];
    const unchanged: BOMItem[] = [];

    targetRev.items.forEach((tItem) => {
      const bItem = baseMap.get(tItem.mpn);
      if (!bItem) {
        added.push(tItem);
      } else {
        const qtyDiff = tItem.qtyPerDevice - bItem.qtyPerDevice;
        const costDiff = tItem.quotedCostUsd - bItem.quotedCostUsd;
        const leadDiff = tItem.leadTimeWeeks - bItem.leadTimeWeeks;

        if (qtyDiff !== 0 || Math.abs(costDiff) > 0.001 || leadDiff !== 0 || tItem.isProvisional !== bItem.isProvisional) {
          modified.push({
            base: bItem,
            target: tItem,
            qtyDiff,
            costDiff,
            leadDiff,
          });
        } else {
          unchanged.push(tItem);
        }
      }
    });

    baseRev.items.forEach((bItem) => {
      if (!targetMap.has(bItem.mpn)) {
        removed.push(bItem);
      }
    });

    const baseTotalCost = baseRev.items.reduce((acc, i) => acc + i.quotedCostUsd * i.qtyPerDevice, 0);
    const targetTotalCost = targetRev.items.reduce((acc, i) => acc + i.quotedCostUsd * i.qtyPerDevice, 0);
    const netCostDelta = targetTotalCost - baseTotalCost;

    return {
      baseRev,
      targetRev,
      added,
      removed,
      modified,
      unchanged,
      baseTotalCost,
      targetTotalCost,
      netCostDelta,
    };
  }, [revisions, compareBaseId, compareTargetId]);

  // Handle ECO Promotion (Promote Tentative to Released Baseline)
  const handlePromoteToReleased = () => {
    if (activeRevision.lifecycleState === "released") return;

    // Check if there are provisional candidate items
    const hasProvisional = activeRevision.items.some((i) => i.isProvisional);
    if (hasProvisional) {
      alert("Validation Warning: Tentative BOM contains provisional unverified candidate components (e.g. non-AEC passives). Please resolve all candidate parts before formal baseline release.");
      return;
    }

    const newReleasedRev: BOMRevision = {
      id: `bom-${Date.now()}`,
      projectId: activeRevision.projectId,
      projectName: activeRevision.projectName,
      revisionCode: `Rev B (${ecoNumber})`,
      lifecycleState: "released",
      author: ecoSignoff,
      approver: "Executive Admin / Managing Director",
      createdAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      lockedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      ecoNumber,
      changeRationale: ecoRationale,
      items: activeRevision.items.map((item) => ({
        ...item,
        status: "Approved",
        isProvisional: false,
      })),
    };

    setRevisions((prev) => [newReleasedRev, ...prev]);
    setSelectedRevisionId(newReleasedRev.id);
    setEcoModalOpen(false);

    if (onReleaseBOM) {
      onReleaseBOM(newReleasedRev);
    }
  };

  // =============================================================================
  // MULTI-FORMAT EXPORT FUNCTIONS
  // =============================================================================

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Export Hierarchical / Indented BOM
  const exportHierarchicalBOM = () => {
    const headers = [
      "Level",
      "Line",
      "Reference Designator",
      "Category",
      "MPN",
      "Description",
      "Package / Case",
      "Qty Per Board",
      "Manufacturer",
      "Sourced Supplier",
      "Lead Time (Weeks)",
      "Target Cost (USD)",
      "Quoted Cost (USD)",
      "Ext Cost (USD)",
      "AEC Standard",
      "Lifecycle Status",
    ];

    const rows = activeRevision.items.map((i) => [
      "1.0",
      i.line,
      `"${i.referenceDesignator}"`,
      `"${i.category}"`,
      `"${i.mpn}"`,
      `"${i.description.replace(/"/g, '""')}"`,
      `"${i.packageCase}"`,
      i.qtyPerDevice,
      `"${i.manufacturer}"`,
      `"${i.sourcedSupplier}"`,
      i.leadTimeWeeks,
      i.targetCostUsd.toFixed(3),
      i.quotedCostUsd.toFixed(3),
      (i.quotedCostUsd * i.qtyPerDevice).toFixed(3),
      `"${i.qualificationStandard}"`,
      `"${i.status}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSV(csvContent, `BOM_${activeRevision.projectId}_${activeRevision.revisionCode.replace(/[^a-zA-Z0-9]/g, "_")}_Hierarchical.csv`);
  };

  // 2. Export Flattened Production BOM
  const exportFlattenedProductionBOM = () => {
    const headers = [
      "Item",
      "MPN",
      "Reference Designators",
      "Qty Per Board",
      "Planned Order Qty",
      "Package",
      "Description",
      "Supplier",
      "Unit Cost (USD)",
      "Line Total (USD)",
      "Substitutes",
    ];

    const rows = activeRevision.items.map((i, idx) => [
      idx + 1,
      `"${i.mpn}"`,
      `"${i.referenceDesignator}"`,
      i.qtyPerDevice,
      i.qtyPerDevice * plannedBuildQty,
      `"${i.packageCase}"`,
      `"${i.description.replace(/"/g, '""')}"`,
      `"${i.sourcedSupplier}"`,
      i.quotedCostUsd.toFixed(3),
      (i.quotedCostUsd * i.qtyPerDevice * plannedBuildQty).toFixed(2),
      `"${i.substitutes.join("; ")}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSV(csvContent, `BOM_${activeRevision.projectId}_${activeRevision.revisionCode.replace(/[^a-zA-Z0-9]/g, "_")}_Production_Flattened.csv`);
  };

  // 3. Export Shortage & Procurement Requisition Report
  const exportShortageReport = () => {
    const headers = [
      "MPN",
      "Description",
      "Qty Per Board",
      "Required For Build",
      "Released In-Stock",
      "Shortage Quantity",
      "Estimated Shortage Cost (USD)",
      "Supplier Lead Time (Weeks)",
      "Supplier",
      "Approved Substitutes",
    ];

    const shortageItems = enrichedItems.filter((i) => i.isShort);
    const rows = shortageItems.map((i) => [
      `"${i.mpn}"`,
      `"${i.description.replace(/"/g, '""')}"`,
      i.qtyPerDevice,
      i.totalRequired,
      i.releasedStock,
      i.shortage,
      i.shortageCost.toFixed(2),
      i.leadTimeWeeks,
      `"${i.sourcedSupplier}"`,
      `"${i.substitutes.join("; ")}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSV(csvContent, `BOM_SHORTAGE_REQUISITION_${activeRevision.projectId}_Build_${plannedBuildQty}pcs.csv`);
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          WORKSPACE HEADER & DUAL-LIFECYCLE STATUS BANNER
         ========================================================================= */}
      <div className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                {activeRevision.projectId}
              </span>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Dual-Lifecycle Smart BOM Engine
              </h2>
              {activeRevision.lifecycleState === "tentative" ? (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Unlock className="size-3" />
                  Tentative Exploration (Draft v0.3)
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <Lock className="size-3" />
                  Released Baseline (Locked · {activeRevision.ecoNumber || "ECO-2026-004"})
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeRevision.lifecycleState === "tentative"
                ? "Exploratory BOM for prototype design, provisional MPN evaluation, and unconstrained what-if stock simulations."
                : `Governed, immutable production baseline authorized by ${activeRevision.approver || "Executive Admin"}. Tied to project committed PPAP.`}
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Revision Selector */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1">
              <Layers className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">Revision:</span>
              <select
                value={selectedRevisionId}
                onChange={(e) => setSelectedRevisionId(e.target.value)}
                className="bg-transparent text-xs font-bold text-foreground focus:outline-none"
              >
                {revisions.map((rev) => (
                  <option key={rev.id} value={rev.id} className="bg-popover text-popover-foreground">
                    {rev.revisionCode} ({rev.lifecycleState.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Compare Toggle */}
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all ${
                compareMode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-secondary/50 text-foreground hover:bg-secondary"
              }`}
            >
              <GitCompare className="size-3.5" />
              <span>{compareMode ? "Exit Comparison" : "Compare Revisions"}</span>
            </button>

            {/* Promote to Released Baseline (ECO) Button */}
            {activeRevision.lifecycleState === "tentative" && !readOnly && (
              <button
                onClick={() => setEcoModalOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <Lock className="size-3.5" />
                <span>Promote to Baseline (ECO)</span>
              </button>
            )}

            {/* Export Dropdown / Menu */}
            <div className="flex items-center gap-1">
              <button
                onClick={exportFlattenedProductionBOM}
                title="Export Flattened Production BOM (.csv)"
                className="flex h-8 items-center gap-1 rounded-lg border border-border bg-secondary/50 px-2.5 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <Download className="size-3.5" />
                <span>Production BOM</span>
              </button>
              <button
                onClick={exportHierarchicalBOM}
                title="Export Indented / Hierarchical BOM (.csv)"
                className="flex h-8 items-center gap-1 rounded-lg border border-border bg-secondary/50 px-2.5 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <FileSpreadsheet className="size-3.5" />
                <span>Indented</span>
              </button>
              <button
                onClick={exportShortageReport}
                title="Export Shortage & Procurement Requisition Report (.csv)"
                className="flex h-8 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              >
                <AlertTriangle className="size-3.5" />
                <span>Shortages ({metrics.shortLines})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Change Rationale Bar if Released */}
        {activeRevision.changeRationale && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground border border-border/40">
            <ShieldCheck className="size-4 shrink-0 text-primary mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Governance Note:</span> {activeRevision.changeRationale}
              {activeRevision.lockedAt && (
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                  (Locked at {activeRevision.lockedAt} by {activeRevision.approver || activeRevision.author})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          REVISION DIFF ENGINE (IF COMPARISON MODE IS ACTIVE)
         ========================================================================= */}
      {compareMode && diffData && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 pb-3">
            <div className="flex items-center gap-2">
              <GitCompare className="size-5 text-primary" />
              <div>
                <h3 className="text-sm font-bold text-foreground">BOM Revision Diff Engine</h3>
                <p className="text-xs text-muted-foreground">
                  Comparing baseline <strong className="text-foreground">{diffData.baseRev.revisionCode}</strong> against target{" "}
                  <strong className="text-foreground">{diffData.targetRev.revisionCode}</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Base:</span>
                <select
                  value={compareBaseId}
                  onChange={(e) => setCompareBaseId(e.target.value)}
                  className="rounded border border-border bg-card px-2 py-1 text-xs font-semibold"
                >
                  {revisions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.revisionCode}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Compare With:</span>
                <select
                  value={compareTargetId}
                  onChange={(e) => setCompareTargetId(e.target.value)}
                  className="rounded border border-border bg-card px-2 py-1 text-xs font-semibold"
                >
                  {revisions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.revisionCode}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Diff Summary Badges */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase">Added Parts</span>
              <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">+{diffData.added.length}</p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
              <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold uppercase">Removed Parts</span>
              <p className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">-{diffData.removed.length}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase">Modified / Replaced</span>
              <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">{diffData.modified.length}</p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase">Net Unit Cost Delta</span>
              <p className={`mt-1 text-lg font-bold ${diffData.netCostDelta <= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {diffData.netCostDelta <= 0 ? "-$" : "+$"}
                {Math.abs(diffData.netCostDelta).toFixed(3)}
              </p>
            </div>
          </div>

          {/* Diff Breakdown Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-border bg-secondary/50 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Change Type</th>
                  <th className="px-3 py-2">Part Number (MPN)</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Base Qty / Cost</th>
                  <th className="px-3 py-2 text-right">Target Qty / Cost</th>
                  <th className="px-3 py-2">Variance Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-[11px]">
                {diffData.added.map((item) => (
                  <tr key={item.id} className="bg-emerald-500/5 hover:bg-emerald-500/10">
                    <td className="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">ADDED</td>
                    <td className="px-3 py-2 font-bold text-foreground">{item.mpn}</td>
                    <td className="px-3 py-2 text-muted-foreground line-clamp-1">{item.description}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                    <td className="px-3 py-2 text-right font-bold text-foreground">
                      {item.qtyPerDevice} pcs @ ${item.quotedCostUsd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">New item introduced in {diffData.targetRev.revisionCode}</td>
                  </tr>
                ))}
                {diffData.removed.map((item) => (
                  <tr key={item.id} className="bg-rose-500/5 hover:bg-rose-500/10">
                    <td className="px-3 py-2 font-bold text-rose-600 dark:text-rose-400">REMOVED</td>
                    <td className="px-3 py-2 font-bold text-foreground">{item.mpn}</td>
                    <td className="px-3 py-2 text-muted-foreground line-clamp-1">{item.description}</td>
                    <td className="px-3 py-2 text-right font-bold text-foreground">
                      {item.qtyPerDevice} pcs @ ${item.quotedCostUsd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                    <td className="px-3 py-2 text-muted-foreground">Removed in {diffData.targetRev.revisionCode}</td>
                  </tr>
                ))}
                {diffData.modified.map(({ base, target, qtyDiff, costDiff, leadDiff }, idx) => (
                  <tr key={idx} className="bg-amber-500/5 hover:bg-amber-500/10">
                    <td className="px-3 py-2 font-bold text-amber-600 dark:text-amber-400">MODIFIED</td>
                    <td className="px-3 py-2 font-bold text-foreground">{target.mpn}</td>
                    <td className="px-3 py-2 text-muted-foreground line-clamp-1">{target.description}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {base.qtyPerDevice} pcs @ ${base.quotedCostUsd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-foreground">
                      {target.qtyPerDevice} pcs @ ${target.quotedCostUsd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {costDiff !== 0 && (
                        <span className={`mr-2 font-bold ${costDiff < 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          Cost: {costDiff < 0 ? "-$" : "+$"}
                          {Math.abs(costDiff).toFixed(3)}
                        </span>
                      )}
                      {qtyDiff !== 0 && (
                        <span className="mr-2 font-bold text-foreground">
                          Qty: {qtyDiff > 0 ? `+${qtyDiff}` : qtyDiff}
                        </span>
                      )}
                      {target.isProvisional !== base.isProvisional && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          {target.isProvisional ? "Marked Provisional" : "Promoted to AEC-Q"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          METRICS & LIVE STOCK SIMULATION TOOLBAR
         ========================================================================= */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 font-mono text-xs">
        <div className="rounded-xl border border-border bg-card/60 p-3 shadow-sm">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase">BOM Lines</span>
          <p className="mt-1 text-base font-bold text-foreground">{metrics.totalLines}</p>
          <span className="text-[10px] text-muted-foreground">{metrics.totalComponentsPerBoard} parts/board</span>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-3 shadow-sm">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase">Unit Board Cost</span>
          <p className="mt-1 text-base font-bold text-foreground">${metrics.totalBoardCostUsd.toFixed(2)}</p>
          <span className="text-[10px] text-muted-foreground">Target: ${metrics.targetBoardCostUsd.toFixed(2)}</span>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-3 shadow-sm">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase">Target Variance</span>
          <p className={`mt-1 text-base font-bold ${metrics.percentSavings >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
            {metrics.percentSavings >= 0 ? "+" : ""}
            {metrics.percentSavings.toFixed(1)}% savings
          </p>
          <span className="text-[10px] text-muted-foreground">(${Math.abs(metrics.costVarianceUsd).toFixed(2)}/board)</span>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-3 shadow-sm">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase">Planned Build</span>
          <div className="mt-1 flex items-center gap-1">
            <input
              type="number"
              value={plannedBuildQty}
              onChange={(e) => setPlannedBuildQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 rounded border border-border bg-secondary/50 px-1.5 py-0.5 text-xs font-bold text-foreground"
            />
            <span className="text-[11px] font-bold text-foreground">pcs</span>
          </div>
          <span className="text-[10px] text-muted-foreground">What-if simulation</span>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-3 shadow-sm">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase">Shortage Lines</span>
          <p className={`mt-1 text-base font-bold ${metrics.shortLines > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`}>
            {metrics.shortLines} / {metrics.totalLines}
          </p>
          <span className="text-[10px] text-muted-foreground">${metrics.totalShortageCost.toLocaleString()} deficit</span>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-3 shadow-sm">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase">Provisional Items</span>
          <p className={`mt-1 text-base font-bold ${metrics.provisionalCount > 0 ? "text-amber-500" : "text-emerald-600"}`}>
            {metrics.provisionalCount}
          </p>
          <span className="text-[10px] text-muted-foreground">{metrics.provisionalCount > 0 ? "Needs AEC validation" : "100% Governed"}</span>
        </div>
      </div>

      {/* =========================================================================
          SEARCH & CATEGORY FILTER BAR
         ========================================================================= */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search MPN, description, manufacturer, or ref des..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
          >
            <option value="all">All Categories ({enrichedItems.length})</option>
            <option value="Microcontroller">Microcontrollers</option>
            <option value="RF & Modem">RF & Modems</option>
            <option value="Power & Protection">Power & Protection</option>
            <option value="Connectors">Connectors</option>
            <option value="Passives">Passives & Arrays</option>
            <option value="Wire Harnesses">Wire Harnesses</option>
          </select>
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          Showing <strong>{filteredItems.length}</strong> of <strong>{enrichedItems.length}</strong> items for{" "}
          <strong className="text-foreground">{activeRevision.projectName}</strong>
        </div>
      </div>

      {/* =========================================================================
          MAIN BOM SPECIFICATION TABLE WITH LIVE STOCK SIMULATION
         ========================================================================= */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-xs font-mono">
          <thead className="border-b border-border bg-secondary/50 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Line & Ref Des</th>
              <th className="px-3 py-2.5">Manufacturer Part # (MPN)</th>
              <th className="px-3 py-2.5">Category & Package</th>
              <th className="px-3 py-2.5 text-right">Per Board</th>
              <th className="px-3 py-2.5 text-right">Req ({plannedBuildQty} pcs)</th>
              <th className="px-3 py-2.5 text-right">Live Released Stock</th>
              <th className="px-3 py-2.5 text-right">Unit Quoted</th>
              <th className="px-3 py-2.5">Supplier & Lead Time</th>
              <th className="px-3 py-2.5">AEC Qualification</th>
              <th className="px-3 py-2.5">Simulation State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 text-[11px]">
            {filteredItems.map((item) => (
              <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                {/* Line & Ref Des */}
                <td className="px-3 py-2.5 font-bold text-foreground">
                  <div>{item.line}</div>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-primary font-bold">
                    {item.referenceDesignator}
                  </span>
                </td>

                {/* MPN & Description */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <strong className="font-bold text-foreground">{item.mpn}</strong>
                    {item.isProvisional && (
                      <span className="rounded bg-amber-500/15 px-1 py-0.2 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                        PROVISIONAL
                      </span>
                    )}
                  </div>
                  <span className="block font-sans text-[11px] text-muted-foreground line-clamp-1 max-w-xs">
                    {item.description}
                  </span>
                  <span className="block font-sans text-[10px] text-muted-foreground">
                    Mfg: <strong className="text-foreground">{item.manufacturer}</strong>
                  </span>
                </td>

                {/* Category & Package */}
                <td className="px-3 py-2.5">
                  <span className="text-foreground">{item.category}</span>
                  <span className="block text-[10px] text-muted-foreground">{item.packageCase}</span>
                </td>

                {/* Qty Per Board */}
                <td className="px-3 py-2.5 text-right font-bold text-foreground">{item.qtyPerDevice}</td>

                {/* Total Required */}
                <td className="px-3 py-2.5 text-right font-bold text-primary">
                  {item.totalRequired.toLocaleString()}
                </td>

                {/* Live Released Stock */}
                <td className="px-3 py-2.5 text-right font-bold">
                  <span className={item.releasedStock >= item.totalRequired ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                    {item.releasedStock.toLocaleString()}
                  </span>
                </td>

                {/* Unit Quoted */}
                <td className="px-3 py-2.5 text-right">
                  <span className="font-bold text-foreground">${item.quotedCostUsd.toFixed(2)}</span>
                  <span className="block text-[10px] text-muted-foreground">Tgt: ${item.targetCostUsd.toFixed(2)}</span>
                </td>

                {/* Sourced Supplier & Lead Time */}
                <td className="px-3 py-2.5">
                  <span className="font-sans font-semibold text-foreground">{item.sourcedSupplier}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    Lead: <strong className="text-foreground">{item.leadTimeWeeks} wks</strong>
                  </span>
                </td>

                {/* AEC Qualification */}
                <td className="px-3 py-2.5">
                  {item.aecQualified ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="size-3" />
                      {item.qualificationStandard}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      <AlertCircle className="size-3" />
                      Candidate (Non-AEC)
                    </span>
                  )}
                </td>

                {/* Simulation State */}
                <td className="px-3 py-2.5">
                  {item.isShort ? (
                    <div className="space-y-0.5">
                      <span className="rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        Shortage: -{item.shortage.toLocaleString()}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        Deficit: ${item.shortageCost.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Stock Covered ✓
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* =========================================================================
          ECO PROMOTION / BASELINE LOCK MODAL
         ========================================================================= */}
      {ecoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Lock className="size-5 text-emerald-600" />
              <div>
                <h3 className="text-base font-bold text-foreground">Promote Tentative BOM to Released Baseline (ECO)</h3>
                <p className="text-xs text-muted-foreground">
                  Engineering Change Order approval gate (IATF 16949 §8.3 & ISO 9001 §7.5)
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs font-sans">
              <div>
                <label className="font-semibold text-foreground">ECO Reference Number</label>
                <input
                  type="text"
                  value={ecoNumber}
                  onChange={(e) => setEcoNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 font-mono text-xs font-bold text-foreground"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground">Engineering Change Rationale & Baseline Commitment</label>
                <textarea
                  rows={3}
                  value={ecoRationale}
                  onChange={(e) => setEcoRationale(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-foreground"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground">Department Lead Sign-Off Authority</label>
                <input
                  type="text"
                  value={ecoSignoff}
                  onChange={(e) => setEcoSignoff(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs font-bold text-foreground"
                />
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-300">
                <strong>Governance Rule:</strong> Once released, this BOM revision becomes formally locked. All downstream SMT production line setups, purchasing purchase orders, and client PPAP Level 3 deliverables will be bound to this immutable baseline. Subsequent changes require an authorized revision bump.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setEcoModalOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handlePromoteToReleased}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <Check className="size-4" />
                <span>Confirm & Lock Baseline</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

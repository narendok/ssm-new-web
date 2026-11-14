import { ResponsiveFilterBar, CompactFilterSelect } from "@/components/ResponsiveFilterBar";
import React, { useMemo, useState } from "react";
import {
  Boxes,
  Package,
  Cable,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Wrench,
  Cpu,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  FileText,
  Tag,
  History,
  Search,
  Filter,
  Plus,
  Minus,
  UserPlus,
  Eye,
  Download,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Barcode,
  Truck,
  CheckSquare,
  Lock,
  DollarSign,
  Zap,
  Ruler,
  ShoppingCart,
  Loader2,
  TrendingUp,
  Check,
  Key,
  ArrowLeft,
  FileSpreadsheet,
  Calendar,
} from "lucide-react";
import {
  lookupMouserPart,
  getMouserApiKey,
  setMouserApiKey,
  type MouserComponentResult,
  type PriceBreak,
} from "@/lib/mouser-service";
import type {
  SharedInventoryAssignment,
  SharedInventoryEventInput,
  SharedInventoryMovement,
  SharedInventoryPartMaster,
} from "@/lib/shared-inventory.schema";


// =============================================================================
// 1. CONTROLLED TAXONOMY & DATA CONTRACTS
// =============================================================================

export type InventoryCategory =
  | "Electronics"
  | "Connectors"
  | "Wire and Cable"
  | "Wire Harnesses"
  | "Mechanical Parts"
  | "Enclosures"
  | "Firmware Tools"
  | "Production Tools"
  | "Packaging & Consumables"
  // Legacy / backward-compatible category aliases
  | "Hardware / PCB"
  | "Mechanical"
  | "Firmware / Software"
  | "Test & Calibration"
  | "Production Consumables"
  | "Packaging & Logistics";

export type CrossTag = "Mechanical" | "Electrical" | "Automotive" | "Consumable" | "Safety Critical";

export type InventoryItem = {
  id: string;
  partNumber: string;
  description: string;
  category: InventoryCategory;
  subcategory?: string | undefined;
  crossTags?: CrossTag[] | undefined;
  manufacturer?: string | undefined;
  packageCase?: string | undefined;
  specifications?: Record<string, string> | undefined;
  location: string;
  bin: string;
  onHand: number;
  released?: number | undefined;      // Passed IQC, authorized for project allocation
  held?: number | undefined;          // Under incoming inspection / quarantine (BLOCKED from issue)
  allocated: number;     // Currently allocated to project team members
  reorderPoint: number;
  unit: string;
  linkedProjects?: string[] | undefined;
  substitutes?: string[] | undefined;
  compatibleAssetIds?: string[] | undefined;
  updatedAt: string;
  isDemo?: boolean | undefined;

  // Mouser Intelligence & Commercial Specifications (PUR Focus)
  mouserPartNumber?: string | undefined;
  mouserUrl?: string | undefined;
  datasheetUrl?: string | undefined;
  supplier?: string | undefined;
  tentativeUnitCostUsd?: number | undefined;
  tentativeUnitCostInr?: number | undefined;
  priceBreaks?: PriceBreak[] | undefined;
  leadTimeWeeks?: number | undefined;
  mouserStock?: number | undefined;
  rohsStatus?: string | undefined;

  // Electrical & Technical Specifications (EHW Focus)
  voltageRating?: string | undefined;
  currentRating?: string | undefined;
  frequencyClock?: string | undefined;
  operatingTempRange?: string | undefined;
  automotiveQualified?: boolean | undefined;
  automotiveStandard?: string | undefined;

  // Mechanical & Physical Specifications (MECH Focus)
  dimensionsMm?: string | undefined;
  weightGrams?: number | undefined;
  ipRating?: string | undefined;
  wireGauge?: string | undefined;
  matingForce?: string | undefined;
};

export type InventoryMovement = {
  id: string;
  inventoryItemId: string;
  partNumber?: string;
  change: number;
  reason: "Receipt" | "Issue" | "Return" | "Adjustment" | "QuarantineHold" | "QualityRelease";
  lotNumber?: string;
  at: string;
  actor: string;
  note: string;
  requestKey?: string;
};

export type InventoryAssignment = {
  id: string;
  inventoryItemId: string;
  partNumber?: string;
  assignee: string;
  department: "EHW" | "ESW" | "MECH" | "QA" | "PUR" | "EMF" | "TST";
  project: string;
  quantity: number;
  assignedAt: string;
  issuedBy?: string;
  status: "Active" | "Returned" | "Consumed";
  note: string;
};

export type GoodsReceivedNote = {
  id: string;
  grnNumber: string;
  poNumber: string;
  supplier: string;
  invoiceRef: string;
  receivedDate: string;
  inventoryItemId: string;
  partNumber: string;
  lotNumber: string;
  dateCode: string;
  quantityReceived: number;
  quantityAccepted: number;
  quantityHeld: number;
  inspectionStatus: "Pending IQC" | "Accepted & Released" | "Rejected";
  inspectionReportId?: string;
  location: string;
  bin: string;
  receivedBy: string;
  dispositionNote?: string;
};

export type AssetClass =
  | "Production Machinery"
  | "Mechanical Equipment"
  | "Testing & Calibration Jigs"
  | "Tools & Instruments"
  | "Office & IT Assets";

export type AssetRecord = {
  id: string;
  assetTag: string;
  name: string;
  assetClass: AssetClass;
  subclass: string;
  serialNumber: string;
  facilityLocation: string;
  custodian: string;
  department: string;
  calibrationDate: string;
  nextCalibrationDue: string;
  status: "In Service" | "Due for Calibration" | "Maintenance" | "Idle";
  compatiblePartNumbers: string[];
  lastMaintenance: string;
  handoverHistory?: Array<{ date: string; from: string; to: string; note: string }>;
};

// =============================================================================
// 2. ACTIVE PROJECT TEAM ROSTERS (SERVER-SCOPED GOVERNANCE)
// =============================================================================

export const projectTeamRoster: Record<
  string,
  Array<{ name: string; department: InventoryAssignment["department"]; role: string; email: string }>
> = {
  "HLPL-AI4T-01": [
    { name: "Avery Vale", department: "EHW", role: "Hardware Lead", email: "avery.vale@Demo.com" },
    { name: "Devon Lane", department: "ESW", role: "Firmware Lead", email: "devon.lane@Demo.com" },
    { name: "Samira Holt", department: "MECH", role: "Mechanical Lead", email: "samira.holt@Demo.com" },
    { name: "Casey Rowan", department: "EMF", role: "SMT Production Lead", email: "casey.rowan@Demo.com" },
    { name: "Jordan Blake", department: "QA", role: "Quality Assurance Lead", email: "jordan.blake@Demo.com" },
    { name: "Mina Cross", department: "EMF", role: "EOL Testing Lead", email: "mina.cross@Demo.com" },
  ],
  "HLPL-SLCT-01": [
    { name: "Avery Vale", department: "EHW", role: "Hardware Lead", email: "avery.vale@Demo.com" },
    { name: "Samira Holt", department: "MECH", role: "Mechanical Lead", email: "samira.holt@Demo.com" },
    { name: "Morgan Reed", department: "PUR", role: "SCM Procurement Lead", email: "morgan.reed@Demo.com" },
    { name: "Jordan Blake", department: "QA", role: "Quality Assurance Lead", email: "jordan.blake@Demo.com" },
  ],
  "HLPL-XLINK-03": [
    { name: "Devon Lane", department: "ESW", role: "Dual-CAN Firmware Lead", email: "devon.lane@Demo.com" },
    { name: "Casey Rowan", department: "EMF", role: "Production Lead", email: "casey.rowan@Demo.com" },
    { name: "Mina Cross", department: "EMF", role: "EOL Testing Lead", email: "mina.cross@Demo.com" },
    { name: "Kai Morgan", department: "EHW", role: "Service & IT Infrastructure", email: "kai.morgan@Demo.com" },
  ],
};

// =============================================================================
// 3. INITIAL SEEDS (STANDARDS-COMPLIANT PARTS, HARNESSES & ASSETS)
// =============================================================================

const initialHarnessAndComponentSeeds: InventoryItem[] = [
  {
    id: "inv-stm32",
    partNumber: "STM32G0B1VCT6",
    description: "Main Host MCU, ARM Cortex-M0+ 64MHz, 512KB Flash, 144KB RAM, Dual CAN-FD",
    category: "Electronics",
    subcategory: "Microcontrollers & MCUs",
    crossTags: ["Electrical", "Automotive"],
    manufacturer: "STMicroelectronics",
    packageCase: "LQFP-100 (14x14mm)",
    specifications: {
      "Core": "ARM 32-bit Cortex-M0+ CPU, 64 MHz max",
      "Memory": "512 KB Flash, 144 KB SRAM",
      "CAN Controller": "2x CAN-FD with ISO 11898-1:2015 support",
      "Operating Temp": "-40°C to +125°C automotive Grade 1",
      "Operating Voltage": "2.0V to 3.6V (3.3V nominal)",
    },
    location: "Greater Noida SMT Plant 2",
    bin: "E-02-14",
    onHand: 18540,
    released: 18000,
    held: 540,
    allocated: 2500,
    reorderPoint: 8000,
    unit: "pcs",
    linkedProjects: ["HLPL-AI4T-01", "HLPL-SLCT-01"],
    substitutes: ["STM32G0B1VET6", "GD32F303VCT6"],
    compatibleAssetIds: ["ast-yamaha-ys12"],
    updatedAt: "2026-10-17 14:00",
    mouserPartNumber: "511-STM32G0B1VCT6",
    mouserUrl: "https://www.mouser.in/c/?q=STM32G0B1VCT6",
    datasheetUrl: "https://www.st.com/resource/en/datasheet/stm32g0b1vc.pdf",
    supplier: "Mouser Electronics",
    tentativeUnitCostUsd: 5.42,
    tentativeUnitCostInr: 452.57,
    priceBreaks: [
      { qty: 1, unitPriceUsd: 7.20, unitPriceInr: 601.20 },
      { qty: 100, unitPriceUsd: 6.10, unitPriceInr: 509.35 },
      { qty: 1000, unitPriceUsd: 5.42, unitPriceInr: 452.57 },
      { qty: 10000, unitPriceUsd: 4.85, unitPriceInr: 404.98 },
    ],
    leadTimeWeeks: 8,
    mouserStock: 18500,
    rohsStatus: "RoHS Compliant / Lead Free",
    voltageRating: "2.0V - 3.6V (3.3V nom)",
    currentRating: "45mA Active / 1.8µA Standby",
    frequencyClock: "64 MHz",
    operatingTempRange: "-40°C to +125°C",
    automotiveQualified: true,
    automotiveStandard: "AEC-Q100 Grade 1",
    dimensionsMm: "14.0 × 14.0 × 1.4 mm",
    weightGrams: 0.85,
  },
  {
    id: "inv-eg915",
    partNumber: "EG915N-EU",
    description: "LTE Cat-1 bis Cellular Wireless Modem + Embedded Multi-Constellation GNSS",
    category: "Electronics",
    subcategory: "Wireless Telematics & Modems",
    crossTags: ["Electrical", "Automotive"],
    manufacturer: "Quectel Wireless Solutions",
    packageCase: "126-Pin LGA (24x26mm)",
    specifications: {
      "Cellular Bands": "LTE-FDD: B1/B3/B5/B7/B8/B20/B28",
      "Data Rate": "Max 10 Mbps (DL) / 5 Mbps (UL)",
      "GNSS Engine": "GPS / GLONASS / BeiDou / Galileo / QZSS",
      "Supply Voltage": "3.3V to 4.3V (3.8V typical)",
      "Antenna": "U.FL coaxial / SMT pad interface",
    },
    location: "Greater Noida SMT Plant 2",
    bin: "E-05-03",
    onHand: 7200,
    released: 6900,
    held: 300,
    allocated: 2500,
    reorderPoint: 5000,
    unit: "pcs",
    linkedProjects: ["HLPL-AI4T-01"],
    substitutes: ["SIMCOM-A7672S", "MEIG-SLM156"],
    compatibleAssetIds: ["ast-yamaha-ys12"],
    updatedAt: "2026-10-17 14:15",
    mouserPartNumber: "967-EG915NEUAA-N05-S",
    mouserUrl: "https://www.mouser.in/c/?q=EG915N-EU",
    datasheetUrl: "https://www.quectel.com/product/lte-eg915n-eu",
    supplier: "Mouser Electronics",
    tentativeUnitCostUsd: 12.80,
    tentativeUnitCostInr: 1068.80,
    priceBreaks: [
      { qty: 1, unitPriceUsd: 16.50, unitPriceInr: 1377.75 },
      { qty: 100, unitPriceUsd: 14.20, unitPriceInr: 1185.70 },
      { qty: 1000, unitPriceUsd: 12.80, unitPriceInr: 1068.80 },
      { qty: 10000, unitPriceUsd: 11.40, unitPriceInr: 951.90 },
    ],
    leadTimeWeeks: 14,
    mouserStock: 8400,
    rohsStatus: "RoHS Compliant",
    voltageRating: "3.3V - 4.3V (3.8V nom)",
    currentRating: "600mA Transmit / 2.1mA Idle",
    operatingTempRange: "-40°C to +85°C",
    automotiveQualified: true,
    automotiveStandard: "AIS-140 / TAC Certified",
    dimensionsMm: "24.0 × 26.0 × 2.4 mm",
    weightGrams: 2.6,
  },
  {
    id: "inv-lmr14050",
    partNumber: "LMR14050SDDAR",
    description: "40V 5A Automotive Step-Down DC-DC Buck Regulator with Eco-mode",
    category: "Electronics",
    subcategory: "Automotive Power Regulators",
    crossTags: ["Electrical", "Automotive"],
    manufacturer: "Texas Instruments",
    packageCase: "HSOIC-8 (PowerPAD)",
    specifications: {
      "Input Voltage": "4V to 40V operating (transients to 60V)",
      "Output Current": "Up to 5A continuous",
      "Switching Freq": "200 kHz to 2.5 MHz adjustable",
      "Quiescent Current": "40 µA in standby Eco-mode",
    },
    location: "Greater Noida SMT Plant 2",
    bin: "E-03-09",
    onHand: 14200,
    released: 14200,
    held: 0,
    allocated: 3500,
    reorderPoint: 4000,
    unit: "pcs",
    linkedProjects: ["HLPL-AI4T-01", "HLPL-SLCT-01", "HLPL-XLINK-03"],
    substitutes: ["TPS54540DDAR", "LMR33630ARNXR"],
    compatibleAssetIds: ["ast-yamaha-ys12", "ast-emtest-ucs500"],
    updatedAt: "2026-10-17 14:20",
    mouserPartNumber: "595-LMR14050SDDAR",
    mouserUrl: "https://www.mouser.in/c/?q=LMR14050SDDAR",
    datasheetUrl: "https://www.ti.com/lit/ds/symlink/lmr14050-q1.pdf",
    supplier: "Mouser Electronics",
    tentativeUnitCostUsd: 2.15,
    tentativeUnitCostInr: 179.53,
    priceBreaks: [
      { qty: 1, unitPriceUsd: 3.20, unitPriceInr: 267.20 },
      { qty: 100, unitPriceUsd: 2.50, unitPriceInr: 208.75 },
      { qty: 1000, unitPriceUsd: 2.15, unitPriceInr: 179.53 },
      { qty: 10000, unitPriceUsd: 1.82, unitPriceInr: 151.97 },
    ],
    leadTimeWeeks: 6,
    mouserStock: 22400,
    rohsStatus: "RoHS Compliant",
    voltageRating: "4V - 40V Vin (60V transient)",
    currentRating: "5.0A Output / 40µA Quiescent",
    operatingTempRange: "-40°C to +125°C",
    automotiveQualified: true,
    automotiveStandard: "AEC-Q100 Grade 1",
    dimensionsMm: "4.9 × 3.9 × 1.7 mm",
    weightGrams: 0.18,
  },
  {
    id: "inv-sm5s24a",
    partNumber: "SM5S24A-E3/2D",
    description: "PAR Transient Voltage Suppressor (TVS) Diode 3600W 24V for ISO 7637-2 Load Dump",
    category: "Electronics",
    subcategory: "Protection & TVS Diodes",
    crossTags: ["Electrical", "Automotive", "Safety Critical"],
    manufacturer: "Vishay Intertechnology",
    packageCase: "DO-218AB (Surface Mount)",
    specifications: {
      "Standoff Voltage": "24.0 V",
      "Breakdown Voltage": "26.7 V to 29.5 V",
      "Clamping Voltage": "38.9 V max @ 92.5 A surge",
      "Peak Pulse Power": "3600 W (10/1000 µs), 4600 W (10/10000 µs load dump)",
    },
    location: "Greater Noida SMT Plant 2",
    bin: "E-01-02",
    onHand: 9500,
    released: 9500,
    held: 0,
    allocated: 2500,
    reorderPoint: 3000,
    unit: "pcs",
    linkedProjects: ["HLPL-AI4T-01", "HLPL-SLCT-01", "HLPL-XLINK-03"],
    substitutes: ["SM6S24A-E3/2D", "LTKAK6-024C"],
    compatibleAssetIds: ["ast-yamaha-ys12", "ast-emtest-ucs500"],
    updatedAt: "2026-10-17 14:25",
    mouserPartNumber: "625-SM5S24A-E3/2D",
    mouserUrl: "https://www.mouser.in/c/?q=SM5S24A-E3%2F2D",
    datasheetUrl: "https://www.vishay.com/docs/88380/sm5s.pdf",
    supplier: "Mouser Electronics",
    tentativeUnitCostUsd: 1.65,
    tentativeUnitCostInr: 137.78,
    priceBreaks: [
      { qty: 1, unitPriceUsd: 2.45, unitPriceInr: 204.58 },
      { qty: 100, unitPriceUsd: 1.95, unitPriceInr: 162.83 },
      { qty: 1000, unitPriceUsd: 1.65, unitPriceInr: 137.78 },
      { qty: 10000, unitPriceUsd: 1.35, unitPriceInr: 112.73 },
    ],
    leadTimeWeeks: 5,
    mouserStock: 31000,
    rohsStatus: "RoHS Compliant",
    voltageRating: "24V Standoff / 38.9V Clamping",
    currentRating: "3600W Peak / 92.5A Surge",
    operatingTempRange: "-55°C to +175°C",
    automotiveQualified: true,
    automotiveStandard: "AEC-Q101 & ISO 16750-2 Load Dump 5b",
    dimensionsMm: "10.0 × 8.5 × 4.8 mm",
    weightGrams: 2.8,
  },
  {
    id: "inv-tcan",
    partNumber: "TCAN1042VDRQ1",
    description: "Automotive High-Speed Fault-Tolerant CAN-FD Transceiver with Standby Mode",
    category: "Electronics",
    subcategory: "Automotive Transceivers & Interface",
    crossTags: ["Electrical", "Automotive"],
    manufacturer: "Texas Instruments",
    packageCase: "SOIC-8 (Narrow 3.9mm)",
    specifications: {
      "Data Rate": "Up to 5 Mbps in CAN-FD mode",
      "Bus Fault Protection": "±58 V bus fault protection",
      "ESD Rating": "±16 kV IEC 61000-4-2 ESD",
      "Logic Level": "1.7V to 5.5V flexible VIO pin",
    },
    location: "Greater Noida SMT Plant 2",
    bin: "P-01-22",
    onHand: 38100,
    released: 38100,
    held: 0,
    allocated: 5000,
    reorderPoint: 12000,
    unit: "pcs",
    linkedProjects: ["HLPL-AI4T-01", "HLPL-XLINK-03"],
    substitutes: ["MCP2562FDT-E/SN", "TJA1051T/3"],
    compatibleAssetIds: ["ast-yamaha-ys12", "ast-emtest-ucs500"],
    updatedAt: "2026-10-17 14:30",
    mouserPartNumber: "595-TCAN1042VDRQ1",
    mouserUrl: "https://www.mouser.in/c/?q=TCAN1042VDRQ1",
    datasheetUrl: "https://www.ti.com/lit/ds/symlink/tcan1042-q1.pdf",
    supplier: "Mouser Electronics",
    tentativeUnitCostUsd: 0.92,
    tentativeUnitCostInr: 76.82,
    priceBreaks: [
      { qty: 1, unitPriceUsd: 1.45, unitPriceInr: 121.08 },
      { qty: 100, unitPriceUsd: 1.15, unitPriceInr: 96.03 },
      { qty: 1000, unitPriceUsd: 0.92, unitPriceInr: 76.82 },
      { qty: 10000, unitPriceUsd: 0.78, unitPriceInr: 65.13 },
    ],
    leadTimeWeeks: 4,
    mouserStock: 45000,
    rohsStatus: "RoHS Compliant",
    voltageRating: "4.5V - 5.5V Vcc, 1.7V - 5.5V Vio",
    currentRating: "70mA Dominant / 1.5µA Standby",
    operatingTempRange: "-55°C to +125°C",
    automotiveQualified: true,
    automotiveStandard: "AEC-Q100 Grade 1 & ISO 11898-2:2016",
    dimensionsMm: "4.9 × 3.9 × 1.5 mm",
    weightGrams: 0.15,
  },
  {
    id: "harn-obd2-16p",
    partNumber: "HLPL-HARN-OBD2-16P",
    description: "SAE J1962 16-Pin Pass-Through OBD-II Automotive Wire Harness Assembly",
    category: "Wire Harnesses",
    subcategory: "Vehicle Interface Harness",
    crossTags: ["Mechanical", "Electrical", "Automotive"],
    manufacturer: "XYZ Pvt Ltd Cable Systems / Delphi Terminals",
    packageCase: "Molded Y-Cable Harness",
    specifications: {
      "Wire Type": "FLRY-B 0.50mm² thin-wall heat-resistant automotive wire (ISO 6722 Class B)",
      "Connector A": "SAE J1962 Male Plug 16-Pin with secondary lock wedge",
      "Connector B": "Molex MX150 Sealed 16-Pin Female Socket",
      "Current Rating": "5A continuous / 10A peak",
      "Protection": "Integrated 3A fast-acting mini blade fuse on Battery Pin 16",
      "Temp Range": "-40°C to +105°C continuous",
    },
    location: "Greater Noida SMT Plant 2",
    bin: "WH-01-A",
    onHand: 1850,
    released: 1800,
    held: 50,
    allocated: 650,
    reorderPoint: 500,
    unit: "pcs",
    linkedProjects: ["HLPL-SLCT-01", "HLPL-XLINK-03"],
    substitutes: ["HLPL-HARN-OBD2-LGT-01", "DELPHI-J1962-STD-16"],
    compatibleAssetIds: ["ast-komax-255", "ast-jig-eol-01"],
    updatedAt: "2026-10-17 14:30",
    mouserPartNumber: "MSR-J1962-16P",
    mouserUrl: "https://www.mouser.in/c/?q=OBD+J1962",
    datasheetUrl: "https://www.sae.org/standards/content/j1962_201607/",
    supplier: "XYZ Pvt Ltd Cable Systems / Mouser Terminals",
    tentativeUnitCostUsd: 4.90,
    tentativeUnitCostInr: 409.15,
    priceBreaks: [
      { qty: 1, unitPriceUsd: 7.50, unitPriceInr: 626.25 },
      { qty: 100, unitPriceUsd: 5.80, unitPriceInr: 484.30 },
      { qty: 1000, unitPriceUsd: 4.90, unitPriceInr: 409.15 },
      { qty: 10000, unitPriceUsd: 4.10, unitPriceInr: 342.35 },
    ],
    leadTimeWeeks: 4,
    mouserStock: 1850,
    rohsStatus: "RoHS Compliant",
    voltageRating: "12V / 24V Commercial Vehicle Bus",
    currentRating: "5A Continuous / 10A Peak",
    operatingTempRange: "-40°C to +105°C",
    automotiveQualified: true,
    automotiveStandard: "ISO 6722 / SAE J1962 / USCAR-21",
    dimensionsMm: "350mm length × 16-Pin standard envelope",
    weightGrams: 85.0,
    wireGauge: "FLRY-B 0.50mm² thin-wall copper",
    matingForce: "80N retention with secondary wedge lock",
  },
  {
    id: "harn-mx150-14p",
    partNumber: "HLPL-HARN-MX150-14P",
    description: "IP67 Sealed Commercial Vehicle Telematics Harness with Dual CAN & SOS",
    category: "Wire Harnesses",
    subcategory: "Sealed Heavy Duty Harness",
    crossTags: ["Mechanical", "Electrical", "Automotive", "Safety Critical"],
    manufacturer: "Molex Automotive / XYZ Pvt Ltd Assembly Line",
    packageCase: "IP67 Corrugated Nylon Loom",
    specifications: {
      "Wire Type": "TXL Automotive Cross-Linked Polyethylene 18 & 20 AWG (SAE J1128)",
      "Connector A": "Molex MX150 Sealed 14-Pin Plug (Part #33472-1401)",
      "Connector B": "Pigtail with heat-shrink tinned leads & SOS panic button terminal",
      "Sealing Rating": "IP67 (ISO 20653 water immersion & dust)",
      "Shielding": "100% braided foil shield on CAN_H / CAN_L twisted pair",
      "Temp Range": "-40°C to +125°C automotive under-hood certified",
    },
    location: "Greater Noida SMT Plant 2",
    bin: "WH-02-B",
    onHand: 3400,
    released: 3400,
    held: 0,
    allocated: 1200,
    reorderPoint: 800,
    unit: "pcs",
    linkedProjects: ["HLPL-AI4T-01"],
    substitutes: ["TE-DEUTSCH-MX14-SEAL"],
    compatibleAssetIds: ["ast-komax-255", "ast-crimp-press-02"],
    updatedAt: "2026-10-17 15:10",
    mouserPartNumber: "538-33472-1401",
    mouserUrl: "https://www.mouser.in/c/?q=33472-1401",
    datasheetUrl: "https://www.molex.com/pdm_docs/sd/334721401_sd.pdf",
    supplier: "Molex Automotive / Mouser",
    tentativeUnitCostUsd: 6.20,
    tentativeUnitCostInr: 517.70,
    priceBreaks: [
      { qty: 1, unitPriceUsd: 9.00, unitPriceInr: 751.50 },
      { qty: 100, unitPriceUsd: 7.20, unitPriceInr: 601.20 },
      { qty: 1000, unitPriceUsd: 6.20, unitPriceInr: 517.70 },
      { qty: 10000, unitPriceUsd: 5.30, unitPriceInr: 442.55 },
    ],
    leadTimeWeeks: 4,
    mouserStock: 4200,
    rohsStatus: "RoHS Compliant",
    voltageRating: "12V / 24V / 48V DC",
    currentRating: "14A continuous per circuit",
    operatingTempRange: "-40°C to +125°C",
    automotiveQualified: true,
    automotiveStandard: "IP67 (ISO 20653) / USCAR-2 Class III",
    dimensionsMm: "550mm harness length · 14-Pin sealed",
    weightGrams: 110.0,
    ipRating: "IP67",
    wireGauge: "TXL Cross-Linked Polyethylene 18 & 20 AWG",
    matingForce: "75N latch engagement",
  },
  {
    id: "harn-dt04-12p",
    partNumber: "HLPL-HARN-DT04-12P",
    description: "Heavy Commercial Vehicle Deutsch DT04 12-Pin J1939 Telematics Harness",
    category: "Wire Harnesses",
    subcategory: "Industrial & Heavy CV Harness",
    crossTags: ["Mechanical", "Electrical", "Automotive"],
    manufacturer: "TE Connectivity Deutsch / HLPL Wire Division",
    packageCase: "High-Abrasion Braided Loom",
    specifications: {
      "Wire Type": "FLRY-B 0.75mm² Multi-strand copper wire",
      "Connector A": "Deutsch DT04-12P-E004 with Wedgelock W12P",
      "Connector B": "Molex MX150 16-Pin Interface",
      "Vibration Class": "AIS-140 Annexure 8 3-Axis Random Vibration certified",
      "Temp Range": "-55°C to +125°C",
    },
    location: "Greater Noida SMT Plant 2",
    bin: "WH-03-C",
    onHand: 1200,
    released: 1100,
    held: 100,
    allocated: 400,
    reorderPoint: 350,
    unit: "pcs",
    linkedProjects: ["HLPL-XLINK-03"],
    substitutes: ["AMPHENOL-AT04-12P"],
    compatibleAssetIds: ["ast-komax-255", "ast-jig-eol-01"],
    updatedAt: "2026-10-17 16:00",
    mouserPartNumber: "571-DT04-12PA",
    mouserUrl: "https://www.mouser.in/c/?q=DT04-12PA",
    datasheetUrl: "https://www.te.com/commerce/DocumentDelivery/DDEController?DocNr=DT04-12P",
    supplier: "TE Connectivity / Mouser",
    tentativeUnitCostUsd: 7.80,
    tentativeUnitCostInr: 651.30,
    priceBreaks: [
      { qty: 1, unitPriceUsd: 11.20, unitPriceInr: 935.20 },
      { qty: 100, unitPriceUsd: 8.90, unitPriceInr: 743.15 },
      { qty: 1000, unitPriceUsd: 7.80, unitPriceInr: 651.30 },
      { qty: 10000, unitPriceUsd: 6.80, unitPriceInr: 567.80 },
    ],
    leadTimeWeeks: 5,
    mouserStock: 3200,
    rohsStatus: "RoHS Compliant",
    voltageRating: "250V AC/DC max",
    currentRating: "13A continuous per contact",
    operatingTempRange: "-55°C to +125°C",
    automotiveQualified: true,
    automotiveStandard: "SAE J2030 / USCAR-2 / IP68",
    dimensionsMm: "600mm heavy-duty braided loom",
    weightGrams: 145.0,
    ipRating: "IP68",
    wireGauge: "FLRY-B 0.75mm²",
    matingForce: "90N with wedgelock W12P",
  },
  {
    id: "wire-flryb-05",
    partNumber: "HLPL-WIRE-FLRYB-050",
    description: "Automotive Thin-Wall Primary Cable FLRY-B 0.50mm² Black (Reel 500m)",
    category: "Wire and Cable",
    subcategory: "Single Core Automotive Cable",
    crossTags: ["Electrical", "Automotive"],
    manufacturer: "Leoni Automotive Cables",
    packageCase: "500-Meter Spool",
    specifications: {
      "Conductor": "Bare copper strands (0.21mm x 16 strands)",
      "Insulation": "Heat resistant PVC (DIN 72551-5)",
      "Voltage Rating": "60V DC / 25V AC (Automotive bus)",
      "Flame Retardancy": "Self-extinguishing (ISO 6722)",
    },
    location: "Noida Tech Center",
    bin: "W-01-04",
    onHand: 42,
    released: 42,
    held: 0,
    allocated: 14,
    reorderPoint: 10,
    unit: "reels",
    linkedProjects: ["HLPL-AI4T-01", "HLPL-SLCT-01", "HLPL-XLINK-03"],
    compatibleAssetIds: ["ast-komax-255"],
    updatedAt: "2026-10-17 11:20",
    mouserPartNumber: "MSR-CBL-FLRYB-05",
    mouserUrl: "https://www.mouser.in/c/?q=FLRY-B",
    datasheetUrl: "https://www.leoni.com/en/products/automotive-cables/flry-b/",
    supplier: "Leoni / Mouser Distributor",
    tentativeUnitCostUsd: 48.00,
    tentativeUnitCostInr: 4008.00,
    priceBreaks: [
      { qty: 1, unitPriceUsd: 58.00, unitPriceInr: 4843.00 },
      { qty: 10, unitPriceUsd: 52.00, unitPriceInr: 4342.00 },
      { qty: 50, unitPriceUsd: 48.00, unitPriceInr: 4008.00 },
    ],
    leadTimeWeeks: 3,
    mouserStock: 250,
    rohsStatus: "RoHS Compliant",
    voltageRating: "60V DC / 25V AC",
    currentRating: "9A continuous in conduit",
    operatingTempRange: "-40°C to +105°C (3000h)",
    automotiveQualified: true,
    automotiveStandard: "ISO 6722 Class B / DIN 72551-5",
    dimensionsMm: "1.6mm outer diameter × 500m spool",
    weightGrams: 3600.0,
    wireGauge: "0.50mm² (20 AWG eq)",
  },
  {
    id: "conn-molex-16p",
    partNumber: "MX150-33472-1601",
    description: "Molex MX150 Mat-Sealed 16-Pin Dual Row Female Automotive Connector Housing",
    category: "Connectors",
    subcategory: "Sealed Wire-to-Board Connector",
    crossTags: ["Mechanical", "Electrical", "Automotive"],
    manufacturer: "Molex Automotive",
    packageCase: "16-Circuit Black Housing",
    specifications: {
      "Pitch": "3.50mm (.138\")",
      "Sealing Class": "IP67 / IP69K / USCAR-2 Class III",
      "Flammability": "UL94-V0 rated PBT",
      "Terminal Series": "Molex 33012 female tin/gold terminals",
    },
    location: "Greater Noida SMT Plant 2",
    bin: "C-04-12",
    onHand: 4300,
    released: 4000,
    held: 300,
    allocated: 1500,
    reorderPoint: 2000,
    unit: "pcs",
    linkedProjects: ["HLPL-AI4T-01", "HLPL-SLCT-01", "HLPL-XLINK-03"],
    substitutes: ["YAZAKI-7283-16P"],
    compatibleAssetIds: ["ast-crimp-press-02"],
    updatedAt: "2026-10-17 13:45",
    mouserPartNumber: "538-33472-1601",
    mouserUrl: "https://www.mouser.in/c/?q=33472-1601",
    datasheetUrl: "https://www.molex.com/pdm_docs/sd/334721601_sd.pdf",
    supplier: "Mouser Electronics",
    tentativeUnitCostUsd: 1.85,
    tentativeUnitCostInr: 154.48,
    priceBreaks: [
      { qty: 1, unitPriceUsd: 2.75, unitPriceInr: 229.63 },
      { qty: 100, unitPriceUsd: 2.10, unitPriceInr: 175.35 },
      { qty: 1000, unitPriceUsd: 1.85, unitPriceInr: 154.48 },
      { qty: 10000, unitPriceUsd: 1.52, unitPriceInr: 126.92 },
    ],
    leadTimeWeeks: 6,
    mouserStock: 14200,
    rohsStatus: "RoHS Compliant",
    voltageRating: "500V DC isolation",
    currentRating: "22A max per circuit",
    operatingTempRange: "-40°C to +125°C",
    automotiveQualified: true,
    automotiveStandard: "USCAR-2 Class III / IP67 / IP69K",
    dimensionsMm: "33.8 × 24.2 × 18.5 mm",
    weightGrams: 12.5,
    ipRating: "IP67 / IP69K",
    matingForce: "75N max with secondary wedge lock",
  },
  {
    id: "inv-enclosure",
    partNumber: "HLPL-ENC-PCABS-01",
    description: "Automotive IP67 Flame-Retardant Polycarbonate / ABS Telematics Enclosure",
    category: "Enclosures",
    subcategory: "Ingress Protected Telematics Casing",
    crossTags: ["Mechanical", "Automotive"],
    manufacturer: "XYZ Pvt Ltd Mechanical Tooling",
    packageCase: "Precision Molded Case with Gasket",
    specifications: {
      "Material": "Sabic Cycoloy PC/ABS automotive resin",
      "Ingress Protection": "IP67 (1m immersion for 30 min per ISO 20653)",
      "Flammability": "UL94-V0 @ 1.5mm wall thickness",
      "Impact Resistance": "IK08 mechanical drop shock certified",
    },
    location: "Greater Noida SMT Plant 2",
    bin: "M-01-04",
    onHand: 6200,
    released: 6200,
    held: 0,
    allocated: 2500,
    reorderPoint: 3500,
    unit: "pcs",
    linkedProjects: ["HLPL-AI4T-01", "HLPL-SLCT-01"],
    substitutes: ["HAMMOND-1554C-IP67"],
    compatibleAssetIds: ["ast-branson-2000"],
    updatedAt: "2026-10-17 14:00",
    mouserPartNumber: "MSR-ENC-PCABS-01",
    mouserUrl: "https://www.mouser.in/c/?q=IP67+Enclosure",
    datasheetUrl: "https://www.hammfg.com/electronics/small-enclosures/plastic/1554",
    supplier: "XYZ Pvt Ltd Mechanical Tooling",
    tentativeUnitCostUsd: 3.80,
    tentativeUnitCostInr: 317.30,
    priceBreaks: [
      { qty: 100, unitPriceUsd: 4.80, unitPriceInr: 400.80 },
      { qty: 1000, unitPriceUsd: 3.80, unitPriceInr: 317.30 },
      { qty: 10000, unitPriceUsd: 2.95, unitPriceInr: 246.33 },
    ],
    leadTimeWeeks: 8,
    mouserStock: 5000,
    rohsStatus: "RoHS Compliant / Halogen Free",
    voltageRating: "Dielectric isolation > 15 kV",
    currentRating: "Non-conductive exterior shell",
    operatingTempRange: "-40°C to +105°C",
    automotiveQualified: true,
    automotiveStandard: "ISO 20653 IP67 / UL94-V0",
    dimensionsMm: "115.0 × 85.0 × 32.0 mm",
    weightGrams: 95.0,
    ipRating: "IP67",
  },
];

const initialSerializedAssets: AssetRecord[] = [
  {
    id: "ast-yamaha-ys12",
    assetTag: "HLPL-AST-SMT-001",
    name: "Yamaha YS12 High-Speed Modular Pick-and-Place SMT Machine",
    assetClass: "Production Machinery",
    subclass: "SMT Surface Mount Line 2",
    serialNumber: "YMH-YS12-883901",
    facilityLocation: "Greater Noida SMT Plant 2 · Bay 2 (Cleanroom)",
    custodian: "Casey Rowan",
    department: "EMF",
    calibrationDate: "2026-08-15",
    nextCalibrationDue: "2027-02-15",
    status: "In Service",
    compatiblePartNumbers: [
      "STM32G0B1VCT6",
      "EG915N-EU",
      "TCAN1042VDRQ1",
      "LMR14050SDDAR",
      "SM5S24A-E3/2D",
      "CL31B106KAHNNNE",
    ],
    lastMaintenance: "2026-10-02 (Feeder calibration & nozzle alignment)",
    handoverHistory: [
      { date: "2026-06-01", from: "Operations Setup", to: "Casey Rowan", note: "SMT Line 2 commercial commissioning" },
    ],
  },
  {
    id: "ast-komax-255",
    assetTag: "HLPL-AST-MECH-002",
    name: "Komax Gamma 255 Automated Wire Cut, Strip & Terminal Crimp Station",
    assetClass: "Mechanical Equipment",
    subclass: "Automotive Harness Fabrication Station",
    serialNumber: "KMX-G255-77401",
    facilityLocation: "Greater Noida SMT Plant 2 · Harness Fabrication Cell 1",
    custodian: "Samira Holt",
    department: "MECH",
    calibrationDate: "2026-09-10",
    nextCalibrationDue: "2027-03-10",
    status: "In Service",
    compatiblePartNumbers: [
      "HLPL-HARN-OBD2-16P",
      "HLPL-HARN-MX150-14P",
      "HLPL-HARN-DT04-12P",
      "HLPL-WIRE-FLRYB-050",
      "MX150-33472-1601",
    ],
    lastMaintenance: "2026-10-12 (Blade sharpening & crimp height micrometer calibration)",
    handoverHistory: [
      { date: "2026-07-15", from: "Machinery Stores", to: "Samira Holt", note: "Dedicated to OEM wire harness assembly" },
    ],
  },
  {
    id: "ast-branson-2000",
    assetTag: "HLPL-AST-MECH-003",
    name: "Branson 2000X Ultrasonic Plastic Welder (IP67 Gasket Sealing)",
    assetClass: "Mechanical Equipment",
    subclass: "Enclosure Ultrasonic Assembly",
    serialNumber: "BRN-2000X-44910",
    facilityLocation: "Greater Noida SMT Plant 2 · Box-Build Cell 3",
    custodian: "Casey Rowan",
    department: "EMF",
    calibrationDate: "2026-07-20",
    nextCalibrationDue: "2027-01-20",
    status: "In Service",
    compatiblePartNumbers: ["HLPL-ENC-PCABS-01"],
    lastMaintenance: "2026-09-28 (Horn acoustic horn tuning & transducer inspection)",
  },
  {
    id: "ast-jig-eol-01",
    assetTag: "HLPL-AST-TST-004",
    name: "Automated EOL Telematics Functional Test Jig (100% PDI Rig)",
    assetClass: "Testing & Calibration Jigs",
    subclass: "End-of-Line Production Verification",
    serialNumber: "HLPL-JIG-EOL-AI4T-01",
    facilityLocation: "Greater Noida SMT Plant 2 · Final Quality & PDI Bay",
    custodian: "Mina Cross",
    department: "EMF",
    calibrationDate: "2026-10-01",
    nextCalibrationDue: "2026-11-01",
    status: "In Service",
    compatiblePartNumbers: [
      "HLPL-HARN-OBD2-16P",
      "HLPL-HARN-MX150-14P",
      "HLPL-HARN-DT04-12P",
      "HLPL-TST-CAN-FXT-01",
    ],
    lastMaintenance: "2026-10-15 (CAN bus loopback verification & voltage probe calibration)",
  },
  {
    id: "ast-emtest-ucs500",
    assetTag: "HLPL-AST-QA-005",
    name: "EM Test UCS 500N Automotive Electrical Transient Pulse Generator",
    assetClass: "Tools & Instruments",
    subclass: "ISO 7637-2 Compliance Generator",
    serialNumber: "EMT-UCS500N-33109",
    facilityLocation: "Noida Tech Center · QA Electrical Bench Rig",
    custodian: "Jordan Blake",
    department: "QA",
    calibrationDate: "2026-05-18",
    nextCalibrationDue: "2026-11-18",
    status: "In Service",
    compatiblePartNumbers: ["SM5S24A-E3/2D", "LMR14050SDDAR", "TCAN1042VDRQ1"],
    lastMaintenance: "2026-05-18 (NABL certified calibration by IDEMI)",
  },
  {
    id: "ast-dell-ws-01",
    assetTag: "HLPL-AST-IT-006",
    name: "Dell Precision 5820 Workstation (Xeon W-2245, 64GB ECC, RTX A4000)",
    assetClass: "Office & IT Assets",
    subclass: "ECAD / Hardware Simulation Workstation",
    serialNumber: "DELL-PR5820-99214",
    facilityLocation: "Noida Tech Center · Hardware Lab Desk 4",
    custodian: "Avery Vale",
    department: "SIT",
    calibrationDate: "2026-04-10",
    nextCalibrationDue: "2027-04-10",
    status: "In Service",
    compatiblePartNumbers: [],
    lastMaintenance: "2026-10-18 (Thermal paste repaste & BIOS v2.14.0 flashed)",
  },
  {
    id: "ast-cisco-sw-01",
    assetTag: "HLPL-AST-IT-007",
    name: "Cisco Catalyst 9300 48-Port PoE+ L3 Managed Core Switch",
    assetClass: "Office & IT Assets",
    subclass: "IT Networking Infrastructure",
    serialNumber: "CSCO-CAT9300-88102",
    facilityLocation: "Noida Tech Center · Server Room Rack A",
    custodian: "Sameer Khan",
    department: "SIT",
    calibrationDate: "2026-01-15",
    nextCalibrationDue: "2027-01-15",
    status: "In Service",
    compatiblePartNumbers: [],
    lastMaintenance: "2026-09-01 (Cisco IOS-XE 17.9.4a security patch applied)",
  },
  {
    id: "ast-ups-20kva",
    assetTag: "HLPL-AST-FAC-008",
    name: "Schneider Electric APC Symmetra PX 20kVA Facility UPS",
    assetClass: "Office & IT Assets",
    subclass: "Facility Infrastructure",
    serialNumber: "APC-SYMPX-44192",
    facilityLocation: "Greater Noida SMT Plant 2 · Electrical Utility Room",
    custodian: "Kunal Varma",
    department: "HROPS",
    calibrationDate: "2026-06-12",
    nextCalibrationDue: "2026-12-12",
    status: "In Service",
    compatiblePartNumbers: [],
    lastMaintenance: "2026-09-15 (Lead-acid battery bank impedance test passed)",
  },
  {
    id: "ast-conf-av-01",
    assetTag: "HLPL-AST-OFC-009",
    name: "Poly Studio G9 Plus Hybrid Teams & 4K Conference AV Rig",
    assetClass: "Office & IT Assets",
    subclass: "Office Equipment",
    serialNumber: "POLY-G9-77120",
    facilityLocation: "Noida Tech Center · Executive Boardroom",
    custodian: "Taylor Quinn",
    department: "HROPS",
    calibrationDate: "2026-05-01",
    nextCalibrationDue: "2027-05-01",
    status: "In Service",
    compatiblePartNumbers: [],
    lastMaintenance: "2026-08-20 (Firmware update & acoustic echo cancellation tuned)",
  },
];

const initialGRNRecords: GoodsReceivedNote[] = [
  {
    id: "grn-2026-0811",
    grnNumber: "GRN-2026-0811",
    poNumber: "PO-2026-AI4T-091",
    supplier: "Arrow Electronics India Pvt Ltd",
    invoiceRef: "INV-ARW-994012",
    receivedDate: "2026-10-15",
    inventoryItemId: "inv-stm32",
    partNumber: "STM32G0B1VCT6",
    lotNumber: "LOT-2026-W38-ST",
    dateCode: "2638",
    quantityReceived: 5000,
    quantityAccepted: 5000,
    quantityHeld: 0,
    inspectionStatus: "Accepted & Released",
    inspectionReportId: "HLPL-IQC-TR-0811",
    location: "Greater Noida SMT Plant 2",
    bin: "E-02-14",
    receivedBy: "Morgan Reed (PUR)",
    dispositionNote: "100% pin coplanarity and tape-and-reel seal inspected. Zero defects.",
  },
  {
    id: "grn-2026-0812",
    grnNumber: "GRN-2026-0812",
    poNumber: "PO-2026-AI4T-094",
    supplier: "Quectel Wireless Solutions",
    invoiceRef: "INV-QC-448102",
    receivedDate: "2026-10-16",
    inventoryItemId: "inv-eg915",
    partNumber: "EG915N-EU",
    lotNumber: "LOT-2026-W39-QC",
    dateCode: "2639",
    quantityReceived: 2000,
    quantityAccepted: 1700,
    quantityHeld: 300,
    inspectionStatus: "Pending IQC",
    inspectionReportId: "HLPL-IQC-TR-0812",
    location: "Greater Noida SMT Plant 2",
    bin: "QUARANTINE-IQC-01",
    receivedBy: "Morgan Reed (PUR)",
    dispositionNote: "300 pcs held under MSL 3 moisture barrier bag vacuum seal integrity audit.",
  },
  {
    id: "grn-2026-0813",
    grnNumber: "GRN-2026-0813",
    poNumber: "PO-2026-SLCT-102",
    supplier: "Molex India Automotive Division",
    invoiceRef: "INV-MLX-110294",
    receivedDate: "2026-10-17",
    inventoryItemId: "harn-obd2-16p",
    partNumber: "HLPL-HARN-OBD2-16P",
    lotNumber: "LOT-2026-W41-MLX",
    dateCode: "2641",
    quantityReceived: 500,
    quantityAccepted: 500,
    quantityHeld: 0,
    inspectionStatus: "Accepted & Released",
    inspectionReportId: "HLPL-IQC-TR-0813",
    location: "Greater Noida SMT Plant 2",
    bin: "WH-01-A",
    receivedBy: "Morgan Reed (PUR)",
    dispositionNote: "100% Hi-Pot continuity and pull-force test verified against USCAR-2 standards.",
  },
];

// Helper calculations
const getReleased = (item: InventoryItem) => item.released ?? (item.onHand - (item.held ?? 0));
const getHeld = (item: InventoryItem) => item.held ?? 0;
const getAvailable = (item: InventoryItem) => Math.max(0, getReleased(item) - item.allocated);

// =============================================================================
// 4. MAIN WORKSPACE COMPONENT
// =============================================================================

export type LiveInventoryWorkspaceProps = {
  items: InventoryItem[];
  movements: InventoryMovement[];
  assignments: InventoryAssignment[];
  allowedCategories: InventoryCategory[];
  readOnly?: boolean;
  activeDepartment?: "EHW" | "PUR" | "MECH" | "QA" | "ALL";
  isFullPage?: boolean;
  onBack?: () => void;
  sharedPartMasters?: SharedInventoryPartMaster[] | undefined;
  sharedPartCatalogState?: "loading" | "ready" | "error" | undefined;
  sharedInventoryProjects?: Array<{ id: string; reference: string; title: string }> | undefined;
  sharedInventoryRoles?: Array<{ id: string; name: string; departmentCode: string; hierarchyLevel: number }> | undefined;
  sharedInventoryReceiptOptions?: Array<{
    purchaseOrderId: string; purchaseOrderReference: string; supplierId: string;
    supplierReference: string; supplierName: string; projectId: string; projectReference: string;
    partId: string; partReference: string; orderedQuantity: number; receivedQuantity: number; remainingQuantity: number;
  }> | undefined;
  sharedInventoryAssignments?: SharedInventoryAssignment[] | undefined;
  sharedInventoryMovements?: SharedInventoryMovement[] | undefined;
  onSharedInventoryEvent?: ((input: SharedInventoryEventInput) => Promise<void>) | undefined;
  sharedInventoryActionPending?: boolean | undefined;
  sharedInventoryActionError?: string | undefined;
  onMove: (itemId: string, change: number, reason: InventoryMovement["reason"]) => void;
  onAssign: (
    itemId: string,
    assignee: string,
    department: InventoryAssignment["department"],
    project: string,
    quantity: number,
    note: string
  ) => void;
};

export function LiveInventoryWorkspace({
  items,
  movements,
  assignments,
  allowedCategories,
  readOnly = false,
  activeDepartment = "ALL",
  isFullPage = false,
  onBack,
  sharedPartMasters,
  sharedPartCatalogState,
  sharedInventoryProjects,
  sharedInventoryRoles,
  sharedInventoryReceiptOptions,
  sharedInventoryAssignments,
  sharedInventoryMovements,
  onSharedInventoryEvent,
  sharedInventoryActionPending = false,
  sharedInventoryActionError,
  onMove,
  onAssign,
}: LiveInventoryWorkspaceProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    "parts" | "harnesses" | "issuance" | "grn" | "assets" | "audit" | "shared-parts"
  >("parts");

  // Department-adaptive column preset
  const [columnPreset, setColumnPreset] = useState<"universal" | "ehw" | "pur" | "mech">(() => {
    if (activeDepartment === "EHW") return "ehw";
    if (activeDepartment === "PUR") return "pur";
    if (activeDepartment === "MECH") return "mech";
    return "pur"; // default to purchasing view
  });

  // Local state extensions (enrich with seeded harnesses and components)
  const [localItems, setLocalItems] = useState<InventoryItem[]>(() => {
    const seedMap = new Map(initialHarnessAndComponentSeeds.map((s) => [s.id, s]));
    const seedByPart = new Map(initialHarnessAndComponentSeeds.map((s) => [s.partNumber, s]));

    // Merge existing items with seeds to preserve any rich specs/Mouser info
    const merged = items.map((item) => {
      const seed = seedMap.get(item.id) || seedByPart.get(item.partNumber);
      if (seed) {
        return {
          ...seed,
          ...item,
          voltageRating: item.voltageRating ?? seed.voltageRating,
          currentRating: item.currentRating ?? seed.currentRating,
          frequencyClock: item.frequencyClock ?? seed.frequencyClock,
          operatingTempRange: item.operatingTempRange ?? seed.operatingTempRange,
          automotiveQualified: item.automotiveQualified ?? seed.automotiveQualified,
          automotiveStandard: item.automotiveStandard ?? seed.automotiveStandard,
          datasheetUrl: item.datasheetUrl ?? seed.datasheetUrl,
          mouserUrl: item.mouserUrl ?? seed.mouserUrl,
          mouserPartNumber: item.mouserPartNumber ?? seed.mouserPartNumber,
          supplier: item.supplier ?? seed.supplier,
          tentativeUnitCostUsd: item.tentativeUnitCostUsd ?? seed.tentativeUnitCostUsd,
          tentativeUnitCostInr: item.tentativeUnitCostInr ?? seed.tentativeUnitCostInr,
          priceBreaks: item.priceBreaks ?? seed.priceBreaks,
          leadTimeWeeks: item.leadTimeWeeks ?? seed.leadTimeWeeks,
          mouserStock: item.mouserStock ?? seed.mouserStock,
          rohsStatus: item.rohsStatus ?? seed.rohsStatus,
          dimensionsMm: item.dimensionsMm ?? seed.dimensionsMm,
          weightGrams: item.weightGrams ?? seed.weightGrams,
          ipRating: item.ipRating ?? seed.ipRating,
          wireGauge: item.wireGauge ?? seed.wireGauge,
          matingForce: item.matingForce ?? seed.matingForce,
        };
      }
      return item;
    });

    const existingIds = new Set(merged.map((i) => i.id));
    for (const seed of initialHarnessAndComponentSeeds) {
      if (!existingIds.has(seed.id)) {
        merged.push(seed);
      }
    }
    return merged;
  });

  const [grnList, setGrnList] = useState<GoodsReceivedNote[]>(initialGRNRecords);
  const [assetList, setAssetList] = useState<AssetRecord[]>(initialSerializedAssets);

  // Department-Scoped Assets calculation (Section 7 of handoff)
  const scopedAssets = useMemo(() => {
    const normDept = (activeDepartment || "").toUpperCase();
    if (normDept === "SIT") {
      return assetList.filter(
        (a) =>
          a.department === "SIT" ||
          a.assetClass === "Office & IT Assets" ||
          a.subclass.toLowerCase().includes("workstation") ||
          a.subclass.toLowerCase().includes("network")
      );
    }
    if (normDept === "HROPS" || normDept === "HR" || normDept === "OPS") {
      return assetList.filter(
        (a) =>
          a.department === "HROPS" ||
          a.subclass.toLowerCase().includes("facility") ||
          a.subclass.toLowerCase().includes("office")
      );
    }
    if (normDept === "EHW" || normDept === "MECH" || normDept === "EMF" || normDept === "QA" || normDept === "TST") {
      return assetList.filter((a) => a.department === normDept || a.department === "SHARED");
    }
    return assetList;
  }, [assetList, activeDepartment]);
  const [localMovements, setLocalMovements] = useState<InventoryMovement[]>(movements);
  const [localAssignments, setLocalAssignments] = useState<InventoryAssignment[]>(assignments);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [sharedPartSearch, setSharedPartSearch] = useState("");
  const [sharedPartCategory, setSharedPartCategory] = useState("All");
  const [sharedPartDepartment, setSharedPartDepartment] = useState("All");
  const [sharedAssignPartId, setSharedAssignPartId] = useState<string | null>(null);
  const [sharedAssignProjectId, setSharedAssignProjectId] = useState("");
  const [sharedAssignRoleId, setSharedAssignRoleId] = useState("");
  const [sharedAssignQuantity, setSharedAssignQuantity] = useState("1");
  const [sharedAssignNote, setSharedAssignNote] = useState("Project material allocation");
  const [sharedInventoryNotice, setSharedInventoryNotice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedCrossTag, setSelectedCrossTag] = useState<string>("All");
  const [selectedProject, setSelectedProject] = useState<string>("All");
  const [stockStateFilter, setStockStateFilter] = useState<string>("All");

  // Modal inspection states
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "ehw" | "pur" | "mech" | "trace">("overview");
  const [detailAsset, setDetailAsset] = useState<AssetRecord | null>(null);
  const [grnModalOpen, setGrnModalOpen] = useState(false);
  const [addPartModalOpen, setAddPartModalOpen] = useState(false);
  const [issueModalItem, setIssueModalItem] = useState<InventoryItem | null>(null);
  const [returnModalAssignment, setReturnModalAssignment] = useState<InventoryAssignment | null>(null);

  // IQC Disposition Gate state
  const [iqcModalGrn, setIqcModalGrn] = useState<GoodsReceivedNote | null>(null);
  const [iqcAcceptedQty, setIqcAcceptedQty] = useState<number>(0);
  const [iqcInspector, setIqcInspector] = useState<string>("Jordan Blake (QA Lead)");
  const [iqcReportRef, setIqcReportRef] = useState<string>("HLPL-IQC-2026-088");
  const [iqcNote, setIqcNote] = useState<string>("100% AOI optical inspection, pin coplanarity, and lot sample ESD check passed.");

  // Bulk Asset Import & Compatibility state
  const [bulkAssetModalOpen, setBulkAssetModalOpen] = useState(false);
  const [rawAssetCsvText, setRawAssetCsvText] = useState("");
  const [stagedBulkAssets, setStagedBulkAssets] = useState<Array<AssetRecord & { duplicate?: boolean }>>([]);
  const [compatModalAsset, setCompatModalAsset] = useState<AssetRecord | null>(null);

  // Issue modal fields
  const [issueProject, setIssueProject] = useState<string>("HLPL-AI4T-01");
  const [issueRecipient, setIssueRecipient] = useState<string>("");
  const [issueQuantity, setIssueQuantity] = useState<string>("1");
  const [issuePurpose, setIssuePurpose] = useState<string>("");
  const [issueError, setIssueError] = useState<string | null>(null);

  // Return modal fields
  const [returnQuantity, setReturnQuantity] = useState<string>("1");
  const [returnDisposition, setReturnDisposition] = useState<"Usable Stock" | "Quality Quarantine">("Usable Stock");
  const [returnNote, setReturnNote] = useState<string>("");

  // New GRN modal fields
  const [grnPartId, setGrnPartId] = useState<string>("");
  const [grnPoNumber, setGrnPoNumber] = useState<string>("PO-2026-AI4T-098");
  const [grnSupplier, setGrnSupplier] = useState<string>("Arrow Electronics India");
  const [grnInvoice, setGrnInvoice] = useState<string>("INV-2026-9041");
  const [grnLot, setGrnLot] = useState<string>("LOT-2026-W42-01");
  const [grnDateCode, setGrnDateCode] = useState<string>("2642");
  const [grnQtyReceived, setGrnQtyReceived] = useState<string>("1000");
  const [grnDisposition, setGrnDisposition] = useState<"Accepted & Released" | "Pending IQC">("Accepted & Released");
  const [grnLocation, setGrnLocation] = useState<string>("Greater Noida SMT Plant 2");
  const [grnBin, setGrnBin] = useState<string>("E-02-14");

  // Mouser Auto-Fetch & Auto-Fill state
  const [mouserSearchQuery, setMouserSearchQuery] = useState("");
  const [mouserLoading, setMouserLoading] = useState(false);
  const [mouserSuccessMessage, setMouserSuccessMessage] = useState<string | null>(null);
  const [mouserResultData, setMouserResultData] = useState<MouserComponentResult | null>(null);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [mouserApiKeyInput, setMouserApiKeyInput] = useState(() => getMouserApiKey());

  // New Part Registration modal fields
  const [newPartNum, setNewPartNum] = useState<string>("");
  const [newPartDesc, setNewPartDesc] = useState<string>("");
  const [newPartCat, setNewPartCat] = useState<InventoryCategory>("Electronics");
  const [newPartSubcat, setNewPartSubcat] = useState<string>("");
  const [newPartMfr, setNewPartMfr] = useState<string>("");
  const [newPartPackage, setNewPartPackage] = useState<string>("");
  const [newPartReorder, setNewPartReorder] = useState<string>("100");
  const [newPartUnit, setNewPartUnit] = useState<string>("pcs");
  const [newPartLoc, setNewPartLoc] = useState<string>("Greater Noida SMT Plant 2");
  const [newPartBin, setNewPartBin] = useState<string>("GEN-01-A");
  const [newPartProjects, setNewPartProjects] = useState<string>("HLPL-AI4T-01");

  // Department specific fields for new part
  const [newPartCostUsd, setNewPartCostUsd] = useState<number | undefined>();
  const [newPartCostInr, setNewPartCostInr] = useState<number | undefined>();
  const [newPartDatasheetUrl, setNewPartDatasheetUrl] = useState<string>("");
  const [newPartMouserUrl, setNewPartMouserUrl] = useState<string>("");
  const [newPartMouserPfx, setNewPartMouserPfx] = useState<string>("");
  const [newPartLeadWeeks, setNewPartLeadWeeks] = useState<number | undefined>();
  const [newPartSupplier, setNewPartSupplier] = useState<string>("Mouser Electronics");
  const [newPartVoltage, setNewPartVoltage] = useState<string>("");
  const [newPartCurrent, setNewPartCurrent] = useState<string>("");
  const [newPartAutoGraded, setNewPartAutoGraded] = useState<boolean>(false);
  const [newPartAutoStd, setNewPartAutoStd] = useState<string>("");
  const [newPartDimensions, setNewPartDimensions] = useState<string>("");
  const [newPartWeight, setNewPartWeight] = useState<number | undefined>();
  const [newPartIpRating, setNewPartIpRating] = useState<string>("");
  const [newPartWireGauge, setNewPartWireGauge] = useState<string>("");
  const [newPartMatingForce, setNewPartMatingForce] = useState<string>("");
  const [newPartPriceBreaks, setNewPartPriceBreaks] = useState<PriceBreak[] | undefined>();

  // Roster resolution for active project
  const eligibleRoster = useMemo(() => {
    return projectTeamRoster[issueProject] || [];
  }, [issueProject]);

  // Set default recipient when project changes
  React.useEffect(() => {
    if (eligibleRoster.length > 0 && eligibleRoster[0]?.name) {
      setIssueRecipient(eligibleRoster[0].name);
    }
  }, [eligibleRoster]);

  // Set default GRN part
  React.useEffect(() => {
    if (localItems.length > 0 && !grnPartId && localItems[0]?.id) {
      setGrnPartId(localItems[0].id);
    }
  }, [localItems, grnPartId]);

  // Unified Filter logic for Parts Register
  const filteredItems = useMemo(() => {
    return localItems.filter((item) => {
      const stock = getAvailable(item);
      const isLow = stock <= item.reorderPoint;
      const isHeld = getHeld(item) > 0;
      const isAssigned = localAssignments.some((a) => a.inventoryItemId === item.id && a.status === "Active");

      // Tab filter
      if (activeTab === "harnesses" && item.category !== "Wire Harnesses") {
        return false;
      }

      // Query filter
      const textToSearch = `${item.partNumber} ${item.description} ${item.manufacturer || ""} ${item.packageCase || ""} ${item.location} ${item.bin} ${item.linkedProjects?.join(" ") || ""}`.toLowerCase();
      if (searchQuery && !textToSearch.includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (selectedCategory !== "All" && item.category !== selectedCategory) {
        return false;
      }

      // Cross-tag filter
      if (selectedCrossTag !== "All") {
        if (!item.crossTags || !item.crossTags.includes(selectedCrossTag as CrossTag)) {
          return false;
        }
      }

      // Project filter
      if (selectedProject !== "All") {
        if (!item.linkedProjects || !item.linkedProjects.includes(selectedProject)) {
          return false;
        }
      }

      // Status filter
      if (stockStateFilter === "Available" && stock === 0) return false;
      if (stockStateFilter === "LowStock" && !isLow) return false;
      if (stockStateFilter === "Held" && !isHeld) return false;
      if (stockStateFilter === "Assigned" && !isAssigned) return false;

      return true;
    });
  }, [localItems, activeTab, searchQuery, selectedCategory, selectedCrossTag, selectedProject, stockStateFilter, localAssignments]);

  // Executive summary metrics
  const totalOnHand = useMemo(() => localItems.reduce((acc, i) => acc + i.onHand, 0), [localItems]);
  const totalReleased = useMemo(() => localItems.reduce((acc, i) => acc + getReleased(i), 0), [localItems]);
  const totalHeld = useMemo(() => localItems.reduce((acc, i) => acc + getHeld(i), 0), [localItems]);
  const totalAllocated = useMemo(() => localItems.reduce((acc, i) => acc + i.allocated, 0), [localItems]);
  const totalAvailable = useMemo(() => localItems.reduce((acc, i) => acc + getAvailable(i), 0), [localItems]);
  const lowStockCount = useMemo(() => localItems.filter((i) => getAvailable(i) <= i.reorderPoint).length, [localItems]);

  // =============================================================================
  // 5. TRANSACTION HANDLERS (MATERIAL ISSUE, GRN, RETURNS, PART REGISTRATION)
  // =============================================================================

  // Project-team validated issuance
  const handleExecuteIssue = () => {
    if (!issueModalItem) return;
    setIssueError(null);

    const qty = parseInt(issueQuantity, 10);
    const availableStock = getAvailable(issueModalItem);

    if (isNaN(qty) || qty < 1) {
      setIssueError("Please enter a valid numeric quantity greater than 0.");
      return;
    }

    if (qty > availableStock) {
      setIssueError(`Requested quantity (${qty}) exceeds released available stock (${availableStock} ${issueModalItem.unit}). Note: Held/Quarantine stock cannot be issued.`);
      return;
    }

    // Server-side project team validation
    const roster = projectTeamRoster[issueProject] || [];
    const member = roster.find((m) => m.name === issueRecipient);

    if (!member) {
      setIssueError(`Recipient "${issueRecipient}" is not an active team member of project "${issueProject}". Issuance blocked by governance rules.`);
      return;
    }

    // Deduct available, increment allocated
    const updatedLocal = localItems.map((entry) => {
      if (entry.id === issueModalItem.id) {
        return {
          ...entry,
          allocated: entry.allocated + qty,
          updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        };
      }
      return entry;
    });

    const newAssignment: InventoryAssignment = {
      id: `asg-${Date.now()}`,
      inventoryItemId: issueModalItem.id,
      partNumber: issueModalItem.partNumber,
      assignee: member.name,
      department: member.department,
      project: issueProject,
      quantity: qty,
      assignedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      issuedBy: "Morgan Reed (PUR)",
      status: "Active",
      note: issuePurpose || "Project Prototype Build Allocation",
    };

    const newMovement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      inventoryItemId: issueModalItem.id,
      partNumber: issueModalItem.partNumber,
      change: -qty,
      reason: "Issue",
      at: new Date().toISOString().replace("T", " ").substring(0, 16),
      actor: "Morgan Reed (PUR)",
      note: `Issued ${qty} ${issueModalItem.unit} to ${member.name} (${member.department}) for ${issueProject}`,
      requestKey: `REQ-${Date.now().toString().slice(-6)}`,
    };

    setLocalItems(updatedLocal);
    setLocalAssignments([newAssignment, ...localAssignments]);
    setLocalMovements([newMovement, ...localMovements]);

    // Forward to parent handler
    onAssign(issueModalItem.id, member.name, member.department, issueProject, qty, issuePurpose);

    setIssueModalItem(null);
    setIssueQuantity("1");
    setIssuePurpose("");
  };

  // Process Material Return
  const handleExecuteReturn = () => {
    if (!returnModalAssignment) return;
    const qty = parseInt(returnQuantity, 10);
    if (isNaN(qty) || qty < 1 || qty > returnModalAssignment.quantity) return;

    const targetItem = localItems.find((i) => i.id === returnModalAssignment.inventoryItemId);
    if (!targetItem) return;

    const isUsable = returnDisposition === "Usable Stock";

    const updatedLocal = localItems.map((entry) => {
      if (entry.id === targetItem.id) {
        return {
          ...entry,
          allocated: Math.max(0, entry.allocated - qty),
          released: isUsable ? (entry.released ?? entry.onHand) + qty : (entry.released ?? entry.onHand),
          held: !isUsable ? (entry.held ?? 0) + qty : (entry.held ?? 0),
          updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        };
      }
      return entry;
    });

    const updatedAssignments = localAssignments.map((a) => {
      if (a.id === returnModalAssignment.id) {
        const remaining = a.quantity - qty;
        return {
          ...a,
          quantity: remaining,
          status: (remaining === 0 ? "Returned" : "Active") as "Active" | "Returned",
        };
      }
      return a;
    });

    const newMovement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      inventoryItemId: targetItem.id,
      partNumber: targetItem.partNumber,
      change: qty,
      reason: "Return",
      at: new Date().toISOString().replace("T", " ").substring(0, 16),
      actor: "Morgan Reed (PUR)",
      note: `Returned ${qty} ${targetItem.unit} from ${returnModalAssignment.assignee} · Disposition: ${returnDisposition} (${returnNote || "No note"})`,
    };

    setLocalItems(updatedLocal);
    setLocalAssignments(updatedAssignments);
    setLocalMovements([newMovement, ...localMovements]);

    setReturnModalAssignment(null);
    setReturnQuantity("1");
    setReturnNote("");
  };

  // Submit Goods Received Note (GRN)
  const handleExecuteGRN = () => {
    const targetItem = localItems.find((i) => i.id === grnPartId);
    if (!targetItem) return;

    const qty = parseInt(grnQtyReceived, 10);
    if (isNaN(qty) || qty < 1) return;

    const isAccepted = grnDisposition === "Accepted & Released";
    const acceptedQty = isAccepted ? qty : 0;
    const heldQty = isAccepted ? 0 : qty;

    const newGRN: GoodsReceivedNote = {
      id: `grn-${Date.now()}`,
      grnNumber: `GRN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      poNumber: grnPoNumber,
      supplier: grnSupplier,
      invoiceRef: grnInvoice,
      receivedDate: new Date().toISOString().substring(0, 10),
      inventoryItemId: targetItem.id,
      partNumber: targetItem.partNumber,
      lotNumber: grnLot,
      dateCode: grnDateCode,
      quantityReceived: qty,
      quantityAccepted: acceptedQty,
      quantityHeld: heldQty,
      inspectionStatus: isAccepted ? "Accepted & Released" : "Pending IQC",
      inspectionReportId: `HLPL-IQC-TR-${Math.floor(1000 + Math.random() * 9000)}`,
      location: grnLocation,
      bin: grnBin,
      receivedBy: "Morgan Reed (PUR Lead)",
      dispositionNote: isAccepted
        ? "Passed 100% IQC mechanical & electrical incoming check."
        : "Placed in Quality Hold / Quarantine awaiting formal lab inspection report.",
    };

    const updatedLocal = localItems.map((entry) => {
      if (entry.id === targetItem.id) {
        return {
          ...entry,
          onHand: entry.onHand + qty,
          released: (entry.released ?? entry.onHand) + acceptedQty,
          held: (entry.held ?? 0) + heldQty,
          updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        };
      }
      return entry;
    });

    const newMovement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      inventoryItemId: targetItem.id,
      partNumber: targetItem.partNumber,
      change: qty,
      reason: isAccepted ? "Receipt" : "QuarantineHold",
      lotNumber: grnLot,
      at: new Date().toISOString().replace("T", " ").substring(0, 16),
      actor: "Morgan Reed (PUR)",
      note: `GRN ${newGRN.grnNumber} from ${grnSupplier} · Qty ${qty} · Status: ${newGRN.inspectionStatus}`,
    };

    setGrnList([newGRN, ...grnList]);
    setLocalItems(updatedLocal);
    setLocalMovements([newMovement, ...localMovements]);

    setGrnModalOpen(false);
  };

  // IQC Disposition Gate Handler (ISO 9001 §8.4 / IATF 16949 §8.6)
  const handleExecuteIQCDisposition = () => {
    if (!iqcModalGrn) return;
    const grn = iqcModalGrn;
    const accepted = Math.min(grn.quantityReceived, iqcAcceptedQty);
    const heldRemaining = Math.max(0, grn.quantityReceived - accepted);
    const newStatus: GoodsReceivedNote["inspectionStatus"] = heldRemaining === 0 ? "Accepted & Released" : "Rejected";

    // 1. Update GRN List
    setGrnList((prev) =>
      prev.map((g) =>
        g.id === grn.id
          ? {
              ...g,
              quantityAccepted: accepted,
              quantityHeld: heldRemaining,
              inspectionStatus: newStatus,
              inspectionReportId: iqcReportRef,
              dispositionNote: `${iqcNote} (Inspected by ${iqcInspector})`,
            }
          : g
      )
    );

    // 2. Update localItems (release held stock into active stock)
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.partNumber.trim().toUpperCase() === grn.partNumber.trim().toUpperCase() || item.id === grn.inventoryItemId) {
          const currentHeld = item.held ?? 0;
          const currentReleased = item.released ?? item.onHand;
          return {
            ...item,
            held: Math.max(0, currentHeld - accepted),
            released: currentReleased + accepted,
          };
        }
        return item;
      })
    );

    // 3. Append Audit Movement
    const releaseMovement: InventoryMovement = {
      id: `mov-iqc-${Date.now()}`,
      inventoryItemId: grn.inventoryItemId,
      partNumber: grn.partNumber,
      change: accepted,
      reason: "QualityRelease",
      lotNumber: grn.lotNumber,
      at: new Date().toISOString().replace("T", " ").substring(0, 16),
      actor: iqcInspector,
      note: `IQC Quality Release passed for lot ${grn.lotNumber}. Report: ${iqcReportRef}. ${accepted} units released to available project stock.`,
    };
    setLocalMovements((prev) => [releaseMovement, ...prev]);

    setIqcModalGrn(null);
  };

  // Helper for downloading CSV
  const downloadCsvBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Export Full Asset Register
  const exportAssetRegisterCsv = () => {
    const headers = [
      "Asset Tag",
      "Asset Name",
      "Class",
      "Subclass",
      "Serial Number",
      "Facility Location",
      "Custodian",
      "Department",
      "Status",
      "Compatible Parts",
      "Next Calibration Due",
      "Last Maintenance",
    ];
    const rows = assetList.map((a) => [
      `"${a.assetTag}"`,
      `"${a.name}"`,
      `"${a.assetClass}"`,
      `"${a.subclass}"`,
      `"${a.serialNumber}"`,
      `"${a.facilityLocation}"`,
      `"${a.custodian}"`,
      `"${a.department}"`,
      `"${a.status}"`,
      `"${a.compatiblePartNumbers.join("; ")}"`,
      `"${a.nextCalibrationDue}"`,
      `"${a.lastMaintenance}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCsvBlob(csv, `HLPL_Asset_Register_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Export Calibration & Maintenance Due Schedule
  const exportCalibrationScheduleCsv = () => {
    const headers = [
      "Asset Tag",
      "Asset Name",
      "Class",
      "Facility / Room",
      "Serial Number",
      "Custodian",
      "Next Calibration Due Date",
      "Operating Status",
      "Audit Standard",
    ];
    const rows = assetList
      .filter((a) => a.nextCalibrationDue && a.nextCalibrationDue !== "N/A")
      .map((a) => [
        `"${a.assetTag}"`,
        `"${a.name}"`,
        `"${a.assetClass}"`,
        `"${a.facilityLocation}"`,
        `"${a.serialNumber}"`,
        `"${a.custodian} (${a.department})"`,
        `"${a.nextCalibrationDue}"`,
        `"${a.status}"`,
        `"IATF 16949:2016 §7.1.5 Traceable"`,
      ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCsvBlob(csv, `HLPL_Calibration_Schedule_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Parse Bulk Asset CSV
  const handleParseBulkAssetCsv = (csvText: string) => {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) return;

    const existingSerials = new Set(assetList.map((a) => a.serialNumber.trim().toUpperCase()));
    const existingTags = new Set(assetList.map((a) => a.assetTag.trim().toUpperCase()));

    const parsed: Array<AssetRecord & { duplicate?: boolean }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());

      const tag = cols[0] || `HLPL-AST-GEN-${Date.now().toString().slice(-4)}`;
      const name = cols[1] || "Production / Test Tool";
      const assetClass = (cols[2] as AssetClass) || "Production Machinery";
      const subclass = cols[3] || "General";
      const serialNumber = cols[4] || `SN-${Date.now()}-${i}`;
      const facilityLocation = cols[5] || "Greater Noida SMT Plant 2";
      const custodian = cols[6] || "Casey Rowan";
      const department = cols[7] || "EMF";
      const nextCalibrationDue = cols[8] || "2027-04-15";
      const status = "In Service";

      const isDup = existingSerials.has(serialNumber.toUpperCase()) || existingTags.has(tag.toUpperCase());

      parsed.push({
        id: `ast-bulk-${Date.now()}-${i}`,
        assetTag: tag,
        name,
        assetClass,
        subclass,
        serialNumber,
        facilityLocation,
        custodian,
        department,
        calibrationDate: "2026-04-15",
        nextCalibrationDue,
        status,
        compatiblePartNumbers: ["STM32G0B1VCT6", "HLPL-HARN-AI4T-PWR-01"],
        lastMaintenance: "2026-09-10",
        duplicate: isDup,
      });
    }

    setStagedBulkAssets(parsed);
  };

  // Commit Bulk Assets to State
  const handleCommitBulkAssets = () => {
    const validAssets = stagedBulkAssets.filter((a) => !a.duplicate);
    if (validAssets.length === 0) {
      alert("No valid non-duplicate assets to import.");
      return;
    }
    setAssetList((prev) => [...prev, ...validAssets]);
    setBulkAssetModalOpen(false);
    setStagedBulkAssets([]);
    setRawAssetCsvText("");
  };

  // Mouser Auto-Fetch Specification Handler
  const handleFetchMouser = async (queryToSearch?: string) => {
    const q = (queryToSearch || mouserSearchQuery || newPartNum).trim();
    if (!q) return;

    setMouserLoading(true);
    setMouserSuccessMessage(null);
    try {
      const res = await lookupMouserPart(q);
      setMouserResultData(res);
      setNewPartNum(res.mpn);
      setNewPartDesc(res.description);
      setNewPartCat(res.suggestedCategory);
      setNewPartSubcat(res.suggestedSubcategory);
      setNewPartMfr(res.manufacturer);
      setNewPartPackage(res.packageCase);
      setNewPartSupplier(res.supplier);
      setNewPartCostUsd(res.tentativeCostUsd);
      setNewPartCostInr(res.tentativeCostInr);
      setNewPartPriceBreaks(res.priceBreaks);
      setNewPartLeadWeeks(res.leadTimeWeeks);
      setNewPartDatasheetUrl(res.datasheetUrl);
      setNewPartMouserUrl(res.mouserProductUrl);
      setNewPartMouserPfx(res.mouserPartNumber);
      setNewPartVoltage(res.voltageRating);
      setNewPartCurrent(res.currentRating);
      setNewPartAutoGraded(res.automotiveQualified);
      setNewPartAutoStd(res.automotiveStandard);
      setNewPartDimensions(res.dimensionsMm);
      setNewPartWeight(res.weightGrams);
      if (res.ipRating) setNewPartIpRating(res.ipRating);
      if (res.wireGauge) setNewPartWireGauge(res.wireGauge);
      if (res.matingForce) setNewPartMatingForce(res.matingForce);

      setMouserSuccessMessage(
        `✓ Fetched: ${res.manufacturer} ${res.mpn} · Category: ${res.suggestedCategory} (${res.suggestedSubcategory}) · Cost: $${res.tentativeCostUsd} (₹${res.tentativeCostInr}) · Datasheet Attached`
      );
    } catch (err) {
      console.error("Mouser lookup error:", err);
    } finally {
      setMouserLoading(false);
    }
  };

  // Register New Controlled Part
  const handleCreatePart = () => {
    if (!newPartNum || !newPartDesc) return;

    const newItem: InventoryItem = {
      id: `part-${Date.now()}`,
      partNumber: newPartNum,
      description: newPartDesc,
      category: newPartCat,
      subcategory: newPartSubcat || "Standard Component",
      crossTags:
        newPartCat === "Wire Harnesses"
          ? ["Mechanical", "Electrical", "Automotive"]
          : newPartCat === "Connectors"
          ? ["Mechanical", "Electrical", "Automotive"]
          : newPartCat === "Electronics"
          ? ["Electrical", "Automotive"]
          : ["Mechanical"],
      manufacturer: newPartMfr || "HLPL Approved SCM Vendor",
      packageCase: newPartPackage || "Standard",
      location: newPartLoc,
      bin: newPartBin,
      onHand: 0,
      released: 0,
      held: 0,
      allocated: 0,
      reorderPoint: parseInt(newPartReorder, 10) || 50,
      unit: newPartUnit,
      linkedProjects: newPartProjects.split(",").map((p) => p.trim()),
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),

      // Mouser Intelligence & Commercial Specifications
      mouserPartNumber: newPartMouserPfx || `MSR-${newPartNum}`,
      mouserUrl: newPartMouserUrl || `https://www.mouser.in/c/?q=${encodeURIComponent(newPartNum)}`,
      datasheetUrl: newPartDatasheetUrl || `https://www.alldatasheet.com/view.jsp?Searchword=${encodeURIComponent(newPartNum)}`,
      supplier: newPartSupplier || "Mouser Electronics",
      tentativeUnitCostUsd: newPartCostUsd ?? 2.50,
      tentativeUnitCostInr: newPartCostInr ?? Math.round(2.50 * 83.5 * 100) / 100,
      priceBreaks: newPartPriceBreaks,
      leadTimeWeeks: newPartLeadWeeks ?? 6,
      mouserStock: mouserResultData?.stockAvailability ?? 10000,
      rohsStatus: mouserResultData?.rohsStatus ?? "RoHS Compliant",

      // Electrical & Technical Specifications
      voltageRating: newPartVoltage || "3.3V / 5.0V Logic",
      currentRating: newPartCurrent || "Standard Operating Current",
      automotiveQualified: newPartAutoGraded,
      automotiveStandard: newPartAutoStd || (newPartAutoGraded ? "AEC-Q100 / Automotive Graded" : "Industrial Grade"),

      // Mechanical & Physical Specifications
      dimensionsMm: newPartDimensions || "10.0 × 10.0 × 2.0 mm",
      weightGrams: newPartWeight ?? 1.0,
      ipRating: newPartIpRating,
      wireGauge: newPartWireGauge,
      matingForce: newPartMatingForce,
    };

    setLocalItems([newItem, ...localItems]);
    setAddPartModalOpen(false);
    setNewPartNum("");
    setNewPartDesc("");
    setMouserSearchQuery("");
    setMouserSuccessMessage(null);
    setMouserResultData(null);
  };

  // =============================================================================
  // 6. RENDER INTERFACE
  // =============================================================================

  const submitSharedAssignment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const part = sharedPartMasters?.find((candidate) => candidate.id === sharedAssignPartId);
    const quantity = Number(sharedAssignQuantity);
    if (!part || !onSharedInventoryEvent || !sharedAssignProjectId || !sharedAssignRoleId) return;
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > part.available) {
      setSharedInventoryNotice(`Enter a quantity up to ${part.available} ${part.unit} available.`);
      return;
    }
    setSharedInventoryNotice("");
    try {
      await onSharedInventoryEvent({
        action: "assign",
        requestId: crypto.randomUUID(),
        partId: part.id,
        projectId: sharedAssignProjectId,
        roleId: sharedAssignRoleId,
        quantity,
        location: "Fictional TEST stockroom",
        bin: "",
        note: sharedAssignNote.trim() || "Project material allocation",
      });
      setSharedInventoryNotice(`${quantity} ${part.unit} allocated to the selected project role in Shared TEST.`);
      setSharedAssignPartId(null);
      setSharedAssignQuantity("1");
    } catch (error) {
      setSharedInventoryNotice(error instanceof Error ? error.message : "Shared inventory allocation failed.");
    }
  };

  return (
    <div className={`ops-section overflow-hidden rounded-xl border border-border bg-panel shadow-sm ${isFullPage ? "mt-2" : "mt-8"}`}>
      {/* Full Page Breadcrumb Header */}
      {isFullPage && onBack && (
        <div className="flex items-center justify-between border-b border-border bg-card/80 px-5 py-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Department Overview</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase text-primary">
              Full Page Governed Inventory & Parts Management
            </span>
          </div>
        </div>
      )}

      {/* Workspace Header */}
      <div className="ops-section-header flex flex-col gap-4 border-b border-border bg-card/60 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Boxes className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  Governed Inventory & Asset Management
                </h2>
                <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                  IATF 16949 / SCM CONTROLLED
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Demo component inventory, wire harness assemblies, serialized production machinery, and project-team issuance.
              </p>
            </div>
          </div>
        </div>

        {/* Global Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              <button
                onClick={() => setGrnModalOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                <ArrowDownToLine className="size-3.5" />
                <span>+ New GRN Receipt</span>
              </button>
              <button
                onClick={() => setAddPartModalOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                <Plus className="size-3.5" />
                <span>+ Register Part</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-3 text-xs text-amber-950 dark:text-amber-100" role="status">
        <span className="font-semibold">Demo data boundary.</span> The classic inventory tabs keep their fictional quantities and actions in this browser. The Shared TEST tabs use canonical Part IDs and a separate fictional stock ledger; nothing here represents Production stock.
      </div>

      {/* KPI Status Ribbon */}
      <div className="grid grid-cols-2 border-b border-border bg-secondary/30 sm:grid-cols-3 lg:grid-cols-6">
        <div className="border-r border-border p-3 last:border-r-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total On-Hand</span>
          <p className="mt-1 font-mono text-lg font-bold text-foreground">{totalOnHand.toLocaleString()} pcs</p>
          <span className="text-[10px] text-muted-foreground">Total warehouse stock</span>
        </div>
        <div className="border-r border-border p-3 last:border-r-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-moss">Released (Available)</span>
          <p className="mt-1 font-mono text-lg font-bold text-moss">{totalAvailable.toLocaleString()} pcs</p>
          <span className="text-[10px] text-muted-foreground">{totalReleased.toLocaleString()} passed IQC</span>
        </div>
        <div className="border-r border-border p-3 last:border-r-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-warning">Held / Quarantine</span>
          <p className="mt-1 font-mono text-lg font-bold text-warning">{totalHeld.toLocaleString()} pcs</p>
          <span className="text-[10px] text-muted-foreground">Blocked from issuance</span>
        </div>
        <div className="border-r border-border p-3 last:border-r-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-steel">Active Project Allocations</span>
          <p className="mt-1 font-mono text-lg font-bold text-steel">{totalAllocated.toLocaleString()} pcs</p>
          <span className="text-[10px] text-muted-foreground">{localAssignments.filter(a => a.status === "Active").length} team issues</span>
        </div>
        <div className="border-r border-border p-3 last:border-r-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-danger">Reorder Alerts</span>
          <p className="mt-1 font-mono text-lg font-bold text-danger">{lowStockCount} items</p>
          <span className="text-[10px] text-muted-foreground">Below buffer threshold</span>
        </div>
        <div className="p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Serialized Assets</span>
          <p className="mt-1 font-mono text-lg font-bold text-foreground">{assetList.length} machines</p>
          <span className="text-[10px] text-muted-foreground">Line 2 & Labs active</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border bg-card/40 px-4">
        {[
          { id: "parts", label: "Component & Parts Register", icon: Boxes, count: localItems.length },
          { id: "harnesses", label: "Wire Harness Assemblies", icon: Cable, count: localItems.filter((i) => i.category === "Wire Harnesses").length },
          { id: "issuance", label: "Project Material Issuance", icon: Package, count: localAssignments.length },
          { id: "grn", label: "Goods Received (GRN) & IQC", icon: FileText, count: grnList.length },
          { id: "assets", label: "Governed Asset Register", icon: Wrench, count: assetList.length },
          { id: "audit", label: "Stock Movement History", icon: History, count: localMovements.length },
          ...(sharedPartCatalogState ? [{ id: "shared-parts", label: "Shared Part Masters", icon: Tag, count: sharedPartMasters?.length ?? 0 }] : []),
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                isActive
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${isActive ? "bg-primary/20 text-primary font-bold" : "bg-secondary text-muted-foreground"}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1 & TAB 2: COMPONENT REGISTER & WIRE HARNESSES
         ========================================================================= */}
      {(activeTab === "parts" || activeTab === "harnesses") && (
        <div>
          {/* Department View Switcher & Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border bg-card/40 p-3 text-xs">
            {/* Left: Department View Presets */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background/80 p-1">
              <span className="px-2 font-mono text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Layers className="size-3 text-primary" /> Department View:
              </span>
              <button
                type="button"
                onClick={() => setColumnPreset("ehw")}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                  columnPreset === "ehw"
                    ? "bg-amber-500/20 text-amber-500 border border-amber-500/40 shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                title="Hardware Engineering: Voltage, Current, Automotive Qualification, Package, Datasheet"
              >
                <Zap className="size-3" />
                <span>Hardware (EHW)</span>
              </button>
              <button
                type="button"
                onClick={() => setColumnPreset("pur")}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                  columnPreset === "pur"
                    ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                title="Purchasing & SCM: Unit Cost ($ / ₹), Price Breaks, Lead Time, Mouser Stock, Sales Target Coverage"
              >
                <DollarSign className="size-3" />
                <span>Purchasing (PUR)</span>
              </button>
              <button
                type="button"
                onClick={() => setColumnPreset("mech")}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                  columnPreset === "mech"
                    ? "bg-blue-500/20 text-blue-500 border border-blue-500/40 shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                title="Mechanical Engineering: Dimensions, Weight, Ingress Sealing, Retention Force, Machinery"
              >
                <Ruler className="size-3" />
                <span>Mechanical (MECH)</span>
              </button>
              <button
                type="button"
                onClick={() => setColumnPreset("universal")}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                  columnPreset === "universal"
                    ? "bg-primary/20 text-primary border border-primary/40 shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                title="Universal View: Standard locations, bins, released and held stock"
              >
                <Boxes className="size-3" />
                <span>Universal</span>
              </button>
            </div>

            {/* Right: Quick actions / info badge */}
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                {columnPreset === "ehw" && "⚡ Hardware Preset: Voltage, Current & AEC-Q Qualification"}
                {columnPreset === "pur" && "💰 Purchasing Preset: Unit Cost, Lead Time & 50k Volume Coverage"}
                {columnPreset === "mech" && "📐 Mechanical Preset: Dimensions, IP Rating & Tooling"}
                {columnPreset === "universal" && "🌐 Universal Preset: Locations, Quantities & Status"}
              </span>
            </div>
          </div>

          <ResponsiveFilterBar label="Inventory filters" className="border-b border-border bg-card/20 p-2" activeCount={Number(selectedCategory !== "All") + Number(selectedCrossTag !== "All")} secondary={<>{activeTab === "parts" && <CompactFilterSelect label="Category" shortLabel="Type" icon={Filter} value={selectedCategory} onChange={setSelectedCategory} options={[{value:"All",label:"All categories"}, ...["Electronics","Connectors","Wire and Cable","Wire Harnesses","Mechanical Parts","Enclosures","Firmware Tools","Production Tools","Packaging & Consumables"].map(value => ({value,label:value}))]} />}<CompactFilterSelect label="Cross-tag" shortLabel="Tag" icon={Filter} value={selectedCrossTag} onChange={setSelectedCrossTag} options={[{value:"All",label:"All cross-tags"}, ...["Electrical","Mechanical","Automotive","Safety Critical"].map(value => ({value,label:value}))]} /></>}>
            <div className="filter-search"><Search /><input aria-label="Search inventory" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search part, manufacturer or bin…" /></div>
            <CompactFilterSelect label="Project" shortLabel="Project" icon={Filter} value={selectedProject} onChange={setSelectedProject} options={[{value:"All",label:"All linked projects"}, ...Array.from(new Set(localItems.flatMap(item => item.linkedProjects ?? []))).sort().map(value => ({value,label:value}))]} />
            <CompactFilterSelect label="Stock status" shortLabel="Stock" icon={Filter} value={stockStateFilter} onChange={setStockStateFilter} options={[{value:"All",label:"All stock statuses"},{value:"Available",label:"Available only"},{value:"LowStock",label:"Low stock / reorder"},{value:"Held",label:"Quality-held lots"},{value:"Assigned",label:"Active project assignment"}]} />
          </ResponsiveFilterBar>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-xs">
              <thead className="border-b border-border bg-secondary/50 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {columnPreset === "ehw" ? (
                  <tr>
                    <th className="px-4 py-2.5">Part & Technical Description</th>
                    <th className="px-3 py-2.5">Voltage Rating</th>
                    <th className="px-3 py-2.5">Operating Current</th>
                    <th className="px-3 py-2.5">Automotive Standard</th>
                    <th className="px-3 py-2.5">Package / Footprint</th>
                    <th className="px-3 py-2.5 text-right">Available Released</th>
                    <th className="px-3 py-2.5">Linked Projects</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                ) : columnPreset === "pur" ? (
                  <tr>
                    <th className="px-4 py-2.5">Part Number & Supplier</th>
                    <th className="px-3 py-2.5">Tentative Cost ($ / ₹)</th>
                    <th className="px-3 py-2.5">Volume Pricing Tiers</th>
                    <th className="px-3 py-2.5">Lead Time & Distributor Stock</th>
                    <th className="px-3 py-2.5">Coverage vs 50k Sales Target</th>
                    <th className="px-3 py-2.5">Buffer Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                ) : columnPreset === "mech" ? (
                  <tr>
                    <th className="px-4 py-2.5">Part & Assembly Type</th>
                    <th className="px-3 py-2.5">Dimensions (L×W×H)</th>
                    <th className="px-3 py-2.5">Weight / Mass</th>
                    <th className="px-3 py-2.5">Ingress & Loom / Casing</th>
                    <th className="px-3 py-2.5">Wire Gauge & Mating Force</th>
                    <th className="px-3 py-2.5">Compatible Machinery</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-2.5">Part Number & Specifications</th>
                    <th className="px-3 py-2.5">Category & Cross-Tags</th>
                    <th className="px-3 py-2.5">Location / Bin</th>
                    <th className="px-3 py-2.5 text-right">Available Released</th>
                    <th className="px-3 py-2.5 text-right">Quality Held</th>
                    <th className="px-3 py-2.5">Linked Projects</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item) => {
                  const availableStock = getAvailable(item);
                  const heldStock = getHeld(item);
                  const isLow = availableStock <= item.reorderPoint;
                  const isHarness = item.category === "Wire Harnesses";

                  // -------------------------------------------------------------
                  // PRESET: HARDWARE (EHW)
                  // -------------------------------------------------------------
                  if (columnPreset === "ehw") {
                    return (
                      <tr key={item.id} className="transition-colors hover:bg-secondary/40">
                        {/* Part, Description & Datasheet Link */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-start gap-2">
                            {isHarness ? (
                              <Cable className="size-4 shrink-0 text-cyan-500 mt-0.5" />
                            ) : (
                              <Cpu className="size-4 shrink-0 text-amber-500 mt-0.5" />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="font-mono font-bold text-foreground hover:underline cursor-pointer"
                                  onClick={() => setDetailItem(item)}
                                >
                                  {item.partNumber}
                                </span>
                                {item.datasheetUrl && (
                                  <a
                                    href={item.datasheetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-blue-500 hover:bg-blue-500/20 border border-blue-500/25 transition-colors"
                                    title="Open manufacturer datasheet PDF in new tab"
                                  >
                                    <FileText className="size-2.5" />
                                    <span>Datasheet ↗</span>
                                  </a>
                                )}
                              </div>
                              <span className="block text-[11px] text-muted-foreground line-clamp-1">
                                {item.description}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {item.manufacturer || "SCM Sourced"} {item.subcategory ? `· ${item.subcategory}` : ""}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Voltage Rating */}
                        <td className="px-3 py-2.5 font-mono text-[11px]">
                          <span className="font-semibold text-foreground">
                            {item.voltageRating || "3.3V / 5.0V Logic"}
                          </span>
                        </td>

                        {/* Operating Current */}
                        <td className="px-3 py-2.5 font-mono text-[11px]">
                          <span className="text-muted-foreground">
                            {item.currentRating || "Standard"}
                          </span>
                        </td>

                        {/* Automotive Standard */}
                        <td className="px-3 py-2.5 font-mono text-[10px]">
                          {item.automotiveQualified ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-500 border border-emerald-500/30">
                              <ShieldCheck className="size-3" />
                              <span>{item.automotiveStandard || "AEC-Q100"}</span>
                            </span>
                          ) : (
                            <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">
                              Industrial Grade
                            </span>
                          )}
                        </td>

                        {/* Package / Footprint */}
                        <td className="px-3 py-2.5 font-mono text-[11px] text-foreground">
                          {item.packageCase || "Standard SMD"}
                        </td>

                        {/* Available Released */}
                        <td className="px-3 py-2.5 text-right font-mono">
                          <strong className="text-sm font-bold text-foreground">
                            {availableStock.toLocaleString()} {item.unit}
                          </strong>
                          {heldStock > 0 && (
                            <span className="block text-[10px] text-warning font-semibold">
                              +{heldStock} held in IQC
                            </span>
                          )}
                        </td>

                        {/* Linked Projects */}
                        <td className="px-3 py-2.5 font-mono text-[10px]">
                          {item.linkedProjects && item.linkedProjects.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.linkedProjects.map((p) => (
                                <span key={p} className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                                  {p}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Universal</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.datasheetUrl && (
                              <a
                                href={item.datasheetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open PDF Datasheet in new tab"
                                className="grid size-7 place-items-center rounded border border-border bg-card text-blue-500 transition-colors hover:bg-blue-500/10"
                              >
                                <ExternalLink className="size-3.5" />
                              </a>
                            )}
                            <button
                              title="Inspect Part Details"
                              onClick={() => {
                                setDetailTab("ehw");
                                setDetailItem(item);
                              }}
                              className="grid size-7 place-items-center rounded border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            {!readOnly && (
                              <button
                                title={`Issue ${item.partNumber} to Project Team`}
                                onClick={() => {
                                  setIssueModalItem(item);
                                  if (item.linkedProjects && item.linkedProjects.length > 0 && item.linkedProjects[0]) {
                                    setIssueProject(item.linkedProjects[0]);
                                  }
                                }}
                                disabled={availableStock === 0}
                                className="flex h-7 items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 font-mono text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                              >
                                <UserPlus className="size-3" />
                                <span>Issue</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // -------------------------------------------------------------
                  // PRESET: PURCHASING (PUR)
                  // -------------------------------------------------------------
                  if (columnPreset === "pur") {
                    const unitUsd = item.tentativeUnitCostUsd ?? 2.50;
                    const unitInr = item.tentativeUnitCostInr ?? Math.round(unitUsd * 83.5 * 100) / 100;
                    const salesTarget = item.category === "Wire Harnesses" || item.category === "Electronics" ? 50000 : 10000;
                    const covPct = Math.min(100, Math.round((availableStock / salesTarget) * 100));

                    return (
                      <tr key={item.id} className="transition-colors hover:bg-secondary/40">
                        {/* Part & Supplier */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-start gap-2">
                            <ShoppingCart className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="font-mono font-bold text-foreground hover:underline cursor-pointer"
                                  onClick={() => {
                                    setDetailTab("pur");
                                    setDetailItem(item);
                                  }}
                                >
                                  {item.partNumber}
                                </span>
                                {item.mouserUrl && (
                                  <a
                                    href={item.mouserUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/25 transition-colors"
                                    title="View live component catalog on Mouser.com in new tab"
                                  >
                                    <ShoppingCart className="size-2.5" />
                                    <span>Mouser Buy ↗</span>
                                  </a>
                                )}
                              </div>
                              <span className="block text-[11px] text-muted-foreground line-clamp-1">
                                {item.description}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                Supplier: <strong className="text-foreground">{item.supplier || "Mouser Electronics"}</strong> {item.mouserPartNumber ? `· #${item.mouserPartNumber}` : ""}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Tentative Unit Cost ($ and ₹) */}
                        <td className="px-3 py-2.5 font-mono">
                          <div className="text-sm font-bold text-foreground">
                            ${unitUsd.toFixed(2)}
                          </div>
                          <div className="text-[10px] font-semibold text-emerald-500">
                            ₹{unitInr.toFixed(2)}
                          </div>
                        </td>

                        {/* Volume Pricing Tiers */}
                        <td className="px-3 py-2.5 font-mono text-[10px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-muted-foreground">
                              1k: <strong className="text-foreground">${(unitUsd * 1.0).toFixed(2)}</strong>
                            </span>
                            <span className="text-muted-foreground">
                              10k: <strong className="text-emerald-500">${(unitUsd * 0.88).toFixed(2)}</strong> (save 12%)
                            </span>
                          </div>
                        </td>

                        {/* Lead Time & Distributor Stock */}
                        <td className="px-3 py-2.5 font-mono text-[11px]">
                          <span className="font-bold text-foreground">{item.leadTimeWeeks ?? 6} wks lead</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {(item.mouserStock ?? 12500).toLocaleString()} pcs in Mouser stock
                          </span>
                        </td>

                        {/* Stock vs Sales Target (50,000 pcs estimation) */}
                        <td className="px-3 py-2.5 font-mono text-[11px] min-w-36">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-foreground">
                              {availableStock.toLocaleString()} / {salesTarget.toLocaleString()}
                            </span>
                            <span className={`font-bold ${covPct >= 25 ? "text-moss" : "text-amber-500"}`}>
                              {covPct}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                            <div
                              className={`h-full ${covPct >= 25 ? "bg-moss" : "bg-amber-500"}`}
                              style={{ width: `${Math.max(5, covPct)}%` }}
                            />
                          </div>
                        </td>

                        {/* Buffer Status */}
                        <td className="px-3 py-2.5 font-mono text-[10px]">
                          {isLow ? (
                            <span className="rounded bg-danger/15 px-2 py-0.5 font-bold text-danger border border-danger/30">
                              REORDER BUFFER ≤ {item.reorderPoint}
                            </span>
                          ) : (
                            <span className="rounded bg-moss/15 px-2 py-0.5 font-bold text-moss border border-moss/30">
                              BUFFER SECURED
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.mouserUrl && (
                              <a
                                href={item.mouserUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open Mouser Catalog in new tab"
                                className="grid size-7 place-items-center rounded border border-border bg-card text-emerald-500 transition-colors hover:bg-emerald-500/10"
                              >
                                <ExternalLink className="size-3.5" />
                              </a>
                            )}
                            <button
                              title="Inspect Part Details"
                              onClick={() => {
                                setDetailTab("pur");
                                setDetailItem(item);
                              }}
                              className="grid size-7 place-items-center rounded border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            {!readOnly && (
                              <button
                                title={`Issue ${item.partNumber} to Project Team`}
                                onClick={() => {
                                  setIssueModalItem(item);
                                  if (item.linkedProjects && item.linkedProjects.length > 0 && item.linkedProjects[0]) {
                                    setIssueProject(item.linkedProjects[0]);
                                  }
                                }}
                                disabled={availableStock === 0}
                                className="flex h-7 items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 font-mono text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                              >
                                <UserPlus className="size-3" />
                                <span>Issue</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // -------------------------------------------------------------
                  // PRESET: MECHANICAL (MECH)
                  // -------------------------------------------------------------
                  if (columnPreset === "mech") {
                    return (
                      <tr key={item.id} className="transition-colors hover:bg-secondary/40">
                        {/* Part & Assembly Type */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-start gap-2">
                            <Ruler className="size-4 shrink-0 text-blue-500 mt-0.5" />
                            <div>
                              <span
                                className="font-mono font-bold text-foreground hover:underline cursor-pointer"
                                onClick={() => {
                                  setDetailTab("mech");
                                  setDetailItem(item);
                                }}
                              >
                                {item.partNumber}
                              </span>
                              <span className="block text-[11px] text-muted-foreground line-clamp-1">
                                {item.description}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {item.category} {item.subcategory ? `· ${item.subcategory}` : ""}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Dimensions (L×W×H) */}
                        <td className="px-3 py-2.5 font-mono text-[11px] text-foreground">
                          {item.dimensionsMm || "10.0 × 10.0 × 2.0 mm"}
                        </td>

                        {/* Weight / Mass */}
                        <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                          <strong className="text-foreground">{item.weightGrams ?? 0.85}</strong> g
                        </td>

                        {/* Ingress & Loom / Casing */}
                        <td className="px-3 py-2.5 font-mono text-[11px]">
                          <span className="inline-block rounded bg-blue-500/10 px-1.5 py-0.5 font-bold text-blue-500 border border-blue-500/25 text-[10px]">
                            {item.ipRating || "IP67 Rated"}
                          </span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            {item.packageCase || "Molded Loom / Housing"}
                          </span>
                        </td>

                        {/* Wire Gauge & Mating Force */}
                        <td className="px-3 py-2.5 font-mono text-[10px]">
                          <span className="block text-foreground font-semibold">
                            {item.wireGauge || "FLRY-B 0.50mm²"}
                          </span>
                          <span className="text-muted-foreground">
                            {item.matingForce || "75N retention lock"}
                          </span>
                        </td>

                        {/* Compatible Production Machinery */}
                        <td className="px-3 py-2.5 font-mono text-[10px]">
                          {item.compatibleAssetIds && item.compatibleAssetIds.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.compatibleAssetIds.map((astId) => {
                                const ast = assetList.find((a) => a.id === astId);
                                return (
                                  <span key={astId} className="rounded border border-border bg-card px-1.5 py-0.5 text-foreground">
                                    {ast?.name?.split(" ")[0] || astId}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">General Tooling</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              title="Inspect Part Details"
                              onClick={() => {
                                setDetailTab("mech");
                                setDetailItem(item);
                              }}
                              className="grid size-7 place-items-center rounded border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            {!readOnly && (
                              <button
                                title={`Issue ${item.partNumber} to Project Team`}
                                onClick={() => {
                                  setIssueModalItem(item);
                                  if (item.linkedProjects && item.linkedProjects.length > 0 && item.linkedProjects[0]) {
                                    setIssueProject(item.linkedProjects[0]);
                                  }
                                }}
                                disabled={availableStock === 0}
                                className="flex h-7 items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 font-mono text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                              >
                                <UserPlus className="size-3" />
                                <span>Issue</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // -------------------------------------------------------------
                  // PRESET: UNIVERSAL (STANDARD)
                  // -------------------------------------------------------------
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-secondary/40">
                      {/* Part & Description */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isHarness ? (
                            <Cable className="size-4 shrink-0 text-cyan-500" />
                          ) : (
                            <Boxes className="size-4 shrink-0 text-steel" />
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="font-mono font-bold text-foreground hover:underline cursor-pointer"
                                onClick={() => {
                                  setDetailTab("overview");
                                  setDetailItem(item);
                                }}
                              >
                                {item.partNumber}
                              </span>
                              {item.datasheetUrl && (
                                <a
                                  href={item.datasheetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-blue-500 hover:bg-blue-500/20 border border-blue-500/25 transition-colors"
                                  title="Open manufacturer datasheet PDF in new tab"
                                >
                                  <FileText className="size-2.5" />
                                  <span>PDF ↗</span>
                                </a>
                              )}
                              {item.mouserUrl && (
                                <a
                                  href={item.mouserUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/25 transition-colors"
                                  title="Open Mouser catalog in new tab"
                                >
                                  <ShoppingCart className="size-2.5" />
                                  <span>Mouser ↗</span>
                                </a>
                              )}
                            </div>
                            <span className="block text-[11px] text-muted-foreground line-clamp-1">
                              {item.description}
                            </span>
                            {item.manufacturer && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                Mfr: {item.manufacturer} {item.packageCase ? `· ${item.packageCase}` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category & Cross-Tags */}
                      <td className="px-3 py-2.5">
                        <span className="inline-block rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                          {item.category}
                        </span>
                        {item.crossTags && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.crossTags.map((tag) => (
                              <span
                                key={tag}
                                className={`rounded px-1.5 py-0.2 text-[9px] font-medium ${
                                  tag === "Electrical"
                                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                    : tag === "Mechanical"
                                    ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                    : tag === "Automotive"
                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                    : "bg-slate-500/10 text-slate-400"
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Location & Bin */}
                      <td className="px-3 py-2.5 font-mono text-[11px]">
                        <span className="font-medium text-foreground">{item.location}</span>
                        <span className="block text-[10px] text-muted-foreground">Bin: {item.bin}</span>
                      </td>

                      {/* Available Released */}
                      <td className="px-3 py-2.5 text-right font-mono">
                        <strong className="text-sm font-bold text-foreground">
                          {availableStock.toLocaleString()} {item.unit}
                        </strong>
                        <span className="block text-[10px] text-muted-foreground">
                          {item.onHand.toLocaleString()} total · {item.allocated} alloc
                        </span>
                      </td>

                      {/* Quality Held */}
                      <td className="px-3 py-2.5 text-right font-mono">
                        {heldStock > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-warning">
                            <AlertTriangle className="size-3" />
                            {heldStock.toLocaleString()} {item.unit}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>

                      {/* Linked Projects */}
                      <td className="px-3 py-2.5 font-mono text-[10px]">
                        {item.linkedProjects && item.linkedProjects.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.linkedProjects.map((p) => (
                              <span key={p} className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Universal</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 font-mono text-[10px]">
                        {isLow ? (
                          <span className="rounded bg-danger/15 px-2 py-0.5 font-bold text-danger">
                            REORDER ≤ {item.reorderPoint}
                          </span>
                        ) : availableStock > 0 ? (
                          <span className="rounded bg-moss/15 px-2 py-0.5 font-bold text-moss">
                            AVAILABLE
                          </span>
                        ) : (
                          <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">
                            OUT OF STOCK
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="Inspect Part Details & Specifications"
                            onClick={() => {
                              setDetailTab("overview");
                              setDetailItem(item);
                            }}
                            className="grid size-7 place-items-center rounded border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          {!readOnly && (
                            <button
                              title={`Issue ${item.partNumber} to Project Team`}
                              onClick={() => {
                                setIssueModalItem(item);
                                if (item.linkedProjects && item.linkedProjects.length > 0 && item.linkedProjects[0]) {
                                  setIssueProject(item.linkedProjects[0]);
                                }
                              }}
                              disabled={availableStock === 0}
                              className="flex h-7 items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 font-mono text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                            >
                              <UserPlus className="size-3" />
                              <span>Issue</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "shared-parts" && (
        <section aria-label="Shared Part Master" className="p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Shared TEST Inventory</h3>
              <p className="text-xs text-muted-foreground">Canonical Part IDs, fictional test balances, and role-based allocations from the authenticated Shared TEST ledger.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input aria-label="Search shared parts" className="h-8 min-w-56 rounded-md border border-input bg-background px-2 text-xs" placeholder="Search part, MPN or reference…" value={sharedPartSearch} onChange={event => setSharedPartSearch(event.target.value)} />
              <select aria-label="Filter shared parts by category" className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={sharedPartCategory} onChange={event => setSharedPartCategory(event.target.value)}>
                <option value="All">All categories</option>
                {Array.from(new Set((sharedPartMasters ?? []).map(part => part.category).filter((value): value is string => !!value))).sort().map(category => <option key={category} value={category}>{category}</option>)}
              </select>
              <select aria-label="Filter shared parts by department" className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={sharedPartDepartment} onChange={event => setSharedPartDepartment(event.target.value)}>
                <option value="All">All departments</option>
                {Array.from(new Set((sharedPartMasters ?? []).flatMap(part => part.departmentViews))).sort().map(department => <option key={department} value={department}>{department}</option>)}
              </select>
            </div>
          </div>
          {sharedPartCatalogState === "loading" ? (
            <div className="flex items-center gap-2 rounded-lg border border-border p-5 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading Shared TEST Part masters…</div>
          ) : sharedPartCatalogState === "error" ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">Shared TEST inventory could not be loaded. The browser-local stock demo remains separate.</p>
          ) : (() => {
            const query = sharedPartSearch.trim().toLocaleLowerCase();
            const visibleParts = (sharedPartMasters ?? []).filter(part =>
              (sharedPartCategory === "All" || part.category === sharedPartCategory) &&
              (sharedPartDepartment === "All" || part.departmentViews.includes(sharedPartDepartment) || part.primaryDepartment === sharedPartDepartment) &&
              (!query || [part.reference, part.title, part.mpn ?? "", part.category ?? ""].some(value => value.toLocaleLowerCase().includes(query)))
            );
            return visibleParts.length ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[1160px] text-left text-xs">
                  <thead className="border-b border-border bg-secondary/50 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2">Part master</th><th className="px-3 py-2">MPN</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Department views</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">On hand</th><th className="px-3 py-2 text-right">Held</th><th className="px-3 py-2 text-right">Allocated</th><th className="px-3 py-2 text-right">Available</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {visibleParts.map(part => <React.Fragment key={part.id}>
                      <tr>
                        <td className="px-3 py-2.5"><div className="font-semibold text-foreground">{part.title}</div><div className="font-mono text-[10px] text-muted-foreground">{part.reference}</div>{part.isDemo && <span className="mt-1 inline-flex rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 dark:text-amber-200">Fictional TEST balance</span>}</td>
                        <td className="px-3 py-2.5 font-mono">{part.mpn || "Not recorded"}</td>
                        <td className="px-3 py-2.5">{part.category || "Not categorized"}{part.subcategory && <div className="text-[10px] text-muted-foreground">{part.subcategory}</div>}</td>
                        <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{Array.from(new Set([...(part.departmentViews ?? []), ...(part.primaryDepartment ? [part.primaryDepartment] : [])])).map(department => <span key={department} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">{department}</span>)}</div></td>
                        <td className="px-3 py-2.5">{part.status}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{part.onHand.toLocaleString()} <span className="text-muted-foreground">{part.unit}</span></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{part.held.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{part.allocated.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{part.available.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right">{sharedInventoryRoles?.length ? <button type="button" disabled={!onSharedInventoryEvent || part.available <= 0 || sharedInventoryActionPending} onClick={() => { setSharedAssignPartId(sharedAssignPartId === part.id ? null : part.id); setSharedAssignQuantity("1"); setSharedInventoryNotice(""); }} className="inline-flex h-7 items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 text-[10px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"><UserPlus className="size-3" />Assign role</button> : <span className="text-[10px] text-muted-foreground">Role setup needed</span>}</td>
                      </tr>
                      {sharedAssignPartId === part.id && <tr className="bg-secondary/30"><td colSpan={10} className="px-4 py-3">
                        <form onSubmit={submitSharedAssignment} className="grid gap-3 md:grid-cols-[1fr_1fr_100px_1.3fr_auto] md:items-end">
                          <label className="grid gap-1 text-[10px] font-medium text-muted-foreground">Project<select required aria-label="Shared inventory project" className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground" value={sharedAssignProjectId} onChange={event => setSharedAssignProjectId(event.target.value)}><option value="">Choose project…</option>{(sharedInventoryProjects ?? []).map(project => <option key={project.id} value={project.id}>{project.reference} · {project.title}</option>)}</select></label>
                          <label className="grid gap-1 text-[10px] font-medium text-muted-foreground">Assignee profile<select required aria-label="Shared inventory assignee profile" className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground" value={sharedAssignRoleId} onChange={event => setSharedAssignRoleId(event.target.value)}><option value="">Choose L1–L4 profile…</option>{(sharedInventoryRoles ?? []).map(role => <option key={role.id} value={role.id}>L{role.hierarchyLevel} · {role.name} ({role.departmentCode})</option>)}</select></label>
                          <label className="grid gap-1 text-[10px] font-medium text-muted-foreground">Quantity<input aria-label="Shared inventory assignment quantity" type="number" min="0.001" step="0.001" max={part.available} required className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground" value={sharedAssignQuantity} onChange={event => setSharedAssignQuantity(event.target.value)} /></label>
                          <label className="grid gap-1 text-[10px] font-medium text-muted-foreground">Reason<input aria-label="Shared inventory assignment note" required minLength={3} maxLength={500} className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground" value={sharedAssignNote} onChange={event => setSharedAssignNote(event.target.value)} /></label>
                          <button type="submit" disabled={sharedInventoryActionPending || !sharedAssignProjectId || !sharedAssignRoleId} className="h-8 rounded bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">{sharedInventoryActionPending ? "Saving…" : "Save allocation"}</button>
                        </form>
                        <p className="mt-2 text-[10px] text-muted-foreground">Assignment is saved against the stable role profile ID, not an employee name. Existing task/project history is unchanged.</p>
                      </td></tr>}
                    </React.Fragment>)}
                  </tbody>
                </table>
              </div>
            ) : <p className="rounded-lg border border-dashed border-border p-5 text-xs text-muted-foreground">No Shared TEST parts match these filters.</p>;
          })()}
          {sharedInventoryRoles?.length === 0 && sharedPartCatalogState === "ready" && <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-100">No active L1–L4 inventory profiles are configured for this account. Configure the department role level and `inventory:issue` permission before shared allocation. The sample balances remain visible.</p>}
          {sharedInventoryActionError && <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{sharedInventoryActionError}</p>}
          {sharedInventoryNotice && <p role="status" className="mt-3 rounded-lg border border-border bg-secondary/30 p-3 text-xs">{sharedInventoryNotice}</p>}
          <p className="mt-3 text-[10px] text-muted-foreground">{sharedPartMasters?.[0]?.stockNotice ?? "Shared TEST quantities remain separate from the browser-local stock demo."}</p>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <section aria-label="Shared inventory allocations" className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2"><h4 className="text-xs font-semibold">Active role allocations ({sharedInventoryAssignments?.length ?? 0})</h4><p className="text-[10px] text-muted-foreground">Project, department, and L1–L4 profile are stored by stable IDs.</p></div>
              {(sharedInventoryAssignments?.length ?? 0) > 0 ? <div className="max-h-72 overflow-auto"><table className="w-full text-left text-[10px]"><thead className="sticky top-0 bg-secondary/70 text-muted-foreground"><tr><th className="px-3 py-2">Part</th><th className="px-3 py-2">Project</th><th className="px-3 py-2">Profile</th><th className="px-3 py-2 text-right">Remaining</th></tr></thead><tbody className="divide-y divide-border">{sharedInventoryAssignments?.map(assignment => <tr key={assignment.id}><td className="px-3 py-2">{assignment.partReference}</td><td className="px-3 py-2">{assignment.projectReference}</td><td className="px-3 py-2">L{assignment.hierarchyLevel} · {assignment.roleName} ({assignment.departmentCode})</td><td className="px-3 py-2 text-right">{assignment.quantity}</td></tr>)}</tbody></table></div> : <p className="p-3 text-[10px] text-muted-foreground">No shared allocations are recorded.</p>}
            </section>
            <section aria-label="Shared inventory movement audit" className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2"><h4 className="text-xs font-semibold">Movement audit ({sharedInventoryMovements?.length ?? 0})</h4><p className="text-[10px] text-muted-foreground">Append-only TEST ledger; fictional sample opening balances are identified.</p></div>
              {(sharedInventoryMovements?.length ?? 0) > 0 ? <div className="max-h-72 overflow-auto"><table className="w-full text-left text-[10px]"><thead className="sticky top-0 bg-secondary/70 text-muted-foreground"><tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Part</th><th className="px-3 py-2">Movement</th><th className="px-3 py-2">Note</th></tr></thead><tbody className="divide-y divide-border">{sharedInventoryMovements?.map(movement => <tr key={movement.id}><td className="whitespace-nowrap px-3 py-2">{new Date(movement.createdAt).toLocaleString()}</td><td className="px-3 py-2">{movement.partReference}</td><td className="px-3 py-2">{movement.eventKind} · {movement.onHandDelta || movement.heldDelta || movement.allocatedDelta}</td><td className="max-w-[240px] px-3 py-2">{movement.note}</td></tr>)}</tbody></table></div> : <p className="p-3 text-[10px] text-muted-foreground">No shared stock movements are recorded.</p>}
            </section>
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 3: PROJECT-TEAM CONTROLLED ISSUANCE & RETURNS
         ========================================================================= */}
      {activeTab === "issuance" && (
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Project Material Issuance & Returns Register</h3>
              <p className="text-xs text-muted-foreground">
                Authoritative record of parts and wire harnesses issued to active project teams. All recipients are verified against the project roster.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
                {localAssignments.filter((a) => a.status === "Active").length} Active Allocations
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-secondary/50 font-mono text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Component / Part</th>
                  <th className="px-3 py-2.5">Issued To (Recipient)</th>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Project Scope</th>
                  <th className="px-3 py-2.5 text-right">Quantity</th>
                  <th className="px-3 py-2.5">Date Issued</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {localAssignments.map((asg) => (
                  <tr key={asg.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-2.5 font-bold text-foreground">
                      {asg.partNumber || asg.inventoryItemId}
                      <span className="block font-sans text-[10px] font-normal text-muted-foreground">{asg.note}</span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{asg.assignee}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-steel/10 px-2 py-0.5 font-bold text-steel">{asg.department}</span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-primary">{asg.project}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-foreground">{asg.quantity} pcs</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{asg.assignedAt}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 font-bold text-[10px] ${
                          asg.status === "Active"
                            ? "bg-moss/15 text-moss"
                            : "bg-secondary text-muted-foreground line-through"
                        }`}
                      >
                        {asg.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {asg.status === "Active" && !readOnly && (
                        <button
                          onClick={() => {
                            setReturnModalAssignment(asg);
                            setReturnQuantity(asg.quantity.toString());
                          }}
                          className="flex h-6 items-center gap-1 rounded border border-border bg-card px-2 text-[10px] font-bold text-foreground transition-colors hover:bg-secondary"
                        >
                          <RotateCcw className="size-3" />
                          <span>Return</span>
                        </button>
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
          TAB 4: GOODS RECEIVED NOTES (GRN) & IQC QUALITY LOTS
         ========================================================================= */}
      {activeTab === "grn" && (
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Goods Received Notes (GRN) & IQC Quality Hold Log</h3>
              <p className="text-xs text-muted-foreground">
                PO-led receiving log with lot/date code tracking and accepted vs. quality hold splits.
              </p>
            </div>
            {!readOnly && (
              <button
                onClick={() => setGrnModalOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="size-3.5" />
                <span>+ Process New GRN</span>
              </button>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-secondary/50 font-mono text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">GRN Number & Date</th>
                  <th className="px-3 py-2.5">PO & Supplier</th>
                  <th className="px-3 py-2.5">Part / Description</th>
                  <th className="px-3 py-2.5">Lot & Date Code</th>
                  <th className="px-3 py-2.5 text-right">Received Qty</th>
                  <th className="px-3 py-2.5 text-right">Accepted / Released</th>
                  <th className="px-3 py-2.5 text-right">Quality Held</th>
                  <th className="px-3 py-2.5">Inspection Status</th>
                  <th className="px-3 py-2.5 text-right">IQC Quality Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {grnList.map((grn) => (
                  <tr key={grn.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-2.5">
                      <strong className="text-foreground">{grn.grnNumber}</strong>
                      <span className="block text-[10px] text-muted-foreground">{grn.receivedDate}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-primary">{grn.poNumber}</span>
                      <span className="block font-sans text-[10px] text-muted-foreground">{grn.supplier}</span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-foreground">{grn.partNumber}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold">{grn.lotNumber}</span>
                      <span className="block text-[10px] text-muted-foreground">DC: {grn.dateCode}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold">{grn.quantityReceived.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-moss">
                      {grn.quantityAccepted.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-warning">
                      {grn.quantityHeld > 0 ? grn.quantityHeld.toLocaleString() : "0"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          grn.inspectionStatus === "Accepted & Released"
                            ? "bg-moss/15 text-moss"
                            : grn.inspectionStatus === "Pending IQC"
                            ? "bg-warning/15 text-warning"
                            : "bg-danger/15 text-danger"
                        }`}
                      >
                        {grn.inspectionStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {grn.inspectionStatus === "Pending IQC" && !readOnly ? (
                        <button
                          onClick={() => {
                            setIqcModalGrn(grn);
                            setIqcAcceptedQty(grn.quantityHeld > 0 ? grn.quantityHeld : grn.quantityReceived);
                          }}
                          className="rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow hover:bg-emerald-700"
                        >
                          IQC Release
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Released ✓</span>
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
          TAB 5: GOVERNED ASSET REGISTER (MACHINERY & SERIALIZED EQUIPMENT)
         ========================================================================= */}
      {activeTab === "assets" && (
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Governed Asset Register (Machinery & Jigs)</h3>
              <p className="text-xs text-muted-foreground">
                Serialized production machinery, wire crimpers, ultrasonic welders, and EOL test fixtures with calibration traceability.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!readOnly && (
                <button
                  onClick={() => setBulkAssetModalOpen(true)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20"
                >
                  <FileSpreadsheet className="size-3.5" />
                  <span>+ Bulk Import Assets (.csv)</span>
                </button>
              )}
              <button
                onClick={exportAssetRegisterCsv}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <Download className="size-3.5" />
                <span>Export Asset Register</span>
              </button>
              <button
                onClick={exportCalibrationScheduleCsv}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              >
                <Calendar className="size-3.5" />
                <span>Calibration Schedule</span>
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scopedAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => setDetailAsset(asset)}
                className="cursor-pointer rounded-xl border border-border bg-card/60 p-4 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid size-8 place-items-center rounded-lg bg-steel/10 text-steel">
                      <Wrench className="size-4" />
                    </div>
                    <div>
                      <span className="font-mono text-[10px] font-bold text-primary">{asset.assetTag}</span>
                      <h4 className="text-xs font-bold text-foreground line-clamp-1">{asset.name}</h4>
                    </div>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                      asset.status === "In Service"
                        ? "bg-moss/15 text-moss"
                        : "bg-warning/15 text-warning"
                    }`}
                  >
                    {asset.status}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-[11px] text-muted-foreground font-mono">
                  <div className="flex justify-between">
                    <span>Class:</span>
                    <strong className="text-foreground">{asset.assetClass}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Serial:</span>
                    <span className="text-foreground">{asset.serialNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Custodian:</span>
                    <span className="font-sans text-foreground">{asset.custodian} ({asset.department})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Next Cal Due:</span>
                    <span className="text-foreground">{asset.nextCalibrationDue}</span>
                  </div>
                </div>

                <div className="mt-3 border-t border-border pt-2 text-[10px] text-muted-foreground">
                  <span>Compatible with {asset.compatiblePartNumbers.length} parts/harnesses</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: STOCK MOVEMENT & AUDIT LOG
         ========================================================================= */}
      {activeTab === "audit" && (
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Immutable Stock Movement & Transaction Log</h3>
              <p className="text-xs text-muted-foreground">
                Traceable receipts, issues, adjustments, and quality quarantine events with actor timestamps.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-secondary/50 font-mono text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-3 py-2.5">Component / Part</th>
                  <th className="px-3 py-2.5">Action Reason</th>
                  <th className="px-3 py-2.5 text-right">Quantity Change</th>
                  <th className="px-3 py-2.5">Actor</th>
                  <th className="px-4 py-2.5">Audit Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {localMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-2 text-muted-foreground">{mov.at}</td>
                    <td className="px-3 py-2 font-bold text-foreground">{mov.partNumber || mov.inventoryItemId}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 font-bold text-[10px] ${
                          mov.reason === "Receipt"
                            ? "bg-moss/15 text-moss"
                            : mov.reason === "Issue"
                            ? "bg-primary/15 text-primary"
                            : mov.reason === "Return"
                            ? "bg-cyan-500/15 text-cyan-500"
                            : "bg-warning/15 text-warning"
                        }`}
                      >
                        {mov.reason}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${mov.change >= 0 ? "text-moss" : "text-primary"}`}>
                      {mov.change > 0 ? `+${mov.change}` : mov.change}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">{mov.actor}</td>
                    <td className="px-4 py-2 font-sans text-muted-foreground">{mov.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: MATERIAL ISSUE TO PROJECT TEAM
         ========================================================================= */}
      {issueModalItem && (
        <div role="dialog" aria-modal="true" aria-label="Issue Component to Active Project Team" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <UserPlus className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Issue Component to Active Project Team</h3>
                  <span className="font-mono text-xs text-muted-foreground">{issueModalItem.partNumber}</span>
                </div>
              </div>
              <button onClick={() => setIssueModalItem(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {issueError && (
                <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{issueError}</span>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Select Linked Project</span>
                  <select
                    value={issueProject}
                    onChange={(e) => setIssueProject(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-xs"
                  >
                    <option value="HLPL-AI4T-01">HLPL-AI4T-01 · Tata Ace EV 4G Gateway</option>
                    <option value="HLPL-SLCT-01">HLPL-SLCT-01 · Select Motors Gateway</option>
                    <option value="HLPL-XLINK-03">HLPL-XLINK-03 · Heavy CV Gateway</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Project Team Recipient (Validated)</span>
                  <select
                    value={issueRecipient}
                    onChange={(e) => setIssueRecipient(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  >
                    {eligibleRoster.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name} ({m.department} · {m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Quantity to Issue</span>
                  <input
                    type="number"
                    min="1"
                    max={getAvailable(issueModalItem)}
                    value={issueQuantity}
                    onChange={(e) => setIssueQuantity(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-xs"
                  />
                  <span className="mt-1 block font-mono text-[10px] text-moss">
                    Released Available: {getAvailable(issueModalItem)} {issueModalItem.unit}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Issuance Purpose</span>
                  <input
                    type="text"
                    value={issuePurpose}
                    onChange={(e) => setIssuePurpose(e.target.value)}
                    placeholder="e.g. SMT Line 2 Pilot Build Bring-Up"
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <span className="font-mono text-[10px] uppercase text-muted-foreground">Governance Verification:</span>
                <p className="mt-0.5 text-[11px] text-foreground">
                  Recipient is guaranteed an active team member of project <strong>{issueProject}</strong>. Materials issued will be tracked in the immutable project log.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setIssueModalItem(null)}
                className="h-8 rounded-lg border border-border bg-card px-3 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteIssue}
                className="h-8 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Confirm & Issue Material
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: RETURN MATERIAL DISPOSITION
         ========================================================================= */}
      {returnModalAssignment && (
        <div role="dialog" aria-modal="true" aria-label="Return Material to Stores" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">Return Material to Stores</h3>
              <button onClick={() => setReturnModalAssignment(null)} className="text-xs text-muted-foreground">✕</button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Part & Recipient</span>
                <p className="font-mono font-bold text-foreground">
                  {returnModalAssignment.partNumber || returnModalAssignment.inventoryItemId}
                </p>
                <span className="text-muted-foreground">Currently held by {returnModalAssignment.assignee} ({returnModalAssignment.quantity} pcs)</span>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Return Quantity</span>
                <input
                  type="number"
                  min="1"
                  max={returnModalAssignment.quantity}
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-xs"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Quality Disposition</span>
                <select
                  value={returnDisposition}
                  onChange={(e) => setReturnDisposition(e.target.value as any)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="Usable Stock">Return directly to Released Usable Stock</option>
                  <option value="Quality Quarantine">Send to Quality Quarantine / Inspection First</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Return Note</span>
                <input
                  type="text"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="e.g. Unused excess from prototype harness test"
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setReturnModalAssignment(null)} className="h-8 rounded border border-border px-3 text-xs">Cancel</button>
              <button onClick={handleExecuteReturn} className="h-8 rounded bg-primary px-4 text-xs font-semibold text-primary-foreground">Accept Return</button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: GOODS RECEIVED NOTE (GRN) ENTRY
         ========================================================================= */}
      {grnModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Process Goods Received Note (GRN) & IQC" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Process Goods Received Note (GRN) & IQC</h3>
              </div>
              <button onClick={() => setGrnModalOpen(false)} className="text-xs text-muted-foreground">✕</button>
            </div>

            <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Select Component / Part</span>
                <select
                  value={grnPartId}
                  onChange={(e) => setGrnPartId(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-2 text-xs font-mono"
                >
                  {localItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.partNumber} · {item.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">PO Number Reference</span>
                <input
                  type="text"
                  value={grnPoNumber}
                  onChange={(e) => setGrnPoNumber(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 text-xs font-mono"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Supplier Name</span>
                <input
                  type="text"
                  value={grnSupplier}
                  onChange={(e) => setGrnSupplier(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 text-xs"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Supplier Invoice / Challan</span>
                <input
                  type="text"
                  value={grnInvoice}
                  onChange={(e) => setGrnInvoice(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 text-xs font-mono"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Lot / Batch Number</span>
                <input
                  type="text"
                  value={grnLot}
                  onChange={(e) => setGrnLot(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 text-xs font-mono"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Date Code (YYWW)</span>
                <input
                  type="text"
                  value={grnDateCode}
                  onChange={(e) => setGrnDateCode(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 text-xs font-mono"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Received Quantity</span>
                <input
                  type="number"
                  min="1"
                  value={grnQtyReceived}
                  onChange={(e) => setGrnQtyReceived(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 text-xs font-mono"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Incoming Quality Inspection (IQC)</span>
                <select
                  value={grnDisposition}
                  onChange={(e) => setGrnDisposition(e.target.value as any)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-2 text-xs"
                >
                  <option value="Accepted & Released">Pass IQC (Add to Released Stock Immediately)</option>
                  <option value="Pending IQC">Hold in Quarantine (Awaiting IQC Lab Approval)</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setGrnModalOpen(false)} className="h-8 rounded border border-border px-3 text-xs">Cancel</button>
              <button onClick={handleExecuteGRN} className="h-8 rounded bg-primary px-4 text-xs font-semibold text-primary-foreground">Save GRN & Update Stock</button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: DETAILED PART INSPECTION & SPECIFICATION VIEW
         ========================================================================= */}
      {detailItem && (
        <div role="dialog" aria-modal="true" aria-label="Part Specifications and Stock Inspection" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                    {detailItem.category}
                  </span>
                  {detailItem.subcategory && (
                    <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {detailItem.subcategory}
                    </span>
                  )}
                  {detailItem.automotiveQualified && (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-500 border border-emerald-500/30">
                      <ShieldCheck className="size-3" />
                      <span>{detailItem.automotiveStandard || "AEC-Q100"}</span>
                    </span>
                  )}
                </div>
                <h3 className="mt-1 font-mono text-lg font-bold text-foreground">{detailItem.partNumber}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{detailItem.description}</p>
              </div>
              <button onClick={() => setDetailItem(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>

            {/* Modal Quick Links Banner */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 p-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Distributor & Docs:
                </span>
                {detailItem.mouserPartNumber && (
                  <span className="font-mono text-[11px] font-semibold text-foreground">
                    Mouser #{detailItem.mouserPartNumber}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {detailItem.mouserUrl && (
                  <a
                    href={detailItem.mouserUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                  >
                    <ShoppingCart className="size-3" />
                    <span>View on Mouser.com ↗</span>
                  </a>
                )}
                {detailItem.datasheetUrl && (
                  <a
                    href={detailItem.datasheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-blue-500 border border-blue-500/30 hover:bg-blue-500/25 transition-colors"
                  >
                    <FileText className="size-3" />
                    <span>Datasheet PDF ↗</span>
                  </a>
                )}
              </div>
            </div>

            {/* Modal Section Tabs */}
            <div className="mt-4 flex border-b border-border bg-card/50">
              {[
                { id: "overview", label: "📋 Overview & Stock" },
                { id: "ehw", label: "⚡ EHW Technical" },
                { id: "pur", label: "💰 PUR Commercial" },
                { id: "mech", label: "📐 MECH Physical" },
                { id: "trace", label: "🔗 Traceability" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailTab(t.id as typeof detailTab)}
                  className={`border-b-2 px-3.5 py-2 font-mono text-xs font-semibold transition-colors ${
                    detailTab === t.id
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Overview */}
            {detailTab === "overview" && (
              <div className="mt-4 space-y-4 text-xs">
                {/* Stock Overview Banner */}
                <div className="grid grid-cols-4 gap-2 rounded-xl border border-border bg-secondary/30 p-3 text-center font-mono">
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground">On-Hand Total</span>
                    <p className="text-base font-bold text-foreground">{detailItem.onHand} {detailItem.unit}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-moss">Released Stock</span>
                    <p className="text-base font-bold text-moss">{getReleased(detailItem)} {detailItem.unit}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-warning">Held in IQC</span>
                    <p className="text-base font-bold text-warning">{getHeld(detailItem)} {detailItem.unit}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-steel">Allocated</span>
                    <p className="text-base font-bold text-steel">{detailItem.allocated} {detailItem.unit}</p>
                  </div>
                </div>

                {/* Storage & Reorder Metadata */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-card p-3 font-mono space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Facility & Storage</span>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-semibold text-foreground">{detailItem.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bin Coordinate:</span>
                      <span className="font-semibold text-foreground">{detailItem.bin}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reorder Buffer:</span>
                      <span className="font-semibold text-foreground">{detailItem.reorderPoint} {detailItem.unit}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3 font-mono space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Procurement & Manufacturer</span>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Manufacturer:</span>
                      <span className="font-semibold text-foreground">{detailItem.manufacturer || "HLPL Approved"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Package / Case:</span>
                      <span className="font-semibold text-foreground">{detailItem.packageCase || "Standard SMD"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Primary Supplier:</span>
                      <span className="font-semibold text-foreground">{detailItem.supplier || "Mouser Electronics"}</span>
                    </div>
                  </div>
                </div>

                {/* Linked Projects */}
                <div>
                  <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">Linked Automotive Projects</h4>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 font-mono text-[11px]">
                    {detailItem.linkedProjects && detailItem.linkedProjects.length > 0 ? (
                      detailItem.linkedProjects.map((p) => (
                        <span key={p} className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">Universal Standard Component</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: EHW Technical */}
            {detailTab === "ehw" && (
              <div className="mt-4 space-y-4 text-xs font-mono">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <span className="text-[10px] font-bold uppercase text-amber-500 flex items-center gap-1">
                      <Zap className="size-3" /> Electrical Operating Limits
                    </span>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">Operating Voltage:</span>
                      <span className="font-bold text-foreground">{detailItem.voltageRating || "3.3V / 5.0V Logic"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">Operating Current:</span>
                      <span className="font-bold text-foreground">{detailItem.currentRating || "Standard"}</span>
                    </div>
                    {detailItem.frequencyClock && (
                      <div className="flex justify-between border-b border-border/40 pb-1">
                        <span className="text-muted-foreground">Clock / Frequency:</span>
                        <span className="font-bold text-foreground">{detailItem.frequencyClock}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Operating Temp Range:</span>
                      <span className="font-bold text-foreground">{detailItem.operatingTempRange || "-40°C to +125°C"}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <span className="text-[10px] font-bold uppercase text-emerald-500 flex items-center gap-1">
                      <ShieldCheck className="size-3" /> Compliance & Automotive Qualification
                    </span>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">Automotive Graded:</span>
                      <span className={`font-bold ${detailItem.automotiveQualified ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {detailItem.automotiveQualified ? "YES · Qualified" : "Industrial Grade"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">Governing Standard:</span>
                      <span className="font-bold text-foreground">{detailItem.automotiveStandard || "AEC-Q100 / ISO 7637-2"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RoHS / Environmental:</span>
                      <span className="font-bold text-emerald-500">{detailItem.rohsStatus || "RoHS Compliant / Lead Free"}</span>
                    </div>
                  </div>
                </div>

                {/* Technical Specifications Dictionary */}
                {detailItem.specifications && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detailed Engineering Specifications</h4>
                    <div className="mt-1.5 grid gap-1.5 rounded-lg border border-border bg-card p-3 text-[11px]">
                      {Object.entries(detailItem.specifications).map(([key, val]) => (
                        <div key={key} className="flex justify-between border-b border-border/40 pb-1 last:border-b-0 last:pb-0">
                          <span className="text-muted-foreground">{key}:</span>
                          <span className="font-semibold text-foreground">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: PUR Commercial */}
            {detailTab === "pur" && (
              <div className="mt-4 space-y-4 text-xs font-mono">
                {/* Cost & Lead Time Grid */}
                <div className="grid grid-cols-4 gap-2 rounded-xl border border-border bg-secondary/30 p-3 text-center">
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground">Tentative Cost (USD)</span>
                    <p className="text-base font-bold text-foreground">
                      ${(detailItem.tentativeUnitCostUsd ?? 2.50).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-emerald-500">Tentative Cost (INR)</span>
                    <p className="text-base font-bold text-emerald-500">
                      ₹{(detailItem.tentativeUnitCostInr ?? Math.round((detailItem.tentativeUnitCostUsd ?? 2.50) * 83.5)).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-foreground">Factory Lead Time</span>
                    <p className="text-base font-bold text-foreground">
                      {detailItem.leadTimeWeeks ?? 6} Weeks
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground">Mouser Distributor Stock</span>
                    <p className="text-base font-bold text-foreground">
                      {(detailItem.mouserStock ?? 12500).toLocaleString()} pcs
                    </p>
                  </div>
                </div>

                {/* Volume Pricing Tiers */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Volume Pricing Breaks (Mouser Verified)</h4>
                  <table className="mt-1.5 w-full text-left border rounded-lg overflow-hidden border-border bg-card text-[11px]">
                    <thead className="border-b border-border bg-secondary/50 text-[10px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Quantity Break</th>
                        <th className="px-3 py-2 font-mono">Unit Price (USD)</th>
                        <th className="px-3 py-2 font-mono">Unit Price (INR)</th>
                        <th className="px-3 py-2">Discount vs. Sample</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {(detailItem.priceBreaks || [
                        { qty: 1, unitPriceUsd: (detailItem.tentativeUnitCostUsd ?? 2.5) * 1.35, unitPriceInr: Math.round((detailItem.tentativeUnitCostUsd ?? 2.5) * 1.35 * 83.5) },
                        { qty: 100, unitPriceUsd: (detailItem.tentativeUnitCostUsd ?? 2.5) * 1.15, unitPriceInr: Math.round((detailItem.tentativeUnitCostUsd ?? 2.5) * 1.15 * 83.5) },
                        { qty: 1000, unitPriceUsd: detailItem.tentativeUnitCostUsd ?? 2.5, unitPriceInr: Math.round((detailItem.tentativeUnitCostUsd ?? 2.5) * 83.5) },
                        { qty: 10000, unitPriceUsd: (detailItem.tentativeUnitCostUsd ?? 2.5) * 0.88, unitPriceInr: Math.round((detailItem.tentativeUnitCostUsd ?? 2.5) * 0.88 * 83.5) },
                      ]).map((brk, idx) => (
                        <tr key={brk.qty} className="hover:bg-secondary/30">
                          <td className="px-3 py-1.5 font-bold">{brk.qty.toLocaleString()}+ pcs</td>
                          <td className="px-3 py-1.5 font-bold text-foreground">${brk.unitPriceUsd.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-emerald-500 font-semibold">₹{brk.unitPriceInr.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {idx === 0 ? "Base price" : `${Math.round((1 - brk.unitPriceUsd / ((detailItem.priceBreaks?.[0]?.unitPriceUsd) || (detailItem.tentativeUnitCostUsd ?? 2.5) * 1.35)) * 100)}% savings`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Sales Volume Coverage Estimation */}
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Sales Volume Coverage (Project HLPL-AI4T-01)</span>
                      <p className="mt-0.5 text-xs text-foreground font-semibold">
                        Target Requirement: 50,000 units/year · Released Stock: {getReleased(detailItem).toLocaleString()} {detailItem.unit}
                      </p>
                    </div>
                    <span className="font-bold text-base text-primary">
                      {Math.min(100, Math.round((getReleased(detailItem) / 50000) * 100))}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.max(5, Math.min(100, Math.round((getReleased(detailItem) / 50000) * 100)))}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: MECH Physical */}
            {detailTab === "mech" && (
              <div className="mt-4 space-y-4 text-xs font-mono">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <span className="text-[10px] font-bold uppercase text-blue-500 flex items-center gap-1">
                      <Ruler className="size-3" /> Geometry & Physical Dimensions
                    </span>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">Dimensions (L×W×H):</span>
                      <span className="font-bold text-foreground">{detailItem.dimensionsMm || "10.0 × 10.0 × 2.0 mm"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">Weight / Mass:</span>
                      <span className="font-bold text-foreground">{detailItem.weightGrams ?? 0.85} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Package / Case:</span>
                      <span className="font-bold text-foreground">{detailItem.packageCase || "Standard"}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <span className="text-[10px] font-bold uppercase text-cyan-500 flex items-center gap-1">
                      <Wrench className="size-3" /> Harness & Enclosure Interface
                    </span>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">Ingress Protection:</span>
                      <span className="font-bold text-cyan-500">{detailItem.ipRating || "IP67 Rated"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">Wire Gauge:</span>
                      <span className="font-bold text-foreground">{detailItem.wireGauge || "FLRY-B 0.50mm²"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mating Retention Force:</span>
                      <span className="font-bold text-foreground">{detailItem.matingForce || "75N retention lock"}</span>
                    </div>
                  </div>
                </div>

                {/* Compatible Production Machinery */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Compatible Manufacturing Assets & Machinery</h4>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {detailItem.compatibleAssetIds && detailItem.compatibleAssetIds.length > 0 ? (
                      detailItem.compatibleAssetIds.map((astId) => {
                        const ast = assetList.find((a) => a.id === astId);
                        return (
                          <div key={astId} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5">
                            <Wrench className="size-4 text-steel" />
                            <div>
                              <strong className="block text-foreground">{ast?.name || astId}</strong>
                              <span className="text-[10px] text-muted-foreground">{ast?.subclass} · {ast?.facilityLocation}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-muted-foreground">Standard manual assembly & rework station</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Traceability */}
            {detailTab === "trace" && (
              <div className="mt-4 space-y-4 text-xs font-mono">
                {/* Dual-Source Substitutes */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approved Dual-Source Alternates</h4>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {detailItem.substitutes && detailItem.substitutes.length > 0 ? (
                      detailItem.substitutes.map((sub) => (
                        <span key={sub} className="rounded border border-border bg-secondary px-2 py-0.5 font-bold text-foreground">
                          {sub}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">Single source qualified. Dual-sourcing review in progress with PUR lead.</span>
                    )}
                  </div>
                </div>

                {/* Active Project Allocations */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Project Team Allocations</h4>
                  <div className="mt-1.5 divide-y divide-border/60 rounded-lg border border-border bg-card overflow-hidden">
                    {localAssignments.filter((a) => a.inventoryItemId === detailItem.id || a.partNumber === detailItem.partNumber).length > 0 ? (
                      localAssignments
                        .filter((a) => a.inventoryItemId === detailItem.id || a.partNumber === detailItem.partNumber)
                        .map((asg) => (
                          <div key={asg.id} className="flex items-center justify-between p-2.5 hover:bg-secondary/30">
                            <div>
                              <strong className="text-foreground">{asg.assignee} ({asg.department})</strong>
                              <span className="block text-[10px] text-muted-foreground">
                                Project: {asg.project} · {asg.note} · Assigned: {asg.assignedAt}
                              </span>
                            </div>
                            <span className="font-bold text-primary">{asg.quantity} {detailItem.unit}</span>
                          </div>
                        ))
                    ) : (
                      <div className="p-3 text-muted-foreground">No active allocations currently issued for this part.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setDetailItem(null)} className="h-8 rounded bg-secondary px-4 text-xs font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: DETAILED ASSET INSPECTION & CUSTODY VIEW
         ========================================================================= */}
      {detailAsset && (
        <div role="dialog" aria-modal="true" aria-label="Asset Details and Calibration Record" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-primary">{detailAsset.assetTag}</span>
                <h3 className="text-sm font-bold text-foreground">{detailAsset.name}</h3>
                <span className="text-xs text-muted-foreground">{detailAsset.subclass}</span>
              </div>
              <button onClick={() => setDetailAsset(null)} className="text-xs text-muted-foreground">✕</button>
            </div>

            <div className="mt-4 space-y-3 text-xs font-mono">
              <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Asset Class:</span>
                  <span className="font-bold text-foreground">{detailAsset.assetClass}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serial Number:</span>
                  <span className="text-foreground">{detailAsset.serialNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Facility Location:</span>
                  <span className="text-foreground">{detailAsset.facilityLocation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custodian:</span>
                  <span className="text-foreground">{detailAsset.custodian} ({detailAsset.department})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next Calibration Due:</span>
                  <span className="text-moss font-bold">{detailAsset.nextCalibrationDue}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase text-muted-foreground">Compatible Components & Harnesses:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {detailAsset.compatiblePartNumbers.map((part) => (
                    <span key={part} className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary text-[10px]">
                      {part}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-border pt-4">
              <button onClick={() => setDetailAsset(null)} className="h-8 rounded bg-secondary px-4 text-xs font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: REGISTER NEW CONTROLLED PART WITH MOUSER INTELLIGENCE
         ========================================================================= */}
      {addPartModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Register New Controlled Part / Assembly" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded bg-primary/10 text-primary">
                  <Plus className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Register New Controlled Part / Assembly</h3>
                  <span className="font-mono text-[10px] text-muted-foreground">Mouser Intelligence & Automotive Specification Auto-Fill</span>
                </div>
              </div>
              <button onClick={() => setAddPartModalOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>

            {/* 1. Mouser Electronics Auto-Fetch Section */}
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-primary uppercase tracking-wide">
                  <Zap className="size-3.5" /> Mouser Electronics Component Auto-Fill
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMouserApiKeyInput(getMouserApiKey());
                      setApiKeyModalOpen(true);
                    }}
                    className="flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold text-primary hover:bg-primary/20 transition-colors"
                    title="Configure / Enter Mouser Search API Key"
                  >
                    <Key className="size-2.5" />
                    <span>{getMouserApiKey() ? "API Key Configured ✓" : "Enter API Key"}</span>
                  </button>
                  <span className="rounded bg-primary/20 px-2 py-0.2 font-mono text-[9px] font-bold text-primary">
                    LIVE API / CATALOG LOOKUP
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter any Manufacturer Part Number (MPN). Auto-fetches technical specs (voltage, current, AEC-Q), tentative pricing ($ & ₹), lead time, distributor stock, datasheet URL, and controlled category.
              </p>

              {/* MPN Input and Fetch Button */}
              <div className="mt-2.5 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={mouserSearchQuery}
                    onChange={(e) => setMouserSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleFetchMouser();
                      }
                    }}
                    placeholder="Enter MPN (e.g. STM32G0B1VCT6, EG915N-EU, TCAN1042VDRQ1)..."
                    className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 font-mono text-xs uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleFetchMouser()}
                  disabled={mouserLoading}
                  className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 font-mono text-xs font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {mouserLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="size-3.5" />
                      <span>Fetch from Mouser</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Suggestion Pills */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">Quick Suggestions:</span>
                {[
                  { label: "STM32 MCU", mpn: "STM32G0B1VCT6" },
                  { label: "Quectel 4G Modem", mpn: "EG915N-EU" },
                  { label: "TI Buck Reg", mpn: "LMR14050SDDAR" },
                  { label: "Vishay TVS", mpn: "SM5S24A-E3/2D" },
                  { label: "CAN Transceiver", mpn: "TCAN1042VDRQ1" },
                  { label: "Molex 16P Conn", mpn: "MX150-33472-1601" },
                  { label: "OBD-II Harness", mpn: "HLPL-HARN-OBD2-16P" },
                ].map((s) => (
                  <button
                    key={s.mpn}
                    type="button"
                    onClick={() => {
                      setMouserSearchQuery(s.mpn);
                      handleFetchMouser(s.mpn);
                    }}
                    className="rounded bg-background/80 px-2 py-0.5 font-mono text-[10px] text-foreground border border-border hover:border-primary hover:text-primary transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Success Notification */}
              {mouserSuccessMessage && (
                <div className="mt-2.5 flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 font-mono text-[11px] text-emerald-500">
                  <div className="flex items-center gap-1.5">
                    <Check className="size-3.5 shrink-0" />
                    <span>{mouserSuccessMessage}</span>
                  </div>
                  {newPartDatasheetUrl && (
                    <a
                      href={newPartDatasheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 flex items-center gap-1 underline hover:text-emerald-400"
                    >
                      <FileText className="size-3" />
                      <span>Datasheet ↗</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* 2. Controlled Part Specifications Form */}
            <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Part Number (MPN / Internal)</span>
                <input
                  type="text"
                  placeholder="e.g. STM32G0B1VCT6"
                  value={newPartNum}
                  onChange={(e) => setNewPartNum(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 font-mono text-xs uppercase"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Controlled Category (Auto-Selected)</span>
                <select
                  value={newPartCat}
                  onChange={(e) => setNewPartCat(e.target.value as InventoryCategory)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-2 text-xs font-semibold"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Connectors">Connectors</option>
                  <option value="Wire and Cable">Wire and Cable</option>
                  <option value="Wire Harnesses">Wire Harnesses</option>
                  <option value="Mechanical Parts">Mechanical Parts</option>
                  <option value="Enclosures">Enclosures</option>
                  <option value="Firmware Tools">Firmware Tools</option>
                  <option value="Production Tools">Production Tools</option>
                  <option value="Packaging & Consumables">Packaging & Consumables</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Technical Description</span>
                <input
                  type="text"
                  placeholder="e.g. Main Host MCU, ARM Cortex-M0+ 64MHz, 512KB Flash, dual CAN FD"
                  value={newPartDesc}
                  onChange={(e) => setNewPartDesc(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 text-xs"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Subcategory / Family</span>
                <input
                  type="text"
                  placeholder="e.g. Microcontrollers & MCUs"
                  value={newPartSubcat}
                  onChange={(e) => setNewPartSubcat(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 text-xs"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Manufacturer / Brand</span>
                <input
                  type="text"
                  placeholder="e.g. STMicroelectronics"
                  value={newPartMfr}
                  onChange={(e) => setNewPartMfr(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 text-xs"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Package / Case Footprint</span>
                <input
                  type="text"
                  placeholder="e.g. LQFP-100 (14x14mm)"
                  value={newPartPackage}
                  onChange={(e) => setNewPartPackage(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 font-mono text-xs"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Primary Supplier</span>
                <input
                  type="text"
                  placeholder="e.g. Mouser Electronics"
                  value={newPartSupplier}
                  onChange={(e) => setNewPartSupplier(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 font-mono text-xs"
                />
              </div>

              {/* Commercial Parameters */}
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Tentative Unit Cost (USD $ / INR ₹)</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="USD $"
                    value={newPartCostUsd !== undefined ? newPartCostUsd : ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewPartCostUsd(isNaN(val) ? undefined : val);
                      if (!isNaN(val)) setNewPartCostInr(Math.round(val * 83.5 * 100) / 100);
                    }}
                    className="mt-1 h-9 w-1/2 rounded border border-input bg-background px-2 font-mono text-xs"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="INR ₹"
                    value={newPartCostInr !== undefined ? newPartCostInr : ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewPartCostInr(isNaN(val) ? undefined : val);
                    }}
                    className="mt-1 h-9 w-1/2 rounded border border-input bg-background px-2 font-mono text-xs text-emerald-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Factory Lead Time (Weeks)</span>
                <input
                  type="number"
                  placeholder="e.g. 8"
                  value={newPartLeadWeeks !== undefined ? newPartLeadWeeks : ""}
                  onChange={(e) => setNewPartLeadWeeks(parseInt(e.target.value, 10) || undefined)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 font-mono text-xs"
                />
              </div>

              {/* Hardware Electrical Specs */}
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Operating Voltage Rating</span>
                <input
                  type="text"
                  placeholder="e.g. 2.0V - 3.6V (3.3V nominal)"
                  value={newPartVoltage}
                  onChange={(e) => setNewPartVoltage(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 font-mono text-xs"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Operating Current</span>
                <input
                  type="text"
                  placeholder="e.g. 45mA Active / 1.8µA Standby"
                  value={newPartCurrent}
                  onChange={(e) => setNewPartCurrent(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 font-mono text-xs"
                />
              </div>

              {/* Automotive Qualification */}
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Automotive Qualification Standard</span>
                <input
                  type="text"
                  placeholder="e.g. AEC-Q100 Grade 1 (-40°C to +125°C)"
                  value={newPartAutoStd}
                  onChange={(e) => {
                    setNewPartAutoStd(e.target.value);
                    if (e.target.value) setNewPartAutoGraded(true);
                  }}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 font-mono text-xs"
                />
              </div>

              {/* Mechanical Specs */}
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Dimensions (L×W×H mm)</span>
                <input
                  type="text"
                  placeholder="e.g. 14.0 × 14.0 × 1.4 mm"
                  value={newPartDimensions}
                  onChange={(e) => setNewPartDimensions(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-3 font-mono text-xs"
                />
              </div>

              {/* Storage & Reorder */}
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Storage Location & Bin</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPartLoc}
                    onChange={(e) => setNewPartLoc(e.target.value)}
                    className="mt-1 h-9 w-2/3 rounded border border-input bg-background px-2 text-xs"
                  />
                  <input
                    type="text"
                    value={newPartBin}
                    onChange={(e) => setNewPartBin(e.target.value)}
                    className="mt-1 h-9 w-1/3 rounded border border-input bg-background px-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Reorder Buffer & Unit</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newPartReorder}
                    onChange={(e) => setNewPartReorder(e.target.value)}
                    className="mt-1 h-9 w-2/3 rounded border border-input bg-background px-2 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={newPartUnit}
                    onChange={(e) => setNewPartUnit(e.target.value)}
                    className="mt-1 h-9 w-1/3 rounded border border-input bg-background px-2 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setAddPartModalOpen(false)}
                className="h-8 rounded border border-border px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePart}
                className="h-8 rounded bg-primary px-4 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
              >
                Save Component
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mouser API Key Configuration Modal */}
      {apiKeyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Configure Mouser Search API Key"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm font-mono"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Key className="size-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Configure Mouser Search API Key</h3>
              </div>
              <button onClick={() => setApiKeyModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <p className="text-muted-foreground">
                Enter your official Mouser Search API v1 Key. When configured, live component specs, real-time distributor pricing, and stock levels are queried over the REST API.
              </p>
              <div>
                <label className="font-bold text-[10px] uppercase text-muted-foreground">Mouser API Key</label>
                <input
                  type="text"
                  value={mouserApiKeyInput}
                  onChange={(e) => setMouserApiKeyInput(e.target.value)}
                  placeholder="e.g. 78f8b39c-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="rounded-lg bg-secondary/50 p-2 text-[10px] text-muted-foreground">
                Status: {mouserApiKeyInput.trim() ? "Live REST API Calls Enabled" : "Using Verified Automotive Master Catalog (Offline Safe)"}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setApiKeyModalOpen(false)} className="h-8 rounded border border-border px-3 text-xs">Cancel</button>
              <button
                onClick={() => {
                  setMouserApiKey(mouserApiKeyInput);
                  setApiKeyModalOpen(false);
                }}
                className="h-8 rounded bg-primary px-4 text-xs font-bold text-primary-foreground shadow"
              >
                Save API Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IQC Quality Release & Lot Disposition Modal */}
      {iqcModalGrn && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm font-sans"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">Execute IQC Quality Disposition & Lot Release</h3>
                  <p className="text-[11px] text-muted-foreground">IATF 16949 §8.6 & ISO 9001 §8.4 Receiving Inspection Release Gate</p>
                </div>
              </div>
              <button onClick={() => setIqcModalGrn(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="mt-4 space-y-3 text-xs font-mono">
              <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Part Number:</span>
                  <strong className="text-foreground">{iqcModalGrn.partNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GRN / PO Ref:</span>
                  <span className="text-foreground">{iqcModalGrn.grnNumber} ({iqcModalGrn.poNumber})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-sans text-foreground">{iqcModalGrn.supplier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lot / Date Code:</span>
                  <span className="text-foreground">{iqcModalGrn.lotNumber} (DC: {iqcModalGrn.dateCode})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Inward Qty:</span>
                  <strong className="text-primary">{iqcModalGrn.quantityReceived.toLocaleString()} pcs</strong>
                </div>
              </div>

              <div className="space-y-3 font-sans pt-1">
                <div>
                  <label className="font-semibold text-foreground">Quantity to Accept & Release to Active Stock</label>
                  <input
                    type="number"
                    value={iqcAcceptedQty}
                    max={iqcModalGrn.quantityReceived}
                    onChange={(e) => setIqcAcceptedQty(parseInt(e.target.value) || 0)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-xs font-bold text-foreground"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Remaining {Math.max(0, iqcModalGrn.quantityReceived - iqcAcceptedQty)} pcs will stay quarantined in IQC hold.
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-foreground">Inspection Report Reference ID</label>
                  <input
                    type="text"
                    value={iqcReportRef}
                    onChange={(e) => setIqcReportRef(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-xs text-foreground"
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground">Authorized Quality Inspector</label>
                  <input
                    type="text"
                    value={iqcInspector}
                    onChange={(e) => setIqcInspector(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground"
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground">Inspection Finding & Disposition Note</label>
                  <textarea
                    rows={2}
                    value={iqcNote}
                    onChange={(e) => setIqcNote(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs text-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setIqcModalGrn(null)} className="h-8 rounded border border-border px-3 text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={handleExecuteIQCDisposition}
                className="h-8 rounded bg-emerald-600 px-4 text-xs font-bold text-white shadow hover:bg-emerald-700"
              >
                Confirm Quality Release & Update Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Asset CSV Import Modal */}
      {bulkAssetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm font-sans"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-primary" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">Bulk Asset Register Ingestion (CSV / Excel)</h3>
                  <p className="text-[11px] text-muted-foreground">Production Machinery, IMTE Calibration Jigs & Service Fixtures</p>
                </div>
              </div>
              <button onClick={() => setBulkAssetModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">CSV Text or Paste:</span>
                <button
                  type="button"
                  onClick={() => {
                    const sample = `Asset Tag,Name,Class,Subclass,Serial Number,Facility Location,Custodian,Department,Next Calibration Due
HLPL-AST-SMT-004,Nordson Dage Quadra 5 3D X-Ray Inspection Machine,Production Machinery,SMT Surface Mount Line 2,XRAY-DAGE-9018,Greater Noida SMT Plant 2 · Bay 2,Casey Rowan,EMF,2027-02-15
HLPL-AST-JIG-003,AIS-140 Automated End-of-Line Verification Jig,Testing & Calibration Jigs,EOL Production Jigs,EOL-JIG-140-03,Noida Tech Center · Testing Bay,Mina Cross,TST,2026-12-10
HLPL-AST-IMTE-002,Mitutoyo 500-196-30 Digital Vernier Caliper 150mm,Tools & Instruments,Mechanical QA Inspection,MIT-VC-88412,Noida Tech Center · QA Lab,Samira Holt,MECH,2026-11-20
HLPL-AST-SMT-005,Heller 1809 MK5 10-Zone Forced Air Convection Reflow Oven,Production Machinery,SMT Surface Mount Line 2,HLR-1809-5512,Greater Noida SMT Plant 2 · Bay 2,Casey Rowan,EMF,2027-05-30`;
                    setRawAssetCsvText(sample);
                    handleParseBulkAssetCsv(sample);
                  }}
                  className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20"
                >
                  📋 Load Sample Machinery & Jigs
                </button>
              </div>

              <textarea
                rows={5}
                value={rawAssetCsvText}
                onChange={(e) => {
                  setRawAssetCsvText(e.target.value);
                  handleParseBulkAssetCsv(e.target.value);
                }}
                placeholder="Asset Tag,Name,Class,Subclass,Serial Number,Facility Location,Custodian,Department,Next Calibration Due..."
                className="w-full rounded-md border border-input bg-secondary/40 p-2.5 font-mono text-xs text-foreground focus:outline-none"
              />

              {/* Staged Review Preview Table */}
              {stagedBulkAssets.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-bold text-foreground">
                      Staged for Ingestion: {stagedBulkAssets.filter((a) => !a.duplicate).length} valid assets
                    </span>
                    {stagedBulkAssets.some((a) => a.duplicate) && (
                      <span className="font-bold text-rose-500">
                        {stagedBulkAssets.filter((a) => a.duplicate).length} duplicate(s) flagged
                      </span>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="border-b border-border bg-secondary/50 text-[10px] uppercase text-muted-foreground sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5">Tag</th>
                          <th className="px-2 py-1.5">Name</th>
                          <th className="px-2 py-1.5">Class</th>
                          <th className="px-2 py-1.5">Serial</th>
                          <th className="px-2 py-1.5">Custodian</th>
                          <th className="px-2 py-1.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 text-[11px]">
                        {stagedBulkAssets.map((asset, idx) => (
                          <tr key={idx} className={asset.duplicate ? "bg-rose-500/10 text-rose-600" : "hover:bg-secondary/30"}>
                            <td className="px-2 py-1 font-bold">{asset.assetTag}</td>
                            <td className="px-2 py-1 font-sans line-clamp-1">{asset.name}</td>
                            <td className="px-2 py-1">{asset.assetClass}</td>
                            <td className="px-2 py-1">{asset.serialNumber}</td>
                            <td className="px-2 py-1 font-sans">{asset.custodian}</td>
                            <td className="px-2 py-1">
                              {asset.duplicate ? (
                                <span className="font-bold text-rose-600">DUPLICATE</span>
                              ) : (
                                <span className="font-bold text-emerald-600">VALID ✓</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setBulkAssetModalOpen(false)} className="h-8 rounded border border-border px-3 text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={handleCommitBulkAssets}
                disabled={stagedBulkAssets.filter((a) => !a.duplicate).length === 0}
                className="h-8 rounded bg-primary px-4 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                Commit Staged Assets to Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

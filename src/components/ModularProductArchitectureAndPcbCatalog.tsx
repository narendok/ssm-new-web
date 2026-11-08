import { useState } from "react";
import {
  Cpu,
  Layers,
  Cable,
  Code2,
  Box,
  CheckCircle2,
  Zap,
  ArrowRight,
  Shield,
  Clock,
  Sparkles,
  Download,
  ExternalLink,
  Plus,
  Trash2,
  FileText,
  AlertCircle,
  Search,
  Check,
  Building2,
  Tag,
} from "lucide-react";

// =========================================================================
// 1. Types for Decoupled Platform Assets (Master Plan §5 & Platform Reuse)
// =========================================================================

export type PcbAsset = {
  id: string;
  code: string;
  title: string;
  revision: string;
  category: "Telematics Motherboard" | "Expansion / Daughterboard" | "Power SMPS Module" | "Sensor Hub";
  mcu: string;
  modem?: string;
  voltageRange: string;
  layerCount: number;
  dimensions: string;
  interfaces: string[];
  compliance: string[];
  fabricationSpec: string;
  schematicRef: string;
  gerberArchive: string;
  electronicBomItemCount: number;
  status: "Qualified & Active" | "Under Revision" | "Legacy";
  sampleLeadTimeWeeks: number;
  description: string;
};

export type HarnessAsset = {
  id: string;
  code: string;
  title: string;
  connectorType: string;
  pinCount: number;
  wireGauge: string;
  cableStandard: string;
  sealingRating: string;
  lengthMm: number;
  drawingRef: string;
  pinoutSummary: string[];
  applicableVehicles: string;
  status: "Qualified & Active" | "Tooling Available";
  sampleLeadTimeWeeks: number;
  description: string;
};

export type FirmwareAsset = {
  id: string;
  code: string;
  title: string;
  version: string;
  targetMcu: string;
  osKernel: string;
  supportedProtocols: string[];
  fotaCapability: string;
  tacCertified: boolean;
  binaryHash: string;
  status: "Pre-Certified" | "Active";
  developmentLeadTimeWeeks: number; // 0 if pre-certified
  description: string;
};

export type EnclosureAsset = {
  id: string;
  code: string;
  title: string;
  material: string;
  ingressRating: string;
  dimensions: string;
  mountingType: string;
  cadModelRef: string;
  toolingStatus: "Molds Active" | "Soft Tooling Ready";
  leadTimeWeeks: number;
  description: string;
};

export type ProjectModularConfiguration = {
  projectId: string;
  projectTitle: string;
  architectureMode: "reusable_platform" | "hybrid_variant" | "clean_sheet";
  selectedPcbIds: string[]; // Can have MULTIPLE PCBs per project!
  selectedHarnessId: string;
  selectedFirmwareId: string;
  selectedEnclosureId: string;
  customHarnessNotes?: string;
  customEnclosureNotes?: string;
  customFirmwareNotes?: string;
  lastUpdated: string;
  configuredBy: string;
};

// =========================================================================
// 2. Pre-Populated Master Platform Asset Catalog
// =========================================================================

export const defaultPcbCatalog: PcbAsset[] = [
  {
    id: "PCB-LIB-001",
    code: "HLPL-MOD-PCB-01",
    title: "4G Cat-1 AIS-140 Core Telematics Motherboard",
    revision: "Rev 03",
    category: "Telematics Motherboard",
    mcu: "STM32F405VGT6 (ARM Cortex-M4, 168MHz)",
    modem: "Quectel EC200U-CN (4G Cat-1 + GNSS)",
    voltageRange: "9V - 36V Automotive Transient Protected",
    layerCount: 4,
    dimensions: "98 x 62 mm",
    interfaces: ["CAN 2.0B / J1939 @ 250k/500k", "RS-232", "1-Wire iButton", "4x Opto-isolated DI", "2x 0-32V AI", "2x DO (Relay Drive)"],
    compliance: ["AIS-140 Annexure 8", "ISO 7637-2 (Pulse 1, 2a, 3a/b, 5b)", "AEC-Q100 Qualified ICs", "RoHS & REACH"],
    fabricationSpec: "4-Layer FR4, TG170, 1.6mm, ENIG Surface Finish, 1oz Copper",
    schematicRef: "HLPL-MOD-EHW-SCH-03",
    gerberArchive: "HLPL-MOD-PCB-01-REV03-GERBER.zip",
    electronicBomItemCount: 142,
    status: "Qualified & Active",
    sampleLeadTimeWeeks: 2,
    description: "Battle-tested automotive telematics engine. Deployed across 60,000+ commercial vehicles. Zero layout changes needed.",
  },
  {
    id: "PCB-LIB-002",
    code: "HLPL-MOD-PCB-02",
    title: "Dual CAN & OBD-II Commercial Vehicle Daughterboard",
    revision: "Rev 01",
    category: "Expansion / Daughterboard",
    mcu: "NXP TJA1051T High-Speed CAN Transceivers (Dual Channel)",
    voltageRange: "5V Internal Rail",
    layerCount: 2,
    dimensions: "60 x 45 mm",
    interfaces: ["Dual Isolated CAN Channels (FMS / Body CAN + Diagnostics)", "Kline ISO 9141"],
    compliance: ["ISO 11898-2", "ISO 14229 UDS Diagnostics"],
    fabricationSpec: "2-Layer FR4, HASL Lead-Free, 1.6mm",
    schematicRef: "HLPL-MOD-EHW-SCH-D01",
    gerberArchive: "HLPL-MOD-PCB-02-REV01-GERBER.zip",
    electronicBomItemCount: 38,
    status: "Qualified & Active",
    sampleLeadTimeWeeks: 2,
    description: "Plug-in expansion board for commercial fleets requiring simultaneous drivetrain FMS and trailer CAN logging.",
  },
  {
    id: "PCB-LIB-003",
    code: "HLPL-PWR-SMPS-01",
    title: "Ultra-Wide 9V-100V Industrial EV Isolated Power Module",
    revision: "Rev 02",
    category: "Power SMPS Module",
    mcu: "TI LM5017 Synchronous Step-Down Regulator",
    voltageRange: "9V - 100V DC (EV Traction Battery Compatible)",
    layerCount: 2,
    dimensions: "50 x 38 mm",
    interfaces: ["5V @ 3A Regulated Output", "3.3V @ 1A Low-Noise Rail"],
    compliance: ["ISO 7637-2 Level IV", "AIS-004 EMC"],
    fabricationSpec: "2-Layer 2oz Heavy Copper FR4, TG150",
    schematicRef: "HLPL-PWR-EHW-SCH-02",
    gerberArchive: "HLPL-PWR-SMPS-01-REV02-GERBER.zip",
    electronicBomItemCount: 24,
    status: "Qualified & Active",
    sampleLeadTimeWeeks: 1,
    description: "Specialized high-voltage step-down module for direct connection to 48V/72V/96V EV light electric vehicle packs.",
  },
  {
    id: "PCB-LIB-004",
    code: "HLPL-MOD-PCB-04-BLE",
    title: "BLE 5.2 Sensor Hub & AIS-140 Telematics Motherboard (OEM Modification)",
    revision: "Rev 01 (Modified)",
    category: "Telematics Motherboard",
    mcu: "STM32F405VGT6 + Nordic nRF52840 (BLE 5.2 SoC)",
    modem: "Quectel EC200U-CN (4G Cat-1 + GNSS)",
    voltageRange: "9V - 36V Automotive Transient Protected",
    layerCount: 4,
    dimensions: "98 x 68 mm",
    interfaces: [
      "BLE 5.2 2.4GHz RF Ceramic Chip Antenna",
      "CAN 2.0B / J1939 @ 250k/500k",
      "RS-232 / Diagnostic K-Line",
      "1-Wire iButton Reader",
      "4x Opto-isolated DI",
      "2x 0-32V AI",
      "Internal 3.7V Lithium-ion Battery Charger (300mA CC/CV)",
    ],
    compliance: [
      "AIS-140 Annexure 8 (iCAT TAC)",
      "ETSI EN 300 328 (BLE RF Radiated Power)",
      "IS 16046 (Part 2) / IEC 62133-2 (3.7V Li-ion Battery)",
      "UN 38.3 Transport Safety",
      "ISO 7637-2 Level IV Transients",
    ],
    fabricationSpec: "4-Layer FR4, TG170, 1.6mm, ENIG Surface Finish, Controlled 50Ω RF Microstrip",
    schematicRef: "HLPL-BCU-EHW-SCH-01",
    gerberArchive: "HLPL-MOD-PCB-04-BLE-REV01-GERBER.zip",
    electronicBomItemCount: 168,
    status: "Under Revision",
    sampleLeadTimeWeeks: 4,
    description: "OEM variant of ready telematics motherboard with integrated Nordic nRF52840 BLE 5.2 radio for wireless TPMS and cold-chain temperature tags. Multi-department feasibility sign-off complete.",
  },
];

export const defaultHarnessCatalog: HarnessAsset[] = [
  {
    id: "HARN-LIB-001",
    code: "HLPL-HARN-MX150-14P",
    title: "14-Pin Sealed Automotive Wiring Harness (Molex MX150)",
    connectorType: "Molex MX150 Sealed Male Connector (P/N: 33472-1401)",
    pinCount: 14,
    wireGauge: "FLRY-B 0.5 mm² & 0.75 mm² Automotive Grade",
    cableStandard: "ISO 6722 Class B (-40°C to +105°C), Corrugated PP Conduit",
    sealingRating: "IP67 Waterproof & Dustproof",
    lengthMm: 1200,
    drawingRef: "HLPL-HARN-MECH-DWG-01",
    pinoutSummary: [
      "Pin 1: Batt +12V/24V (Red/White - 5A Fuse inline)",
      "Pin 2: Power GND (Black)",
      "Pin 3: CAN_H (Yellow - Twisted Pair)",
      "Pin 4: CAN_L (Green - Twisted Pair)",
      "Pin 5: Ignition Input (Blue)",
      "Pin 6: Digital In 1 / SOS Alert Button (Orange)",
      "Pin 7: Digital In 2 / Door Sensor (Brown)",
      "Pin 8: Relay Output / Immobilizer (Violet)",
      "Pin 9: 1-Wire iButton Reader (Grey)",
      "Pin 10: Analog In 1 / Fuel Float (White/Blue)",
    ],
    applicableVehicles: "Tata Motors Commercial Vehicles (Ace EV, Prima, Signa), Ashok Leyland, Eicher",
    status: "Qualified & Active",
    sampleLeadTimeWeeks: 1,
    description: "OEM tier-1 certified automotive wiring harness with integrated waterproof inline blade fuse holder.",
  },
  {
    id: "HARN-LIB-002",
    code: "HLPL-HARN-OBD2-16P",
    title: "16-Pin Pass-Through OBD-II Diagnostic Y-Harness",
    connectorType: "Standard J1962 Male to Female Y-Splitter",
    pinCount: 16,
    wireGauge: "UL1007 22 AWG",
    cableStandard: "SAE J1962 / ISO 15031",
    sealingRating: "Cabin Non-Sealed (Under Dashboard)",
    lengthMm: 800,
    drawingRef: "HLPL-HARN-MECH-DWG-02",
    pinoutSummary: [
      "Pin 4/5: Ground",
      "Pin 6: CAN High (J2284)",
      "Pin 14: CAN Low (J2284)",
      "Pin 16: Permanent Battery +12V",
      "Pass-through: Retains unblocked diagnostic port for OEM service tools",
    ],
    applicableVehicles: "Passenger Vehicles, Light Commercial Fleets, Rental & Delivery Vans",
    status: "Qualified & Active",
    sampleLeadTimeWeeks: 1,
    description: "Zero-wire-splicing plug-and-play OBD-II harness. Keeps OEM technician scanner port open.",
  },
  {
    id: "HARN-LIB-003",
    code: "HLPL-HARN-DT04-12P",
    title: "12-Pin Deutsch Heavy-Duty Industrial Harness (DT04-12PA)",
    connectorType: "TE Deutsch DT04-12PA Male with Wedge Lock",
    pinCount: 12,
    wireGauge: "TXL 18 AWG Cross-Linked Polyethylene",
    cableStandard: "SAE J1128 Heavy Industrial (-50°C to +125°C)",
    sealingRating: "IP68 / IP6K9K High-Pressure Jet Wash",
    lengthMm: 1500,
    drawingRef: "HLPL-HARN-MECH-DWG-03",
    pinoutSummary: [
      "Pin 1: DC Input (9-36V)",
      "Pin 2: Ground",
      "Pin 3/4: Primary CAN J1939",
      "Pin 5/6: Secondary Implement CAN",
      "Pin 7-10: Sensor Inputs (Temperature & Hydraulic Pressure)",
    ],
    applicableVehicles: "Construction Equipment, CEV-IV Tractors, Mining Dumpers",
    status: "Tooling Available",
    sampleLeadTimeWeeks: 2,
    description: "Ultra-rugged German-engineered connector harness for extreme vibration, mud, and pressure washing.",
  },
];

export const defaultFirmwareCatalog: FirmwareAsset[] = [
  {
    id: "FW-LIB-001",
    code: "HLPL-FW-AIS140-RTOS",
    title: "AIS-140 Certified FreeRTOS Telematics Stack",
    version: "v2.4.1",
    targetMcu: "STM32F405VG",
    osKernel: "FreeRTOS Kernel v10.4.3",
    supportedProtocols: ["CAN J1939 (250k/500k)", "AIS-140 TCP/MQTT Protocol", "Dual-Server Telemetry", "SSL/TLS v1.3", "Emergency SOS Handler"],
    fotaCapability: "Dual-Bank Flash Rollback with SHA-256 and CRC-32 Validation",
    tacCertified: true,
    binaryHash: "SHA256:7f8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a",
    status: "Pre-Certified",
    developmentLeadTimeWeeks: 0,
    description: "Turnkey firmware pre-approved by ARAI and ICAT. Tested across 50,000 devices with 99.98% uptime.",
  },
  {
    id: "FW-LIB-002",
    code: "HLPL-FW-BLE-J1939",
    title: "Dual CAN Gateway & Wireless BLE Sensor Hub Firmware",
    version: "v1.8.0",
    targetMcu: "STM32F405VG + nRF52840",
    osKernel: "FreeRTOS + Zephyr BLE Subsystem",
    supportedProtocols: ["Dual CAN Forwarding", "BLE TPMS Sensor Beacon", "BLE Temperature Tag Collector", "OBD-II PID Streaming"],
    fotaCapability: "Full FOTA for MCU and BLE Radio",
    tacCertified: true,
    binaryHash: "SHA256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    status: "Pre-Certified",
    developmentLeadTimeWeeks: 0,
    description: "Advanced multi-CAN router with Bluetooth wireless cold-chain temperature and tire pressure monitoring.",
  },
];

export const defaultEnclosureCatalog: EnclosureAsset[] = [
  {
    id: "ENC-LIB-001",
    code: "HLPL-ENC-IP67-PC",
    title: "Rugged Polycarbonate IP67 Gasket Sealed Enclosure",
    material: "SABIC Lexan UV-Stabilized Polycarbonate (UL94-V0 Flame Retardant)",
    ingressRating: "IP67 (1m water immersion / 30 mins) + IK08 Impact",
    dimensions: "115 x 75 x 32 mm",
    mountingType: "Chassis Flange Bracket or Heavy-Duty Zip-Tie Groove",
    cadModelRef: "HLPL-ENC-MECH-CAD-01.step",
    toolingStatus: "Molds Active",
    leadTimeWeeks: 1,
    description: "Production-hardened enclosure with pre-compressed liquid silicone gasket and gore breathable membrane valve.",
  },
  {
    id: "ENC-LIB-002",
    code: "HLPL-ENC-ALU-RUGGED",
    title: "Heavy-Duty Extruded Anodized Aluminum Enclosure",
    material: "Extruded Aluminum 6063-T6 with Black Anodizing",
    ingressRating: "IP68 / NEMA 4X",
    dimensions: "135 x 85 x 40 mm",
    mountingType: "4-Point Vibration Isolator Flanges",
    cadModelRef: "HLPL-ENC-MECH-CAD-02.step",
    toolingStatus: "Molds Active",
    leadTimeWeeks: 2,
    description: "Designed for industrial off-highway and mining equipment requiring maximum heat dissipation and rock impact resistance.",
  },
];

// Default configurations per project
export const defaultProjectModularConfigs: Record<string, ProjectModularConfiguration> = {
  "HLPL-AI4T-01": {
    projectId: "HLPL-AI4T-01",
    projectTitle: "Tata Ace EV 4G AIS-140 Telematics Gateway",
    architectureMode: "reusable_platform",
    selectedPcbIds: ["PCB-LIB-001"], // 100% Platform Motherboard
    selectedHarnessId: "HARN-LIB-001", // Molex MX150 14-pin
    selectedFirmwareId: "FW-LIB-001", // AIS-140 Stack v2.4.1
    selectedEnclosureId: "ENC-LIB-001", // IP67 Polycarbonate
    lastUpdated: "2026-10-15 14:30 IST",
    configuredBy: "Avery Vale (EHW Lead)",
  },
  "HLPL-SLCT-01": {
    projectId: "HLPL-SLCT-01",
    projectTitle: "Select Motors AIS-140 GPS Telematics Tracker (Reusable Platform)",
    architectureMode: "reusable_platform",
    selectedPcbIds: ["PCB-LIB-001"], // 100% Reusable Proven Motherboard (Quectel EC200U-CN, STM32F405, 3.7V Li-ion)!
    selectedHarnessId: "HARN-LIB-002", // Standard OBD-II Pass-through
    selectedFirmwareId: "FW-LIB-001", // Pre-Certified Turnkey AIS-140 Stack v2.4.1
    selectedEnclosureId: "ENC-LIB-001", // Proven IP67 Polycarbonate
    customFirmwareNotes: "Zero code modification needed. Pre-certified TAC payload configuration.",
    lastUpdated: "2026-10-15 11:30 IST",
    configuredBy: "Avery Vale (EHW Lead) & Devon Lane (ESW Lead)",
  },
  "HLPL-BCU-02": {
    projectId: "HLPL-BCU-02",
    projectTitle: "Ashok Leyland Telematics & BLE Sensor Gateway (OEM Modification)",
    architectureMode: "hybrid_variant",
    selectedPcbIds: ["PCB-LIB-004"], // Modified Motherboard with BLE 5.2 Nordic nRF52840!
    selectedHarnessId: "HARN-LIB-001", // Molex MX150 Sealed Automotive Harness
    selectedFirmwareId: "FW-LIB-002", // Dual CAN Gateway & BLE Sensor Hub Firmware
    selectedEnclosureId: "ENC-LIB-001", // IP67 Polycarbonate with RF Transparent Window
    customFirmwareNotes: "Zephyr BLE stack for TPMS & temperature probes with AIS-140 MQTT uplink",
    customEnclosureNotes: "SABIC Lexan enclosure with 2.4GHz RF transparent window over BLE chip antenna",
    lastUpdated: "2026-10-15 17:45 IST",
    configuredBy: "Avery Vale (EHW Lead) & Devon Lane (ESW Lead)",
  },
  "HLPL-XLINK-03": {
    projectId: "HLPL-XLINK-03",
    projectTitle: "Heavy Commercial Dual-CAN Gateway",
    architectureMode: "reusable_platform",
    selectedPcbIds: ["PCB-LIB-001", "PCB-LIB-002"], // TWO PCBs: Motherboard + Daughterboard!
    selectedHarnessId: "HARN-LIB-003", // Deutsch 12-pin!
    selectedFirmwareId: "FW-LIB-002", // Dual CAN Firmware!
    selectedEnclosureId: "ENC-LIB-002", // Aluminum Enclosure!
    lastUpdated: "2026-10-12 11:00 IST",
    configuredBy: "Samira Holt (MECH Lead)",
  },
};

// =========================================================================
// 3. Helper Functions: Calculate Development Process Skips
// =========================================================================

export function calculateDevelopmentSkip(config: ProjectModularConfiguration) {
  const pcbReused = config.selectedPcbIds.length > 0;
  const harnessReused = Boolean(config.selectedHarnessId);
  const fwReused = Boolean(config.selectedFirmwareId);
  const encReused = Boolean(config.selectedEnclosureId);

  // Normal clean-sheet development takes ~20 weeks and ₹6.5 Lakhs NRE
  let weeksSaved = 0;
  let nreSavedPct = 0;

  if (pcbReused) {
    weeksSaved += 8; // Schematic, layout, PCB fab, solder stencil
    nreSavedPct += 40;
  }
  if (fwReused) {
    weeksSaved += 5; // Bootloader, RTOS port, CAN parser, AIS-140 engine
    nreSavedPct += 25;
  }
  if (harnessReused) {
    weeksSaved += 3; // Wire harness drawing, pin crimp tooling, mold setup
    nreSavedPct += 15;
  }
  if (encReused) {
    weeksSaved += 4; // Plastic injection mold tooling (35 days)
    nreSavedPct += 15;
  }

  const effectiveWeeksToSample = Math.max(2, 20 - weeksSaved);

  return {
    pcbReused,
    harnessReused,
    fwReused,
    encReused,
    weeksSaved: Math.min(17, weeksSaved),
    nreSavedPct: Math.min(95, nreSavedPct),
    effectiveWeeksToSample,
    canSkipStage4PoC: pcbReused && fwReused, // Eligibility to propose a reviewed optional PoC omission.
    fastTrackStatus:
      pcbReused && fwReused && harnessReused
        ? "100% Proven Platform · Zero NRE"
        : pcbReused && fwReused
          ? "Hardware & Firmware Proven · Harness Sourcing Only"
          : "Custom Engineering Required",
  };
}

// =========================================================================
// 4. Modal Component: Reusable Platform Asset Catalog Viewer
// =========================================================================

export function ModularAssetCatalogModal({
  onClose,
  initialTab = "pcbs",
}: {
  onClose: () => void;
  initialTab?: "pcbs" | "harnesses" | "firmware" | "enclosures";
}) {
  const [activeTab, setActiveTab] = useState<"pcbs" | "harnesses" | "firmware" | "enclosures">(initialTab);
  const [search, setSearch] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Cpu className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Modular Platform Asset Catalog</h2>
                <span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  Master Plan §5 Reusable Assets
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Authoritative library of proven PCBs, wiring harnesses, firmware stacks, and enclosures for cross-project reuse
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Asset Catalog"
            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-5 py-3">
          <div className="flex rounded-lg border border-border bg-card p-1 text-xs">
            <button
              onClick={() => setActiveTab("pcbs")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                activeTab === "pcbs" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Cpu className="size-3.5" />
              Hardware PCBs ({defaultPcbCatalog.length})
            </button>
            <button
              onClick={() => setActiveTab("harnesses")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                activeTab === "harnesses" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Cable className="size-3.5" />
              Wiring Harnesses ({defaultHarnessCatalog.length})
            </button>
            <button
              onClick={() => setActiveTab("firmware")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                activeTab === "firmware" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code2 className="size-3.5" />
              Firmware Stacks ({defaultFirmwareCatalog.length})
            </button>
            <button
              onClick={() => setActiveTab("enclosures")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                activeTab === "enclosures" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Box className="size-3.5" />
              Enclosures ({defaultEnclosureCatalog.length})
            </button>
          </div>

          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter assets by code or specs..."
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
            />
          </div>
        </div>

        {/* Catalog Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: PCBs */}
          {activeTab === "pcbs" && (
            <div className="grid gap-4 md:grid-cols-2">
              {defaultPcbCatalog
                .filter(
                  (p) =>
                    p.code.toLowerCase().includes(search.toLowerCase()) ||
                    p.title.toLowerCase().includes(search.toLowerCase()) ||
                    p.mcu.toLowerCase().includes(search.toLowerCase())
                )
                .map((pcb) => (
                  <div key={pcb.id} className="rounded-xl border border-border/80 bg-card p-5 shadow-2xs hover:border-primary/50 transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">{pcb.code}</span>
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                            {pcb.revision}
                          </span>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {pcb.status}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-sm font-bold text-foreground">{pcb.title}</h3>
                        <p className="text-[11px] text-muted-foreground">{pcb.description}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 rounded-lg bg-muted/30 p-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">MCU Core:</span>
                        <span className="font-medium text-foreground">{pcb.mcu}</span>
                      </div>
                      {pcb.modem && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cellular / GNSS:</span>
                          <span className="font-medium text-foreground">{pcb.modem}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Layer Stackup:</span>
                        <span className="font-medium text-foreground">
                          {pcb.layerCount} Layers ({pcb.dimensions}) · {pcb.fabricationSpec.split(",")[0]}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Voltage Rating:</span>
                        <span className="font-medium text-foreground">{pcb.voltageRange}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Electronic BOM Count:</span>
                        <span className="font-mono font-medium text-foreground">{pcb.electronicBomItemCount} components</span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                      {pcb.interfaces.map((intf) => (
                        <span key={intf} className="rounded border border-border bg-secondary px-2 py-0.5 font-mono text-foreground">
                          {intf}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-[11px]">
                      <span className="font-mono text-muted-foreground">{pcb.gerberArchive}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        ⚡ {pcb.sampleLeadTimeWeeks} weeks lead time (Ready)
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* TAB 2: HARNESSES */}
          {activeTab === "harnesses" && (
            <div className="grid gap-4 md:grid-cols-2">
              {defaultHarnessCatalog
                .filter(
                  (h) =>
                    h.code.toLowerCase().includes(search.toLowerCase()) ||
                    h.title.toLowerCase().includes(search.toLowerCase()) ||
                    h.connectorType.toLowerCase().includes(search.toLowerCase())
                )
                .map((harn) => (
                  <div key={harn.id} className="rounded-xl border border-border/80 bg-card p-5 shadow-2xs hover:border-primary/50 transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{harn.code}</span>
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                            {harn.pinCount} Pins
                          </span>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {harn.sealingRating}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-sm font-bold text-foreground">{harn.title}</h3>
                        <p className="text-[11px] text-muted-foreground">{harn.description}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 rounded-lg bg-muted/30 p-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Connector:</span>
                        <span className="font-medium text-foreground">{harn.connectorType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cable Wire:</span>
                        <span className="font-medium text-foreground">{harn.wireGauge} · {harn.lengthMm}mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Applicable Fleet:</span>
                        <span className="font-medium text-foreground">{harn.applicableVehicles}</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pinout Sample</p>
                      <div className="mt-1 space-y-0.5 font-mono text-[10px] text-foreground">
                        {harn.pinoutSummary.slice(0, 3).map((pin, i) => (
                          <p key={i} className="truncate">
                            {pin}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-[11px]">
                      <span className="font-mono text-muted-foreground">{harn.drawingRef}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        ⚡ {harn.sampleLeadTimeWeeks} week sample dispatch
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* TAB 3: FIRMWARE */}
          {activeTab === "firmware" && (
            <div className="grid gap-4 md:grid-cols-2">
              {defaultFirmwareCatalog
                .filter(
                  (f) =>
                    f.code.toLowerCase().includes(search.toLowerCase()) ||
                    f.title.toLowerCase().includes(search.toLowerCase())
                )
                .map((fw) => (
                  <div key={fw.id} className="rounded-xl border border-border/80 bg-card p-5 shadow-2xs hover:border-primary/50 transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">{fw.code}</span>
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                            {fw.version}
                          </span>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            TAC Pre-Certified
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-sm font-bold text-foreground">{fw.title}</h3>
                        <p className="text-[11px] text-muted-foreground">{fw.description}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 rounded-lg bg-muted/30 p-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Target MCU & OS:</span>
                        <span className="font-medium text-foreground">{fw.targetMcu} · {fw.osKernel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">FOTA System:</span>
                        <span className="font-medium text-foreground">{fw.fotaCapability}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Binary Hash:</span>
                        <span className="font-mono text-[10px] text-steel">{fw.binaryHash.slice(0, 20)}...</span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                      {fw.supportedProtocols.map((prot) => (
                        <span key={prot} className="rounded border border-border bg-secondary px-2 py-0.5 font-mono text-foreground">
                          {prot}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-[11px]">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        ⚡ 0 Weeks Dev (Pre-Certified Binary)
                      </span>
                      <span className="text-muted-foreground">Full Source & Bootloader in Escrow</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* TAB 4: ENCLOSURES */}
          {activeTab === "enclosures" && (
            <div className="grid gap-4 md:grid-cols-2">
              {defaultEnclosureCatalog.map((enc) => (
                <div key={enc.id} className="rounded-xl border border-border/80 bg-card p-5 shadow-2xs hover:border-primary/50 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400">{enc.code}</span>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {enc.ingressRating}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-bold text-foreground">{enc.title}</h3>
                      <p className="text-[11px] text-muted-foreground">{enc.description}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-lg bg-muted/30 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dimensions:</span>
                      <span className="font-medium text-foreground">{enc.dimensions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Material:</span>
                      <span className="font-medium text-foreground">{enc.material}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tooling Status:</span>
                      <span className="font-medium text-foreground">{enc.toolingStatus}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-[11px]">
                    <span className="font-mono text-muted-foreground">{enc.cadModelRef}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      ⚡ Ready for production molding
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 5. Modal Component: Project Architecture & Modular Asset Linker
// =========================================================================

export function ProjectAssetLinkerModal({
  projectId = "HLPL-AI4T-01",
  projectTitle = "Tata Ace EV 4G AIS-140 Telematics Gateway",
  initialConfig,
  onClose,
  onSaveConfig,
}: {
  projectId?: string | undefined;
  projectTitle?: string | undefined;
  initialConfig?: ProjectModularConfiguration | undefined;
  onClose: () => void;
  onSaveConfig: (config: ProjectModularConfiguration) => void;
}) {
  const existingConfig = initialConfig ?? defaultProjectModularConfigs[projectId] ?? {
    projectId,
    projectTitle,
    architectureMode: "reusable_platform",
    selectedPcbIds: ["PCB-LIB-001"],
    selectedHarnessId: "HARN-LIB-001",
    selectedFirmwareId: "FW-LIB-001",
    selectedEnclosureId: "ENC-LIB-001",
    lastUpdated: new Date().toISOString().slice(0, 16).replace("T", " ") + " IST",
    configuredBy: "Sales & Engineering Team",
  };

  const [mode, setMode] = useState<ProjectModularConfiguration["architectureMode"]>(existingConfig.architectureMode);
  const [selectedPcbIds, setSelectedPcbIds] = useState<string[]>(existingConfig.selectedPcbIds);
  const [selectedHarnessId, setSelectedHarnessId] = useState<string>(existingConfig.selectedHarnessId);
  const [selectedFirmwareId, setSelectedFirmwareId] = useState<string>(existingConfig.selectedFirmwareId);
  const [selectedEnclosureId, setSelectedEnclosureId] = useState<string>(existingConfig.selectedEnclosureId);

  const togglePcb = (pcbId: string) => {
    if (selectedPcbIds.includes(pcbId)) {
      if (selectedPcbIds.length > 1) {
        setSelectedPcbIds(selectedPcbIds.filter((id) => id !== pcbId));
      }
    } else {
      setSelectedPcbIds([...selectedPcbIds, pcbId]);
    }
  };

  const currentConfig: ProjectModularConfiguration = {
    projectId,
    projectTitle,
    architectureMode: mode,
    selectedPcbIds,
    selectedHarnessId,
    selectedFirmwareId,
    selectedEnclosureId,
    lastUpdated: new Date().toISOString().slice(0, 16).replace("T", " ") + " IST",
    configuredBy: "Authorized Engineering Team",
  };

  const skipMetrics = calculateDevelopmentSkip(currentConfig);

  const handleSave = () => {
    onSaveConfig(currentConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Configure Modular Architecture & Asset Reuse</h2>
                <span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  Master Plan §5 Project-to-Asset Linker
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Project: <strong>{projectId}</strong> · {projectTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Asset Linker"
            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Development Skip Banner */}
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {skipMetrics.fastTrackStatus}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-emerald-700 dark:text-emerald-300">
                ⚡ <strong>{skipMetrics.weeksSaved} Weeks</strong> Dev Time Saved
              </span>
              <span className="text-emerald-700 dark:text-emerald-300">
                💰 <strong>{skipMetrics.nreSavedPct}% NRE</strong> Expense Avoided
              </span>
              <span className="rounded bg-emerald-600 text-white px-2 py-0.5 font-mono text-[10px]">
                Ready in ~{skipMetrics.effectiveWeeksToSample} Weeks
              </span>
            </div>
          </div>
          {skipMetrics.canSkipStage4PoC && (
            <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-200">
              Reusable hardware and firmware selected. Review compatibility, exact revisions and any optional Phase 2 PoC omission before Phase 4 pilot work.
            </p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Architecture Mode Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Development Strategy
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setMode("reusable_platform")}
                className={`flex flex-col text-left rounded-xl border p-3.5 transition ${
                  mode === "reusable_platform"
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border bg-card hover:bg-secondary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Proven Platform Reuse</span>
                  {mode === "reusable_platform" && <Check className="size-4 text-primary" />}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Fastest time-to-market. 100% existing proven PCB(s), harness, and firmware.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode("hybrid_variant")}
                className={`flex flex-col text-left rounded-xl border p-3.5 transition ${
                  mode === "hybrid_variant"
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border bg-card hover:bg-secondary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Hybrid Product Variant</span>
                  {mode === "hybrid_variant" && <Check className="size-4 text-primary" />}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Reuses proven motherboard & firmware with a customer-specific harness or enclosure.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode("clean_sheet")}
                className={`flex flex-col text-left rounded-xl border p-3.5 transition ${
                  mode === "clean_sheet"
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border bg-card hover:bg-secondary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Clean-Sheet Development</span>
                  {mode === "clean_sheet" && <Check className="size-4 text-primary" />}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Full ground-up R&D schematic layout, firmware bring-up, and tooling molds.
                </p>
              </button>
            </div>
          </div>

          {/* Section 1: Hardware PCBs Selection (MULTIPLE ALLOWED) */}
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  1. Linked Hardware PCBs ({selectedPcbIds.length} Selected)
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">Projects can link multiple PCBs (Motherboard + Daughters)</span>
            </div>

            <div className="mt-3 space-y-2.5">
              {defaultPcbCatalog.map((pcb) => {
                const selected = selectedPcbIds.includes(pcb.id);
                return (
                  <div
                    key={pcb.id}
                    onClick={() => togglePcb(pcb.id)}
                    className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition ${
                      selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {}}
                        className="mt-0.5 rounded border-input text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">{pcb.code}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                            {pcb.revision}
                          </span>
                          <span className="text-xs font-semibold text-foreground">{pcb.title}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {pcb.mcu} · {pcb.layerCount} Layers · {pcb.dimensions} · {pcb.voltageRange}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Pre-Qualified
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Wiring Harness Selection */}
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Cable className="size-4 text-amber-500" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  2. Linked Wiring Harness Assembly
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">Decoupled from PCB; reusable across different vehicles</span>
            </div>

            <div className="mt-3 space-y-2">
              {defaultHarnessCatalog.map((harn) => {
                const selected = selectedHarnessId === harn.id;
                return (
                  <div
                    key={harn.id}
                    onClick={() => setSelectedHarnessId(harn.id)}
                    className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition ${
                      selected ? "border-amber-500 bg-amber-500/5" : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={selected}
                        onChange={() => {}}
                        className="mt-0.5 text-amber-500 focus:ring-amber-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">{harn.code}</span>
                          <span className="text-xs font-semibold text-foreground">{harn.title}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.2 text-[10px] text-muted-foreground font-mono">
                            {harn.sealingRating}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {harn.connectorType} · {harn.lengthMm}mm · {harn.applicableVehicles}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Tooling Ready
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Firmware Stack Selection */}
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Code2 className="size-4 text-sky-500" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  3. Linked Pre-Certified Firmware Stack
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">TAC pre-certified binary with dual-bank FOTA</span>
            </div>

            <div className="mt-3 space-y-2">
              {defaultFirmwareCatalog.map((fw) => {
                const selected = selectedFirmwareId === fw.id;
                return (
                  <div
                    key={fw.id}
                    onClick={() => setSelectedFirmwareId(fw.id)}
                    className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition ${
                      selected ? "border-sky-500 bg-sky-500/5" : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={selected}
                        onChange={() => {}}
                        className="mt-0.5 text-sky-500 focus:ring-sky-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">{fw.code}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.2 text-[10px] text-muted-foreground font-mono">
                            {fw.version}
                          </span>
                          <span className="text-xs font-semibold text-foreground">{fw.title}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {fw.targetMcu} · {fw.osKernel} · {fw.supportedProtocols.join(", ")}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      0 Weeks Dev
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Enclosure Selection */}
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Box className="size-4 text-violet-500" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  4. Linked Mechanical Enclosure
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">Molds active; zero tooling setup time</span>
            </div>

            <div className="mt-3 space-y-2">
              {defaultEnclosureCatalog.map((enc) => {
                const selected = selectedEnclosureId === enc.id;
                return (
                  <div
                    key={enc.id}
                    onClick={() => setSelectedEnclosureId(enc.id)}
                    className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition ${
                      selected ? "border-violet-500 bg-violet-500/5" : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={selected}
                        onChange={() => {}}
                        className="mt-0.5 text-violet-500 focus:ring-violet-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">{enc.code}</span>
                          <span className="text-xs font-semibold text-foreground">{enc.title}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.2 text-[10px] text-muted-foreground font-mono">
                            {enc.ingressRating}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {enc.dimensions} · {enc.material} · {enc.toolingStatus}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Molds Ready
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-5 bg-card">
          <div className="text-xs text-muted-foreground">
            Saves project configuration to Project Master Spec Sheet (PMSS) and generates branded references under{" "}
            <span className="font-mono font-semibold text-foreground">HLPL-{projectId.replace("HLPL-", "")}-...</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-90"
            >
              <Check className="size-4" />
              Save & Link to Project ({projectId})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

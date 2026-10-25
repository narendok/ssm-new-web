import { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Lock,
  Cpu,
  FileText,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Zap,
  Building2,
  DollarSign,
  Boxes,
  Microchip,
  RotateCcw,
  Users,
  FolderOpen,
  Calendar,
  Cable,
  Code2,
  Box,
} from "lucide-react";
import {
  defaultPcbCatalog,
  defaultHarnessCatalog,
  defaultFirmwareCatalog,
  defaultEnclosureCatalog,
  defaultProjectModularConfigs,
  calculateDevelopmentSkip,
  type ProjectModularConfiguration,
} from "./ModularProductArchitectureAndPcbCatalog";

export type FeasibilityVerdict = "FEASIBLE" | "FEASIBLE_WITH_CONDITIONS" | "INFEASIBLE";

export type DepartmentFeasibility = {
  deptCode: string;
  deptName: string;
  leadName: string;
  verdict: FeasibilityVerdict;
  scopeSummary: string;
  internalRemarks: string;
  clientHighlights: string;
  keyParameters: { label: string; value: string }[];
  signedAt: string;
  signatureHash: string;
};

export type HardwarePath = "poc" | "pilot";

export interface FeasibilityAndHardwareKickoffProps {
  currentStageIndex: number;
  onAdvanceToStage: (stageIndex: number) => void;
  onOpenDocumentView: (docId: string, title: string, dept: string) => void;
  projectId?: string | undefined;
  modularConfig?: ProjectModularConfiguration | undefined;
  onKickoffComplete?: ((path: "poc" | "pilot", deliverables: string[]) => void) | undefined;
  readOnly?: boolean | undefined;
}

export function FeasibilityAndHardwareKickoff({
  currentStageIndex,
  onAdvanceToStage,
  onOpenDocumentView,
  projectId = "HLPL-AI4T-01",
  modularConfig,
  onKickoffComplete,
  readOnly = false,
}: FeasibilityAndHardwareKickoffProps) {
  // Gate selection: 1 (Intake), 2 (Feasibility), 3 (Req Lock), 4 (Hardware PoC/Pilot)
  const initialGate = (): 1 | 2 | 3 | 4 => {
    if (currentStageIndex === 0) return 1;
    if (currentStageIndex === 1) return 2;
    if (currentStageIndex === 2) return 3;
    return 4;
  };

  const fallbackConfig: ProjectModularConfiguration = defaultProjectModularConfigs["HLPL-AI4T-01"] ?? {
    projectId: "HLPL-AI4T-01",
    projectTitle: "Tata Ace EV 4G AIS-140 Telematics Gateway",
    architectureMode: "reusable_platform",
    selectedPcbIds: ["PCB-LIB-001"],
    selectedHarnessId: "HARN-LIB-001",
    selectedFirmwareId: "FW-LIB-001",
    selectedEnclosureId: "ENC-LIB-001",
    lastUpdated: "2026-10-15 14:30 IST",
    configuredBy: "Avery Vale (EHW Lead)",
  };

  const activeConfig: ProjectModularConfiguration =
    modularConfig ||
    (projectId ? defaultProjectModularConfigs[projectId] : undefined) ||
    fallbackConfig;
  const skipMetrics = calculateDevelopmentSkip(activeConfig);

  const [selectedGate, setSelectedGate] = useState<1 | 2 | 3 | 4>(initialGate);
  const [hardwarePath, setHardwarePath] = useState<HardwarePath>(
    skipMetrics.canSkipStage4PoC ? "pilot" : "poc",
  );
  const [hardwareKickoffLaunched, setHardwareKickoffLaunched] = useState(currentStageIndex >= 4);

  // Sync selected gate if currentStageIndex changes externally
  useEffect(() => {
    if (currentStageIndex === 0) setSelectedGate(1);
    else if (currentStageIndex === 1) setSelectedGate(2);
    else if (currentStageIndex === 2) setSelectedGate(3);
    else setSelectedGate(4);
  }, [currentStageIndex]);

  // Dynamic department reviews per Master Plan §4 & §5 based on active project
  const getProjectReviews = (): DepartmentFeasibility[] => {
    if (projectId === "HLPL-BCU-02") {
      return [
        {
          deptCode: "EHW",
          deptName: "Embedded Hardware Engineering",
          leadName: "Avery Vale",
          verdict: "FEASIBLE",
          scopeSummary: "Hardware Modification ECN: Integrate Nordic nRF52840 BLE 5.2 SoC with impedance-matched 2.4GHz RF ceramic chip antenna on ready PCB HLPL-MOD-PCB-01 -> spin Rev 04-BLE. Internal 3.7V Lithium-ion 1000mAh backup battery charging circuit.",
          internalRemarks: "50-ohm RF trace clearance verified on Layer 1. 3.7V Li-ion battery charging CC/CV profile tested with NTC thermal cutoff at 45°C. ECN-2026-BLE-01 drafted.",
          clientHighlights: "Custom OEM modification adding BLE 5.2 wireless sensor hub for tire pressure (TPMS) and cold-chain temperature tags.",
          keyParameters: [
            { label: "BLE Subsystem", value: "Nordic nRF52840 (BLE 5.2, +8dBm Max TX)" },
            { label: "Internal Battery", value: "3.7V 1000mAh Li-ion (NABL Certified)" },
            { label: "PCB Modification", value: "Spin Rev 04-BLE (ECN-2026-BLE-01)" },
          ],
          signedAt: "15 Oct 2026, 14:30 IST",
          signatureHash: "SHA256:7e8a9f...bcu2",
        },
        {
          deptCode: "FW",
          deptName: "Firmware Engineering",
          leadName: "Devon Lane",
          verdict: "FEASIBLE",
          scopeSummary: "Firmware Requirements (FW-FRS-01). FreeRTOS v10.4 + Nordic SoftDevice / Zephyr BLE 5.2 controller bring-up, interrupt priorities, memory mapping, and dual-bank bootloader fail-safe OTA.",
          internalRemarks: "BLE scan duty cycle configured for 10% to preserve 3.7V Li-ion battery life during vehicle ignition-off standby. Dual-bank OTA firmware update verified.",
          clientHighlights: "Low-power embedded firmware with fail-safe dual-bank bootloader and power management.",
          keyParameters: [
            { label: "RTOS Kernel", value: "FreeRTOS v10.4 / Zephyr RTOS" },
            { label: "BLE Controller", value: "Nordic SoftDevice BLE 5.2 Stack" },
            { label: "Low Power Standby", value: "<3.5mA with BLE Beacon Listening" },
          ],
          signedAt: "15 Oct 2026, 15:15 IST",
          signatureHash: "SHA256:4d2c8b...bcu2",
        },
        {
          deptCode: "SW",
          deptName: "Cloud & Application Software",
          leadName: "Siddharth Roy",
          verdict: "FEASIBLE",
          scopeSummary: "Software Requirements (SW-SRS-01). Bluetooth GATT server schema for TPMS tire pressure & cold-chain temperature sensors, AIS-140 Annexure 8 MQTT telemetry parser, and companion diagnostic tools.",
          internalRemarks: "JSON/Protobuf telemetry payload structure approved. Desktop flashing tool SW-TOOL-01 configured for automated production line provisioning.",
          clientHighlights: "Multi-sensor BLE aggregator with automated wireless sensor pairing and tamper event detection.",
          keyParameters: [
            { label: "Bluetooth Profile", value: "BLE 5.2 GATT / Custom Telematics Payload" },
            { label: "Concurrent Sensors", value: "Up to 8 BLE Sensors (TPMS + Temp)" },
            { label: "Cloud Protocol", value: "AIS-140 Annexure 8 / MQTT TLS 1.3" },
          ],
          signedAt: "15 Oct 2026, 15:45 IST",
          signatureHash: "SHA256:5e3d9c...csw2",
        },
        {
          deptCode: "MECH",
          deptName: "Mechanical Engineering",
          leadName: "Samira Holt",
          verdict: "FEASIBLE",
          scopeSummary: "Modify polycarbonate enclosure top lid to add 2.4GHz RF transparent window; verify silicone gasket IP67 seal integrity and 3.7V Li-ion battery retention bracket.",
          internalRemarks: "Zero metallic plating above BLE antenna zone. Drop simulation confirms internal 3.7V battery cushion survives 1.5m drop onto concrete.",
          clientHighlights: "Rugged automotive IP67 waterproof enclosure with RF window transparent to 2.4GHz wireless telemetry.",
          keyParameters: [
            { label: "RF Window Material", value: "SABIC Lexan (Permittivity 2.9 @ 2.4GHz)" },
            { label: "Battery Retention", value: "Shock-Absorbing Flame Retardant Foam" },
            { label: "Ingress Protection", value: "IP67 Maintained" },
          ],
          signedAt: "15 Oct 2026, 16:00 IST",
          signatureHash: "SHA256:9a11ef...bcu2",
        },
        {
          deptCode: "PUR",
          deptName: "Purchasing & Supply Chain",
          leadName: "Morgan Reed",
          verdict: "FEASIBLE_WITH_CONDITIONS",
          scopeSummary: "Sourcing Nordic nRF52840-QIAA-R BLE SoC, 2.4GHz chip antennas, and NABL-certified 3.7V 1000mAh Lithium-ion cells. Incremental BOM: +$3.15/unit.",
          internalRemarks: "Nordic lead time is 10 weeks; initial buffer stock of 500 units available via authorized distributor. Battery supplier provides UN 38.3 test report.",
          clientHighlights: "Dual-sourcing on BLE passives; advance semiconductor buffer secured for 15,000 units/year.",
          keyParameters: [
            { label: "Nordic SoC Lead Time", value: "10 Weeks (500 Samples in Stock)" },
            { label: "3.7V Battery Supplier", value: "NABL Accredited Cell Pack" },
            { label: "Incremental BOM", value: "+$3.15 / unit ($38.57 total)" },
          ],
          signedAt: "15 Oct 2026, 16:45 IST",
          signatureHash: "SHA256:1f78ea...bcu2",
        },
        {
          deptCode: "QA",
          deptName: "Quality Assurance & APQP",
          leadName: "Jordan Blake",
          verdict: "FEASIBLE",
          scopeSummary: "DVP&R test plan updated for BLE RF radiated power (ETSI EN 300 328), 30m range verification, 3.7V Li-ion battery NABL certification (IS 16046 Part 2 / UN 38.3), and iCAT agency type approval.",
          internalRemarks: "Testing slot reserved at iCAT Manesar for AIS-140 Annexure 8 and RF radiated testing. External NABL lab test scheduled for battery safety.",
          clientHighlights: "Comprehensive automotive qualification framework with witness testing at iCAT Manesar and NABL battery certification.",
          keyParameters: [
            { label: "Certification Agency", value: "iCAT (Manesar) + NABL Battery Lab" },
            { label: "Battery Standard", value: "IS 16046 (Part 2) / IEC 62133-2 / UN 38.3" },
            { label: "RF Standard", value: "ETSI EN 300 328 & WPC ETA" },
          ],
          signedAt: "15 Oct 2026, 17:10 IST",
          signatureHash: "SHA256:b6329c...bcu2",
        },
        {
          deptCode: "FIN",
          deptName: "Accounts & Finance",
          leadName: "Priya Voss",
          verdict: "FEASIBLE",
          scopeSummary: "Commercial feasibility for Ashok Leyland: 15,000 units/year @ ₹4,480/unit. Modification NRE: ₹1.85 Lakhs tooling & stencils + ₹2.40 Lakhs iCAT/NABL agency testing fees.",
          internalRemarks: "Client agreed to absorb 50% NRE on confirmation of 15,000 unit annual volume. 30% advance required upon Feasibility Sign-off.",
          clientHighlights: "Approved commercial proposal with milestone-based invoicing and statutory GST compliance.",
          keyParameters: [
            { label: "PCB Modification NRE", value: "₹1,85,000 (Tooling & Stencils)" },
            { label: "Agency Testing Fee", value: "₹2,40,000 (iCAT & NABL Battery)" },
            { label: "Target OEM Price", value: "₹4,480 / unit" },
          ],
          signedAt: "15 Oct 2026, 17:30 IST",
          signatureHash: "SHA256:3c810d...bcu2",
        },
      ];
    }

    if (projectId === "HLPL-SLCT-01") {
      return [
        {
          deptCode: "EHW",
          deptName: "Embedded Hardware Engineering",
          leadName: "Avery Vale",
          verdict: "FEASIBLE",
          scopeSummary: "100% Platform Reuse: Proven ready PCB HLPL-MOD-PCB-01 Rev 03 (Quectel EC200U-CN, STM32F405, 3.7V 1000mAh Li-ion battery). Zero schematic or layout changes needed. Stage 4 PoC bypassed.",
          internalRemarks: "Pre-qualified 4-layer stackup and power circuit. Ready for direct SMT pilot build on Line 2.",
          clientHighlights: "Zero-NRE deployment leveraging field-proven hardware with 60,000+ units operating in the field.",
          keyParameters: [
            { label: "Hardware Path", value: "100% Reused (Bypasses Stage 4 PoC)" },
            { label: "Platform Motherboard", value: "HLPL-MOD-PCB-01 Rev 03" },
            { label: "Internal Battery", value: "3.7V 1000mAh Li-ion (Pre-Certified)" },
          ],
          signedAt: "14 Oct 2026, 11:30 IST",
          signatureHash: "SHA256:8a1b2c...slct1",
        },
        {
          deptCode: "FW",
          deptName: "Firmware Engineering",
          leadName: "Devon Lane",
          verdict: "FEASIBLE",
          scopeSummary: "Firmware Requirements (FW-FRS-01). Pre-Certified Turnkey Firmware FW-LIB-001 (AIS-140 Stack v2.4.1). Low-level HAL and OBD-II J1962 communication verified.",
          internalRemarks: "Zero new firmware development lead time. Binary hash matches pre-certified TAC release.",
          clientHighlights: "Pre-tested automotive firmware stack with over-the-air update capability.",
          keyParameters: [
            { label: "Firmware Stack", value: "FW-LIB-001 (AIS-140 v2.4.1 Pre-Certified)" },
            { label: "Development Lead Time", value: "0 Weeks (Turnkey Stack)" },
            { label: "Protocol", value: "OBD-II J1962 / CAN" },
          ],
          signedAt: "14 Oct 2026, 12:00 IST",
          signatureHash: "SHA256:9b2c3d...slct1",
        },
        {
          deptCode: "SW",
          deptName: "Cloud & Application Software",
          leadName: "Siddharth Roy",
          verdict: "FEASIBLE",
          scopeSummary: "Software Requirements (SW-SRS-01). Telemetry state server endpoint configuration, standard AIS-140 MQTT payload mapping, and companion diagnostic tool setup.",
          internalRemarks: "Cloud broker endpoint provisioned. EOL automated test packet parser validated.",
          clientHighlights: "Immediate cloud connectivity with standard fleet telematics dashboard integration.",
          keyParameters: [
            { label: "Cloud Protocol", value: "AIS-140 Annexure 8 MQTT" },
            { label: "Telemetry Broker", value: "Pre-Configured Enterprise MQTT Broker" },
            { label: "Host Software", value: "Desktop Configuration GUI" },
          ],
          signedAt: "14 Oct 2026, 12:15 IST",
          signatureHash: "SHA256:1a2b3c...csw1",
        },
        {
          deptCode: "MECH",
          deptName: "Mechanical Engineering",
          leadName: "Samira Holt",
          verdict: "FEASIBLE",
          scopeSummary: "Standard IP67 polycarbonate enclosure ENC-LIB-001 + pass-through OBD-II harness HARN-LIB-002. Tooling and molds already active.",
          internalRemarks: "Existing injection tooling operational with zero modification needed.",
          clientHighlights: "Automotive-grade IP67 enclosure with plug-and-play OBD-II harness.",
          keyParameters: [
            { label: "Enclosure", value: "ENC-LIB-001 (Tooling Active)" },
            { label: "Harness", value: "HARN-LIB-002 (OBD-II Pass-through)" },
            { label: "Ingress Rating", value: "IP67 Waterproof" },
          ],
          signedAt: "14 Oct 2026, 12:30 IST",
          signatureHash: "SHA256:ac3d4e...slct1",
        },
        {
          deptCode: "PUR",
          deptName: "Purchasing & Supply Chain",
          leadName: "Morgan Reed",
          verdict: "FEASIBLE",
          scopeSummary: "Components mapped to established high-volume ASL suppliers. Target BOM cost $35.42 achievable at 10,000 units/year.",
          internalRemarks: "Standard reel inventory in stock at factory stores for 5,000 units.",
          clientHighlights: "Immediate component allocation with zero long-lead semiconductor risks.",
          keyParameters: [
            { label: "BOM Cost", value: "$35.42 / unit" },
            { label: "Component Availability", value: "Immediate Factory Stock" },
            { label: "Supplier Risk", value: "Zero (Qualified ASL)" },
          ],
          signedAt: "14 Oct 2026, 13:00 IST",
          signatureHash: "SHA256:bd4e5f...slct1",
        },
        {
          deptCode: "QA",
          deptName: "Quality Assurance & APQP",
          leadName: "Jordan Blake",
          verdict: "FEASIBLE",
          scopeSummary: "Existing iCAT TAC certificate leveraged under vehicle model extension. Full DVP&R pre-compliance completed.",
          internalRemarks: "Regression tests only required for harness connection. Zero deviations recorded.",
          clientHighlights: "Certified AIS-140 compliance backed by existing TAC report.",
          keyParameters: [
            { label: "DVP&R Status", value: "Pre-Certified (Platform Derivative)" },
            { label: "Type Approval", value: "iCAT Extension Applicable" },
            { label: "Battery Safety", value: "IS 16046 / NABL Valid" },
          ],
          signedAt: "14 Oct 2026, 13:30 IST",
          signatureHash: "SHA256:ce5f6a...slct1",
        },
        {
          deptCode: "FIN",
          deptName: "Accounts & Finance",
          leadName: "Priya Voss",
          verdict: "FEASIBLE",
          scopeSummary: "Commercial contract review: 10,000 units @ ₹3,450/unit (₹3.45 Cr annual volume). Zero NRE required.",
          internalRemarks: "Zero tooling NRE saves customer ₹6.5 Lakhs upfront cost.",
          clientHighlights: "Fast-track commercial clearance with zero NRE tooling cost.",
          keyParameters: [
            { label: "Order Value", value: "₹3,45,00,000 (10k units/yr)" },
            { label: "NRE Charge", value: "₹0 (100% Waived)" },
            { label: "Payment Terms", value: "20% Advance, Net 30 Days" },
          ],
          signedAt: "14 Oct 2026, 14:00 IST",
          signatureHash: "SHA256:df6a7b...slct1",
        },
      ];
    }

    // Default Tata Ace EV baseline (HLPL-AI4T-01)
    return [
      {
        deptCode: "EHW",
        deptName: "Embedded Hardware Engineering",
        leadName: "Avery Vale",
        verdict: "FEASIBLE",
        scopeSummary: "STM32F405VG automotive MCU, 9V-36V input with ISO 7637-2 TVS suppression, 4G Cat-1 + GNSS RF frontend, 4-layer stackup.",
        internalRemarks: "SM5S24A TVS diode selected for 24V load dump. Microstrip 50-ohm RF trace clearance verified on Layer 1.",
        clientHighlights: "Automotive AEC-Q100 hardware architecture with dual CAN bus and rugged IP67 transient protection.",
        keyParameters: [
          { label: "Nominal Voltage", value: "12V / 24V (9-36V Operating)" },
          { label: "Transient Immunity", value: "ISO 7637-2 Pulse 1, 2a/2b, 3a/3b, 5b" },
          { label: "PCB Layer Count", value: "4-Layer FR4 (1.6mm thickness)" },
        ],
        signedAt: "14 Oct 2026, 16:30 IST",
        signatureHash: "SHA256:7e8a9f...c31b",
      },
      {
        deptCode: "FW",
        deptName: "Firmware Engineering",
        leadName: "Devon Lane",
        verdict: "FEASIBLE",
        scopeSummary: "Firmware Requirements (FW-FRS-01). FreeRTOS v10.4 kernel, STM32F405 HAL bring-up, CAN J1939 telemetry stack, dual-bank bootloader for fail-safe OTA updates.",
        internalRemarks: "Flash allocation: 512KB fits application (340KB) + bootloader (64KB). Dual-bank partition ensures rollback on OTA power drop.",
        clientHighlights: "AEC-Q compliant embedded firmware with fail-safe bootloader and live over-the-air updates.",
        keyParameters: [
          { label: "RTOS Kernel", value: "FreeRTOS v10.4 (AEC-Q compliant)" },
          { label: "CAN Protocol", value: "J1939 @ 250kbps / 500kbps" },
          { label: "OTA Rollback", value: "Dual-Bank Flash + CRC32" },
        ],
        signedAt: "14 Oct 2026, 17:15 IST",
        signatureHash: "SHA256:4d2c8b...e901",
      },
      {
        deptCode: "SW",
        deptName: "Cloud & Application Software",
        leadName: "Siddharth Roy",
        verdict: "FEASIBLE",
        scopeSummary: "Software Requirements (SW-SRS-01). AIS-140 emergency protocol engine, MQTT encrypted telemetry parser, cloud broker integration, and desktop diagnostic flashing tools.",
        internalRemarks: "AIS-140 packet schema validated against MoRTH server requirements. Desktop test rig host tool SW-TOOL-01 integrated with automated line testing.",
        clientHighlights: "Full AIS-140 compliance software with TLS 1.3 encrypted telemetry transmission.",
        keyParameters: [
          { label: "Telemetry Engine", value: "AIS-140 MQTT / TLS 1.3" },
          { label: "Server Integration", value: "MoRTH National Tracking Portal" },
          { label: "Diagnostic Suite", value: "Desktop Configuration & Flashing GUI" },
        ],
        signedAt: "14 Oct 2026, 17:40 IST",
        signatureHash: "SHA256:2b3c4d...csw0",
      },
      {
        deptCode: "MECH",
        deptName: "Mechanical Engineering",
        leadName: "Samira Holt",
        verdict: "FEASIBLE",
        scopeSummary: "Custom IP67 UV-stabilized polycarbonate enclosure, molded silicone gasket seal, Molex MX150 automotive-grade waterproof connector.",
        internalRemarks: "Thermal simulation: maximum internal junction temperature 68°C at 85°C ambient under full 4G transmission burst.",
        clientHighlights: "Rugged automotive IP67 waterproof enclosure tested for commercial electric vehicle chassis mounting.",
        keyParameters: [
          { label: "Enclosure Ingress", value: "IP67 (1m water immersion / 30 min)" },
          { label: "Material", value: "Polycarbonate UV-Stabilized (UL94-V0)" },
          { label: "Vibration Standard", value: "AIS-140 Annexure 8 Random Vibration" },
        ],
        signedAt: "14 Oct 2026, 18:00 IST",
        signatureHash: "SHA256:9a11ef...55bc",
      },
      {
        deptCode: "PUR",
        deptName: "Purchasing & Supply Chain",
        leadName: "Morgan Reed",
        verdict: "FEASIBLE_WITH_CONDITIONS",
        scopeSummary: "Tier-1 ASL component pipeline, 50,000 unit volume pricing, supplier PPAP Level 3 readiness, target BOM cost $35.42.",
        internalRemarks: "Quectel 4G modem has 14-week lead time. Recommend releasing advance long-lead PO for first 10,000 units by Week 16.",
        clientHighlights: "Strategic semiconductor allocation secured for 50,000 units/year with dual-sourcing on critical passives.",
        keyParameters: [
          { label: "BOM Cost Target", value: "$35.42 / unit (Achievable at 50k qty)" },
          { label: "Critical Lead Time", value: "14 Weeks (Quectel EC200U modem)" },
          { label: "ASL Sourcing Risk", value: "Low (Dual-source on power ICs)" },
        ],
        signedAt: "14 Oct 2026, 18:45 IST",
        signatureHash: "SHA256:1f78ea...a412",
      },
      {
        deptCode: "QA",
        deptName: "Quality Assurance & APQP",
        leadName: "Jordan Blake",
        verdict: "FEASIBLE",
        scopeSummary: "18-test DVP&R matrix planned, ARAI/ICAT type approval schedule, IATF 16949 §8.2.3 contract review sign-off.",
        internalRemarks: "Pre-compliance EMC/ESD tests to be executed in-house before sending golden units to ARAI Pune.",
        clientHighlights: "Comprehensive automotive qualification framework ensuring zero-defect release and TAC certification.",
        keyParameters: [
          { label: "DVP&R Suite", value: "18 Tests (Electrical & Environmental)" },
          { label: "Governing Standard", value: "IATF 16949:2016 & AIS-140" },
          { label: "APQP Milestone", value: "Gate 2 (Feasibility Sign-off)" },
        ],
        signedAt: "14 Oct 2026, 19:10 IST",
        signatureHash: "SHA256:b6329c...887f",
      },
      {
        deptCode: "FIN",
        deptName: "Accounts & Finance",
        leadName: "Priya Voss",
        verdict: "FEASIBLE",
        scopeSummary: "Commercial contract review: unit price ₹4,067, order value ₹20.33 Cr, 30% advance deposit terms verified.",
        internalRemarks: "Advance deposit of ₹6.10 Cr covers prototype tooling and component buffer procurement.",
        clientHighlights: "Approved commercial proposal with milestone-based invoicing and statutory GST compliance.",
        keyParameters: [
          { label: "Programme Value", value: "₹20,33,50,000 ($2.45M)" },
          { label: "Advance Payment", value: "30% (₹6,10,05,000) Upon PO" },
          { label: "HSN Code", value: "852610 (Radar/Radio Navigation)" },
        ],
        signedAt: "14 Oct 2026, 19:30 IST",
        signatureHash: "SHA256:3c810d...fe55",
      },
    ];
  };

  const reviews = getProjectReviews();

  return (
    <div className="space-y-6">
      {/* Top Gate Navigation Stepper */}
      <div className="rounded-xl border border-steel/30 bg-panel/60 p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-steel">
              Project Lifecycle Feasibility & Engineering Gate Engine
            </span>
            <p className="text-xs font-semibold text-foreground">
              {projectId} · {activeConfig.projectTitle}
            </p>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-muted-foreground">Current Project Stage:</span>
            <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">
              Stage {currentStageIndex + 1}
            </span>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            onClick={() => setSelectedGate(1)}
            className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
              selectedGate === 1
                ? "border-primary bg-primary/10 font-bold text-primary"
                : currentStageIndex >= 1
                  ? "border-emerald-500/30 bg-card text-foreground hover:bg-secondary"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px]">
              {currentStageIndex >= 1 ? <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" /> : "1"}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs">Stage 1: Intake</span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">SOR & mNDA</span>
            </div>
          </button>

          <button
            onClick={() => setSelectedGate(2)}
            className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
              selectedGate === 2
                ? "border-primary bg-primary/10 font-bold text-primary"
                : currentStageIndex >= 2
                  ? "border-emerald-500/30 bg-card text-foreground hover:bg-secondary"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px]">
              {currentStageIndex >= 2 ? <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" /> : "2"}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs">Stage 2: Feasibility</span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">HLPL/F/MKT/01</span>
            </div>
          </button>

          <button
            onClick={() => setSelectedGate(3)}
            className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
              selectedGate === 3
                ? "border-primary bg-primary/10 font-bold text-primary"
                : currentStageIndex >= 3
                  ? "border-emerald-500/30 bg-card text-foreground hover:bg-secondary"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px]">
              {currentStageIndex >= 3 ? <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" /> : "3"}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs">Stage 3: Req Lock</span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">PRS-01 & QUO-01</span>
            </div>
          </button>

          <button
            onClick={() => setSelectedGate(4)}
            className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
              selectedGate === 4
                ? "border-primary bg-primary/10 font-bold text-primary"
                : currentStageIndex >= 4
                  ? "border-emerald-500/30 bg-card text-foreground hover:bg-secondary"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px]">
              {currentStageIndex >= 4 ? <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" /> : "4"}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs">Stage 4/5: Kick-Off</span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">PoC vs SMT Pilot</span>
            </div>
          </button>
        </div>
      </div>

      {/* GATE 1: Sales Intake & Customer SOR Gate */}
      {selectedGate === 1 && (
        <div className="rounded-xl border border-steel/30 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-steel/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-steel">
                  Stage 1 Gate
                </span>
                <span className="font-mono text-xs text-muted-foreground">Sales Intake & Customer Baseline</span>
              </div>
              <h3 className="mt-1 text-base font-bold text-foreground">
                Customer SOR & Bilateral NDA Verification
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Per Master Plan §4: Intake captures the customer Statement of Requirements (SOR) and confirms the Mutual NDA before dispatching for technical feasibility.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" /> Intake Evidence Verified
            </span>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {/* Customer SOR */}
            <div className="rounded-lg border border-border bg-panel/70 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-bold text-foreground">
                    Sales Deliverable
                  </span>
                  <h4 className="mt-2 text-sm font-bold text-foreground">Customer Statement of Requirements (SOR)</h4>
                  <p className="font-mono text-xs text-muted-foreground">HLPL-AI4T-SAL-SOR-01 · Rev 01</p>
                </div>
                <button
                  onClick={() => onOpenDocumentView("HLPL-AI4T-SAL-SOR-01", "Customer SOR", "SAL")}
                  className="rounded p-1 text-steel hover:bg-secondary"
                  title="View complete SOR document"
                >
                  <ExternalLink className="size-4" />
                </button>
              </div>

              <div className="mt-3 space-y-1.5 rounded-md bg-secondary/50 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client:</span>
                  <span className="font-medium text-foreground">Tata Motors Limited (EV Fleet Division)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Application:</span>
                  <span className="font-medium text-foreground">Tata Ace EV 4G AIS-140 Telematics</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Volume:</span>
                  <span className="font-medium text-foreground">50,000 Units / Year</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Key Standards:</span>
                  <span className="font-medium text-foreground">AIS-140, ISO 7637-2, IP67</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="size-3.5" /> Client RFQ Baseline Locked
                </span>
                <span className="font-mono text-[10px]">Sales Lead: Priya Sharma</span>
              </div>
            </div>

            {/* Bilateral Mutual NDA */}
            <div className="rounded-lg border border-border bg-panel/70 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-bold text-foreground">
                    Legal & Compliance
                  </span>
                  <h4 className="mt-2 text-sm font-bold text-foreground">Bilateral Mutual Non-Disclosure Agreement</h4>
                  <p className="font-mono text-xs text-muted-foreground">HLPL-AI4T-SAL-mNDA-01 · Rev 01</p>
                </div>
                <button
                  onClick={() => onOpenDocumentView("HLPL-AI4T-SAL-mNDA-01", "Mutual NDA", "SAL")}
                  className="rounded p-1 text-steel hover:bg-secondary"
                  title="View complete mNDA document"
                >
                  <ExternalLink className="size-4" />
                </button>
              </div>

              <div className="mt-3 space-y-1.5 rounded-md bg-secondary/50 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Counterparty:</span>
                  <span className="font-medium text-foreground">Tata Motors Limited, Pune</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Term:</span>
                  <span className="font-medium text-foreground">3 Years (Confidentiality & IP Protection)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signatures:</span>
                  <span className="font-medium text-foreground">Dual Authorized Corporate Signatories</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IP Ownership:</span>
                  <span className="font-medium text-foreground">XYZ Pvt Ltd Retains Firmware & Circuit IP</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="size-3.5" /> Executed & Countersigned
                </span>
                <span className="font-mono text-[10px]">Legal/Ops: Taylor Quinn</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-primary/5 p-4 border border-primary/20">
            <div>
              <p className="text-xs font-bold text-foreground">
                Intake Complete — Ready for Multi-Department Technical Feasibility Handover
              </p>
              <p className="text-[11px] text-muted-foreground">
                Advancing will dispatch this requirement to Hardware (EHW), Firmware (ESW), Mechanical (MECH), Purchase (PUR), Quality (QA), and Finance (FIN).
              </p>
            </div>
            {!readOnly ? (
              <button
                onClick={() => {
                  onAdvanceToStage(1);
                  setSelectedGate(2);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90"
              >
                Dispatch for Feasibility Review <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-steel/30 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                <Lock className="size-3.5" /> Read-Only Gate · Sales / Admin Authorization Required
              </span>
            )}
          </div>
        </div>
      )}

      {/* GATE 2: Multi-Department Feasibility & Contract Review Gate */}
      {selectedGate === 2 && (
        <div className="rounded-xl border border-steel/30 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-steel/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-steel">
                  Stage 2 Gate
                </span>
                <span className="font-mono text-xs text-muted-foreground">HLPL/F/MKT/01</span>
              </div>
              <h3 className="mt-1 text-base font-bold text-foreground">
                Multi-Department Feasibility Review & Contract Review Gate
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Per Master Plan §4: Selected-department feasibility handover. All 6 functional HODs have evaluated technical, supply, quality, and commercial constraints.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" /> 6 of 6 HODs Signed
              </span>
            </div>
          </div>

          {/* Linked Modular Platform Assets & Development Skip Banner (Master Plan §5) */}
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-foreground">
                      Linked Pre-Qualified Platform Architecture ({activeConfig.architectureMode.replace(/_/g, " ").toUpperCase()})
                    </h4>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Master Plan §5 Reused Assets
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Project {projectId} references pre-qualified hardware and software. Development process for matching departments is waived.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 font-semibold text-xs text-emerald-700 dark:text-emerald-300">
                <span>⚡ <strong>{skipMetrics.weeksSaved} Weeks</strong> Dev Saved</span>
                <span>💰 <strong>{skipMetrics.nreSavedPct}% NRE</strong> Avoided</span>
                <span className="rounded bg-emerald-600 text-white px-2 py-0.5 font-mono text-[10px]">
                  Ready in ~{skipMetrics.effectiveWeeksToSample} Wks
                </span>
              </div>
            </div>

            {/* Chips row */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-primary/10 pt-2.5 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded bg-secondary px-2.5 py-1 font-mono text-muted-foreground">
                <Cpu className="size-3 text-primary" />
                Motherboard: {activeConfig.selectedPcbIds.map((id) => defaultPcbCatalog.find((p) => p.id === id)?.code || id).join(" + ") || "Custom PCB"}
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-secondary px-2.5 py-1 font-mono text-muted-foreground">
                <Cable className="size-3 text-primary" />
                Harness: {defaultHarnessCatalog.find((h) => h.id === activeConfig.selectedHarnessId)?.code || "Custom Harness"}
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-secondary px-2.5 py-1 font-mono text-muted-foreground">
                <Code2 className="size-3 text-primary" />
                Firmware: {defaultFirmwareCatalog.find((f) => f.id === activeConfig.selectedFirmwareId)?.code || "Custom FW"}
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-secondary px-2.5 py-1 font-mono text-muted-foreground">
                <Box className="size-3 text-primary" />
                Enclosure: {defaultEnclosureCatalog.find((e) => e.id === activeConfig.selectedEnclosureId)?.code || "Custom Tooling"}
              </span>
            </div>
          </div>

          {/* Department Feasibility Cards */}
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((rev) => (
              <div
                key={rev.deptCode}
                className="flex flex-col justify-between rounded-lg border border-border/80 bg-panel/60 p-4 transition-all hover:border-steel/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-bold text-foreground">
                      {rev.deptCode}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        rev.verdict === "FEASIBLE"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {rev.verdict === "FEASIBLE" ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <AlertTriangle className="size-3" />
                      )}
                      {rev.verdict.replace(/_/g, " ")}
                    </span>
                  </div>

                  <h4 className="mt-2 text-xs font-bold text-foreground">{rev.deptName}</h4>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">Lead: {rev.leadName}</p>

                  <p className="mt-2.5 text-xs leading-relaxed text-foreground/90">{rev.scopeSummary}</p>

                  {/* Key Parameters */}
                  <div className="mt-3 space-y-1.5 rounded-md bg-secondary/50 p-2.5 text-[10px]">
                    {rev.keyParameters.map((param) => (
                      <div key={param.label} className="flex justify-between">
                        <span className="text-muted-foreground">{param.label}:</span>
                        <span className="font-mono font-medium text-foreground">{param.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Internal Remarks vs Client Highlights */}
                  <div className="mt-3 space-y-2 text-[11px]">
                    <div className="rounded border-l-2 border-amber-500/60 bg-amber-500/5 p-2">
                      <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Internal Technical Remark (Confidential):
                      </span>
                      <p className="mt-0.5 text-muted-foreground">{rev.internalRemarks}</p>
                    </div>

                    <div className="rounded border-l-2 border-primary/60 bg-primary/5 p-2">
                      <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-primary">
                        Client-Visible Highlight:
                      </span>
                      <p className="mt-0.5 text-foreground/80">{rev.clientHighlights}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                  <span>{rev.signedAt}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{rev.signatureHash}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Gate Resolution Action Bar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-emerald-500/5 p-4 border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  All 6 Departments Approved — Contract Review Record HLPL/F/MKT/01 Ready
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Locking this gate validates the technical baseline and automatically unblocks Stage 3 (Requirement & Commercial Lock).
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onOpenDocumentView("HLPL/F/MKT/01", "Contract Review Record", "SAL")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <FileText className="size-3.5" /> View HLPL/F/MKT/01
              </button>
              {!readOnly ? (
                <button
                  onClick={() => {
                    onAdvanceToStage(2);
                    setSelectedGate(3);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90"
                >
                  <Lock className="size-3.5" /> Lock Feasibility & Advance to Stage 3 <ArrowRight className="size-3.5" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-steel/30 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <Lock className="size-3.5" /> Read-Only Gate · HOD Authorization Required
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GATE 3: Final Requirement Lock & Client Approval Gate */}
      {selectedGate === 3 && (
        <div className="rounded-xl border border-steel/30 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-steel/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-steel">
                  Stage 3 Gate
                </span>
                <span className="font-mono text-xs text-muted-foreground">IATF 16949 §8.2.3 Requirement Lock</span>
              </div>
              <h3 className="mt-1 text-base font-bold text-foreground">
                Client Approval & Final Requirement Baseline Lock
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Per Master Plan §5: Governed by HR/Operations & Sales. Formal approval of the final requirement specification (PRS/SRS), commercial quotation (QUO-01), and HR-OPS staffing & competency baseline freeze.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground cursor-help"
                title="Responsible Leads: Taylor Quinn (HR & Operations Lead) & Riley Stone / Priya Sharma (Sales Lead) — HR/SAL"
              >
                Lead: Taylor Quinn & Riley Stone (HR/SAL)
              </span>
              <span className="text-[10px] text-muted-foreground">
                HR/Operations Governance & Commercial Lead
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {/* Locked HR/OPS Competency Baseline (Pillar 1) */}
            <div className="rounded-lg border border-border bg-panel/70 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-bold text-foreground"
                    title="HR & Operations Governance (Staffing, Operator IPC Certifications & Safety)"
                  >
                    HR/OPS Governance Baseline
                  </span>
                  <h4 className="mt-2 text-sm font-bold text-foreground">
                    Competency & Safety Freeze (CRS)
                  </h4>
                  <p className="font-mono text-xs text-muted-foreground">HLPL-AI4T-HROPS-CRS-01 · Rev 01</p>
                </div>
                <button
                  onClick={() => onOpenDocumentView("HLPL-AI4T-HROPS-CRS-01", "Competency & Safety Freeze", "HR")}
                  className="rounded p-1 text-steel hover:bg-secondary"
                  title="View complete HR-OPS document"
                >
                  <ExternalLink className="size-4" />
                </button>
              </div>

              <div className="mt-3 space-y-2 rounded-md bg-secondary/50 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plant Competency:</span>
                  <span className="font-medium text-foreground">IPC-A-610 Class 3 Certified</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staffing Squad:</span>
                  <span className="font-medium text-foreground">Dedicated SMT & Assembly Cell</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EHS & Safety:</span>
                  <span className="font-medium text-foreground">ISO 45001 / Factories Act 1948</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resource Baseline:</span>
                  <span className="font-medium text-foreground">Locked under Rev 01 Freeze</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="size-3.5" /> Staffing & Safety Lock Confirmed
                </span>
                <span className="font-mono text-[10px]">HR Lead: Taylor Quinn</span>
              </div>
            </div>

            {/* Locked Quotation Baseline (Pillar 2) */}
            <div className="rounded-lg border border-border bg-panel/70 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-bold text-foreground"
                    title="Sales & Business Development (Customer Contract & Price Commitment)"
                  >
                    SAL Commercial Baseline
                  </span>
                  <h4 className="mt-2 text-sm font-bold text-foreground">
                    Commercial Quotation (QUO)
                  </h4>
                  <p className="font-mono text-xs text-muted-foreground">HLPL-AI4T-SAL-QUO-01 · Rev 01</p>
                </div>
                <button
                  onClick={() => onOpenDocumentView("HLPL-AI4T-SAL-QUO-01", "Commercial Quotation", "SAL")}
                  className="rounded p-1 text-steel hover:bg-secondary"
                  title="View complete Quotation document"
                >
                  <ExternalLink className="size-4" />
                </button>
              </div>

              <div className="mt-3 space-y-2 rounded-md bg-secondary/50 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Programme Volume:</span>
                  <span className="font-medium text-foreground">50,000 Units / Year</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit Selling Price:</span>
                  <span className="font-medium text-foreground">₹4,067 / device</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Contract Value:</span>
                  <span className="font-bold text-foreground">₹20,33,50,000 ($2.45M)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Milestones:</span>
                  <span className="font-medium text-foreground">30% Advance Deposit / 70% Dispatch</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="size-3.5" /> Commercial Lock Confirmed
                </span>
                <span className="font-mono text-[10px]">Sales Lead: Priya Sharma</span>
              </div>
            </div>

            {/* Locked PRS Baseline (Pillar 3 - Consulted Specification) */}
            <div className="rounded-lg border border-border bg-panel/70 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-bold text-foreground"
                    title="Embedded Hardware Engineering (Technical Requirements Consulted Input)"
                  >
                    EHW Technical Baseline (Consulted)
                  </span>
                  <h4 className="mt-2 text-sm font-bold text-foreground">
                    Product Requirement Spec (PRS)
                  </h4>
                  <p className="font-mono text-xs text-muted-foreground">HLPL-AI4T-EHW-PRS-01 · Rev 01</p>
                </div>
                <button
                  onClick={() => onOpenDocumentView("HLPL-AI4T-EHW-PRS-01", "Product Requirement Spec", "EHW")}
                  className="rounded p-1 text-steel hover:bg-secondary"
                  title="View complete PRS document"
                >
                  <ExternalLink className="size-4" />
                </button>
              </div>

              <div className="mt-3 space-y-2 rounded-md bg-secondary/50 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Controller:</span>
                  <span className="font-medium text-foreground">STM32F405VG Automotive MCU</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modem:</span>
                  <span className="font-medium text-foreground">4G LTE Cat-1 eSIM (2G Fallback)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle Telematics:</span>
                  <span className="font-medium text-foreground">AIS-140 Amd 1 & 2 + CAN J1939</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Enclosure:</span>
                  <span className="font-medium text-foreground">IP67 Polycarbonate UV-Stabilized</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="size-3.5" /> Technical Input Confirmed
                </span>
                <span className="font-mono text-[10px]">EHW Lead: Avery Vale</span>
              </div>
            </div>
          </div>

          {/* Recorded Client Approval Card */}
          <div className="mt-5 rounded-lg border border-steel/40 bg-steel/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-steel/15 text-steel">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Tata Motors Limited · EV Fleet Division, Pune
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Client Representative: <strong>Rajesh Sharma (Lead D&D EV)</strong> · Recorded Sign-off:{" "}
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">mNDA-01 & SOR-01 Approved</span>
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                CLIENT SIGN-OFF RECORDED ✓
              </span>
            </div>

            {/* Change Control Loop 1 Warning */}
            <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <p>
                  <strong>Change Control Loop 1 Active:</strong> Locking this requirement baseline creates an immutable
                  reference revision. Any subsequent customer amendment requires formal engineering re-assessment and
                  marks all existing stage approvals STALE until re-confirmed.
                </p>
              </div>
            </div>
          </div>

          {/* Gate Action */}
          <div className="mt-6 flex justify-end gap-3">
            {!readOnly ? (
              <button
                onClick={() => {
                  onAdvanceToStage(3);
                  setSelectedGate(4);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90"
              >
                <Lock className="size-4" /> Confirm Final Requirement Lock & Authorize Hardware Team Kick-Off{" "}
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg border border-steel/30 bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-4" /> Read-Only Gate · Engineering / Sales Authorization Required
              </span>
            )}
          </div>
        </div>
      )}

      {/* GATE 4/5: Hardware Team Path Decision — PoC vs Direct Pilot */}
      {selectedGate === 4 && (
        <div className="rounded-xl border border-steel/30 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-steel/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-steel">
                  Stage 4 & 5 Decision
                </span>
                <span className="font-mono text-xs text-muted-foreground">Master Plan §5 Hardware Kick-off</span>
              </div>
              <h3 className="mt-1 text-base font-bold text-foreground">
                Hardware Team Technical Path: Research / PoC vs. Direct SMT Pilot Build
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Per Master Plan §5: Hardware proposes the appropriate technical path: use an optional Research / POC
                phase for unresolved assumptions, or record a justified direct Pilot bypass for proven designs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
                Selected: {hardwarePath === "poc" ? "Research / PoC Track (Stage 4)" : "Direct SMT Pilot Track (Stage 5)"}
              </span>
            </div>
          </div>

          {/* Pre-Certified Platform Fast-Track Waiver Banner (Master Plan §5) */}
          {skipMetrics.canSkipStage4PoC && (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-100">
                        Pre-Certified Platform Architecture Detected · Stage 4 PoC Waived
                      </h4>
                      <span className="rounded bg-emerald-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                        ⚡ 14-17 WEEKS SAVED
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-200">
                      Motherboard ({activeConfig.selectedPcbIds.join(", ")}) & Firmware ({activeConfig.selectedFirmwareId}) are automotive pre-qualified under AIS-140 / AEC-Q100. Bench PoC bring-up is waived; project is authorized to jump directly to Stage 5 SMT Pilot Build!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHardwarePath("pilot")}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                >
                  Select Direct Pilot Track
                </button>
              </div>
            </div>
          )}

          {/* Interactive Path Selection Grid */}
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {/* OPTION A: Research / PoC Track */}
            <div
              onClick={() => setHardwarePath("poc")}
              className={`cursor-pointer rounded-xl border p-5 transition-all ${
                hardwarePath === "poc"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-panel/60 hover:border-steel/40"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex size-8 items-center justify-center rounded-lg ${
                      hardwarePath === "poc" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Microchip className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Option A: Research / PoC Track</h4>
                    <span className="font-mono text-[11px] text-muted-foreground">Stage 4 · Bench Validation</span>
                  </div>
                </div>
                <input
                  type="radio"
                  checked={hardwarePath === "poc"}
                  onChange={() => setHardwarePath("poc")}
                  className="size-4 text-primary"
                />
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Recommended when unproven assumptions or new silicon require bench verification before investing in SMT
                tooling or custom enclosures.
              </p>

              <div className="mt-4 space-y-2 rounded-md bg-secondary/50 p-3 text-xs">
                <p className="font-semibold text-foreground">PoC Investigation Objectives:</p>
                <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
                  <li>Validate CAN J1939 bus loading stability under 500kbps telemetry packets.</li>
                  <li>Verify STM32F405 thermal dissipation under 24V supply and 4G transmission bursts.</li>
                  <li>Perform RF sensitivity and antenna impedance matching for internal patch antenna.</li>
                </ul>
              </div>

              <div className="mt-3 border-t border-border/50 pt-3 text-[11px]">
                <p className="text-muted-foreground">
                  <strong>Exit Deliverables:</strong> Schematics <span className="font-mono text-steel">EHW-SCH-01</span>,
                  Preliminary BOM <span className="font-mono text-steel">EHW-BOM-00</span>, MCU Bring-up Report.
                </p>
              </div>
            </div>

            {/* OPTION B: Justified Direct Pilot Bypass */}
            <div
              onClick={() => setHardwarePath("pilot")}
              className={`cursor-pointer rounded-xl border p-5 transition-all ${
                hardwarePath === "pilot"
                  ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20"
                  : "border-border bg-panel/60 hover:border-steel/40"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex size-8 items-center justify-center rounded-lg ${
                      hardwarePath === "pilot"
                        ? "bg-emerald-600 text-white"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Zap className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground">Option B: Justified Direct Pilot Bypass</h4>
                      {skipMetrics.canSkipStage4PoC && (
                        <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          RECOMMENDED (PLATFORM REUSED)
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                      Stage 5 · Skip to SMT Pilot Build
                    </span>
                  </div>
                </div>
                <input
                  type="radio"
                  checked={hardwarePath === "pilot"}
                  onChange={() => setHardwarePath("pilot")}
                  className="size-4 text-emerald-600"
                />
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Master Plan §5 rule: For a justified proven/reused design, authorized reviewers record why POC is not
                needed and proceed directly to SMT pilot without fabricating mock evidence.
              </p>

              <div className="mt-4 space-y-2 rounded-md bg-secondary/50 p-3 text-xs">
                <p className="font-semibold text-foreground">Recorded Technical Justification:</p>
                <p className="text-[11px] italic leading-relaxed text-muted-foreground">
                  "Core STM32 and 4G Cat-1 cellular architecture is pre-qualified and reused from the certified
                  HLPL-SLCT automotive platform (AIS-140 / AEC-Q100). Zero unproven silicon or high-risk interfaces exist.
                  Technical reviewers authorize direct progression to Stage 5 SMT Line 2 Pilot Build and Control Plan
                  EMF-CP-01."
                </p>
                <div className="flex justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                  <span>Authorized by: Avery Vale (EHW Lead)</span>
                  <span>Jordan Blake (QA Lead)</span>
                </div>
              </div>

              <div className="mt-3 border-t border-border/50 pt-3 text-[11px]">
                <p className="text-muted-foreground">
                  <strong>Exit Deliverables:</strong> SMT Line 2 Thermal Profile, Process Control Plan{" "}
                  <span className="font-mono text-steel">EMF-CP-01</span>, PUR Proto Tooling.
                </p>
              </div>
            </div>
          </div>

          {/* Hardware Team Kick-off Dossier */}
          <div className="mt-6 rounded-lg border border-border bg-panel/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-steel">
                  Hardware Team Operational Dossier
                </p>
                <h4 className="mt-1 text-sm font-bold text-foreground">
                  {projectId} · Active Engineering Kick-Off Squad
                </h4>
              </div>
              <span className="rounded bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Squad Ready for Work
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded border border-border/60 bg-secondary/40 p-2.5">
                <span className="font-mono text-[10px] text-muted-foreground">Lead HW Architect</span>
                <p className="mt-0.5 font-bold text-foreground">Avery Vale</p>
                <p className="text-[10px] text-muted-foreground">Schematic SCH-01 & BOM-00 Release</p>
              </div>
              <div className="rounded border border-border/60 bg-secondary/40 p-2.5">
                <span className="font-mono text-[10px] text-muted-foreground">Power & Transient Engineer</span>
                <p className="mt-0.5 font-bold text-foreground">Elena Rostova</p>
                <p className="text-[10px] text-muted-foreground">9V-36V ISO 7637-2 Power Path</p>
              </div>
              <div className="rounded border border-border/60 bg-secondary/40 p-2.5">
                <span className="font-mono text-[10px] text-muted-foreground">Firmware PoC Specialist</span>
                <p className="mt-0.5 font-bold text-foreground">Devon Lane</p>
                <p className="text-[10px] text-muted-foreground">CAN J1939 Telemetry Parser Bring-Up</p>
              </div>
            </div>
          </div>

          {/* Execution Status Feedback if Launched */}
          {hardwareKickoffLaunched && (
            <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    Hardware Kick-Off Active:{" "}
                    {hardwarePath === "poc" ? "Stage 4 (Research / PoC Track)" : "Stage 5 (Direct SMT Pilot Track)"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Engineering tasks dispatched to Avery Vale, Devon Lane, and Casey Rowan. Drive folders{" "}
                    <span className="font-mono text-steel">03_Hardware_Deliverables_ECAD</span> and{" "}
                    <span className="font-mono text-steel">05_Firmware_and_Software</span> are active.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Launch Action */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              {hardwarePath === "poc"
                ? "Launching Research / PoC will advance the project to Stage 4 and initialize the bench bring-up squad."
                : "Authorizing Direct Pilot will advance the project directly to Stage 5 SMT Line 2 Setup with recorded justification."}
            </p>

            {!readOnly ? (
              <button
                onClick={() => {
                  setHardwareKickoffLaunched(true);
                  const nextStageIndex = hardwarePath === "poc" ? 3 : 4;
                  onAdvanceToStage(nextStageIndex);
                  const deliverables = hardwarePath === "poc"
                    ? ["HLPL-AI4T-EHW-SCH-01", "HLPL-AI4T-EHW-BOM-00", "CAN-J1939-PoC"]
                    : ["HLPL-AI4T-EMF-CP-01", "SMT-LINE2-PROFILE", "PUR-TOOLING-PO"];
                  onKickoffComplete?.(hardwarePath, deliverables);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700"
              >
                <Zap className="size-4" /> Authorize Hardware Team Kick-Off & Launch{" "}
                {hardwarePath === "poc" ? "PoC Track (Stage 4)" : "Direct Pilot (Stage 5)"}{" "}
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg border border-steel/30 bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-4" /> Read-Only Gate · Hardware HOD Authorization Required
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  MessageSquare,
  Clock,
  ArrowRight,
  Lock,
  CheckCircle2,
  Cpu,
  Layers,
  Shield,
  FileText,
  Sparkles,
  Plus,
  Send,
  Edit3,
  AlertTriangle,
  Battery,
  Radio,
  Award,
  Users,
  ChevronRight,
  Building2,
  FileCheck2,
} from "lucide-react";
import type { Persona } from "@/components/RoleAwareSidebar";
import { type DepartmentChronicle, deriveDeliverablesForStage } from "@/lib/department-chronicles";

export type StageComment = {
  id: string;
  author: string;
  departmentCode: string;
  role: string;
  timestamp: string;
  content: string;
  badge?: string;
};

export type StageDeliverable = {
  docId: string;
  title: string;
  dept: string;
  status: "Approved" | "In Review" | "Draft";
  description: string;
};

export type StageInfo = {
  stageNumber: number;
  stageCode: string;
  title: string;
  apqpMilestone: string;
  leadName: string;
  leadDept: string;
  leadRole: string;
  alignedTeam: string[];
  summary: string;
  hardwareNote?: string;
  regulatoryNote?: string;
  batteryNote?: string;
  deliverables: StageDeliverable[];
  defaultComments: StageComment[];
};

export const projectLifecycleData: Record<string, {
  projectCode: string;
  title: string;
  customer: string;
  architectureMode: "reusable_platform" | "hybrid_variant";
  pcbInfo: string;
  batteryInfo: string;
  agencyInfo: string;
  stages: StageInfo[];
}> = {
  "HLPL-BCU-02": {
    projectCode: "HLPL-BCU-02",
    title: "Ashok Leyland Telematics & BLE Sensor Gateway (OEM Modification)",
    customer: "Ashok Leyland Limited · Heavy Commercial Vehicles, Chennai",
    architectureMode: "hybrid_variant",
    pcbInfo: "Modified PCB HLPL-MOD-PCB-04-BLE (Rev 01): Adding Nordic nRF52840 BLE 5.2 SoC + 2.4GHz ceramic antenna to ready PCB-01",
    batteryInfo: "3.7V 1000mAh Lithium-ion Backup Battery (NABL Accredited Tested to IS 16046 Part 2 / UN 38.3)",
    agencyInfo: "iCAT (International Centre for Automotive Technology, Manesar) AIS-140 Annexure 8 TAC Form 22",
    stages: [
      {
        stageNumber: 1,
        stageCode: "Stage 1",
        title: "Client & Sales Intake (SOR & Bilateral NDA)",
        apqpMilestone: "Phase 1: Concept & Voice of Customer",
        leadName: "Riley Stone",
        leadDept: "SAL",
        leadRole: "Sales & Business Development Lead",
        alignedTeam: ["Mr. K. Ramanathan (Ashok Leyland SPOC)", "Avery Vale (EHW Lead)"],
        summary: "Customer SOR HLPL-ALFL-SAL-SOR-01 logged for Ashok Leyland commercial vehicle fleet. Requires 4G Cat-1 AIS-140 tracking + Bluetooth Low Energy (BLE 5.2) sensor aggregator for wireless TPMS and cold-chain temperature tags.",
        hardwareNote: "Ready PCB HLPL-MOD-PCB-01 lacks onboard BLE. Hardware team flag: requires PCB modification spin adding BLE SoC.",
        batteryNote: "OEM mandates internal 3.7V Lithium-ion battery for 8-hour continuous emergency tracking during cabin power-loss.",
        regulatoryNote: "Mandatory AIS-140 compliance, WPC ETA approval for 2.4GHz BLE radio, and iCAT type approval.",
        deliverables: [
          { docId: "HLPL-ALFL-SAL-SOR-01", title: "Customer Statement of Requirements (SOR)", dept: "SAL", status: "Approved", description: "15,000 units/year telematics requirement with dual CAN and BLE 5.2 sensor hub." },
          { docId: "HLPL-ALFL-SAL-mNDA-01", title: "Mutual Non-Disclosure Agreement (mNDA)", dept: "SAL", status: "Approved", description: "Bilateral IP protection executed between XYZ Pvt Ltd and Ashok Leyland Limited." },
        ],
        defaultComments: [
          {
            id: "c1-1",
            author: "Riley Stone",
            departmentCode: "SAL",
            role: "Sales Lead",
            timestamp: "06 Oct 2026, 10:15 IST",
            content: "Ashok Leyland SOR received for Boss & e-Dost commercial vehicles. Volume: 15,000 units/year. Crucial requirement: must pair with wireless BLE tire pressure sensors and refrigerated cargo temperature tags.",
          },
          {
            id: "c1-2",
            author: "Avery Vale",
            departmentCode: "EHW",
            role: "Embedded Hardware Lead",
            timestamp: "06 Oct 2026, 11:30 IST",
            content: "Reviewed SOR. Our existing ready PCB-01 does not have BLE. We will propose modifying PCB-01 to add Nordic nRF52840 BLE 5.2 SoC and 2.4GHz ceramic antenna at Stage 2 Feasibility.",
            badge: "Hardware Modification Required",
          },
        ],
      },
      {
        stageNumber: 2,
        stageCode: "Stage 2",
        title: "Multi-Department Feasibility Analysis & Contract Review",
        apqpMilestone: "Phase 1: Feasibility Gate (Master Plan §4)",
        leadName: "Cross-Functional HOD Panel",
        leadDept: "EHW/ESW/MECH/PUR/QA/FIN",
        leadRole: "All 6 Department Leads",
        alignedTeam: ["Avery Vale (EHW)", "Devon Lane (ESW)", "Samira Holt (MECH)", "Morgan Reed (PUR)", "Jordan Blake (QA)", "Priya Voss (FIN)"],
        summary: "Comprehensive multi-department feasibility review evaluating the BLE hardware addition to the ready PCB. All 6 departments (EHW, ESW, MECH, PUR, QA, FIN) reviewed technical, supply chain, and financial impacts and signed Contract Review Record HLPL/F/MKT/01.",
        hardwareNote: "EHW confirms feasibility of spinning PCB-LIB-004 (HLPL-MOD-PCB-04-BLE Rev 01). Dedicated 3.3V LDO and 50Ω RF trace clearance verified.",
        batteryNote: "3.7V 1000mAh Lithium-ion battery charging circuit designed with 300mA CC/CV profile and NTC thermal safety cutoff.",
        regulatoryNote: "QA scheduled witness testing slot with iCAT Manesar and NABL battery lab.",
        deliverables: [
          { docId: "HLPL/F/MKT/01", title: "Cross-Department Feasibility Review Record", dept: "SAL", status: "Approved", description: "6 HOD sign-offs approving the BLE hardware modification and revised timeline." },
          { docId: "HLPL-BCU-EHW-FEAS-01", title: "Hardware Feasibility Assessment & ECN Outline", dept: "EHW", status: "Approved", description: "Layout delta analysis for adding Nordic nRF52840 BLE SoC to 4-layer PCB." },
        ],
        defaultComments: [
          {
            id: "c2-1",
            author: "Avery Vale",
            departmentCode: "EHW",
            role: "Embedded Hardware Lead",
            timestamp: "08 Oct 2026, 14:00 IST",
            content: "EHW Feasibility: APPROVED. We can spin PCB Rev 04-BLE by adding Nordic nRF52840 SoC on Layer 1 with matched 2.4GHz ceramic chip antenna. 3.7V Li-ion battery charging circuit integrated.",
            badge: "EHW Sign-off",
          },
          {
            id: "c2-2",
            author: "Devon Lane",
            departmentCode: "FW",
            role: "Firmware Lead",
            timestamp: "08 Oct 2026, 14:45 IST",
            content: "FW Feasibility & FRS-01: APPROVED. FreeRTOS + Zephyr BLE 5.2 controller will aggregate sensor tags and support fail-safe dual-bank OTA rollback.",
            badge: "FW Sign-off",
          },
          {
            id: "c2-2b",
            author: "Siddharth Roy",
            departmentCode: "SW",
            role: "Cloud & Application Software Lead",
            timestamp: "08 Oct 2026, 15:00 IST",
            content: "SW Feasibility & SRS-01: APPROVED. AIS-140 Annexure 8 MQTT telemetry parser and Bluetooth GATT server schema validated for fleet telematics backend.",
            badge: "SW Sign-off",
          },
          {
            id: "c2-3",
            author: "Samira Holt",
            departmentCode: "MECH",
            role: "Mechanical Lead",
            timestamp: "08 Oct 2026, 15:20 IST",
            content: "MECH Feasibility: APPROVED. Adding 2.4GHz RF transparent window on polycarbonate lid. Shock-absorbing internal foam retains 3.7V Li-ion battery securely under 1.5m drop.",
            badge: "MECH Sign-off",
          },
          {
            id: "c2-4",
            author: "Morgan Reed",
            departmentCode: "PUR",
            role: "Purchasing Lead",
            timestamp: "08 Oct 2026, 16:00 IST",
            content: "PUR Feasibility: APPROVED WITH CONDITIONS. Nordic nRF52840 lead time is 10 weeks; 500 engineering samples secured from authorized distributor. Incremental BOM: +$3.15/unit.",
            badge: "PUR Sign-off",
          },
          {
            id: "c2-5",
            author: "Jordan Blake",
            departmentCode: "QA",
            role: "Quality Lead",
            timestamp: "08 Oct 2026, 16:30 IST",
            content: "QA Feasibility: APPROVED. DVP&R matrix updated to include iCAT agency TAC witness testing, NABL 3.7V Li-ion battery testing (IS 16046 / UN 38.3), and BLE RF radiated power testing.",
            badge: "QA Sign-off",
          },
          {
            id: "c2-6",
            author: "Priya Voss",
            departmentCode: "FIN",
            role: "Finance Lead",
            timestamp: "08 Oct 2026, 17:00 IST",
            content: "FIN Feasibility: APPROVED. Modification NRE: ₹1.85 Lakhs tooling + ₹2.40 Lakhs iCAT/NABL agency testing fees. Client agreed to absorb 50% NRE on 15,000 units commitment.",
            badge: "FIN Sign-off",
          },
        ],
      },
      {
        stageNumber: 3,
        stageCode: "Stage 3",
        title: "Requirement Freeze & Commercial Baseline Lock",
        apqpMilestone: "Phase 2: Product Design & Development Kickoff",
        leadName: "Avery Vale & Riley Stone",
        leadDept: "EHW/SAL",
        leadRole: "System Architect & Commercial Lead",
        alignedTeam: ["Mr. K. Ramanathan (Client SPOC)", "Priya Voss (Finance Lead)", "Taylor Quinn (HR/Operations Lead)"],
        summary: "Auto-compiled Product Requirement Specification (PRS HLPL-BCU-EHW-PRS-01), Commercial Quotation HLPL-BCU-SAL-QUO-02, and HR-OPS Requirement Freeze frozen and signed by Ashok Leyland. 30% advance deposit confirmed.",
        hardwareNote: "Architecture baseline locked: Modified PCB HLPL-MOD-PCB-04-BLE, Molex MX150 harness, and SABIC Lexan enclosure with RF window.",
        batteryNote: "Battery specification locked: 3.7V 1000mAh Lithium-ion pouch cell with internal protection circuit module (PCM).",
        regulatoryNote: "Design targets locked against AIS-140 Amendment 2 and CMVR Rule 125H.",
        deliverables: [
          { docId: "HLPL-BCU-EHW-PRS-01", title: "Product Requirement Specification (PRS - Frozen)", dept: "EHW", status: "Approved", description: "Comprehensive specification covering BLE 5.2, dual CAN, 3.7V Li-ion battery, and IP67." },
          { docId: "HLPL-BCU-SAL-QUO-02", title: "Commercial Quotation & Volume Tiers", dept: "SAL", status: "Approved", description: "₹4,480 / unit across 15,000 units/year commitment with 50% NRE contribution." },
          { docId: "HLPL-BCU-HROPS-CRS-01", title: "Competency & Safety Requirement Freeze (HR-OPS)", dept: "HR", status: "Approved", description: "Resource planning, training certifications and plant staffing matrix frozen." },
        ],
        defaultComments: [
          {
            id: "c3-1",
            author: "Riley Stone",
            departmentCode: "SAL",
            role: "Sales Lead",
            timestamp: "10 Oct 2026, 11:00 IST",
            content: "Quotation signed by Ashok Leyland SCM. Client acknowledged ₹1.85L tooling NRE share and confirmed 15k volume schedule.",
          },
          {
            id: "c3-2",
            author: "Avery Vale",
            departmentCode: "EHW",
            role: "Embedded Hardware Lead",
            timestamp: "10 Oct 2026, 12:30 IST",
            content: "PRS HLPL-BCU-EHW-PRS-01 frozen. Baseline revision locked. Advancing to Stage 4 Hardware Schematics & Layout spin.",
          },
        ],
      },
      {
        stageNumber: 4,
        stageCode: "Stage 4",
        title: "Design & Development: PCB Modification & BLE Hardware Addition",
        apqpMilestone: "Phase 2: Product Design Verification & Prototype",
        leadName: "Avery Vale",
        leadDept: "EHW",
        leadRole: "Embedded Hardware Engineering Lead",
        alignedTeam: ["Devon Lane (ESW Lead)", "Samira Holt (MECH Lead)"],
        summary: "Execution of hardware modification: ECN-2026-BLE-01 implemented on ready PCB-01 layout. Integrated Nordic nRF52840 BLE 5.2 radio, 2.4GHz ceramic antenna with 50Ω microstrip feed, dedicated 3.3V ultra-low-noise LDO, and 3.7V Li-ion battery charging circuit.",
        hardwareNote: "Schematic HLPL-BCU-EHW-SCH-01 and 4-layer Gerber package HLPL-MOD-PCB-04-BLE Rev 01 released with zero DRC violations.",
        batteryNote: "Lithium-ion 3.7V battery charging path validated on bench: 300mA CC charging, automatic cutoff at 4.20V ±15mV, thermal shutdown at 45°C.",
        regulatoryNote: "Pre-compliance RF simulation in Keysight ADS confirms 2.4GHz return loss < -18dB at 2440MHz center frequency.",
        deliverables: [
          { docId: "HLPL-BCU-EHW-SCH-01", title: "Complete Hardware Schematics (Rev 01 with BLE)", dept: "EHW", status: "Approved", description: "STM32F405 + Nordic nRF52840 BLE 5.2 subsystem, 3.7V Li-ion charger, and dual CAN." },
          { docId: "HLPL-BCU-EHW-BOM-01", title: "Engineering Bill of Materials (BOM)", dept: "EHW", status: "Approved", description: "168 active and passive components with dual-sourcing mapping." },
          { docId: "HLPL-BCU-EHW-GER-01", title: "4-Layer PCB Gerber & Drill Package", dept: "EHW", status: "Approved", description: "FR4 TG170 1.6mm ENIG fabrication archive ready for SMT tooling." },
        ],
        defaultComments: [
          {
            id: "c4-1",
            author: "Avery Vale",
            departmentCode: "EHW",
            role: "Embedded Hardware Lead",
            timestamp: "12 Oct 2026, 15:00 IST",
            content: "ECN-2026-BLE-01 completed! BLE 5.2 Nordic nRF52840 successfully laid out on top-right quadrant with 12x8mm antenna keepout. 3.7V Li-ion charger circuit verified on bench with zero heat build-up.",
            badge: "BLE Schematic Released",
          },
          {
            id: "c4-2",
            author: "Devon Lane",
            departmentCode: "FW",
            role: "Firmware Lead",
            timestamp: "12 Oct 2026, 17:30 IST",
            content: "Zephyr BLE peripheral GATT stack compiled. Handshake verified with Nordic nRF52-DK test bench at 1Mbps and 2Mbps PHY.",
          },
          {
            id: "c4-3",
            author: "Siddharth Roy",
            departmentCode: "SW",
            role: "Cloud & Application Software Lead",
            timestamp: "12 Oct 2026, 18:15 IST",
            content: "Telemetry parser connected to mobile BLE diagnostic app. Sensor telemetry packet streaming verified over local MQTT mock broker.",
          },
        ],
      },
      {
        stageNumber: 5,
        stageCode: "Stage 5",
        title: "Pilot Build & Box-Build Readiness",
        apqpMilestone: "Phase 3: Process Design & Pilot Integration",
        leadName: "Casey Rowan",
        leadDept: "EMF",
        leadRole: "Electronics Manufacturing Lead",
        alignedTeam: ["Avery Vale (EHW Lead)", "Morgan Reed (PUR Lead)"],
        summary: "DEMO scenario: review accepted outsourced PCBA lot evidence, enclosure integration, controlled firmware loading and functional checks. Actual pilot results and QA disposition must be attached before release.",
        hardwareNote: "Supplier PCBA acceptance evidence and actual pilot measurements are required; no in-house SMT capability is assumed.",
        batteryNote: "3.7V Lithium-ion battery packs assembled into enclosure retaining bracket with vibration-dampening foam.",
        regulatoryNote: "Samples serialized from BCU-2026-0001 to BCU-2026-0025 for regulatory test submission.",
        deliverables: [
          { docId: "HLPL-BCU-EMF-CP-01", title: "Box-Build Control Plan & PCBA Traceability", dept: "EMF", status: "Approved", description: "Accepted PCBA supplier/lot, assembly steps, firmware configuration and functional acceptance criteria." },
          { docId: "HLPL-BCU-EMF-PILOT-01", title: "Pilot Run Build & Inspection Report", dept: "EMF", status: "Approved", description: "25 golden prototype units built, tested, and released for DVP&R." },
        ],
        defaultComments: [
          {
            id: "c5-1",
            author: "Casey Rowan",
            departmentCode: "EMF",
            role: "Manufacturing Lead",
            timestamp: "14 Oct 2026, 11:30 IST",
            content: "Illustrative pilot planning only. Record actual PCBA acceptance, serial/lot traceability, box-build checks and QA disposition before claiming completion.",
          },
          {
            id: "c5-2",
            author: "Avery Vale",
            departmentCode: "EHW",
            role: "Embedded Hardware Lead",
            timestamp: "14 Oct 2026, 14:00 IST",
            content: "Board bring-up test on sample #001: 3.3V rail at 3.302V, STM32 booted in 12ms, Quectel 4G connected, BLE beacon active. Golden batch dispatched to QA.",
          },
        ],
      },
      {
        stageNumber: 6,
        stageCode: "Stage 6",
        title: "DVP&R Agency Testing (iCAT Manesar TAC & NABL Battery)",
        apqpMilestone: "Phase 4: Product & Process Validation",
        leadName: "Jordan Blake & Mina Cross",
        leadDept: "QA · legacy TST ownership review",
        leadRole: "Quality Assurance & EOL Testing Leads",
        alignedTeam: ["Avery Vale (EHW Lead)", "Devon Lane (ESW Lead)"],
        summary: "Execution of the comprehensive DVP&R test suite. Official witness testing conducted by iCAT (International Centre for Automotive Technology, Manesar) for AIS-140 Annexure 8 TAC compliance. 3.7V Lithium-ion battery tested by NABL-accredited laboratory for IS 16046 (Part 2) / UN 38.3. BLE 5.2 RF radiated power and 30m transmission range verified.",
        hardwareNote: "Electrical transients (ISO 7637-2 Pulse 1, 2a, 3a/b, 5b) passed with zero MCU resets.",
        batteryNote: "3.7V Lithium battery NABL certificate issued: Passed external short circuit at 55°C, overcharge, crush, and thermal abuse. Zero leakage or thermal runaway.",
        regulatoryNote: "iCAT Manesar witness testing passed: Emergency SOS packets, GNSS accuracy <2.5m CEP, and tamper alerts verified on mock government backend endpoint.",
        deliverables: [
          { docId: "ICAT-TAC-2026-AIS140-089", title: "iCAT Official Type Approval TAC Report (Form 22)", dept: "QA", status: "Approved", description: "Official witness testing report from ICAT Manesar confirming full AIS-140 compliance." },
          { docId: "NABL-BAT-IS16046-2026-9912", title: "3.7V Lithium Battery NABL Safety Certificate", dept: "QA", status: "Approved", description: "NABL accredited certificate for IS 16046-2 / IEC 62133-2 and UN 38.3 transport safety." },
          { docId: "ICAT-RF-BLE-2026-328", title: "BLE 5.2 RF Radiated Power & Range Test Report", dept: "QA", status: "Approved", description: "ETSI EN 300 328 radiated power (+3.85dBm EIRP) and 35m range verification." },
        ],
        defaultComments: [
          {
            id: "c6-1",
            author: "Jordan Blake",
            departmentCode: "QA",
            role: "Quality Lead",
            timestamp: "16 Oct 2026, 09:30 IST",
            content: "iCAT Manesar official witness testing completed! AIS-140 Annexure 8 emergency packet and environmental tests passed with ZERO deviations. Form 22 TAC issued.",
            badge: "iCAT TAC Passed",
          },
          {
            id: "c6-2",
            author: "Mina Cross",
            departmentCode: "TST",
            role: "EOL Testing Lead",
            timestamp: "16 Oct 2026, 11:15 IST",
            content: "NABL accredited lab report received for the 3.7V Lithium-ion battery (IS 16046-2 & UN 38.3). Cell safety and overcharge protection verified 100%. Certificate uploaded to binder.",
            badge: "3.7V Battery NABL Certified",
          },
          {
            id: "c6-3",
            author: "Avery Vale",
            departmentCode: "EHW",
            role: "Embedded Hardware Lead",
            timestamp: "16 Oct 2026, 14:00 IST",
            content: "Anechoic chamber RF testing confirmed BLE 5.2 radiated power at +3.85dBm. Line-of-sight range tested up to 35 meters across vehicle chassis.",
            badge: "BLE RF Range Verified",
          },
        ],
      },
      {
        stageNumber: 7,
        stageCode: "Stage 7",
        title: "Vehicle Field Integration & Client Trial",
        apqpMilestone: "Phase 4: Customer Vehicle Trial",
        leadName: "Kai Morgan",
        leadDept: "SIT",
        leadRole: "Service & Field IT Lead",
        alignedTeam: ["Mr. K. Ramanathan (Ashok Leyland)", "Devon Lane (ESW Lead)"],
        summary: "Field installation of 10 pilot units on Ashok Leyland commercial trucks at Chennai test facility. Real-time telemetry streaming to cloud broker and live wireless BLE tire pressure and temperature tag readings verified under highway driving conditions.",
        hardwareNote: "Polycarbonate enclosure with RF window transparent to 2.4GHz BLE signal even when mounted behind metallic chassis bracket.",
        batteryNote: "Main battery disconnect drill conducted: 3.7V internal battery sustained active 4G pinging and BLE scanning for 9.2 hours continuously.",
        regulatoryNote: "State emergency backend integration test verified with live vehicle coordinates.",
        deliverables: [
          { docId: "HLPL-BCU-SIT-MNT-01", title: "Vehicle Mounting & Field Integration Protocol", dept: "SIT", status: "Approved", description: "Automotive chassis mounting, wiring harness routing, and antenna orientation checklist." },
          { docId: "HLPL-BCU-SIT-TRIAL-01", title: "Ashok Leyland 5,000km Highway Field Trial Report", dept: "SIT", status: "Approved", description: "Live fleet telemetry data log showing zero packet loss and 100% BLE sensor uptime." },
        ],
        defaultComments: [
          {
            id: "c7-1",
            author: "Kai Morgan",
            departmentCode: "SIT",
            role: "Service & Field IT Lead",
            timestamp: "17 Oct 2026, 15:45 IST",
            content: "Field mounting on 10 Ashok Leyland Boss trucks completed. Wireless BLE sensors paired automatically within 2 seconds of ignition.",
          },
          {
            id: "c7-2",
            author: "Mr. K. Ramanathan",
            departmentCode: "SAL",
            role: "Ashok Leyland Client SPOC",
            timestamp: "17 Oct 2026, 17:00 IST",
            content: "Ashok Leyland engineering team is delighted with the BLE sensor data accuracy. Cold-chain temperature alerts triggered reliably during simulated cooling failure.",
            badge: "Client Approval",
          },
        ],
      },
      {
        stageNumber: 8,
        stageCode: "Stage 8",
        title: "PPAP Level 3 Submission & Production Authorization",
        apqpMilestone: "Phase 5: PPAP Approval & Production Sign-off",
        leadName: "Jordan Blake & Avery Vale",
        leadDept: "QA/EHW",
        leadRole: "Quality Assurance & Hardware Leads",
        alignedTeam: ["Priya Voss (Finance Lead)", "Riley Stone (Sales Lead)"],
        summary: "Compilation and submission of AIAG / IATF 16949 PPAP Level 3 binder to Ashok Leyland. Formal sign-off on Part Submission Warrant (PSW), DFMEA, PFMEA, Dimensional Results, and iCAT TAC compliance. Production purchase order acknowledged.",
        hardwareNote: "All 18 PPAP elements closed with 0 open engineering change requests.",
        batteryNote: "Battery vendor PPAP Level 3 approved with NABL test certificates attached to warrant.",
        regulatoryNote: "Statutory production clearance granted under MoRTH CMVR Form 22 TAC.",
        deliverables: [
          { docId: "HLPL-BCU-QA-PPAP-01", title: "PPAP Level 3 Dossier & Part Submission Warrant (PSW)", dept: "QA", status: "Approved", description: "Complete 18-element automotive PPAP package signed by Quality Lead." },
          { docId: "PO-ALFL-BCU-2026-15K", title: "Customer Production Purchase Order (15,000 Units)", dept: "SAL", status: "Approved", description: "Commercial commitment for 15,000 units valued at ₹6.72 Crores." },
        ],
        defaultComments: [
          {
            id: "c8-1",
            author: "Jordan Blake",
            departmentCode: "QA",
            role: "Quality Lead",
            timestamp: "18 Oct 2026, 10:30 IST",
            content: "Part Submission Warrant (PSW) signed! Ashok Leyland Supplier Quality team approved PPAP Level 3 package with zero deviations.",
            badge: "PPAP Level 3 Approved",
          },
          {
            id: "c8-2",
            author: "Priya Voss",
            departmentCode: "FIN",
            role: "Finance Lead",
            timestamp: "18 Oct 2026, 12:00 IST",
            content: "Production PO PO-ALFL-BCU-2026-15K verified. Advance commercial deposit of ₹2.01 Cr received in company account. SOP authorized.",
          },
        ],
      },
      {
        stageNumber: 9,
        stageCode: "Stage 9",
        title: "Mass Production SOP, PDI & Commercial Delivery",
        apqpMilestone: "Phase 5: Mass Production & Continuous Improvement",
        leadName: "Mina Cross & Priya Voss",
        leadDept: "FIN · legacy TST ownership review",
        leadRole: "EOL Testing & Finance Leads",
        alignedTeam: ["Casey Rowan (EMF Lead)", "Riley Stone (Sales Lead)", "Kai Morgan (SIT Lead)"],
        summary: "Start of Production (SOP). Box-build integration of accepted outsourced PCBAs with automated End-of-Line test jig (JIG-BCU-01) validating BLE RF transmission, 4G ping, and 3.7V battery charge. Commercial dispatch and invoice generation.",
        hardwareNote: "First production batch of 1,000 units achieved 98.4% First-Pass Yield (FPY).",
        batteryNote: "100% of internal 3.7V batteries pre-conditioned to 60% state of charge for safe transport compliance.",
        regulatoryNote: "Serialized QR codes printed on laser-etched nameplates matching iCAT TAC database.",
        deliverables: [
          { docId: "HLPL-BCU-TST-PDI-01", title: "Pre-Delivery Inspection (PDI) Batch Certificate", dept: "TST", status: "Approved", description: "1,000 units inspected with 100% automated EOL test logs archived." },
          { docId: "HLPL-BCU-FIN-INV-01", title: "Commercial Tax Invoice & Dispatch Note", dept: "FIN", status: "Approved", description: "Commercial billing under GST statutory compliance for Batch 01 dispatch." },
        ],
        defaultComments: [
          {
            id: "c9-1",
            author: "Mina Cross",
            departmentCode: "TST",
            role: "EOL Testing Lead",
            timestamp: "19 Oct 2026, 09:00 IST",
            content: "Batch 01 (1,000 units) completed automated EOL test jig validation in 4.2 hours. First-Pass Yield: 98.4%. Serialized barcodes uploaded to portal.",
            badge: "FPY 98.4% Passed",
          },
          {
            id: "c9-2",
            author: "Riley Stone",
            departmentCode: "SAL",
            role: "Sales Lead",
            timestamp: "19 Oct 2026, 10:30 IST",
            content: "Full lifecycle complete! Commercial invoice HLPL-BCU-FIN-INV-01 issued. Client feedback rating: 4.9/5.0. Excellent cross-department execution!",
            badge: "Lifecycle Complete",
          },
        ],
      },
    ],
  },
  "HLPL-SLCT-01": {
    projectCode: "HLPL-SLCT-01",
    title: "Select Motors AIS-140 GPS Telematics Tracker (Reusable Platform)",
    customer: "Select Motors Limited · Telematics Division, Noida",
    architectureMode: "reusable_platform",
    pcbInfo: "100% Reusable Ready PCB HLPL-MOD-PCB-01 (Rev 03): 4G Cat-1 AIS-140 Core Motherboard with Quectel EC200U-CN & STM32F405",
    batteryInfo: "3.7V 1000mAh Lithium-ion Backup Battery (Pre-Certified to IS 16046 / UN 38.3)",
    agencyInfo: "Leverages Existing iCAT TAC Extension under Platform Derivative Rule",
    stages: [
      {
        stageNumber: 1,
        stageCode: "Stage 1",
        title: "Client & Sales Intake (Plug-and-Play Reusable Platform)",
        apqpMilestone: "Phase 1: Concept & Voice of Customer",
        leadName: "Riley Stone",
        leadDept: "SAL",
        leadRole: "Sales Lead",
        alignedTeam: ["Mr. Vikram Singhania (Select Motors)", "Avery Vale (EHW Lead)"],
        summary: "Customer SOR HLPL-SLCT-SAL-SOR-01 logged for 10,000 units/year standard AIS-140 GPS telematics tracker with OBD-II pass-through connector. Evaluated for 100% platform reuse.",
        hardwareNote: "100% match with existing ready PCB HLPL-MOD-PCB-01 Rev 03. Zero hardware redesign needed.",
        batteryNote: "Standard 3.7V 1000mAh Lithium-ion internal battery already qualified and stocked in factory stores.",
        regulatoryNote: "Existing iCAT TAC certificate valid for platform derivative deployment.",
        deliverables: [
          { docId: "HLPL-SLCT-SAL-SOR-01", title: "Customer Statement of Requirements (SOR)", dept: "SAL", status: "Approved", description: "10,000 units/year standard OBD-II AIS-140 GPS telematics tracker." },
          { docId: "HLPL-SLCT-SAL-mNDA-01", title: "Bilateral Mutual NDA", dept: "SAL", status: "Approved", description: "Bilateral NDA executed with Select Motors Limited." },
        ],
        defaultComments: [
          {
            id: "cs1-1",
            author: "Riley Stone",
            departmentCode: "SAL",
            role: "Sales Lead",
            timestamp: "18 Sep 2026, 11:00 IST",
            content: "Select Motors requires an AIS-140 GPS tracker for commercial vehicle fleets. Standard 12V/24V power, OBD-II connector, Quectel 4G modem. Volume: 10,000 units/year.",
          },
          {
            id: "cs1-2",
            author: "Avery Vale",
            departmentCode: "EHW",
            role: "Embedded Hardware Lead",
            timestamp: "18 Sep 2026, 11:45 IST",
            content: "This matches our ready PCB HLPL-MOD-PCB-01 Rev 03 100%! Zero layout change needed. We can waive Stage 4 PoC redesign and proceed directly to box-build pilot.",
            badge: "100% Platform Reuse",
          },
        ],
      },
      {
        stageNumber: 2,
        stageCode: "Stage 2",
        title: "Fast-Track Feasibility Sign-off (Zero NRE)",
        apqpMilestone: "Phase 1: Fast-Track Feasibility Gate",
        leadName: "Cross-Functional HOD Panel",
        leadDept: "EHW/ESW/MECH/PUR/QA/FIN",
        leadRole: "All 6 Department Leads",
        alignedTeam: ["Avery Vale (EHW)", "Devon Lane (ESW)", "Priya Voss (FIN)"],
        summary: "All 6 department HODs approved fast-track feasibility under Master Plan §5 Decoupled Platform Reuse. Development time reduced by 14 weeks and ₹6.5 Lakhs NRE avoided.",
        hardwareNote: "100% platform PCB reuse confirmed. Ready for direct box-build pilot run.",
        batteryNote: "Pre-certified 3.7V Lithium-ion cell in stock with active UN 38.3 report.",
        regulatoryNote: "Platform derivative TAC clause applied.",
        deliverables: [
          { docId: "HLPL/F/MKT/01", title: "Fast-Track Contract Review Record", dept: "SAL", status: "Approved", description: "6 HOD sign-offs confirming zero-NRE platform reuse." },
        ],
        defaultComments: [
          {
            id: "cs2-1",
            author: "Avery Vale",
            departmentCode: "EHW",
            role: "Embedded Hardware Lead",
            timestamp: "20 Sep 2026, 14:00 IST",
            content: "EHW: 100% Platform reuse approved. Ready PCB-01 Rev 03 requires zero modifications.",
          },
          {
            id: "cs2-2",
            author: "Priya Voss",
            departmentCode: "FIN",
            role: "Finance Lead",
            timestamp: "20 Sep 2026, 15:30 IST",
            content: "FIN: Zero tooling NRE charged to client. Competitive unit price ₹3,450 approved.",
          },
        ],
      },
      {
        stageNumber: 3,
        stageCode: "Stage 3",
        title: "Requirement Freeze & Commercial Order Confirmation",
        apqpMilestone: "Phase 2: Baseline Lock",
        leadName: "Riley Stone",
        leadDept: "SAL",
        leadRole: "Sales Lead",
        alignedTeam: ["Mr. Vikram Singhania (Client SPOC)", "Taylor Quinn (HR/Operations Lead)"],
        summary: "Commercial quotation HLPL-SLCT-SAL-QUO-01 accepted. Total contract value ₹3.45 Crores across 10,000 units.",
        hardwareNote: "Architecture baseline locked to ready PCB-01 Rev 03 + HARN-LIB-002 OBD-II harness.",
        batteryNote: "Standard 3.7V 1000mAh battery allocated.",
        regulatoryNote: "AIS-140 compliance guaranteed by ready platform.",
        deliverables: [
          { docId: "HLPL-SLCT-EHW-PRS-01", title: "Product Requirement Specification (PRS)", dept: "EHW", status: "Approved", description: "Standard AIS-140 4G Cat-1 specification." },
          { docId: "HLPL-SLCT-SAL-QUO-01", title: "Commercial Quotation (₹3,450/unit)", dept: "SAL", status: "Approved", description: "Contract proposal signed by Select Motors." },
          { docId: "HLPL-SLCT-HROPS-CRS-01", title: "Competency & Safety Requirement Freeze (HR-OPS)", dept: "HR", status: "Approved", description: "Resource planning, training certifications and plant staffing matrix frozen." },
        ],
        defaultComments: [
          {
            id: "cs3-1",
            author: "Riley Stone",
            departmentCode: "SAL",
            role: "Sales Lead",
            timestamp: "22 Sep 2026, 16:00 IST",
            content: "Contract closed in record time due to platform reuse advantage. Client impressed with 2-week sample turnaround.",
          },
        ],
      },
      {
        stageNumber: 4,
        stageCode: "Stage 4",
        title: "Stage 4 Waived: Proven Ready PCB Pre-Qualified",
        apqpMilestone: "Phase 2: Stage 4 PoC Waived (Master Plan §5)",
        leadName: "Avery Vale",
        leadDept: "EHW",
        leadRole: "Embedded Hardware Lead",
        alignedTeam: ["Devon Lane (ESW Lead)"],
        summary: "STAGE 4 PoC BYPASSED: Proven PCB & Firmware pre-certified! Bypasses breadboard PoC development; project fast-tracks straight to Stage 5 Pilot Integration. Project documentation automatically references master assets under the new project code.",
        hardwareNote: "Ready PCB HLPL-MOD-PCB-01 Rev 03 in active production. 0 weeks schematic lead time.",
        batteryNote: "3.7V Lithium-ion circuit pre-verified with 60,000+ units operating in the field.",
        regulatoryNote: "Pre-certified AIS-140 firmware FW-LIB-001 deployed without code re-spin.",
        deliverables: [
          { docId: "HLPL-SLCT-EHW-BOM-01", title: "Master Reusable Platform BOM", dept: "EHW", status: "Approved", description: "Production-proven 142-item electronic BOM." },
          { docId: "HLPL-SLCT-EHW-GER-01", title: "Active Production Gerber Package", dept: "EHW", status: "Approved", description: "Qualified 4-layer FR4 fabrication tooling." },
        ],
        defaultComments: [
          {
            id: "cs4-1",
            author: "Avery Vale",
            departmentCode: "EHW",
            role: "Embedded Hardware Lead",
            timestamp: "24 Sep 2026, 10:00 IST",
            content: "Stage 4 PoC successfully waived per Master Plan §5! PCB-LIB-001 Rev 03 already validated. Stencils and feeders ready on Line 2.",
            badge: "PoC Waived (Fast-Track)",
          },
        ],
      },
      {
        stageNumber: 5,
        stageCode: "Stage 5",
        title: "Pilot Box-Build Integration",
        apqpMilestone: "Phase 3: Pilot Integration",
        leadName: "Casey Rowan",
        leadDept: "EMF",
        leadRole: "Manufacturing Lead",
        alignedTeam: ["Avery Vale (EHW Lead)"],
        summary: "Pilot run of 20 units assembled using existing stencils and feeder setup. 99.2% first-pass yield achieved.",
        hardwareNote: "Confirm outsourced PCBA acceptance, controlled assembly instructions and fixture readiness.",
        batteryNote: "3.7V Li-ion internal battery packs installed.",
        regulatoryNote: "Golden units serialized for client witness demonstration.",
        deliverables: [
          { docId: "HLPL-SLCT-EMF-CP-01", title: "Manufacturing Control Plan", dept: "EMF", status: "Approved", description: "Box-build, programming and functional-test control plan." },
        ],
        defaultComments: [
          {
            id: "cs5-1",
            author: "Casey Rowan",
            departmentCode: "EMF",
            role: "Manufacturing Lead",
            timestamp: "26 Sep 2026, 14:00 IST",
            content: "Illustrative pilot sequence. Actual assembly duration, functional test results and QA disposition remain evidence requirements.",
          },
        ],
      },
      {
        stageNumber: 6,
        stageCode: "Stage 6",
        title: "DVP&R Regression & Platform Derivative Testing",
        apqpMilestone: "Phase 4: Derivative Qualification",
        leadName: "Jordan Blake",
        leadDept: "QA",
        leadRole: "Quality Lead",
        alignedTeam: ["Mina Cross (TST Lead)"],
        summary: "DVP&R regression testing on OBD-II harness interface and 3.7V Li-ion battery charging. Leveraged existing TAC certificate.",
        hardwareNote: "All 18 DVP&R checks passed with zero deviations.",
        batteryNote: "3.7V Li-ion battery backup run-time verified at 8.5 hours.",
        regulatoryNote: "iCAT platform derivative certificate extension confirmed.",
        deliverables: [
          { docId: "HLPL-SLCT-QA-DVP-01", title: "DVP&R Platform Derivative Evidence Pack", dept: "QA", status: "Approved", description: "Electrical transient and thermal cycling verification." },
        ],
        defaultComments: [
          {
            id: "cs6-1",
            author: "Jordan Blake",
            departmentCode: "QA",
            role: "Quality Lead",
            timestamp: "28 Sep 2026, 16:30 IST",
            content: "Regression test suite passed with 0 deviations. iCAT derivative certificate extension logged.",
          },
        ],
      },
      {
        stageNumber: 7,
        stageCode: "Stage 7",
        title: "Customer Fleet Plug-and-Play Trial",
        apqpMilestone: "Phase 4: Field Acceptance",
        leadName: "Kai Morgan",
        leadDept: "SIT",
        leadRole: "Service & Field IT Lead",
        alignedTeam: ["Mr. Vikram Singhania (Select Motors)"],
        summary: "Installation of 5 test units in Select Motors fleet via plug-and-play OBD-II port. Instant GPS lock and cloud server synchronization verified.",
        hardwareNote: "OBD-II pass-through harness fits cabin dashboard with zero interference.",
        batteryNote: "Internal 3.7V battery operational during ignition-off parking surveillance.",
        regulatoryNote: "Cloud telemetry latency measured at 38ms.",
        deliverables: [
          { docId: "HLPL-SLCT-SIT-MNT-01", title: "OBD-II Plug-and-Play Quick Install Guide", dept: "SIT", status: "Approved", description: "User manual and 2-step fleet installation guide." },
        ],
        defaultComments: [
          {
            id: "cs7-1",
            author: "Kai Morgan",
            departmentCode: "SIT",
            role: "Service Lead",
            timestamp: "30 Sep 2026, 11:00 IST",
            content: "Customer fleet installation took less than 3 minutes per vehicle. Real-time GPS tracking operational.",
          },
        ],
      },
      {
        stageNumber: 8,
        stageCode: "Stage 8",
        title: "PPAP Approval & High-Volume SCM Release",
        apqpMilestone: "Phase 5: Production Authorization",
        leadName: "Jordan Blake",
        leadDept: "QA",
        leadRole: "Quality Lead",
        alignedTeam: ["Priya Voss (FIN Lead)"],
        summary: "PPAP Level 3 package released leveraging platform master data. Production purchase order PO-TATA-SLCT-2026-9041 verified.",
        hardwareNote: "Production tooling and BOM locked.",
        batteryNote: "3.7V battery batch release verified.",
        regulatoryNote: "Type approval certificate active.",
        deliverables: [
          { docId: "HLPL-SLCT-QA-APQP-01", title: "PPAP Phase 1-4 Closure Dossier", dept: "QA", status: "Approved", description: "Full quality sign-off and Part Submission Warrant." },
        ],
        defaultComments: [
          {
            id: "cs8-1",
            author: "Jordan Blake",
            departmentCode: "QA",
            role: "Quality Lead",
            timestamp: "02 Oct 2026, 14:00 IST",
            content: "PPAP approved. Production release authorized.",
          },
        ],
      },
      {
        stageNumber: 9,
        stageCode: "Stage 9",
        title: "Mass Delivery, PDI & Commercial Billing",
        apqpMilestone: "Phase 5: Commercial SOP & Client Satisfaction",
        leadName: "Mina Cross & Priya Voss",
        leadDept: "FIN · legacy TST ownership review",
        leadRole: "EOL Testing & Finance Leads",
        alignedTeam: ["Riley Stone (Sales Lead)"],
        summary: "Mass delivery of initial 1,000 units. Automated EOL testing achieved 99.4% FPY. Commercial billing and client feedback rating recorded.",
        hardwareNote: "100% functional test pass rate.",
        batteryNote: "Battery charge state verified prior to shipping.",
        regulatoryNote: "Government server whitelist registration active.",
        deliverables: [
          { docId: "HLPL-SLCT-TST-PDI-01", title: "PDI Batch Release Certificate", dept: "TST", status: "Approved", description: "Serialized batch test records." },
          { docId: "HLPL-SLCT-FIN-INV-01", title: "Commercial Tax Invoice", dept: "FIN", status: "Approved", description: "Final shipment billing and payment clearance." },
        ],
        defaultComments: [
          {
            id: "cs9-1",
            author: "Riley Stone",
            departmentCode: "SAL",
            role: "Sales Lead",
            timestamp: "03 Oct 2026, 17:00 IST",
            content: "Deployment complete! Select Motors confirmed excellent performance. Platform reuse enabled delivery 12 weeks faster than industry average.",
            badge: "Lifecycle Complete",
          },
        ],
      },
    ],
  },
};

export function ProjectLifecyclePlayerAndDetail({
  activeProjectId = "HLPL-BCU-02",
  onSelectProject,
  currentStage = 0,
  onJumpToStage,
  persona,
  onOpenPrintable,
  chronicles,
  onOpenChroniclesManager,
}: {
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  currentStage: number;
  onJumpToStage: (stageIndex: number) => void;
  persona: Persona;
  onOpenPrintable?: ((doc: any) => void) | undefined;
  chronicles?: DepartmentChronicle[] | undefined;
  onOpenChroniclesManager?: (() => void) | undefined;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(3000); // 3 seconds per stage
  const [stageComments, setStageComments] = useState<Record<string, StageComment[]>>({});
  const [newCommentText, setNewCommentText] = useState("");
  const [commentAuthorRole, setCommentAuthorRole] = useState(persona.label || "Department Lead");

  const projectData = projectLifecycleData[activeProjectId] ?? projectLifecycleData["HLPL-BCU-02"]!;
  const stages = projectData.stages;
  const stageIndex = Math.min(Math.max(0, currentStage), stages.length - 1);
  const activeStage = stages[stageIndex]!;
  const stageDeliverables =
    chronicles !== undefined
      ? deriveDeliverablesForStage(chronicles, stageIndex)
      : activeStage.deliverables;

  // Auto-play animation timer
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      onJumpToStage((stageIndex + 1) % stages.length);
    }, playSpeed);
    return () => clearInterval(timer);
  }, [isPlaying, playSpeed, stageIndex, stages.length, onJumpToStage]);

  // Comments for active stage
  const currentKey = `${activeProjectId}-stage-${stageIndex}`;
  const comments = stageComments[currentKey] || activeStage.defaultComments;

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const authorDept = persona.departmentId?.toUpperCase() || "ENG";
    const comment: StageComment = {
      id: `comm-${Date.now()}`,
      author: persona.person?.split(" · ")[0] || persona.label || "Collaborator",
      departmentCode: authorDept,
      role: commentAuthorRole,
      timestamp: "Just now (Live)",
      content: newCommentText.trim(),
      badge: "Team Remark",
    };
    setStageComments({
      ...stageComments,
      [currentKey]: [...comments, comment],
    });
    setNewCommentText("");
  };

  return (
    <div className="space-y-4">
      {/* 1. Project Selector & Mode Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/80 p-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {projectData.architectureMode === "reusable_platform" ? (
              <Sparkles className="size-5" />
            ) : (
              <Layers className="size-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-primary">{projectData.projectCode}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  projectData.architectureMode === "reusable_platform"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                }`}
              >
                {projectData.architectureMode === "reusable_platform"
                  ? "✓ 100% Platform Reused PCB (PoC Waived)"
                  : "⚡ OEM Hardware Modification (BLE Addition)"}
              </span>
            </div>
            <h3 className="text-sm font-bold text-foreground">{projectData.title}</h3>
            <p className="text-[11px] text-muted-foreground">{projectData.customer}</p>
          </div>
        </div>

        {/* Project Switcher Tabs */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 p-1">
          <button
            type="button"
            onClick={() => onSelectProject("HLPL-BCU-02")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              activeProjectId === "HLPL-BCU-02"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            Ashok Leyland (BLE Mod)
          </button>
          <button
            type="button"
            onClick={() => onSelectProject("HLPL-SLCT-01")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              activeProjectId === "HLPL-SLCT-01"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            Select Motors (Reusable PCB)
          </button>
          <button
            type="button"
            onClick={() => onSelectProject("HLPL-AI4T-01")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              activeProjectId === "HLPL-AI4T-01"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            Tata Ace EV (Baseline)
          </button>
        </div>
      </div>

      {/* 2. Interactive Animation & Playback Controller */}
      <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold shadow-xs transition ${
                isPlaying
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {isPlaying ? "Pause Playback" : "Auto-Play Lifecycle"}
            </button>

            <button
              type="button"
              onClick={() => onJumpToStage(Math.max(0, stageIndex - 1))}
              disabled={stageIndex === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-40"
              title="Previous Stage"
            >
              <SkipBack className="size-3" /> Prev
            </button>

            <button
              type="button"
              onClick={() => onJumpToStage(Math.min(stages.length - 1, stageIndex + 1))}
              disabled={stageIndex === stages.length - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-40"
              title="Next Stage"
            >
              Next <SkipForward className="size-3" />
            </button>
          </div>

          {/* Stepper Progress Bar & Stage Indicator */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-foreground">
              Stage {stageIndex + 1} of {stages.length}: {activeStage.title.split(" (")[0]}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>Speed:</span>
              <button
                type="button"
                onClick={() => setPlaySpeed(playSpeed === 2000 ? 3000 : playSpeed === 3000 ? 5000 : 2000)}
                className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground hover:bg-secondary"
              >
                {playSpeed / 1000}s/stage
              </button>
            </div>
          </div>
        </div>

        {/* 9-Stage Step Pills */}
        <div className="mt-3.5 grid grid-cols-3 gap-1.5 sm:grid-cols-9">
          {stages.map((st, idx) => {
            const isCurrent = idx === stageIndex;
            const isPast = idx < stageIndex;
            return (
              <button
                key={st.stageCode}
                type="button"
                onClick={() => onJumpToStage(idx)}
                className={`flex flex-col items-center justify-center rounded-lg border p-1.5 text-center transition ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground shadow-sm font-bold scale-[1.03]"
                    : isPast
                      ? "border-emerald-500/30 bg-emerald-500/5 text-foreground hover:bg-emerald-500/10"
                      : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px]">{st.stageCode}</span>
                  {isPast && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">✓</span>}
                </div>
                <span className="truncate text-[9px] leading-tight max-w-[80px]">
                  {st.title.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Distributed "Page by Page" Stage Detail View */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        {/* Stage Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                Stage {activeStage.stageNumber} of 9
              </span>
              <span className="font-mono text-[11px] text-steel font-semibold">
                {activeStage.apqpMilestone}
              </span>
            </div>
            <h2 className="mt-1.5 text-base font-bold text-foreground">
              {activeStage.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {activeStage.summary}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
              Lead: {activeStage.leadName} ({activeStage.leadDept})
            </span>
            <span className="text-[10px] text-muted-foreground">
              {activeStage.leadRole}
            </span>
          </div>
        </div>

        {/* Technical Callout Strip: Hardware, Battery & Regulatory */}
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Hardware & PCB Architecture */}
          <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Cpu className="size-3.5 text-primary" />
              <span>Hardware & PCB Status</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {activeStage.hardwareNote || projectData.pcbInfo}
            </p>
          </div>

          {/* 3.7V Lithium Battery */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.02] p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Battery className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>3.7V Battery (NABL Certified)</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {activeStage.batteryNote || projectData.batteryInfo}
            </p>
          </div>

          {/* iCAT Agency Certification */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.02] p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Award className="size-3.5 text-blue-600 dark:text-blue-400" />
              <span>Regulatory & iCAT TAC</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {activeStage.regulatoryNote || projectData.agencyInfo}
            </p>
          </div>
        </div>

        {/* Deliverables for this Stage */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-primary" />
              <h4 className="text-xs font-bold text-foreground">
                Controlled Deliverables & Signed Documents ({stageDeliverables.length})
              </h4>
            </div>
            <div className="flex items-center gap-2">
              {onOpenChroniclesManager && (
                <button
                  type="button"
                  onClick={onOpenChroniclesManager}
                  className="inline-flex items-center gap-1 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-semibold transition"
                  title="Configure department chronicles and milestones dynamically"
                >
                  ⚡ Configure Stage Chronicles
                </button>
              )}
              <span className="font-mono text-[10px] text-muted-foreground">
                IATF 16949 / ISO 9001 Governed
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {stageDeliverables.map((deliv) => (
              <div
                key={deliv.docId}
                className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/20 p-3 hover:bg-secondary/40 transition"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-primary">{deliv.docId}</span>
                    <span className="rounded bg-secondary px-1.5 py-0.2 font-mono text-[9px] text-muted-foreground">
                      {deliv.dept}
                    </span>
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ {deliv.status}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground">{deliv.title}</p>
                  <p className="text-[10px] text-muted-foreground">{deliv.description}</p>
                </div>
                {onOpenPrintable && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPrintable({
                        title: deliv.title.toUpperCase(),
                        documentId: deliv.docId,
                        department: deliv.dept,
                        revision: "Rev 01",
                        status: deliv.status,
                        project: projectData.projectCode,
                        stage: activeStage.stageCode,
                      })
                    }
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title="View Printable Document"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Collaborative Cross-Department Comments & Live Remarks */}
        <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              <h4 className="text-xs font-bold text-foreground">
                Stage Alignment & Collaborative HOD Review ({comments.length} Remarks)
              </h4>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Cross-functional discussion & sign-off log
            </span>
          </div>

          {/* Comment Thread List */}
          <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
            {comments.map((comm) => (
              <div
                key={comm.id}
                className="rounded-lg border border-border/70 bg-background/80 p-3 text-xs space-y-1 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">{comm.author}</span>
                    <span className="rounded bg-secondary px-1.5 py-0.2 font-mono text-[9px] font-bold text-foreground/80">
                      {comm.departmentCode}
                    </span>
                    <span className="text-[10px] text-muted-foreground">· {comm.role}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {comm.badge && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-primary">
                        {comm.badge}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono">{comm.timestamp}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {comm.content}
                </p>
              </div>
            ))}
          </div>

          {/* Interactive Comment Input Box */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/60">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
              placeholder={`Add alignment remark or modification note for ${activeStage.stageCode}...`}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleAddComment}
              disabled={!newCommentText.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 disabled:opacity-40"
            >
              <Send className="size-3" /> Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

-- Additive template registration. No organization records, approvals or project pins are rewritten.
-- Source row 77 had no identifier; G8_04 is allocated for its Phase-8 handover stage.
INSERT INTO public.canonical_stage_templates(stage_code,phase_code,name,default_owner,prerequisites,applicable_tracks,t01_title,t01_owner,t02_title,t02_owner) VALUES
('G0_01','TG_0','Project Kickoff & Charter Lock','HR',ARRAY['CM_01']::text[],ARRAY['hardware_only','firmware_only','software_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software','ready_made']::text[],'Define business goals, scope baseline, and key project deliverables','HR','Identify core cross-track stakeholders and establish communication cadence','HR'),
('G0_02','TG_0','Hardware Technical Feasibility & Preliminary Costing','EHW',ARRAY['G0_01']::text[],ARRAY['hardware_only','hardware_firmware','hardware_firmware_software']::text[],'Assess global silicon availability, allocation risks, and authorized distributor lead times','EHW','Draft preliminary hardware architecture block diagram and functional partition','EHW'),
('G0_03','TG_0','Mechanical Feasibility & Enclosure Sizing','MMF',ARRAY['G0_01']::text[],ARRAY['hardware_only','hardware_firmware','hardware_firmware_software']::text[],'Define preliminary physical space envelope, mounting geometry, and keep-out zones','MMF','Evaluate environmental sealing, automotive IP67/IP68, and connector mating orientations','MMF'),
('G0_04','TG_0','Firmware Architecture Feasibility & Resource Sizing','FW',ARRAY['G0_01']::text[],ARRAY['firmware_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software']::text[],'Estimate Flash memory and static/dynamic RAM footprints with 30% expansion margin','FW','Evaluate RTOS multi-tasking versus bare-metal control options','FW'),
('G0_05','TG_0','Cloud & Software Architecture Sizing','SW',ARRAY['G0_01']::text[],ARRAY['software_only','firmware_software_existing_hardware','hardware_firmware_software']::text[],'Estimate telemetry data throughput, ingestion burst TPS, and time-series storage capacity','SW','Draft scalable backend microservices topology and database partitioning rules','SW'),
('G0_06','TG_0','Joint Feasibility Review & Gate 0 Sign-Off','HR',ARRAY['G0_02','G0_03','G0_04','G0_05']::text[],ARRAY['hardware_only','firmware_only','software_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software','ready_made']::text[],'Consolidate cross-functional feasibility reports (HW, FW, SW, MECH, PUR)','HR','Execute formal Contract Review Record (HLPL/F/MKT/01) with departmental sign-offs','HR'),
('G2_01','TG_2','Client PoC Demo & Sign-Off','EHW',ARRAY['HW_06','HW_12']::text[],ARRAY['hardware_only','hardware_firmware','hardware_firmware_software']::text[],'Prepare benchtop PoC demonstration setup, automated test script, and monitoring dashboard','EHW','Execute live functional validation of sensor data acquisition, bus messaging, and telemetry','EHW'),
('G7_01','TG_7','Pre-Production Golden Firmware & FOTA Validation','FW',ARRAY['FW_12','FW_13']::text[],ARRAY['firmware_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software']::text[],'Verify secondary bootloader cryptographic lock, key revocation, and dual-bank partition integrity','FW','Execute automated FOTA delta update cycles across pre-production pilot test units','FW'),
('G7_02','TG_7','Pilot Production Run & Work Instructions (SOP) Freeze','EMF',ARRAY['HW_34','G7_01']::text[],ARRAY['hardware_only','hardware_firmware','hardware_firmware_software']::text[],'Execute pre-production pilot manufacturing run (50–100 units) on automated SMT and assembly line','EMF','Validate line assembly cycle times, tooling ergonomic clearance, and fixture repeatability','EMF'),
('G7_03','TG_7','Safe Launch Quality Plan (SLQP) & Early Containment','QA',ARRAY['HW_32','G7_02']::text[],ARRAY['hardware_only','firmware_only','software_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software','ready_made']::text[],'Establish 100% redundant quality firewall inspection stations at end-of-line before packaging','QA','Define tightened sampling plans, visual inspection criteria, and defect containment thresholds','QA'),
('G7_04','TG_7','Supplier Volume Readiness & Dual-Sourcing Freeze','PUR',ARRAY['HW_34','HW_08']::text[],ARRAY['hardware_only','hardware_firmware','hardware_firmware_software']::text[],'Audit Approved Vendor List (AVL) component production capacity against OEM annual forecast','PUR','Establish qualified secondary sources for all single-sourced active ICs and critical passives','PUR'),
('G8_01','TG_8','PPAP Level 3 & PSW Submission','QA',ARRAY['G7_03','G7_04','HW_35','HW_36']::text[],ARRAY['hardware_only','hardware_firmware','hardware_firmware_software']::text[],'Compile all 18 mandatory AIAG/IATF PPAP elements including design records, DFMEA, and PFMEA','QA','Consolidate dimensional inspection reports, material test results (MTR), and certified lab logs','QA'),
('G8_02','TG_8','OEM Line Audit & Run-at-Rate Verification','HR',ARRAY['G7_02','G8_01']::text[],ARRAY['hardware_only','hardware_firmware','hardware_firmware_software']::text[],'Execute continuous multi-hour production Run-at-Rate verification on EMS SMT and assembly lines','HR','Measure Overall Equipment Effectiveness (OEE), line takt time, scrap rates, and first-pass yield','HR'),
('G8_03','TG_8','Golden Sample & Master Calibration Archive','QA',ARRAY['HW_35','FW_12','G8_01']::text[],ARRAY['hardware_only','hardware_firmware','hardware_firmware_software']::text[],'Select and inspect golden boundary sample units representing dimensional and electrical limits','QA','Perform high-precision master calibration using accredited laboratory reference standards','QA'),
('G8_04','TG_8','Mass Production Handover & Ramp-Up','HR',ARRAY['G8_02','G8_03']::text[],ARRAY['hardware_only','hardware_firmware','hardware_firmware_software']::text[],'Train EMS manufacturing supervisors, SMT operators, and QA personnel on frozen SOPs','HR','Hand over calibrated production fixtures, automated EOL testing jigs, and diagnostic tools','HR'),
('G9_01','TG_9','Project Wrap-up Checklist & Audit Readiness','QA',ARRAY['G8_04','SW_11','FW_13']::text[],ARRAY['hardware_only','firmware_only','software_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software','ready_made']::text[],'Audit mandatory engineering, software, testing, and regulatory compliance artifacts','QA','Verify formal closure of all DVP, DVR, IQC, and supplier PPAP non-conformance items','QA'),
('G9_02','TG_9','Final Budget Reconciliation & Cost Variance Analysis','HR',ARRAY['G9_01']::text[],ARRAY['hardware_only','firmware_only','software_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software','ready_made']::text[],'Consolidate final BOM expenditures, tooling CapEx, NRE development, and certification costs','HR','Benchmark actual product cost roll-up against Gate 0 and Gate 1 baseline financial targets','HR'),
('G9_03','TG_9','Post-Launch Risk Scoring & Residual Risk Assessment','QA',ARRAY['G9_01']::text[],ARRAY['hardware_only','firmware_only','software_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software','ready_made']::text[],'Re-evaluate enterprise project risk register and score residual operational/quality risks','QA','Review design DFMEA, manufacturing PFMEA, and initial pilot field performance logs','QA'),
('G9_04','TG_9','Cross-Functional Retrospective & Lessons Learned','HR',ARRAY['G9_02','G9_03']::text[],ARRAY['hardware_only','firmware_only','software_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software','ready_made']::text[],'Convene cross-track project retrospective sessions with HW, FW, SW, MECH, PUR, and MFG leads','HR','Document ''Things Gone Right'' (TGR) and ''Things Gone Wrong'' (TGW) across engineering phases','HR'),
('G9_05','TG_9','Design Artifact, Codebase & Test Jig Archival','EHW',ARRAY['G9_04']::text[],ARRAY['hardware_only','firmware_only','software_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software','ready_made']::text[],'Tag, freeze, and archive golden production firmware and software repository branches in Git','EHW','Archive production schematic drawings, PCB layout files, Gerber archives, and BOM spreadsheets','EHW'),
('G9_06','TG_9','Executive Tollgate Review & Formal Project Closure','HR',ARRAY['G9_05']::text[],ARRAY['hardware_only','firmware_only','software_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software','ready_made']::text[],'Present comprehensive project closure dossier and operational manufacturing KPIs to executive management','HR','Verify stable mass production ramp-up, supply chain continuity, and field SLA adherence','HR')
ON CONFLICT(stage_code) DO NOTHING;

CREATE TABLE private.stage_deliverable_bindings(
 stage_code text NOT NULL REFERENCES public.canonical_stage_templates(stage_code),
 record_type text PRIMARY KEY, family_code text NOT NULL, title text NOT NULL,
 requires_original boolean NOT NULL, required_deliverables text NOT NULL
);
ALTER TABLE private.stage_deliverable_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.stage_deliverable_bindings FROM PUBLIC,anon,authenticated;
INSERT INTO private.stage_deliverable_bindings VALUES
('G0_01','Stage evidence · G0_01','D05','Project Kickoff & Charter Lock',false,'• Approved Project Charter
• Preliminary Schedule & Milestone Baseline'),
('G0_02','Stage evidence · G0_02','D05','Hardware Technical Feasibility & Preliminary Costing',false,'• Hardware Technical Feasibility Report
• Preliminary BOM Cost Estimate'),
('G0_03','Stage evidence · G0_03','D05','Mechanical Feasibility & Enclosure Sizing',false,'• Mechanical Packaging Feasibility Note
• 3D Concept Space Envelope (.STEP)'),
('G0_04','Stage evidence · G0_04','D05','Firmware Architecture Feasibility & Resource Sizing',false,'• Firmware Architectural Feasibility Note
• MCU Memory & Peripheral Sizing Budget'),
('G0_05','Stage evidence · G0_05','D05','Cloud & Software Architecture Sizing',false,'• Cloud & Software Feasibility Specification
• Telemetry Throughput & Storage Sizing Model'),
('G0_06','Stage evidence · G0_06','D05','Joint Feasibility Review & Gate 0 Sign-Off',false,'• Contract Review Record (HLPL/F/MKT/01)
• Consolidated Technical Feasibility Report
• Signed Gate 0 Tollgate Sign-Off Certificate'),
('HW_01','Stage evidence · HW_01','D10','Requirement Capture & SOR Analysis',false,'• Baseline System Statement of Requirements (SOR)
• Technical Requirements Allocation Matrix'),
('HW_02','Stage evidence · HW_02','D10','Product Requirement Spec (PRS) Freeze',false,'• Product Requirement Specification (HLPL-[PROJ]-EHW-PRS-00)
• System Power Budget & Sleep-Mode Analysis'),
('HW_03','Stage evidence · HW_03','D10','Key Component Evaluation & Trade-off',false,'• Key Part Analysis & Component Trade-off Matrix
• Component Selection Register (PartsBench)'),
('HW_04','Stage evidence · HW_04','D10','System Block Diagram & Power Tree',false,'• System Functional Block Diagram (HLPL-[PROJ]-EHW-BLK-01)
• Power Distribution Tree & Thermal Dissipation Map'),
('HW_05','Stage evidence · HW_05','D10','Target BOM Costing & Interface Feasibility Lock',false,'• Target Cost Engineering BOM (Rev 0.1)
• Physical Connector & Pin Feasibility Memo'),
('FW_01','Stage evidence · FW_01','D10','MCU Core Selection & Peripheral Interface Mapping',false,'• MCU Core Selection & Benchmark Report
• Peripheral Pin Multiplexing & Interface Mapping Table'),
('FW_02','Stage evidence · FW_02','D10','Firmware SRS & HSI Pinout Draft Lock',false,'• Firmware Software Requirements Specification (SRS)
• Draft Hardware-Software Interface (HLPL-[PROJ]-FW-HSI-01)'),
('SW_01','Stage evidence · SW_01','D10','Cloud & Mobile App Architecture Interface Sizing',false,'• Software Product Requirement Document (PRD)
• Cloud Microservices Topology & Database Architecture Diagram'),
('SW_02','Stage evidence · SW_02','D10','Telemetry Protocol & API Interface Contract',false,'• Telemetry Packet Protocol Specification (MQTT/HTTPS)
• CAN J1939 DBC Signal Matrix
• OpenAPI / Swagger API Interface Contract'),
('HW_06','Stage evidence · HW_06','D10','PoC Breadboard / Eval-Kit Setup',false,'• Bench PoC Hardware Setup & Bring-Up Log'),
('HW_07','Stage evidence · HW_07','D10','Sample Component Requisition',false,'• Prototype Component Purchase Requisition (PartsBench Indent)'),
('G2_01','Stage evidence · G2_01','D10','Client PoC Demo & Sign-Off',false,'• Live PoC Functional Demo Log
• Signed Client PoC Acceptance Certificate'),
('HW_08','Stage evidence · HW_08','D10','Sample Procurement & IQC',false,'• Sample Purchase Orders (POs)
• Incoming Quality Check (IQC) Inspection Reports'),
('HW_09','Stage evidence · HW_09','D10','Pinout Allocation & Harness/Cable Specifications Lock',false,'• Pinout Allocation & Connector Assignment Table
• Wiring Harness Specification & Pinout Schedule'),
('HW_10','Stage evidence · HW_10','D10','Circuit Calculation & Simulation',false,'• Analog & Filter Calculation Sheets
• SPICE Simulation & Transient Protection Report (ISO 7637-2)'),
('HW_11','Stage evidence · HW_11','D10','Footprint & Symbol Library Creation',false,'• Verified ECAD Schematic Symbols & IPC-7351 Land Patterns'),
('HW_12','Stage evidence · HW_12','D10','PoC Bench Signal Validation',false,'• Bench Signal Integrity & Bus Timing Oscilloscope Plots
• Power Rail Turn-On Sequencing Measurement Report'),
('HW_13','Stage evidence · HW_13','D10','Hardware DFMEA',false,'• Hardware DFMEA Register with RPN Scoring (HLPL-[PROJ]-EHW-DFMEA-01)'),
('HW_14','Stage evidence · HW_14','D13','Design Verification Plan (DVP)',false,'• Design Verification Plan (HLPL-[PROJ]-QA-DVP-01)'),
('HW_15','Stage evidence · HW_15','D10','Full Schematic Capture',true,'• Multi-Sheet Hierarchical Schematic Package (HLPL-[PROJ]-EHW-SCH-01)
• Schematic Netlist & BOM Attribute Export'),
('HW_16','Stage evidence · HW_16','D10','Schematic Design Review & ERC Gate',false,'• Electrical Rules Check (ERC) Verification Log
• Signed Schematic Peer Review Checklist'),
('FW_03','Stage evidence · FW_03','D10','RTOS Tasking & Watchdog Architecture',false,'• RTOS Task Priority & Inter-Task Queue Architecture Note
• Hardware Watchdog & Fault Recovery Specification'),
('FW_04','Stage evidence · FW_04','D10','Toolchain Setup & DevKit Bring-Up',false,'• Firmware Build Environment & Toolchain Guide
• DevKit Baseline Firmware Codebase & Flash Verification Log'),
('SW_03','Stage evidence · SW_03','D10','Database Schema & Microservices Design',false,'• Relational & Time-Series Database Schema Design (DDL)
• Microservices API Architecture & RLS Security Specification'),
('SW_04','Stage evidence · SW_04','D10','CI/CD Pipeline & Packet Simulator',false,'• Automated CI/CD Pipeline Configuration
• Telemetry Packet Simulator Engine & Test Scripts'),
('HW_17','Stage evidence · HW_17','D10','Enclosure 3D CAD, Connector Cutouts & Physical Interface Freeze',true,'• 3D Parametric Enclosure CAD Package (HLPL-[PROJ]-MECH-CAD-01 .STEP)
• 2D Mechanical Connector Cutout Drawing (HLPL-[PROJ]-MECH-DRW-01)'),
('HW_18','Stage evidence · HW_18','D10','Component Placement & Floorplanning',false,'• PCBA Component Placement & Floorplan Drawing
• Hardware-Mechanical Clearance Sign-Off Sheet'),
('HW_19','Stage evidence · HW_19','D10','Tentative BOM Release',false,'• Preliminary Engineering Bill of Materials (HLPL-[PROJ]-EHW-BOM-00)
• Prototype Sourcing Indent & Distributor Stock Audit'),
('HW_20','Stage evidence · HW_20','D10','3D Cable Routing, Pinch Point & Thermal Check',true,'• 3D Internal Harness Clearance & Collision Analysis
• Thermal Simulation & Heat Dissipation Report'),
('HW_21','Stage evidence · HW_21','D10','PCB Stackup, Impedance & Routing',true,'• Controlled Impedance & Layer Stackup Specification
• Completed 100% Routed PCB Layout Design File'),
('HW_22','Stage evidence · HW_22','D10','Silkscreen, Panelization & Fiducials',false,'• Production SMT Panel Array Fabrication Drawing
• Silkscreen Artwork & Fiducial Placement Guide'),
('HW_23','Stage evidence · HW_23','D10','DRC, DFM/DFA & Layout Review Gate',false,'• Layout Design Rule Check (DRC) Verification Log
• PCB Fabricator DFM/DFA Clearance Sign-Off'),
('HW_24','Stage evidence · HW_24','D10','Prototype Gerber & Drill Generation',true,'• Prototype RS-274X Gerber & NC Drill Package (HLPL-[PROJ]-EHW-PCB-01)
• IPC-D-356 Netlist & SMT Centroid (XY) Pick-and-Place File'),
('HW_25','Stage evidence · HW_25','D10','Bare PCB & Stencil Fabrication Order',false,'• Bare PCB Fabrication Purchase Order & Stencil Order
• Fabricator Engineering Query (EQ) Sign-Off'),
('HW_26','Stage evidence · HW_26','D10','Soft-Tooling / 3D Print Enclosure',true,'• 3D-Printed / Soft-Tooled Prototype Enclosure Inspection Record'),
('FW_05','Stage evidence · FW_05','D10','HAL/BSP Drivers & Peripheral Stacks',false,'• Hardware Abstraction Layer (HAL) & Peripheral Driver Package
• Core Protocol Stack Source Code (CAN, UART, SPI, I2C)'),
('FW_06','Stage evidence · FW_06','D10','Secure Bootloader, OTA Client & Power',false,'• Dual-Bank FOTA Bootloader with Cryptographic Rollback
• Power Management State Machine & Sleep-Mode Implementation'),
('FW_07','Stage evidence · FW_07','D10','Static Analysis & Unit Tests',false,'• MISRA-C / Clang-Tidy Static Analysis Audit Report
• Unit Test Suite Coverage Report (>80% Pass)'),
('SW_05','Stage evidence · SW_05','D10','Core Backend APIs & Web Portal',false,'• Deployed Telemetry Ingestion Microservices
• OEM Web Portal Frontend & Fleet Tracking Dashboard'),
('SW_06','Stage evidence · SW_06','D10','Auth, RBAC & OTA Campaign Manager',false,'• RBAC Security & Multi-Tenant Authentication Engine
• OTA Fleet Rollout Campaign Console'),
('SW_07','Stage evidence · SW_07','D10','Integration Tests & Code PR Approval',false,'• Automated End-to-End API Test Suite Pass Report
• Staging Deployment Log & Peer Code Review Approval'),
('HW_30','Stage evidence · HW_30','D10','Prototype SMT & THT Assembly',false,'• SMT Reflow Thermal Profiling & Inspection Sheet
• Assembled Prototype PCBA Lots (A-Samples)'),
('HW_31','Stage evidence · HW_31','D10','Initial Hardware Bring-Up & Smoke Test',false,'• Power-On Smoke Test & Rail Voltage Measurement Log
• Hardware Clock & Reset Validation Report'),
('FW_08','Stage evidence · FW_08','D10','Target PCB Firmware Bring-Up',false,'• Target Board Diagnostic Firmware Validation Log
• ADC Sensor Calibration & Bus Timing Verification Sheet'),
('HW_29','Stage evidence · HW_29','D10','Automated EOL Test Jig & Fixture',false,'• Automated Bed-of-Nails Test Fixture PCB & Wiring Drawing
• EOL Calibration Log & IMTE Traceability Certificate
• Test Executive Software Suite & UI Setup'),
('FW_09','Stage evidence · FW_09','D10','Diagnostic Test Firmware for EOL Jig',false,'• Automated Diagnostic Test Firmware Binary (.hex/.bin)'),
('SW_08','Stage evidence · SW_08','D10','End-to-End Loopback Validation',false,'• Hardware-to-Cloud Live Telemetry Ingestion Log
• Remote Actuator Command Execution Latency Report (<200ms)'),
('HW_27','Stage evidence · HW_27','D13','EMC/EMI & ESD Pre-Compliance Testing',false,'• Radiated & Conducted Emissions Laboratory Scan Report
• ESD Immunity & ISO 7637-2 Transient Pulse Test Sheet'),
('FW_10','Stage evidence · FW_10','D10','Offline Buffering & Reconnection Stress',false,'• Flash Memory Ring-Buffer Endurance Test Report
• Cellular Drop & Network Reconnection Stress Log'),
('FW_11','Stage evidence · FW_11','D13','72-Hour Soak & Thermal Chamber Test',false,'• 72-Hour Continuous Thermal Soak Test Log (-40°C to +85°C)
• System Stability & Zero-Watchdog Reset Verification Sheet'),
('SW_09','Stage evidence · SW_09','D10','Staging Security UAT & Pen Testing',false,'• OWASP Top 10 Penetration Testing & Vulnerability Audit
• Client User Acceptance Testing (UAT) Sign-Off'),
('HW_28','Stage evidence · HW_28','D10','Final HSI Freeze & ECN Check',false,'• Final Frozen Hardware-Software Interface (HLPL-[PROJ]-FW-HSI-01)
• Closed Pre-Compliance ECN Delta Resolution Memo'),
('HW_32','Stage evidence · HW_32','D13','Design Verification Report (DVR)',false,'• Consolidated Design Verification Report (HLPL-[PROJ]-QA-DVR-01)
• DVP Closure & Engineering Sign-Off Sheet'),
('HW_33','Stage evidence · HW_33','D13','Client Field Trial & Fitment Support',false,'• Client Vehicle Fitment & Harness Installation Report
• Pilot Fleet Real-World Operating Log'),
('HW_37','Stage evidence · HW_37','D31','Regulatory TAC Certification (ARAI/CE)',true,'• Official AIS-140 / ARAI / ICAT Type Approval Certificate (TAC)
• Homologation Test Reports & Regulatory Compliance Dossier'),
('FW_12','Stage evidence · FW_12','D10','Production Firmware Binary Freeze',true,'• Signed Production Firmware Binary (.bin / .hex)
• SHA-256 Checksum Certificate & Release Notes'),
('FW_13','Stage evidence · FW_13','D10','Field Telemetry Diagnostics & Crash Logs',false,'• Production Telemetry Diagnostic Dashboard
• Automated Crash Dump & Exception Monitoring Log'),
('SW_10','Stage evidence · SW_10','D10','Production Cloud Deploy & IMEI Setup',false,'• Multi-Region Production Cloud Deployment Record
• Factory EOL Serialized IMEI/MAC Registry Ingestion Setup'),
('SW_11','Stage evidence · SW_11','D10','Staged Canary OTA Rollout & SLA Mon.',false,'• Staged Canary OTA Rollout Schedule (1% -> 10% -> 100%)
• Server SLA & 99.9% Cloud Uptime Monitoring Dashboard'),
('HW_34','Stage evidence · HW_34','D10','Production BOM Freeze',false,'• Final Production Bill of Materials (HLPL-[PROJ]-EHW-BOM-01)
• SCM Approved Supplier List (ASL) 100% Compliance Audit'),
('G7_01','Stage evidence · G7_01','D32','Pre-Production Golden Firmware & FOTA Validation',false,'• Golden Sample Firmware Flashing Verification Certificate
• Over-The-Air (FOTA) Automated Rollback Stress Log'),
('G7_02','Stage evidence · G7_02','D32','Pilot Production Run & Work Instructions (SOP) Freeze',false,'• Pilot Production Run Yield & Scrap Report
• Standard Operating Procedures & Station Work Instructions (BCU WI)
• SMT Reflow Profile & Process Control Sheet'),
('G7_03','Stage evidence · G7_03','D32','Safe Launch Quality Plan (SLQP) & Early Containment',false,'• Safe Launch Quality Plan (SLQP) & Containment Firewall
• 100% Redundant Gate Inspection Log'),
('G7_04','Stage evidence · G7_04','D18','Supplier Volume Readiness & Dual-Sourcing Freeze',false,'• Supplier Capacity Gap Assessment Report (F-PUR-16)
• Dual-Source Qualified Component Register (PartsBench)'),
('HW_35','Stage evidence · HW_35','D10','Final Production Gerber & Panel Release',true,'• Final Production Gerber & Drill Archive (HLPL-[PROJ]-EHW-GER-01)
• SMT Laser Stencil Aperture Specification Drawing'),
('HW_36','Stage evidence · HW_36','D10','ECN / ECO Closure (HW_36A)',false,'• Closed Engineering Change Order (ECO) Register
• Archived Superseded Drawing Package & Revision History Log'),
('G8_01','Stage evidence · G8_01','D19','PPAP Level 3 & PSW Submission',false,'• Production Part Approval Process (PPAP) Level 3 Dossier (F-PUR-15)
• Part Submission Warrant (PSW) Signed by Quality Head
• Dimensional Inspection Results & Material Test Reports (MTR)
• Production Control Plan (HLPL-[PROJ]-CP-01)'),
('G8_02','Stage evidence · G8_02','D32','OEM Line Audit & Run-at-Rate Verification',false,'• OEM Plant Process Audit Scorecard
• Run-at-Rate Capacity Demonstration Report (Takt Time Verification)'),
('G8_03','Stage evidence · G8_03','D32','Golden Sample & Master Calibration Archive',true,'• Master Golden Sample Inspection Record & Boundary Units
• NABL-Traceable Calibration Certificates & Test Jig Log'),
('G8_04','Stage evidence · G8_04','D32','Mass Production Handover & Ramp-Up',false,'• Manufacturing Operations Handover Certificate
• Series Production Yield & Process Capability Dashboard (Cp/Cpk)'),
('G9_01','Stage evidence · G9_01','D32','Project Wrap-up Checklist & Audit Readiness',false,'• Project Audit Readiness Verification Checklist
• QMS / IATF 16949 Compliance Audit Dossier'),
('G9_02','Stage evidence · G9_02','D26','Final Budget Reconciliation & Cost Variance Analysis',false,'• Final Project Budget & CapEx Reconciliation Report
• Product BOM Cost Variance Analysis Summary'),
('G9_03','Stage evidence · G9_03','D30','Post-Launch Risk Scoring & Residual Risk Assessment',false,'• Post-Launch Enterprise Risk Register
• Residual Risk Assessment & CAPA Effectiveness Sign-Off'),
('G9_04','Stage evidence · G9_04','D25','Cross-Functional Retrospective & Lessons Learned',false,'• Cross-Functional Project Retrospective Report
• Organizational Lessons Learned Register (HLPL-QA-LLR-01)'),
('G9_05','Stage evidence · G9_05','D10','Design Artifact, Codebase & Test Jig Archival',true,'• Tagged Production Codebase & Firmware Git Release
• Master Design Drawings & Calibrated Tooling Inventory Archive'),
('G9_06','Stage evidence · G9_06','D32','Executive Tollgate Review & Formal Project Closure',false,'• Executive Tollgate Review Presentation & Closure Dossier
• Signed Executive Project Closure Certificate (G9-SIGN-01)');

CREATE FUNCTION private.guard_stage_deliverable_record() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE binding record; project public.operational_records%ROWTYPE; stage jsonb; owner_id uuid;
BEGIN
 IF NEW.record_type NOT LIKE 'Stage evidence · %' OR NOT private.is_shared_test_org(NEW.organization_id) THEN RETURN NEW; END IF;
 SELECT * INTO binding FROM private.stage_deliverable_bindings WHERE record_type=NEW.record_type;
 IF NOT FOUND THEN RAISE EXCEPTION 'UNREGISTERED_STAGE_DELIVERABLE'; END IF;
 SELECT * INTO project FROM public.operational_records WHERE organization_id=NEW.organization_id AND record_type='Project' AND archived_at IS NULL AND (id::text=NEW.fields->>'projectId' OR reference=NEW.fields->>'projectId');
 IF project.id IS NULL OR nullif(project.fields->>'lifecycleBaseline','') IS NULL THEN RAISE EXCEPTION 'PINNED_PROJECT_REQUIRED'; END IF;
 IF auth.uid() IS NOT NULL AND NOT private.shared_test_record_visible(project.id) THEN RAISE EXCEPTION 'PROJECT_DENIED'; END IF;
 SELECT value INTO stage FROM jsonb_array_elements((project.fields->>'lifecycleBaseline')::jsonb->'stages') WHERE value->>'code'=binding.stage_code;
 IF stage IS NULL OR NOT coalesce(stage->'exitTypes','[]'::jsonb) ? NEW.record_type THEN RAISE EXCEPTION 'DELIVERABLE_NOT_IN_PROJECT_SETTINGS'; END IF;
 SELECT id INTO owner_id FROM public.departments WHERE organization_id=NEW.organization_id AND active AND code=stage->>'department';
 IF owner_id IS NULL OR owner_id IS DISTINCT FROM NEW.department_id THEN RAISE EXCEPTION 'STAGE_DELIVERABLE_DEPARTMENT_MISMATCH'; END IF;
 IF NOT public.is_stage_applicable_to_track(binding.stage_code,coalesce(project.fields->>'track',project.fields->>'projectTrack')) THEN RAISE EXCEPTION 'STAGE_NOT_APPLICABLE_TO_TRACK'; END IF;
 NEW.fields:=NEW.fields||jsonb_build_object('recordStage',binding.stage_code,'catalogueFamily',binding.family_code,'requiredDeliverables',binding.required_deliverables);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_stage_deliverable_record() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage_deliverable_record BEFORE INSERT OR UPDATE ON public.operational_records FOR EACH ROW EXECUTE FUNCTION private.guard_stage_deliverable_record();

CREATE FUNCTION private.route_stage_deliverable_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE evidence public.operational_records%ROWTYPE; project_id uuid; binding record;
BEGIN
 IF NOT private.is_shared_test_org(NEW.organization_id) THEN RETURN NEW; END IF;
 SELECT * INTO evidence FROM public.operational_records WHERE id=NEW.record_id AND organization_id=NEW.organization_id;
 SELECT * INTO binding FROM private.stage_deliverable_bindings WHERE record_type=evidence.record_type;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT id INTO project_id FROM public.operational_records WHERE organization_id=NEW.organization_id AND record_type='Project' AND (id::text=evidence.fields->>'projectId' OR reference=evidence.fields->>'projectId');
 IF project_id IS NULL THEN RAISE EXCEPTION 'PINNED_PROJECT_REQUIRED'; END IF;
 IF TG_OP='INSERT' THEN
  NEW.reviewer_department_id:=private.project_stage_accountable_department(project_id,binding.stage_code,evidence.department_id);
  IF EXISTS(SELECT 1 FROM public.approvals WHERE organization_id=NEW.organization_id AND record_id=NEW.record_id AND reviewer_department_id=NEW.reviewer_department_id AND evidence_revision=NEW.evidence_revision AND outcome='pending') THEN RAISE EXCEPTION 'REVIEW_ALREADY_PENDING'; END IF;
 ELSIF NEW.outcome='approved' AND OLD.outcome IS DISTINCT FROM NEW.outcome AND binding.requires_original AND NOT private.has_record_original_object(evidence.id) THEN
  RAISE EXCEPTION 'VERIFIED_ORIGINAL_REQUIRED';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.route_stage_deliverable_approval() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_route_stage_deliverable_approval BEFORE INSERT OR UPDATE OF outcome ON public.approvals FOR EACH ROW EXECUTE FUNCTION private.route_stage_deliverable_approval();

DO $patch$
DECLARE definition text; needle text;
BEGIN
 definition:=pg_get_functiondef('private.assert_project_stage_evidence(uuid,text,jsonb)'::regprocedure);
 needle:='kind !~* ''(certificate|schematic|gerber|step|cad|firmware (binary|release)|production binary|hex|pcb layout|3d model)''';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'STAGE_DELIVERABLE_EVIDENCE_PATCH_PRECONDITION'; END IF;
 definition:=replace(definition,needle,'('||needle||' AND NOT EXISTS(SELECT 1 FROM private.stage_deliverable_bindings binding WHERE binding.record_type=kind AND binding.requires_original))');
 EXECUTE definition;
END $patch$;

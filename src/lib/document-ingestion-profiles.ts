/**
 * SSM One - 25 Portal Roles & Smart Upload Use-Case Profiles
 *
 * Implements the role profiles and catalogue family crosswalk defined in:
 * "SCMS Portal — Multi-Role Smart Upload & Intelligent Document Ingestion Specification"
 * and "SSM One Document Catalogue - Auto-Drafting Audit and Native Upload Rules".
 */

export type RoleCode =
  | "FAC"
  | "QA"
  | "MECH_DES"
  | "MECH_MFG"
  | "SIT"
  | "PUR"
  | "STR"
  | "DSP"
  | "SAL"
  | "EHW"
  | "FW"
  | "SW_BE"
  | "SW_FE"
  | "SW_APP"
  | "EMF"
  | "TST"
  | "FIN"
  | "OPS"
  | "PM"
  | "HR"
  | "LEG"
  | "DOC_CTRL"
  | "ADMIN"
  | "CLIENT"
  | "RND";

export type RoleUseCaseProfile = {
  id: string;
  roleCode: RoleCode;
  roleName: string;
  title: string;
  description: string;
  acceptedExtensions: string[];
  catalogueFamilyId: string; // e.g. D01 - D38
  catalogueFamilyName: string;
  targetRecordType: string;
  interlocksChecked: string[];
  expectedOutput: string;
};

export const ROLE_USE_CASE_PROFILES: RoleUseCaseProfile[] = [
  // 1. FAC
  {
    id: "fac_statutory_license",
    roleCode: "FAC",
    roleName: "Facility Management",
    title: "Statutory License / NOC / CTO",
    description: "Factory, Fire, UPPCB CTO statutory clearance certificate or renewal.",
    acceptedExtensions: ["pdf", "xlsx", "jpg", "png"],
    catalogueFamilyId: "D23",
    catalogueFamilyName: "Statutory & Compliance Certificates",
    targetRecordType: "Compliance Cert",
    interlocksChecked: ["ALERT_QA_02"],
    expectedOutput: "Draft compliance record in Facility Docs Vault; statutory license watchdog reset",
  },
  {
    id: "fac_amc_report",
    roleCode: "FAC",
    roleName: "Facility Management",
    title: "DG / HVAC / Cleanroom AMC Service Report",
    description: "Preventive maintenance and service reports for cleanroom and machinery.",
    acceptedExtensions: ["pdf", "xlsx", "csv"],
    catalogueFamilyId: "D01",
    catalogueFamilyName: "Common Operating Pack & Work Instructions",
    targetRecordType: "Maintenance Report",
    interlocksChecked: [],
    expectedOutput: "Draft maintenance record in Facility Docs Vault; TPM register updated",
  },

  // 2. QA
  {
    id: "qa_calibration_cert",
    roleCode: "QA",
    roleName: "Quality Assurance & Compliance",
    title: "NABL Equipment Calibration Certificate",
    description: "NABL-accredited laboratory instrument calibration report with uncertainty specs.",
    acceptedExtensions: ["pdf", "xlsx", "csv", "zip"],
    catalogueFamilyId: "D31",
    catalogueFamilyName: "Equipment & Tooling Qualification Pack",
    targetRecordType: "Calibration Cert",
    interlocksChecked: ["ALERT_QA_01"],
    expectedOutput: "Draft calibration entry in QA Docs Vault; clears 30-day calibration lock",
  },
  {
    id: "qa_lab_tac_report",
    roleCode: "QA",
    roleName: "Quality Assurance & Compliance",
    title: "Accredited Lab Test Report & TAC (AIS-140 / BIS / WPC)",
    description: "External compliance test reports (AIS-140, BIS, CE, WPC, ARAI/ICAT).",
    acceptedExtensions: ["pdf", "xlsx", "csv", "zip"],
    catalogueFamilyId: "D23",
    catalogueFamilyName: "Compliance Test Reports & Certifications",
    targetRecordType: "TAC Report",
    interlocksChecked: ["ALERT_QA_02"],
    expectedOutput: "Draft certification dossier in QA Docs Vault; clears 90-day TAC lock",
  },

  // 3. MECH_DES
  {
    id: "mech_cad_assembly",
    roleCode: "MECH_DES",
    roleName: "Mechanical Design",
    title: "3D Enclosure STEP / IGES Assembly",
    description: "3D CAD package for enclosure, boss coordinates, and clearance verification.",
    acceptedExtensions: ["step", "stp", "iges", "zip"],
    catalogueFamilyId: "D10",
    catalogueFamilyName: "Engineering Design Packages & CAD",
    targetRecordType: "STEP Model",
    interlocksChecked: ["ALERT_MECH_01"],
    expectedOutput: "Draft CAD release in Mechanical Docs Vault; ECAD-MCAD clearance check",
  },
  {
    id: "mech_2d_drawing",
    roleCode: "MECH_DES",
    roleName: "Mechanical Design",
    title: "2D Production & Wire Harness Drawing",
    description: "Fabrication 2D drawings with GD&T dimensions, pin-outs and wire lengths.",
    acceptedExtensions: ["pdf", "dwg", "dxf", "zip"],
    catalogueFamilyId: "D10",
    catalogueFamilyName: "Engineering Design Packages & Drawings",
    targetRecordType: "Mechanical Drawing",
    interlocksChecked: [],
    expectedOutput: "Draft production drawing in Mechanical Docs Vault",
  },

  // 4. MECH_MFG
  {
    id: "mmfg_fai_report",
    roleCode: "MECH_MFG",
    roleName: "Mechanical Manufacturing & Tooling",
    title: "CMM / 3D Laser Scan FAI Dimensional Report",
    description: "First-Article Inspection (FAI) dimensional report with GD&T tolerance checks.",
    acceptedExtensions: ["pdf", "xlsx", "csv", "jpg"],
    catalogueFamilyId: "D28",
    catalogueFamilyName: "First Article & Quality Inspection Reports",
    targetRecordType: "FAI Report",
    interlocksChecked: [],
    expectedOutput: "Draft FAI inspection record in MMF Docs Vault; sample batch verification",
  },

  // 5. SIT
  {
    id: "sit_rma_fault_sheet",
    roleCode: "SIT",
    roleName: "Service, Field RMA & IT",
    title: "Field RMA Return Batch & Customer Fault Sheet",
    description: "Serialized field warranty return batch, IMEI list, and customer fault diagnosis.",
    acceptedExtensions: ["xlsx", "csv", "pdf", "json"],
    catalogueFamilyId: "D36",
    catalogueFamilyName: "Customer Complaints & Field RMA Records",
    targetRecordType: "RMA Batch",
    interlocksChecked: [],
    expectedOutput: "Draft RMA service batch in Service Docs Vault; ticket creation",
  },

  // 6. PUR
  {
    id: "pur_vendor_quote",
    roleCode: "PUR",
    roleName: "Purchase & Procurement",
    title: "Vendor Quotation / Commercial Offer",
    description: "Supplier price quotation for raw materials, components, tooling or lab services.",
    acceptedExtensions: ["pdf", "xlsx", "xls", "csv", "docx"],
    catalogueFamilyId: "D18",
    catalogueFamilyName: "Supplier Quotations & Sourcing Evaluations",
    targetRecordType: "Supplier Quotation",
    interlocksChecked: ["ALERT_PUR_01"],
    expectedOutput: "Draft quotation in Purchasing Docs Vault; 3-quote comparison candidate",
  },
  {
    id: "pur_distributor_cart",
    roleCode: "PUR",
    roleName: "Purchase & Procurement",
    title: "Distributor Cart / Priced BOM (Mouser / DigiKey / Arrow)",
    description: "Component distributor cart export or bulk catalog pricing file.",
    acceptedExtensions: ["xlsx", "csv", "pdf"],
    catalogueFamilyId: "D18",
    catalogueFamilyName: "Supplier Quotations & Sourcing Evaluations",
    targetRecordType: "Distributor Quote",
    interlocksChecked: ["ALERT_PUR_01"],
    expectedOutput: "Draft sourcing line items in Purchasing Docs Vault",
  },

  // 7. STR
  {
    id: "str_delivery_challan",
    roleCode: "STR",
    roleName: "Store & Inventory Control",
    title: "Vendor Delivery Challan / Gate Entry Slip",
    description: "Inbound delivery challan or packing slip for gate entry verification.",
    acceptedExtensions: ["pdf", "xlsx", "csv", "jpg", "png"],
    catalogueFamilyId: "D22",
    catalogueFamilyName: "Goods Receipt & Gate Inward Registers",
    targetRecordType: "Delivery Challan",
    interlocksChecked: ["ALERT_STR_01", "ALERT_STR_02"],
    expectedOutput: "Draft delivery evidence in Stores Docs Vault; pending physical receipt review",
  },

  // 8. DSP
  {
    id: "dsp_eway_bill",
    roleCode: "DSP",
    roleName: "Dispatch & Logistics",
    title: "Government e-Way Bill & Transporter LR",
    description: "Official GST e-Way Bill and transport lorry receipt for outgoing consignments.",
    acceptedExtensions: ["pdf", "json", "csv", "xlsx", "jpg"],
    catalogueFamilyId: "D22",
    catalogueFamilyName: "Dispatch Manifests & Shipping Evidence",
    targetRecordType: "e-Way Bill",
    interlocksChecked: ["ALERT_DSP_01"],
    expectedOutput: "Draft shipping document in Dispatch Docs Vault; finance 3-way match lock",
  },

  // 9. SAL
  {
    id: "sal_customer_sor",
    roleCode: "SAL",
    roleName: "Sales & Business Development",
    title: "Customer SOR / RFQ / Technical Specification Pack",
    description: "Client OEM requirements, SOR document, or formal commercial tender.",
    acceptedExtensions: ["pdf", "docx", "xlsx", "csv"],
    catalogueFamilyId: "D04",
    catalogueFamilyName: "Statement of Requirements & Customer Intake",
    targetRecordType: "Customer SOR",
    interlocksChecked: [],
    expectedOutput: "Routes to Smart SOR Importer for atomic baseline population & Opportunity creation",
  },
  {
    id: "sal_customer_po",
    roleCode: "SAL",
    roleName: "Sales & Business Development",
    title: "Customer Purchase Order (PO) / LOI",
    description: "Signed client customer purchase order or formal Letter of Intent.",
    acceptedExtensions: ["pdf", "docx", "xlsx"],
    catalogueFamilyId: "D05",
    catalogueFamilyName: "Customer Purchase Orders & Commercial Contracts",
    targetRecordType: "Customer PO",
    interlocksChecked: ["ALERT_SAL_01"],
    expectedOutput: "Draft customer PO record in Sales Docs Vault; commercial review",
  },

  // 10. EHW
  {
    id: "ehw_schematic_gerber",
    roleCode: "EHW",
    roleName: "Embedded Hardware Engineering",
    title: "ECAD Schematic (SCH) / Gerber Layout (PCB/GER)",
    description: "Altium/KiCad schematic sheets, PCB layout package, and Gerber fabrication files.",
    acceptedExtensions: ["pdf", "zip", "schdoc", "pcbdoc", "kicad_sch", "kicad_pcb"],
    catalogueFamilyId: "D10",
    catalogueFamilyName: "Hardware Engineering Schematics & Gerber Packages",
    targetRecordType: "Schematic / Gerber",
    interlocksChecked: ["ALERT_HW_02"],
    expectedOutput: "Draft engineering package in EHW Docs Vault; DRC verification check",
  },
  {
    id: "ehw_component_datasheet",
    roleCode: "EHW",
    roleName: "Embedded Hardware Engineering",
    title: "Component Datasheet PDF",
    description: "IC, microcontroller, sensor, or power converter technical datasheet.",
    acceptedExtensions: ["pdf"],
    catalogueFamilyId: "D10",
    catalogueFamilyName: "Hardware Engineering Technical Datasheets",
    targetRecordType: "Datasheet",
    interlocksChecked: ["ALERT_HWW_01"],
    expectedOutput: "Draft component specification in EHW Docs Vault; PartsBench candidate",
  },

  // 11. FW
  {
    id: "fw_release_binary",
    roleCode: "FW",
    roleName: "Embedded Firmware Engineering",
    title: "Signed Firmware Binary (.hex / .bin / .elf)",
    description: "Compiled and signed firmware release image with SHA-256 integrity hash.",
    acceptedExtensions: ["hex", "bin", "elf", "zip"],
    catalogueFamilyId: "D10",
    catalogueFamilyName: "Firmware Releases & Binary Packages",
    targetRecordType: "Firmware Binary",
    interlocksChecked: ["ALERT_ESW_01"],
    expectedOutput: "Draft firmware release in FW Docs Vault; golden binary hash card",
  },
  {
    id: "fw_pin_matrix",
    roleCode: "FW",
    roleName: "Embedded Firmware Engineering",
    title: "MCU Pin-Mux Sheet / CubeMX .ioc / CAN .dbc",
    description: "Hardware-Software Interface pin mapping, CAN matrix, or CubeMX configuration.",
    acceptedExtensions: ["xlsx", "csv", "ioc", "dbc", "xml", "json"],
    catalogueFamilyId: "D10",
    catalogueFamilyName: "Hardware-Software Interface Specification",
    targetRecordType: "HSI Pinout",
    interlocksChecked: [],
    expectedOutput: "Draft HSI specification in FW Docs Vault; syncs with EHW",
  },

  // 12. SW_BE
  {
    id: "sw_be_api_contract",
    roleCode: "SW_BE",
    roleName: "Backend, Cloud & IoT Telemetry",
    title: "OpenAPI 3.0 / Swagger Contract (.yaml / .json)",
    description: "Cloud API specification, endpoints, and telemetry payload schemas.",
    acceptedExtensions: ["yaml", "json"],
    catalogueFamilyId: "D10",
    catalogueFamilyName: "Software Architecture & API Specifications",
    targetRecordType: "API Contract",
    interlocksChecked: ["ALERT_SW_01"],
    expectedOutput: "Draft API specification in Cloud Docs Vault",
  },

  // 13. SW_FE
  {
    id: "sw_fe_design_tokens",
    roleCode: "SW_FE",
    roleName: "Web Frontend & UI/UX",
    title: "Figma Design Tokens & UI Specs (.json)",
    description: "Component design tokens, style definitions, and web wireframes.",
    acceptedExtensions: ["json", "pdf", "png"],
    catalogueFamilyId: "D10",
    catalogueFamilyName: "Frontend UI/UX Specification & Assets",
    targetRecordType: "Design Tokens",
    interlocksChecked: [],
    expectedOutput: "Draft design tokens in UI/UX Docs Vault",
  },

  // 14. SW_APP
  {
    id: "sw_app_bundle",
    roleCode: "SW_APP",
    roleName: "Mobile Application Engineering",
    title: "Signed Mobile App Bundle (.aab / .apk / .ipa)",
    description: "Mobile companion application distribution package.",
    acceptedExtensions: ["aab", "apk", "ipa", "zip"],
    catalogueFamilyId: "D10",
    catalogueFamilyName: "Mobile Application Releases & Specs",
    targetRecordType: "Mobile Bundle",
    interlocksChecked: [],
    expectedOutput: "Draft mobile release record in App Docs Vault",
  },

  // 15. EMF
  {
    id: "emf_pnp_centroid",
    roleCode: "EMF",
    roleName: "Electronics Manufacturing (SMT/THT)",
    title: "Pick-and-Place Centroid (XYR) & Feeder Setup",
    description: "SMT line placement centroid file and component feeder mapping.",
    acceptedExtensions: ["csv", "xlsx", "txt"],
    catalogueFamilyId: "D30",
    catalogueFamilyName: "Manufacturing Process & Production Engineering",
    targetRecordType: "SMT Centroid",
    interlocksChecked: ["ALERT_MFG_01"],
    expectedOutput: "Draft manufacturing setup in EMF Docs Vault",
  },

  // 16. TST
  {
    id: "tst_eol_telemetry",
    roleCode: "TST",
    roleName: "Production & Automated EOL Testing",
    title: "Automated EOL Test Log (.csv / .json)",
    description: "End-of-line test jig telemetry readings and device validation logs.",
    acceptedExtensions: ["csv", "json", "xlsx"],
    catalogueFamilyId: "D28",
    catalogueFamilyName: "Production Testing & Verification Data",
    targetRecordType: "EOL Test Log",
    interlocksChecked: ["ALERT_TST_01", "ALERT_TST_02"],
    expectedOutput: "Draft test verification record in Testing Docs Vault",
  },

  // 17. FIN
  {
    id: "fin_vendor_invoice",
    roleCode: "FIN",
    roleName: "Accounts & Finance",
    title: "Supplier GST Tax Invoice / E-Invoice",
    description: "Vendor tax invoice for 3-way match and commercial payment clearance.",
    acceptedExtensions: ["pdf", "json", "xlsx", "csv"],
    catalogueFamilyId: "D21",
    catalogueFamilyName: "Financial Vouchers & Invoices",
    targetRecordType: "Supplier Invoice",
    interlocksChecked: ["ALERT_FIN_01"],
    expectedOutput: "Draft invoice voucher in Finance Docs Vault; 3-way match validation",
  },

  // 18. OPS
  {
    id: "ops_audit_sheet",
    roleCode: "OPS",
    roleName: "Plant Operations & Excellence",
    title: "OEM Plant Line Audit & Run-at-Rate Sheet",
    description: "Plant manufacturing capability audit and line balancing study.",
    acceptedExtensions: ["xlsx", "csv", "pdf", "docx"],
    catalogueFamilyId: "D30",
    catalogueFamilyName: "Operations Audits & Line Balancing",
    targetRecordType: "Line Audit",
    interlocksChecked: ["ALERT_OPS_01"],
    expectedOutput: "Draft operational audit report in Operations Docs Vault",
  },

  // 19. PM
  {
    id: "pm_schedule_mpp",
    roleCode: "PM",
    roleName: "Program Management",
    title: "Master Project Schedule (.mpp / .xlsx / .csv)",
    description: "Cross-department Gantt schedule, tollgate milestones, and stage SLAs.",
    acceptedExtensions: ["xlsx", "csv", "pdf", "docx"],
    catalogueFamilyId: "D01",
    catalogueFamilyName: "Project Governance & Program Plans",
    targetRecordType: "Project Schedule",
    interlocksChecked: [],
    expectedOutput: "Draft project schedule in PM Docs Vault",
  },

  // 20. HR
  {
    id: "hr_skill_matrix",
    roleCode: "HR",
    roleName: "Human Resources & Competency",
    title: "Departmental Skill Matrix & Training Sheet",
    description: "Operator competency matrix, IPC-A-610 training records, and certifications.",
    acceptedExtensions: ["xlsx", "csv", "pdf"],
    catalogueFamilyId: "D01",
    catalogueFamilyName: "HR Competency & Training Registers",
    targetRecordType: "Skill Matrix",
    interlocksChecked: ["ALERT_HR_01"],
    expectedOutput: "Draft training record in HR Docs Vault; competency gate check",
  },

  // 21. LEG
  {
    id: "leg_signed_nda",
    roleCode: "LEG",
    roleName: "Legal & Compliance",
    title: "Signed Bilateral NDA / Contract Scan",
    description: "Mutual Non-Disclosure Agreement or customer commercial master agreement.",
    acceptedExtensions: ["pdf", "docx"],
    catalogueFamilyId: "D05",
    catalogueFamilyName: "Legal Agreements & Non-Disclosure Contracts",
    targetRecordType: "Signed NDA",
    interlocksChecked: ["ALERT_SAL_01"],
    expectedOutput: "Draft legal document in Legal Docs Vault; NDA clearance",
  },

  // 22. DOC_CTRL
  {
    id: "doc_ctrl_audit_register",
    roleCode: "DOC_CTRL",
    roleName: "Central Document Control & MR",
    title: "Offline Synchronized Audit Register (.xlsx)",
    description: "Controlled document master register or ISO surveillance audit report.",
    acceptedExtensions: ["xlsx", "csv", "pdf", "zip"],
    catalogueFamilyId: "D01",
    catalogueFamilyName: "Central Document Control & QMS Registers",
    targetRecordType: "Audit Register",
    interlocksChecked: ["ALERT_OPS_02"],
    expectedOutput: "Draft audit document in Central Document Control Vault",
  },

  // 23. ADMIN
  {
    id: "admin_user_provisioning",
    roleCode: "ADMIN",
    roleName: "System Super Admin & Executive",
    title: "Bulk User, Role & Organization CSV",
    description: "Employee roster import or role assignment configuration.",
    acceptedExtensions: ["csv", "xlsx"],
    catalogueFamilyId: "D01",
    catalogueFamilyName: "System Configuration & Administrative Records",
    targetRecordType: "Admin Roster",
    interlocksChecked: [],
    expectedOutput: "Draft administrative template in Admin Vault",
  },

  // 24. CLIENT
  {
    id: "client_rfq_sor",
    roleCode: "CLIENT",
    roleName: "OEM Customer & External Client",
    title: "Client RFQ / Requirement Submission",
    description: "OEM Customer statement of requirements or request for quotation.",
    acceptedExtensions: ["pdf", "docx", "xlsx"],
    catalogueFamilyId: "D04",
    catalogueFamilyName: "Customer Requirement Intake",
    targetRecordType: "Customer Intake",
    interlocksChecked: [],
    expectedOutput: "Routes to Sales Intake and Customer SOR Review",
  },

  // 25. RND
  {
    id: "rnd_candidate_datasheet",
    roleCode: "RND",
    roleName: "Applied Research & Pre-NPD",
    title: "Silicon / Sensor Evaluation Datasheet & Trace",
    description: "Pre-NPD candidate component evaluation or Nordic PPK2 power trace.",
    acceptedExtensions: ["pdf", "csv", "xlsx", "zip"],
    catalogueFamilyId: "D10",
    catalogueFamilyName: "Research Bench & Component Trade-Offs",
    targetRecordType: "R&D Tech Brick",
    interlocksChecked: [],
    expectedOutput: "Draft research asset in R&D Docs Vault",
  },
];

export function getProfilesForRole(roleCode: RoleCode | string): RoleUseCaseProfile[] {
  const code = roleCode.toUpperCase();
  return ROLE_USE_CASE_PROFILES.filter((p) => p.roleCode === code);
}

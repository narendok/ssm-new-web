import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  Award,
  Truck,
  Download,
  Eye,
  Calendar,
  Building,
  ExternalLink,
  Layers,
  Sparkles,
  Lock,
  Clock,
  PackageCheck,
  AlertCircle,
  X,
  Printer,
  FileSpreadsheet,
  File,
  Filter,
  ShieldAlert,
  ChevronRight,
  Table,
} from "lucide-react";

export interface ClientOEMPortalProps {
  demoMode?: boolean | undefined;
  focusDeliverables?: number;
  onOpenDocument?: (docId: string) => void;
}

interface DocumentAttachment {
  filename: string;
  type: "docx" | "xlsx" | "pdf";
  size: string;
  label: string;
  url: string;
}

interface DeliverableDoc {
  id: string;
  code: string;
  title: string;
  category: string;
  standard: string;
  status: string;
  date: string;
  owner: string;
  description: string;
  classification: "OEM Released" | "Customer Controlled";
  retention: string;
  attachments: DocumentAttachment[];
  sheetDetails: {
    project: string;
    version: string;
    effectiveDate: string;
    scope: string;
    parameters: { label: string; value: string }[];
    signoffs: { role: string; person: string; org: string; status: string; hash: string }[];
    clauses: string[];
  };
}

interface MatrixDocument {
  id: string;
  stage: string;
  title: string;
  dept: string;
  classification: "OEM Released" | "Internal Confidential" | "Proprietary Trade Secret" | "Customer Controlled";
  clientAccess: "Granted" | "Restricted";
  accessReason: string;
  retention: string;
  fileFormat: string;
}

export function ClientOEMPortal({
  onOpenDocument,
  demoMode = false,
  focusDeliverables = 0,
}: ClientOEMPortalProps) {
  const [activeTab, setActiveTab] = useState<"deliverables" | "matrix">("deliverables");
  const [selectedDoc, setSelectedDoc] = useState<DeliverableDoc | null>(null);
  const [modalTab, setModalTab] = useState<"sheet" | "attachments" | "governance">("sheet");
  const [matrixFilter, setMatrixFilter] = useState<"all" | "granted" | "restricted">("all");

  useEffect(() => {
    if (!focusDeliverables) return;
    setActiveTab("deliverables");
    setSelectedDoc(null);
    document.getElementById("client-document-center")?.scrollIntoView({ behavior: "smooth" });
  }, [focusDeliverables]);

  if (!demoMode) return <section className="rounded-xl border border-border bg-card p-6"><h1 className="text-xl font-semibold">Customer Deliverables</h1><p className="mt-3 text-sm text-muted-foreground">No verified customer release is available in this workspace. An authorized owner must release the project document and grant recipient access before it appears here.</p></section>;
  if (demoMode) return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-6">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <strong>TEST DATA · FICTIONAL PROJECT VIEW</strong>
        <p className="mt-1">This sample helps exercise the portal layout. It contains no customer acceptance, executed agreement, issued invoice, shipment, certification or approved release.</p>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">TEST-PROJ-NORTHSTAR-01 · Phase 0 · Feasibility</p>
        <h1 className="mt-1 text-xl font-semibold">Northstar Mobility Systems · Fleet Gateway feasibility</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Fictional enquiry with open hardware, firmware, software, mechanical, sourcing, quality and budget assumptions. No customer-facing documents have been released.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Requirements</p><p className="mt-1 font-medium">Draft scope under review</p></div>
        <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Engineering</p><p className="mt-1 font-medium">HW / FW / SW PoC planning</p></div>
        <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">External release</p><p className="mt-1 font-medium">None · human authorization required</p></div>
      </div>
      <p className="text-xs text-muted-foreground">To test project work, use the internal portal’s Projects, Tasks and Documents views. This screen is not a real client account or a customer-acceptance record.</p>
    </section>
  );

  const deliverables: DeliverableDoc[] = [
    {
      id: "HLPL-AI4T-SAL-SOR-01",
      code: "SOR-01",
      title: "Customer Statement of Requirements (SOR)",
      category: "Requirements Baseline",
      standard: "IATF 16949 §8.2.1",
      status: "Customer Approved",
      date: "2026-08-15",
      owner: "Priya Sharma (Sales & BD Lead)",
      classification: "OEM Released",
      retention: "15 Years (IATF §7.5.3)",
      description:
        "Official technical and operational customer requirements baseline for Tata Ace EV 4G Telematics Gateway (50,000 units/year).",
      attachments: [
        {
          filename: "HLPL-AI4T-SAL-SOR-01.docx",
          type: "docx",
          size: "1.77 KB",
          label: "Full Specification Document (.docx)",
          url: "/sample-docs/HLPL-AI4T-SAL-SOR-01.docx",
        },
      ],
      sheetDetails: {
        project: "HLPL-AI4T-01 · Tata Ace EV 4G Telematics Gateway",
        version: "Rev 01 (Final Baseline)",
        effectiveDate: "15-Aug-2026",
        scope:
          "Defines technical, electrical, environmental, CAN bus, and commercial specifications for 50,000 units of AIS-140 telematics hardware deployed in Tata Motors commercial electric vehicles.",
        parameters: [
          { label: "Nominal Supply Voltage", value: "12V / 24V DC automotive systems (Operating range: 9V to 36V DC)" },
          { label: "Conducted Transient Immunity", value: "ISO 7637-2 Pulses 1, 2a, 2b, 3a, 3b, and Pulse 5b Load Dump (87V/400ms clamped)" },
          { label: "Cellular Telemetry", value: "4G LTE Cat-1 (B1/B3/B5/B8/B28) with 2G GSM/GPRS fallback, internal eSIM + micro-SIM" },
          { label: "Satellite Positioning (GNSS)", value: "Multi-constellation GPS / GLONASS / Indian NavIC L5, TTFF < 35s cold start, accuracy < 2.5m" },
          { label: "Vehicle CAN Bus Interface", value: "ISO 11898 high-speed CAN 2.0B / J1939 @ 250 kbps & 500 kbps, 120Ω termination, optical isolation" },
          { label: "Digital & Analog I/O", value: "4x Configurable Digital Inputs, 2x Analog Inputs (0–32V), 1x RS232 / RS485 diagnostic port" },
          { label: "Ingress Protection Rating", value: "IP67 sealed enclosure with automotive Gore vent membrane against dust and water immersion" },
          { label: "Operating Temperature", value: "-40°C to +85°C (Automotive Grade 2 component qualification)" },
        ],
        signoffs: [
          { role: "Vendor Author / Sales Lead", person: "Priya Sharma", org: "Hexense Labs Pvt Ltd", status: "Released", hash: "SHA256: 7e2c9a81f" },
          { role: "Technical Feasibility Review", person: "Avery Vale (EHW Lead)", org: "Hexense Labs Pvt Ltd", status: "Approved", hash: "SHA256: 4b18c092e" },
          { role: "Customer Acceptance HOD", person: "Mr. Rohan Verma", org: "Tata Motors Ltd · EV Fleet Division", status: "Accepted & Sealed", hash: "SHA256: 9d83aa410" },
        ],
        clauses: [
          "Compliance with Automotive Industry Standard AIS-140 (Revision 1) is mandatory for all production units.",
          "Engineering Change Notices (ECN) require formal written approval from Tata Motors EV Fleet engineering committee.",
          "Zero critical software bugs and 100% End-of-Line test clearance prior to factory packing.",
        ],
      },
    },
    {
      id: "HLPL-AI4T-SAL-mNDA-01",
      code: "mNDA-01",
      title: "Bilateral Mutual Non-Disclosure Agreement",
      category: "Legal & Confidentiality",
      standard: "ISO/IEC 27001 §A.13",
      status: "Executed & Active",
      date: "2026-08-10",
      owner: "Legal & Executive Admin",
      classification: "Customer Controlled",
      retention: "15 Years (ISO 27001)",
      description:
        "Mutual proprietary data, telematics protocol, and automotive intellectual property protection agreement executed between Tata Motors Ltd and Hexense Labs Pvt Ltd.",
      attachments: [
        {
          filename: "HLPL-AI4T-SAL-mNDA-01.docx",
          type: "docx",
          size: "1.46 KB",
          label: "Executed Word Document (.docx)",
          url: "/sample-docs/HLPL-AI4T-SAL-mNDA-01.docx",
        },
        {
          filename: "HLPL-AI4T-SAL-mNDA-01.pdf",
          type: "pdf",
          size: "1.04 KB",
          label: "Countersigned Legal Agreement (.pdf)",
          url: "/sample-docs/HLPL-AI4T-SAL-mNDA-01.pdf",
        },
      ],
      sheetDetails: {
        project: "HLPL-AI4T-01 · Commercial Telematics Strategic Collaboration",
        version: "Executed Version 1.0",
        effectiveDate: "10-Aug-2026",
        scope:
          "Enforces reciprocal obligations of confidentiality regarding proprietary vehicle communication protocols, CAN bus arbitration matrices, cryptographic certificates, and pricing models.",
        parameters: [
          { label: "Contracting Party 1", value: "Tata Motors Limited (EV Fleet Division, Pimpri, Pune, MH, India)" },
          { label: "Contracting Party 2", value: "Hexense Labs Private Limited (Six Sense Mobility, Greater Noida, UP, India)" },
          { label: "Effective Agreement Term", value: "5 Years active duration from execution date (Survival: Perpetual for trade secrets)" },
          { label: "Information Security Standard", value: "ISO/IEC 27001:2022 §A.13 Information Transfer and §A.9 Access Control" },
          { label: "Governing Jurisdiction", value: "Courts of New Delhi and Mumbai, India" },
          { label: "Breach Remedy Standard", value: "Immediate injunctive relief and statutory indemnification for automotive IP compromise" },
        ],
        signoffs: [
          { role: "Authorized Signatory (Supplier)", person: "Executive Admin / MD", org: "Hexense Labs Pvt Ltd", status: "Executed", hash: "SHA256: 3c81e9f1a" },
          { role: "Authorized Signatory (OEM)", person: "Mr. Rohan Verma / Legal Counsel", org: "Tata Motors Limited", status: "Executed", hash: "SHA256: 8a42d075c" },
        ],
        clauses: [
          "All CAN bus message schemas, battery management system (BMS) telematics, and encryption keys are deemed Tier-1 Confidential.",
          "Neither party shall reverse-engineer, decompile, or disclose microcode, schematics, or BOM structures to third parties.",
        ],
      },
    },
    {
      id: "HLPL-AI4T-SAL-QUO-01",
      code: "QUO-01",
      title: "Commercial Quotation & Volume Tier Agreement",
      category: "Commercial Baseline",
      standard: "Contract Baseline",
      status: "Locked & Approved",
      date: "2026-09-02",
      owner: "Priya Sharma (Sales & BD Lead)",
      classification: "OEM Released",
      retention: "10 Years (Statutory Audit)",
      description:
        "Commercial contract locking unit pricing, annual commitment of 50,000 units (₹20,33,50,000 / $2.45M), milestone billing, and warranty SLAs.",
      attachments: [
        {
          filename: "HLPL-AI4T-SAL-QUO-01.xlsx",
          type: "xlsx",
          size: "2.06 KB",
          label: "Volume Pricing & Schedule Sheet (.xlsx)",
          url: "/sample-docs/HLPL-AI4T-SAL-QUO-01.xlsx",
        },
      ],
      sheetDetails: {
        project: "HLPL-AI4T-01 · Tata Ace EV 4G Telematics Gateway",
        version: "Rev 01 (Commercial Lock)",
        effectiveDate: "02-Sep-2026",
        scope:
          "Binding commercial agreement locking unit economics, volume tier incentives, NRE soft-tooling amortization, and warranty replacement SLAs for the 50,000 unit annual delivery contract.",
        parameters: [
          { label: "Tier 1 Volume (1,000 units)", value: "₹4,450.00 / unit (Pilot batch evaluation)" },
          { label: "Tier 2 Volume (10,000 units)", value: "₹4,180.00 / unit (Quarterly ramp-up tier)" },
          { label: "Tier 3 Volume (50,000 units - Committed)", value: "₹4,067.00 / unit (Total Committed Value: ₹20,33,50,000 / $2.45M)" },
          { label: "NRE & Injection Tooling", value: "Zero upfront charge — amortized across Batch 01 production run" },
          { label: "Regulatory TAC Cost", value: "Included in commercial base price (ARAI / ICAT testing fees covered)" },
          { label: "Warranty SLA", value: "36 Months comprehensive field replacement warranty with 24-hour advance shipment" },
          { label: "Payment Milestones", value: "30 Days net from Goods Receipt Note (GRN) and Quality Clearance at Pune Plant" },
        ],
        signoffs: [
          { role: "Commercial Lead", person: "Priya Sharma", org: "Hexense Labs Pvt Ltd", status: "Approved", hash: "SHA256: 6b12a884d" },
          { role: "Finance Controller", person: "Priya Voss", org: "Hexense Labs Pvt Ltd", status: "Approved", hash: "SHA256: 1f99c221b" },
          { role: "Commercial Procurement HOD", person: "Mr. Rohan Verma", org: "Tata Motors Limited", status: "Confirmed & Locked", hash: "SHA256: 5e43a901c" },
        ],
        clauses: [
          "Prices are fixed for a period of 12 months from the date of initial commercial delivery.",
          "Long-lead component buffer stocks (14 weeks) maintained at Hexense Greater Noida SMT facility.",
        ],
      },
    },
    {
      id: "QA-TAC-01",
      code: "TAC-01",
      title: "ARAI / ICAT Type Approval Certificate (TAC #842)",
      category: "Certification & Regulatory",
      standard: "AIS-140 Annexure 3 & 8",
      status: "Type Approved (ARAI)",
      date: "2026-10-05",
      owner: "Jordan Blake (Quality Assurance Lead)",
      classification: "OEM Released",
      retention: "15 Years (MoRTH / ARAI)",
      description:
        "Official compliance certificate for automotive AIS-140 intelligent telematics, Indian NavIC/GPS positioning, emergency button alert, and VAHAN portal integration.",
      attachments: [
        {
          filename: "QA-TAC-01-AIS140-Certificate.pdf",
          type: "pdf",
          size: "1.30 KB",
          label: "Official ARAI Type Approval Certificate (.pdf)",
          url: "/sample-docs/QA-TAC-01-AIS140-Certificate.pdf",
        },
      ],
      sheetDetails: {
        project: "HLPL-AI4T-01 · Automotive AIS-140 Type Approval",
        version: "TAC Certificate #842 (Final)",
        effectiveDate: "05-Oct-2026",
        scope:
          "Certifies that the Vehicle Tracking Unit (VTU) Model HLPL-AI4T-01 complies with all requirements of AIS-140 (Rev 1) as tested at Automotive Research Association of India (ARAI), Pune.",
        parameters: [
          { label: "Testing Agency", value: "Automotive Research Association of India (ARAI), Pune (Accredited under CMVR)" },
          { label: "Device Hardware Model", value: "HLPL-AI4T-01 (Hardware Revision B2, Production Build)" },
          { label: "Firmware Version Tested", value: "v2.4.1-PROD-AIS140 (Cryptographic Hash: 8b04aef72)" },
          { label: "AIS-140 Annexure 3 (Emergency Alert)", value: "PASS — Panic button trigger packet dispatched within 2.1s to National Emergency Response Center" },
          { label: "AIS-140 Annexure 8 (RF & Positioning)", value: "PASS — Dual frequency NavIC L5 + GPS L1 accuracy verified < 2.1 meters in urban canyon test" },
          { label: "Electrical Transient Immunity", value: "ISO 7637-2 (Pulses 1, 2a, 2b, 3a, 3b) & ISO 16750-2 Clamped Load Dump (PASS)" },
          { label: "EMC / EMI Compliance", value: "CISPR 25 Class 3 conducted and radiated emissions compliant across all vehicle bands" },
          { label: "VAHAN Portal Authorization", value: "Device Model listed on Ministry of Road Transport & Highways (MoRTH) Central VAHAN Registry" },
        ],
        signoffs: [
          { role: "Lead Testing Engineer", person: "ARAI Certification Directorate", org: "ARAI Pune", status: "Certified", hash: "SHA256: 0a93fe884" },
          { role: "Quality Assurance HOD", person: "Jordan Blake", org: "Hexense Labs Pvt Ltd", status: "Verified", hash: "SHA256: d241b7720" },
        ],
        clauses: [
          "Certificate valid for 3 years (valid through October 2029) covering series mass production.",
          "Production COP (Conformity of Production) audits scheduled annually as per CMVR Rule 126.",
        ],
      },
    },
    {
      id: "TST-PDI-01",
      code: "PDI-01",
      title: "Pre-Delivery Inspection (PDI) 100% Quality Certificate",
      category: "Quality Batch Release",
      standard: "IATF 16949 §8.6",
      status: "Cleared (0 Defects)",
      date: "2026-10-16",
      owner: "Mina Cross (EOL Testing Lead)",
      classification: "OEM Released",
      retention: "15 Years (IATF §7.5.3)",
      description:
        "Automated EOL Jig batch verification report confirming 100% firmware flashing, RF calibration, CAN telemetry, and zero-defect release for Batch 01 (5,000 units).",
      attachments: [
        {
          filename: "TST-PDI-01-Quality-Release.xlsx",
          type: "xlsx",
          size: "2.13 KB",
          label: "100% Batch Inspection Matrix (.xlsx)",
          url: "/sample-docs/TST-PDI-01-Quality-Release.xlsx",
        },
      ],
      sheetDetails: {
        project: "HLPL-AI4T-01 · Batch 01 Pre-Delivery Quality Inspection",
        version: "PDI Batch Release 01",
        effectiveDate: "16-Oct-2026",
        scope:
          "Authorizes quality release of Batch 01 (Serial Range SLCT-2026-0101 to SLCT-2026-5100) after 100% functional verification on automated production jigs.",
        parameters: [
          { label: "Inspected Batch Volume", value: "5,000 Units (100% Automated Jig Inspection — 0 Sampling)" },
          { label: "First-Pass Yield (FPY)", value: "98.7% on initial jig pass (32 units reworked at SMT touchup; Final Yield: 100.0%)" },
          { label: "Firmware Flash & SHA-256 Verification", value: "5,000 / 5,000 PASS (v2.4.1-PROD bootloader locked with secure boot keys)" },
          { label: "LTE-FDD Transmit Power & Sensitivity", value: "5,000 / 5,000 PASS (Tx power: 23.2 dBm ± 0.5; Rx sensitivity: -102.4 dBm)" },
          { label: "NavIC Satellite TTFF Test", value: "5,000 / 5,000 PASS (Average cold TTFF: 28.4 seconds in shielded test fixture)" },
          { label: "CAN 2.0B / J1939 Loopback Verification", value: "5,000 / 5,000 PASS (Zero bit errors across 50,000 test telemetry frames per unit)" },
          { label: "Sleep Mode Quiescent Current", value: "5,000 / 5,000 PASS (Measured average: 1.84 mA — well below 2.5 mA limit)" },
          { label: "Enclosure IP67 Helium Leak Test", value: "5,000 / 5,000 PASS (Vacuum differential decay < 5 Pa/sec)" },
        ],
        signoffs: [
          { role: "Automated EOL Jig Lead", person: "Mina Cross", org: "Hexense Labs Pvt Ltd", status: "Cleared", hash: "SHA256: 4e99f11a0" },
          { role: "Quality Assurance HOD", person: "Jordan Blake", org: "Hexense Labs Pvt Ltd", status: "Approved for Dispatch", hash: "SHA256: 8c33e771d" },
        ],
        clauses: [
          "All 5,000 devices marked with unique QR code labels containing Serial, IMEI, MAC, and ARAI TAC #842.",
          "Batch authorized for immediate packaging and shipment to Tata Motors assembly lines.",
        ],
      },
    },
    {
      id: "FIN-INV-01",
      code: "INV-01",
      title: "Commercial Tax Invoice & Dispatch Authorization",
      category: "Finance & Tax",
      standard: "GST Compliant · HSN 8526",
      status: "Released",
      date: "2026-10-17",
      owner: "Priya Voss (Finance & Accounts Controller)",
      classification: "OEM Released",
      retention: "8 Years (Statutory Tax Compliance)",
      description:
        "Official commercial tax invoice, e-way bill authorization, and batch delivery documentation for Batch 01 (5,000 units) dispatch.",
      attachments: [
        {
          filename: "FIN-INV-01-Commercial-Tax-Invoice.xlsx",
          type: "xlsx",
          size: "2.03 KB",
          label: "Commercial Tax Invoice & E-Way Bill (.xlsx)",
          url: "/sample-docs/FIN-INV-01-Commercial-Tax-Invoice.xlsx",
        },
      ],
      sheetDetails: {
        project: "HLPL-AI4T-01 · Batch 01 Commercial Tax Dispatch",
        version: "Invoice #INV-HLPL-2026-0428",
        effectiveDate: "17-Oct-2026",
        scope:
          "Official commercial tax invoice and statutory E-Way bill releasing Batch 01 shipment from Hexense Greater Noida SMT facility to Tata Motors Commercial Vehicle plant in Pune.",
        parameters: [
          { label: "Tax Invoice Number", value: "INV-HLPL-2026-0428 (E-Way Bill: 5810-4920-1193)" },
          { label: "Seller Entity", value: "Hexense Labs Pvt Ltd · Greater Noida SMT Plant 2 (GSTIN: 09AAACH7482K1Z8)" },
          { label: "Buyer Entity", value: "Tata Motors Limited · EV Fleet Solutions, Pimpri, Pune (GSTIN: 27AAACT2727Q1ZW)" },
          { label: "Item Description & HSN Code", value: "Tata Ace EV AIS-140 Telematics Gateway Model HLPL-AI4T-01 (HSN: 85269190)" },
          { label: "Billed Quantity", value: "5,000 Units @ ₹4,067.00 per unit" },
          { label: "Taxable Subtotal", value: "₹2,03,35,000.00 (Two Crore Three Lakh Thirty-Five Thousand Rupees)" },
          { label: "Applicable Taxes (CGST + SGST)", value: "CGST 9%: ₹18,30,150.00 | SGST 9%: ₹18,30,150.00 (Total Tax: ₹36,60,300.00)" },
          { label: "Total Gross Invoice Amount", value: "₹2,39,95,300.00 (Two Crore Thirty-Nine Lakh Ninety-Five Thousand Three Hundred Rupees)" },
          { label: "Logistics Carrier", value: "Safexpress Automotive Direct (Air-Ride Specialized Transport — Consignment #SFX-90412)" },
        ],
        signoffs: [
          { role: "Finance Controller", person: "Priya Voss", org: "Hexense Labs Pvt Ltd", status: "Digitally Signed", hash: "SHA256: f190bc234" },
          { role: "Dispatch Officer", person: "Arun Chawla", org: "Hexense Labs Pvt Ltd", status: "E-Way Dispatched", hash: "SHA256: 7a88dc011" },
        ],
        clauses: [
          "Goods covered under comprehensive marine and transit insurance policy #MTR-2026-4401.",
          "Payment due 30 days from delivery and physical GRN sign-off at Tata Motors Pune receiving dock.",
        ],
      },
    },
    {
      id: "HLPL-OBD4-SIT-MNT-01",
      code: "MNT-01",
      title: "Vehicle Field Installation & Mounting Manual",
      category: "Field Operations & Service",
      standard: "ISO 20653 IP67 Protocol",
      status: "Released to OEM",
      date: "2026-10-12",
      owner: "Kai Morgan (Service & IT Lead)",
      classification: "OEM Released",
      retention: "15 Years (Vehicle Service Lifetime)",
      description:
        "Step-by-step automotive installation guide, pinout wiring diagram, CAN bus integration, and IP67 sealed mounting instructions for Tata Ace EV technicians.",
      attachments: [
        {
          filename: "HLPL-OBD4-SIT-MNT-01-Mounting-Guide.docx",
          type: "docx",
          size: "1.56 KB",
          label: "Vehicle Mounting Manual (.docx)",
          url: "/sample-docs/HLPL-OBD4-SIT-MNT-01-Mounting-Guide.docx",
        },
      ],
      sheetDetails: {
        project: "HLPL-AI4T-01 · Tata Ace EV In-Cabin Telematics Integration",
        version: "Revision 02 (Production Guide)",
        effectiveDate: "12-Oct-2026",
        scope:
          "Authoritative technical SOP for vehicle plant assembly line workers and certified field service technicians installing the HLPL-AI4T-01 gateway into Tata Ace EV vehicles.",
        parameters: [
          { label: "Physical Mounting Location", value: "Under-dashboard steel cross-member bracket behind instrument cluster (Horizontally leveled)" },
          { label: "Fastening Torque", value: "M4 Flanged Hex Bolts torqued to 2.2 ± 0.2 Nm with threadlocker" },
          { label: "Wiring Harness Connector", value: "16-pin automotive sealed Molex connector with secondary TPA locking latch" },
          { label: "CAN Bus T-Tap Specification", value: "Twisted pair (33 twists/meter) tap into chassis J1939 backbone with stub length < 0.3m" },
          { label: "Power Line In-Line Fuse", value: "3A fast-blow automotive blade fuse on unswitched battery +12V/+24V lead" },
          { label: "Ignition Sense Wire", value: "Connected to Terminal 15 (+12V switched with ignition key ON)" },
          { label: "Emergency Panic SOS Switch", value: "Console-mounted illuminated red momentary pushbutton with protective safety collar" },
          { label: "Diagnostic LED Sequence", value: "Green LED solid (NavIC Lock) + Blue LED solid (Cloud Connected) confirms successful install" },
        ],
        signoffs: [
          { role: "Service & IT Infrastructure Lead", person: "Kai Morgan", org: "Hexense Labs Pvt Ltd", status: "Approved", hash: "SHA256: d018cf42a" },
          { role: "Field Engineering Specialist", person: "Preeti Joshi", org: "Hexense Labs Pvt Ltd", status: "Verified", hash: "SHA256: b374e892c" },
        ],
        clauses: [
          "Do not install under metallic shields that obstruct upward RF path to NavIC satellite constellation.",
          "Ensure sealing grommet is seated correctly to maintain IP67 water and dust ingress resistance.",
        ],
      },
    },
  ];

  const visibilityMatrix: MatrixDocument[] = [
    {
      id: "HLPL-AI4T-SAL-SOR-01",
      stage: "Stage 1",
      title: "Customer Statement of Requirements (SOR)",
      dept: "Sales & BD",
      classification: "OEM Released",
      clientAccess: "Granted",
      accessReason: "Primary customer requirements baseline agreed under IATF 16949 §8.2.1.",
      retention: "15 Years",
      fileFormat: ".docx",
    },
    {
      id: "HLPL-AI4T-SAL-mNDA-01",
      stage: "Stage 1",
      title: "Bilateral Mutual Non-Disclosure Agreement",
      dept: "Executive / Legal",
      classification: "Customer Controlled",
      clientAccess: "Granted",
      accessReason: "Countersigned legal contract establishing reciprocal ISO 27001 data protection.",
      retention: "15 Years",
      fileFormat: ".docx, .pdf",
    },
    {
      id: "HLPL/F/MKT/01",
      stage: "Stage 2",
      title: "Contract Review & Multi-HOD Feasibility Record",
      dept: "All HODs",
      classification: "Internal Confidential",
      clientAccess: "Restricted",
      accessReason: "Contains internal engineering capability assessments and vendor lead-time trade secrets.",
      retention: "10 Years",
      fileFormat: "Internal Audit Log",
    },
    {
      id: "HLPL-AI4T-SAL-QUO-01",
      stage: "Stage 3",
      title: "Commercial Quotation & Volume SLA Agreement",
      dept: "Sales & BD",
      classification: "OEM Released",
      clientAccess: "Granted",
      accessReason: "Binding commercial price agreement and annual volume delivery commitment.",
      retention: "10 Years",
      fileFormat: ".xlsx",
    },
    {
      id: "HLPL-AI4T-EHW-PRS-01",
      stage: "Stage 3",
      title: "Product Requirement Specification (PRS)",
      dept: "Hardware R&D",
      classification: "Internal Confidential",
      clientAccess: "Restricted",
      accessReason: "Proprietary internal circuit topology, RF sensitivity thresholds, and chip-level architecture.",
      retention: "15 Years",
      fileFormat: "Internal Archive",
    },
    {
      id: "EHW-SCH-01",
      stage: "Stage 4",
      title: "Schematics & Altium PCB Layout Source",
      dept: "Hardware R&D",
      classification: "Proprietary Trade Secret",
      clientAccess: "Restricted",
      accessReason: "Confidential Hexense hardware intellectual property and multi-layer PCB design source.",
      retention: "15 Years",
      fileFormat: "Altium CAD Vault",
    },
    {
      id: "BOM-01",
      stage: "Stage 4",
      title: "Component Supplier BOM & Cost Structure",
      dept: "Purchasing & SCM",
      classification: "Proprietary Trade Secret",
      clientAccess: "Restricted",
      accessReason: "Confidential tier-1 component pricing, supplier agreements, and gross margin structures.",
      retention: "10 Years",
      fileFormat: "SCM Vault",
    },
    {
      id: "ESW-FW-01",
      stage: "Stage 4",
      title: "CAN J1939 Telemetry Firmware Source & Bootloader",
      dept: "Firmware & SW",
      classification: "Proprietary Trade Secret",
      clientAccess: "Restricted",
      accessReason: "Proprietary embedded C source code, encryption algorithms, and secure bootloader.",
      retention: "15 Years",
      fileFormat: "Git Secure Repo",
    },
    {
      id: "EMF-CP-01",
      stage: "Stage 5",
      title: "Box-Build Process Control Plan & PCBA Traceability",
      dept: "Manufacturing",
      classification: "Internal Confidential",
      clientAccess: "Restricted",
      accessReason: "Internal assembly controls, firmware configuration and functional-test acceptance criteria.",
      retention: "10 Years",
      fileFormat: "Plant MES",
    },
    {
      id: "QA-DVP-01",
      stage: "Stage 6",
      title: "DVP&R 18-Test Pre-Compliance Verification Plan",
      dept: "Quality Assurance",
      classification: "Internal Confidential",
      clientAccess: "Restricted",
      accessReason: "Internal raw oscillograms and testing laboratory stress logs (summary certified in TAC).",
      retention: "15 Years",
      fileFormat: "QA Test Vault",
    },
    {
      id: "EHW-DFMEA-01",
      stage: "Stage 7",
      title: "Hardware Design FMEA & Risk Priority Matrix",
      dept: "Hardware R&D",
      classification: "Internal Confidential",
      clientAccess: "Restricted",
      accessReason: "Internal failure mode analysis and mitigation strategies under AIAG-VDA guidelines.",
      retention: "15 Years",
      fileFormat: "Quality Vault",
    },
    {
      id: "QA-PPAP-03",
      stage: "Stage 7",
      title: "Production Part Approval Process (PPAP L3 Dossier)",
      dept: "Quality Assurance",
      classification: "OEM Released",
      clientAccess: "Granted",
      accessReason: "Official automotive PPAP Level 3 package released for OEM vehicle assembly qualification.",
      retention: "15 Years",
      fileFormat: "PPAP Package",
    },
    {
      id: "QA-TAC-01",
      stage: "Stage 8",
      title: "ARAI / ICAT Type Approval Certificate (TAC #842)",
      dept: "Quality Assurance",
      classification: "OEM Released",
      clientAccess: "Granted",
      accessReason: "Regulatory type approval certificate required for VAHAN vehicle registration.",
      retention: "15 Years",
      fileFormat: ".pdf",
    },
    {
      id: "TST-PDI-01",
      stage: "Stage 9",
      title: "Pre-Delivery Inspection (PDI) 100% Quality Certificate",
      dept: "EOL Testing",
      classification: "OEM Released",
      clientAccess: "Granted",
      accessReason: "Automated jig zero-defect release certificate authorizing vehicle mounting.",
      retention: "15 Years",
      fileFormat: ".xlsx",
    },
    {
      id: "FIN-INV-01",
      stage: "Stage 9",
      title: "Commercial Tax Invoice & E-Way Dispatch Package",
      dept: "Finance & Accounts",
      classification: "OEM Released",
      clientAccess: "Granted",
      accessReason: "Statutory commercial tax invoice and logistics consignment authorization.",
      retention: "8 Years",
      fileFormat: ".xlsx",
    },
    {
      id: "HLPL-OBD4-SIT-MNT-01",
      stage: "Stage 9",
      title: "Vehicle Field Installation & Mounting Manual",
      dept: "Service & IT",
      classification: "OEM Released",
      clientAccess: "Granted",
      accessReason: "Vehicle mounting guide, wiring pinouts, and field diagnostic LED SOP.",
      retention: "15 Years",
      fileFormat: ".docx",
    },
  ];

  const milestones = [
    { stage: "Stage 1", name: "Intake & SOR", status: "Completed", date: "Aug 2026" },
    { stage: "Stage 2", name: "Multi-HOD Feasibility", status: "Completed", date: "Aug 2026" },
    { stage: "Stage 3", name: "Commercial & PRS Lock", status: "Completed", date: "Sep 2026" },
    { stage: "Stage 4", name: "PoC & Schematics", status: "Completed", date: "Sep 2026" },
    { stage: "Stage 5", name: "Pilot Box-Build Integration", status: "Completed", date: "Sep 2026" },
    { stage: "Stage 6", name: "DVP&R 18 Tests", status: "Completed", date: "Oct 2026" },
    { stage: "Stage 7", name: "PPAP Level 3", status: "Completed", date: "Oct 2026" },
    { stage: "Stage 8", name: "AIS-140 TAC Approval", status: "Completed", date: "Oct 2026" },
    { stage: "Stage 9", name: "PDI & Batch Dispatch", status: "Active Release", date: "Current" },
  ];

  const filteredMatrix = visibilityMatrix.filter((doc) => {
    if (matrixFilter === "granted") return doc.clientAccess === "Granted";
    if (matrixFilter === "restricted") return doc.clientAccess === "Restricted";
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"><strong>DEMO CUSTOMER DOCUMENT GALLERY</strong><p className="mt-1">All milestones, prices, signatures, certifications and downloads below are illustrative examples. They are not actual customer releases or approved production evidence.</p></div>
      {/* Client OEM Portal Hero Header */}
      <div className="rounded-2xl border border-border/80 bg-linear-to-r from-card via-card to-blue-500/5 p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                OEM Stakeholder Portal
              </span>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                ISO 27001 §A.9 Secured
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                Client ID: OEM-TATA-PUNE-2026
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Tata Motors Limited · EV Fleet Solutions Portal
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Authorized stakeholder delivery interface for <strong>HLPL-AI4T-01</strong> (Tata Ace EV 4G Telematics Gateway — 50,000 units annual deployment).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-border/70 bg-card/80 px-3.5 py-1.5 text-right">
              <p className="text-[10px] uppercase font-mono text-muted-foreground">Lead OEM Contact</p>
              <p className="text-xs font-bold text-foreground">Mr. Rohan Verma (Fleet Manager)</p>
            </div>
          </div>
        </div>

        {/* High-Level Program Metrics */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <div className="rounded-xl border border-border/60 bg-card/60 p-3">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">Vehicle Platform</p>
            <p className="mt-1 text-sm font-bold text-foreground">Tata Ace EV Commercial</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">AIS-140 Compliant</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-3">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">Contract Commitment</p>
            <p className="mt-1 text-sm font-bold text-foreground">50,000 Units</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">₹20.33 Cr / $2.45M</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-3">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">Batch 01 Delivery</p>
            <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">5,000 Units Ready</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">PDI 100% Cleared</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-3">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">Certification</p>
            <p className="mt-1 text-sm font-bold text-foreground">ARAI TAC #842</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">Valid through 2029</p>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-xl border border-border/60 bg-card/60 p-3">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">OEM Warranty SLA</p>
            <p className="mt-1 text-sm font-bold text-foreground">36 Months</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">24h Replacement</p>
          </div>
        </div>
      </div>

      {/* Program Milestone Progress Stepper */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-foreground">
              OEM Milestone & Delivery Gate Timeline
            </h2>
          </div>
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
            Stage 8 / 9 Approved · 94% Complete
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {milestones.map((m, index) => {
            const isDone = index < 8;
            const isActive = index === 8;
            return (
              <div
                key={m.stage}
                className={`relative flex flex-col justify-between rounded-xl border p-2.5 transition-all ${
                  isDone
                    ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                    : isActive
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                    : "border-border/60 bg-card/40 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="font-bold">{m.stage}</span>
                  {isDone ? (
                    <CheckCircle2 className="size-3 text-emerald-500" />
                  ) : (
                    <Clock className="size-3 text-primary animate-pulse" />
                  )}
                </div>
                <div className="my-2">
                  <p className="text-xs font-bold leading-snug truncate" title={m.name}>
                    {m.name}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                  <span>{m.date}</span>
                  <span
                    className={
                      isDone
                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "text-primary font-bold"
                    }
                  >
                    {isDone ? "PASS" : "ACTIVE"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Workspace: Navigation Tabs (Deliverables vs Visibility Matrix) */}
      <div id="client-document-center" className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              Customer Document Control & Governance Center
            </h2>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 rounded-xl bg-secondary/40 p-1 border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab("deliverables")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "deliverables"
                  ? "bg-card text-foreground shadow-xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="size-3.5 text-primary" />
              <span>Released Deliverables ({deliverables.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("matrix")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "matrix"
                  ? "bg-card text-foreground shadow-xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Table className="size-3.5 text-emerald-500" />
              <span>Document Control Visibility Matrix (16)</span>
            </button>
          </div>
        </div>

        {/* TAB 1: RELEASED DELIVERABLES */}
        {activeTab === "deliverables" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <p>
                Authorized customer deliverables released under IATF 16949 / ISO 9001 governance for Tata Motors verification. Click <strong>Inspect Document</strong> to view drafted sheets and download sample files.
              </p>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                All 7 Deliverables Released & Downloadable
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {deliverables.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col justify-between rounded-xl border border-border/80 bg-secondary/20 p-4 transition-all hover:border-border hover:bg-secondary/40 shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                          {doc.code}
                        </span>
                        <span className="rounded bg-secondary border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {doc.category}
                        </span>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {doc.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-foreground sm:text-sm">
                        {doc.title}
                      </h3>
                      <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                        Doc ID: {doc.id} · {doc.standard}
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {doc.description}
                    </p>

                    {/* Attached Sample Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Attachments:</span>
                      {doc.attachments.map((att) => (
                        <span
                          key={att.filename}
                          className="inline-flex items-center gap-1 rounded border border-border bg-card/80 px-1.5 py-0.5 text-[10px] font-mono font-medium text-foreground"
                        >
                          {att.type === "docx" ? (
                            <FileText className="size-3 text-blue-500" />
                          ) : att.type === "xlsx" ? (
                            <FileSpreadsheet className="size-3 text-emerald-500" />
                          ) : (
                            <File className="size-3 text-red-500" />
                          )}
                          <span>{att.filename}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Released: {doc.date}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDoc(doc);
                        setModalTab("sheet");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 hover:border-primary/50 transition-colors shadow-xs"
                    >
                      <Eye className="size-3.5 text-primary" />
                      <span>Inspect Document</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: DOCUMENT CONTROL VISIBILITY & CLASSIFICATION MATRIX */}
        {activeTab === "matrix" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-secondary/30 rounded-xl p-3 border border-border/60">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">
                  IATF 16949 §7.5.3 & ISO 27001 Document Control Matrix
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Defines access boundary: <strong>Customer Granted</strong> vs. <strong>Internal Engineering Restricted</strong>.
                </p>
              </div>

              {/* Filter controls */}
              <div className="flex items-center gap-1 rounded-lg bg-card p-1 border border-border/70 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setMatrixFilter("all")}
                  className={`px-2.5 py-0.5 rounded-md transition-colors ${
                    matrixFilter === "all" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All (16)
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixFilter("granted")}
                  className={`px-2.5 py-0.5 rounded-md transition-colors ${
                    matrixFilter === "granted" ? "bg-emerald-600 text-white font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Granted (7)
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixFilter("restricted")}
                  className={`px-2.5 py-0.5 rounded-md transition-colors ${
                    matrixFilter === "restricted" ? "bg-rose-600 text-white font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Restricted (9)
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="rounded-xl border border-border/70 overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground border-b border-border font-mono text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Document ID & Stage</th>
                      <th className="py-2.5 px-3">Title & Standard</th>
                      <th className="py-2.5 px-3">Owning Department</th>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-3">Client Access</th>
                      <th className="py-2.5 px-3">Retention</th>
                      <th className="py-2.5 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredMatrix.map((item) => {
                      const isGranted = item.clientAccess === "Granted";
                      const matchingDeliverable = deliverables.find((d) => d.id === item.id);

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isGranted ? "hover:bg-emerald-500/5" : "hover:bg-rose-500/5 bg-secondary/10"
                          }`}
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-foreground block">{item.id}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{item.stage}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-foreground block">{item.title}</span>
                            <span className="text-[10px] text-muted-foreground block">{item.accessReason}</span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="rounded bg-secondary border border-border px-1.5 py-0.5 font-mono text-[10px]">
                              {item.dept}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${
                                item.classification === "OEM Released"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : item.classification === "Customer Controlled"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {item.classification}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {isGranted ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-3" />
                                <span>Granted</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                <Lock className="size-3" />
                                <span>Restricted</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                            {item.retention}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {isGranted && matchingDeliverable ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDoc(matchingDeliverable);
                                  setModalTab("sheet");
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary hover:border-primary/50 transition-colors shadow-xs"
                              >
                                <Eye className="size-3 text-primary" />
                                <span>Inspect</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground italic">
                                <Lock className="size-3 text-muted-foreground" />
                                <span>Internal Only</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dispatch & Delivery Logistics Tracker */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-emerald-500" />
          <h2 className="text-sm font-bold text-foreground">
            Production Dispatch & Vehicle Mounting Logistics
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                BATCH 01 · 5,000 UNITS
              </span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                DISPATCH READY
              </span>
            </div>
            <p className="text-xs text-foreground font-semibold">
              Pre-Delivery Inspection Passed · Sealed Packaging Verified
            </p>
            <p className="text-xs text-muted-foreground">
              All 5,000 units verified with ARAI AIS-140 QR labels, IP67 mating gaskets, and individual serialization certificates. Authorized for delivery to Tata Motors Pune / Sanand assembly plants.
            </p>
            <div className="pt-2 text-[11px] font-mono text-muted-foreground">
              Dispatch Window: October 2026 · Carrier: Safexpress Automotive Direct
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-foreground">
                BATCH 02 · 10,000 UNITS
              </span>
              <span className="rounded-full bg-secondary border border-border px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                SCHEDULED BOX-BUILD
              </span>
            </div>
            <p className="text-xs text-foreground font-semibold">
              Box-Build Integration Queue
            </p>
            <p className="text-xs text-muted-foreground">
              Long-lead components secured in buffer inventory. Production run scheduled following vehicle fitment validation of Batch 01.
            </p>
            <div className="pt-2 text-[11px] font-mono text-muted-foreground">
              Scheduled Completion: November 2026 · Target Volume: 10,000 units
            </div>
          </div>
        </div>
      </div>

      {/* DEDICATED CUSTOMER DOCUMENT INSPECTION MODAL */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                    {selectedDoc.code}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground font-bold">
                    {selectedDoc.id}
                  </span>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedDoc.status}
                  </span>
                </div>
                <h2 className="text-base font-bold text-foreground sm:text-lg">
                  {selectedDoc.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                title="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Sub-Navigation Tabs */}
            <div className="flex items-center justify-between px-5 py-2 border-b border-border bg-secondary/10">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setModalTab("sheet")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    modalTab === "sheet"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <FileText className="size-3.5" />
                  <span>Formatted Draft Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab("attachments")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    modalTab === "attachments"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Download className="size-3.5" />
                  <span>Attached Sample Files ({selectedDoc.attachments.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab("governance")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    modalTab === "governance"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <ShieldCheck className="size-3.5" />
                  <span>Governance & Sign-offs</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                >
                  <Printer className="size-3.5" />
                  <span>Print Sheet</span>
                </button>
              </div>
            </div>

            {/* Modal Body Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* TAB: FORMATTED DRAFT SHEET */}
              {modalTab === "sheet" && (
                <div className="space-y-6">
                  {/* Formal Automotive Header Table */}
                  <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-secondary/30 p-3 text-xs font-mono">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Manufacturer / Tech Center</p>
                        <p className="font-bold text-foreground">HEXENSE LABS PRIVATE LIMITED</p>
                        <p className="text-[10px] text-muted-foreground">Greater Noida SMT Plant 2 · Noida Tech Center</p>
                      </div>
                      <div className="pt-2 md:pt-0 md:px-3">
                        <p className="text-[10px] uppercase text-muted-foreground">Customer / Stakeholder</p>
                        <p className="font-bold text-foreground">TATA MOTORS LIMITED</p>
                        <p className="text-[10px] text-muted-foreground">EV Commercial Fleet Division, Pune, MH</p>
                      </div>
                      <div className="pt-2 md:pt-0 md:px-3">
                        <p className="text-[10px] uppercase text-muted-foreground">Quality & Security Accreditation</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">IATF 16949:2016 · ISO 27001</p>
                        <p className="text-[10px] text-muted-foreground">Automotive Industry Standard AIS-140</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x divide-border border-t border-border p-3 text-xs font-mono bg-card">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Document ID</p>
                        <p className="font-bold text-foreground">{selectedDoc.id}</p>
                      </div>
                      <div className="pl-3">
                        <p className="text-[10px] text-muted-foreground">Version / Revision</p>
                        <p className="font-bold text-foreground">{selectedDoc.sheetDetails.version}</p>
                      </div>
                      <div className="pl-3">
                        <p className="text-[10px] text-muted-foreground">Effective Release Date</p>
                        <p className="font-bold text-foreground">{selectedDoc.sheetDetails.effectiveDate}</p>
                      </div>
                      <div className="pl-3">
                        <p className="text-[10px] text-muted-foreground">Classification</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">{selectedDoc.classification}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1.0: Scope */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                      1.0 Scope & Operational Baseline
                    </h3>
                    <p className="text-xs sm:text-sm text-foreground leading-relaxed bg-secondary/15 p-3.5 rounded-xl border border-border/60">
                      {selectedDoc.sheetDetails.scope}
                    </p>
                  </div>

                  {/* Section 2.0: Specifications & Parameters Table */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                      2.0 Technical Specifications & Parameters Matrix
                    </h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-secondary/40 font-mono text-[10px] uppercase text-muted-foreground border-b border-border">
                          <tr>
                            <th className="py-2.5 px-3.5 w-1/3">Specification Parameter</th>
                            <th className="py-2.5 px-3.5">Approved Technical Value & Tolerance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {selectedDoc.sheetDetails.parameters.map((param, i) => (
                            <tr key={i} className="hover:bg-secondary/20 transition-colors">
                              <td className="py-2 px-3.5 font-medium text-foreground">{param.label}</td>
                              <td className="py-2 px-3.5 font-mono text-[11px] text-muted-foreground">
                                {param.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3.0: Compliance Clauses */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                      3.0 Quality Governance & Acceptance Clauses
                    </h3>
                    <ul className="space-y-1.5">
                      {selectedDoc.sheetDetails.clauses.map((clause, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-foreground bg-secondary/10 p-2.5 rounded-lg border border-border/40"
                        >
                          <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{clause}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Section 4.0: Dual Sign-off Seals */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                      4.0 Authorized Release & Stakeholder Acceptance Seals
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {selectedDoc.sheetDetails.signoffs.map((sig, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-border bg-card p-3 space-y-1.5 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase text-muted-foreground">
                              {sig.role}
                            </span>
                            <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[9px] font-bold px-1.5 py-0.2">
                              {sig.status}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-foreground">{sig.person}</p>
                          <p className="text-[10px] text-muted-foreground">{sig.org}</p>
                          <p className="text-[9px] font-mono text-muted-foreground/80 pt-1 border-t border-border/40">
                            {sig.hash}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: ATTACHED SAMPLE FILES */}
              {modalTab === "attachments" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-1">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <Sparkles className="size-3.5" />
                      <span>Illustrative sample files — not for production issue</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      The files below are sample layouts in Word, Excel and PDF. Their example values and signatures require replacement with verified project evidence before use.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {selectedDoc.attachments.map((att) => (
                      <div
                        key={att.filename}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition-all shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl p-2.5 bg-card border border-border shadow-xs">
                            {att.type === "docx" ? (
                              <FileText className="size-6 text-blue-500" />
                            ) : att.type === "xlsx" ? (
                              <FileSpreadsheet className="size-6 text-emerald-500" />
                            ) : (
                              <File className="size-6 text-red-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground sm:text-sm font-mono">
                              {att.filename}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              <span>{att.label}</span>
                              <span>·</span>
                              <span className="font-mono">{att.size}</span>
                              <span>·</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                Virus-Free & Verified
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={att.url}
                            download={att.filename}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                          >
                            <Download className="size-3.5" />
                            <span>Download ({att.type.toUpperCase()})</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: GOVERNANCE & SIGN-OFF DETAILS */}
              {modalTab === "governance" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-emerald-500" />
                        <span>IATF 16949 §7.5.3 Retention Standard</span>
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Under automotive quality standard IATF 16949 §7.5.3, this record is cataloged with an active retention requirement of <strong>{selectedDoc.retention}</strong> from the date of vehicle series production termination.
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Lock className="size-4 text-blue-500" />
                        <span>ISO 27001 Stakeholder Boundary</span>
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Authorized for customer dissemination under Bilateral NDA <strong>HLPL-AI4T-SAL-mNDA-01</strong>. Access rights: Customer Read & Download Granted; Modification or Third-Party Transfer Prohibited.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                      Cryptographic Revision History & Audit Log
                    </h4>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/60">
                        <div>
                          <p className="font-bold text-foreground">Rev 01 · Baseline Release</p>
                          <p className="text-[10px] text-muted-foreground">Released by {selectedDoc.owner} on {selectedDoc.date}</p>
                        </div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                          SEALED
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/20">
              <span className="font-mono text-[11px] text-muted-foreground">
                Document Standard: {selectedDoc.standard} · Client: Tata Motors Ltd
              </span>

              <div className="flex items-center gap-2">
                {selectedDoc.attachments[0] && (
                  <a
                    href={selectedDoc.attachments[0].url}
                    download={selectedDoc.attachments[0].filename}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Download className="size-3.5" />
                    <span>Download {selectedDoc.attachments[0].type.toUpperCase()}</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

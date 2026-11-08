/** Read-only source transcription: New Hexa Format.xlsx, HW+FW+SW!A1:L83. */
export const HEXA_PHASES = [
  [
    "TG_0",
    "Kickoff, Technical Feasibility & System Sizing"
  ],
  [
    "TG_1",
    "Concept, Architecture & Interface Freeze"
  ],
  [
    "TG_2",
    "Proof of Concept & Subsystem Bring-Up"
  ],
  [
    "TG_3",
    "Detailed Engineering & Prototype Tooling"
  ],
  [
    "TG_4",
    "Prototype Integration & Alpha Validation"
  ],
  [
    "TG_5",
    "Design Verification (DV) & Environmental Stress"
  ],
  [
    "TG_6",
    "Field Validation, Homologation & Pilot Sign-Off"
  ],
  [
    "TG_7",
    "Pre-Production Pilot & Controlled Launch"
  ],
  [
    "TG_8",
    "Industrialization, Part Approval (PPAP) & Ramp-Up"
  ],
  [
    "TG_9",
    "Handover, Audit Compliance & Project Closure"
  ]
] as const;
export const HEXA_STAGES = [
  {
    "row": 2,
    "phase": "TG_0",
    "track": "PM",
    "code": "G0_01",
    "name": "Project Kickoff & Charter Lock",
    "preparer": "PM (Project Manager)",
    "reviewer": "CFT (Cross functional Team)",
    "responsible": "CFT (Cross functional Team)",
    "consulted": "EHW (Lead), FW (Lead), SW (Lead), MMF (Lead), QA (Dept specific), OPS/EMF (Lead), Service (Lead), HR (Lead)",
    "accountable": "CFT (Cross functional Team)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Approved Project Charter\n\u2022 Preliminary Schedule & Milestone Baseline",
    "tasks": [
      "Define business goals, scope baseline, and key project deliverables",
      "Identify core cross-track stakeholders and establish communication cadence",
      "Draft preliminary milestone timeline with lead-time risk buffers",
      "Lock project charter and obtain sponsor authorization",
      "Schedule and convene formal cross-functional kickoff meeting"
    ]
  },
  {
    "row": 3,
    "phase": "TG_0",
    "track": "EHW",
    "code": "G0_02",
    "name": "Hardware Technical Feasibility & Preliminary Costing",
    "preparer": "EHW (Engineer)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Lead)",
    "consulted": "SCM (Product Delivery), CFT (Cross functional Team)",
    "accountable": "EHW (Lead)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Hardware Technical Feasibility Report\n\u2022 Preliminary BOM Cost Estimate",
    "tasks": [
      "Assess global silicon availability, allocation risks, and authorized distributor lead times",
      "Draft preliminary hardware architecture block diagram and functional partition",
      "Estimate initial BOM costing and target margin roll-up against project envelope",
      "Evaluate long-lead active and passive components in PartsBench",
      "Author, review, and baseline hardware feasibility technical report"
    ]
  },
  {
    "row": 4,
    "phase": "TG_0",
    "track": "MMF",
    "code": "G0_03",
    "name": "Mechanical Feasibility & Enclosure Sizing",
    "preparer": "MMF (Design Engg)",
    "reviewer": "MMF (Lead)",
    "responsible": "MMF (Lead)",
    "consulted": "EHW (Lead), CFT (Cross functional Team), SCM (Product Delivery)",
    "accountable": "MMF (Lead)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Mechanical Packaging Feasibility Note\n\u2022 3D Concept Space Envelope (.STEP)",
    "tasks": [
      "Define preliminary physical space envelope, mounting geometry, and keep-out zones",
      "Evaluate environmental sealing, automotive IP67/IP68, and connector mating orientations",
      "Assess thermal dissipation constraints and preliminary airflow modeling",
      "Model initial 3D concept housing and validate connector accessibility",
      "Publish mechanical packaging feasibility assessment and risk log"
    ]
  },
  {
    "row": 5,
    "phase": "TG_0",
    "track": "FW",
    "code": "G0_04",
    "name": "Firmware Architecture Feasibility & Resource Sizing",
    "preparer": "FW (Engineer)",
    "reviewer": "FW (Lead)",
    "responsible": "FW (Lead)",
    "consulted": "EHW (Lead), CFT (Cross functional Team)",
    "accountable": "FW (Lead)",
    "informed": "QA (dept specific)",
    "deliverables": "\u2022 Firmware Architectural Feasibility Note\n\u2022 MCU Memory & Peripheral Sizing Budget",
    "tasks": [
      "Estimate Flash memory and static/dynamic RAM footprints with 30% expansion margin",
      "Evaluate RTOS multi-tasking versus bare-metal control options",
      "Analyze microcontroller peripheral interface bandwidth and DMA channel allocations",
      "Identify automotive cybersecurity, secure boot, and hardware cryptographic requirements",
      "Author and baseline firmware architectural feasibility technical note"
    ]
  },
  {
    "row": 6,
    "phase": "TG_0",
    "track": "SW",
    "code": "G0_05",
    "name": "Cloud & Software Architecture Sizing",
    "preparer": "SW (Backend Engg)",
    "reviewer": "SW (Lead)",
    "responsible": "SW (Lead)",
    "consulted": "FW (Lead), CFT (Cross functional Team)",
    "accountable": "SW (Lead)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Cloud & Software Feasibility Specification\n\u2022 Telemetry Throughput & Storage Sizing Model",
    "tasks": [
      "Estimate telemetry data throughput, ingestion burst TPS, and time-series storage capacity",
      "Draft scalable backend microservices topology and database partitioning rules",
      "Select cloud infrastructure, MQTT/HTTPS broker endpoints, and serverless stack",
      "Assess REST/GraphQL API round-trip latency constraints (<200ms target)",
      "Document cloud/software architecture feasibility specification"
    ]
  },
  {
    "row": 7,
    "phase": "TG_0",
    "track": "PM",
    "code": "G0_06",
    "name": "Joint Feasibility Review & Gate 0 Sign-Off",
    "preparer": "PM (Project Manager)",
    "reviewer": "Admin (Management)",
    "responsible": "CFT (Cross functional Team)",
    "consulted": "EHW (Lead), FW (Lead), SW (Lead), MMF (Lead), SCM (Lead), QA (Dept specific), OPS/EMF (Lead), Service (Lead), HR (Lead)",
    "accountable": "CFT (Cross functional Team)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Contract Review Record (HLPL/F/MKT/01)\n\u2022 Consolidated Technical Feasibility Report\n\u2022 Signed Gate 0 Tollgate Sign-Off Certificate",
    "tasks": [
      "Consolidate cross-functional feasibility reports (HW, FW, SW, MECH, PUR)",
      "Execute formal Contract Review Record (HLPL/F/MKT/01) with departmental sign-offs",
      "Benchmark preliminary development budget, CapEx tooling, and resource allocations",
      "Convene executive cross-track alignment and feasibility tollgate review",
      "Capture sign-off approvals and formally archive Gate 0 baseline"
    ]
  },
  {
    "row": 8,
    "phase": "TG_1",
    "track": "EHW",
    "code": "HW_01",
    "name": "Requirement Capture & SOR Analysis",
    "preparer": "EHW (Engineer)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Team)",
    "consulted": "FW (Team), SW (Team), MMF (Lead), CFT (Cross functional Team)",
    "accountable": "CFT (Cross functional Team)",
    "informed": "QA (Dept specific)",
    "deliverables": "\u2022 Baseline System Statement of Requirements (SOR)\n\u2022 Technical Requirements Allocation Matrix",
    "tasks": [
      "Parse customer Statement of Requirements (SOR), vehicle platform, and operating conditions",
      "Deconstruct technical specifications into electrical, functional, and environmental criteria",
      "Map automotive regulatory mandates (AIS-140, ISO 7637-2, ISO 16750, CISPR 25)",
      "Allocate decomposed functional requirements across HW, FW, SW, and MECH tracks",
      "Secure cross-track alignment and lock baseline System SOR"
    ]
  },
  {
    "row": 9,
    "phase": "TG_1",
    "track": "EHW",
    "code": "HW_02",
    "name": "Product Requirement Spec (PRS) Freeze",
    "preparer": "EHW (Engineer)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Team)",
    "consulted": "CFT (Cross functional Team), QA (Dept specific), MMF (Lead)",
    "accountable": "CFT (Cross functional Team)",
    "informed": "FW (Team), SW (Team)",
    "deliverables": "\u2022 Product Requirement Specification (HLPL-[PROJ]-EHW-PRS-00)\n\u2022 System Power Budget & Sleep-Mode Analysis",
    "tasks": [
      "Draft comprehensive PRS detailing electrical parameters, voltage limits, and transient tolerances",
      "Specify system power budget, sleep-mode current targets, and wake-up triggers",
      "Review electrical, mechanical, and HSI interface limits with FW, SW, and MECH leads",
      "Address cross-functional review feedback and align client acceptance criteria",
      "Secure digital HOD and OEM client sign-offs and lock PRS baseline"
    ]
  },
  {
    "row": 10,
    "phase": "TG_1",
    "track": "EHW",
    "code": "HW_03",
    "name": "Key Component Evaluation & Trade-off",
    "preparer": "EHW (Engineer)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Lead)",
    "consulted": "SCM (Product Delivery), FW (Team), MMF (Lead)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Key Part Analysis & Component Trade-off Matrix\n\u2022 Component Selection Register (PartsBench)",
    "tasks": [
      "Benchmark candidate microcontrollers, transceivers, and PMICs against technical targets",
      "Execute multi-vendor parametric and cost trade-off studies in PartsBench",
      "Audit component lifecycle, obsolescence status, and minimum 5-year availability",
      "Verify AEC-Q automotive qualification grades and multi-source pin compatibility",
      "Freeze key component shortlist and update preliminary component selection register"
    ]
  },
  {
    "row": 11,
    "phase": "TG_1",
    "track": "EHW",
    "code": "HW_04",
    "name": "System Block Diagram & Power Tree",
    "preparer": "EHW (Engineer)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Lead)",
    "consulted": "FW (Team), MMF (Lead)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 System Functional Block Diagram (HLPL-[PROJ]-EHW-BLK-01)\n\u2022 Power Distribution Tree & Thermal Dissipation Map",
    "tasks": [
      "Establish comprehensive system block diagram mapping core buses and transceivers",
      "Calculate rail currents, power conversion efficiencies, and worst-case thermal dissipation",
      "Select LDO and DC-DC buck/boost converter topologies with transient headroom",
      "Model battery backup run-time and load profiles under active/sleep operational states",
      "Lock system architecture power tree and publish technical architecture document"
    ]
  },
  {
    "row": 12,
    "phase": "TG_1",
    "track": "EHW",
    "code": "HW_05",
    "name": "Target BOM Costing & Interface Feasibility Lock",
    "preparer": "EHW (Lead)",
    "reviewer": "SCM (Lead)",
    "responsible": "EHW (Lead)",
    "consulted": "SCM (Product Delivery), CFT (Cross functional Team), MMF (Lead)",
    "accountable": "CFT (Cross functional Team)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Target Cost Engineering BOM (Rev 0.1)\n\u2022 Physical Connector & Pin Feasibility Memo",
    "tasks": [
      "Aggregate component cost roll-up against commercial target price in PartsBench",
      "Negotiate tier-1 pricing and volume supply terms with authorized distributors",
      "Validate physical connector and harness interface feasibility with mechanical team",
      "Confirm gross margin feasibility and target tooling CapEx allocation",
      "Lock target BOM cost baseline (Rev 0.1) and present to management"
    ]
  },
  {
    "row": 13,
    "phase": "TG_1",
    "track": "FW",
    "code": "FW_01",
    "name": "MCU Core Selection & Peripheral Interface Mapping",
    "preparer": "FW (Engineer)",
    "reviewer": "FW (Lead)",
    "responsible": "FW (Lead)",
    "consulted": "EHW (Lead)",
    "accountable": "FW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 MCU Core Selection & Benchmark Report\n\u2022 Peripheral Pin Multiplexing & Interface Mapping Table",
    "tasks": [
      "Benchmark compute load, clock frequency domains, and nested interrupt latency",
      "Map pin multiplexing for SPI, I2C, UART, CAN FD, ADC, and PWM interfaces",
      "Verify dedicated DMA channel allocations and buffer alignment constraints",
      "Validate GPIO electrical drive strength, pull-up/down resistors, and reset circuitry",
      "Freeze MCU pinout allocation and issue joint HW-FW pin lock memo"
    ]
  },
  {
    "row": 14,
    "phase": "TG_1",
    "track": "FW",
    "code": "FW_02",
    "name": "Firmware SRS & HSI Pinout Draft Lock",
    "preparer": "FW (Lead)",
    "reviewer": "EHW (Lead)",
    "responsible": "FW (Lead)",
    "consulted": "EHW (Engineer), SW (Team)",
    "accountable": "FW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Firmware Software Requirements Specification (SRS)\n\u2022 Draft Hardware-Software Interface (HLPL-[PROJ]-FW-HSI-01)",
    "tasks": [
      "Draft comprehensive Firmware Software Requirements Specification (SRS)",
      "Define Hardware-Software Interface (HSI) contracts, memory maps, and register dictionaries",
      "Coordinate interrupt priorities, ADC scaling equations, and active pin logic with HW team",
      "Convene joint HW-FW peer review and resolve interface ambiguities",
      "Sign off and lock baseline HSI Specification v1.0 (HW-FW Sync 1)"
    ]
  },
  {
    "row": 15,
    "phase": "TG_1",
    "track": "SW",
    "code": "SW_01",
    "name": "Cloud & Mobile App Architecture Interface Sizing",
    "preparer": "SW (Backend Engg)",
    "reviewer": "SW (Lead)",
    "responsible": "SW (Lead)",
    "consulted": "FW (Lead), CFT (Cross functional Team)",
    "accountable": "SW (Lead)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Software Product Requirement Document (PRD)\n\u2022 Cloud Microservices Topology & Database Architecture Diagram",
    "tasks": [
      "Design cloud microservice topology, ingestion workers, and message routing queues",
      "Size compute, relational database, and time-series data storage capacity",
      "Define responsive OEM web portal and mobile app UX/UI operational workflows",
      "Specify third-party cloud integrations, API gateways, and TLS security mechanisms",
      "Freeze cloud architecture specification and publish Software PRD baseline"
    ]
  },
  {
    "row": 16,
    "phase": "TG_1",
    "track": "SW",
    "code": "SW_02",
    "name": "Telemetry Protocol & API Interface Contract",
    "preparer": "SW (Lead)",
    "reviewer": "FW (Lead)",
    "responsible": "SW (Lead)",
    "consulted": "FW (Lead), QA (Dept specific)",
    "accountable": "SW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Telemetry Packet Protocol Specification (MQTT/HTTPS)\n\u2022 CAN J1939 DBC Signal Matrix\n\u2022 OpenAPI / Swagger API Interface Contract",
    "tasks": [
      "Define MQTT/HTTPS topic structure, QoS levels, and JSON/Protobuf payload structures",
      "Standardize CAN J1939 DBC signal dictionary, PGNs, SPNs, bit scaling, and offsets",
      "Establish RESTful/GraphQL API endpoints with Swagger/OpenAPI documentation",
      "Define binary serialization/deserialization schemas and edge data compression rules",
      "Freeze telemetry data contract and protocol specification (FW-SW Sync 1)"
    ]
  },
  {
    "row": 17,
    "phase": "TG_2",
    "track": "EHW",
    "code": "HW_06",
    "name": "PoC Breadboard / Eval-Kit Setup",
    "preparer": "EHW (Engineer)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Engineer)",
    "consulted": "FW (Team)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Bench PoC Hardware Setup & Bring-Up Log",
    "tasks": [
      "Procure microcontroller evaluation kits, development breakout boards, and transceiver modules",
      "Wire breadboard wiring harness and connect prototype sensors and communication buses",
      "Execute benchtop proof-of-concept functional sanity tests across peripheral channels",
      "Validate basic signal acquisition and command response timings on logic analyzer",
      "Archive functional PoC bring-up test log and demonstration data"
    ]
  },
  {
    "row": 18,
    "phase": "TG_2",
    "track": "EHW",
    "code": "HW_07",
    "name": "Sample Component Requisition",
    "preparer": "EHW (Engineer)",
    "reviewer": "SCM (Lead)",
    "responsible": "EHW (Engineer)",
    "consulted": "SCM (Sourcing Engg)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Prototype Component Purchase Requisition (PartsBench Indent)",
    "tasks": [
      "Compile prototype engineering sample bill of materials with manufacturer part numbers (MPNs)",
      "Identify component lead times, stock availability, and authorized franchised distributors",
      "Submit purchase requisition requests (HLPL/PRD/F-PUR-01) in PartsBench",
      "Track sample purchase orders, vendor acknowledgments, and shipment ETDs",
      "Document approved engineering sample part numbers and incoming lot tracking IDs"
    ]
  },
  {
    "row": 19,
    "phase": "TG_2",
    "track": "EHW",
    "code": "G2_01",
    "name": "Client PoC Demo & Sign-Off",
    "preparer": "EHW (Lead)",
    "reviewer": "CFT (Cross functional Team)",
    "responsible": "EHW (Lead)",
    "consulted": "FW (Lead), SW (Lead), MMF (Lead), SCM (Lead)",
    "accountable": "EHW (Lead)",
    "informed": "EXT (Client)",
    "deliverables": "\u2022 Live PoC Functional Demo Log\n\u2022 Signed Client PoC Acceptance Certificate",
    "tasks": [
      "Prepare benchtop PoC demonstration setup, automated test script, and monitoring dashboard",
      "Execute live functional validation of sensor data acquisition, bus messaging, and telemetry",
      "Demonstrate core firmware execution and cloud dashboard real-time integration to OEM client",
      "Capture client technical feedback, action items, and preliminary architecture approval",
      "Formally sign and archive Gate 2 Client PoC Demonstration Certificate (G2-SIGN-01)"
    ]
  },
  {
    "row": 20,
    "phase": "TG_2",
    "track": "SCM",
    "code": "HW_08",
    "name": "Sample Procurement & IQC",
    "preparer": "SCM (Product Delivery)",
    "reviewer": "QA (Dept specific)",
    "responsible": "SCM (Product Delivery)",
    "consulted": "EHW (Engineer), QA (Validation Engg)",
    "accountable": "SCM (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Sample Purchase Orders (POs)\n\u2022 Incoming Quality Check (IQC) Inspection Reports",
    "tasks": [
      "Issue sample purchase orders to authorized franchised distributors and direct manufacturers",
      "Receive prototype component shipments and verify packaging condition and manufacturer labels",
      "Perform Incoming Quality Check (IQC) inspection per sampling plan (SSM/QC/IQC/01)",
      "Verify package dimensions, pin counts, pin-1 markings, date codes, and authenticity",
      "Release IQC-approved components to R&D lab inventory and update stock records"
    ]
  },
  {
    "row": 21,
    "phase": "TG_2",
    "track": "EHW",
    "code": "HW_09",
    "name": "Pinout Allocation & Harness/Cable Specifications Lock",
    "preparer": "EHW (Engineer)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Engineer)",
    "consulted": "FW (Team), MMF (Lead)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Pinout Allocation & Connector Assignment Table\n\u2022 Wiring Harness Specification & Pinout Schedule",
    "tasks": [
      "Assign connector pin numbers, signal return paths, and dedicated shielding lines",
      "Specify wire gauges, insulation ratings, crimp terminal part numbers, and connector backshells",
      "Model 3D wiring harness strain reliefs, branch breakouts, and minimum bend radii",
      "Validate mating connector keying, latching mechanisms, and retention force with enclosure",
      "Lock harness specification v2.0 and release manufacturing wiring schedule"
    ]
  },
  {
    "row": 22,
    "phase": "TG_2",
    "track": "EHW",
    "code": "HW_10",
    "name": "Circuit Calculation & Simulation",
    "preparer": "EHW (Engineer)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Engineer)",
    "consulted": "EXT (Component FAE)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Analog & Filter Calculation Sheets\n\u2022 SPICE Simulation & Transient Protection Report (ISO 7637-2)",
    "tasks": [
      "Perform analog front-end filter, divider tolerance, and ADC impedance calculations",
      "Run SPICE simulations on power switching nodes, ripple voltages, and inductor saturation",
      "Analyze ISO 7637-2 pulse immunity, TVS clamp voltage, and reverse-polarity MOSFET protection",
      "Model worst-case component parameter tolerances, thermal dissipation, and derating margins",
      "Author and baseline circuit calculation and simulation verification report (SSM-SIM-EHW-01)"
    ]
  },
  {
    "row": 23,
    "phase": "TG_2",
    "track": "EHW",
    "code": "HW_11",
    "name": "Footprint & Symbol Library Creation",
    "preparer": "EHW (CAD Engg)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (CAD Engg)",
    "consulted": "EHW (Engineer), EXT (PCB Fab Vendor)",
    "accountable": "EHW (Lead)",
    "informed": "\u2014",
    "deliverables": "\u2022 Verified ECAD Schematic Symbols & IPC-7351 Land Patterns",
    "tasks": [
      "Create schematic symbols following company standards and functional pin groupings",
      "Generate PCB land patterns/footprints per component datasheets and IPC-7351 nominal rules",
      "Attach and align exact 3D STEP solid models to every ECAD component footprint",
      "Perform rigorous two-person peer library audit checking pin assignments and thermal pads",
      "Check in and release verified ECAD symbol and footprint library to design vault"
    ]
  },
  {
    "row": 24,
    "phase": "TG_2",
    "track": "EHW",
    "code": "HW_12",
    "name": "PoC Bench Signal Validation",
    "preparer": "EHW (Engineer)",
    "reviewer": "QA (Validation Engg)",
    "responsible": "EHW (Engineer)",
    "consulted": "FW (Team), QA (Validation Engg)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Bench Signal Integrity & Bus Timing Oscilloscope Plots\n\u2022 Power Rail Turn-On Sequencing Measurement Report",
    "tasks": [
      "Probe critical system clocks, crystal oscillators, and high-speed communication buses",
      "Capture I2C, SPI, and CAN transceiver rise/fall times, bus voltages, and signal reflections",
      "Measure power-on rail sequencing, slew rates, and voltage overshoot/undershoot margins",
      "Validate ADC analog signal integrity, noise floors, and ground bounce under dynamic load",
      "Archive digital storage oscilloscope (DSO) waveforms and signal integrity test log"
    ]
  },
  {
    "row": 25,
    "phase": "TG_2",
    "track": "EHW",
    "code": "HW_13",
    "name": "Hardware DFMEA",
    "preparer": "EHW (Lead)",
    "reviewer": "QA (Dept specific)",
    "responsible": "EHW (Lead)",
    "consulted": "QA (Dept specific), FW (Team), QA (Validation Engg)",
    "accountable": "QA (Dept specific)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Hardware DFMEA Register with RPN Scoring (HLPL-[PROJ]-EHW-DFMEA-01)",
    "tasks": [
      "Identify potential hardware failure modes across all functional circuit blocks",
      "Assign Severity (S), Occurrence (O), and Detection (D) ranking scores per standard criteria",
      "Calculate Risk Priority Numbers (RPN) and isolate high-risk component/circuit vulnerabilities",
      "Formulate design mitigation actions (over-voltage protection, thermal copper, derating)",
      "Secure cross-functional approvals and finalize Hardware DFMEA sign-off matrix"
    ]
  },
  {
    "row": 26,
    "phase": "TG_2",
    "track": "QA",
    "code": "HW_14",
    "name": "Design Verification Plan (DVP)",
    "preparer": "QA (Dept specific)",
    "reviewer": "EHW (Lead)",
    "responsible": "QA (Dept specific)",
    "consulted": "EHW (Lead), FW (Lead)",
    "accountable": "QA (Dept specific)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Design Verification Plan (HLPL-[PROJ]-QA-DVP-01)",
    "tasks": [
      "Map system and customer requirements to specific DVP verification test cases",
      "Specify environmental (thermal/humidity), mechanical (vibration/shock), and electrical setups",
      "Define quantitative pass/fail acceptance criteria, measurement tools, and sample lot sizes",
      "Review test coverage and profiles with HW, FW, QA, and validation engineering leads",
      "Lock baseline Design Verification Plan (DVP&R) test suite (HLPL-[PROJ]-QA-DVP-01)"
    ]
  },
  {
    "row": 27,
    "phase": "TG_2",
    "track": "EHW",
    "code": "HW_15",
    "name": "Full Schematic Capture",
    "preparer": "EHW (Engineer)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Engineer)",
    "consulted": "FW (Team)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Multi-Sheet Hierarchical Schematic Package (HLPL-[PROJ]-EHW-SCH-01)\n\u2022 Schematic Netlist & BOM Attribute Export",
    "tasks": [
      "Capture hierarchical multi-sheet schematics covering power, MCU, comms, and I/O blocks",
      "Assign logical net names, reference designators, and component tolerance attributes",
      "Place decoupling capacitors close to IC power pins and configure ESD protection networks",
      "Link verified ECAD library footprints, manufacturer part numbers, and supplier metadata",
      "Generate formal schematic package Rev 1.0 and export review PDF documentation"
    ]
  },
  {
    "row": 28,
    "phase": "TG_2",
    "track": "EHW",
    "code": "HW_16",
    "name": "Schematic Design Review & ERC Gate",
    "preparer": "EHW (Lead)",
    "reviewer": "QA (Dept specific)",
    "responsible": "EHW (Lead)",
    "consulted": "EXT (External Reviewer), FW (Team)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Electrical Rules Check (ERC) Verification Log\n\u2022 Signed Schematic Peer Review Checklist",
    "tasks": [
      "Run Electrical Rules Check (ERC) in CAD tool and resolve all open warning/error flags",
      "Conduct formal cross-functional schematic peer review with HW, FW, QA, and manufacturing",
      "Verify power rail current capacities, capacitor voltage deratings, and resistor wattages",
      "Audit test point accessibility for prototype bring-up and automated test fixtures",
      "Verify resolution of all review action items and grant ERC tollgate sign-off (HW_16 = OK)"
    ]
  },
  {
    "row": 29,
    "phase": "TG_2",
    "track": "FW",
    "code": "FW_03",
    "name": "RTOS Tasking & Watchdog Architecture",
    "preparer": "FW (Engineer)",
    "reviewer": "FW (Lead)",
    "responsible": "FW (Lead)",
    "consulted": "EHW (Lead)",
    "accountable": "FW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 RTOS Task Priority & Inter-Task Queue Architecture Note\n\u2022 Hardware Watchdog & Fault Recovery Specification",
    "tasks": [
      "Configure RTOS task prioritization, stack depths, and execution time slices",
      "Design inter-task communication pipelines using thread-safe queues, mutexes, and semaphores",
      "Implement hardware watchdog window servicing and brown-out detection strategies",
      "Define system fault-handling handlers, panic logging, and fail-safe safe-state recovery",
      "Finalize and baseline RTOS tasking and software design architecture specification"
    ]
  },
  {
    "row": 30,
    "phase": "TG_2",
    "track": "FW",
    "code": "FW_04",
    "name": "Toolchain Setup & DevKit Bring-Up",
    "preparer": "FW (Engineer)",
    "reviewer": "FW (Lead)",
    "responsible": "FW (Engineer)",
    "consulted": "EHW (Engineer)",
    "accountable": "FW (Lead)",
    "informed": "QA (Dept specific)",
    "deliverables": "\u2022 Firmware Build Environment & Toolchain Guide\n\u2022 DevKit Baseline Firmware Codebase & Flash Verification Log",
    "tasks": [
      "Set up IDE, toolchain, cross-compilers, and hardware debug probes (JTAG/SWD)",
      "Initialize microcontroller clock trees, PLL settings, and basic GPIO configuration registers",
      "Flash initial diagnostic blinky and peripheral test firmware onto hardware evaluation kits",
      "Validate debug console communication, SWO tracing, and flash programming algorithms",
      "Check in clean baseline firmware repository with automated build configurations"
    ]
  },
  {
    "row": 31,
    "phase": "TG_2",
    "track": "SW",
    "code": "SW_03",
    "name": "Database Schema & Microservices Design",
    "preparer": "SW (Backend Engg)",
    "reviewer": "SW (Lead)",
    "responsible": "SW (Backend Engg)",
    "consulted": "SW (Lead)",
    "accountable": "SW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Relational & Time-Series Database Schema Design (DDL)\n\u2022 Microservices API Architecture & RLS Security Specification",
    "tasks": [
      "Design relational and time-series database schemas with index optimization",
      "Define telemetry partitioning strategies, retention periods, and automated pruning rules",
      "Architect event-driven microservices topology, message queues, and REST/GraphQL schemas",
      "Establish Row Level Security (RLS) policies, tenant isolation, and API authentication guards",
      "Freeze database entity relational model and publish microservices architecture spec"
    ]
  },
  {
    "row": 32,
    "phase": "TG_2",
    "track": "SW",
    "code": "SW_04",
    "name": "CI/CD Pipeline & Packet Simulator",
    "preparer": "SW (DevOps Engg)",
    "reviewer": "SW (Lead)",
    "responsible": "SW (DevOps Engg)",
    "consulted": "FW (Team), SW (Backend Engg)",
    "accountable": "SW (Lead)",
    "informed": "QA (Dept specific)",
    "deliverables": "\u2022 Automated CI/CD Pipeline Configuration\n\u2022 Telemetry Packet Simulator Engine & Test Scripts",
    "tasks": [
      "Configure automated CI/CD build runners, branch protection, and static code linters",
      "Author automated unit test suites and integration verification test scripts",
      "Build standalone Python/Node telemetry mock packet simulator matching DBC/MQTT contracts",
      "Validate decoupled cloud ingestion throughput and UI event rendering under synthetic loads",
      "Deploy automated simulator and achieve green baseline build on staging environment"
    ]
  },
  {
    "row": 33,
    "phase": "TG_3",
    "track": "MMF",
    "code": "HW_17",
    "name": "Enclosure 3D CAD, Connector Cutouts & Physical Interface Freeze",
    "preparer": "MMF (Design Engg)",
    "reviewer": "MMF (Lead)",
    "responsible": "MMF (Lead)",
    "consulted": "EHW (Lead), EMF (Lead)",
    "accountable": "MMF (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 3D Parametric Enclosure CAD Package (HLPL-[PROJ]-MECH-CAD-01 .STEP)\n\u2022 2D Mechanical Connector Cutout Drawing (HLPL-[PROJ]-MECH-DRW-01)",
    "tasks": [
      "Model 3D parametric enclosure geometry including mounting bosses, ribs, and snap-fits",
      "Position connector cutouts, LED light pipe apertures, and external antenna openings",
      "Detail silicone sealing gasket grooves, tongue-and-groove joints, and IP67 compressions",
      "Check internal component height clearances against maximum PCBA envelope limits",
      "Export verified 3D STEP model and freeze mechanical enclosure design (MECH-CAD-01)"
    ]
  },
  {
    "row": 34,
    "phase": "TG_3",
    "track": "EHW",
    "code": "HW_18",
    "name": "Component Placement & Floorplanning",
    "preparer": "EHW (Layout Engg)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Layout Engg)",
    "consulted": "MMF (Lead), EHW (Lead)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 PCBA Component Placement & Floorplan Drawing\n\u2022 Hardware-Mechanical Clearance Sign-Off Sheet",
    "tasks": [
      "Import DXF/STEP board outline, mounting hole keep-outs, and connector placement constraints",
      "Place edge connectors, power switches, and TVS protection devices near entry boundaries",
      "Group functional sub-circuits (power supply, MCU core, RF transceivers, analog sensing)",
      "Optimize high-speed routing channels, differential pair paths, and decoupling capacitor loops",
      "Secure formal placement clearance sign-off from hardware and mechanical leads"
    ]
  },
  {
    "row": 35,
    "phase": "TG_3",
    "track": "EHW",
    "code": "HW_19",
    "name": "Tentative BOM Release",
    "preparer": "EHW (Engineer)",
    "reviewer": "SCM (Lead)",
    "responsible": "EHW (Engineer)",
    "consulted": "SCM (Product Delivery), OPS (Lead)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Preliminary Engineering Bill of Materials (HLPL-[PROJ]-EHW-BOM-00)\n\u2022 Prototype Sourcing Indent & Distributor Stock Audit",
    "tasks": [
      "Export structured Bill of Materials from schematic capture package",
      "Verify manufacturer part numbers (MPNs), package footprints, and second-source alternates",
      "Audit distributor stock levels, minimum order quantities (MOQ), and delivery lead times",
      "Generate and validate Proto BOM v1.0 against target cost budget in PartsBench",
      "Release formal procurement indent to purchasing team for prototype build kitting"
    ]
  },
  {
    "row": 36,
    "phase": "TG_3",
    "track": "MMF",
    "code": "HW_20",
    "name": "3D Cable Routing, Pinch Point & Thermal Check",
    "preparer": "MMF (Design Engg)",
    "reviewer": "MMF (Lead)",
    "responsible": "MMF (Design Engg)",
    "consulted": "EHW (Lead)",
    "accountable": "MMF (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 3D Internal Harness Clearance & Collision Analysis\n\u2022 Thermal Simulation & Heat Dissipation Report",
    "tasks": [
      "Route internal wiring harnesses, battery leads, and ribbon cables within 3D CAD assembly",
      "Execute automated 3D collision check detecting clearance gaps between PCBA and enclosure walls",
      "Identify cable pinch points near mounting screws, heat sinks, and structural ribs",
      "Run thermal airflow and heat dissipation simulations on power MOSFETs and voltage regulators",
      "Verify thermal hotspot temperatures remain within allowable limits and sign off Loop 2 gate"
    ]
  },
  {
    "row": 37,
    "phase": "TG_3",
    "track": "EHW",
    "code": "HW_21",
    "name": "PCB Stackup, Impedance & Routing",
    "preparer": "EHW (Layout Engg)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Layout Engg)",
    "consulted": "EXT (PCB Fab Vendor)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Controlled Impedance & Layer Stackup Specification\n\u2022 Completed 100% Routed PCB Layout Design File",
    "tasks": [
      "Define multi-layer PCB stackup, dielectric materials, and copper weights with fabricator",
      "Calculate track geometries for 50-ohm single-ended RF lines and 120-ohm differential CAN pairs",
      "Route critical high-speed communication buses, clock lines, and sensitive analog signals",
      "Implement solid ground reference planes, power distribution pours, and thermal via arrays",
      "Complete 100% trace routing with zero unrouted nets, DRC violations, or stub traces"
    ]
  },
  {
    "row": 38,
    "phase": "TG_3",
    "track": "EHW",
    "code": "HW_22",
    "name": "Silkscreen, Panelization & Fiducials",
    "preparer": "EHW (Layout Engg)",
    "reviewer": "EMF (Lead)",
    "responsible": "EHW (Layout Engg)",
    "consulted": "EMF (Lead)",
    "accountable": "EHW (Lead)",
    "informed": "OPS (Lead)",
    "deliverables": "\u2022 Production SMT Panel Array Fabrication Drawing\n\u2022 Silkscreen Artwork & Fiducial Placement Guide",
    "tasks": [
      "Clean silkscreen component designators, polarity markers, pin-1 indicators, and barcode tags",
      "Place global and local optical fiducials on opposite corners of PCBA for SMT pick-and-place",
      "Design multi-up manufacturing panel array with breakaway v-score grooves or mouse-bite tabs",
      "Add solder thief pads on wave/reflow edges to prevent bridging on fine-pitch connectors",
      "Generate formal SMT panel fabrication drawing (HLPL-DWG-001) and assembly panel notes"
    ]
  },
  {
    "row": 39,
    "phase": "TG_3",
    "track": "EHW",
    "code": "HW_23",
    "name": "DRC, DFM/DFA & Layout Review Gate",
    "preparer": "EHW (Lead)",
    "reviewer": "EMF (Lead)",
    "responsible": "EHW (Lead)",
    "consulted": "EXT (PCB Fab Vendor), EMF (Lead)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Layout Design Rule Check (DRC) Verification Log\n\u2022 PCB Fabricator DFM/DFA Clearance Sign-Off",
    "tasks": [
      "Run comprehensive Design Rule Check (DRC) verifying clearances, trace widths, and via annular rings",
      "Submit preliminary layout files to PCB fabricator for automated DFM/DFA engineering analysis",
      "Review solder mask slivers, minimum solder bridge webbings, and acid trap geometries",
      "Address assembly plant feedback regarding component spacing and stencil aperture alignment",
      "Sign off formal PCB layout design review and DFM clearance gate (HW_23 = OK)"
    ]
  },
  {
    "row": 40,
    "phase": "TG_3",
    "track": "EHW",
    "code": "HW_24",
    "name": "Prototype Gerber & Drill Generation",
    "preparer": "EHW (Layout Engg)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Layout Engg)",
    "consulted": "EXT (PCB Fab Vendor)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Prototype RS-274X Gerber & NC Drill Package (HLPL-[PROJ]-EHW-PCB-01)\n\u2022 IPC-D-356 Netlist & SMT Centroid (XY) Pick-and-Place File",
    "tasks": [
      "Export RS-274X / Gerber X2 copper artwork, solder mask, silkscreen, and paste layers",
      "Generate NC drill files, drill tool tables, and IPC-D-356 electrical netlist files",
      "Extract centroid XY pick-and-place component placement coordinates and board rotation angles",
      "Inspect Gerber layer alignments, polarity markers, and stackup details using CAM verification viewer",
      "Package and tag production-ready Gerber release ZIP archive with SHA-256 integrity hash"
    ]
  },
  {
    "row": 41,
    "phase": "TG_3",
    "track": "SCM",
    "code": "HW_25",
    "name": "Bare PCB & Stencil Fabrication Order",
    "preparer": "SCM (Product Delivery)",
    "reviewer": "SCM (Lead)",
    "responsible": "SCM (Product Delivery)",
    "consulted": "EHW (Lead)",
    "accountable": "SCM (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Bare PCB Fabrication Purchase Order & Stencil Order\n\u2022 Fabricator Engineering Query (EQ) Sign-Off",
    "tasks": [
      "Solicit quotations and confirm turn-around lead times with qualified bare board fabricators",
      "Upload verified Gerber ZIP archive and engineering specification sheet to PCB vendor portal",
      "Order laser-cut electropolished stainless steel solder stencils with fiducial alignment holes",
      "Confirm PCB fabrication parameters (FR4 TG150, ENIG/HASL finish, solder mask color, impedance)",
      "Issue formal fabrication Purchase Order (HLPL/PRD/PO-01) and monitor shipment tracking"
    ]
  },
  {
    "row": 42,
    "phase": "TG_3",
    "track": "MMF",
    "code": "HW_26",
    "name": "Soft-Tooling / 3D Print Enclosure",
    "preparer": "MMF (Tooling / Fab)",
    "reviewer": "MMF (Lead)",
    "responsible": "MMF (Tooling / Fab)",
    "consulted": "SCM (Product Delivery)",
    "accountable": "MMF (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 3D-Printed / Soft-Tooled Prototype Enclosure Inspection Record",
    "tasks": [
      "Export high-resolution STL/STEP files for rapid prototyping and soft tooling",
      "Procure precision SLA/SLS 3D printed or silicone vacuum-cast enclosure prototypes",
      "Machine prototype threaded brass inserts, mounting brackets, and silicone sealing gaskets",
      "Inspect physical prototype housing dimensions and connector openings against 3D CAD models",
      "Deliver assembled prototype enclosure kits to R&D lab for integration and fitment verification"
    ]
  },
  {
    "row": 43,
    "phase": "TG_3",
    "track": "FW",
    "code": "FW_05",
    "name": "HAL/BSP Drivers & Peripheral Stacks",
    "preparer": "FW (Engineer)",
    "reviewer": "FW (Lead)",
    "responsible": "FW (Engineer)",
    "consulted": "EHW (Engineer)",
    "accountable": "FW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Hardware Abstraction Layer (HAL) & Peripheral Driver Package\n\u2022 Core Protocol Stack Source Code (CAN, UART, SPI, I2C)",
    "tasks": [
      "Implement hardware abstraction layer (HAL) and low-level peripheral drivers (UART, SPI, I2C, CAN)",
      "Configure ADC channels, DMA ring buffers, and continuous sampling timers",
      "Develop external memory drivers (SPI Flash, EEPROM) and peripheral sensor interface stacks",
      "Verify bus timing parameters, clock jitter, and signal waveforms using logic analyzer",
      "Lock low-level HAL/BSP driver codebase and baseline shared library (SSM-FW-LIB-01)"
    ]
  },
  {
    "row": 44,
    "phase": "TG_3",
    "track": "FW",
    "code": "FW_06",
    "name": "Secure Bootloader, OTA Client & Power",
    "preparer": "FW (Lead)",
    "reviewer": "SW (Lead)",
    "responsible": "FW (Lead)",
    "consulted": "SW (Lead), QA (Dept specific)",
    "accountable": "FW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Dual-Bank FOTA Bootloader with Cryptographic Rollback\n\u2022 Power Management State Machine & Sleep-Mode Implementation",
    "tasks": [
      "Implement secondary bootloader with cryptographic signature verification and rollback capability",
      "Configure dual-bank internal/external Flash memory layout and firmware image validation headers",
      "Integrate secure over-the-air (FOTA) download client state machine and block-level verification",
      "Code low-power sleep modes, wake-up interrupt sources, and peripheral power-down sequences",
      "Execute benchtop OTA firmware flashing simulations and confirm fail-safe boot recovery"
    ]
  },
  {
    "row": 45,
    "phase": "TG_3",
    "track": "FW",
    "code": "FW_07",
    "name": "Static Analysis & Unit Tests",
    "preparer": "FW (Engineer)",
    "reviewer": "QA (Validation Engg)",
    "responsible": "FW (Engineer)",
    "consulted": "QA (Validation Engg)",
    "accountable": "FW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 MISRA-C / Clang-Tidy Static Analysis Audit Report\n\u2022 Unit Test Suite Coverage Report (>80% Pass)",
    "tasks": [
      "Run automated static code analysis tools (MISRA C:2012, Cppcheck, Clang-Tidy) across codebase",
      "Remediate all critical and major static analysis violations, dead code, and buffer risks",
      "Author comprehensive unit test suites covering algorithmic parsers, circular buffers, and state machines",
      "Execute automated unit test framework and verify achieving target code coverage (>80%)",
      "Publish formal static analysis and unit test pass certification report (SSM-FW-UT-01)"
    ]
  },
  {
    "row": 46,
    "phase": "TG_3",
    "track": "SW",
    "code": "SW_05",
    "name": "Core Backend APIs & Web Portal",
    "preparer": "SW (Backend Engg)",
    "reviewer": "SW (Lead)",
    "responsible": "SW (Backend Engg)",
    "consulted": "SW (Frontend Engg)",
    "accountable": "SW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Deployed Telemetry Ingestion Microservices\n\u2022 OEM Web Portal Frontend & Fleet Tracking Dashboard",
    "tasks": [
      "Implement high-throughput telemetry ingestion microservices and message routing endpoints",
      "Develop OEM fleet management web portal dashboards, live asset views, and diagnostic tables",
      "Establish authentication middleware, JWT token verification, and role-based permission filters",
      "Connect cloud time-series database instances and optimize ingestion query latency",
      "Deploy core application build to staging cluster and verify continuous telemetry processing"
    ]
  },
  {
    "row": 47,
    "phase": "TG_3",
    "track": "SW",
    "code": "SW_06",
    "name": "Auth, RBAC & OTA Campaign Manager",
    "preparer": "SW (Lead)",
    "reviewer": "Admin (Management)",
    "responsible": "SW (Lead)",
    "consulted": "FW (Lead), Admin (Management)",
    "accountable": "SW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 RBAC Security & Multi-Tenant Authentication Engine\n\u2022 OTA Fleet Rollout Campaign Console",
    "tasks": [
      "Implement Role-Based Access Control (RBAC) rules for administrators, engineers, and OEM clients",
      "Build fleet OTA campaign management console supporting device grouping and scheduling",
      "Configure progressive rollout rings (canary 1%, pilot 10%, fleet 100%) with automated stop triggers",
      "Integrate device lifecycle state tracking, firmware version inventory, and audit event logs",
      "Release and validate fleet OTA campaign management user interface on staging environment"
    ]
  },
  {
    "row": 48,
    "phase": "TG_3",
    "track": "SW",
    "code": "SW_07",
    "name": "Integration Tests & Code PR Approval",
    "preparer": "SW (DevOps Engg)",
    "reviewer": "SW (Lead)",
    "responsible": "SW (DevOps Engg)",
    "consulted": "SW (Lead)",
    "accountable": "SW (Lead)",
    "informed": "QA (dept specific)",
    "deliverables": "\u2022 Automated End-to-End API Test Suite Pass Report\n\u2022 Staging Deployment Log & Peer Code Review Approval",
    "tasks": [
      "Execute automated end-to-end integration test suites across cloud services and database pipelines",
      "Validate mock telemetry ingestion, event alerting, geofencing triggers, and data persistence",
      "Conduct peer pull-request code reviews across all backend repositories and enforce coding standards",
      "Validate container staging deployments, resource autoscaling, and error rate monitoring",
      "Publish integration test report and achieve verified green staging build approval (Gate G6)"
    ]
  },
  {
    "row": 49,
    "phase": "TG_4",
    "track": "EMF",
    "code": "HW_30",
    "name": "Prototype SMT & THT Assembly",
    "preparer": "EMF (Production Team)",
    "reviewer": "OPS (Lead)",
    "responsible": "EMF (Production Team)",
    "consulted": "EHW (Engineer)",
    "accountable": "OPS (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 SMT Reflow Thermal Profiling & Inspection Sheet\n\u2022 Assembled Prototype PCBA Lots (A-Samples)",
    "tasks": [
      "Verify stencil solder paste printing, thickness, and alignment on automatic SMT line",
      "Execute high-speed pick-and-place surface-mount component placement and multi-zone reflow",
      "Hand-solder through-hole connectors and terminals per IPC-A-610 Class 3 workmanship",
      "Perform 100% 3D Automated Optical Inspection (AOI) and x-ray solder joint verification",
      "Deliver serialized prototype PCBAs with formal visual/AOI inspection report (SSM/QA/07)"
    ]
  },
  {
    "row": 50,
    "phase": "TG_4",
    "track": "EHW",
    "code": "HW_31",
    "name": "Initial Hardware Bring-Up & Smoke Test",
    "preparer": "EHW (Engineer)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Engineer)",
    "consulted": "FW (Engineer)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Power-On Smoke Test & Rail Voltage Measurement Log\n\u2022 Hardware Clock & Reset Validation Report",
    "tasks": [
      "Perform cold digital multimeter impedance checks across all power rails to detect shorts",
      "Power on board with current-limited DC bench power supply and verify nominal rail voltages (3.3V, 5V)",
      "Measure quiescent and standby power supply currents against design budget targets",
      "Probe primary and secondary crystal oscillators for stable oscillation frequency and amplitude",
      "Verify JTAG/SWD debugger connectivity and sign off initial bring-up smoke test (HW_31)"
    ]
  },
  {
    "row": 51,
    "phase": "TG_4",
    "track": "FW",
    "code": "FW_08",
    "name": "Target PCB Firmware Bring-Up",
    "preparer": "FW (Engineer)",
    "reviewer": "FW (Lead)",
    "responsible": "FW (Engineer)",
    "consulted": "EHW (Engineer)",
    "accountable": "FW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Target Board Diagnostic Firmware Validation Log\n\u2022 ADC Sensor Calibration & Bus Timing Verification Sheet",
    "tasks": [
      "Connect hardware debugger to target PCBA and flash primary bootloader image",
      "Program diagnostic firmware to validate MCU internal clocks, PLL, and GPIO operations",
      "Verify peripheral communication over I2C, SPI, UART, and CAN transceivers with sensors",
      "Benchmark ADC acquisition accuracy, voltage scaling factors, and noise floors",
      "Confirm stable target board operation and baseline peripheral bring-up log"
    ]
  },
  {
    "row": 52,
    "phase": "TG_4",
    "track": "OPS",
    "code": "HW_29",
    "name": "Automated EOL Test Jig & Fixture",
    "preparer": "OPS (Test Engg)",
    "reviewer": "OPS (Test Lead)",
    "responsible": "OPS (Test Engg)",
    "consulted": "EHW (Lead), FW (Lead)",
    "accountable": "OPS (Test Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Automated Bed-of-Nails Test Fixture PCB & Wiring Drawing\n\u2022 EOL Calibration Log & IMTE Traceability Certificate\n\u2022 Test Executive Software Suite & UI Setup",
    "tasks": [
      "Design bed-of-nails pogo-pin test fixture PCB and mechanical clamping mechanism",
      "Wire programmable DC supplies, load relays, CAN transceivers, and digital measuring meters",
      "Calibrate voltage and frequency measurement probes against certified laboratory standards",
      "Develop automated test sequencing scripts executing functional parametric checks",
      "Validate test jig repeatability and release calibrated EOL test fixture (HLPL-JIG-01)"
    ]
  },
  {
    "row": 53,
    "phase": "TG_4",
    "track": "FW",
    "code": "FW_09",
    "name": "Diagnostic Test Firmware for EOL Jig",
    "preparer": "FW (Engineer)",
    "reviewer": "FW (Lead)",
    "responsible": "FW (Engineer)",
    "consulted": "OPS (Test Engg)",
    "accountable": "FW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Automated Diagnostic Test Firmware Binary (.hex/.bin)",
    "tasks": [
      "Develop high-speed self-test diagnostic firmware image for automated manufacturing jig",
      "Implement automated serial command-response interface and parametric test routines",
      "Integrate loopback tests for CAN FD, UART, external SPI flash, and digital I/O channels",
      "Optimize test execution timing to achieve target cycle time (<180 seconds per unit)",
      "Freeze and release verified diagnostic self-test firmware binary to manufacturing team"
    ]
  },
  {
    "row": 54,
    "phase": "TG_4",
    "track": "SW",
    "code": "SW_08",
    "name": "End-to-End Loopback Validation",
    "preparer": "SW (Lead)",
    "reviewer": "QA (Validation Engg)",
    "responsible": "SW (Lead)",
    "consulted": "FW (Lead), QA (Validation Engg)",
    "accountable": "QA (Dept specific)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Hardware-to-Cloud Live Telemetry Ingestion Log\n\u2022 Remote Actuator Command Execution Latency Report (<200ms)",
    "tasks": [
      "Transmit live encrypted binary/JSON telemetry packets from target prototype board to cloud",
      "Verify packet ingestion, schema parsing, and database persistence on backend microservices",
      "Validate OEM web portal live telemetry rendering, alert triggers, and map geofencing",
      "Execute bidirectional remote cloud commands (e.g., config update, relay toggle) to device",
      "Confirm round-trip latency meets SLA (<200ms) and sign off E2E loopback integration"
    ]
  },
  {
    "row": 55,
    "phase": "TG_5",
    "track": "QA",
    "code": "HW_27",
    "name": "EMC/EMI & ESD Pre-Compliance Testing",
    "preparer": "QA (Dept specific)",
    "reviewer": "EHW (Lead)",
    "responsible": "QA (Dept specific)",
    "consulted": "EHW (Lead)",
    "accountable": "QA (Dept specific)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Radiated & Conducted Emissions Laboratory Scan Report\n\u2022 ESD Immunity & ISO 7637-2 Transient Pulse Test Sheet",
    "tasks": [
      "Perform radiated and conducted emissions baseline scans in pre-compliance anechoic chamber",
      "Execute electrostatic discharge (ESD) contact (\u00b14kV/\u00b18kV) and air discharge immunity checks",
      "Test ISO 7637-2 electrical transient conducted pulse immunity (Pulses 1, 2a, 3a, 3b, 5b)",
      "Identify electromagnetic noise emissions, harmonic spikes, and grounding layout resonances",
      "Document chamber scan observations and issue formal pre-compliance report (AIS-004 Part 3)"
    ]
  },
  {
    "row": 56,
    "phase": "TG_5",
    "track": "FW",
    "code": "FW_10",
    "name": "Offline Buffering & Reconnection Stress",
    "preparer": "FW (Engineer)",
    "reviewer": "QA (Validation Engg)",
    "responsible": "FW (Engineer)",
    "consulted": "QA (Validation Engg), SW (Lead)",
    "accountable": "FW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Flash Memory Ring-Buffer Endurance Test Report\n\u2022 Cellular Drop & Network Reconnection Stress Log",
    "tasks": [
      "Simulate harsh cellular and wireless dropouts by severing network connectivity",
      "Verify circular SPI flash memory ring buffering and FIFO record storage without data loss",
      "Stress-test high-volume burst telemetry packet uploads upon cellular re-connection",
      "Validate data integrity, packet sequence numbers, and corruption recovery algorithms",
      "Publish offline storage and network reconnection stress resilience test report"
    ]
  },
  {
    "row": 57,
    "phase": "TG_5",
    "track": "QA",
    "code": "FW_11",
    "name": "72-Hour Soak & Thermal Chamber Test",
    "preparer": "QA (Validation Engg)",
    "reviewer": "QA (Dept specific)",
    "responsible": "QA (Validation Engg)",
    "consulted": "FW (Lead), MMF (Lead)",
    "accountable": "QA (Dept specific)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 72-Hour Continuous Thermal Soak Test Log (-40\u00b0C to +85\u00b0C)\n\u2022 System Stability & Zero-Watchdog Reset Verification Sheet",
    "tasks": [
      "Place prototype hardware units in environmental thermal chamber cycling -40\u00b0C to +85\u00b0C",
      "Run continuous full-load operating firmware stress testing across high and low temperature limits",
      "Monitor internal CPU temperature telemetry, dynamic RAM leakage, and watchdog resets",
      "Inspect physical units post-exposure for thermal stress, casing warping, or connector fatigue",
      "Sign off 72-hour environmental soak test log with zero unhandled system resets"
    ]
  },
  {
    "row": 58,
    "phase": "TG_5",
    "track": "SW",
    "code": "SW_09",
    "name": "Staging Security UAT & Pen Testing",
    "preparer": "QA (Compliance Lead)",
    "reviewer": "SW (Lead)",
    "responsible": "QA (Compliance Lead)",
    "consulted": "SW (Lead), EXT (Cert Agency)",
    "accountable": "QA (Dept specific)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 OWASP Top 10 Penetration Testing & Vulnerability Audit\n\u2022 Client User Acceptance Testing (UAT) Sign-Off",
    "tasks": [
      "Conduct automated dynamic vulnerability scanning and external network penetration testing",
      "Audit REST and GraphQL API endpoints against OWASP Top 10 security vulnerabilities",
      "Validate TLS mutual authentication, SSL certificate pinning, and end-to-end payload encryption",
      "Test tenant authorization boundaries, role escalation defenses, and SQL injection protections",
      "Publish security audit report and secure client user acceptance testing (UAT) sign-off"
    ]
  },
  {
    "row": 59,
    "phase": "TG_5",
    "track": "EHW",
    "code": "HW_28",
    "name": "Final HSI Freeze & ECN Check",
    "preparer": "EHW (Lead)",
    "reviewer": "FW (Lead)",
    "responsible": "EHW (Lead)",
    "consulted": "FW (Lead)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Final Frozen Hardware-Software Interface (HLPL-[PROJ]-FW-HSI-01)\n\u2022 Closed Pre-Compliance ECN Delta Resolution Memo",
    "tasks": [
      "Audit all hardware-software interface signals, interrupt lines, and pin multiplexing mappings",
      "Cross-verify schematic modifications against PCB layout routing and netlist revisions",
      "Review open Engineering Change Notices (ECNs) and confirm pin functions and register maps",
      "Execute joint HW-FW regression check validating all peripheral register configurations",
      "Freeze final Hardware-Software Interface specification and sign off ECN audit check"
    ]
  },
  {
    "row": 60,
    "phase": "TG_5",
    "track": "QA",
    "code": "HW_32",
    "name": "Design Verification Report (DVR)",
    "preparer": "QA (Dept specific)",
    "reviewer": "CFT (Cross functional Team)",
    "responsible": "QA (Dept specific)",
    "consulted": "EHW (Engineer), FW (Engineer)",
    "accountable": "QA (Dept specific)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Consolidated Design Verification Report (HLPL-[PROJ]-QA-DVR-01)\n\u2022 DVP Closure & Engineering Sign-Off Sheet",
    "tasks": [
      "Consolidate empirical test data across all electrical, mechanical, environmental, and EMC test cases",
      "Verify full compliance against quantitative pass/fail criteria defined in baseline DVP suite",
      "Document root-cause analysis (RCA) and corrective actions for any prototype non-conformances",
      "Present comprehensive verification findings to cross-functional engineering leadership",
      "Secure formal Design Verification Report (DVR) closure sign-off (SSM-DVR-EHW-001)"
    ]
  },
  {
    "row": 61,
    "phase": "TG_6",
    "track": "QA",
    "code": "HW_33",
    "name": "Client Field Trial & Fitment Support",
    "preparer": "QA (Field QA / FAE)",
    "reviewer": "CFT (Cross functional Team)",
    "responsible": "QA (Field QA / FAE)",
    "consulted": "EHW (Lead), MMF (Lead)",
    "accountable": "CFT (Cross functional Team)",
    "informed": "EXT (Client)",
    "deliverables": "\u2022 Client Vehicle Fitment & Harness Installation Report\n\u2022 Pilot Fleet Real-World Operating Log",
    "tasks": [
      "Install prototype units into customer pilot vehicles/machinery and assemble mating harnesses",
      "Provide on-site engineering fitment, vibration damping, and electrical grounding verification",
      "Monitor daily operational vehicle telemetry logs, bus error counts, and live GPS tracking",
      "Gather client field driver feedback, operational logs, and field anomaly reports",
      "Obtain formal OEM customer pilot field trial evaluation and sign-off certificate"
    ]
  },
  {
    "row": 62,
    "phase": "TG_6",
    "track": "QA",
    "code": "HW_37",
    "name": "Regulatory TAC Certification (ARAI/CE)",
    "preparer": "QA (Compliance Lead)",
    "reviewer": "Admin (Management)",
    "responsible": "QA (Compliance Lead)",
    "consulted": "EHW (Lead), EXT (Cert Agency)",
    "accountable": "CFT (Cross functional Team)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Official AIS-140 / ARAI / ICAT Type Approval Certificate (TAC)\n\u2022 Homologation Test Reports & Regulatory Compliance Dossier",
    "tasks": [
      "Submit formal Technical Construction File and test samples to accredited testing agency (ARAI/ICAT)",
      "Coordinate and witness formal homologation testing across environmental, electrical, and RF suites",
      "Provide real-time engineering diagnostics and firmware support during formal compliance scans",
      "Address test laboratory compliance observations and verify technical parameter reports",
      "Obtain official signed Type Approval Certificate (TAC / AIS-140 / CE / WPC) from certifying body"
    ]
  },
  {
    "row": 63,
    "phase": "TG_6",
    "track": "FW",
    "code": "FW_12",
    "name": "Production Firmware Binary Freeze",
    "preparer": "FW (Lead)",
    "reviewer": "QA (Dept specific)",
    "responsible": "FW (Lead)",
    "consulted": "QA (Dept specific), OPS (Lead)",
    "accountable": "FW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Signed Production Firmware Binary (.bin / .hex)\n\u2022 SHA-256 Checksum Certificate & Release Notes",
    "tasks": [
      "Tag and lock release commit branch in version control repository with immutable commit hash",
      "Compile golden production firmware binary (.hex/.bin) with optimization flags enabled",
      "Calculate cryptographic SHA-256 checksum hash and verify binary integrity against build server",
      "Archive signed production binary in secure software artifact repository and cloud drive",
      "Distribute frozen binary checksum to manufacturing EOL testing jigs and OTA campaign manager"
    ]
  },
  {
    "row": 64,
    "phase": "TG_6",
    "track": "FW",
    "code": "FW_13",
    "name": "Field Telemetry Diagnostics & Crash Logs",
    "preparer": "FW (Lead)",
    "reviewer": "SW (Lead)",
    "responsible": "FW (Lead)",
    "consulted": "SW (Lead), OPS (Lead)",
    "accountable": "FW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Production Telemetry Diagnostic Dashboard\n\u2022 Automated Crash Dump & Exception Monitoring Log",
    "tasks": [
      "Configure device-side crash dump logger and non-volatile fault trace recording algorithms",
      "Establish cloud ingestion pipelines for automated vehicle diagnostic and exception telemetry",
      "Set up automated real-time alert triggers for critical voltage drops, reboot loops, and bus failures",
      "Validate incoming field fleet telemetry data integrity and signal decoding on live dashboard",
      "Maintain 99.9% telemetry platform uptime and confirm active field health monitoring"
    ]
  },
  {
    "row": 65,
    "phase": "TG_6",
    "track": "SW",
    "code": "SW_10",
    "name": "Production Cloud Deploy & IMEI Setup",
    "preparer": "SW (DevOps Engg)",
    "reviewer": "SW (Lead)",
    "responsible": "SW (DevOps Engg)",
    "consulted": "OPS (Lead), Admin (Management)",
    "accountable": "SW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Multi-Region Production Cloud Deployment Record\n\u2022 Factory EOL Serialized IMEI/MAC Registry Ingestion Setup",
    "tasks": [
      "Provision scalable multi-region production cloud infrastructure, load balancers, and brokers",
      "Configure high-availability database clusters, read-replicas, and automated backup routines",
      "Whitelist manufactured device identifiers and cryptographic security key registries",
      "Deploy SSL/TLS security certificates, domain routing, and CDN caching layers",
      "Bring production cloud servers live and synchronize with automated EOL factory jig database"
    ]
  },
  {
    "row": 66,
    "phase": "TG_7",
    "track": "SW",
    "code": "SW_11",
    "name": "Staged Canary OTA Rollout & SLA Mon.",
    "preparer": "SW (Lead)",
    "reviewer": "Admin (Management)",
    "responsible": "SW (Lead)",
    "consulted": "OPS (Lead), Admin (Management)",
    "accountable": "SW (Lead)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Staged Canary OTA Rollout Schedule (1% -> 10% -> 100%)\n\u2022 Server SLA & 99.9% Cloud Uptime Monitoring Dashboard",
    "tasks": [
      "Create canary device group and deploy production firmware to 5% pilot vehicle fleet",
      "Monitor cloud ingestion error rates, device reboot telemetry, and packet latency for 48 hours",
      "Progressively expand rollout stages to 25%, 50%, and 100% of the active fleet",
      "Verify automated rollback triggers if telemetry failure rates exceed established SLA thresholds",
      "Confirm successful fleet-wide firmware update completion with zero system downtime"
    ]
  },
  {
    "row": 67,
    "phase": "TG_7",
    "track": "EHW",
    "code": "HW_34",
    "name": "Production BOM Freeze",
    "preparer": "EHW (Lead)",
    "reviewer": "SCM (Lead)",
    "responsible": "EHW (Lead)",
    "consulted": "SCM (Product Delivery), OPS (Lead)",
    "accountable": "CFT (Cross functional Team)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Final Production Bill of Materials (HLPL-[PROJ]-EHW-BOM-01)\n\u2022 SCM Approved Supplier List (ASL) 100% Compliance Audit",
    "tasks": [
      "Finalize manufacturer part numbers (MPNs), packaging reels, and qualified alternate sources",
      "Incorporate negotiated tier-1 component cost reductions and verify supplier payment terms",
      "Audit bill of materials against Approved Supplier List (ASL) and component lifecycle databases",
      "Confirm volume lead times, minimum order quantities (MOQ), and factory buffer inventory",
      "Lock and publish formal Production BOM Rev 1.0 (HLPL-[PROJ]-EHW-BOM-01) for ERP MRP release"
    ]
  },
  {
    "row": 68,
    "phase": "TG_7",
    "track": "FW",
    "code": "G7_01",
    "name": "Pre-Production Golden Firmware & FOTA Validation",
    "preparer": "FW (Engineer)",
    "reviewer": "FW (Lead)",
    "responsible": "FW (Lead)",
    "consulted": "SW (Lead), OPS (Test Lead), QA (Dept specific)",
    "accountable": "FW (Lead)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Golden Sample Firmware Flashing Verification Certificate\n\u2022 Over-The-Air (FOTA) Automated Rollback Stress Log",
    "tasks": [
      "Verify secondary bootloader cryptographic lock, key revocation, and dual-bank partition integrity",
      "Execute automated FOTA delta update cycles across pre-production pilot test units",
      "Validate fail-safe automatic fallback to previous firmware upon simulated power disruption during OTA",
      "Benchmark device sleep current, active processing draw, and cellular wake-up profiles",
      "Formally approve and archive pre-production golden firmware verification dossier (SSM-FW-REL-01)"
    ]
  },
  {
    "row": 69,
    "phase": "TG_7",
    "track": "EMF",
    "code": "G7_02",
    "name": "Pilot Production Run & Work Instructions (SOP) Freeze",
    "preparer": "EMF (Production Team)",
    "reviewer": "OPS (Lead)",
    "responsible": "EMF (Production Team)",
    "consulted": "EHW (Lead), MMF (Lead), QA (Dept specific)",
    "accountable": "OPS (Lead)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Pilot Production Run Yield & Scrap Report\n\u2022 Standard Operating Procedures & Station Work Instructions (BCU WI)\n\u2022 SMT Reflow Profile & Process Control Sheet",
    "tasks": [
      "Execute pre-production pilot manufacturing run (50\u2013100 units) on automated SMT and assembly line",
      "Validate line assembly cycle times, tooling ergonomic clearance, and fixture repeatability",
      "Finalize and freeze Standard Operating Procedures (SOPs), Work Instructions, and Visual Aids",
      "Conduct preliminary line yield analysis, First Pass Yield (FPY), and solder defect categorization",
      "Release frozen manufacturing work instructions (HLPL-SOP-01 / SSM/BCU/WI/04) to production floor"
    ]
  },
  {
    "row": 70,
    "phase": "TG_7",
    "track": "QA",
    "code": "G7_03",
    "name": "Safe Launch Quality Plan (SLQP) & Early Containment",
    "preparer": "QA (Dept specific)",
    "reviewer": "Admin (Management)",
    "responsible": "QA (Dept specific)",
    "consulted": "EMF (Lead), OPS (Lead), EHW (Lead)",
    "accountable": "QA (Dept specific)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Safe Launch Quality Plan (SLQP) & Containment Firewall\n\u2022 100% Redundant Gate Inspection Log",
    "tasks": [
      "Establish 100% redundant quality firewall inspection stations at end-of-line before packaging",
      "Define tightened sampling plans, visual inspection criteria, and defect containment thresholds",
      "Set up pre-production out-of-box audit (OBA) checklists and daily audit registers",
      "Implement daily scrap and defect review meetings with immediate fast-response containment",
      "Baseline Safe Launch Quality Plan (HLPL-QA-SLP-01) and issue firewall inspection protocol"
    ]
  },
  {
    "row": 71,
    "phase": "TG_7",
    "track": "SCM",
    "code": "G7_04",
    "name": "Supplier Volume Readiness & Dual-Sourcing Freeze",
    "preparer": "SCM (Product Delivery)",
    "reviewer": "SCM (Lead)",
    "responsible": "SCM (Product Delivery)",
    "consulted": "EHW (Lead), OPS (Lead), QA (Dept specific)",
    "accountable": "SCM (Lead)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Supplier Capacity Gap Assessment Report (F-PUR-16)\n\u2022 Dual-Source Qualified Component Register (PartsBench)",
    "tasks": [
      "Audit Approved Vendor List (AVL) component production capacity against OEM annual forecast",
      "Establish qualified secondary sources for all single-sourced active ICs and critical passives",
      "Execute supplier buffer stock, consignment inventory, and min-max replenishment agreements",
      "Verify manufacturer part number (MPN) revision consistency between engineering BOM and ERP",
      "Release formal supplier volume readiness and dual-sourcing sign-off dossier (HLPL-SCM-REL-01)"
    ]
  },
  {
    "row": 72,
    "phase": "TG_8",
    "track": "EHW",
    "code": "HW_35",
    "name": "Final Production Gerber & Panel Release",
    "preparer": "EHW (Layout Engg)",
    "reviewer": "EHW (Lead)",
    "responsible": "EHW (Lead)",
    "consulted": "EXT (PCB Fab Vendor), EMF (Lead)",
    "accountable": "EHW (Lead)",
    "informed": "OPS (Lead)",
    "deliverables": "\u2022 Final Production Gerber & Drill Archive (HLPL-[PROJ]-EHW-GER-01)\n\u2022 SMT Laser Stencil Aperture Specification Drawing",
    "tasks": [
      "Incorporate final design-for-manufacturing (DFM) adjustments and silkscreen polarity markers",
      "Design multi-up manufacturing production panel with breakaway v-score rails and tooling holes",
      "Re-generate and verify RS-274X Gerber layers, NC drill files, and IPC-D-356 netlists",
      "Confirm production solder paste stencil aperture ratios and SMT feeder coordinates",
      "Release formal SHA-256 verified production Gerber artwork package for series manufacturing"
    ]
  },
  {
    "row": 73,
    "phase": "TG_8",
    "track": "EHW",
    "code": "HW_36",
    "name": "ECN / ECO Closure (HW_36A)",
    "preparer": "EHW (Lead)",
    "reviewer": "QA (Dept specific)",
    "responsible": "EHW (Lead)",
    "consulted": "QA (Dept specific), MMF (Lead)",
    "accountable": "EHW (Lead)",
    "informed": "CFT (Cross functional Team)",
    "deliverables": "\u2022 Closed Engineering Change Order (ECO) Register\n\u2022 Archived Superseded Drawing Package & Revision History Log",
    "tasks": [
      "Audit implementation status of all historical Engineering Change Notices (ECNs/ECOs)",
      "Archive superseded schematic drawings, board layouts, and obsolete parts lists",
      "Reconcile PLM, ERP, and PartsBench databases to reflect active component revisions",
      "Secure cross-functional closure sign-offs from Hardware, Firmware, and Quality leads",
      "Formally archive Engineering Change Order dossier and seal engineering revision history"
    ]
  },
  {
    "row": 74,
    "phase": "TG_8",
    "track": "QA",
    "code": "G8_01",
    "name": "PPAP Level 3 & PSW Submission",
    "preparer": "QA (Dept specific)",
    "reviewer": "Admin (Management)",
    "responsible": "QA (Dept specific)",
    "consulted": "EHW (Lead), EMF (Lead), OPS (Lead), SCM (Lead)",
    "accountable": "QA (Dept specific)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Production Part Approval Process (PPAP) Level 3 Dossier (F-PUR-15)\n\u2022 Part Submission Warrant (PSW) Signed by Quality Head\n\u2022 Dimensional Inspection Results & Material Test Reports (MTR)\n\u2022 Production Control Plan (HLPL-[PROJ]-CP-01)",
    "tasks": [
      "Compile all 18 mandatory AIAG/IATF PPAP elements including design records, DFMEA, and PFMEA",
      "Consolidate dimensional inspection reports, material test results (MTR), and certified lab logs",
      "Execute Measurement Systems Analysis (MSA-SSM-01) and initial Process Capability (Cpk/Ppk per SSM/SPC/01)",
      "Verify Production Control Plan (HLPL-Project_Code-CP-01) and Process Flow Diagram (PFD-01)",
      "Execute Part Submission Warrant (PSW) and submit PPAP Level 3 package to OEM for formal approval"
    ]
  },
  {
    "row": 75,
    "phase": "TG_8",
    "track": "OPS",
    "code": "G8_02",
    "name": "OEM Line Audit & Run-at-Rate Verification",
    "preparer": "OPS (Lead)",
    "reviewer": "CFT (Cross functional Team)",
    "responsible": "OPS (Lead)",
    "consulted": "EMF (Lead), QA (Dept specific), SCM (Lead)",
    "accountable": "OPS (Lead)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 OEM Plant Process Audit Scorecard\n\u2022 Run-at-Rate Capacity Demonstration Report (Takt Time Verification)",
    "tasks": [
      "Execute continuous multi-hour production Run-at-Rate verification on EMS SMT and assembly lines",
      "Measure Overall Equipment Effectiveness (OEE), line takt time, scrap rates, and first-pass yield",
      "Host and facilitate on-site OEM client quality system and manufacturing process line audit",
      "Close all audit observations, implement line-balancing optimizations, and eliminate bottlenecks",
      "Issue validated Run-at-Rate capacity report and formal line qualification certificate (HLPL-OPS-RAR-01)"
    ]
  },
  {
    "row": 76,
    "phase": "TG_8",
    "track": "QA",
    "code": "G8_03",
    "name": "Golden Sample & Master Calibration Archive",
    "preparer": "QA (Dept specific)",
    "reviewer": "OPS (Lead)",
    "responsible": "QA (Dept specific)",
    "consulted": "EHW (Lead), OPS (Test Lead), EMF (Lead)",
    "accountable": "QA (Dept specific)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Master Golden Sample Inspection Record & Boundary Units\n\u2022 NABL-Traceable Calibration Certificates & Test Jig Log",
    "tasks": [
      "Select and inspect golden boundary sample units representing dimensional and electrical limits",
      "Perform high-precision master calibration using accredited laboratory reference standards",
      "Affix tamper-evident serial labels, calibration tags, and security seals to master golden units",
      "Formulate routine calibration interval schedules and maintenance SOPs for factory test fixtures",
      "Deposit master golden units and verified calibration logs into secure QA audit archive"
    ]
  },
  {
    "row": 77,
    "phase": "TG_8",
    "track": "OPS",
    "code": "\u2014",
    "name": "Mass Production Handover & Ramp-Up",
    "preparer": "OPS (Lead)",
    "reviewer": "EMF (Lead)",
    "responsible": "OPS (Lead)",
    "consulted": "EMF (Lead), SCM (Lead)",
    "accountable": "OPS (Lead)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Manufacturing Operations Handover Certificate\n\u2022 Series Production Yield & Process Capability Dashboard (Cp/Cpk)",
    "tasks": [
      "Train EMS manufacturing supervisors, SMT operators, and QA personnel on frozen SOPs",
      "Hand over calibrated production fixtures, automated EOL testing jigs, and diagnostic tools",
      "Establish incoming, in-process, and outgoing quality monitoring dashboards and rejection thresholds",
      "Monitor initial series production batch yield and track process stability indices (Cp/Cpk)",
      "Execute formal manufacturing ramp-up sign-off and transfer operational ownership to plant team"
    ]
  },
  {
    "row": 78,
    "phase": "TG_9",
    "track": "QA",
    "code": "G9_01",
    "name": "Project Wrap-up Checklist & Audit Readiness",
    "preparer": "QA (Dept specific)",
    "reviewer": "Admin (Management)",
    "responsible": "QA (Dept specific)",
    "consulted": "CFT (Cross functional Team), OPS (Lead)",
    "accountable": "QA (Dept specific)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Project Audit Readiness Verification Checklist\n\u2022 QMS / IATF 16949 Compliance Audit Dossier",
    "tasks": [
      "Audit mandatory engineering, software, testing, and regulatory compliance artifacts",
      "Verify formal closure of all DVP, DVR, IQC, and supplier PPAP non-conformance items",
      "Conduct internal QMS (ISO 9001:2015) and automotive IATF 16949 audit trail compliance check",
      "Validate 100% completion of all technical stage-gate exit criteria across lifecycle gates",
      "Archive completed wrap-up verification checklist and audit dossier in governance vault"
    ]
  },
  {
    "row": 79,
    "phase": "TG_9",
    "track": "PM",
    "code": "G9_02",
    "name": "Final Budget Reconciliation & Cost Variance Analysis",
    "preparer": "PM (Project Manager)",
    "reviewer": "Admin (Management)",
    "responsible": "PM (Project Manager)",
    "consulted": "SCM (Lead), OPS (Lead), EHW (Lead)",
    "accountable": "PM (Project Manager)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Final Project Budget & CapEx Reconciliation Report\n\u2022 Product BOM Cost Variance Analysis Summary",
    "tasks": [
      "Consolidate final BOM expenditures, tooling CapEx, NRE development, and certification costs",
      "Benchmark actual product cost roll-up against Gate 0 and Gate 1 baseline financial targets",
      "Quantify supplier pricing variances, shipping/customs surcharges, and production scrap costs",
      "Reconcile project capital expenditure and R&D amortization against initial business plan",
      "Publish financial project closure summary and cost variance analysis report for leadership"
    ]
  },
  {
    "row": 80,
    "phase": "TG_9",
    "track": "QA",
    "code": "G9_03",
    "name": "Post-Launch Risk Scoring & Residual Risk Assessment",
    "preparer": "QA (Dept specific)",
    "reviewer": "Admin (Management)",
    "responsible": "QA (Dept specific)",
    "consulted": "EHW (Lead), FW (Lead), SW (Lead), OPS (Lead)",
    "accountable": "QA (Dept specific)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Post-Launch Enterprise Risk Register\n\u2022 Residual Risk Assessment & CAPA Effectiveness Sign-Off",
    "tasks": [
      "Re-evaluate enterprise project risk register and score residual operational/quality risks",
      "Review design DFMEA, manufacturing PFMEA, and initial pilot field performance logs",
      "Assess long-term warranty exposure, component obsolescence risks, and supply continuity",
      "Verify effectiveness of permanent corrective and preventive actions (8D CAPA) taken",
      "Sign off post-launch residual risk assessment matrix with Quality Assurance and Operations leads"
    ]
  },
  {
    "row": 81,
    "phase": "TG_9",
    "track": "OPS",
    "code": "G9_04",
    "name": "Cross-Functional Retrospective & Lessons Learned",
    "preparer": "OPS (Lead)",
    "reviewer": "CFT (Cross functional Team)",
    "responsible": "CFT (Cross functional Team)",
    "consulted": "EHW (Lead), FW (Lead), SW (Lead), MMF (Lead), SCM (Lead)",
    "accountable": "PM (Project Manager)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Cross-Functional Project Retrospective Report\n\u2022 Organizational Lessons Learned Register (HLPL-QA-LLR-01)",
    "tasks": [
      "Convene cross-track project retrospective sessions with HW, FW, SW, MECH, PUR, and MFG leads",
      "Document 'Things Gone Right' (TGR) and 'Things Gone Wrong' (TGW) across engineering phases",
      "Identify root causes of development bottlenecks, DFM/DFA challenges, and schedule deviations",
      "Formulate organizational process improvements, checklist updates, and design rule enhancements",
      "Publish comprehensive project retrospective and lessons learned knowledge asset (HLPL-QA-LLR-01)"
    ]
  },
  {
    "row": 82,
    "phase": "TG_9",
    "track": "EHW",
    "code": "G9_05",
    "name": "Design Artifact, Codebase & Test Jig Archival",
    "preparer": "EHW (Lead)",
    "reviewer": "CFT (Cross functional Team)",
    "responsible": "CFT (Cross functional Team)",
    "consulted": "FW (Lead), SW (Lead), OPS (Test Lead)",
    "accountable": "EHW (Lead)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Tagged Production Codebase & Firmware Git Release\n\u2022 Master Design Drawings & Calibrated Tooling Inventory Archive",
    "tasks": [
      "Tag, freeze, and archive golden production firmware and software repository branches in Git",
      "Archive production schematic drawings, PCB layout files, Gerber archives, and BOM spreadsheets",
      "Secure calibrated EOL testing fixtures, programming jigs, and flashing software tools in storage",
      "Catalog all regulatory type approval test reports, certificates, user manuals, and PDI records",
      "Deposit complete digital release package into centralized enterprise project repository"
    ]
  },
  {
    "row": 83,
    "phase": "TG_9",
    "track": "PM",
    "code": "G9_06",
    "name": "Executive Tollgate Review & Formal Project Closure",
    "preparer": "PM (Project Manager)",
    "reviewer": "Admin (Management)",
    "responsible": "CFT (Cross functional Team)",
    "consulted": "EHW (Lead), FW (Lead), SW (Lead), MMF (Lead), QA (Dept specific), OPS (Lead)",
    "accountable": "PM (Project Manager)",
    "informed": "Admin (Management)",
    "deliverables": "\u2022 Executive Tollgate Review Presentation & Closure Dossier\n\u2022 Signed Executive Project Closure Certificate (G9-SIGN-01)",
    "tasks": [
      "Present comprehensive project closure dossier and operational manufacturing KPIs to executive management",
      "Verify stable mass production ramp-up, supply chain continuity, and field SLA adherence",
      "Finalize OEM client commercial project acceptance, final invoicing, and contractual closure",
      "Formally release project team resources and reallocate engineering bandwidth to new initiatives",
      "Sign and execute formal Gate 9 Executive Tollgate Review & Project Closure Certificate (G9-SIGN-01)"
    ]
  }
] as const;

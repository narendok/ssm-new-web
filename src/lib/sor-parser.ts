/**
 * Smart SOR (Statement of Requirements) Parser & Template Engine
 * Parses OEM engineering requirements and tender RFQ documents
 * to generate pre-filled Opportunities and project input sheets.
 */

export interface ParsedSorResult {
  customerCode: string;
  customerName: string;
  spocName: string;
  spocEmail: string;
  projectTitle: string;
  scopeSummary: string;
  projectTrack: "turnkey" | "software" | "firmware" | "ready_made";
  targetVolume: string;
  targetClosureDate: string;
  feasibilityDepartments: string[];
  parameterValues: Record<string, string>;
  rawSnippet?: string;
}

export interface SorTemplate {
  id: string;
  name: string;
  oem: string;
  badge: string;
  description: string;
  content: string;
  parsed: ParsedSorResult;
}

export const STANDARD_SOR_TEMPLATES: SorTemplate[] = [
  {
    id: "sor-tata-ev-telematics",
    name: "Tata Motors EV Fleet Telematics Gateway (AIS-140)",
    oem: "Tata Motors Limited · EV Fleet Division, Pune",
    badge: "Automotive Turnkey",
    description: "Automotive AIS-140 telematics gateway with NavIC, Dual-CAN J1939, IP67 enclosure, and 50,000 units/year volume.",
    content: `STATEMENT OF REQUIREMENTS (SOR) - AUTOMOTIVE TELEMATICS
Document Ref: TML-EV-SOR-2026-088
Client: Tata Motors Limited - EV Fleet Division, Pune
SPOC: Rajesh Kulkarni (rajesh.kulkarni@tatamotors.com)

1. PROJECT SCOPE & APPLICATION:
Supply of in-vehicle AIS-140 compliant telematics gateway for Tata Ace EV commercial fleet.
Vehicle Interface: Dual CAN 2.0B (ISO 11898-2) for J1939 Powertrain CAN and Battery Management System (BMS) telemetry.
Target Volume: 50,000 units / year. Target SOP: 24 weeks from kickoff.

2. ELECTRICAL & POWER SPECIFICATIONS:
- Nominal System Voltage: 12V DC (Vehicle Low-Voltage Auxiliary Bus)
- Operating Voltage Range: 9V - 36V DC with ISO 16750-2 cold crank immunity down to 6V
- Sleep Current Consumption: < 2 mA @ 12V in deep sleep with CAN & accelerometer wake-up
- Supply Protection: ISO 7637-2 Pulse 1/2a/3a/5b (+87V load dump clamp) with reverse battery protection (-36V)

3. CONNECTIVITY & POSITIONING:
- Cellular Modem: 4G LTE Cat-1 with 2G GSM/GPRS fallback (Quectel EG915N compatible)
- GNSS Receiver: Concurrent GPS + GLONASS + NavIC (IRNSS L5 band) conforming to MoRTH AIS-140
- SIM Architecture: Dual SIM with soldered industrial MFF2 eSIM + Micro-SIM (3FF) backup tray

4. PHYSICAL & ENVIRONMENTAL:
- Ingress Protection: IP67 certified (dust-tight, submersible 1m for 30 minutes)
- Operating Temperature: -40°C to +85°C (Automotive AEC-Q100 Grade)
- Enclosure Dimensions: 120 × 85 × 32 mm with integrated mounting flanges; weight < 220g
- Backup Battery: Internal Li-Polymer 3.7V 1000mAh with NTC thermal cutoff and safe charging

5. CERTIFICATIONS & HOMOLOGATION:
- ARAI / ICAT TAC AIS-140 Amendment 1 Type Approval
- IP67 and ISO 16750-3 vibration qualification
`,
    parsed: {
      customerCode: "TATA-EV",
      customerName: "Tata Motors Limited · EV Fleet Division",
      spocName: "Rajesh Kulkarni",
      spocEmail: "rajesh.kulkarni@tatamotors.com",
      projectTitle: "Tata Ace EV 4G Telematics Gateway",
      scopeSummary: "AIS-140 telematics gateway with Dual CAN J1939, NavIC GNSS, IP67 enclosure, and 50,000 annual units.",
      projectTrack: "turnkey",
      targetVolume: "50,000 units / year",
      targetClosureDate: "2027-04-30",
      feasibilityDepartments: ["EHW", "FW", "SW", "MECH", "PUR", "QA", "EMF", "MMF"],
      parameterValues: {
        system_voltage: "12V DC (Passenger Vehicle / Light Commercial)",
        operating_range: "9V – 36V DC (Wide-range Automotive ISO 16750-2)",
        transient_noise: "ISO 7637-2 Pulse 1, 2a, 2b, 3a, 3b, 5b (Automotive Load Dump)",
        sleep_current: "< 2 mA @ 12V (Deep Sleep · Accelerometer + CAN Wake)",
        supply_protection: "Reverse Polarity (-36V Continuous) + 40V Overvoltage Clamp + PPTC Fuse",
        cellular: "4G LTE Cat-1 with 2G GSM Fallback (AIS-140 Standard)",
        region: "India (AIS-140 / ARAI / ICAT TAC Certified)",
        sim: "Dual SIM: MFF2 Embedded eSIM (Primary) + Micro-SIM (3FF) Fallback",
        gnss: "GPS + GLONASS + NavIC (Dual-Frequency L1/L5 Indian Constellation AIS-140)",
        can: "Dual CAN 2.0B (ISO 11898-2) J1939 + OBD-II @ 500 kbps / 250 kbps",
        can_termination: "120Ω Internal Software-Switchable (MCU GPIO Controlled)",
        storage: "8 GB eMMC 5.1 High-Endurance Automotive Grade",
        digital_inputs: "4 Inputs: 1x Ignition Sense (6-36V) + 3x Configurable (Active High/Low)",
        digital_outputs: "2 Outputs: Low-Side Open-Drain (500mA with Flyback Clamp Diode)",
        analog_inputs: "2 Inputs: 0–32V (12-bit ADC, for Fuel Level & Primary Battery Monitoring)",
        serial_ports: "1x RS485 (Half-Duplex with 15kV ESD) + 1x USB Type-C Debug",
        ip: "IP67 (Dust tight, water immersion up to 1m for 30 minutes)",
        dimensions: "120 × 85 × 32 mm · Max 220g (Enclosed IP67 with Flange Mount)",
        battery: "Li-Polymer 3.7V 1000mAh (Internal with NTC Thermal Protection & Safe Charging)",
        certifications: "AIS-140 Amendment 1 / TAC (ARAI / ICAT Certified) + IP67 Certified",
        temperature: "-40°C to +85°C (Automotive Extended Grade AEC-Q100)",
        use_case: "AIS-140 EV Fleet Telematics Gateway & BMS Monitoring (Tata Ace EV / Commercial)",
        quantity: "Annual: 50,000 units (PoC: 500 units · SMT Pilot: 2,000 units · SOP Series)",
        delivery: "PoC: 8 weeks · SMT Pilot: 16 weeks · SOP Mass Production: 24 weeks",
        cost: "Target BOM Cost: ₹2,500 ($30 USD) · Target Selling Price: ₹4,200 ($50 USD)",
        firmware: "MQTT over TLS 1.3 + HTTPS FOTA (Firmware-Over-The-Air) with A/B Dual Boot Slots",
      },
    },
  },

  {
    id: "sor-ashok-truck-telematics",
    name: "Ashok Leyland Connected Truck Telematics (24V Commercial)",
    oem: "Ashok Leyland Limited · Commercial Vehicle Division, Chennai",
    badge: "24V Commercial Truck",
    description: "Heavy commercial 24V gateway with CAN-FD powertrain bus, RS485 ultrasonic fuel level, IP65 housing, and 25,000 units/year.",
    content: `STATEMENT OF REQUIREMENTS - COMMERCIAL VEHICLE TELEMATICS
Client: Ashok Leyland Limited
Ref: AL-CV-2026-T7
Contact: Suresh Mani (suresh.m@ashokleyland.com)
System: 24V Commercial Truck Fleet
Operating Voltage: 18V - 36V DC
Vehicle Bus: 1x CAN-FD + 1x Classic CAN 2.0B + 1x RS485 Ultrasonic Fuel Sensor
Cellular: 4G LTE Cat-1 with 2G fallback
Ingress Protection: IP65 Dust and Water Jet Protected
Annual Quantity: 25,000 units
Operating Temp: -40°C to +85°C
Target SOP: 20 weeks
`,
    parsed: {
      customerCode: "ASHOK-CV",
      customerName: "Ashok Leyland Limited · Commercial Vehicles",
      spocName: "Suresh Mani",
      spocEmail: "suresh.m@ashokleyland.com",
      projectTitle: "Ashok Leyland 24V Connected Truck Telematics",
      scopeSummary: "24V commercial vehicle gateway with CAN-FD, RS485 fuel sensor, IP65 rating, and 25,000 units/year.",
      projectTrack: "turnkey",
      targetVolume: "25,000 units / year",
      targetClosureDate: "2027-02-28",
      feasibilityDepartments: ["EHW", "FW", "SW", "MECH", "PUR", "QA", "EMF", "MMF"],
      parameterValues: {
        system_voltage: "24V DC (Heavy Commercial / Bus / Truck / Off-Highway)",
        operating_range: "18V – 36V DC (24V Commercial Heavy Vehicle)",
        ip: "IP65 (Dust tight, protected against water jets from any direction)",
        cellular: "4G LTE Cat-1 with 2G GSM Fallback (AIS-140 Standard)",
        can: "1x CAN-FD (Powertrain) + 1x Classic CAN 2.0B (Body/Chassis)",
        serial_ports: "1x RS485 (Half-Duplex with 15kV ESD) + 1x USB Type-C Debug",
        temperature: "-40°C to +85°C (Automotive Extended Grade AEC-Q100)",
        quantity: "Annual: 25,000 units (PoC: 250 units · SMT Pilot: 1,000 units · SOP Series)",
        cost: "Target BOM Cost: ₹2,500 ($30 USD) · Target Selling Price: ₹4,200 ($50 USD)",
      },
    },
  },

  {
    id: "sor-ready-made-obd",
    name: "Ready-Made Off-The-Shelf OBD-II Tracker (Direct Sales Track)",
    oem: "Zoomcar Fleet & Commercial Mobility",
    badge: "Ready-Made Sales Track",
    description: "Catalog ready-made device sold directly by Sales without hardware/firmware development (HW/FW waived).",
    content: `COMMERCIAL PURCHASING REQUISITION - READY-MADE TRACK
Client: Zoomcar Fleet Mobility Solutions
Ref: ZM-OBD-READY-01
Contact: Ananya Sen (ananya@zoomcar.com)
Product: Pre-Certified Off-the-Shelf OBD-II Plug & Play Tracker
Track: ready_made (Hardware / Firmware development waived)
Target Volume: 5,000 units immediate catalog delivery
Voltage: 12V DC standard OBD-II passenger vehicle port
Brochure & Datasheet: SAL-BRO-01 and SAL-TDS-01 required
Commercial Lead: Sales alone handles contract and quotation
`,
    parsed: {
      customerCode: "ZOOM-FLT",
      customerName: "Zoomcar Fleet Mobility Solutions",
      spocName: "Ananya Sen",
      spocEmail: "ananya@zoomcar.com",
      projectTitle: "Pre-Certified Ready-Made OBD-II Fleet Tracker",
      scopeSummary: "Off-the-shelf ready-made OBD-II tracker; hardware development waived; Sales handles brochure, TDS, and quotation.",
      projectTrack: "ready_made",
      targetVolume: "5,000 units / year",
      targetClosureDate: "2026-12-15",
      feasibilityDepartments: ["SAL", "FIN"], // Technical departments waived for ready-made track
      parameterValues: {
        system_voltage: "12V DC (Passenger Vehicle / Light Commercial)",
        operating_range: "9V – 18V DC (12V Automotive Standard)",
        ip: "IP54 (Dust protected, protected against splashing water)",
        use_case: "Off-the-Shelf Commercial OBD-II Plug-and-Play Device (Direct Sale Track)",
        delivery: "Immediate Commercial Delivery (Ready-Made Off-The-Shelf Device Track)",
        quantity: "Annual: 5,000 units (PoC: 50 units · SMT Pilot: 200 units · SOP Series)",
      },
    },
  },
];

/**
 * Parses freeform text or uploaded SOR string into structured parameters
 */
export { parseSorText } from "./sor-extract.ts";

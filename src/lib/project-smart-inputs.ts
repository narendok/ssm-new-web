/**
 * Smart Input Parameter Specifications & Downstream Document Mapping
 * Supports structured inputs (dropdowns, numeric ranges, units) that drive
 * downstream documents (PRS, SRS, BOM, DVPR, Quotation).
 */

export type SmartFieldKind = "dropdown" | "number_range" | "number_unit" | "presets_with_custom";

export interface SmartOption {
  value: string;
  label: string;
  badge?: string;
  description?: string;
}

export interface SmartParameterSpec {
  id: string;
  kind: SmartFieldKind;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  presets: SmartOption[];
  downstreamDocs: string[]; // e.g. ["PRS", "BOM", "DVPR"]
  docImpact: string; // Brief description of how it affects downstream deliverables
}

export const SMART_PARAMETER_SPECS: Record<string, SmartParameterSpec> = {
  system_voltage: {
    id: "system_voltage",
    kind: "presets_with_custom",
    unit: "V DC",
    min: 5,
    max: 120,
    step: 1,
    downstreamDocs: ["PRS", "BOM", "DVPR", "TDS"],
    docImpact: "Defines input protection TVS, DC-DC buck converter rating in BOM and PRS electrical specs.",
    presets: [
      {
        value: "12V DC (Passenger Vehicle / Light Commercial)",
        label: "12V DC (Passenger & Light Commercial)",
        badge: "Automotive 12V",
        description: "Standard nominal 12V supply for cars, vans, and light commercial vehicles.",
      },
      {
        value: "24V DC (Heavy Commercial / Bus / Truck / Off-Highway)",
        label: "24V DC (Heavy Commercial & Bus/Truck)",
        badge: "Automotive 24V",
        description: "Heavy commercial 24V architecture; requires 40V+ transient tolerance.",
      },
      {
        value: "48V DC (Mild Hybrid / EV Low Voltage)",
        label: "48V DC (Mild Hybrid & EV Auxiliary)",
        badge: "EV 48V",
        description: "Low-voltage EV auxiliary bus and mild hybrid powertrains.",
      },
      {
        value: "36V DC (Light EV / Golf Cart / Industrial)",
        label: "36V DC (Light EV & Industrial)",
        badge: "Industrial 36V",
        description: "Light electric mobility and industrial warehouse equipment.",
      },
      {
        value: "72V DC (High Voltage EV Fleet)",
        label: "72V DC (EV Fleet & Two-Wheeler / Three-Wheeler)",
        badge: "EV 72V",
        description: "Direct traction battery tapping with galvanic isolation required.",
      },
    ],
  },

  operating_range: {
    id: "operating_range",
    kind: "presets_with_custom",
    unit: "V DC",
    min: 4,
    max: 60,
    step: 0.5,
    downstreamDocs: ["PRS", "BOM", "DVPR"],
    docImpact: "Dictates wide-range regulator selection, cold crank dropout tests in DVPR.",
    presets: [
      {
        value: "9V – 36V DC (Wide-range Automotive ISO 16750-2)",
        label: "9V – 36V DC (Standard 12V/24V Wide Range)",
        badge: "ISO 16750-2",
        description: "Universal automotive range handling both 12V and 24V battery systems.",
      },
      {
        value: "9V – 18V DC (12V Automotive Standard)",
        label: "9V – 18V DC (12V Dedicated)",
        badge: "12V Only",
        description: "Optimized for passenger car 12V electrical systems.",
      },
      {
        value: "18V – 36V DC (24V Commercial Heavy Vehicle)",
        label: "18V – 36V DC (24V Dedicated)",
        badge: "24V Only",
        description: "Optimized for 24V bus and commercial truck architectures.",
      },
      {
        value: "6V – 36V DC (Extended Cold Crank Drop)",
        label: "6V – 36V DC (Cold Crank Immunity)",
        badge: "Crank Safe",
        description: "Supports severe engine cranking voltage drops down to 6V without resetting.",
      },
      {
        value: "36V – 60V DC (48V Low Voltage Hybrid)",
        label: "36V – 60V DC (48V Systems)",
        badge: "48V Hybrid",
        description: "Extended range for 48V mild-hybrid and industrial battery systems.",
      },
    ],
  },

  transient_noise: {
    id: "transient_noise",
    kind: "dropdown",
    downstreamDocs: ["PRS", "DVPR"],
    docImpact: "Generates EMC / transient immunity test plan requirements in QA DVPR.",
    presets: [
      {
        value: "ISO 7637-2 Pulse 1, 2a, 2b, 3a, 3b, 5b (Automotive Load Dump)",
        label: "ISO 7637-2 Pulses 1/2a/2b/3a/3b/5b (Full Load Dump)",
        badge: "ISO 7637-2",
        description: "Complete automotive transient immunity covering 87V load dump pulse 5b.",
      },
      {
        value: "ISO 16750-2 Class A (Functional during transient)",
        label: "ISO 16750-2 Class A (Zero interruption)",
        badge: "Class A",
        description: "Device maintains continuous communication during electrical transients.",
      },
      {
        value: "Industrial IEC 61000-4-4 (EFT) & IEC 61000-4-5 (Surge 2kV)",
        label: "IEC 61000-4-4 / 4-5 (Industrial Surge & Burst)",
        badge: "Industrial",
        description: "Heavy industrial transient noise protection for stationary installations.",
      },
    ],
  },

  sleep_current: {
    id: "sleep_current",
    kind: "presets_with_custom",
    unit: "mA",
    min: 0.1,
    max: 50,
    step: 0.1,
    downstreamDocs: ["PRS", "FW", "DVPR"],
    docImpact: "Enforces low-power MCU state machine in FW and parasitic draw limit in DVPR.",
    presets: [
      {
        value: "< 2 mA @ 12V (Deep Sleep · Accelerometer + CAN Wake)",
        label: "< 2 mA @ 12V (Deep Sleep · Motion/CAN Wake)",
        badge: "< 2 mA",
        description: "Ultra-low quiescent draw prevents vehicle battery drain during parked state.",
      },
      {
        value: "< 5 mA @ 12V (Standby Sleep · AIS-140 Compliance)",
        label: "< 5 mA @ 12V (AIS-140 Compliant Sleep)",
        badge: "< 5 mA",
        description: "Mandatory AIS-140 sleep specification allowing periodic GPS fixes.",
      },
      {
        value: "< 500 µA @ 12V (Ultra-low storage standby)",
        label: "< 500 µA @ 12V (Long-term Shipping Mode)",
        badge: "< 500 µA",
        description: "Preserves internal battery during extended months of warehouse shelf storage.",
      },
    ],
  },

  supply_protection: {
    id: "supply_protection",
    kind: "dropdown",
    downstreamDocs: ["PRS", "BOM", "DVPR"],
    docImpact: "Selects MOSFET reverse-polarity switch, TVS diode, and PTC fuse in BOM.",
    presets: [
      {
        value: "Reverse Polarity (-36V Continuous) + 40V Overvoltage Clamp + PPTC Fuse",
        label: "Reverse Polarity (-36V) + 40V Clamp + PPTC",
        badge: "Full Protection",
        description: "Protects against wrong battery connection and alternator overvoltage.",
      },
      {
        value: "Schottky Diode Reverse Protection + TVS Surge Clamp",
        label: "Schottky Diode + TVS Clamp (Cost Optimized)",
        badge: "Standard",
        description: "Economical reverse protection for compact enclosures.",
      },
    ],
  },

  cellular: {
    id: "cellular",
    kind: "dropdown",
    downstreamDocs: ["PRS", "SRS", "BOM", "DVPR"],
    docImpact: "Specifies cellular modem module (e.g. Quectel EG915N) in BOM and AT-command driver in FW.",
    presets: [
      {
        value: "4G LTE Cat-1 with 2G GSM Fallback (AIS-140 Standard)",
        label: "4G LTE Cat-1 + 2G Fallback (Quectel EG915N)",
        badge: "4G Cat-1",
        description: "Standard Indian automotive telematics configuration with pan-India fallback.",
      },
      {
        value: "4G LTE Cat-4 High-Speed (Dashcam / Video Telematics)",
        label: "4G LTE Cat-4 High-Speed (Video / Telematics)",
        badge: "4G Cat-4",
        description: "High bandwidth for dual-camera streaming, video upload, and live dashcam.",
      },
      {
        value: "4G LTE Cat-M1 / NB-IoT (Low-Power Stationary)",
        label: "4G LTE Cat-M1 / NB-IoT (Low Power IoT)",
        badge: "NB-IoT / M1",
        description: "Optimized for battery-powered stationary smart meters and asset trackers.",
      },
      {
        value: "5G Sub-6GHz + 4G Cat-12 High Throughput",
        label: "5G Sub-6GHz + 4G Gigabit",
        badge: "5G",
        description: "Next-generation connected vehicle gateway with ultra-low latency.",
      },
      {
        value: "None / Local RF Only (BLE / Wi-Fi / RS485)",
        label: "None (BLE / Wi-Fi / Local RS485 Gateway)",
        badge: "Non-Cellular",
        description: "Non-cellular gateway connected via local Wi-Fi or wired Ethernet.",
      },
    ],
  },

  region: {
    id: "region",
    kind: "dropdown",
    downstreamDocs: ["PRS", "SAL-QUO", "DVPR"],
    docImpact: "Selects regulatory compliance path, carrier frequency bands, and certification bodies.",
    presets: [
      {
        value: "India (AIS-140 / ARAI / ICAT TAC Certified)",
        label: "India (AIS-140 / ARAI / ICAT Certified)",
        badge: "India",
        description: "Indian automotive compliance with mandatory NavIC GNSS and panic button.",
      },
      {
        value: "Global (Multi-band Worldwide Roaming B1/B3/B5/B8/B20/B28)",
        label: "Global (Worldwide Roaming Multi-band)",
        badge: "Global",
        description: "Worldwide frequency coverage for export vehicles and international fleets.",
      },
      {
        value: "Europe (CE / RED Directive / e-Mark UN ECE R10)",
        label: "Europe (CE / RED / e-Mark UN ECE R10)",
        badge: "EU",
        description: "European automotive EMC and radio equipment directive certification.",
      },
      {
        value: "North America (FCC Part 15 / PTCRB / AT&T Verified)",
        label: "North America (FCC / PTCRB / Carrier Approved)",
        badge: "US / NA",
        description: "FCC certification for US/Canada commercial vehicle deployments.",
      },
    ],
  },

  sim: {
    id: "sim",
    kind: "dropdown",
    downstreamDocs: ["PRS", "BOM", "SIT"],
    docImpact: "Determines PCB layout (MFF2 footprint vs SIM tray) and carrier provisioning in SIT.",
    presets: [
      {
        value: "Dual SIM: MFF2 Embedded eSIM (Primary) + Micro-SIM (3FF) Fallback",
        label: "Dual SIM: MFF2 eSIM + Micro-SIM (3FF) Fallback",
        badge: "Dual SIM",
        description: "High-reliability automotive setup with soldered eSIM and physical backup tray.",
      },
      {
        value: "Micro-SIM (3FF) Removable Tray with Anti-Vibration Retainer",
        label: "Micro-SIM (3FF) Removable with Anti-Vibration",
        badge: "Micro-SIM",
        description: "Standard removable card with automotive vibration-proof spring lock.",
      },
      {
        value: "Nano-SIM (4FF) Removable Tray",
        label: "Nano-SIM (4FF) Removable Tray",
        badge: "Nano-SIM",
        description: "Compact SIM footprint for space-constrained enclosures.",
      },
      {
        value: "MFF2 Embedded Industrial eSIM (Soldered Directly to PCB)",
        label: "MFF2 Soldered eSIM Only (Tamper-Proof)",
        badge: "MFF2 Soldered",
        description: "Vibration-proof, moisture-proof, and tamper-resistant soldered chip.",
      },
    ],
  },

  gnss: {
    id: "gnss",
    kind: "dropdown",
    downstreamDocs: ["PRS", "SRS", "BOM", "DVPR"],
    docImpact: "Selects GNSS antenna (patch vs active external), L1/L5 dual-band receiver in BOM.",
    presets: [
      {
        value: "GPS + GLONASS + NavIC (Dual-Frequency L1/L5 Indian Constellation AIS-140)",
        label: "GPS + GLONASS + NavIC (AIS-140 Mandatory)",
        badge: "NavIC L5",
        description: "Complies with MoRTH AIS-140 mandate with Indian IRNSS/NavIC tracking.",
      },
      {
        value: "GPS + GLONASS + Galileo + BeiDou (Concurrent Multi-Constellation)",
        label: "GPS + GLONASS + Galileo + BeiDou (Quad Constellation)",
        badge: "Quad GNSS",
        description: "Global high-density satellite reception for dense urban and valley operation.",
      },
      {
        value: "High-Precision RTK Multi-GNSS (Centimeter Accuracy)",
        label: "High-Precision RTK GNSS (< 2 cm accuracy)",
        badge: "RTK Precision",
        description: "Autonomous vehicle positioning and agricultural precision guidance.",
      },
      {
        value: "GPS + GLONASS Standard (Internal High-Gain Ceramic Patch)",
        label: "GPS + GLONASS Standard (Internal Ceramic Antenna)",
        badge: "Internal Patch",
        description: "Self-contained internal antenna without external roof wire routing.",
      },
    ],
  },

  can: {
    id: "can",
    kind: "dropdown",
    downstreamDocs: ["PRS", "SRS", "FW", "DVPR"],
    docImpact: "Defines CAN transceiver ICs in BOM, CAN bus filters, and J1939 DBC parsing in FW.",
    presets: [
      {
        value: "Dual CAN 2.0B (ISO 11898-2) J1939 + OBD-II @ 500 kbps / 250 kbps",
        label: "Dual CAN 2.0B (J1939 + OBD-II)",
        badge: "Dual CAN",
        description: "Monitors vehicle powertrain CAN on channel 1 and battery/body CAN on channel 2.",
      },
      {
        value: "Single CAN 2.0B (ISO 11898-2) @ 500 kbps",
        label: "Single CAN 2.0B (Standard OBD)",
        badge: "Single CAN",
        description: "Standard telematics gateway reading standard diagnostic PIDs.",
      },
      {
        value: "Dual CAN-FD (Flexible Data-rate up to 5 Mbps)",
        label: "Dual CAN-FD (Up to 5 Mbps High Throughput)",
        badge: "CAN-FD",
        description: "Next-gen EV powertrain bus support for high data-rate communication.",
      },
      {
        value: "1x CAN-FD (Powertrain) + 1x Classic CAN 2.0B (Body/Chassis)",
        label: "Hybrid: 1x CAN-FD + 1x Classic CAN 2.0B",
        badge: "CAN-FD + Classic",
        description: "Interfaces modern EV drivetrain and legacy dashboard instrument cluster.",
      },
      {
        value: "No CAN Interface Required",
        label: "No CAN Required (Direct IO / RS485 Only)",
        badge: "None",
        description: "Stationary or non-automotive asset tracking applications.",
      },
    ],
  },

  can_termination: {
    id: "can_termination",
    kind: "dropdown",
    downstreamDocs: ["PRS", "BOM", "DVPR"],
    docImpact: "Adds analog switches and precision 120Ω resistors to BOM for bus impedance matching.",
    presets: [
      {
        value: "120Ω Internal Software-Switchable (MCU GPIO Controlled)",
        label: "120Ω Internal Software-Switchable",
        badge: "Software 120Ω",
        description: "Enables or disables 120Ω termination via software configuration command.",
      },
      {
        value: "120Ω Fixed Internal Termination Resistor",
        label: "120Ω Fixed Internal",
        badge: "Fixed 120Ω",
        description: "Hardwired termination for end-of-line bus devices.",
      },
      {
        value: "No Internal Termination (External Bus Terminated)",
        label: "No Internal Termination (Pass-Through)",
        badge: "Pass-Through",
        description: "Connects mid-bus without altering existing vehicle bus impedance.",
      },
    ],
  },

  storage: {
    id: "storage",
    kind: "dropdown",
    downstreamDocs: ["PRS", "SRS", "FW", "BOM"],
    docImpact: "Selects non-volatile memory in BOM and allocates circular buffer sectors in FW.",
    presets: [
      {
        value: "8 GB eMMC 5.1 High-Endurance Automotive Grade",
        label: "8 GB eMMC 5.1 Automotive Grade",
        badge: "8 GB eMMC",
        description: "Industrial flash with pSLC partition for OS, logs, and firmware dual-boot slots.",
      },
      {
        value: "16 GB eMMC 5.1 High-Endurance Automotive Grade",
        label: "16 GB eMMC 5.1 Automotive Grade",
        badge: "16 GB eMMC",
        description: "Expanded storage for video clips, edge AI models, and multi-year CAN logs.",
      },
      {
        value: "32 MB SPI NOR Flash (60,000+ Offline AIS-140 Tracking Records)",
        label: "32 MB SPI NOR Flash (60,000 Records)",
        badge: "32 MB NOR",
        description: "Fast SPI flash storing weeks of offline location data during cellular outage.",
      },
      {
        value: "16 MB SPI NOR Flash (30,000 Offline Tracking Records)",
        label: "16 MB SPI NOR Flash (30,000 Records)",
        badge: "16 MB NOR",
        description: "Cost-optimized NOR flash meeting standard AIS-140 emergency buffer.",
      },
      {
        value: "MicroSD Card Slot (Up to 128 GB) + 16 MB SPI NOR Flash",
        label: "MicroSD Slot + 16 MB SPI Flash",
        badge: "MicroSD + Flash",
        description: "Removable memory for fleet video storage and field telemetry export.",
      },
    ],
  },

  digital_inputs: {
    id: "digital_inputs",
    kind: "presets_with_custom",
    unit: "Inputs",
    min: 0,
    max: 16,
    step: 1,
    downstreamDocs: ["PRS", "FW", "DVPR"],
    docImpact: "Configures optocouplers, input resistor dividers, and GPIO interrupt handlers in FW.",
    presets: [
      {
        value: "4 Inputs: 1x Ignition Sense (6-36V) + 3x Configurable (Active High/Low)",
        label: "4 Inputs (1x Ignition + 3x Configurable)",
        badge: "4x Inputs",
        description: "Standard telematics I/O: ignition detection plus door, PTO, and SOS inputs.",
      },
      {
        value: "2 Inputs: 1x Ignition Sense (6-36V) + 1x Emergency SOS Button",
        label: "2 Inputs (1x Ignition + 1x SOS Button)",
        badge: "2x Inputs",
        description: "Essential AIS-140 configuration for passenger transport compliance.",
      },
      {
        value: "6 Inputs: 1x Ignition + 1x SOS + 4x Optoisolated Digital (6-36V)",
        label: "6 Inputs Optoisolated (Heavy Commercial)",
        badge: "6x Inputs",
        description: "Industrial fleet setup with AC compressor, seatbelt, and brake sensors.",
      },
    ],
  },

  digital_outputs: {
    id: "digital_outputs",
    kind: "presets_with_custom",
    unit: "Outputs",
    min: 0,
    max: 8,
    step: 1,
    downstreamDocs: ["PRS", "FW", "DVPR"],
    docImpact: "Selects low-side power MOSFETs or relays with flyback suppression in BOM.",
    presets: [
      {
        value: "2 Outputs: Low-Side Open-Drain (500mA with Flyback Clamp Diode)",
        label: "2 Outputs: Low-Side 500mA Open-Drain",
        badge: "2x 500mA",
        description: "Drives buzzer, indicator LED, or external immobilizer cutoff relay.",
      },
      {
        value: "1 Output: Vehicle Immobilizer Engine Cutoff Relay (1A Low-Side)",
        label: "1 Output: Immobilizer Engine Cutoff (1A)",
        badge: "1x 1A",
        description: "AIS-140 remote engine immobilization control via secure SMS/cloud command.",
      },
      {
        value: "4 Outputs: 2x Low-Side 500mA + 2x High-Side 2A Smart Power Switches",
        label: "4 Outputs (2x Low-Side + 2x High-Side 2A)",
        badge: "4x Smart Switch",
        description: "Drives external sirens and heavy auxiliary automotive accessories.",
      },
    ],
  },

  analog_inputs: {
    id: "analog_inputs",
    kind: "presets_with_custom",
    unit: "Channels",
    min: 0,
    max: 8,
    step: 1,
    downstreamDocs: ["PRS", "FW", "DVPR"],
    docImpact: "Selects 12-bit ADC filtering network, precision voltage dividers in BOM.",
    presets: [
      {
        value: "2 Inputs: 0–32V (12-bit ADC, for Fuel Level & Primary Battery Monitoring)",
        label: "2 Inputs: 0–32V (12-bit ADC for Fuel/Battery)",
        badge: "2x 0-32V",
        description: "Measures fuel level sensor voltage and main vehicle battery voltage directly.",
      },
      {
        value: "1 Input: 0–5V (Industrial Sensor ADC)",
        label: "1 Input: 0–5V Standard Industrial Sensor",
        badge: "1x 0-5V",
        description: "Connects standard 0-5V pressure, temperature, or angle sensors.",
      },
      {
        value: "2 Inputs: 4–20mA Industrial Current Loop (with 250Ω Shunt)",
        label: "2 Inputs: 4–20mA Current Loop",
        badge: "4-20mA",
        description: "Industrial standard noise-immune analog sensor measurement.",
      },
      {
        value: "None Required",
        label: "None (Digital & CAN Telemetry Only)",
        badge: "None",
        description: "All telemetry values received digitally via vehicle CAN bus.",
      },
    ],
  },

  serial_ports: {
    id: "serial_ports",
    kind: "dropdown",
    downstreamDocs: ["PRS", "SRS", "BOM", "DVPR"],
    docImpact: "Selects RS485/RS232 transceiver ICs in BOM and serial driver routines in FW.",
    presets: [
      {
        value: "1x RS485 (Half-Duplex with 15kV ESD) + 1x USB Type-C Debug",
        label: "1x RS485 (15kV ESD) + 1x USB Type-C",
        badge: "RS485 + USB",
        description: "Connects ultrasonic fuel sensors or RFID reader, plus USB for bench test.",
      },
      {
        value: "1x RS232 (Full Duplex) + 1x RS485 Isolated",
        label: "1x RS232 + 1x RS485 Isolated (Dual Serial)",
        badge: "RS232 + RS485",
        description: "Legacy meter connectivity via RS232 plus multi-drop RS485 bus.",
      },
      {
        value: "2x RS485 Isolated (Modbus RTU Master/Slave)",
        label: "2x RS485 Isolated (Industrial Modbus)",
        badge: "Dual RS485",
        description: "Galvanically isolated dual RS485 for noisy solar inverters and PLCs.",
      },
      {
        value: "1x USB Type-C 2.0 OTG Only",
        label: "1x USB Type-C 2.0 OTG Only",
        badge: "USB-C Only",
        description: "Minimal serial footprint with modern USB diagnostics.",
      },
    ],
  },

  ip: {
    id: "ip",
    kind: "dropdown",
    downstreamDocs: ["PRS", "MECH-3D", "DVPR", "TDS"],
    docImpact: "Dictates enclosure gasket tooling in MECH, ultrasonic welding, and IP67 test in QA.",
    presets: [
      {
        value: "IP67 (Dust tight, water immersion up to 1m for 30 minutes)",
        label: "IP67 (Submersible 1m 30min · Automotive Standard)",
        badge: "IP67",
        description: "Under-chassis or exterior vehicle mounting with silicone sealing gasket.",
      },
      {
        value: "IP65 (Dust tight, protected against water jets from any direction)",
        label: "IP65 (Water Jet Protected)",
        badge: "IP65",
        description: "Resistant to rain, wash spray, and road dust in commercial cabin mounting.",
      },
      {
        value: "IP54 (Dust protected, protected against splashing water)",
        label: "IP54 (Splash & Dust Protected)",
        badge: "IP54",
        description: "Under-dashboard passenger car installation.",
      },
      {
        value: "IP69K (High-pressure high-temperature steam washdown)",
        label: "IP69K (High-Pressure Steam Washdown)",
        badge: "IP69K",
        description: "Food grade, agriculture, and mining equipment subject to steam cleaning.",
      },
      {
        value: "IP20 (Indoor cabin / dry enclosure mounting only)",
        label: "IP20 (Indoor / Dry Enclosure Only)",
        badge: "IP20",
        description: "Control room or sealed electrical cabinet installation.",
      },
    ],
  },

  dimensions: {
    id: "dimensions",
    kind: "presets_with_custom",
    unit: "mm",
    downstreamDocs: ["PRS", "MECH-3D", "EMF", "TDS"],
    docImpact: "Freezes PCB envelope dimensions for EHW and injection mold cavity dimensions for MECH.",
    presets: [
      {
        value: "120 × 85 × 32 mm · Max 220g (Enclosed IP67 with Flange Mount)",
        label: "120 × 85 × 32 mm · 220g (IP67 Flange Mount)",
        badge: "120x85x32",
        description: "Standard AIS-140 gateway enclosure with dual mounting ears.",
      },
      {
        value: "95 × 65 × 25 mm · Max 140g (Compact Telematics)",
        label: "95 × 65 × 25 mm · 140g (Compact Enclosure)",
        badge: "95x65x25",
        description: "Miniature tracker fits inside narrow two-wheeler battery compartments.",
      },
      {
        value: "150 × 110 × 42 mm · Max 380g (Heavy Commercial Gateway)",
        label: "150 × 110 × 42 mm · 380g (Heavy Commercial)",
        badge: "150x110x42",
        description: "Ruggedized housing accommodating high-capacity internal backup battery.",
      },
    ],
  },

  battery: {
    id: "battery",
    kind: "dropdown",
    downstreamDocs: ["PRS", "BOM", "DVPR", "EMF"],
    docImpact: "Selects battery chemistry, charging controller IC, NTC thermal safety circuit in BOM.",
    presets: [
      {
        value: "Li-Polymer 3.7V 1000mAh (Internal with NTC Thermal Protection & Safe Charging)",
        label: "Li-Polymer 3.7V 1000mAh (Standard 6h+ Standby)",
        badge: "Li-Poly 1000mAh",
        description: "Compact battery providing 6+ hours of AIS-140 tracking when vehicle battery cut.",
      },
      {
        value: "LiFePO4 3.2V 1500mAh (High Thermal Safety -20°C to +75°C Automotive)",
        label: "LiFePO4 3.2V 1500mAh (High Thermal Safety)",
        badge: "LiFePO4 Safe",
        description: "Zero thermal runaway risk in extreme hot engine bay environments up to 75°C.",
      },
      {
        value: "Li-Ion 18650 3.7V 2600mAh (Extended 24h+ Standby)",
        label: "Li-Ion 18650 3.7V 2600mAh (24h+ Standby)",
        badge: "Li-Ion 2600mAh",
        description: "High capacity for trailer tracking and long disconnected transit.",
      },
      {
        value: "Supercapacitor Pack 5.4V 5F (Emergency Power Cut Alert & Graceful Shutdown)",
        label: "Supercapacitor 5.4V 5F (Safe Shutdown Only)",
        badge: "Supercap",
        description: "Sends immediate power-tamper alert without chemical battery degradation.",
      },
      {
        value: "No Internal Battery (Direct Vehicle Supply Only)",
        label: "No Battery (Direct External Power Only)",
        badge: "No Battery",
        description: "Cost-optimized device requiring continuous vehicle power.",
      },
    ],
  },

  certifications: {
    id: "certifications",
    kind: "dropdown",
    downstreamDocs: ["PRS", "QA-DVP", "PPAP", "TAC"],
    docImpact: "Defines regulatory test suite in QA DVPR, external lab testing quotation and TAC timeline.",
    presets: [
      {
        value: "AIS-140 Amendment 1 / TAC (ARAI / ICAT Certified) + IP67 Certified",
        label: "AIS-140 Amendment 1 / TAC (ARAI/ICAT) + IP67",
        badge: "AIS-140 ARAI",
        description: "Full regulatory type approval for public and commercial vehicles in India.",
      },
      {
        value: "CE (RED Directive 2014/53/EU) + RoHS + REACH Compliance",
        label: "CE (RED Directive) + RoHS + REACH",
        badge: "CE European",
        description: "European Union radio equipment and environmental compliance.",
      },
      {
        value: "FCC Part 15 Class B + PTCRB Carrier Certification (North America)",
        label: "FCC Part 15 Class B + PTCRB",
        badge: "FCC / PTCRB",
        description: "North American telecom and unintentional radiator approval.",
      },
      {
        value: "E-Mark (UN ECE Regulation 10 Automotive EMC Approval)",
        label: "E-Mark (UN ECE R10 Automotive EMC)",
        badge: "E-Mark R10",
        description: "International automotive OEM homologation mark.",
      },
    ],
  },

  temperature: {
    id: "temperature",
    kind: "presets_with_custom",
    unit: "°C",
    downstreamDocs: ["PRS", "DVPR", "BOM", "TDS"],
    docImpact: "Enforces AEC-Q100 Grade 2/3 component qualification in BOM and thermal chamber testing in QA.",
    presets: [
      {
        value: "-40°C to +85°C (Automotive Extended Grade AEC-Q100)",
        label: "-40°C to +85°C (Automotive AEC-Q100)",
        badge: "Auto -40..+85",
        description: "Full automotive operating range for under-dash and passenger compartment.",
      },
      {
        value: "-20°C to +70°C (Standard Industrial Operating Grade)",
        label: "-20°C to +70°C (Standard Industrial)",
        badge: "Ind -20..+70",
        description: "Standard industrial grade for warehouse and stationary tracking.",
      },
      {
        value: "-40°C to +105°C (Under-the-Hood Heavy Commercial Grade)",
        label: "-40°C to +105°C (Under-the-Hood Grade 2)",
        badge: "Extreme 105°C",
        description: "High temperature resilience for engine bay and transmission mounting.",
      },
      {
        value: "0°C to +55°C (Commercial / Cabin Enclosure Only)",
        label: "0°C to +55°C (Commercial Cabin Only)",
        badge: "Commercial 55°C",
        description: "Basic air-conditioned driver cabin environment.",
      },
    ],
  },

  use_case: {
    id: "use_case",
    kind: "presets_with_custom",
    downstreamDocs: ["PRS", "SAL-QUO", "SRS"],
    docImpact: "Frames product specification charter and application software architecture.",
    presets: [
      {
        value: "AIS-140 EV Fleet Telematics Gateway & BMS Monitoring (Tata Ace EV / Commercial)",
        label: "AIS-140 EV Fleet Telematics & BMS Monitoring",
        badge: "EV Fleet",
        description: "Electric vehicle fleet telematics with state-of-charge, cell voltage, and tamper alerts.",
      },
      {
        value: "Heavy Commercial Truck Dual-CAN J1939 Telematics & Remote Diagnostics",
        label: "Heavy Truck Dual-CAN J1939 Telematics",
        badge: "Heavy Truck",
        description: "Long-haul freight tracking with DTC fault code diagnostics and fuel optimization.",
      },
      {
        value: "Cold Chain Logistics Temperature & GPS Tracker with Internal Battery",
        label: "Cold Chain Temperature & GPS Tracking",
        badge: "Cold Chain",
        description: "Monitors refrigerated cargo with BLE temperature beacons and door alarms.",
      },
      {
        value: "Industrial Edge IoT Gateway (Modbus RS485 to MQTT Cloud)",
        label: "Industrial Edge IoT Modbus Gateway",
        badge: "Edge IoT",
        description: "Translates industrial PLC and energy meter registers to cloud telemetry.",
      },
      {
        value: "Off-the-Shelf Commercial OBD-II Plug-and-Play Device (Direct Sale Track)",
        label: "Ready-Made OBD-II Plug-and-Play (Direct Sale)",
        badge: "Ready-Made",
        description: "Pre-certified off-the-shelf unit sold directly by Sales without HW development.",
      },
    ],
  },

  quantity: {
    id: "quantity",
    kind: "presets_with_custom",
    unit: "Units / Year",
    min: 100,
    max: 500000,
    step: 500,
    downstreamDocs: ["SAL-QUO", "PUR-BOM", "EMF-SOP"],
    docImpact: "Determines volume tier pricing in BOM, tool cavity count in MECH, SMT line capacity in EMF.",
    presets: [
      {
        value: "Annual: 50,000 units (PoC: 500 units · SMT Pilot: 2,000 units · SOP Series)",
        label: "50,000 units / year (PoC: 500 · Pilot: 2,000)",
        badge: "50k / yr",
        description: "Tier-1 OEM volume tier justifying multi-cavity tooling and automated EOL test jig.",
      },
      {
        value: "Annual: 25,000 units (PoC: 250 units · SMT Pilot: 1,000 units · SOP Series)",
        label: "25,000 units / year (PoC: 250 · Pilot: 1,000)",
        badge: "25k / yr",
        description: "Mid-scale commercial fleet deployment.",
      },
      {
        value: "Annual: 10,000 units (PoC: 100 units · SMT Pilot: 500 units · SOP Series)",
        label: "10,000 units / year (PoC: 100 · Pilot: 500)",
        badge: "10k / yr",
        description: "Specialized vehicle fleet or regional industrial deployment.",
      },
      {
        value: "Annual: 5,000 units (PoC: 50 units · SMT Pilot: 200 units · SOP Series)",
        label: "5,000 units / year (PoC: 50 · Pilot: 200)",
        badge: "5k / yr",
        description: "Niche market or pilot batch rollout.",
      },
    ],
  },

  delivery: {
    id: "delivery",
    kind: "presets_with_custom",
    downstreamDocs: ["SAL-QUO", "PROJECT-PLAN"],
    docImpact: "Establishes APQP gate schedule, SMT pilot lock date, and customer SOP commitment.",
    presets: [
      {
        value: "PoC: 8 weeks · SMT Pilot: 16 weeks · SOP Mass Production: 24 weeks",
        label: "Standard APQP: PoC 8w · Pilot 16w · SOP 24w",
        badge: "24 Weeks",
        description: "Standard automotive hardware design, qualification, and pilot production cycle.",
      },
      {
        value: "PoC: 4 weeks · SMT Pilot: 8 weeks · SOP Mass Production: 12 weeks (Fast Track)",
        label: "Fast-Track: PoC 4w · Pilot 8w · SOP 12w",
        badge: "12 Weeks",
        description: "Accelerated development using pre-qualified reference architecture.",
      },
      {
        value: "Immediate Commercial Delivery (Ready-Made Off-The-Shelf Device Track)",
        label: "Immediate Stock (Ready-Made Track)",
        badge: "Ready-Made",
        description: "Direct dispatch from finished goods inventory without engineering wait.",
      },
    ],
  },

  cost: {
    id: "cost",
    kind: "presets_with_custom",
    unit: "INR / USD",
    downstreamDocs: ["SAL-QUO", "PUR-BOM", "FIN-BUDGET"],
    docImpact: "Enforces target BOM cost budget for PUR component sourcing and quotation margin for SAL.",
    presets: [
      {
        value: "Target BOM Cost: ₹2,500 ($30 USD) · Target Selling Price: ₹4,200 ($50 USD)",
        label: "Target BOM: ₹2,500 ($30) · Price: ₹4,200 ($50)",
        badge: "₹2,500 BOM",
        description: "High-margin automotive telematics pricing tier at 50,000 annual volume.",
      },
      {
        value: "Target BOM Cost: ₹1,800 ($22 USD) · Target Selling Price: ₹3,100 ($37 USD)",
        label: "Target BOM: ₹1,800 ($22) · Price: ₹3,100 ($37)",
        badge: "₹1,800 BOM",
        description: "Competitive price point for entry-level commercial vehicle tracking.",
      },
      {
        value: "Target BOM Cost: ₹4,500 ($55 USD) · Target Selling Price: ₹7,500 ($90 USD)",
        label: "Target BOM: ₹4,500 ($55) · Price: ₹7,500 ($90)",
        badge: "₹4,500 BOM",
        description: "Premium dual-CAN + high-endurance eMMC gateway specification.",
      },
    ],
  },

  firmware: {
    id: "firmware",
    kind: "dropdown",
    downstreamDocs: ["SRS", "FW", "SIT"],
    docImpact: "Specifies cloud protocol telemetry structure in SRS and FOTA bootloader partition in FW.",
    presets: [
      {
        value: "MQTT over TLS 1.3 + HTTPS FOTA (Firmware-Over-The-Air) with A/B Dual Boot Slots",
        label: "MQTT over TLS 1.3 + HTTPS A/B FOTA",
        badge: "MQTT TLS",
        description: "Secure encrypted JSON/protobuf telemetry with fail-safe rollback over-the-air updates.",
      },
      {
        value: "CoAP / LwM2M over DTLS (Optimized Low Bandwidth Telemetry)",
        label: "CoAP / LwM2M over DTLS (Low Bandwidth)",
        badge: "CoAP LwM2M",
        description: "Lightweight device management protocol ideal for cellular data conservation.",
      },
      {
        value: "HTTP/HTTPS REST API + TCP Raw Socket Fallback",
        label: "HTTPS REST + TCP Socket Fallback",
        badge: "REST / TCP",
        description: "Standard web service integration with binary TCP fallback.",
      },
      {
        value: "Custom Automotive Telematics Protocol (MoRTH AIS-140 Packet Standard)",
        label: "AIS-140 Standard MoRTH Packet Protocol",
        badge: "AIS-140 Proto",
        description: "Fixed-format encrypted packets transmitted to government and private servers.",
      },
    ],
  },
};

/**
 * Derives structured downstream document requirements from project input values
 */
export function deriveDownstreamDocumentSpecs(parameterValues: Record<string, { finalValue?: string; input?: string }>) {
  const getVal = (id: string) => parameterValues[id]?.finalValue || parameterValues[id]?.input || "";

  return {
    prs: {
      title: "Product Requirement Specification (PRS) - EHW Deliverable",
      systemVoltage: getVal("system_voltage") || "12V / 24V DC",
      operatingRange: getVal("operating_range") || "9V – 36V DC",
      sleepCurrent: getVal("sleep_current") || "< 2 mA @ 12V",
      transientProtection: getVal("transient_noise") || "ISO 7637-2 Pulse 1/2a/3a/5b",
      ipRating: getVal("ip") || "IP67",
      dimensions: getVal("dimensions") || "120 × 85 × 32 mm",
      battery: getVal("battery") || "Li-Polymer 3.7V 1000mAh",
      operatingTemperature: getVal("temperature") || "-40°C to +85°C",
      canChannels: getVal("can") || "Dual CAN 2.0B",
    },
    srs: {
      title: "Software Requirement Specification (SRS) - SW/FW Deliverable",
      protocol: getVal("firmware") || "MQTT over TLS 1.3 + HTTPS FOTA",
      cellular: getVal("cellular") || "4G LTE Cat-1 with 2G fallback",
      storage: getVal("storage") || "8 GB eMMC 5.1",
      gnss: getVal("gnss") || "GPS + GLONASS + NavIC",
    },
    bom: {
      title: "Bill of Materials (BOM) Requirements - PUR Deliverable",
      targetCost: getVal("cost") || "₹2,500 ($30 USD)",
      targetVolume: getVal("quantity") || "50,000 units/year",
      supplyProtection: getVal("supply_protection") || "Reverse polarity -36V + TVS clamp",
      simType: getVal("sim") || "Dual SIM MFF2 + Micro-SIM",
    },
    dvpr: {
      title: "Design Verification Plan & Report (DVPR) - QA Deliverable",
      certifications: getVal("certifications") || "AIS-140 TAC + IP67",
      tempRange: getVal("temperature") || "-40°C to +85°C",
      ingressProtection: getVal("ip") || "IP67",
      voltageTestSweep: getVal("operating_range") || "9V to 36V DC (Cold crank 6V)",
    },
    quotation: {
      title: "Commercial Quotation (QUO) - SAL Deliverable",
      targetVolume: getVal("quantity") || "50,000 units/year",
      deliveryTimeline: getVal("delivery") || "24 weeks SOP",
      costStructure: getVal("cost") || "BOM: ₹2,500 · Selling: ₹4,200",
      useCase: getVal("use_case") || "Automotive Telematics Gateway",
    },
  };
}

import type { ParsedSorResult } from "./sor-parser";

/** Copy explicitly labelled source values; never infer approval, certification or commercial facts. */
export function parseSorText(text: string): ParsedSorResult {
  let content = text;
  // Structured exports may carry source values, never final values or approval state.
  if (text.trim().startsWith("{")) {
    try {
      const source = JSON.parse(text);
      const aliases: Record<string, string> = {projectTitle:"Project",customerName:"Customer",customerCode:"Customer Code",spocName:"SPOC",spocEmail:"Contact Email",targetVolume:"Quantity",targetClosureDate:"Target Date",scopeSummary:"Scope",projectTrack:"Project Track"};
      const values = source.parameterValues && typeof source.parameterValues === "object" && !Array.isArray(source.parameterValues) ? source.parameterValues : {};
      content = Object.entries({...source, ...values})
        .filter(([,value]) => typeof value === "string" || typeof value === "number")
        .map(([key,value]) => `${aliases[key] || key.replace(/_/g," ")}: ${String(value).replace(/[\r\n]+/g," ")}`).join("\n");
    } catch { /* Invalid JSON remains unparsed text; unknowns stay blank. */ }
  }
  const field = (labels: string) => new RegExp(
    '^\\s*(?:[-*]\\s*)?"?(?:' + labels + ')"?\\s*[:=,]\\s*([^\\r\\n]+)', "im",
  ).exec(content)?.[1]?.trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"') || "";
  const labels: Record<string, string> = {
    system_voltage: "(?:nominal )?system voltage", operating_range: "operating (?:voltage )?range",
    transient_noise: "transient noise", sleep_current: "sleep current(?: consumption)?",
    supply_protection: "supply protection", cellular: "cellular(?: network| modem)?",
    region: "area of usage(?: / region)?|region", sim: "sim(?: type| architecture)?",
    gnss: "satellite(?: \\(gnss\\))?|gnss(?: receiver)?", can: "can(?: lines| bus)?|vehicle interface",
    can_termination: "can[- ]terminating resistor|can termination", storage: "storage(?: or memory)?|memory",
    digital_inputs: "digital inputs", digital_outputs: "digital outputs", analog_inputs: "analog inputs",
    serial_ports: "external serial ports|serial ports", switching: "no\\. of high / low switching|switching outputs", ip: "ip rating|ingress protection",
    dimensions: "max dimensions|enclosure dimensions", battery: "internal battery|backup battery",
    certifications: "certifications", temperature: "operating temp(?:erature)?|temp",
    quantity: "target volume|annual volume|volume|quantity|qty", delivery: "delivery timeline|target delivery",
    cost: "target cost|target bom cost", use_case: "use case|application", firmware: "firmware requirements",
    sourcing: "sourcing(?: requirements)?", manufacturing: "manufacturing(?: requirements| readiness)?",
    testing: "testing(?: requirements)?", data_security: "data security", training: "training(?: requirements)?",
    service: "service(?: requirements)?", special: "special(?: requirements)?",
  };
  const parameterValues: Record<string, string> = {};
  for (const [id, names] of Object.entries(labels)) {
    const value = field(names);
    if (value) parameterValues[id] = value;
  }
  const track = field("project track|track").toLowerCase();
  const projectTrack = /ready.?made|off.?the.?shelf/.test(track) ? "ready_made"
    : /software/.test(track) ? "software" : /firmware/.test(track) ? "firmware" : "turnkey";
  return {
    customerCode: field("customer code|client code"), customerName: field("client|customer|oem|company"),
    spocName: field("spoc|contact").replace(/\s*\([^)]*\)/g, "").trim(),
    spocEmail: content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || "",
    projectTitle: field("project|title|subject|device|product"),
    scopeSummary: field("scope|scope summary|objective"), projectTrack,
    targetVolume: parameterValues["quantity"] || "",
    targetClosureDate: field("target closure date|target date").match(/^\d{4}-\d{2}-\d{2}$/)?.[0] || "",
    feasibilityDepartments: projectTrack === "ready_made" ? ["SAL", "FIN"] : ["EHW", "FW", "SW", "MECH", "PUR", "QA", "EMF", "MMF"],
    parameterValues, rawSnippet: text,
  };
}

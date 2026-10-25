import { useState } from "react";
import {
  STANDARD_SOR_TEMPLATES,
  parseSorText,
  type ParsedSorResult,
  type SorTemplate,
} from "@/lib/sor-parser";
import {
  FileSpreadsheet,
  Sparkles,
  Upload,
  CheckCircle2,
  Building2,
  Users,
  Calendar,
  Layers,
  ArrowRight,
  Shield,
  FileText,
  Check,
  X,
} from "lucide-react";

interface SmartSorImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSor: (sorData: ParsedSorResult) => Promise<void> | void;
  initialEnquiryTitle?: string;
  initialCustomerName?: string;
}

export function SmartSorImporterModal({
  isOpen,
  onClose,
  onImportSor,
  initialEnquiryTitle,
  initialCustomerName,
}: SmartSorImporterModalProps) {
  const [activeTab, setActiveTab] = useState<"templates" | "paste" | "upload">("templates");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("sor-tata-ev-telematics");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedSorResult>(() => {
    const defaultTemplate = STANDARD_SOR_TEMPLATES[0];
    return defaultTemplate ? { ...defaultTemplate.parsed } : parseSorText("");
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelectTemplate = (template: SorTemplate) => {
    setSelectedTemplateId(template.id);
    setParsed({ ...template.parsed });
    setRawText(template.content);
  };

  const handleParseCustomText = () => {
    if (!rawText.trim()) return;
    const result = parseSorText(rawText);
    setParsed(result);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        const result = parseSorText(content);
        setParsed(result);
      }
    };
    reader.readAsText(file);
  };

  const toggleDept = (code: string) => {
    setParsed((prev) => {
      const exists = prev.feasibilityDepartments.includes(code);
      const nextDepts = exists
        ? prev.feasibilityDepartments.filter((d) => d !== code)
        : [...prev.feasibilityDepartments, code];
      return { ...prev, feasibilityDepartments: nextDepts };
    });
  };

  const handleSelectAllDepts = () => {
    setParsed((prev) => ({
      ...prev,
      feasibilityDepartments: ["EHW", "FW", "SW", "MECH", "PUR", "QA", "EMF", "MMF"],
    }));
  };

  const handleDeselectAllDepts = () => {
    setParsed((prev) => ({
      ...prev,
      feasibilityDepartments: ["SAL", "FIN"],
    }));
  };

  const handleApply = async () => {
    setIsSubmitting(true);
    try {
      await onImportSor(parsed);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  Smart SOR Importer (Statement of Requirements)
                </h3>
                <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                  Automotive &amp; IoT Spec Sheet
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Parse customer requirements sheets to generate a pre-filled Opportunity and dispatch Feasibility to technical departments.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="border-b border-border bg-muted/40 px-6 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("templates")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition ${
                  activeTab === "templates"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileSpreadsheet className="size-3.5" />
                OEM Standard Templates
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("paste")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition ${
                  activeTab === "paste"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="size-3.5" />
                Paste SOR Text
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition ${
                  activeTab === "upload"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="size-3.5" />
                Upload Document File
              </button>
            </div>

            <span className="text-[11px] text-muted-foreground">
              {Object.keys(parsed.parameterValues).length} smart parameters extracted
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Top Selection Mode Area */}
          {activeTab === "templates" && (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-foreground">
                Select Standard Automotive / Commercial Spec Sheet:
              </label>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {STANDARD_SOR_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                      selectedTemplateId === tmpl.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                        : "border-border bg-card hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-foreground">
                        {tmpl.badge}
                      </span>
                      {selectedTemplateId === tmpl.id && (
                        <CheckCircle2 className="size-4 text-primary" />
                      )}
                    </div>
                    <h4 className="mt-2 text-xs font-bold text-foreground line-clamp-1">{tmpl.name}</h4>
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{tmpl.description}</p>
                    <span className="mt-2 text-[10px] font-mono text-primary font-semibold">{tmpl.oem}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "paste" && (
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-bold text-foreground">
                <span>Paste Customer Requirements Specification / RFQ Text:</span>
                <button
                  type="button"
                  onClick={handleParseCustomText}
                  className="rounded bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-xs hover:opacity-90"
                >
                  ⚡ Parse &amp; Extract Parameters
                </button>
              </label>
              <textarea
                rows={5}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste client SOR text with voltage, IP rating, CAN lines, temperature, cellular modem, and volume..."
                className="w-full rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {activeTab === "upload" && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center">
              <Upload className="size-8 text-muted-foreground" />
              <h4 className="mt-2 text-xs font-bold text-foreground">Upload SOR Specification File</h4>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Supports .txt, .csv, .json, and plain text requirement exports.
              </p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
                <Upload className="size-3.5" />
                Browse File
                <input type="file" accept=".txt,.csv,.json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          )}

          {/* Extracted Opportunity Details */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Extracted Opportunity &amp; Feasibility Dispatch
                </h4>
              </div>
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                Pre-filled from SOR
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground">Project Title</label>
                <input
                  type="text"
                  value={parsed.projectTitle}
                  onChange={(e) => setParsed({ ...parsed, projectTitle: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground">Customer / OEM</label>
                <input
                  type="text"
                  value={parsed.customerName}
                  onChange={(e) => setParsed({ ...parsed, customerName: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground">SPOC &amp; Contact Email</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={parsed.spocName}
                    onChange={(e) => setParsed({ ...parsed, spocName: e.target.value })}
                    placeholder="SPOC Name"
                    className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground"
                  />
                  <input
                    type="email"
                    value={parsed.spocEmail}
                    onChange={(e) => setParsed({ ...parsed, spocEmail: e.target.value })}
                    placeholder="Email"
                    className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Project Track</label>
                  <select
                    value={parsed.projectTrack}
                    onChange={(e) => {
                      const nextTrack = e.target.value as ParsedSorResult["projectTrack"];
                      setParsed({
                        ...parsed,
                        projectTrack: nextTrack,
                        feasibilityDepartments:
                          nextTrack === "ready_made"
                            ? ["SAL", "FIN"]
                            : ["EHW", "FW", "SW", "MECH", "PUR", "QA", "EMF", "MMF"],
                      });
                    }}
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-medium text-foreground"
                  >
                    <option value="turnkey">Turnkey (HW, FW, SW, MECH, EMF)</option>
                    <option value="software">Software (Cloud &amp; Web Platform)</option>
                    <option value="firmware">Firmware / IoT Device</option>
                    <option value="ready_made">Ready-Made Track (Catalog Direct)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Target Annual Volume</label>
                  <input
                    type="text"
                    value={parsed.targetVolume}
                    onChange={(e) => setParsed({ ...parsed, targetVolume: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-medium text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Feasibility Department Selection (Default all 8 selected) */}
            <div className="space-y-2 rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground">
                  Select Feasibility Review Departments ({parsed.feasibilityDepartments.length} selected):
                </span>
                <div className="flex gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={handleSelectAllDepts}
                    className="text-primary hover:underline font-semibold"
                  >
                    Select All (8)
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllDepts}
                    className="text-muted-foreground hover:underline"
                  >
                    Minimal (Commercial)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { code: "EHW", name: "Embedded Hardware", icon: "⚡" },
                  { code: "FW", name: "Embedded Firmware", icon: "💾" },
                  { code: "SW", name: "Cloud & Software", icon: "🌐" },
                  { code: "MECH", name: "Mechanical & Thermal", icon: "📐" },
                  { code: "PUR", name: "Procurement & Sourcing", icon: "📦" },
                  { code: "QA", name: "Quality Assurance & Test", icon: "🛡️" },
                  { code: "EMF", name: "Electronics Mfg (SMT)", icon: "🏭" },
                  { code: "MMF", name: "Mechanical Assembly", icon: "🔧" },
                ].map((dept) => {
                  const isChecked = parsed.feasibilityDepartments.includes(dept.code);
                  return (
                    <label
                      key={dept.code}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs transition ${
                        isChecked
                          ? "border-primary bg-primary/10 text-foreground font-semibold"
                          : "border-border bg-card text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDept(dept.code)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span>{dept.icon}</span>
                      <div className="min-w-0">
                        <span className="block font-bold">{dept.code}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{dept.name}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Smart Technical Parameters Extracted */}
            <div className="space-y-2">
              <h5 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Extracted Smart Input Parameters (Feeds Project Analysis &amp; Downstream Documents):
              </h5>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 text-xs">
                {Object.entries(parsed.parameterValues).map(([key, val]) => (
                  <div key={key} className="rounded-md border border-border/70 bg-card p-2">
                    <span className="text-[10px] font-mono text-muted-foreground capitalize block truncate">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="font-semibold text-foreground text-[11px] line-clamp-1" title={val}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3.5 bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Creates Opportunity, initializes Project Analysis sheet, and alerts {parsed.feasibilityDepartments.length} teams.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isSubmitting || !parsed.projectTitle}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="size-3.5" />
              {isSubmitting ? "Creating Opportunity..." : "Create Opportunity & Dispatch Feasibility"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

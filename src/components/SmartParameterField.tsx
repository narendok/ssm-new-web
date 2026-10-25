import { useState, useEffect } from "react";
import {
  SMART_PARAMETER_SPECS,
  type SmartParameterSpec,
} from "@/lib/project-smart-inputs";
import { Sparkles, Sliders, FileText, Check, AlertCircle } from "lucide-react";

interface SmartParameterFieldProps {
  parameterId: string;
  label: string;
  section: string;
  hint: string;
  inputDraft: {
    input: string;
    source: string;
    finalValue: string;
  };
  disabled?: boolean;
  onChange: (patch: { input?: string; source?: string; finalValue?: string }) => void;
}

export function SmartParameterField({
  parameterId,
  label,
  section,
  hint,
  inputDraft,
  disabled = false,
  onChange,
}: SmartParameterFieldProps) {
  const spec: SmartParameterSpec | undefined = SMART_PARAMETER_SPECS[parameterId];
  const [customMode, setCustomMode] = useState(false);

  // Parse existing draft into smart presets if possible
  const matchingPreset = spec?.presets.find(
    (p) => p.value.trim().toLowerCase() === (inputDraft.input || "").trim().toLowerCase()
  );

  return (
    <div className="space-y-2">
      {/* Smart Preset & Controls */}
      {spec ? (
        <div className="space-y-1.5 rounded-md border border-primary/20 bg-primary/5 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <Sparkles className="size-3.5" />
              <span>Smart Standard Format</span>
              {spec.unit && (
                <span className="rounded bg-primary/10 px-1.5 py-0.2 font-mono text-[10px] text-primary">
                  Unit: {spec.unit}
                </span>
              )}
            </div>

            {/* Downstream Document Badges */}
            <div className="flex items-center gap-1" title={spec.docImpact}>
              <span className="text-[10px] text-muted-foreground mr-0.5">Defines:</span>
              {spec.downstreamDocs.map((doc) => (
                <span
                  key={doc}
                  className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-foreground border border-border"
                  title={`Feeds specification directly into ${doc}`}
                >
                  {doc}
                </span>
              ))}
            </div>
          </div>

          {/* Preset Selector Dropdown */}
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <select
                disabled={disabled}
                value={matchingPreset ? matchingPreset.value : customMode ? "__custom__" : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__custom__") {
                    setCustomMode(true);
                  } else if (val) {
                    setCustomMode(false);
                    onChange({ input: val });
                  } else {
                    setCustomMode(false);
                    onChange({ input: "" });
                  }
                }}
                className="w-full rounded border border-input bg-background p-1.5 text-xs font-medium text-foreground shadow-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Select Standard Automotive / Industry Format --</option>
                {spec.presets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
                <option value="__custom__">⚙ Custom / Manual Entry...</option>
              </select>

              <button
                type="button"
                disabled={disabled}
                onClick={() => setCustomMode(!customMode)}
                className={`rounded border px-2 py-1 text-[10px] font-semibold transition ${
                  customMode
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-background text-foreground hover:bg-secondary"
                }`}
                title="Toggle manual text edit mode"
              >
                <Sliders className="size-3 inline mr-1" />
                {customMode ? "Standard" : "Custom"}
              </button>
            </div>

            {/* Brief Presets Badges Quick Pick */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {spec.presets.map((preset) => {
                const isSelected = inputDraft.input === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setCustomMode(false);
                      onChange({ input: preset.value });
                    }}
                    title={preset.description}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "bg-background/80 text-muted-foreground border border-border/60 hover:text-foreground hover:border-primary/50"
                    }`}
                  >
                    {preset.badge || preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Inputs Grid */}
      <div className="grid gap-2 md:grid-cols-3">
        <label className="grid gap-1 text-[10px] text-muted-foreground">
          <span className="flex items-center justify-between">
            <span>Project / Client Input</span>
            {spec && <span className="font-mono text-[9px] text-primary">Smart Formatted</span>}
          </span>
          <textarea
            rows={2}
            className="w-full rounded border border-input bg-background p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
            placeholder={spec?.unit ? `e.g. 12 ${spec.unit}` : "Standard value or requirement specification"}
            disabled={disabled}
            value={inputDraft.input}
            onChange={(e) => onChange({ input: e.target.value })}
          />
        </label>

        <label className="grid gap-1 text-[10px] text-muted-foreground">
          <span>Source / Client Comment</span>
          <textarea
            rows={2}
            className="w-full rounded border border-input bg-background p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
            placeholder="SOR section, email quote, tender reference, or meeting notes"
            disabled={disabled}
            value={inputDraft.source}
            onChange={(e) => onChange({ source: e.target.value })}
          />
        </label>

        <label className="grid gap-1 text-[10px] text-muted-foreground">
          <span className="flex items-center justify-between">
            <span>Agreed Baseline Value</span>
            {inputDraft.finalValue && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 text-[9px]">
                <Check className="size-2.5" /> Locked
              </span>
            )}
          </span>
          <textarea
            rows={2}
            className="w-full rounded border border-input bg-background p-2 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary"
            placeholder="Final technical baseline agreed by responsible department"
            disabled={disabled}
            value={inputDraft.finalValue}
            onChange={(e) => onChange({ finalValue: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

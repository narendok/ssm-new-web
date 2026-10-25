export type InputDraftValue = { input: string; source: string; finalValue: string };
export type InputDraftValues = Record<string, InputDraftValue>;

export function changedInputDrafts(draft: InputDraftValues, saved: InputDraftValues): InputDraftValues {
  return Object.fromEntries(Object.entries(draft).filter(([id, value]) => {
    const before = saved[id] || { input: "", source: "", finalValue: "" };
    return value.input !== before.input || value.source !== before.source || value.finalValue !== before.finalValue;
  }));
}

export function readInputDraft(raw: string | null, revision: number): { version: number; values: InputDraftValues } | undefined {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || value.revision !== revision || !Number.isInteger(value.version) || !value.values || typeof value.values !== "object" || Array.isArray(value.values)) return;
    const valid = Object.entries(value.values).every(([, row]) => row && typeof row === "object" && ["input", "source", "finalValue"].every(key => typeof (row as Record<string, unknown>)[key] === "string"));
    if (valid) return { version: value.version, values: value.values };
  } catch { /* A damaged recovery copy must never replace server data. */ }
  return undefined;
}

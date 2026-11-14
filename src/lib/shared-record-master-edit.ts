export type EditableMasterOption = { id: string; reference: string; title: string; status?: string };

export type EditableMasterLink = { id: string; existing: boolean; unresolved: boolean };

/** Resolve every stored link alias to one exact master; never pick a partial match. */
export function resolveEditableMasterLink(
  fields: Record<string, unknown>,
  options: EditableMasterOption[],
  aliases: string[],
): EditableMasterLink {
  const values = [...new Set(aliases.map(key => fields[key]).filter((value): value is string => typeof value === "string").map(value => value.trim()).filter(Boolean))];
  if (!values.length) return { id: "", existing: false, unresolved: false };

  let resolvedId = "";
  for (const value of values) {
    const matches = options.filter(option => option.id === value || option.reference === value);
    if (matches.length !== 1 || (resolvedId && resolvedId !== matches[0]!.id)) {
      return { id: "", existing: true, unresolved: true };
    }
    resolvedId = matches[0]!.id;
  }
  return { id: resolvedId, existing: true, unresolved: false };
}

/** Replace a complete alias family with the selected canonical ID and labels. */
export function replaceEditableMasterLink(
  fields: Record<string, unknown>,
  link: { id: string; reference: string; title: string } | undefined,
  aliases: { ids: string[]; references: string[]; names?: string[] },
): Record<string, unknown> {
  const next = { ...fields };
  for (const key of [...aliases.ids, ...aliases.references, ...(aliases.names || [])]) delete next[key];
  if (!link) return next;
  for (const key of aliases.ids) next[key] = link.id;
  for (const key of aliases.references) next[key] = link.reference;
  for (const key of aliases.names || []) next[key] = link.title;
  return next;
}

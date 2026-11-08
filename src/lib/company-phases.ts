import { HEXA_PHASES } from './hexa-workbook-source';
/** Fixed 0–9 keys and names from the user-supplied New Hexa workbook. */
export const COMPANY_PHASES = HEXA_PHASES;
export type CompanyPhase = (typeof COMPANY_PHASES)[number][0];
export function companyPhaseLabel(code:CompanyPhase):string {
  return `Phase ${code.slice(3)} · ${COMPANY_PHASES.find(phase=>phase[0]===code)![1]}`;
}

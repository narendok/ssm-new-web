// Suggest a reason only when the selected category has one clear default.
// Categories such as travel, parts, equipment and services need the requester’s context.
const suggestions: Record<string, string> = {
  'PCB Fabrication & Assembly': 'PCB Fabrication / Assembly / Rework',
  'Harnesses, Cables & Connectors': 'Harness & Connector Development',
  'Mechanical Prototypes & Enclosures': 'Enclosure / Mechanical Prototyping',
  'Product Certification & Compliance': 'Product Certification & Regulatory Submission',
  'Cloud Hosting & Connectivity': 'Cloud / Data / SIM Services',
  'Freight, Courier & Logistics': 'Freight / Courier / Material Movement',
  'Production Tooling & Fixtures': 'Production Tooling & Test Fixtures',
  'Training & Certifications': 'Training & Skills Development',
};
export function suggestExpensePurpose(category: string, allowedPurposes: string[]): string {
  const purpose = suggestions[category];
  return purpose && allowedPurposes.includes(purpose) ? purpose : '';
}

export function suggestExpensePurposeForStage(
  stage: string | null | undefined,
  category: string,
  allowedPurposes: string[],
): string {
  const normalized = (stage || '').toLowerCase();
  const stageNumber = normalized.match(/stage\s*[-_ ]?([1-9])/i)?.[1];
  const categoryName = category.toLowerCase();
  if (!category || !stageNumber) return suggestExpensePurpose(category, allowedPurposes);
  const isTravel = /travel|accommodation/.test(categoryName);
  const isFreight = /freight|courier|logistics/.test(categoryName);
  const isPrototypeMaterial = /component|sensor|pcb|harness|connector|mechanical|prototype|tooling|fixture|consumable|equipment/.test(categoryName);
  const isTestOrCertification = /testing|laboratory|certification|compliance|calibration/.test(categoryName);
  const isSoftware = /software|cloud|engineering|professional service/.test(categoryName);
  const stageDefault: Record<string, string> = isTravel
    ? { '1': 'Customer / Supplier / Site Visit', '2': 'Customer / Supplier / Site Visit', '3': 'Customer / Supplier / Site Visit', '4': 'Customer / Supplier / Site Visit', '5': 'Customer / Supplier / Site Visit', '6': 'Customer / Supplier / Site Visit', '7': 'Customer / Supplier / Site Visit', '8': 'Customer / Supplier / Site Visit', '9': 'Field Trials & Customer Demonstration' }
    : isFreight
      ? { '4': 'Freight / Courier / Material Movement', '5': 'Freight / Courier / Material Movement', '6': 'Freight / Courier / Material Movement', '7': 'Freight / Courier / Material Movement', '8': 'Freight / Courier / Material Movement', '9': 'Freight / Courier / Material Movement' }
      : isTestOrCertification
        ? { '4': 'Bench Testing & Design Verification', '5': 'Bench Testing & Design Verification', '6': 'Bench Testing & Design Verification', '7': 'Bench Testing & Design Verification', '8': 'Product Certification & Regulatory Submission' }
        : isSoftware
          ? { '1': 'Requirements & Feasibility Study', '2': 'Requirements & Feasibility Study', '3': 'Architecture & Proof of Concept', '4': 'Development Tools & Licences', '5': 'Pilot Build & Bring-up', '6': 'Bench Testing & Design Verification' }
          : isPrototypeMaterial
            ? { '1': 'Requirements & Feasibility Study', '2': 'Prototype Component Procurement', '3': 'Architecture & Proof of Concept', '4': 'Prototype Component Procurement', '5': 'Pilot Build & Bring-up', '6': 'Bench Testing & Design Verification', '7': 'Production Support & Quality Improvement' }
            : {};
  const mappedStagePurpose = stageDefault[stageNumber];
  if (mappedStagePurpose && allowedPurposes.includes(mappedStagePurpose)) return mappedStagePurpose;
  return suggestExpensePurpose(category, allowedPurposes);
}

/** Return a soft category suggestion from stage context; the requester must confirm it. */
export function suggestExpenseCategoryForStage(
  stage: string | null | undefined,
  requestType: string,
  categories: string[],
  serviceCategory?: string,
): string {
  const find = (pattern: RegExp) => categories.find((category) => pattern.test(category));
  if (serviceCategory && categories.includes(serviceCategory)) return serviceCategory;
  if (requestType === 'travel') return find(/travel\s*&\s*transport/i) || '';
  if (requestType === 'reimbursement') return '';
  const normalized = (stage || '').toLowerCase().replace(/[\s-]/g, '_');
  const phase = normalized.match(/tg_?0?([0-9])/)?.[1];
  if (/feasibility|enquiry/.test(normalized) || phase === '0' || phase === '1') return find(/engineering\s*&\s*professional services/i) || '';
  if (/schematic|design|development|prototype/.test(normalized) || ['2','3','4'].includes(phase || '')) return find(/electronic components|pcb fabrication|mechanical prototypes/i) || '';
  if (/pilot|bring.?up|build|manufactur/.test(normalized) || phase === '5') return find(/consumables|production tooling|equipment/i) || '';
  if (/dv.?p.?r|test|validation|certification|compliance/.test(normalized) || ['6','7'].includes(phase || '')) return find(/testing|product certification|calibration/i) || '';
  if (/service|field|warranty/.test(normalized) || ['8','9'].includes(phase || '')) return find(/maintenance/i) || find(/freight/i) || find(/travel/i) || '';
  return '';
}

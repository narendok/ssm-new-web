import { strToU8, zipSync } from "fflate";
import type { PrintableDocumentProps, TemplateSettingsProps } from "@/components/DocumentStandardViewer";
import { supportsDraftDocx, type buildDocumentDraft } from "./document-draft";

const word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageBase = "http://schemas.openxmlformats.org/package/2006";

function escapeXml(value: string) {
  return Array.from(value).filter((character) => {
    const point = character.codePointAt(0)!;
    return point === 9 || point === 10 || point === 13 ||
      (point >= 32 && point <= 0xd7ff) || (point >= 0xe000 && point <= 0xfffd) || point >= 0x10000;
  }).join("").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function paragraph(value: string, heading = false) {
  const lines = value.split(/\r\n?|\n/).map((line) => `<w:t xml:space="preserve">${escapeXml(line)}</w:t>`);
  return `<w:p><w:r>${heading ? '<w:rPr><w:b/><w:sz w:val="28"/></w:rPr>' : ""}${lines.join("<w:br/>")}</w:r></w:p>`;
}

export function buildDraftDocx(
  document: PrintableDocumentProps,
  draft: ReturnType<typeof buildDocumentDraft>,
  settings: TemplateSettingsProps,
) {
  if (!draft.supported || !supportsDraftDocx(draft.type)) throw new Error("Word export is unavailable for this template.");

  const body = [
    paragraph("DRAFT · UNISSUED", true), paragraph(document.title, true),
    paragraph(`Document ${document.documentId} · ${document.revision}`),
    paragraph(`Project ${document.project} · ${document.stage}`),
    paragraph(`Template ${draft.type} · ${draft.templateVersion} · ${draft.catalogueFamilyId ?? "Unmapped"}`),
    paragraph(draft.snapshot.classification),
    paragraph(`Source: ${draft.snapshot.source?.reference ?? "No linked source"}`),
    ...draft.sections.flatMap((section) => [
      paragraph(section.title, true),
      ...section.rows.map(([field, value, source]) => paragraph(`${field}: ${value ?? ""}${source ? ` (${source})` : ""}`)),
    ]),
    paragraph("Review and sign-off", true),
    ...(["Prepared by", "Reviewed by", "Approved by"] as const).map((label, index) => {
      const person = [document.preparedBy, document.reviewedBy, document.approvedBy][index];
      return paragraph(`${label}: ${person ? `${person.name} · ${person.role} · ${person.status} · ${person.date}` : "Pending"}`);
    }),
  ].join("");
  const contentTypes = ["document", "header", "footer"].map((part) =>
    `<Override PartName="/word/${part}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${part === "document" ? "document.main" : part}+xml"/>`,
  ).join("");
  return zipSync({
    "[Content_Types].xml": strToU8(`<Types xmlns="${packageBase}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>${contentTypes}</Types>`),
    "_rels/.rels": strToU8(`<Relationships xmlns="${packageBase}/relationships"><Relationship Id="rId1" Type="${office}/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": strToU8(`<Relationships xmlns="${packageBase}/relationships"><Relationship Id="rId1" Type="${office}/header" Target="header.xml"/><Relationship Id="rId2" Type="${office}/footer" Target="footer.xml"/></Relationships>`),
    "word/document.xml": strToU8(`<w:document xmlns:w="${word}" xmlns:r="${office}"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`),
    "word/header.xml": strToU8(`<w:hdr xmlns:w="${word}">${paragraph(settings.companyName, true)}${paragraph([settings.techCenter, settings.plantLocation].filter(Boolean).join(" · "))}</w:hdr>`),
    "word/footer.xml": strToU8(`<w:ftr xmlns:w="${word}">${paragraph(settings.confidentialityNotice)}${paragraph(settings.complianceFooter)}<w:p><w:r><w:t xml:space="preserve">DRAFT · UNISSUED · Page </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>`),
  });
}

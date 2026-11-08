import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const artifactDir = path.join(os.tmpdir(), "ssm-one-web-test-artifacts", "lifecycle");
fs.mkdirSync(artifactDir, { recursive: true });
const source = fs.readFileSync(
  new URL("../src/lib/test-auth-provision.server.ts", import.meta.url),
  "utf8",
);
const fixture = source.match(/email: "([^"]+)", password: "([^"]+)", name: "TEST Executive Admin"/);
if (!fixture) throw Error("TEST admin fixture unavailable");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5177/?signedout=1");
  await page
    .getByRole("button", { name: "Sign in to TEST workspace", exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: "TEST email", exact: true }).fill(fixture[1]);
  await page.getByLabel("TEST password", { exact: true }).fill(fixture[2]);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText("Shared TEST data", { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Settings & System", exact: true }).click();
  await page.getByRole("button", { name: "Organization & RACI Settings", exact: true }).click();
  await page.getByRole("button", { name: "lifecycle", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lifecycle stages & default tasks", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("button", { name: "Save new default revision", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Apply finalized phase and gate mapping", exact: true })
    .click();
  if ((await page.getByLabel("Task 3 title", { exact: true }).count()) === 0) {
    await page.getByRole("button", { name: "Add default task", exact: true }).click();
    await page.getByLabel("Task 3 title", { exact: true }).fill("Record intake handoff context");
    await page
      .getByLabel("Task 3 description", { exact: true })
      .fill("Link the originating opportunity and confirm the responsible intake owner.");
  }
  await page.getByRole("button", { name: "Save new default revision", exact: true }).click();
  await expect(page.getByText("Current revision:", { exact: false })).not.toContainText(
    "LC-TG-2026-11-04-v1",
  );
  await expect(page.getByLabel("Task 3 title", { exact: true })).toHaveValue(
    "Record intake handoff context",
    { timeout: 30000 },
  );
  await page.reload();
  await expect(page.getByText("Shared TEST data", { exact: true })).toBeVisible({ timeout: 30000 });
  // Expanded state persists, so the settings group may already be open.
  const settings = page.getByRole("button", { name: "Organization & RACI Settings", exact: true });
  if (!(await settings.isVisible()))
    await page.getByRole("button", { name: "Settings & System", exact: true }).click();
  await settings.click();
  await page.getByRole("button", { name: "lifecycle", exact: true }).click();
  await expect(page.getByLabel("Task 3 title", { exact: true })).toHaveValue(
    "Record intake handoff context",
    { timeout: 30000 },
  );
  await page.screenshot({
    path: path.join(artifactDir, "shared-settings.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const receiptPath = path.join(artifactDir, "upload-receipt.json");
  const resume = process.argv.includes("--reuse-only")
    ? JSON.parse(fs.readFileSync(receiptPath, "utf8"))
    : null;
  const title = resume?.title ?? `Northstar bench harness interface review ${Date.now()}`;
  let sourceProjectLabel = resume?.sourceProjectLabel;
  let dialog;
  if (!resume) {
    await page.getByRole("button", { name: "Add Record", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "New record", exact: true });
    await dialog.getByLabel("Title", { exact: true }).fill(title);
    await dialog.getByLabel("Record type", { exact: true }).selectOption("Schematic");
    await dialog.getByRole("combobox", { name: "Project", exact: true }).click();
    const projectOption = page
      .locator("[cmdk-item]:visible")
      .filter({ hasNotText: "Clear selection" })
      .first();
    sourceProjectLabel = await projectOption.innerText();
    await projectOption.click();
    const location = dialog.getByLabel("Location", { exact: true });
    if (await location.count()) await location.fill("Northstar engineering bench · fictional TEST");
    await expect(dialog.locator('input[aria-readonly="true"]')).toHaveValue(/HW_15/);
    const stream =
      "BT /F1 14 Tf 50 750 Td (Fictional TEST harness interface review - no engineering release) Tj ET";
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const [i, obj] of objects.entries()) {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    }
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n ")
      .join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({
        name: "northstar-harness-interface-review.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(pdf),
      });
    await page.route("**/storage/v1/object/upload/sign/**", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 503, body: "TEST retry verification" })
        : route.continue(),
    );
    await dialog
      .getByRole("button", { name: "Save record & upload original", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Retry original file", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await page.unroute("**/storage/v1/object/upload/sign/**");
    await dialog.getByRole("button", { name: "Retry original file", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 45000 });
    fs.writeFileSync(receiptPath, JSON.stringify({ title, sourceProjectLabel }, null, 2));
  }
  await page.getByRole("button", { name: "Reusable assets", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Reusable assets & document revisions", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Asset title", { exact: true }).fill(title);
  await dialog.getByLabel("Kind", { exact: true }).selectOption("Harness");
  const projects = await dialog
    .getByLabel("Source project", { exact: true })
    .locator("option")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({ value: n.value, text: n.textContent })).filter((n) => n.value),
    );
  const chosen = projects.find((p) => sourceProjectLabel.includes(p.text));
  if (!chosen) throw Error("Selected source project was not found in shared reuse options");
  await dialog.getByLabel("Source project", { exact: true }).selectOption(chosen.value);
  await dialog.getByLabel("Source stage", { exact: true }).fill("HW_15");
  await expect(
    dialog
      .getByLabel("Original document revision", { exact: true })
      .locator("option")
      .filter({ hasText: title }),
  ).toHaveCount(1, { timeout: 30000 });
  const original = await dialog
    .getByLabel("Original document revision", { exact: true })
    .locator("option")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({ value: n.value, text: n.textContent })).filter((n) => n.value),
    );
  const file = original.find((f) => f.text.includes(title));
  if (!file) throw Error("Verified original did not appear in the shared reuse catalog");
  await dialog.getByLabel("Original document revision", { exact: true }).selectOption(file.value);
  await dialog
    .getByLabel("Compatibility / limitations", { exact: true })
    .fill("Fictional bench evaluation only; connector mapping requires project-specific review.");
  await dialog.getByRole("button", { name: "Register draft revision", exact: true }).click();
  await expect(
    dialog.getByText("Reusable draft revision registered; stock quantities were not changed.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  await dialog
    .getByLabel("Asset revision", { exact: true })
    .selectOption({ label: `${title} · r1 · Draft` });
  for (const project of projects.slice(0, 2)) {
    await dialog.getByLabel("Consuming project", { exact: true }).selectOption(project.value);
    await dialog
      .getByLabel("Intended use and compatibility review", { exact: true })
      .fill("Evaluation link only: verify connector interface before adoption.");
    await dialog.getByRole("button", { name: "Link revision", exact: true }).click();
    await expect(dialog.getByText(/Exact revision linked for evaluation/)).toBeVisible({
      timeout: 30000,
    });
  }
  await expect(dialog.getByText(/2 consuming projects/)).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: path.join(artifactDir, "shared-reuse.png"), fullPage: true });
  console.log(
    JSON.stringify({
      errors,
      sharedSettingsPersisted: true,
      configuredIntakeTasks: 3,
      originalUpload: true,
      reusedProjects: 2,
      assetState: "Draft",
    }),
  );
} finally {
  await browser.close();
}

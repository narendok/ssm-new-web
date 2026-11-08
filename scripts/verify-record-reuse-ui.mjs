import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
const artifactDir = path.join(os.tmpdir(), "ssm-one-web-test-artifacts", "lifecycle");
const source = fs.readFileSync(
  new URL("../src/lib/test-auth-provision.server.ts", import.meta.url),
  "utf8",
);
const fixture = source.match(/email: "([^"]+)", password: "([^"]+)", name: "TEST Executive Admin"/);
if (!fixture) throw Error("TEST admin fixture unavailable");
const receipt = JSON.parse(
  fs.readFileSync(
    path.join(artifactDir, "upload-receipt.json"),
    "utf8",
  ),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
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
  const title = `Northstar reused harness design review ${Date.now()}`;
  await page.getByRole("button", { name: "Add Record", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New record", exact: true });
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog.getByLabel("Record type", { exact: true }).selectOption("Schematic");
  await dialog.getByRole("combobox", { name: "Project", exact: true }).click();
  await page
    .locator("[cmdk-item]:visible")
    .filter({ hasNotText: "Clear selection" })
    .nth(1)
    .click();
  const options = dialog.getByLabel("Reuse an existing original revision", { exact: true });
  await expect(options.locator("option").filter({ hasText: receipt.title }).first()).toBeAttached({
    timeout: 30000,
  });
  const asset = await options
    .locator("option")
    .filter({ hasText: receipt.title })
    .first()
    .getAttribute("value");
  await options.selectOption(asset);
  await dialog
    .getByLabel("Record reuse compatibility", { exact: true })
    .fill("Fictional TEST interface evaluation; connector review required before adoption.");
  await expect(dialog.locator('input[aria-readonly="true"]')).toHaveValue(/HW_15/);
  await dialog.getByRole("button", { name: "Save record & link revision", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30000 });
  await page.reload();
  await expect(page.getByText("Shared TEST data", { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: /^Records & Deliverables \(/ }).click();
  await page.getByPlaceholder("Search records and files...").fill(title);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.getByText(title, { exact: true }).click();
  await expect(page.getByText(/Reused original · revision/)).toBeVisible();
  await page.screenshot({ path: path.join(artifactDir, "record-reuse-readback.png"), fullPage: true });
  await page.getByRole("button", { name: "Open source original", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download original", exact: true })).toBeVisible({
    timeout: 30000,
  });
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download original", exact: true }).click();
  const download = await downloaded;
  const path = await download.path(),
    bytes = fs.readFileSync(path);
  if (!bytes.toString().includes("Fictional TEST harness interface review"))
    throw Error("Original downloaded content mismatch");
  console.log(
    JSON.stringify({
      errors,
      recordTitle: title,
      reuseSavedAndReloaded: true,
      originalBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }),
  );
} finally {
  await browser.close();
}

import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5177/?role=admin");
  await page
    .waitForFunction(
      () => !document.body.textContent?.includes("Opening your portal"),
      {},
      { timeout: 60000 },
    )
    .catch(() => {});
  await page.getByRole("button", { name: "Settings & System", exact: true }).click();
  await page.getByRole("button", { name: "Organization & RACI Settings", exact: true }).click();
  await page.getByRole("button", { name: "lifecycle", exact: true }).click();
  console.log(
    JSON.stringify({ errors, body: (await page.locator("body").innerText()).slice(0, 4500) }),
  );
} finally {
  await browser.close();
}

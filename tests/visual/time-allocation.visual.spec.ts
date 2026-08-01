import { expect, test, type Page } from "@playwright/test";
import { mockTimeAllocationApis } from "./fixtures/time-allocation-fixtures";

test.beforeEach(async ({ page }) => {
  await mockTimeAllocationApis(page);
});

test.afterEach(async ({ context, page }) => {
  await page.close();
  await context.close();
});

test("dashboard view", async ({ page }) => {
  await openWorkspace(page);
  await openTopLevelView(page, "Dashboard");
  await expect(page.getByRole("heading", { name: /Admin Dashboard|Project Manager Dashboard|Field Dashboard|Executive Dashboard/ })).toBeVisible();

  await expect(page).toHaveScreenshot("dashboard-view.png", {
    fullPage: true
  });
});

test("entry view", async ({ page }) => {
  await openWorkspace(page);
  await openEntryView(page);

  await expect(page).toHaveScreenshot("entry-view.png", {
    fullPage: true
  });
});

test("expanded pay item matrix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Compact touch layouts use the mobile pay item picker instead of the matrix.");

  await openWorkspace(page);
  await openEntryView(page);
  await page.getByRole("button", { name: "Expand Matrix" }).click();
  const dialog = page.getByRole("dialog");

  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveScreenshot("expanded-matrix.png");
});

test("daily report modal", async ({ page }) => {
  await openWorkspace(page);
  await openEntryView(page);
  await page.getByRole("button", { name: "Edit Daily Report" }).click();
  const dialog = page.getByRole("dialog");

  await expect(dialog.getByRole("heading", { name: "Create Daily Report" })).toBeVisible();
  await expect(dialog).toHaveScreenshot("daily-report-modal.png");
});

test("reports view", async ({ page }) => {
  await openWorkspace(page);
  await openTopLevelView(page, "Reports");
  await expect(page.getByRole("heading", { name: "Performance Reports" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pay Item Production Report" })).toBeVisible();

  await expect(page).toHaveScreenshot("reports-view.png", {
    fullPage: true
  });
});

test("admin drawer", async ({ page }) => {
  await openWorkspace(page);
  await openEntryView(page);
  await openCollapsedJobSetupIfNeeded(page);
  await page.locator(".admin-tools-drawer > summary").click();
  await expect(page.getByRole("button", { name: "Sync New Projects" })).toBeVisible();

  await expect(page).toHaveScreenshot("admin-drawer.png", {
    fullPage: true
  });
});

async function openWorkspace(page: Page) {
  await page.goto("/");
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
      nextjs-portal {
        display: none !important;
      }
    `
  });
  await expect(page.getByRole("heading", { name: "Crew Time Allocation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function openEntryView(page: Page) {
  await openTopLevelView(page, "Entry");
  await expect(page.getByRole("heading", { name: "Daily Entry" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pay Item Entry" })).toBeVisible();
}

async function openTopLevelView(page: Page, viewName: "Dashboard" | "Entry" | "Reports") {
  await page.getByRole("button", { exact: true, name: viewName }).click();
}

async function openCollapsedJobSetupIfNeeded(page: Page) {
  const collapsedJobSetup = page.getByRole("button", { name: /^Job Setup\b/ }).first();

  if (await collapsedJobSetup.isVisible()) {
    await collapsedJobSetup.click();
  }
}

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const DETAIL_ROUTE = "/game/cyberpunk-2077-1091500";

const PUBLIC_ROUTES = [
  "/",
  "/upcoming",
  "/browse",
  "/deals",
  "/genres",
  "/platforms",
  "/studios",
  "/series",
  "/search?q=cyberpunk",
  DETAIL_ROUTE,
  "/login",
  "/signup",
  "/notifications",
  "/library",
  "/watchlist",
  "/settings",
  "/profile",
] as const;

async function expectHealthyImages(page: Page) {
  await page.evaluate(async () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" });
    await new Promise((resolve) => setTimeout(resolve, 750));
  });
  const broken = await page.locator("img").evaluateAll((elements) => (elements as HTMLImageElement[])
    .filter((image) => image.complete && image.naturalWidth === 0)
    .map((image) => ({ src: image.currentSrc || image.src, alt: image.alt })));
  expect(broken, `Broken rendered images: ${JSON.stringify(broken)}`).toEqual([]);
}

for (const route of PUBLIC_ROUTES) {
  test(`${route} renders its complete semantic shell`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("main#main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Skip to content" })).toHaveCount(1);
    await expect(page).toHaveTitle(/LUDEX/);
    await expectHealthyImages(page);
    expect(pageErrors).toEqual([]);
  });
}

test("global search traps and restores keyboard focus", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Search the complete database" }).first();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Search all of LUDEX" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("#global-search")).toBeFocused();

  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((panel) => panel.contains(document.activeElement))).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("mobile navigation remains thumb-reachable and opens search", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/");

    const mobileNav = page.getByRole("navigation", { name: "Primary" }).last();
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await mobileNav.getByRole("button", { name: "Search the complete database" }).click();
    await expect(page.getByRole("dialog", { name: "Search all of LUDEX" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Search all of LUDEX" })).toBeHidden();
  } finally {
    await context.close();
  }
});

test("deal cards keep discovery on canonical IGDB-backed pages", async ({ page }) => {
  await page.goto("/deals");
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const discoveryLinks = page.locator('a[aria-label^="View "][aria-label$=" in IGDB"]');
  const count = await discoveryLinks.count();
  if (count === 0) {
    await expect(page.getByText(/The live sale feed is taking a breather|No deals match these filters/).first()).toBeVisible();
  }
  for (let index = 0; index < count; index++) {
    const href = await discoveryLinks.nth(index).getAttribute("href");
    expect(href).toMatch(/^\/(?:game|search)(?:\/|\?)/);
    expect(href).not.toContain("steampowered.com");
  }
});

for (const route of ["/", "/deals", DETAIL_ROUTE, "/login"] as const) {
  test(`${route} has no serious automated accessibility violations`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(750);
    const results = await new AxeBuilder({ page })
      // Contrast needs real visual review because translucent artwork changes
      // the computed background; every structural WCAG rule still runs here.
      .disableRules(["color-contrast"])
      .analyze();
    const blocking = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.flatMap((node) => node.target),
    }))).toEqual([]);
  });
}

import { test, expect } from "@playwright/test"

const MOCK_STIX = {
  type: "bundle",
  objects: [
    {
      type: "attack-pattern", name: "Test Technique",
      x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Windows"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1059" }],
    },
  ],
}

async function setupMockStix(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("attackmap_")) localStorage.removeItem(key)
    }
  })
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STIX) })
  )
  await page.route(/instantdb|ws.*instantdb/i, (route) => route.abort())
}

test.describe("Phase 1 — Scaffold", () => {
  test("app loads with correct title", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page).toHaveTitle(/ATT&CK Coverage/)
  })

  test("page has dark background (slate-900)", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    const body = await page.$("body")
    const bgColor = await body?.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    // slate-900 = rgb(15, 23, 42)
    expect(bgColor).toBe("rgb(15, 23, 42)")
  })

  test("workspace header renders", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("workspace-header")).toBeVisible({ timeout: 15000 })
  })

  test("ingestion panel renders with all three tabs", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    // Tabs are role="tab" — match by role to disambiguate from labels using same words
    await expect(page.getByRole("tab", { name: "Sigma" })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole("tab", { name: "Plain Text" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Manual" })).toBeVisible()
  })

  test("no critical console errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text())
    })
    await setupMockStix(page)
    await page.goto("/app")
    await page.waitForTimeout(2500)
    // Filter out known harmless errors (favicon 404, InstantDB connection retries when no app ID)
    const critical = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.toLowerCase().includes("instantdb") &&
        !e.toLowerCase().includes("websocket") &&
        !e.includes("404")
    )
    expect(critical).toHaveLength(0)
  })
})

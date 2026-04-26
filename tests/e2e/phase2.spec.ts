import { test, expect } from "@playwright/test"

// Minimal synthetic STIX fixture (avoids network dependency for most tests)
const MOCK_STIX = {
  type: "bundle",
  objects: [
    ...Array.from({ length: 12 }, (_, i) => ({
      type: "attack-pattern",
      name: `Technique ${i + 1}`,
      description: `Description for technique ${i + 1}`,
      x_mitre_deprecated: false,
      revoked: false,
      x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Windows", "Linux"],
      kill_chain_phases: [
        { kill_chain_name: "mitre-attack", phase_name: ["execution", "persistence", "discovery"][i % 3] },
      ],
      external_references: [{ source_name: "mitre-attack", external_id: `T10${String(i + 1).padStart(2, "0")}` }],
    })),
    // 3 sub-techniques under T1001
    ...Array.from({ length: 3 }, (_, i) => ({
      type: "attack-pattern",
      name: `Sub-technique ${i + 1}`,
      description: `Sub-technique description ${i + 1}`,
      x_mitre_deprecated: false,
      revoked: false,
      x_mitre_is_subtechnique: true,
      x_mitre_platforms: ["Windows"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [
        { source_name: "mitre-attack", external_id: `T1001.00${i + 1}` },
      ],
    })),
  ],
}

async function setupMockStix(page: import("@playwright/test").Page) {
  await page.addInitScript(() => localStorage.removeItem("attackmap_stix_cache"))
  await page.route("https://raw.githubusercontent.com/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_STIX),
    })
  })
}

test.describe("Phase 2 — ATT&CK Data Layer", () => {
  test("loads STIX data and shows technique count in debug banner", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")

    const banner = page.getByTestId("stix-debug-banner")
    await expect(banner).toBeVisible({ timeout: 15000 })

    const text = await banner.textContent()
    // Mock has 12 top-level + 3 sub-techniques = 15 total
    expect(text).toContain("15")
    expect(text).toContain("12")
    expect(text).toContain("3")
  })

  test("shows loading spinner before data arrives", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("attackmap_stix_cache"))
    await page.route("https://raw.githubusercontent.com/**", async (route) => {
      await new Promise((r) => setTimeout(r, 2000))
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_STIX),
      })
    })
    await page.goto("/app")
    await expect(page.getByText("Loading ATT&CK data...")).toBeVisible({ timeout: 5000 })
  })

  test("shows error when STIX fetch fails", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("attackmap_stix_cache"))
    await page.route("https://raw.githubusercontent.com/**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    )
    await page.goto("/app")
    await expect(page.getByText("Failed to load ATT&CK data")).toBeVisible({ timeout: 15000 })
  })

  test("banner arithmetic: top-level + sub = total", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")

    const banner = page.getByTestId("stix-debug-banner")
    await expect(banner).toBeVisible({ timeout: 15000 })

    const text = (await banner.textContent()) ?? ""
    const totalMatch = text.match(/(\d+)\s+techniques/)
    const topLevelMatch = text.match(/(\d+)\s+top-level/)
    const subMatch = text.match(/(\d+)\s+sub-techniques/)

    expect(totalMatch).not.toBeNull()
    expect(topLevelMatch).not.toBeNull()
    expect(subMatch).not.toBeNull()

    const total = parseInt(totalMatch![1], 10)
    const topLevel = parseInt(topLevelMatch![1], 10)
    const subs = parseInt(subMatch![1], 10)
    expect(topLevel + subs).toBe(total)
  })

  test("page has correct title and dark background", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page).toHaveTitle(/ATT&CK Coverage/)
    await expect(page.locator("body")).toHaveClass(/bg-slate-900/)
  })

  test.skip("real STIX data load (network integration — skip in offline env)", async ({ page }) => {
    // This test verifies the real STIX endpoint works when network is available
    await page.addInitScript(() => localStorage.removeItem("attackmap_stix_cache"))
    await page.goto("/app")
    const banner = page.getByTestId("stix-debug-banner")
    await expect(banner).toBeVisible({ timeout: 60000 })

    const text = await banner.textContent()
    const match = text?.match(/(\d[\d,]+)\s+techniques/)
    expect(match).not.toBeNull()
    const count = parseInt(match![1].replace(/,/g, ""), 10)
    expect(count).toBeGreaterThan(500)
  })
})

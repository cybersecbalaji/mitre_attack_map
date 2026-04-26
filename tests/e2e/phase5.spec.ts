import { test, expect } from "@playwright/test"

const MOCK_STIX = {
  type: "bundle",
  objects: [
    // Windows-only technique
    {
      type: "attack-pattern",
      name: "Windows-Only Technique",
      description: "Detailed description for the Windows-only technique. Adversaries may use this for execution.",
      x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Windows"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1059" }],
    },
    // Linux-only technique
    {
      type: "attack-pattern",
      name: "Linux-Only Technique",
      description: "Linux-only technique description.",
      x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Linux"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1100" }],
    },
    // Cross-platform
    {
      type: "attack-pattern",
      name: "Cross Platform Technique",
      description: "Cross-platform technique description.",
      x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Windows", "Linux", "macOS"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "persistence" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1078" }],
    },
    // AWS-only
    {
      type: "attack-pattern",
      name: "AWS Cloud Technique",
      description: "AWS cloud technique description.",
      x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["AWS"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "discovery" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1580" }],
    },
  ],
}

async function setupMockStix(page: import("@playwright/test").Page) {
  await page.addInitScript(() => localStorage.removeItem("attackmap_stix_cache"))
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STIX) })
  )
}

test.describe("Phase 5 — Technique Detail + Platform Filter", () => {
  test("clicking a technique opens detail sheet with description, platforms, link", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Click on T1059 cell
    await page.getByRole("button", { name: /T1059.*Windows-Only/i }).first().click()

    const sheet = page.getByTestId("technique-detail-sheet")
    await expect(sheet).toBeVisible()

    // Description
    await expect(sheet).toContainText(/Adversaries may use this/)

    // Platform badge
    await expect(sheet.getByText("Windows", { exact: true }).first()).toBeVisible()

    // ATT&CK link
    const link = page.getByTestId("attack-link")
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute("href", "https://attack.mitre.org/techniques/T1059/")
    await expect(link).toHaveAttribute("target", "_blank")
    await expect(link).toHaveAttribute("rel", /noopener/)
  })

  test("detail sheet shows mapped rules after ingestion", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Add a rule for T1059
    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059 - PowerShell Detection Rule")
    await page.getByTestId("plaintext-submit").click()

    // Wait for ingestion to complete
    await expect(page.getByTestId("ingestion-summary")).toBeVisible()

    // Click the T1059 cell
    await page.getByRole("button", { name: /T1059.*Windows-Only/i }).first().click()

    // Detail sheet should show the mapped rule
    const sheet = page.getByTestId("technique-detail-sheet")
    await expect(sheet).toBeVisible()
    await expect(sheet.getByTestId("detail-mapped-rules")).toContainText("PowerShell Detection Rule")
  })

  test("detail sheet status badge reflects coverage status", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Click an uncovered cell first
    await page.getByRole("button", { name: /T1078.*Cross Platform/i }).first().click()
    await expect(page.getByTestId("technique-status-badge")).toContainText("Not covered")
  })

  test("platform filter dropdown is in header and shows all platforms", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("workspace-header")).toBeVisible({ timeout: 15000 })

    await page.getByTestId("platform-filter-trigger").click()
    await expect(page.getByTestId("platform-filter-menu")).toBeVisible()
    await expect(page.getByTestId("platform-option-windows")).toBeVisible()
    await expect(page.getByTestId("platform-option-linux")).toBeVisible()
    await expect(page.getByTestId("platform-option-aws")).toBeVisible()
  })

  test("selecting Windows filter hides Linux-only and AWS techniques", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Initially all 4 techniques visible
    await expect(page.getByText("T1059").first()).toBeVisible()
    await expect(page.getByText("T1100").first()).toBeVisible()
    await expect(page.getByText("T1580").first()).toBeVisible()

    // Apply Windows filter
    await page.getByTestId("platform-filter-trigger").click()
    await page.getByTestId("platform-option-windows").click()
    // Close dropdown
    await page.keyboard.press("Escape")

    // Filter banner active
    await expect(page.getByTestId("platform-filter-active")).toBeVisible()

    // T1059 (Windows-only) and T1078 (cross-platform) still shown; T1100 (Linux) and T1580 (AWS) hidden
    await expect(page.getByText("T1059").first()).toBeVisible()
    await expect(page.getByText("T1078").first()).toBeVisible()
    await expect(page.locator("body")).not.toContainText("T1100")
    await expect(page.locator("body")).not.toContainText("T1580")
  })

  test("KPI bar recalculates when platform filter changes", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Total before filter — 4 techniques
    await expect(page.getByTestId("kpi-total-techniques")).toContainText("4")

    // Apply AWS filter — only T1580 matches
    await page.getByTestId("platform-filter-trigger").click()
    await page.getByTestId("platform-option-aws").click()
    await page.keyboard.press("Escape")

    // Total should drop to 1
    await expect.poll(async () =>
      await page.getByTestId("kpi-total-techniques").textContent()
    ).toMatch(/1/)
  })

  test("clear-all filter removes filter and restores all techniques", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    await page.getByTestId("platform-filter-trigger").click()
    await page.getByTestId("platform-option-windows").click()
    await page.getByTestId("platform-filter-clear").click()

    await expect(page.getByTestId("platform-filter-active")).not.toBeVisible()
    await expect(page.getByTestId("kpi-total-techniques")).toContainText("4")
  })

  test("OWASP — XSS in technique description is rendered as text", async ({ page }) => {
    const xssMock = {
      type: "bundle",
      objects: [{
        type: "attack-pattern",
        name: "Test Technique",
        description: '<img src=x onerror=alert("xss-desc")>',
        x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: false,
        x_mitre_platforms: ["Windows"],
        kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
        external_references: [{ source_name: "mitre-attack", external_id: "T9001" }],
      }],
    }
    await page.addInitScript(() => localStorage.removeItem("attackmap_stix_cache"))
    await page.route("https://raw.githubusercontent.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(xssMock) })
    )

    const dialog = page.waitForEvent("dialog", { timeout: 3000 }).catch(() => null)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Click cell to open detail
    await page.getByRole("button", { name: /T9001/i }).first().click()
    await page.waitForTimeout(1500)

    expect(await dialog).toBeNull()
  })
})

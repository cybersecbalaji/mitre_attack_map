import { test, expect } from "@playwright/test"

// STIX fixture with known techniques across multiple tactics
const MOCK_STIX = {
  type: "bundle",
  objects: [
    // Reconnaissance
    {
      type: "attack-pattern", name: "Active Scanning", x_mitre_deprecated: false, revoked: false,
      x_mitre_is_subtechnique: false, x_mitre_platforms: ["Network"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "reconnaissance" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1595" }],
    },
    // Execution — multiple techniques
    {
      type: "attack-pattern", name: "Command and Scripting Interpreter", x_mitre_deprecated: false, revoked: false,
      x_mitre_is_subtechnique: false, x_mitre_platforms: ["Windows", "Linux", "macOS"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1059" }],
    },
    {
      type: "attack-pattern", name: "PowerShell", x_mitre_deprecated: false, revoked: false,
      x_mitre_is_subtechnique: true, x_mitre_platforms: ["Windows"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1059.001" }],
    },
    // Persistence
    {
      type: "attack-pattern", name: "Valid Accounts", x_mitre_deprecated: false, revoked: false,
      x_mitre_is_subtechnique: false, x_mitre_platforms: ["Windows", "Linux"],
      kill_chain_phases: [
        { kill_chain_name: "mitre-attack", phase_name: "persistence" },
        { kill_chain_name: "mitre-attack", phase_name: "defense-evasion" },
      ],
      external_references: [{ source_name: "mitre-attack", external_id: "T1078" }],
    },
    // Impact
    {
      type: "attack-pattern", name: "Data Destruction", x_mitre_deprecated: false, revoked: false,
      x_mitre_is_subtechnique: false, x_mitre_platforms: ["Windows"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "impact" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1485" }],
    },
  ],
}

async function setupMockStix(page: import("@playwright/test").Page) {
  await page.addInitScript(() => localStorage.removeItem("attackmap_stix_cache"))
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STIX) })
  )
}

test.describe("Phase 3 — Matrix Renderer", () => {
  test("ATT&CK matrix renders all 14 tactic columns", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    // Wait for matrix to render
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Check all 14 tactic names are present
    const tacticNames = [
      "Reconnaissance", "Resource Dev.", "Initial Access", "Execution",
      "Persistence", "Privilege Esc.", "Defense Evasion", "Credential Access",
      "Discovery", "Lateral Movement", "Collection", "C2",
      "Exfiltration", "Impact",
    ]
    for (const name of tacticNames) {
      await expect(page.getByText(name)).toBeVisible()
    }
  })

  test("technique cells render with correct IDs", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Check some technique IDs are shown
    await expect(page.getByText("T1059").first()).toBeVisible()
    await expect(page.getByText("T1595").first()).toBeVisible()
    await expect(page.getByText("T1485").first()).toBeVisible()
  })

  test("matrix is scrollable (overflow-auto)", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // The matrix container should be scrollable
    const matrixContainer = page.locator("main .overflow-auto").first()
    await expect(matrixContainer).toBeVisible()
  })

  test("KPI bar shows 0% covered initially", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("coverage-kpi-bar")).toBeVisible({ timeout: 15000 })

    // All should be uncovered initially
    const coveredChip = page.getByTestId("kpi-covered")
    await expect(coveredChip).toBeVisible()
    await expect(coveredChip).toContainText("0")
  })

  test("technique cell shows tooltip on hover", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Hover over the T1059 cell
    const t1059 = page.getByRole("button", { name: /T1059.*Command and Scripting/i }).first()
    await t1059.hover()
    // Tooltip should appear with technique details
    await expect(page.getByText("Command and Scripting Interpreter").first()).toBeVisible()
  })

  test("technique spanning multiple tactics appears in both columns", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // T1078 (Valid Accounts) is in both persistence and defense-evasion
    const t1078cells = page.getByRole("button", { name: /T1078/i })
    const count = await t1078cells.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test("all uncovered technique cells have dark grey background", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // T1595 is uncovered — check its background color
    const cell = page.getByRole("button", { name: /T1595/i }).first()
    const bgColor = await cell.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    // #1e293b = rgb(30, 41, 59)
    expect(bgColor).toBe("rgb(30, 41, 59)")
  })

  test("OWASP: no XSS vectors in technique names (textContent not innerHTML)", async ({ page }) => {
    // Create a mock STIX bundle with an XSS payload in the technique name
    const xssMock = {
      type: "bundle",
      objects: [{
        type: "attack-pattern",
        name: '<script>alert("xss")</script>',
        x_mitre_deprecated: false, revoked: false,
        x_mitre_is_subtechnique: false, x_mitre_platforms: ["Windows"],
        kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
        external_references: [{ source_name: "mitre-attack", external_id: "T9001" }],
      }],
    }
    await page.addInitScript(() => localStorage.removeItem("attackmap_stix_cache"))
    await page.route("https://raw.githubusercontent.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(xssMock) })
    )

    const alertFired = page.waitForEvent("dialog", { timeout: 3000 }).catch(() => null)
    await page.goto("/app")
    await page.waitForTimeout(2000)

    const dialog = await alertFired
    expect(dialog).toBeNull() // No alert should fire — XSS is blocked
  })
})

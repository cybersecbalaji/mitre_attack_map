import { test, expect } from "@playwright/test"

const MOCK_STIX = {
  type: "bundle",
  objects: [
    {
      type: "attack-pattern", name: "Command and Scripting Interpreter",
      x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Windows", "Linux"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1059" }],
    },
    {
      type: "attack-pattern", name: "PowerShell",
      x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: true,
      x_mitre_platforms: ["Windows"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1059.001" }],
    },
    {
      type: "attack-pattern", name: "OS Credential Dumping",
      x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Windows"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "credential-access" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1003" }],
    },
    {
      type: "attack-pattern", name: "Valid Accounts",
      x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Windows"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "persistence" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T1078" }],
    },
  ],
}

async function setupMockStix(page: import("@playwright/test").Page) {
  await page.addInitScript(() => localStorage.removeItem("attackmap_stix_cache"))
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STIX) })
  )
}

test.describe("Phase 4 — Rule Ingestion + Coverage Calculation", () => {
  test("plain text ingestion colors matrix cells green for strong match", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Switch to Plain Text tab
    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059 - PowerShell Detection")
    await page.getByTestId("plaintext-submit").click()

    // Wait for matrix update — T1059 cell should now be green (#22c55e = rgb(34, 197, 94))
    const cell = page.getByRole("button", { name: /T1059.*Command/i }).first()
    await expect.poll(async () => {
      return await cell.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    }).toBe("rgb(34, 197, 94)")
  })

  test("Sigma YAML paste with attack tag colors matrix correctly", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Sigma tab is default
    const yaml = `title: Suspicious PowerShell Activity
description: Detects suspicious PS execution
tags:
  - attack.t1059.001
  - attack.execution
logsource:
  product: windows`
    await page.getByTestId("sigma-paste-input").fill(yaml)
    await page.getByTestId("sigma-paste-submit").click()

    // T1059.001 cell should be green now (need to expand T1059 to see sub-techniques)
    await expect(page.getByTestId("ingestion-summary")).toBeVisible()
    await expect(page.getByTestId("ingestion-summary")).toContainText("Parsed:")
  })

  test("ingestion summary shows X parsed, Y T-codes, Z fuzzy, W skipped", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill(
      "T1059 - PowerShell\nT1003 - LSASS\nUnmatchable random text qwerty"
    )
    await page.getByTestId("plaintext-submit").click()

    const summary = page.getByTestId("ingestion-summary")
    await expect(summary).toBeVisible()
    await expect(summary).toContainText("Parsed:")
    await expect(summary).toContainText("T-codes:")
    await expect(summary).toContainText("Fuzzy:")
    await expect(summary).toContainText("Skipped:")
  })

  test("manual entry adds rule to coverage", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    await page.getByRole("tab", { name: "Manual" }).click()
    await page.getByTestId("manual-search").fill("T1078")
    await page.getByTestId("manual-result-T1078").click()
    await page.getByTestId("manual-add").click()

    // Rules list should now have 1 item
    await expect(page.getByTestId("rules-list")).toBeVisible()
    await expect(page.getByTestId("rules-list").locator("li")).toHaveCount(1)

    // T1078 cell should be green (poll to wait for CSS transition to settle)
    const cell = page.getByRole("button", { name: /T1078.*Valid Accounts/i }).first()
    await expect.poll(
      async () => await cell.evaluate((el) => window.getComputedStyle(el).backgroundColor),
      { timeout: 5000 }
    ).toBe("rgb(34, 197, 94)")
  })

  test("KPI bar updates after ingestion", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("coverage-kpi-bar")).toBeVisible({ timeout: 15000 })

    // Initial: 0 covered
    const coveredChip = page.getByTestId("kpi-covered")
    await expect(coveredChip).toContainText("0")

    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059\nT1003")
    await page.getByTestId("plaintext-submit").click()

    // After: 2 covered
    await expect.poll(async () => await coveredChip.textContent()).toMatch(/2/)
  })

  test("clear all rules resets coverage", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059")
    await page.getByTestId("plaintext-submit").click()

    await expect(page.getByTestId("rules-list").locator("li")).toHaveCount(1)
    await page.getByTestId("clear-rules").click()
    await expect(page.getByTestId("rules-list")).not.toBeVisible()

    // KPI back to 0
    const coveredChip = page.getByTestId("kpi-covered")
    await expect(coveredChip).toContainText("0")
  })

  test("OWASP — XSS-laden rule name is rendered as text, not HTML", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    const dialogPromise = page.waitForEvent("dialog", { timeout: 3000 }).catch(() => null)

    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill('T1059 - <script>alert("xss")</script>')
    await page.getByTestId("plaintext-submit").click()

    await page.waitForTimeout(2000)
    const dialog = await dialogPromise
    expect(dialog).toBeNull() // No alert should fire
  })

  test("OWASP — Sigma YAML with !!js/function does not execute", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    const dialogPromise = page.waitForEvent("dialog", { timeout: 3000 }).catch(() => null)

    const evilYaml = `title: Evil Rule
tags:
  - attack.t1059
constructor: !!js/function 'function (){alert("PWNED")}'`
    await page.getByTestId("sigma-paste-input").fill(evilYaml)
    await page.getByTestId("sigma-paste-submit").click()

    await page.waitForTimeout(2000)
    const dialog = await dialogPromise
    expect(dialog).toBeNull()
  })
})

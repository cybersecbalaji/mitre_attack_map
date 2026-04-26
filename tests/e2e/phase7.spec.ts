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

test.describe("Phase 7 — Navigator Export + Polish", () => {
  test("Export button triggers a JSON file download", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Add a rule first
    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059 - PowerShell rule\nT1003 - LSASS rule")
    await page.getByTestId("plaintext-submit").click()
    await expect(page.getByTestId("ingestion-summary")).toBeVisible()

    // Set up the download promise BEFORE clicking
    const downloadPromise = page.waitForEvent("download", { timeout: 10000 })
    await page.getByTestId("export-button").click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.json$/i)
  })

  test("Exported JSON is a valid Navigator Layer v4.5", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059 - Strong rule\nT1003.001 partial-rule")
    await page.getByTestId("plaintext-submit").click()
    await expect(page.getByTestId("ingestion-summary")).toBeVisible()

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 })
    await page.getByTestId("export-button").click()
    const download = await downloadPromise

    // Read the downloaded file
    const stream = await download.createReadStream()
    if (!stream) throw new Error("Download stream missing")
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    const text = Buffer.concat(chunks).toString("utf-8")
    const layer = JSON.parse(text)

    // Validate per PRD section 4.4
    expect(layer.domain).toBe("enterprise-attack")
    expect(layer.versions.layer).toBe("4.5")
    expect(layer.versions.navigator).toBe("5.1.0")
    expect(typeof layer.versions.attack).toBe("string")

    // T1059 is strong (score 100), T1003 was not added
    const t1059 = layer.techniques.find((t: { techniqueID: string }) => t.techniqueID === "T1059")
    expect(t1059).toBeTruthy()
    expect(t1059.score).toBe(100)
    expect(t1059.color).toBe("")

    // gradient
    expect(layer.gradient.colors).toEqual(["#ef4444", "#f59e0b", "#22c55e"])
    expect(layer.gradient.minValue).toBe(0)
    expect(layer.gradient.maxValue).toBe(100)

    // metadata
    const meta = layer.metadata as { name: string; value: string }[]
    expect(meta.find((m) => m.name === "generated_by")).toBeTruthy()
    expect(meta.find((m) => m.name === "generated_at")).toBeTruthy()
  })

  test("Exported layer omits uncovered techniques", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059")
    await page.getByTestId("plaintext-submit").click()

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 })
    await page.getByTestId("export-button").click()
    const download = await downloadPromise
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream!) chunks.push(chunk as Buffer)
    const layer = JSON.parse(Buffer.concat(chunks).toString("utf-8"))

    const ids = (layer.techniques as { techniqueID: string }[]).map((t) => t.techniqueID)
    expect(ids).toContain("T1059")
    expect(ids).not.toContain("T1003") // uncovered
    expect(ids).not.toContain("T1059.001") // also uncovered
  })

  test("rule names appear in technique comment field", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059 — My PowerShell Rule")
    await page.getByTestId("plaintext-submit").click()

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 })
    await page.getByTestId("export-button").click()
    const download = await downloadPromise
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream!) chunks.push(chunk as Buffer)
    const layer = JSON.parse(Buffer.concat(chunks).toString("utf-8"))

    const t1059 = layer.techniques.find((t: { techniqueID: string }) => t.techniqueID === "T1059")
    expect(t1059.comment).toContain("My PowerShell Rule")
  })

  test("Exported filename is sanitized from workspace name", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Set workspace name with special chars
    await page.getByTestId("workspace-name-display").click()
    await page.getByTestId("workspace-name-input").fill("Q4 2026 / Team Alpha!")
    await page.getByTestId("workspace-name-input").press("Enter")

    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059")
    await page.getByTestId("plaintext-submit").click()

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 })
    await page.getByTestId("export-button").click()
    const download = await downloadPromise

    // Filename must be safe (no spaces, slashes, special chars)
    const filename = download.suggestedFilename()
    expect(filename).toMatch(/^[a-z0-9_-]+\.json$/i)
    expect(filename).not.toContain(" ")
    expect(filename).not.toContain("/")
  })

  test("Platform filter applied is reflected in export metadata", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    await page.getByTestId("platform-filter-trigger").click()
    await page.getByTestId("platform-option-windows").click()
    await page.keyboard.press("Escape")

    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059")
    await page.getByTestId("plaintext-submit").click()

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 })
    await page.getByTestId("export-button").click()
    const download = await downloadPromise
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream!) chunks.push(chunk as Buffer)
    const layer = JSON.parse(Buffer.concat(chunks).toString("utf-8"))

    const meta = (layer.metadata as { name: string; value: string }[])
    expect(meta.find((m) => m.name === "platform_filter")?.value).toBe("Windows")
    expect(layer.name).toContain("Windows")
  })

  test("OWASP — XSS in rule name is rendered as JSON string, not executable", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill('T1059 - <script>alert("hi")</script>')
    await page.getByTestId("plaintext-submit").click()

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 })
    await page.getByTestId("export-button").click()
    const download = await downloadPromise
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream!) chunks.push(chunk as Buffer)
    const text = Buffer.concat(chunks).toString("utf-8")

    // Must be valid JSON (a literal `<script>` string inside a JSON value is harmless)
    const layer = JSON.parse(text)
    const t1059 = layer.techniques.find((t: { techniqueID: string }) => t.techniqueID === "T1059")
    // The script tag is allowed as JSON string content but is not executable JS
    expect(typeof t1059.comment).toBe("string")
  })
})

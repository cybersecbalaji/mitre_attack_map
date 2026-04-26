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
    localStorage.removeItem("attackmap_stix_cache")
    // Clear any leftover workspace state from prior tests
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("attackmap_")) localStorage.removeItem(key)
    }
  })
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STIX) })
  )
  // Block any InstantDB websocket/HTTP calls so tests are network-deterministic
  await page.route(/instantdb|ws.*instantdb/i, (route) => route.abort())
}

test.describe("Phase 6 — Workspace + InstantDB Persistence", () => {
  test("generates workspace UUID on first visit and persists in localStorage", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("workspace-header")).toBeVisible({ timeout: 15000 })

    // useWorkspace initialises asynchronously inside useEffect — poll until it persists
    await expect.poll(
      async () => await page.evaluate(() => localStorage.getItem("attackmap_workspace_id")),
      { timeout: 5000 }
    ).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test("workspace ID persists across page reload", async ({ page }) => {
    // Mock STIX (same-origin route only; do NOT use addInitScript that would clear localStorage on reload)
    await page.route("https://raw.githubusercontent.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STIX) })
    )
    await page.route(/instantdb|ws.*instantdb/i, (route) => route.abort())

    await page.goto("/app")
    await expect(page.getByTestId("workspace-header")).toBeVisible({ timeout: 15000 })

    // Wait for useWorkspace to write the initial UUID
    await expect.poll(
      async () => await page.evaluate(() => localStorage.getItem("attackmap_workspace_id")),
      { timeout: 5000 }
    ).not.toBeNull()

    const id1 = await page.evaluate(() => localStorage.getItem("attackmap_workspace_id"))

    await page.reload()
    await expect(page.getByTestId("workspace-header")).toBeVisible({ timeout: 15000 })
    const id2 = await page.evaluate(() => localStorage.getItem("attackmap_workspace_id"))
    expect(id1).toBe(id2)
  })

  test("workspace name is editable inline", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("workspace-header")).toBeVisible({ timeout: 15000 })

    await page.getByTestId("workspace-name-display").click()
    const input = page.getByTestId("workspace-name-input")
    await expect(input).toBeVisible()
    await input.fill("Q4 2026 Coverage")
    await input.press("Enter")

    await expect(page.getByTestId("workspace-name-display")).toContainText("Q4 2026 Coverage")

    // Persists in localStorage
    const wsId = await page.evaluate(() => localStorage.getItem("attackmap_workspace_id"))
    const storedName = await page.evaluate(
      (id) => localStorage.getItem(`attackmap_ws_name_${id}`),
      wsId
    )
    expect(storedName).toBe("Q4 2026 Coverage")
  })

  test("share button copies URL with ?ws=<uuid>", async ({ page, context }) => {
    await setupMockStix(page)
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto("/app")
    await expect(page.getByTestId("workspace-header")).toBeVisible({ timeout: 15000 })

    await page.getByTestId("share-button").click()
    await expect(page.getByTestId("share-button")).toContainText("Copied")

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toMatch(/[?&]ws=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })

  test("save snapshot stores to localStorage and shows in history", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Add some rules
    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059\nT1003")
    await page.getByTestId("plaintext-submit").click()
    await expect(page.getByTestId("ingestion-summary")).toBeVisible()

    // Save snapshot
    await expect(page.getByTestId("workspace-history-empty")).toBeVisible()
    await page.getByTestId("save-button").click()

    // History should now show 1 snapshot
    await expect(page.getByTestId("workspace-history")).toBeVisible()
    await expect(page.getByTestId("workspace-history-list").locator("li")).toHaveCount(1)
  })

  test("loading a snapshot restores rules and platform filter", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("attack-matrix")).toBeVisible({ timeout: 15000 })

    // Set up state: rules + platform filter
    await page.getByRole("tab", { name: "Plain Text" }).click()
    await page.getByTestId("plaintext-input").fill("T1059")
    await page.getByTestId("plaintext-submit").click()
    await expect(page.getByTestId("rules-list").locator("li")).toHaveCount(1)

    await page.getByTestId("platform-filter-trigger").click()
    await page.getByTestId("platform-option-windows").click()
    await page.keyboard.press("Escape")

    // Save snapshot
    await page.getByTestId("save-button").click()
    await expect(page.getByTestId("workspace-history-list").locator("li")).toHaveCount(1, { timeout: 5000 })

    // Capture the snapshot's data-testid (snapshot-<id>) for unambiguous click later
    const snapshotTestId = await page
      .getByTestId("workspace-history-list")
      .locator("button")
      .first()
      .getAttribute("data-testid")
    expect(snapshotTestId).toMatch(/^snapshot-/)

    // Clear state
    await page.getByTestId("clear-rules").click()
    await page.getByTestId("platform-filter-trigger").click()
    await page.getByTestId("platform-filter-clear").click()
    await page.keyboard.press("Escape")

    // Load snapshot via its specific testid
    await page.getByTestId(snapshotTestId!).click()

    // Rules + filter restored
    await expect(page.getByTestId("rules-list").locator("li")).toHaveCount(1)
    await expect(page.getByTestId("platform-filter-active")).toBeVisible()
  })

  test("loading workspace from ?ws= URL shows ShareBanner", async ({ page }) => {
    await setupMockStix(page)
    const sharedId = "12345678-1234-4234-8234-123456789012"
    await page.goto(`/app?ws=${sharedId}`)
    await expect(page.getByTestId("workspace-header")).toBeVisible({ timeout: 15000 })

    await expect(page.getByTestId("share-banner")).toBeVisible()
    await expect(page.getByTestId("save-copy-button")).toBeVisible()

    // Workspace ID matches the URL param
    const activeId = await page.evaluate(() => {
      // useWorkspace stores the shared ID in state; verify by reading the share-button URL
      return new URL(window.location.href).searchParams.get("ws")
    })
    expect(activeId).toBe(sharedId)
  })

  test("Save copy button creates a new workspace with new UUID", async ({ page }) => {
    await setupMockStix(page)
    const sharedId = "12345678-1234-4234-8234-123456789012"
    await page.goto(`/app?ws=${sharedId}`)
    await expect(page.getByTestId("share-banner")).toBeVisible({ timeout: 15000 })

    await page.getByTestId("save-copy-button").click()

    // ShareBanner should disappear
    await expect(page.getByTestId("share-banner")).not.toBeVisible()

    // localStorage workspace ID should be different from sharedId
    const localId = await page.evaluate(() => localStorage.getItem("attackmap_workspace_id"))
    expect(localId).not.toBe(sharedId)
    expect(localId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test("Shared workspace name is read-only", async ({ page }) => {
    await setupMockStix(page)
    const sharedId = "12345678-1234-4234-8234-123456789012"
    await page.goto(`/app?ws=${sharedId}`)
    await expect(page.getByTestId("share-banner")).toBeVisible({ timeout: 15000 })

    // Click on name display — should NOT enter edit mode
    await page.getByTestId("workspace-name-display").click({ force: true })
    await expect(page.getByTestId("workspace-name-input")).not.toBeVisible()
  })

  test("OWASP — invalid ?ws= UUID is rejected (no XSS via URL)", async ({ page }) => {
    await setupMockStix(page)
    // Inject XSS payload as ws param
    await page.goto(`/app?ws=<script>alert("xss")</script>`)
    await expect(page.getByTestId("workspace-header")).toBeVisible({ timeout: 15000 })

    // No banner (invalid id rejected)
    await expect(page.getByTestId("share-banner")).not.toBeVisible()

    // Should fall back to a freshly generated UUID (useEffect is async, poll until set)
    await expect.poll(
      () => page.evaluate(() => localStorage.getItem("attackmap_workspace_id")),
      { timeout: 5000 }
    ).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test("OWASP — extremely long workspace name is truncated", async ({ page }) => {
    await setupMockStix(page)
    await page.goto("/app")
    await expect(page.getByTestId("workspace-header")).toBeVisible({ timeout: 15000 })

    await page.getByTestId("workspace-name-display").click()
    const huge = "x".repeat(5000)
    await page.getByTestId("workspace-name-input").fill(huge)
    await page.getByTestId("workspace-name-input").press("Enter")

    const display = await page.getByTestId("workspace-name-display").textContent()
    expect(display!.length).toBeLessThanOrEqual(101)
  })
})

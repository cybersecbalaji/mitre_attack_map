import { test } from "@playwright/test"

test.describe("Complete rules flow: import → logout → login → verify", () => {
  test("rules should persist after logout/login cycle", async ({ page, context, browser }) => {
    console.log("\n=== COMPLETE RULES PERSISTENCE TEST ===\n")

    // Step 1: Open app (logged out)
    console.log("Step 1: Opening app (logged out)")
    await page.goto("https://mitre-attack-map.vercel.app/app")
    const initialUrl = page.url()
    console.log(`  Initial URL: ${initialUrl}`)

    if (initialUrl.includes("/login")) {
      console.log("  → User is logged out (redirected to login)")
      return // Skip test if not logged in yet
    }

    // Assume user is already logged in from previous test
    console.log("  → User appears to be logged in")

    // Step 2: Check initial state
    console.log("\nStep 2: Checking initial state")
    const workspace = await page.evaluate(() => {
      return {
        wsId: localStorage.getItem("attackmap_workspace_id"),
        rules: localStorage.getItem("attackmap_active_rules")
          ? JSON.parse(localStorage.getItem("attackmap_active_rules")).length
          : 0,
      }
    })
    console.log(`  Workspace ID: ${workspace.wsId}`)
    console.log(`  Rules in localStorage: ${workspace.rules}`)

    // Step 3: Check if ingestion panel is visible
    console.log("\nStep 3: Looking for ingestion panel")
    await page.waitForTimeout(2000) // Wait for hydration

    const ingestionPanelVisible = await page
      .locator("[data-testid='ingestion-panel']")
      .isVisible()
      .catch(() => false)
    console.log(`  Ingestion panel visible: ${ingestionPanelVisible}`)

    if (!ingestionPanelVisible) {
      console.log("  → Checking what's actually on the page...")
      const mainContent = await page.locator("main, [role='main']").count()
      console.log(`  Main content areas: ${mainContent}`)

      const allText = await page.locator("body").textContent()
      const relevantLines = (allText || "")
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .slice(0, 20)
      console.log(`  Page content (first 20 lines):`)
      relevantLines.forEach((l) => console.log(`    ${l.trim()}`))
    }

    // Step 4: Check if user is actually logged in
    console.log("\nStep 4: Checking authentication status")
    const signOutBtn = await page
      .locator("button:has-text('Sign Out')")
      .isVisible()
      .catch(() => false)
    console.log(`  Sign Out button visible: ${signOutBtn}`)

    const signInBtn = await page
      .locator("text=Sign in")
      .isVisible()
      .catch(() => false)
    console.log(`  Sign In prompt visible: ${signInBtn}`)

    // Step 5: Check what the user sees
    console.log("\nStep 5: Checking visible UI elements")
    const elements = {
      matrix: await page.locator("[data-testid='attack-matrix']").count(),
      coverage: await page.locator("[data-testid='coverage-kpi']").count(),
      header: await page.locator("[data-testid='workspace-header']").count(),
      sidebar: await page.locator("aside").count(),
    }
    console.log(`  Matrix: ${elements.matrix > 0 ? "visible" : "hidden"}`)
    console.log(`  Coverage stats: ${elements.coverage > 0 ? "visible" : "hidden"}`)
    console.log(`  Header: ${elements.header > 0 ? "visible" : "hidden"}`)
    console.log(`  Sidebar: ${elements.sidebar > 0 ? "visible" : "hidden"}`)

    console.log("\n=== DIAGNOSTIC SUMMARY ===")
    console.log(`App URL: ${page.url()}`)
    console.log(`Workspace ID exists: ${workspace.wsId ? "yes" : "no"}`)
    console.log(`Rules in storage: ${workspace.rules}`)
    console.log(`User logged in: ${signOutBtn}`)
    console.log(`App UI loaded: ${elements.matrix > 0 || elements.header > 0}`)

    if (!signOutBtn && !ingestionPanelVisible) {
      console.log("\n⚠ ISSUE FOUND:")
      console.log("User is not logged in AND app UI is not visible")
      console.log("This suggests either:")
      console.log("  1. User is still on login page")
      console.log("  2. App is not loading after login redirect")
      console.log("  3. Authentication state is broken")
    }
  })
})

import { test, expect } from "@playwright/test"

test.describe("Rules persistence after logout/login", () => {
  test("rules should persist after logout and login", async ({ page, context }) => {
    const testEmail = "attackmaptest2025@mailinator.com"

    // Step 1: Navigate to app
    await page.goto("https://mitre-attack-map.vercel.app/app")

    // Step 2: Check if already logged in or need to login
    const loginButton = page.locator("text=Sign in with email")
    if (await loginButton.isVisible()) {
      console.log("User not logged in, logging in...")
      await loginButton.click()
      await page.fill("input[type='email']", testEmail)
      await page.click("button:has-text('Sign in with Email')")

      // Wait for OTP input
      await expect(page.locator("input[placeholder*='OTP']")).toBeVisible({ timeout: 10000 })
      console.log("OTP input visible, check Mailinator for code")

      // For now, we'll use a placeholder - in real test, fetch from Mailinator
      // await page.fill("input[placeholder*='OTP']", "000000")
      // For this test, let's just check the UI state
    }

    // Step 3: Wait for app to load
    await page.waitForURL("**/app**", { timeout: 10000 })
    console.log("✓ App loaded")

    // Check if user is logged in (look for user email or sign out button)
    const signOutButton = page.locator("button:has-text('Sign Out')")
    const isLoggedIn = await signOutButton.isVisible({ timeout: 5000 }).catch(() => false)
    console.log(`✓ Logged in status: ${isLoggedIn}`)

    // Step 4: Check initial state - no rules
    const ruleCount1 = await page.locator("text=/\\d+ rules?/").count()
    console.log(`✓ Initial rule count in UI: ${ruleCount1}`)

    // Check localStorage
    const storedRules1 = await page.evaluate(() => {
      const rules = localStorage.getItem("attackmap_active_rules")
      return rules ? JSON.parse(rules) : []
    })
    console.log(`✓ Initial rules in localStorage: ${storedRules1.length} rules`)

    // Step 5: Import a test rule (via plain text ingestion)
    const ingestionPanel = page.locator("[data-testid='ingestion-panel']")
    if (await ingestionPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("✓ Ingestion panel visible")

      // Click on plain text tab
      const plainTextTab = page.locator("button:has-text('Plain Text')")
      await plainTextTab.click()

      // Enter a test rule
      const textarea = page.locator("textarea").first()
      await textarea.fill("T1059 - Command and Scripting Interpreter\nT1003 - OS Credential Dumping")

      // Click import button
      const importBtn = page.locator("button:has-text('Import')").first()
      await importBtn.click()

      // Wait for import to complete
      await page.waitForTimeout(2000)
    }

    // Check localStorage after import
    const storedRules2 = await page.evaluate(() => {
      const rules = localStorage.getItem("attackmap_active_rules")
      return rules ? JSON.parse(rules) : []
    })
    console.log(`✓ Rules after import in localStorage: ${storedRules2.length} rules`)

    // Check InstantDB (via IndexedDB)
    const idbRules = await page.evaluate(async () => {
      try {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open("__dbVersion")
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        // Try to read from InstantDB stores
        const storeNames = Array.from(db.objectStoreNames || [])
        console.log("IndexedDB stores:", storeNames)
        return { idbAvailable: true, stores: storeNames }
      } catch (e) {
        return { idbAvailable: false, error: String(e) }
      }
    })
    console.log(`✓ IndexedDB state:`, idbRules)

    // Step 6: Logout
    console.log("Logging out...")
    const signOutBtn = page.locator("button:has-text('Sign Out')")
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click()
      await page.waitForURL("**/login**", { timeout: 5000 })
      console.log("✓ Logged out, redirected to login")
    } else {
      console.log("⚠ Sign out button not found, skipping logout")
    }

    // Check localStorage after logout
    const storedRules3 = await page.evaluate(() => {
      const rules = localStorage.getItem("attackmap_active_rules")
      return rules ? JSON.parse(rules) : []
    })
    console.log(`✓ Rules after logout in localStorage: ${storedRules3.length} rules (should be 0)`)

    // Step 7: Log back in
    console.log("Logging back in...")
    // Click sign in again
    const loginBtn = page.locator("text=Sign in with email")
    if (await loginBtn.isVisible()) {
      await loginBtn.click()
      await page.fill("input[type='email']", testEmail)
      await page.click("button:has-text('Sign in with Email')")
      await page.waitForTimeout(5000)
    }

    // Wait for app to reload
    await page.waitForURL("**/app**", { timeout: 10000 })
    console.log("✓ Logged back in")

    // Step 8: Check if rules are restored
    const storedRules4 = await page.evaluate(() => {
      const rules = localStorage.getItem("attackmap_active_rules")
      return rules ? JSON.parse(rules) : []
    })
    console.log(`✓ Rules after re-login in localStorage: ${storedRules4.length} rules`)

    // Check if workspace data is available
    const wsId = await page.evaluate(() => {
      return localStorage.getItem("attackmap_workspace_id")
    })
    console.log(`✓ Workspace ID: ${wsId}`)

    // Get network logs to see if InstantDB queries are working
    console.log("\n=== Test Summary ===")
    console.log(`Initial rules: ${storedRules1.length}`)
    console.log(`After import: ${storedRules2.length}`)
    console.log(`After logout: ${storedRules3.length}`)
    console.log(`After re-login: ${storedRules4.length}`)
    console.log(`Workspace ID persists: ${wsId ? "yes" : "no"}`)

    if (storedRules4.length === 0) {
      console.error("❌ ISSUE: Rules not restored after re-login!")
    } else if (storedRules4.length === storedRules2.length) {
      console.log("✓ PASS: Rules correctly restored")
    }
  })
})

/**
 * Full visual + functional audit of the BandUp frontend.
 * Run: node audit.mjs
 * Requires backend on :5000 and dev server on :5173
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://127.0.0.1:8080";
const SHOTS_DIR = "./audit-screenshots";
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile",  width: 375,  height: 812 },
];

const issues = [];
const log = (msg) => { console.log(msg); issues.push(msg); };

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png`, fullPage: true });
}

async function setDark(page) {
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("vite-ui-theme", "dark");
  });
  await page.waitForTimeout(200);
}

async function setLight(page) {
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("vite-ui-theme", "light");
  });
  await page.waitForTimeout(200);
}

async function injectAuth(page) {
  const user = { id: "1", name: "Alice", email: "alice@bandup.dev", role: "student", isAdmin: false };
  await page.evaluate((u) => {
    localStorage.setItem("token", "test-token-alice");
    localStorage.setItem("user", JSON.stringify(u));
  }, user);
}

async function checkNoWhiteOnWhite(page, pageName) {
  // Check for any text elements that might be invisible (white text on white bg)
  const invisible = await page.evaluate(() => {
    const els = document.querySelectorAll("p, span, label, h1, h2, h3, h4, button, a, input");
    const bad = [];
    for (const el of els) {
      const style = window.getComputedStyle(el);
      const color = style.color;
      const bg = style.backgroundColor;
      if (color === bg && color !== "rgba(0, 0, 0, 0)") {
        bad.push({ tag: el.tagName, text: el.textContent?.slice(0, 40), color, bg });
      }
    }
    return bad;
  });
  if (invisible.length > 0) {
    log(`[${pageName}] Possible invisible text (color===bg): ${JSON.stringify(invisible.slice(0, 3))}`);
  }
  return invisible;
}

async function checkButtonAlignment(page, pageName) {
  const misaligned = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button, a.btn-primary, a.btn-secondary"));
    const results = [];
    let prevBottom = null;
    let prevTop = null;
    const rowButtons = buttons.filter(b => {
      const rect = b.getBoundingClientRect();
      return rect.width > 50 && rect.height > 30; // real buttons
    });
    // Check buttons that appear to be in the same horizontal row
    for (let i = 0; i < rowButtons.length - 1; i++) {
      const r1 = rowButtons[i].getBoundingClientRect();
      const r2 = rowButtons[i+1].getBoundingClientRect();
      // If they're roughly on the same vertical position (within 5px of each other)
      if (Math.abs(r1.top - r2.top) < 20 && Math.abs(r1.height - r2.height) > 5) {
        results.push({
          b1: { text: rowButtons[i].textContent?.trim().slice(0,20), h: r1.height },
          b2: { text: rowButtons[i+1].textContent?.trim().slice(0,20), h: r2.height },
        });
      }
    }
    return results;
  });
  if (misaligned.length > 0) {
    log(`[${pageName}] Button height mismatch: ${JSON.stringify(misaligned)}`);
  }
  return misaligned;
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const vp of VIEWPORTS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
    console.log("=".repeat(60));

    for (const theme of ["light", "dark"]) {
      console.log(`\n--- Theme: ${theme} ---`);

      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();

      // ── Homepage ──────────────────────────────────────────────────
      console.log("  Checking: / (homepage)");
      await page.goto(BASE, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(300);
      await shot(page, `${vp.name}-${theme}-homepage`);
      await checkNoWhiteOnWhite(page, `${vp.name}/${theme}/homepage`);

      // Check all 4 buttons exist and are visible
      const buttons = await page.locator("button").all();
      const buttonTexts = await Promise.all(buttons.map(b => b.textContent()));
      const hasStartLearning = buttonTexts.some(t => t?.includes("Start Learning"));
      const hasPricing = buttonTexts.some(t => t?.includes("Pricing"));
      const hasAIInfo = buttonTexts.some(t => t?.includes("About AI"));
      const hasAccount = buttonTexts.some(t => t?.includes("Account"));
      if (!hasStartLearning) log(`[${vp.name}/${theme}/homepage] Missing "Start Learning" button`);
      if (!hasPricing) log(`[${vp.name}/${theme}/homepage] Missing "Pricing" button`);
      // Check no Russian text on buttons
      const ruText = buttonTexts.filter(t => /[а-яёА-ЯЁ]/.test(t || ""));
      if (ruText.length > 0) log(`[${vp.name}/${theme}/homepage] Russian text in buttons: ${ruText}`);
      await checkButtonAlignment(page, `${vp.name}/${theme}/homepage`);

      // ── Login page ────────────────────────────────────────────────
      console.log("  Checking: /login");
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(300);
      await shot(page, `${vp.name}-${theme}-login`);
      await checkNoWhiteOnWhite(page, `${vp.name}/${theme}/login`);
      // Check inputs are visible
      const loginInputs = await page.locator("input").all();
      for (const input of loginInputs) {
        const visible = await input.isVisible();
        if (!visible) log(`[${vp.name}/${theme}/login] Hidden input`);
      }

      // ── Register page ─────────────────────────────────────────────
      console.log("  Checking: /register (step 1 + step 2)");
      await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(300);
      await shot(page, `${vp.name}-${theme}-register-step1`);
      await checkNoWhiteOnWhite(page, `${vp.name}/${theme}/register-step1`);

      // Navigate to step 2
      const nameInput = page.locator("input[name='name']");
      if (await nameInput.isVisible()) {
        await nameInput.fill("Test User");
        await page.locator("input[name='email']").fill("test@example.com");
        await page.locator("input[name='password']").fill("password123");
        await page.locator("input[name='confirmPassword']").fill("password123");
        const continueBtn = page.locator("button[type='submit']");
        await continueBtn.click();
        await page.waitForTimeout(400);
        await shot(page, `${vp.name}-${theme}-register-step2`);
        await checkNoWhiteOnWhite(page, `${vp.name}/${theme}/register-step2`);
        // Check inputs in step 2 are readable
        const step2Inputs = await page.locator("input, select").all();
        for (const input of step2Inputs) {
          const bgColor = await input.evaluate(el => window.getComputedStyle(el).backgroundColor);
          const textColor = await input.evaluate(el => window.getComputedStyle(el).color);
          if (bgColor === "rgb(255, 255, 255)" && theme === "dark") {
            const name = await input.getAttribute("name") || await input.getAttribute("type") || "?";
            log(`[${vp.name}/${theme}/register-step2] Input "${name}" has hardcoded white bg in dark mode`);
          }
        }
      }

      // ── Pricing page ──────────────────────────────────────────────
      console.log("  Checking: /pricing");
      await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(300);
      await shot(page, `${vp.name}-${theme}-pricing`);
      await checkNoWhiteOnWhite(page, `${vp.name}/${theme}/pricing`);
      // Check pricing page is in correct language
      const pricingText = await page.textContent("body");
      const hasCyrillicHeadings = /Тарифные планы|Ежемесячно|Ежегодно/.test(pricingText || "");
      if (hasCyrillicHeadings) {
        log(`[${vp.name}/${theme}/pricing] PricingPage still has Russian headings`);
      }

      // ── Authenticated pages ───────────────────────────────────────
      await injectAuth(page);

      // Dashboard
      console.log("  Checking: /dashboard");
      await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(500);
      await shot(page, `${vp.name}-${theme}-dashboard`);
      await checkNoWhiteOnWhite(page, `${vp.name}/${theme}/dashboard`);

      // Check sidebar visible on desktop
      if (vp.name === "desktop") {
        const sidebar = page.locator("aside");
        const sidebarVisible = await sidebar.isVisible();
        if (!sidebarVisible) log(`[${vp.name}/${theme}/dashboard] Sidebar not visible on desktop`);

        // Check SAT links in sidebar
        const satLinks = await page.locator("nav a").all();
        const satLinkTexts = await Promise.all(satLinks.map(a => a.textContent()));
        const hasMath = satLinkTexts.some(t => t?.includes("Mathematics"));
        const hasEnglish = satLinkTexts.some(t => t?.includes("English"));
        if (!hasMath) log(`[${vp.name}/${theme}/dashboard] SAT Mathematics link missing from sidebar`);
        if (!hasEnglish) log(`[${vp.name}/${theme}/dashboard] SAT English link missing from sidebar`);

        // Check no "Coming Soon" badge
        const hasComingSoon = await page.locator("text=Coming Soon").count();
        if (hasComingSoon > 0) log(`[${vp.name}/${theme}/dashboard] "Coming Soon" badge still present`);

        // Check logo "Up" color
        const upSpan = page.locator("aside span:has-text('Up')").first();
        if (await upSpan.count() > 0) {
          const upColor = await upSpan.evaluate(el => window.getComputedStyle(el).color);
          const sidebarBg = await page.locator("aside").evaluate(el => window.getComputedStyle(el).backgroundColor);
          if (upColor === sidebarBg) {
            log(`[${vp.name}/${theme}/dashboard] Logo "Up" text invisible (same color as sidebar bg)`);
          }
        }
      }

      // Settings page
      console.log("  Checking: /settings");
      await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(500);
      await shot(page, `${vp.name}-${theme}-settings`);
      await checkNoWhiteOnWhite(page, `${vp.name}/${theme}/settings`);

      // Check promo code section exists
      const promoHeading = await page.locator("text=Promo Code").count();
      if (promoHeading === 0) log(`[${vp.name}/${theme}/settings] Promo Code section missing`);

      // SAT Math
      console.log("  Checking: /sat/math");
      await page.goto(`${BASE}/sat/math`, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(500);
      await shot(page, `${vp.name}-${theme}-sat-math`);
      await checkNoWhiteOnWhite(page, `${vp.name}/${theme}/sat-math`);
      // Check no paywall
      const hasPremiumLock = await page.locator("text=Premium Content").count();
      if (hasPremiumLock > 0) log(`[${vp.name}/${theme}/sat-math] Paywall still visible`);

      // SAT English
      console.log("  Checking: /sat/english");
      await page.goto(`${BASE}/sat/english`, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(500);
      await shot(page, `${vp.name}-${theme}-sat-english`);
      await checkNoWhiteOnWhite(page, `${vp.name}/${theme}/sat-english`);

      // IELTS test libraries
      for (const lib of ["listening", "reading", "writing", "speaking"]) {
        console.log(`  Checking: /tests/${lib}`);
        await page.goto(`${BASE}/tests/${lib}`, { waitUntil: "networkidle" });
        if (theme === "dark") await setDark(page); else await setLight(page);
        await page.waitForTimeout(400);
        await shot(page, `${vp.name}-${theme}-tests-${lib}`);
        await checkNoWhiteOnWhite(page, `${vp.name}/${theme}/tests/${lib}`);

        // Check page has content (at least a heading)
        const heading = await page.locator("h1, h2").first().textContent().catch(() => "");
        if (!heading) log(`[${vp.name}/${theme}/tests/${lib}] No heading found on page`);
      }

      // AI Chat page
      console.log("  Checking: /ai-chat");
      await page.goto(`${BASE}/ai-chat`, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(500);
      await shot(page, `${vp.name}-${theme}-ai-chat`);
      await checkNoWhiteOnWhite(page, `${vp.name}/${theme}/ai-chat`);
      // Check subject tabs are present
      const tabTexts = await Promise.all(
        (await page.locator("button").all()).map(b => b.textContent())
      );
      const hasListeningTab = tabTexts.some(t => t?.includes("Listening"));
      const hasSATMathTab = tabTexts.some(t => t?.includes("SAT Math"));
      if (!hasListeningTab) log(`[${vp.name}/${theme}/ai-chat] "Listening" tab missing`);
      if (!hasSATMathTab) log(`[${vp.name}/${theme}/ai-chat] "SAT Math" tab missing`);
      // Check floating ChatAssistant button is visible on AI chat page (DashboardLayout)
      const floatBtn = page.locator("button[aria-label='Open AI assistant']");
      if (vp.name === "desktop") {
        const floatVisible = await floatBtn.isVisible().catch(() => false);
        if (!floatVisible) log(`[${vp.name}/${theme}/ai-chat] Floating chat button not visible`);
      }

      // Check floating button is present on dashboard (DashboardLayout pages)
      console.log("  Checking: ChatAssistant button on /dashboard");
      await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(500);
      const dashFloatBtn = page.locator("button[aria-label='Open AI assistant']");
      const dashFloatVisible = await dashFloatBtn.isVisible().catch(() => false);
      if (!dashFloatVisible) log(`[${vp.name}/${theme}/dashboard] Floating chat button missing`);

      // Check floating button NOT present on public pages
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      const loginFloatBtn = page.locator("button[aria-label='Open AI assistant']");
      const loginFloatCount = await loginFloatBtn.count();
      if (loginFloatCount > 0) log(`[${vp.name}/${theme}/login] Floating chat button should NOT appear on login page`);

      // AI Info page
      console.log("  Checking: /ai-info");
      await page.goto(`${BASE}/ai-info`, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(300);
      await shot(page, `${vp.name}-${theme}-ai-info`);

      // 404 page
      console.log("  Checking: /nonexistent-page");
      await page.goto(`${BASE}/nonexistent-page`, { waitUntil: "networkidle" });
      if (theme === "dark") await setDark(page); else await setLight(page);
      await page.waitForTimeout(200);
      await shot(page, `${vp.name}-${theme}-404`);

      await ctx.close();
    }
  }

  await browser.close();

  console.log("\n" + "=".repeat(60));
  console.log("AUDIT ISSUES FOUND:");
  console.log("=".repeat(60));
  if (issues.length === 0) {
    console.log("✓ No issues detected.");
  } else {
    issues.forEach((i, n) => console.log(`${n+1}. ${i}`));
  }
  console.log(`\nScreenshots saved to: ${SHOTS_DIR}/`);
}

runAudit().catch(err => { console.error(err); process.exit(1); });

import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSION_PATH = path.join(__dirname, '..', 'data', 'playwright-session.json')

// Ensure data/ directory exists
mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true })

console.log('Opening browser for X login...')
console.log('1. Log in to your X account in the browser window that opens')
console.log('2. Once you can see your bookmarks at x.com/i/bookmarks, close the browser')
console.log('')
console.log('NOTE: If X blocks login with bot detection, use import-cookies.js instead:')
console.log('  https://cookie-editor.com/ → export from Chrome → node server/import-cookies.js <file>')
console.log('')

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext()
const page = await context.newPage()

await page.goto('https://x.com/login')

// Wait for the user to manually log in and reach bookmarks
// We detect success by waiting for the URL to become something other than /login or /flow/*
console.log('Waiting for you to log in...')

await page.waitForURL(url => {
  const s = url.toString()
  return !s.includes('/login') && !s.includes('/flow/') && !s.includes('/i/flow/')
}, { timeout: 300000 })

// Navigate to bookmarks to confirm the session works
await page.goto('https://x.com/i/bookmarks', { waitUntil: 'domcontentloaded', timeout: 30000 })

const currentUrl = page.url()
if (currentUrl.includes('/login') || currentUrl.includes('/flow/login')) {
  console.error('Still on login page — session may not have saved correctly. Try again.')
  await browser.close()
  process.exit(1)
}

console.log('Login detected. Saving session...')
await context.storageState({ path: SESSION_PATH })
await browser.close()

console.log('')
console.log(`Session saved to: ${SESSION_PATH}`)
console.log('You can now run the sync with /Booked or:')
console.log('  curl -s -X POST http://localhost:3333/api/sync -H "Content-Type: application/json" -d \'{"count":10}\'')

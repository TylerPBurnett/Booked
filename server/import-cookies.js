/**
 * Convert a Cookie-Editor JSON export → Playwright storageState
 *
 * Usage:
 *   node server/import-cookies.js ~/Downloads/cookies.json
 *
 * How to export cookies from Chrome:
 *   1. Install Cookie-Editor extension: https://cookie-editor.com/
 *   2. Go to https://x.com (make sure you're logged in)
 *   3. Click the Cookie-Editor icon → Export → Export as JSON
 *   4. Save the file, then run this script with its path
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSION_PATH = path.join(__dirname, '..', 'data', 'playwright-session.json')

const cookieFile = process.argv[2]
if (!cookieFile) {
  console.error('Usage: node server/import-cookies.js <path-to-cookies.json>')
  console.error('')
  console.error('Export cookies from Chrome:')
  console.error('  1. Install Cookie-Editor: https://cookie-editor.com/')
  console.error('  2. Go to https://x.com (logged in)')
  console.error('  3. Cookie-Editor icon → Export → Export as JSON')
  process.exit(1)
}

let raw
try {
  raw = JSON.parse(readFileSync(cookieFile, 'utf8'))
} catch (e) {
  console.error(`Could not read or parse ${cookieFile}: ${e.message}`)
  process.exit(1)
}

// Cookie-Editor exports an array of cookie objects.
// Playwright storageState expects the same fields but slightly different defaults.
const cookies = raw.map(c => ({
  name: c.name,
  value: c.value,
  domain: c.domain,
  path: c.path || '/',
  expires: c.expirationDate ? Math.round(c.expirationDate) : -1,
  httpOnly: c.httpOnly || false,
  secure: c.secure || false,
  sameSite: normalizeSameSite(c.sameSite)
}))

function normalizeSameSite(val) {
  if (!val) return 'None'
  const v = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
  return ['Strict', 'Lax', 'None'].includes(v) ? v : 'None'
}

const storageState = { cookies, origins: [] }

mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true })
writeFileSync(SESSION_PATH, JSON.stringify(storageState, null, 2))

console.log(`Imported ${cookies.length} cookies from ${cookieFile}`)
console.log(`Session saved to: ${SESSION_PATH}`)
console.log('')
console.log('You can now sync your bookmarks:')
console.log('  /x-bookmarks --count=10')

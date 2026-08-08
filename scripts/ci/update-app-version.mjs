#!/usr/bin/env node
/**
 * Release Automation — regenerates public/app-version.json.
 *
 * This does NOT invent a new versioning system. It is a thin writer that
 * keeps every field src/lib/update/types.ts (validateAppVersionConfig)
 * requires, sourcing the values that changed on a release
 * (versionName/versionCode/releaseDate/apkDownloadUrl/apkSizeMB) from CI
 * environment variables, and preserving every other existing field
 * (minimumSupportedVersion, minimumSupportedVersionCode, forceUpdate,
 * releaseNotes) from the current file unless explicitly overridden.
 *
 * Usage (see .github/workflows/release.yml):
 *   node scripts/ci/update-app-version.mjs \
 *     --version 1.0.42 \
 *     --version-code 42 \
 *     --apk-url https://github.com/OWNER/REPO/releases/download/v1.0.42/rentivo-v1.0.42.apk \
 *     --apk-path ./rentivo-v1.0.42.apk \
 *     --notes "Release notes line 1" --notes "Release notes line 2"
 *
 * Never touches minimumSupportedVersion / minimumSupportedVersionCode /
 * forceUpdate — those are deliberate, manual product decisions (e.g. "force
 * everyone below 1.0.30 to update"), not something a routine release should
 * silently change. Edit public/app-version.json by hand for that.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_VERSION_PATH = path.join(__dirname, '..', '..', 'public', 'app-version.json')

function parseArgs(argv) {
  const out = { notes: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--version') out.version = argv[++i]
    else if (a === '--version-code') out.versionCode = argv[++i]
    else if (a === '--apk-url') out.apkUrl = argv[++i]
    else if (a === '--apk-path') out.apkPath = argv[++i]
    else if (a === '--notes') out.notes.push(argv[++i])
    else throw new Error(`Unknown argument: ${a}`)
  }
  return out
}

function fail(msg) {
  console.error(`[update-app-version] ERROR: ${msg}`)
  process.exit(1)
}

const args = parseArgs(process.argv.slice(2))

if (!args.version) fail('--version is required (e.g. 1.0.42)')
if (!args.versionCode || Number.isNaN(Number(args.versionCode))) fail('--version-code must be a number')
if (!args.apkUrl) fail('--apk-url is required')
try {
  // eslint-disable-next-line no-new
  new URL(args.apkUrl)
} catch {
  fail(`--apk-url is not a valid absolute URL: "${args.apkUrl}"`)
}

let current
try {
  current = JSON.parse(readFileSync(APP_VERSION_PATH, 'utf8'))
} catch (e) {
  fail(`could not read/parse existing ${APP_VERSION_PATH}: ${e.message}`)
}

// Preserve every existing required field; only overwrite what a release
// actually changes. This keeps validateAppVersionConfig() happy and keeps
// forceUpdate/minimumSupportedVersion as deliberate manual decisions.
const required = [
  'minimumSupportedVersion',
  'minimumSupportedVersionCode',
  'forceUpdate',
]
for (const key of required) {
  if (!(key in current)) {
    fail(`existing app-version.json is missing required field "${key}" — refusing to write a file the app can't validate`)
  }
}

let apkSizeMB = current.apkSizeMB
if (args.apkPath) {
  try {
    const bytes = statSync(args.apkPath).size
    apkSizeMB = Math.round((bytes / (1024 * 1024)) * 10) / 10
  } catch (e) {
    fail(`could not stat APK at ${args.apkPath} to compute apkSizeMB: ${e.message}`)
  }
}

const updated = {
  ...current,
  latestVersion: args.version,
  versionCode: Number(args.versionCode),
  minimumSupportedVersion: current.minimumSupportedVersion,
  minimumSupportedVersionCode: current.minimumSupportedVersionCode,
  forceUpdate: current.forceUpdate,
  releaseDate: new Date().toISOString().slice(0, 10),
  apkDownloadUrl: args.apkUrl,
  apkSizeMB,
  releaseNotes: args.notes.length > 0 ? args.notes : current.releaseNotes,
}

writeFileSync(APP_VERSION_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8')
console.log(`[update-app-version] wrote ${APP_VERSION_PATH}`)
console.log(JSON.stringify(updated, null, 2))

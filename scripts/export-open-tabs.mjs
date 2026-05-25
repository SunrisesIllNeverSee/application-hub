import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const inboxRoot = path.join(repoRoot, 'qaapplication', 'inbox')
const supportedBrowsers = [
  { key: 'safari', appName: 'Safari' },
  { key: 'chrome', appName: 'Google Chrome' },
]

function parseArgs(argv) {
  const args = { browser: null, out: null, stdout: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--browser' && argv[i + 1]) {
      args.browser = String(argv[++i]).toLowerCase()
      continue
    }
    if (arg === '--out' && argv[i + 1]) {
      args.out = argv[++i]
      continue
    }
    if (arg === '--stdout') {
      args.stdout = true
    }
  }
  return args
}

function escapeAppleScriptString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildAppleScript(appName) {
  const escapedApp = escapeAppleScriptString(appName)
  return `
on run
  set outText to ""
  tell application "${escapedApp}"
    if not (it is running) then error "Browser is not running: ${escapedApp}"
    set windowCount to count of windows
    repeat with windowIndex from 1 to windowCount
      set outText to outText & "===WINDOW===" & windowIndex & return
      repeat with t in tabs of window windowIndex
        set outText to outText & (name of t) & "<<<TAB>>>" & (URL of t) & return
      end repeat
      set outText to outText & return
    end repeat
  end tell
  return outText
end run
`.trim()
}

function runAppleScript(appName) {
  const script = buildAppleScript(appName)
  const result = spawnSync('osascript', ['-'], {
    input: script,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || '').trim() || `Failed to read tabs from ${appName}`)
  }

  return String(result.stdout || '')
}

function parseAppleScriptOutput(text) {
  const windows = []
  const lines = String(text || '')
    .split(/\r\n|\r|\n/)
    .map((line) => line.trimEnd())

  let current = null

  for (const line of lines) {
    if (!line) continue
    if (line.startsWith('===WINDOW===')) {
      const index = Number(line.replace('===WINDOW===', '')) || windows.length + 1
      current = { index, tabs: [] }
      windows.push(current)
      continue
    }

    if (!current) continue

    const parts = line.split('<<<TAB>>>')
    const title = (parts[0] || '').trim() || 'Untitled tab'
    const url = (parts[1] || '').trim()
    current.tabs.push({ title, url })
  }

  return windows
}

function summarizeWindows(windows, browserLabel) {
  const lines = [
    '---',
    'source: open-tabs',
    'captured_at: ' + new Date().toISOString(),
    'browser: ' + browserLabel,
    'window_count: ' + windows.length,
    'tab_count: ' + windows.reduce((count, win) => count + win.tabs.length, 0),
    '---',
    '',
    '# Open Tabs',
    '',
  ]

  const domains = new Map()

  windows.forEach((win) => {
    lines.push('## Window ' + win.index)
    lines.push('')
    win.tabs.forEach((tab, idx) => {
      let hostname = ''
      try {
        hostname = new URL(tab.url).hostname
      } catch {}
      if (hostname) domains.set(hostname, (domains.get(hostname) || 0) + 1)

      const title = tab.title || 'Untitled tab'
      const url = tab.url || ''
      lines.push((idx + 1) + '. [' + title + '](' + url + ')')
      if (hostname) lines.push('   - host: ' + hostname)
    })
    lines.push('')
  })

  if (domains.size) {
    lines.push('## Host Summary')
    lines.push('')
    Array.from(domains.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([host, count]) => {
        lines.push('- ' + host + ': ' + count)
      })
    lines.push('')
  }

  return lines.join('\n').trim() + '\n'
}

async function writeOutput(markdown, outPath) {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, markdown, 'utf8')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const browsers = args.browser
    ? supportedBrowsers.filter((entry) => entry.key === args.browser)
    : supportedBrowsers

  if (!browsers.length) {
    throw new Error(`Unsupported browser "${args.browser}". Try safari or chrome.`)
  }

  let windows = null
  let label = null
  let usedBrowser = null
  let lastError = null

  for (const browser of browsers) {
    try {
      const output = runAppleScript(browser.appName)
      windows = parseAppleScriptOutput(output)
      label = browser.appName
      usedBrowser = browser.key
      break
    } catch (error) {
      lastError = error
    }
  }

  if (!windows) {
    throw lastError || new Error('Unable to read open tabs from supported browsers.')
  }

  const markdown = summarizeWindows(windows, label)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `open-tabs-${usedBrowser}-${timestamp}.md`
  const outPath = args.out
    ? path.resolve(repoRoot, args.out)
    : path.join(inboxRoot, filename)

  await writeOutput(markdown, outPath)

  if (args.stdout) {
    process.stdout.write(markdown)
  }

  console.log(`Saved ${windows.reduce((count, win) => count + win.tabs.length, 0)} tabs to ${path.relative(repoRoot, outPath)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

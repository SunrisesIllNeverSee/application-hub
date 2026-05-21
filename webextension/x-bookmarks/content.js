function cleanText(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeUrl(url) {
  try {
    return new URL(url, location.origin).href
  } catch {
    return null
  }
}

function extractHandle(userText) {
  const text = cleanText(userText)
  const handle = text.match(/@[A-Za-z0-9_]{1,15}/)?.[0] || null
  const displayName = handle ? cleanText(text.replace(handle, '')) || null : text || null
  return { displayName, handle }
}

function extractTweetText(article) {
  const textNode = article.querySelector('[data-testid="tweetText"]')
  if (textNode) return cleanText(textNode.innerText)

  const blocks = Array.from(article.querySelectorAll('div[lang]'))
    .map((node) => cleanText(node.innerText))
    .filter(Boolean)
  return blocks.join('\n\n')
}

function extractBookmarks() {
  const nodes = Array.from(document.querySelectorAll('article'))
    .filter((article) => article.querySelector('a[href*="/status/"]'))

  const seen = new Set()
  const items = []

  nodes.forEach((article, index) => {
    const statusLink = article.querySelector('a[href*="/status/"]')
    const url = normalizeUrl(statusLink?.getAttribute('href'))
    if (!url || seen.has(url)) return
    seen.add(url)

    const userNameText = cleanText(article.querySelector('[data-testid="User-Name"]')?.innerText || '')
    const { displayName, handle } = extractHandle(userNameText)
    const text = extractTweetText(article)
    const postedAt = article.querySelector('time')?.getAttribute('datetime') || null

    items.push({
      page_index: items.length + 1,
      source_url: url,
      display_name: displayName,
      handle,
      text,
      posted_at: postedAt,
      extracted_from: location.href,
      raw_user_text: userNameText || null,
    })
  })

  return items
}

function sortItems(items, sortMode) {
  const copy = [...items]
  if (sortMode === 'author') {
    return copy.sort((a, b) => (a.display_name || a.handle || '').localeCompare(b.display_name || b.handle || ''))
  }
  if (sortMode === 'newest') {
    return copy.sort((a, b) => String(b.posted_at || '').localeCompare(String(a.posted_at || '')))
  }
  if (sortMode === 'oldest') {
    return copy.sort((a, b) => String(a.posted_at || '').localeCompare(String(b.posted_at || '')))
  }
  return copy
}

function blockquote(text) {
  return cleanText(text)
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

function buildMarkdown(items, sortMode) {
  const header = [
    '---',
    'source: x-bookmarks',
    `captured_at: ${new Date().toISOString()}`,
    `page_url: ${location.href}`,
    `bookmark_count: ${items.length}`,
    `sort_mode: ${sortMode}`,
    '---',
    '',
    '# X Bookmarks',
    '',
  ]

  const body = items.flatMap((item, index) => {
    const titleBits = [
      item.display_name || 'Unknown author',
      item.handle ? `(${item.handle})` : null,
    ].filter(Boolean)

    const lines = [
      `## ${index + 1}. ${titleBits.join(' ')}`,
      '',
      `- url: ${item.source_url}`,
    ]
    if (item.posted_at) lines.push(`- posted_at: ${item.posted_at}`)
    if (item.raw_user_text) lines.push(`- user_text: ${item.raw_user_text}`)
    lines.push(`- page_index: ${item.page_index}`)
    lines.push('')
    if (item.text) {
      lines.push(blockquote(item.text))
      lines.push('')
    }
    lines.push(`[Open on X](${item.source_url})`)
    lines.push('')
    return lines
  })

  return [...header, ...body].join('\n').trim() + '\n'
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'XBM_COLLECT') return false

  const sortMode = message.sortMode || 'page'
  const items = sortItems(extractBookmarks(), sortMode)
  const markdown = buildMarkdown(items, sortMode)
  const json = {
    source: 'x-bookmarks',
    captured_at: new Date().toISOString(),
    page_url: location.href,
    bookmark_count: items.length,
    sort_mode: sortMode,
    items,
  }

  sendResponse({
    ok: true,
    items,
    markdown,
    json,
  })
  return false
})

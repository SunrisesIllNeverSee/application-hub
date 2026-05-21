// ==UserScript==
// @name         X Bookmarks Exporter (Safari Compatible)
// @namespace    https://applicationhub.app
// @version      0.1.0
// @description  Export loaded X / Twitter bookmarks as Markdown or JSON for local sorting
// @author       Application Hub
// @license      MIT
// @match        https://x.com/i/bookmarks*
// @match        https://twitter.com/i/bookmarks*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  'use strict';

  var STORAGE_KEY = 'x_bookmarks_export_mode';
  var MENU_ID = 'x-bookmarks-exporter-menu';
  var TOAST_ID_PREFIX = 'x-bookmarks-toast-';

  function gmAddStyle(css) {
    if (typeof GM_addStyle === 'function') GM_addStyle(css);
    else {
      var style = document.createElement('style');
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  function storageGet(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw == null ? fallback : raw;
    } catch (error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {}
  }

  function showToast(message, isError) {
    var toast = document.createElement('div');
    toast.id = TOAST_ID_PREFIX + Date.now();
    toast.textContent = message;
    toast.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:20px',
      'z-index:2147483647',
      'background:' + (isError ? '#7f1d1d' : '#111827'),
      'color:#f8fafc',
      'border:1px solid ' + (isError ? '#ef4444' : '#334155'),
      'padding:10px 14px',
      'border-radius:10px',
      'font:12px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'max-width:320px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
    ].join(';');
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, 2500);
  }

  function cleanText(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function normalizeUrl(url) {
    if (!url) return null;
    try {
      return new URL(url, location.origin).href;
    } catch (error) {
      if (typeof url === 'string' && url.charAt(0) === '/') {
        return location.origin === 'null' ? url : location.origin + url;
      }
      return url;
    }
  }

  function extractUserName(article) {
    var node = article.querySelector('[data-testid="User-Name"]');
    var text = cleanText(node ? node.innerText : '');
    if (!text) return { displayName: null, handle: null };
    var handle = text.match(/@[A-Za-z0-9_]{1,15}/);
    return {
      displayName: cleanText(handle ? text.replace(handle[0], '') : text) || null,
      handle: handle ? handle[0] : null,
    };
  }

  function extractTweetText(article) {
    var textNode = article.querySelector('[data-testid="tweetText"]');
    if (textNode) return cleanText(textNode.innerText);
    var blocks = Array.from(article.querySelectorAll('div[lang]'))
      .map(function (node) { return cleanText(node.innerText); })
      .filter(Boolean);
    return blocks.join('\n\n');
  }

  function extractBookmarks() {
    var articles = Array.from(document.querySelectorAll('article'))
      .filter(function (article) { return article.querySelector('a[href*="/status/"]'); });

    var seen = new Set();
    var items = [];

    articles.forEach(function (article) {
      var link = article.querySelector('a[href*="/status/"]');
      var url = normalizeUrl(link ? link.getAttribute('href') : null);
      if (!url || seen.has(url)) return;
      seen.add(url);

      var user = extractUserName(article);
      var postedAtNode = article.querySelector('time');
      items.push({
        source_url: url,
        display_name: user.displayName,
        handle: user.handle,
        text: extractTweetText(article),
        posted_at: postedAtNode ? postedAtNode.getAttribute('datetime') : null,
        extracted_from: location.href,
        raw_user_text: cleanText(article.querySelector('[data-testid="User-Name"]') ? article.querySelector('[data-testid="User-Name"]').innerText : '') || null,
      });
    });

    return items;
  }

  function sortItems(items, mode) {
    var copy = items.slice();
    if (mode === 'author') {
      return copy.sort(function (a, b) {
        return (a.display_name || a.handle || '').localeCompare(b.display_name || b.handle || '');
      });
    }
    if (mode === 'newest') {
      return copy.sort(function (a, b) {
        return String(b.posted_at || '').localeCompare(String(a.posted_at || ''));
      });
    }
    if (mode === 'oldest') {
      return copy.sort(function (a, b) {
        return String(a.posted_at || '').localeCompare(String(b.posted_at || ''));
      });
    }
    return copy;
  }

  function formatMarkdown(items, mode) {
    var lines = [
      '---',
      'source: x-bookmarks',
      'captured_at: ' + new Date().toISOString(),
      'page_url: ' + location.href,
      'bookmark_count: ' + items.length,
      'sort_mode: ' + mode,
      '---',
      '',
      '# X Bookmarks',
      '',
    ];

    items.forEach(function (item, index) {
      var author = item.display_name || 'Unknown author';
      if (item.handle) author += ' (' + item.handle + ')';
      lines.push('## ' + (index + 1) + '. ' + author);
      lines.push('');
      lines.push('- url: ' + item.source_url);
      if (item.posted_at) lines.push('- posted_at: ' + item.posted_at);
      if (item.raw_user_text) lines.push('- user_text: ' + item.raw_user_text);
      lines.push('');
      if (item.text) {
        item.text.split('\n').forEach(function (line) {
          lines.push('> ' + line);
        });
        lines.push('');
      }
      lines.push('[Open on X](' + item.source_url + ')');
      lines.push('');
    });

    return lines.join('\n').trim() + '\n';
  }

  function formatJson(items, mode) {
    return JSON.stringify({
      source: 'x-bookmarks',
      captured_at: new Date().toISOString(),
      page_url: location.href,
      bookmark_count: items.length,
      sort_mode: mode,
      items: items,
    }, null, 2);
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function makeFilename(ext) {
    var stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return 'x-bookmarks-' + stamp + '.' + ext;
  }

  function ensureMenu() {
    if (document.getElementById(MENU_ID)) return;

    var wrap = document.createElement('div');
    wrap.id = MENU_ID;

    var title = document.createElement('div');
    title.textContent = 'X Bookmarks';
    title.style.cssText = 'font-weight:700;font-size:12px;color:#e5e7eb;margin-bottom:6px;';

    var select = document.createElement('select');
    select.id = 'x-bookmarks-sort';
    select.innerHTML = [
      '<option value="page">Page order</option>',
      '<option value="newest">Newest first</option>',
      '<option value="oldest">Oldest first</option>',
      '<option value="author">Author</option>',
    ].join('');
    select.value = storageGet(STORAGE_KEY, 'page');
    select.addEventListener('change', function () {
      storageSet(STORAGE_KEY, select.value);
    });

    var mdBtn = document.createElement('button');
    mdBtn.textContent = 'Markdown';
    mdBtn.addEventListener('click', function () {
      var mode = select.value;
      var items = sortItems(extractBookmarks(), mode);
      if (!items.length) {
        showToast('No bookmarks found on the page yet.', true);
        return;
      }
      download(makeFilename('md'), formatMarkdown(items, mode), 'text/markdown');
      showToast('Downloaded Markdown export.', false);
    });

    var jsonBtn = document.createElement('button');
    jsonBtn.textContent = 'JSON';
    jsonBtn.addEventListener('click', function () {
      var mode = select.value;
      var items = sortItems(extractBookmarks(), mode);
      if (!items.length) {
        showToast('No bookmarks found on the page yet.', true);
        return;
      }
      download(makeFilename('json'), formatJson(items, mode), 'application/json');
      showToast('Downloaded JSON export.', false);
    });

    var hint = document.createElement('div');
    hint.textContent = 'Scroll the page first to load more bookmarks.';
    hint.style.cssText = 'font-size:11px;color:#94a3b8;line-height:1.4;margin-top:6px;';

    wrap.appendChild(title);
    wrap.appendChild(select);
    wrap.appendChild(mdBtn);
    wrap.appendChild(jsonBtn);
    wrap.appendChild(hint);

    wrap.style.cssText = [
      'position:fixed',
      'top:20px',
      'right:20px',
      'z-index:2147483647',
      'width:180px',
      'padding:12px',
      'border-radius:12px',
      'background:#0f172a',
      'border:1px solid #1e293b',
      'box-shadow:0 12px 32px rgba(0,0,0,0.3)',
      'font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
    ].join(';');

    Array.from(wrap.querySelectorAll('button, select')).forEach(function (el) {
      el.style.cssText = [
        'width:100%',
        'border-radius:8px',
        'border:1px solid #334155',
        'background:#111827',
        'color:#e2e8f0',
        'padding:8px 10px',
        'font:inherit',
        'box-sizing:border-box',
      ].join(';');
    });
    Array.from(wrap.querySelectorAll('button')).forEach(function (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('mouseenter', function () { el.style.background = '#1f2937'; });
      el.addEventListener('mouseleave', function () { el.style.background = '#111827'; });
    });

    document.body.appendChild(wrap);
  }

  function isBookmarksPage() {
    return /\/i\/bookmarks/i.test(location.pathname);
  }

  function boot() {
    if (!isBookmarksPage()) return;
    ensureMenu();
  }

  gmAddStyle('');
  boot();

  var observer = new MutationObserver(function () {
    boot();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  var _push = history.pushState.bind(history);
  history.pushState = function () {
    _push.apply(history, arguments);
    setTimeout(boot, 250);
  };

  var _replace = history.replaceState.bind(history);
  history.replaceState = function () {
    _replace.apply(history, arguments);
    setTimeout(boot, 250);
  };

  window.addEventListener('popstate', function () {
    setTimeout(boot, 250);
  });

  GM_registerMenuCommand('X Bookmarks Exporter — reload UI', function () {
    var existing = document.getElementById(MENU_ID);
    if (existing) existing.remove();
    boot();
    showToast('Reloaded exporter UI.', false);
  });
})();

// ==UserScript==
// @name         QA Link Capture
// @namespace    https://applicationhub.app
// @version      0.1.1
// @description  Capture the current page into the local QA corpus with site, company, and application hints
// @author       Application Hub
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  var AGENT_URL = 'http://127.0.0.1:4317';
  var PANEL_ID = 'qa-link-capture-panel';
  var TOAST_PREFIX = 'qa-link-capture-toast-';
  var BANNER_ID = 'qa-link-capture-banner';
  var ACTIVE_ATTR = 'data-qa-link-capture-active';

  function gmAddStyle(css) {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(css);
      return;
    }
    var style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '');
  }

  function textOrNull(value) {
    var text = cleanText(value);
    return text.length ? text : null;
  }

  function getMeta(selector) {
    var node = document.querySelector(selector);
    return textOrNull(node ? node.getAttribute('content') : '');
  }

  function splitTitle(value) {
    var parts = cleanText(value).split(/\s*[|•·—–-]\s*/);
    var output = [];
    var i;
    for (i = 0; i < parts.length; i += 1) {
      if (cleanText(parts[i])) output.push(cleanText(parts[i]));
    }
    return output;
  }

  function hostLabel(hostname) {
    return cleanText(String(hostname || '').replace(/^www\./i, ''))
      .replace(/\.[a-z]{2,}$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/^\s+|\s+$/g, '') || hostname || null;
  }

  function metaFallback() {
    return (
      getMeta('meta[property="og:site_name"]') ||
      getMeta('meta[name="application-name"]') ||
      getMeta('meta[property="og:application-name"]')
    );
  }

  function inferSiteName() {
    return metaFallback() || hostLabel(location.hostname) || null;
  }

  function inferApplicationName() {
    var h1 = document.querySelector('h1');
    var titleParts = splitTitle(document.title);
    var ogTitle = getMeta('meta[property="og:title"]');
    return textOrNull(h1 ? h1.innerText : '') || titleParts[0] || ogTitle || textOrNull(document.title) || 'Untitled application';
  }

  function inferCompanyName() {
    var siteName = inferSiteName();
    var titleParts = splitTitle(document.title);
    if (siteName && siteName !== inferApplicationName()) return siteName;
    if (titleParts[1]) return titleParts[1];
    return hostLabel(location.hostname) || null;
  }

  function isVisible(element) {
    var rect = element.getBoundingClientRect();
    var style = window.getComputedStyle(element);
    return rect.width >= 80 && rect.height >= 18 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(value);
    return String(value || '').replace(/["\\]/g, '\\$&');
  }

  function getLabel(element) {
    var id;
    var label;
    var aria;
    var placeholder;
    var parentLabel;
    var previous;
    var container;
    var containerLabel;

    if (element.labels && element.labels[0] && element.labels[0].innerText) return cleanText(element.labels[0].innerText);

    id = element.getAttribute('id');
    if (id) {
      label = document.querySelector('label[for="' + cssEscape(id) + '"]');
      if (label && label.textContent) return cleanText(label.textContent);
    }

    aria = textOrNull(element.getAttribute('aria-label'));
    if (aria) return aria;

    placeholder = textOrNull(element.getAttribute('placeholder'));
    if (placeholder) return placeholder;

    parentLabel = element.closest('label');
    if (parentLabel && parentLabel.textContent) return cleanText(parentLabel.textContent);

    previous = element.previousElementSibling;
    if (previous && ['LABEL', 'P', 'H3', 'H4', 'LEGEND'].indexOf(previous.tagName) !== -1) {
      return cleanText(previous.textContent);
    }

    container = element.closest('div, section, fieldset, form');
    containerLabel = container ? container.querySelector('label, legend, h1, h2, h3, p') : null;
    return textOrNull(containerLabel ? containerLabel.textContent : '');
  }

  function getFieldValue(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return cleanText(element.value);
    }
    if (element.isContentEditable) return cleanText(element.innerText);
    return cleanText(element.textContent);
  }

  function selectorFor(element) {
    var id = element.getAttribute('id');
    var name = element.getAttribute('name');
    if (id) return '#' + cssEscape(id);
    if (name) return element.tagName.toLowerCase() + '[name="' + cssEscape(name) + '"]';
    return element.tagName.toLowerCase();
  }

  function extractFields() {
    var nodes = document.querySelectorAll('textarea, input:not([type="hidden"]), select, [contenteditable="true"]');
    var fields = [];
    var seen = {};
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      var element = nodes[i];
      var label;
      var value;
      var selector;
      var key;

      if (!isVisible(element)) continue;
      label = getLabel(element);
      value = getFieldValue(element);
      selector = selectorFor(element);
      key = selector + '::' + (label || value);
      if (seen[key]) continue;
      if (!label && !value) continue;
      seen[key] = true;

      fields.push({
        label: label || element.getAttribute('name') || element.id || 'Field',
        value: value,
        selector: selector,
        type: element.getAttribute('type') || element.tagName.toLowerCase(),
        required: Boolean(element.required),
      });
    }
    return fields;
  }

  function pageText() {
    var root = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    var rootText = root ? root.innerText : '';
    var bodyText = document.body ? document.body.innerText : '';
    return cleanText(rootText || bodyText || '').slice(0, 12000);
  }

  function summaryIntro() {
    return [
      'Capture kind: safari-link',
      'URL: ' + location.href,
      'Site: ' + (inferSiteName() || '—'),
      'Company: ' + (inferCompanyName() || '—'),
      'Application: ' + inferApplicationName(),
      'Detected fields: ' + extractFields().length,
    ].join('\n');
  }

  function buildCapturePayload() {
    var fields = extractFields();
    var title = inferApplicationName();
    var questions = [];
    var i;

    for (i = 0; i < fields.length; i += 1) {
      questions.push({
        label: fields[i].label,
        questionText: fields[i].label,
        value: fields[i].value,
        selector: fields[i].selector,
      });
    }

    return {
      title: title,
      url: location.href,
      host: location.hostname,
      site_name: inferSiteName(),
      company_name: inferCompanyName(),
      application_name: title,
      capture_kind: 'safari-link',
      content: summaryIntro(),
      page_text: pageText(),
      questions: questions,
    };
  }

  function postJson(url, payload) {
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise(function (resolve, reject) {
        GM_xmlhttpRequest({
          method: 'POST',
          url: url,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(payload),
          onload: function (response) {
            var parsed = {};
            try {
              parsed = JSON.parse(response.responseText || '{}');
            } catch (error) {
              parsed = { raw: response.responseText || '' };
            }
            if (response.status >= 200 && response.status < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error || 'Agent request failed (' + response.status + ')'));
            }
          },
          onerror: function () {
            reject(new Error('Local agent request failed'));
          },
        });
      });
    }

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (parsed) {
        if (!response.ok) throw new Error(parsed.error || 'Agent request failed (' + response.status + ')');
        return parsed;
      });
    });
  }

  function showToast(message, isError) {
    var toast = document.createElement('div');
    var root = document.body || document.documentElement;

    toast.id = TOAST_PREFIX + Date.now();
    toast.textContent = message;
    toast.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'z-index:2147483647',
      'background:' + (isError ? '#7f1d1d' : '#111827'),
      'color:#f8fafc',
      'border:1px solid ' + (isError ? '#ef4444' : '#334155'),
      'padding:10px 12px',
      'border-radius:10px',
      'font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'max-width:320px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
    ].join(';');

    root.appendChild(toast);
    window.setTimeout(function () {
      toast.style.opacity = '0';
      window.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, 2200);
  }

  function showBanner() {
    var banner;
    var close;
    var root = document.body || document.documentElement;

    if (document.getElementById(BANNER_ID)) return;

    banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.textContent = 'QA Link Capture active · ' + location.hostname;
    banner.style.cssText = [
      'position:fixed',
      'top:16px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'background:#f59e0b',
      'color:#111827',
      'border:1px solid #fbbf24',
      'padding:8px 12px',
      'border-radius:999px',
      'font:600 12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'box-shadow:0 10px 24px rgba(0,0,0,0.22)',
    ].join(';');

    close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Dismiss';
    close.style.cssText = [
      'margin-left:10px',
      'border:none',
      'background:rgba(17,24,39,0.12)',
      'color:#111827',
      'border-radius:999px',
      'padding:4px 8px',
      'font:inherit',
      'cursor:pointer',
    ].join(';');
    close.addEventListener('click', function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    });

    banner.appendChild(close);
    root.appendChild(banner);
    if (window.console && console.log) console.log('[QA Link Capture] userscript injected on ' + location.href);
  }

  function ensurePanel() {
    var root = document.body || document.documentElement;
    var existing = document.getElementById(PANEL_ID);
    var panel, title, subtitle, sendBtn, refreshBtn, hint, buttons;

    if (existing) return;

    panel = document.createElement('div');
    panel.id = PANEL_ID;

    title = document.createElement('div');
    title.textContent = 'QA Link Capture';
    title.style.cssText = 'font-weight:700;font-size:12px;color:#e5e7eb;';

    subtitle = document.createElement('div');
    subtitle.textContent = 'Send the current page to the local QA agent.';
    subtitle.style.cssText = 'font-size:11px;color:#94a3b8;line-height:1.4;';

    sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.textContent = 'Send to QA';
    sendBtn.addEventListener('click', function () {
      var original = sendBtn.textContent;
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
      postJson(AGENT_URL + '/assist', buildCapturePayload())
        .then(function (result) {
          var relatedCount = Array.isArray(result.related_files) ? result.related_files.length : 0;
          showToast('Saved ' + (result.saved_to || 'capture') + ' (' + relatedCount + ' related files).', false);
        })
        .catch(function (error) {
          if (window.console && console.error) console.error('[QA Link Capture] send failed', error);
          showToast('Send failed. Check that the local agent is running.', true);
        })
        .then(function () {
          sendBtn.disabled = false;
          sendBtn.textContent = original;
        });
    });

    refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.addEventListener('click', function () {
      subtitle.textContent = inferApplicationName() + ' · ' + (inferCompanyName() || 'Unknown company');
      showToast('Refreshed page summary.', false);
    });

    hint = document.createElement('div');
    hint.textContent = 'Captures title, URL, site, company, application, and visible fields.';
    hint.style.cssText = 'font-size:11px;color:#94a3b8;line-height:1.4;';

    buttons = [sendBtn, refreshBtn];
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].style.cssText = [
        'width:100%',
        'border-radius:8px',
        'border:1px solid #334155',
        'background:#111827',
        'color:#e2e8f0',
        'padding:8px 10px',
        'font:inherit',
        'cursor:pointer',
        'box-sizing:border-box',
      ].join(';');
      buttons[i].addEventListener('mouseenter', function (button) {
        return function () {
          button.style.background = '#1f2937';
        };
      }(buttons[i]));
      buttons[i].addEventListener('mouseleave', function (button) {
        return function () {
          button.style.background = '#111827';
        };
      }(buttons[i]));
    }

    panel.appendChild(title);
    panel.appendChild(subtitle);
    panel.appendChild(sendBtn);
    panel.appendChild(refreshBtn);
    panel.appendChild(hint);

    panel.style.cssText = [
      'position:fixed',
      'top:50%',
      'right:20px',
      'transform:translateY(-50%)',
      'z-index:2147483647',
      'width:220px',
      'max-height:calc(100vh - 40px)',
      'overflow:auto',
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

    root.appendChild(panel);
  }

  function boot() {
    if (!document.body) return false;
    showBanner();
    ensurePanel();
    document.body.setAttribute(ACTIVE_ATTR, '1');
    return true;
  }

  function start() {
    if (boot()) return;
    var attempts = 0;
    var waitForBody = function () {
      if (boot()) return;
      attempts += 1;
      if (attempts > 200) return;
      window.setTimeout(waitForBody, 50);
    };
    waitForBody();
  }

  function bindObserver() {
    var observer;
    if (!document.body || document.body.getAttribute(ACTIVE_ATTR) === '1') return;
    observer = new MutationObserver(function () {
      boot();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  gmAddStyle('');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      start();
      bindObserver();
    }, false);
  } else {
    start();
    bindObserver();
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('QA Link Capture — send current page', function () {
      var btn = document.querySelector('#' + PANEL_ID + ' button');
      if (btn) {
        btn.click();
        return;
      }
      postJson(AGENT_URL + '/assist', buildCapturePayload())
        .then(function (result) {
          showToast('Saved ' + (result.saved_to || 'capture') + '.', false);
        })
        .catch(function (error) {
          if (window.console && console.error) console.error('[QA Link Capture] menu send failed', error);
          showToast('Send failed. Check that the local agent is running.', true);
        });
    });
  }
})();

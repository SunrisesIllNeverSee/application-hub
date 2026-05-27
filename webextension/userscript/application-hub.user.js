// ==UserScript==
// @name         Application Hub
// @namespace    https://applicationhub.app
// @version      0.1.0
// @description  Fill application forms from your Application Hub answer bank
// @author       Application Hub
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      betcyfbzsgusaghriptz.supabase.co
// ==/UserScript==

(function () {
  'use strict';

  const SUPABASE_URL = 'https://betcyfbzsgusaghriptz.supabase.co';
  // Anon key is public — safe to ship in client code (RLS enforces user isolation)
  const SUPABASE_ANON_KEY = 'REPLACE_WITH_ANON_KEY';

  // ─── Styles ──────────────────────────────────────────────────────────────────

  GM_addStyle(`
    .ah-trigger {
      position: absolute;
      z-index: 2147483647;
      background: #18181b;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 11px;
      font-family: system-ui, sans-serif;
      font-weight: 600;
      letter-spacing: 0.03em;
      cursor: pointer;
      opacity: 0.85;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      transition: opacity 0.15s;
    }
    .ah-trigger:hover { opacity: 1; }

    .ah-panel {
      position: fixed;
      z-index: 2147483646;
      top: 50%;
      right: 24px;
      transform: translateY(-50%);
      width: 340px;
      max-height: 70vh;
      background: #fff;
      border: 1px solid #e4e4e7;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      font-family: system-ui, sans-serif;
      font-size: 13px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .ah-panel-header {
      padding: 12px 16px;
      border-bottom: 1px solid #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fafafa;
    }
    .ah-panel-title {
      font-weight: 700;
      font-size: 13px;
      color: #18181b;
      margin: 0;
    }
    .ah-panel-close {
      background: none;
      border: none;
      cursor: pointer;
      color: #71717a;
      font-size: 16px;
      padding: 0;
      line-height: 1;
    }
    .ah-panel-body {
      overflow-y: auto;
      flex: 1;
      padding: 8px 0;
    }
    .ah-answer-item {
      padding: 10px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f4f4f5;
      transition: background 0.1s;
    }
    .ah-answer-item:hover { background: #f4f4f5; }
    .ah-answer-item:last-child { border-bottom: none; }
    .ah-answer-question {
      font-weight: 600;
      color: #18181b;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ah-answer-preview {
      color: #71717a;
      font-size: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .ah-empty {
      padding: 24px 16px;
      text-align: center;
      color: #71717a;
      font-size: 12px;
      line-height: 1.6;
    }
    .ah-setup { padding: 16px; }
    .ah-setup-label {
      display: block;
      font-size: 12px;
      color: #52525b;
      margin-bottom: 10px;
      line-height: 1.5;
    }
    .ah-input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      padding: 7px 10px;
      font-size: 12px;
      font-family: system-ui, sans-serif;
      margin-bottom: 8px;
      outline: none;
    }
    .ah-input:focus { border-color: #18181b; }
    .ah-btn {
      width: 100%;
      background: #18181b;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: system-ui, sans-serif;
    }
    .ah-btn:hover { background: #27272a; }
    .ah-status {
      padding: 6px 16px;
      font-size: 11px;
      color: #71717a;
      border-top: 1px solid #f4f4f5;
      background: #fafafa;
    }
  `);

  // ─── State ───────────────────────────────────────────────────────────────────

  let activeTextarea = null;
  let panel = null;

  // ─── Auth helpers ────────────────────────────────────────────────────────────

  const getToken = () => GM_getValue('ah_access_token', '');
  const saveToken = (t) => GM_setValue('ah_access_token', t.trim());
  const clearToken = () => GM_setValue('ah_access_token', '');

  // ─── Supabase fetch ───────────────────────────────────────────────────────────

  function supabaseFetch(path, token) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${SUPABASE_URL}/rest/v1/${path}`,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) {
            resolve(JSON.parse(res.responseText));
          } else {
            reject(new Error(`${res.status}`));
          }
        },
        onerror: reject,
      });
    });
  }

  function fetchAnswers(token) {
    return supabaseFetch(
      'profile_answers?select=body,confidence,archived_questions(question_text,theme)&body=not.is.null&order=updated_at.desc&limit=30',
      token
    );
  }

  // ─── Fill helper ──────────────────────────────────────────────────────────────

  function fillTextarea(text) {
    if (!activeTextarea) return;
    // Use native setter so React/Vue controlled inputs detect the change
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    if (nativeSetter) nativeSetter.call(activeTextarea, text);
    else activeTextarea.value = text;
    activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    activeTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    activeTextarea.focus();
    closePanel();
  }

  // ─── Panel builders (DOM-safe — no innerHTML for dynamic data) ────────────────

  function getPanelBody() {
    return panel.querySelector('.ah-panel-body');
  }

  function clearBody() {
    const body = getPanelBody();
    while (body.firstChild) body.removeChild(body.firstChild);
    return body;
  }

  function makeEmptyState(msg) {
    const body = clearBody();
    const div = document.createElement('div');
    div.className = 'ah-empty';
    div.textContent = msg;
    body.appendChild(div);
  }

  function renderSetupPanel() {
    const body = clearBody();
    const wrap = document.createElement('div');
    wrap.className = 'ah-setup';

    const label = document.createElement('span');
    label.className = 'ah-setup-label';
    label.textContent = 'Paste your Application Hub access token to connect your answer bank. Get it from: applicationhub.app → Profile → Settings → API Token';

    const input = document.createElement('input');
    input.className = 'ah-input';
    input.type = 'password';
    input.placeholder = 'Paste access token…';
    input.value = getToken();

    const btn = document.createElement('button');
    btn.className = 'ah-btn';
    btn.textContent = 'Connect';
    btn.addEventListener('click', async () => {
      saveToken(input.value);
      makeEmptyState('Loading your answers…');
      await renderAnswersPanel();
    });

    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(btn);
    body.appendChild(wrap);
  }

  function buildAnswerItem(row) {
    const question = Array.isArray(row.archived_questions)
      ? row.archived_questions[0]
      : row.archived_questions;

    const item = document.createElement('div');
    item.className = 'ah-answer-item';

    const qEl = document.createElement('div');
    qEl.className = 'ah-answer-question';
    qEl.textContent = question?.question_text ?? 'Untitled question';

    const body = row.body ?? '';
    const pEl = document.createElement('div');
    pEl.className = 'ah-answer-preview';
    pEl.textContent = body.length > 120 ? body.slice(0, 120) + '…' : body;

    item.appendChild(qEl);
    item.appendChild(pEl);
    item.addEventListener('click', () => fillTextarea(body));
    return item;
  }

  async function renderAnswersPanel() {
    const token = getToken();
    if (!token) { renderSetupPanel(); return; }

    try {
      const rows = await fetchAnswers(token);
      if (!rows || rows.length === 0) {
        makeEmptyState('No answers found in your bank yet.\nAdd some at applicationhub.app');
        return;
      }
      const body = clearBody();
      rows.forEach((row) => body.appendChild(buildAnswerItem(row)));
    } catch {
      clearToken();
      makeEmptyState('Could not load answers — token may be expired.');
      setTimeout(renderSetupPanel, 1800);
    }
  }

  // ─── Panel scaffold ───────────────────────────────────────────────────────────

  function closePanel() {
    if (panel) { panel.remove(); panel = null; }
  }

  function showPanel(textarea) {
    closePanel();
    activeTextarea = textarea;

    panel = document.createElement('div');
    panel.className = 'ah-panel';

    const header = document.createElement('div');
    header.className = 'ah-panel-header';

    const title = document.createElement('p');
    title.className = 'ah-panel-title';
    title.textContent = 'Application Hub';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ah-panel-close';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', closePanel);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'ah-panel-body';

    const status = document.createElement('div');
    status.className = 'ah-status';
    status.textContent = 'Click an answer to fill the field';

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(status);
    document.body.appendChild(panel);

    makeEmptyState('Loading your answers…');
    renderAnswersPanel();
  }

  // ─── Trigger buttons ──────────────────────────────────────────────────────────

  function attachTrigger(textarea) {
    if (textarea.dataset.ahAttached) return;
    textarea.dataset.ahAttached = '1';

    const btn = document.createElement('button');
    btn.className = 'ah-trigger';
    btn.textContent = 'AH';
    btn.title = 'Fill from Application Hub';

    function position() {
      const r = textarea.getBoundingClientRect();
      btn.style.top = `${r.top + window.scrollY + 4}px`;
      btn.style.left = `${r.right + window.scrollX - 42}px`;
    }

    position();
    document.body.appendChild(btn);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showPanel(textarea);
    });

    window.addEventListener('scroll', position, { passive: true });
    window.addEventListener('resize', position, { passive: true });

    // Clean up button if the textarea is removed from the DOM
    new MutationObserver(() => {
      if (!document.contains(textarea)) { btn.remove(); }
    }).observe(document.body, { childList: true, subtree: true });
  }

  function scanTextareas() {
    document.querySelectorAll('textarea').forEach((ta) => {
      if (ta.offsetParent !== null && !ta.disabled && !ta.readOnly) {
        attachTrigger(ta);
      }
    });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────────

  scanTextareas();

  // Watch for textareas added by SPAs after initial load
  new MutationObserver(scanTextareas)
    .observe(document.body, { childList: true, subtree: true });

  // Close panel on outside click
  document.addEventListener('click', (e) => {
    if (panel && !panel.contains(e.target) && !e.target.classList.contains('ah-trigger')) {
      closePanel();
    }
  });

  // Userscript manager menu command to reset credentials
  GM_registerMenuCommand('Application Hub — Reset token', () => {
    clearToken();
    alert('Token cleared. Reload the page to reconnect.');
  });

})();

// ===============================
// AI Chat History Exporter - Refactored Background Service Worker v2.1.0
// ===============================
'use strict';

// ── Helpers ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatSingleConv(title, messages) {
  const lines = [];
  lines.push('# ' + title);
  lines.push('');
  for (const m of messages) {
    lines.push('**' + (m.role === 'user' ? 'You' : 'Assistant') + '**');
    lines.push(m.content);
    lines.push('');
  }
  return lines.join('\n');
}

function formatTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function tryCatchSend(msg) {
  try {
    chrome.runtime.sendMessage(msg, () => {
      if (chrome.runtime.lastError) console.warn('[BG] sendMessage lastError:', chrome.runtime.lastError.message);
    });
  } catch(e) { console.warn('[BG] tryCatchSend error:', e.message); }
}

// ── PLATFORM REGISTRY ── (所有平台逻辑封装在此，主流程零平台代码)
const PLATFORM_REGISTRY = {
  chatgpt: {
    extractCurrent: () => {
      const main = document.querySelector('main');
      if (!main) return { title: 'ChatGPT Chat', messages: [] };
      const msgs = [];
      const turns = main.querySelectorAll('[data-testid^=\\"conversation-turn-"]');
      for (const turn of turns) {
        const h4 = turn.querySelector('h4');
        const roleLabel = h4 ? h4.innerText.trim() : '';
        const allText = turn.innerText || '';
        let content = allText;
        if (roleLabel && content.startsWith(roleLabel)) content = content.slice(roleLabel.length).trim();
        const lines = content.split('\\n').filter(l => l.trim());
        content = lines.join('\\n').trim();
        if (!content) continue;
        const role = roleLabel.includes('ChatGPT') ? 'assistant' : 'user';
        msgs.push({ role, content });
      }
      const title = document.title?.trim() || 'ChatGPT Chat';
      return { title, messages: msgs };
    },
    extractConv: () => PLATFORM_REGISTRY.chatgpt.extractCurrent().messages,
    getItems: () => {
      const nav = document.querySelector('nav');
      if (!nav) return [];
      const links = nav.querySelectorAll('a[href*=\\"/c/"]');
      return Array.from(links).map(a => {
        const t = a.innerText.trim().replace(/\\s+/g, ' ');
        if (t.length > 1 && !t.includes('新聊天') && !t.includes('Search') && a.offsetParent) {
          return { title: t, href: a.getAttribute('href') };
        }
      }).filter(Boolean);
    },
    openSidebar: () => {
      const nav = document.querySelector('nav');
      if (nav?.offsetParent) return;
      let toggle = document.querySelector('[aria-label*\\"打开边栏"], [aria-label*\\"Open sidebar"], button[aria-label*\\"sidebar"]');
      if (toggle) return toggle.click();
      for (const btn of document.querySelectorAll('button')) {
        const aria = btn.getAttribute('aria-label') || '';
        if (aria.includes('sidebar') || aria.includes('边栏')) return btn.click();
      }
      for (const btn of document.querySelectorAll('button')) {
        if (btn.innerText.trim().includes('打开边栏')) return btn.click();
      }
    }
  },
  claude: {
    extractCurrent: () => {
      const msgs = [];
      for (const um of document.querySelectorAll('[data-testid=\\"user-message"]')) {
        let text = '';
        for (const p of um.querySelectorAll('p')) {
          const pt = p.innerText.trim();
          if (pt) text += (text ? '\\n' : '') + pt;
        }
        if (!text) text = um.innerText.trim();
        if (text) msgs.push({ role: 'user', content: text });
      }
      for (const am of document.querySelectorAll('p.font-claude-response-body')) {
        const text = am.innerText.trim();
        if (text) msgs.push({ role: 'assistant', content: text });
      }
      let title = 'Claude Chat';
      for (const h of document.querySelectorAll('h1')) {
        const ht = h.innerText.trim();
        if (ht.length > 1 && ht.length < 200) { title = ht; break; }
      }
      return { title, messages: msgs };
    },
    extractConv: () => PLATFORM_REGISTRY.claude.extractCurrent().messages,
    getItems: () => {
      const links = document.querySelectorAll('a[href*=\\"/chat/"]');
      return Array.from(links).map(a => {
        const t = a.innerText.trim().replace(/\\s+/g, ' ');
        if (t.length > 1 && !t.includes('New chat') && a.offsetParent) {
          return { title: t, href: a.getAttribute('href') };
        }
      }).filter(Boolean);
    },
    openSidebar: () => {
      const sidebarBtn = document.querySelector('[aria-label=\\"Sidebar"], [aria-label*=sidebar i], button[aria-label*=menu]');
      if (sidebarBtn) sidebarBtn.click();
    }
  },
  grok: {
    extractCurrent: () => {
      const META = ['毫秒','快速模式','畅所欲言','privacy','cookie','解释chat history','推荐聊天记录','让 think','新建聊天','语音','imagine'];
      const main = document.querySelector('main');
      if (!main) return { title: 'Grok Chat', messages: [] };
      const msgs = [];
      for (const p of main.querySelectorAll('p')) {
        const text = p.textContent.trim();
        if (!text) continue;
        const lower = text.toLowerCase();
        if (META.some(m => lower.includes(m))) continue;
        msgs.push({ role: msgs.length % 2 === 0 ? 'user' : 'assistant', content: text });
      }
      const al = document.querySelector('a[href^=\\"/c/"].font-semibold, a[href^=\\"/c/"][class*=active]');
      const title = al ? al.textContent.trim().split('\\n')[0].trim() : 'Grok Chat';
      return { title, messages: msgs };
    },
    extractConv: () => PLATFORM_REGISTRY.grok.extractCurrent().messages,
    getItems: () => {
      // Simplified - use sidebar/command menu logic from original
      const cmdDialog = document.querySelector('div[data-analytics-name=\\"command_menu"]');
      if (cmdDialog) {
        return Array.from(cmdDialog.querySelectorAll('a[href^=\\"/c/"]')).map(a => {
          const t = a.textContent.trim().replace(/\\s+/g, ' ');
          if (t && a.getAttribute('href')) return { title: t, href: a.getAttribute('href') };
        }).filter(Boolean);
      }
      const links = document.querySelectorAll('aside a[href^=\\"/c/"], nav a[href^=\\"/c/"]');
      return Array.from(links).map(a => {
        const t = a.textContent.trim().replace(/\\s+/g, ' ');
        if (t && !t.includes('新建聊天') && a.offsetParent) {
          return { title: t, href: a.getAttribute('href') };
        }
      }).filter(Boolean);
    },
    openSidebar: () => {
      // Step 1: Make sure sidebar is open - click sidebar toggle if needed
      const sidebarToggle = document.querySelector('[aria-label*="sidebar" i], [aria-label*="侧边栏"], [aria-label*="sidebar"]');
      if (!sidebarToggle) {
        // Try finding by button text
        const allBtns = document.querySelectorAll('button');
        for (const btn of allBtns) {
          const label = (btn.getAttribute('aria-label') || '').toLowerCase();
          const text = (btn.textContent || '').toLowerCase().trim();
          if (label.includes('sidebar') || label.includes('侧边栏') || text.includes('sidebar') || text.includes('侧边栏')) {
            sidebarToggle = btn;
            break;
          }
        }
      }
      if (sidebarToggle) sidebarToggle.click();

      // Step 2: Click "Show All" / "显示全部" / "查看全部" button to open command menu
      const xpath = `//*[text()='Show All' or text()='显示全部' or text()='查看全部' or text()='All']`;
      const res = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (res.singleNodeValue) {
        res.singleNodeValue.click();
      }
    }
  },
  gemini: {
    extractCurrent: () => {
      const META = ['gemini is still syncing','gemini is ai and can make mistakes','enter a prompt','temporary chat','upgrade to google ai plus'];
      const main = document.querySelector('main');
      if (!main) return { title: 'Gemini Chat', messages: [] };
      const msgs = [];
      for (const h of main.querySelectorAll('h2, [role=\\"heading"][aria-level=\\"2"]')) {
        const text = h.textContent.trim();
        if (text.includes('You said')) {
          const inner = h.innerText || h.textContent;
          const parts = inner.split('\\n\\n');
          const msg = parts[1]?.trim() || parts[0].replace('You said', '').trim();
          if (msg) msgs.push({ role: 'user', content: msg });
        } else if (text.includes('Gemini said') || text.includes('AI said')) {
          const content = [];
          let next = h.nextElementSibling;
          while (next) {
            const tag = next.tagName.toLowerCase();
            if (tag === 'h2' || (tag === 'div' && next.getAttribute('role') === 'heading')) break;
            if (tag === 'p' || tag === 'structured-content-container') {
              const pt = next.textContent.trim();
              const lower = pt.toLowerCase();
              if (!META.some(m => lower.includes(m)) && pt) content.push(pt);
            }
            next = next.nextElementSibling;
          }
          if (content.length) msgs.push({ role: 'assistant', content: content.join('\\n') });
        }
      }
      const h1 = main.querySelector('h1');
      const title = h1 ? h1.textContent.trim() : 'Gemini Chat';
      return { title, messages: msgs };
    },
    extractConv: () => PLATFORM_REGISTRY.gemini.extractCurrent().messages,
    getItems: () => {
      const sideNav = document.querySelector('.side-nav-open, side-nav-menu');
      if (!sideNav) return [];
      const links = sideNav.querySelectorAll('a[href*=\\"/app/"]');
      return Array.from(links).map(a => {
        const t = a.textContent.trim().replace(/\\s+/g, ' ');
        const href = a.getAttribute('href') || '';
        if (href !== '/app' && href !== 'mystuff' && href !== '/gems/view' && t && !['Gemini', 'New chat', 'My stuff', 'Gems'].includes(t)) {
          return { title: t, href };
        }
      }).filter(Boolean);
    },
    openSidebar: () => {
      const b = document.querySelector('button[aria-label=\\"Main menu"]');
      if (b) b.click();
    }
  }
};

// ── Page HUD Functions (injected into tab)
function showProgress(current, total, msg) {
  let el = document.getElementById('__ai_export_progress__');
  if (!el) {
    el = document.createElement('div');
    el.id = '__ai_export_progress__';
    el.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:99999;background:rgba(0,0,0,0.85);color:#fff;padding:12px 16px;border-radius:10px;font-size:13px;font-family:system-ui,sans-serif;opacity:1;pointer-events:none;max-width:360px;word-break:break-all;line-height:1.6;box-shadow:0 4px 20px rgba(0,0,0,0.4);';
    document.body.appendChild(el);
  }
  el.textContent = `[${current}/${total}] ${msg}`;
}

function clearProgress() {
  const el = document.getElementById('__ai_export_progress__');
  if (el) el.remove();
}

function showToast(title) {
  const toast = document.createElement('div');
  toast.textContent = '✅ ' + title;
  toast.style.cssText = 'position:fixed;bottom:60px;right:16px;z-index:999999;background:#16a34a;color:#fff;padding:6px 14px;border-radius:8px;font-size:12px;font-family:system-ui;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:1;transition:opacity 0.5s;';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2500);
}

// ── Navigation
async function navToPage(tabId, url) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: u => { window.location.href = u; },
    args: [url]
  });
  await sleep(500);
}

async function waitForPageReady(tabId, platform, maxWaitMs = 12000) {
  let totalMs = 0;
  const stepMs = 600;
  while (totalMs < maxWaitMs) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const turns = document.querySelectorAll('[data-testid^=\\"conversation-turn-"]').length;
        const userMsgs = document.querySelectorAll('[data-testid=\\"user-message"]').length;
        const hs = document.querySelectorAll('h2, [role=\\"heading"][aria-level=\\"2"]').length;
        const ps = document.querySelectorAll('main p').length;
        const bodyLen = document.body.innerText.length;
        return { turns, userMsgs, hs, ps, bodyLen, url: window.location.href };
      }
    });
    const info = result[0].result;
    const ready = platform === 'chatgpt' ? info.turns >= 2
      : platform === 'claude' ? info.userMsgs >= 1
      : platform === 'grok' ? info.ps > 3 && info.bodyLen > 100
      : platform === 'gemini' ? info.hs >= 2 : false;
    if (ready) return;
    await sleep(stepMs);
    totalMs += stepMs;
  }
}

// ── Download
async function triggerDownload(tabId, content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const dataUrl = await new Promise(r => {
    const reader = new FileReader();
    reader.onload = () => r(reader.result);
    reader.readAsDataURL(blob);
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (data) => {
      const a = document.createElement('a');
      a.href = data.url;
      a.download = data.filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      const toast = document.createElement('div');
      toast.textContent = '✅ Saved: ' + data.filename;
      toast.style.cssText = 'position:fixed;bottom:60px;right:16px;z-index:999999;background:#16a34a;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;font-family:system-ui;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    },
    args: [{ url: dataUrl, filename }]
  });
}

// ── Single Chat Export
async function handleCurrentChat(platform, tabId) {
  const fns = PLATFORM_REGISTRY[platform];
  if (!fns) throw new Error(`No registry for platform: ${platform}`);
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: fns.extractCurrent
  });
  const result = results[0].result;
  if (!result.messages?.length) throw new Error('No messages found');
  const md = formatSingleConv(result.title, result.messages);
  const ts = formatTimestamp();
  const filename = `${platform}-chat-${ts}.md`;
  await triggerDownload(tabId, md, filename);
  return { lines: md.split('\\n').length };
}

// ── All History Export
let _cancelRequested = false;
let _accumulatedContent = [];
let _accumulatedCount = 0;

async function handleAllHistory(platform, tabId) {
  _cancelRequested = false;
  _accumulatedContent = [];
  _accumulatedCount = 0;

  const fns = PLATFORM_REGISTRY[platform];
  if (!fns) throw new Error(`No registry for platform: ${platform}`);

  const tabInfo = await chrome.tabs.get(tabId);
  const tabUrl = tabInfo.url || '';

  try {
    tryCatchSend({ type: 'export-progress', msg: 'Initializing…' });
    await chrome.scripting.executeScript({
      target: { tabId },
      func: msg => {
        let el = document.getElementById('__ai_export_progress__');
        if (!el) {
          el = document.createElement('div');
          el.id = '__ai_export_progress__';
          el.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:99999;background:rgba(0,0,0,0.85);color:#fff;padding:12px 16px;border-radius:10px;font-size:13px;font-family:system-ui,sans-serif;pointer-events:none;max-width:360px;word-break:break-all;line-height:1.6;box-shadow:0 4px 20px rgba(0,0,0,0.4);';
          document.body.appendChild(el);
        }
        el.textContent = msg;
      },
      args: ['Initializing…']
    });

    // Open sidebar
    tryCatchSend({ type: 'export-progress', msg: 'Opening sidebar…' });
    await chrome.scripting.executeScript({ target: { tabId }, func: fns.openSidebar });
    await sleep(4000);

    // Scroll to load
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const r = document.querySelector('main region') || document.querySelector('nav, aside') || document.body;
        let prev = 0;
        for (let i = 0; i < 30; i++) {
          r.scrollTop = r.scrollHeight;
          if (r.scrollHeight === prev) break;
          prev = r.scrollHeight;
        }
      }
    });
    await sleep(1000);

    // Get items
    tryCatchSend({ type: 'export-progress', msg: 'Finding conversations…' });
    const itemsResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: fns.getItems
    });
    const items = itemsResult[0].result || [];
    if (!items.length) {
      tryCatchSend({ type: 'export-progress', status: 'error', msg: 'No conversations found. Open sidebar manually.' });
      return;
    }

    const total = items.length;
    let errors = 0;
    tryCatchSend({ type: 'export-progress', msg: `Collecting 0/${total}… (download at end)` });

    for (let i = 0; i < items.length; i++) {
      if (_cancelRequested) break;
      const item = items[i];

      await chrome.scripting.executeScript({
        target: { tabId },
        func: showProgress,
        args: [i + 1, total, item.title]
      });
      tryCatchSend({ type: 'export-progress', msg: `[${i + 1}/${total}] ${item.title}` });

      let navUrl = item.href;
      if (tabUrl && !navUrl.startsWith('http')) {
        try {
          navUrl = new URL(item.href, new URL(tabUrl)).href;
        } catch {}
      }

      if (navUrl) {
        await navToPage(tabId, navUrl);
        await waitForPageReady(tabId, platform);
        await sleep(1500);
      }

      const exResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: fns.extractConv
      });
      const messages = exResult[0].result || [];
      if (messages.length) {
        _accumulatedContent.push({ title: item.title, messages });
        _accumulatedCount++;
        await chrome.scripting.executeScript({
          target: { tabId },
          func: showToast,
          args: [item.title]
        });
      } else {
        errors++;
      }
    }

    await chrome.scripting.executeScript({ target: { tabId }, func: clearProgress });

    if (!_accumulatedContent.length) {
      tryCatchSend({ type: 'export-progress', status: 'error', msg: 'No conversations extracted. Page structure changed?' });
      return;
    }

    let allLines = [];
    for (let c = 0; c < _accumulatedContent.length; c++) {
      if (c > 0) allLines.push('\\n\\n---\\n\\n');
      allLines.push(formatSingleConv(_accumulatedContent[c].title, _accumulatedContent[c].messages));
    }
    const combinedMd = allLines.join('');
    const ts = formatTimestamp();
    const filename = `${platform}-all-history-${ts}.md`;
    tryCatchSend({ type: 'export-progress', status: 'done', msg: `Done! ${_accumulatedCount} conversations.\\nChoose save location.` });
    await triggerDownload(tabId, combinedMd, filename);

  } catch (err) {
    console.error('[BG] handleAllHistory error:', err);
    tryCatchSend({ type: 'export-progress', status: 'error', msg: err.message });
  }
}

// ── Message Handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'export-current') {
    handleCurrentChat(msg.platform, msg.tabId)
      .then(sendResponse)
      .catch(e => { console.error('[BG] export-current error:', e); sendResponse({ error: e.message }); });
    return true;
  }
  if (msg.type === 'export-all') {
    handleAllHistory(msg.platform, msg.tabId).catch(e => {
      console.error('[BG] export-all error:', e);
      tryCatchSend({ type: 'export-progress', status: 'error', msg: e.message });
    });
    return false;
  }
  if (msg.type === 'cancel-export') {
    _cancelRequested = true;
    tryCatchSend({ type: 'export-progress', status: 'done', msg: 'Stopped. Download ready...' });
    return false;
  }
});

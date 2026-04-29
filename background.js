// ===============================
// AI Chat History Exporter - Background Service Worker v2.1.1
// ===============================
'use strict';

// ── Helpers ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Random delay helper to avoid detection
function randomSleep(minMs, maxMs) {
  const randomMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(`[BG] Random delay: ${randomMs}ms (${minMs}-${maxMs}ms range)`);
  return sleep(randomMs);
}

// Get delay configuration
function getDelayTime(delayConfig) {
  if (!delayConfig) {
    return { minMs: 2000, maxMs: 4000 }; // Default: 2-4 seconds
  }
  const { minDelay, maxDelay } = delayConfig;
  return {
    minMs: minDelay * 1000,
    maxMs: maxDelay * 1000
  };
}

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

// ── PLATFORM REGISTRY ── (All platform logic encapsulated here)
const PLATFORM_REGISTRY = {
  chatgpt: {
    extractCurrent: () => {
      const main = document.querySelector('main');
      if (!main) return { title: 'ChatGPT Chat', messages: [] };
      const msgs = [];
      const turns = main.querySelectorAll('[data-testid^="conversation-turn-"]');
      for (const turn of turns) {
        const h4 = turn.querySelector('h4');
        const roleLabel = h4 ? h4.innerText.trim() : '';
        const allText = turn.innerText || '';
        let content = allText;
        if (roleLabel && content.startsWith(roleLabel)) content = content.slice(roleLabel.length).trim();
        const lines = content.split('\n').filter(l => l.trim());
        content = lines.join('\n').trim();
        if (!content) continue;
        const role = roleLabel.includes('ChatGPT') ? 'assistant' : 'user';
        msgs.push({ role, content });
      }
      const title = document.title?.trim() || 'ChatGPT Chat';
      return { title, messages: msgs };
    },
    extractConv: () => {
      const main = document.querySelector('main');
      if (!main) return [];
      const msgs = [];
      const turns = main.querySelectorAll('[data-testid^="conversation-turn-"]');
      for (const turn of turns) {
        const h4 = turn.querySelector('h4');
        const roleLabel = h4 ? h4.innerText.trim() : '';
        const allText = turn.innerText || '';
        let content = allText;
        if (roleLabel && content.startsWith(roleLabel)) content = content.slice(roleLabel.length).trim();
        const lines = content.split('\n').filter(l => l.trim());
        content = lines.join('\n').trim();
        if (!content) continue;
        const role = roleLabel.includes('ChatGPT') ? 'assistant' : 'user';
        msgs.push({ role, content });
      }
      return msgs;
    },
    getItems: () => {
      const nav = document.querySelector('nav');
      if (!nav) return [];
      const links = nav.querySelectorAll('a[href*="/c/"]');
      return Array.from(links).map(a => {
        const t = a.innerText.trim().replace(/\s+/g, ' ');
        if (t.length > 1 && !t.includes('新聊天') && !t.includes('Search') && a.offsetParent) {
          return { title: t, href: a.getAttribute('href') };
        }
      }).filter(Boolean);
    },
    openSidebar: () => {
      const nav = document.querySelector('nav');
      if (nav?.offsetParent) return;
      let toggle = document.querySelector('[aria-label*="打开边栏"], [aria-label*="Open sidebar"], button[aria-label*="sidebar"]');
      if (toggle) return toggle.click();
      for (const btn of document.querySelectorAll('button')) {
        const aria = btn.getAttribute('aria-label') || '';
        if (aria.includes('sidebar') || aria.includes('边栏')) return btn.click();
      }
      for (const btn of document.querySelectorAll('button')) {
        if (btn.innerText.trim().includes('打开边栏')) return btn.click();
      }
    },
    // Scroll sidebar to load all conversations (lazy loading)
    scrollSidebar: () => {
      const nav = document.querySelector('nav');
      if (!nav) return { count: 0, done: true };

      nav.scrollTop = nav.scrollHeight;

      // Count current conversation links
      const links = nav.querySelectorAll('a[href*="/c/"]');
      const items = Array.from(links).map(a => {
        const t = a.innerText.trim().replace(/\s+/g, ' ');
        if (t.length > 1 && !t.includes('新聊天') && !t.includes('Search') && a.offsetParent) {
          return { title: t, href: a.getAttribute('href') };
        }
      }).filter(Boolean);

      return { count: items.length, done: false };
    },
    // Debug: dump DOM structure for troubleshooting
    dumpDebug: () => {
      const main = document.querySelector('main');
      if (!main) return JSON.stringify({ error: 'no main', platform: 'chatgpt' });
      const turns = main.querySelectorAll('[data-testid^="conversation-turn-"]');
      const dump = { turns: turns.length, items: [] };
      for (let i = 0; i < Math.min(turns.length, 3); i++) {
        dump.items.push({
          h4: turns[i].querySelector('h4')?.innerText.trim() || 'null',
          innerText: (turns[i].innerText || '').slice(0, 100),
          childCount: turns[i].children.length
        });
      }
      return JSON.stringify(dump);
    }
  },
  claude: {
    extractCurrent: () => {
      const msgs = [];
      for (const um of document.querySelectorAll('[data-testid="user-message"]')) {
        let text = '';
        for (const p of um.querySelectorAll('p')) {
          const pt = p.innerText.trim();
          if (pt) text += (text ? '\n' : '') + pt;
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
    extractConv: () => {
      const msgs = [];
      for (const um of document.querySelectorAll('[data-testid="user-message"]')) {
        let text = '';
        for (const p of um.querySelectorAll('p')) {
          const pt = p.innerText.trim();
          if (pt) text += (text ? '\n' : '') + pt;
        }
        if (!text) text = um.innerText.trim();
        if (text) msgs.push({ role: 'user', content: text });
      }
      for (const am of document.querySelectorAll('p.font-claude-response-body')) {
        const text = am.innerText.trim();
        if (text) msgs.push({ role: 'assistant', content: text });
      }
      return msgs;
    },
    getItems: () => {
      const links = document.querySelectorAll('a[href*="/chat/"]');
      return Array.from(links).map(a => {
        const t = a.innerText.trim().replace(/\s+/g, ' ');
        if (t.length > 1 && !t.includes('New chat') && a.offsetParent) {
          return { title: t, href: a.getAttribute('href') };
        }
      }).filter(Boolean);
    },
    openSidebar: () => {
      const sidebarBtn = document.querySelector('[aria-label="Sidebar"], [aria-label*="sidebar" i], button[aria-label*="menu"]');
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
      const al = document.querySelector('a[href^="/c/"].font-semibold, a[href^="/c/"][class*="active"]');
      const title = al ? al.textContent.trim().split('\n')[0].trim() : 'Grok Chat';
      return { title, messages: msgs };
    },
    // Don't use 'this' - duplicate logic for page context injection
    extractConv: () => {
      const META = ['毫秒','快速模式','畅所欲言','privacy','cookie','解释chat history','推荐聊天记录','让 think','新建聊天','语音','imagine'];
      const main = document.querySelector('main');
      if (!main) return [];
      const msgs = [];
      for (const p of main.querySelectorAll('p')) {
        const text = p.textContent.trim();
        if (!text) continue;
        const lower = text.toLowerCase();
        if (META.some(m => lower.includes(m))) continue;
        msgs.push({ role: msgs.length % 2 === 0 ? 'user' : 'assistant', content: text });
      }
      return msgs;
    },
    // Get items from the Command Menu popup (after "See all" clicked)
    // The popup uses [role="option"] elements, where <a> is empty and title is in sibling spans
    getItems: () => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog || !dialog.offsetParent) {
        console.log('[Grok] No dialog found, falling back to sidebar');
        // Fallback: sidebar links
        const sidebar = document.querySelector('[class*="sidebar"], [class*="Sidebar"]');
        const links = sidebar ? sidebar.querySelectorAll('a[href^="/c/"]') : document.querySelectorAll('a[href^="/c/"]');
        return Array.from(links).map(a => {
          const t = a.textContent.trim().replace(/\s+/g, ' ');
          if (t && !t.includes('新建聊天') && !t.includes('New chat') && a.offsetParent) {
            return { title: t, href: a.getAttribute('href') };
          }
        }).filter(Boolean);
      }

      // Primary: Get items from [role="option"] elements
      // Structure: [role="option"] > a[href="/c/..."] (empty) + divs > span.truncate (title text)
      const options = dialog.querySelectorAll('[role="option"]');
      const items = [];

      options.forEach(opt => {
        const link = opt.querySelector('a[href^="/c/"]');
        if (!link) return; // Skip non-chat options like "Create New Private Chat"

        const href = link.getAttribute('href');

        // Title is in a span with class "truncate" or in the option's text
        let title = '';
        const truncateSpan = opt.querySelector('span.truncate, span[class*="truncate"]');
        if (truncateSpan) {
          title = truncateSpan.textContent.trim();
        } else {
          // Fallback: get all text from option, remove timestamp
          const fullText = opt.textContent.trim();
          // Remove "X hours ago", "X days ago", etc. from the end
          title = fullText.replace(/\s*(\d+\s*(hours?|days?|minutes?|weeks?)\s*ago)\s*$/i, '').trim();
        }

        if (title && href && !title.includes('Create New') && !title.includes('新建')) {
          items.push({ title, href });
        }
      });

      console.log('[Grok] Found', items.length, 'items in Command Menu');
      return items;
    },
    // Open Command Menu by clicking "See all" button
    // First expands sidebar if collapsed, then clicks "See all"
    openSidebar: () => {
      console.log('[Grok] Opening Command Menu...');

      // Step 1: Check if sidebar is collapsed (no chat links visible)
      const sidebar = document.querySelector('[class*="sidebar"], [class*="Sidebar"]');
      const chatLinks = sidebar ? sidebar.querySelectorAll('a[href^="/c/"]') : document.querySelectorAll('a[href^="/c/"]');
      const sidebarCollapsed = chatLinks.length === 0;

      if (sidebarCollapsed) {
        console.log('[Grok] Sidebar appears collapsed, expanding...');
        // Find and click Toggle Sidebar button
        const toggleBtn = Array.from(document.querySelectorAll('button')).find(btn =>
          btn.textContent?.includes('Toggle Sidebar')
        );
        if (toggleBtn) {
          toggleBtn.click();
          console.log('[Grok] Clicked Toggle Sidebar button');
        } else {
          console.warn('[Grok] Toggle Sidebar button not found');
        }
        // Return false to indicate we need to wait and retry
        return false;
      }

      // Step 2: Find and click "See all" button
      const allElements = document.querySelectorAll('button, a, div[role="button"], span, [role="button"]');
      for (const el of allElements) {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text === 'see all' || text.includes('see all')) {
          console.log('[Grok] Clicking "See all" button');
          el.click();
          return true;
        }
      }
      console.warn('[Grok] "See all" button not found');
      return false;
    },
    // Scroll the Command Menu popup once and return current item count
    // Call this multiple times from background.js with waits between calls
    scrollPopupOnce: () => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { count: 0, done: true };

      const findScrollable = (el) => {
        if (!el) return null;
        const style = window.getComputedStyle(el);
        const overflow = style.overflowY || style.overflow;
        if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 100) {
          return el;
        }
        for (const child of el.children) {
          const found = findScrollable(child);
          if (found) return found;
        }
        return null;
      };

      const scrollable = findScrollable(dialog);
      if (scrollable) {
        const beforeTop = scrollable.scrollTop;
        scrollable.scrollTop = scrollable.scrollHeight;
        const afterTop = scrollable.scrollTop;
        const atBottom = beforeTop === afterTop; // Already at bottom
      }

      const links = dialog.querySelectorAll('[role="option"] a[href^="/c/"]');
      return { count: links.length };
    },
    // Get all items from the dialog (call after scrolling is complete)
    getPopupItems: () => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return [];

      const options = dialog.querySelectorAll('[role="option"]');
      const items = [];
      const seen = new Set(); // Deduplicate by href

      options.forEach(opt => {
        const link = opt.querySelector('a[href^="/c/"]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (seen.has(href)) return; // Skip duplicates
        seen.add(href);

        let title = '';
        const truncateSpan = opt.querySelector('span.truncate, span[class*="truncate"]');
        if (truncateSpan) {
          title = truncateSpan.textContent.trim();
        } else {
          const fullText = opt.textContent.trim();
          title = fullText.replace(/\s*(\d+\s*(hours?|days?|minutes?|weeks?)\s*ago)\s*$/i, '').trim();
        }

        if (title && href && !title.includes('Create New') && !title.includes('新建')) {
          items.push({ title, href });
        }
      });

      return items;
    }
  },
  gemini: {
    extractCurrent: () => {
      const META = ['gemini is still syncing','gemini is ai and can make mistakes','enter a prompt','temporary chat','upgrade to google ai plus'];
      const main = document.querySelector('main');
      if (!main) return { title: 'Gemini Chat', messages: [] };
      const msgs = [];
      for (const h of main.querySelectorAll('h2, [role="heading"][aria-level="2"]')) {
        const text = h.textContent.trim();
        if (text.includes('You said')) {
          const inner = h.innerText || h.textContent;
          const parts = inner.split('\n\n');
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
          if (content.length) msgs.push({ role: 'assistant', content: content.join('\n') });
        }
      }
      const h1 = main.querySelector('h1');
      const title = h1 ? h1.textContent.trim() : 'Gemini Chat';
      return { title, messages: msgs };
    },
    extractConv: () => {
      const META = ['gemini is still syncing','gemini is ai and can make mistakes','enter a prompt','temporary chat','upgrade to google ai plus'];
      const main = document.querySelector('main');
      if (!main) return [];
      const msgs = [];
      for (const h of main.querySelectorAll('h2, [role="heading"][aria-level="2"]')) {
        const text = h.textContent.trim();
        if (text.includes('You said')) {
          const inner = h.innerText || h.textContent;
          const parts = inner.split('\n\n');
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
          if (content.length) msgs.push({ role: 'assistant', content: content.join('\n') });
        }
      }
      return msgs;
    },
    getItems: () => {
      // Use bard-sidenav which is the actual sidebar container
      const sideNav = document.querySelector('bard-sidenav');
      if (!sideNav) return [];
      const links = sideNav.querySelectorAll('a[href*="/app/"]');
      return Array.from(links).map(a => {
        const t = a.textContent.trim().replace(/\s+/g, ' ');
        const href = a.getAttribute('href') || '';
        if (href !== '/app' && href !== 'mystuff' && href !== '/gems/view' && t && !['Gemini', 'New chat', 'My stuff', 'Gems'].includes(t)) {
          return { title: t, href };
        }
      }).filter(Boolean);
    },
    openSidebar: () => {
      const sidebar = document.querySelector('bard-sidenav');
      const isExpanded = sidebar && sidebar.offsetWidth > 100;

      if (isExpanded) {
        return true; // Already open
      }

      const b = document.querySelector('button[aria-label="Main menu"]');
      if (b) {
        b.click();
        return true;
      }
      return false;
    },
    // Scroll sidebar to load all conversations (lazy loading)
    scrollSidebar: () => {
      // Find the scroller inside the sidebar
      const scroller = document.querySelector('bard-sidenav infinite-scroller');
      if (!scroller) return { count: 0, done: true };

      scroller.scrollTop = scroller.scrollHeight;

      // Count current conversation links in the sidebar
      const sidebar = document.querySelector('bard-sidenav');
      const links = sidebar ? sidebar.querySelectorAll('a[href*="/app/"]') : [];
      return { count: links.length, done: false };
    },
    // Debug: dump heading structure
    dumpDebug: () => {
      const main = document.querySelector('main');
      if (!main) return JSON.stringify({ error: 'no main', platform: 'gemini' });
      const hs = main.querySelectorAll('h2, [role="heading"][aria-level="2"]');
      const dump = { hs: hs.length, items: [] };
      for (let i = 0; i < Math.min(hs.length, 3); i++) {
        dump.items.push({
          text: hs[i].textContent.trim().slice(0, 80),
          tag: hs[i].tagName
        });
      }
      return JSON.stringify(dump);
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
  toast.textContent = '✓ ' + title;
  toast.style.cssText = 'position:fixed;bottom:60px;right:16px;z-index:999999;background:#16a34a;color:#fff;padding:6px 14px;border-radius:8px;font-size:12px;font-family:system-ui;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:1;transition:opacity 0.5s;';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2500);
}

function showDebugOverlay(text) {
  const div = document.createElement('div');
  div.textContent = 'DEBUG: ' + (text || 'no data').slice(0, 500);
  div.style.cssText = 'position:fixed;top:0;left:0;z-index:9999999;background:#111;color:#0f0;font-size:12px;font-family:monospace;padding:10px;max-width:100%;opacity:0.95;line-height:1.6;overflow:auto;max-height:200px;';
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 20000);
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
        const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]').length;
        const userMsgs = document.querySelectorAll('[data-testid="user-message"]').length;
        const hs = document.querySelectorAll('h2, [role="heading"][aria-level="2"]').length;
        const ps = document.querySelectorAll('main p').length;
        const bodyLen = document.body.innerText.length;
        const firstTurn = document.querySelector('[data-testid^="conversation-turn-"]');
        const turnHasContent = firstTurn ? (firstTurn.innerText || '').trim().length > 5 : false;
        return { turns, userMsgs, hs, ps, bodyLen, turnHasContent, url: window.location.href };
      }
    });
    const info = result[0].result;
    console.log(`[BG] Page check (${totalMs}ms):`, info);

    let ready = false;
    if (platform === 'chatgpt') ready = info.turns >= 2 && info.turnHasContent;
    else if (platform === 'claude') ready = info.userMsgs >= 1;
    else if (platform === 'grok') ready = info.ps > 3 && info.bodyLen > 100;
    else if (platform === 'gemini') ready = info.hs >= 2;

    if (ready) {
      console.log(`[BG] Page ready at ${totalMs}ms — URL:`, info.url);
      return;
    }
    await sleep(stepMs);
    totalMs += stepMs;
  }
  console.log(`[BG] Page wait timeout at ${maxWaitMs}ms`);
}

// ── Download
async function triggerDownload(tabId, content, filename, platform) {
  console.log('[BG] triggerDownload called');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const dataUrl = await new Promise(r => {
    const reader = new FileReader();
    reader.onload = () => r(reader.result);
    reader.readAsDataURL(blob);
  });
  try {
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

        // Show prominent toast
        const platformName = data.platform.charAt(0).toUpperCase() + data.platform.slice(1);
        const toast = document.createElement('div');
        toast.innerHTML = '<span style="font-size:16px">✓</span> ' + platformName + ' Export Ready<br><span style="font-size:11px;opacity:0.85">' + data.filename + '</span>';
        toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:20px 32px;border-radius:14px;font-size:14px;font-family:system-ui;font-weight:600;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4);line-height:1.6;';
        document.body.appendChild(toast);
        setTimeout(() => {
          toast.style.transition = 'opacity 0.5s';
          toast.style.opacity = '0';
          setTimeout(() => toast.remove(), 500);
        }, 4000);
      },
      args: [{ url: dataUrl, filename, platform }]
    });
    console.log('[BG] Download triggered');
  } catch(e) {
    console.error('[BG] triggerDownload error:', e.message);
    throw e;
  }
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
  await triggerDownload(tabId, md, filename, platform);
  return { lines: md.split('\n').length };
}

// ── All History Export
let _cancelRequested = false;
let _accumulatedContent = [];
let _accumulatedCount = 0;

async function handleAllHistory(platform, tabId, delayConfig = null) {
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

    // Open sidebar and load full history
    // May need to try twice: first to expand sidebar, then to click "See all"
    tryCatchSend({ type: 'export-progress', msg: 'Opening full history panel…' });

    for (let attempt = 0; attempt < 2; attempt++) {
      const openResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: fns.openSidebar
      });
      const clicked = openResult[0].result;
      console.log(`[BG] openSidebar attempt ${attempt + 1}:`, clicked);

      if (clicked === true) {
        // "See all" was clicked, done
        break;
      } else if (clicked === false) {
        // Sidebar was expanded, need to wait and retry
        console.log('[BG] Sidebar expanded, waiting and retrying...');
        await sleep(2000);
      } else {
        // Unknown state, wait and continue
        await sleep(1000);
      }
    }

    // Wait for popup to open
    await sleep(3000);

    // Determine which scroll and getItems functions to use based on platform
    // Grok: Command Menu popup with scrollPopupOnce + getPopupItems
    // Gemini/ChatGPT: sidebar with scrollSidebar + getItems
    // Claude: getItems directly (check if lazy loading is needed)
    let scrollFn = null;
    let getItemsFn = null;
    let scrollWait = 800;

    if (platform === 'grok') {
      scrollFn = fns.scrollPopupOnce;
      getItemsFn = fns.getPopupItems;
      scrollWait = 800;
    } else if (platform === 'gemini' || platform === 'chatgpt') {
      scrollFn = fns.scrollSidebar;
      getItemsFn = fns.getItems;
      scrollWait = platform === 'gemini' ? 1500 : 1000;
    } else {
      getItemsFn = fns.getItems;
    }

    let items = [];
    if (scrollFn) {
      console.log('[BG] Scrolling to load all items...');
      tryCatchSend({ type: 'export-progress', msg: 'Loading conversations… 0 loaded' });

      let lastCount = 0;
      let sameCountTimes = 0;
      const maxScrolls = 100;

      for (let i = 0; i < maxScrolls; i++) {
        const scrollResult = await chrome.scripting.executeScript({
          target: { tabId },
          func: scrollFn
        });
        const count = scrollResult[0].result?.count || 0;
        console.log(`[BG] Scroll ${i + 1}: ${count} items`);

        // Update progress with current count
        tryCatchSend({ type: 'export-progress', msg: `Loading conversations… ${count} loaded` });

        if (count === lastCount) {
          sameCountTimes++;
          if (sameCountTimes >= 10) {
            console.log('[BG] No new items after 10 scrolls, done');
            break;
          }
        } else {
          sameCountTimes = 0;
          lastCount = count;
        }

        await sleep(scrollWait);
      }

      // Get all items after scrolling
      if (getItemsFn) {
        const itemsResult = await chrome.scripting.executeScript({
          target: { tabId },
          func: getItemsFn
        });
        items = itemsResult[0].result || [];
      }
      console.log(`[BG] Items from popup/sidebar: ${items.length}`);
    }

    // Fallback: use getItems directly if no scroll function or no items found
    if (!items.length && fns.getItems) {
      console.log('[BG] Falling back to getItems...');
      tryCatchSend({ type: 'export-progress', msg: 'Finding conversations…' });
      const itemsResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: fns.getItems
      });
      items = itemsResult[0].result || [];
    }

    console.log(`[BG] Total items to export: ${items.length}`);
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
      console.log(`[BG] Processing item ${i + 1}/${total}:`, item.title);

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

      let messages = [];
      if (navUrl) {
        try {
          await navToPage(tabId, navUrl);
          await waitForPageReady(tabId, platform);
          const delayTimes = getDelayTime(delayConfig);
          await randomSleep(delayTimes.minMs, delayTimes.maxMs);

          // Poll extraction until we get messages (with timeout)
          let extractionDone = false;
          let waitMs = 0;
          while (waitMs < 8000 && !extractionDone) {
            const exResult = await chrome.scripting.executeScript({
              target: { tabId },
              func: fns.extractConv
            });
            messages = exResult[0].result || [];
            console.log(`[BG] Extraction attempt (${waitMs}ms): ${messages.length} messages`);
            if (messages.length > 0) {
              extractionDone = true;
            } else {
              await sleep(1000);
              waitMs += 1000;
            }
          }

          // Debug overlay if no messages found
          if (messages.length === 0 && fns.dumpDebug) {
            try {
              const dumpResult = await chrome.scripting.executeScript({
                target: { tabId },
                func: fns.dumpDebug
              });
              const dump = dumpResult[0].result;
              console.log('[BG] DOM dump:', dump);
              await chrome.scripting.executeScript({
                target: { tabId },
                func: showDebugOverlay,
                args: [dump]
              });
            } catch(e) { console.warn('[BG] debug dump error:', e.message); }
          }
        } catch(e) {
          console.error('[BG] Nav/wait error:', e.message);
          errors++;
          continue;
        }
      }

      if (messages.length > 0) {
        _accumulatedContent.push({ title: item.title, messages });
        _accumulatedCount++;
        await chrome.scripting.executeScript({
          target: { tabId },
          func: showToast,
          args: [item.title]
        });

        // Add small random delay before next conversation to simulate human behavior
        if (i < items.length - 1) { // Don't delay after the last one
          const smallDelay = getDelayTime(delayConfig);
          await randomSleep(
            Math.floor(smallDelay.minMs / 2), // Half the main delay
            Math.floor(smallDelay.maxMs / 2)
          );
        }
      } else {
        errors++;
        console.warn('[BG] No messages for:', item.title);
      }
    }

    await chrome.scripting.executeScript({ target: { tabId }, func: clearProgress });

    if (!_accumulatedContent.length) {
      tryCatchSend({ type: 'export-progress', status: 'error', msg: 'No conversations extracted. Page structure changed?' });
      return;
    }
    console.log(`[BG] Loop done, accumulated: ${_accumulatedContent.length}, cancelRequested: ${_cancelRequested}`);

    let allLines = [];
    for (let c = 0; c < _accumulatedContent.length; c++) {
      if (c > 0) allLines.push('\n\n---\n\n');
      allLines.push(formatSingleConv(_accumulatedContent[c].title, _accumulatedContent[c].messages));
    }
    const combinedMd = allLines.join('');
    const ts = formatTimestamp();
    const filename = `${platform}-all-history-${ts}.md`;
    console.log(`[BG] Markdown length: ${combinedMd.length}, triggering download: ${filename}`);

    tryCatchSend({ type: 'export-progress', status: 'done', msg: `Done! ${_accumulatedCount} conversations.\nChoose where to save\n\nSupport the dev: ko-fi.com/jerryopen` });
    await triggerDownload(tabId, combinedMd, filename, platform);

  } catch(err) {
    console.error('[BG] handleAllHistory error:', err);
    tryCatchSend({ type: 'export-progress', status: 'error', msg: err.message });
    try { await chrome.scripting.executeScript({ target: { tabId }, func: clearProgress }); } catch(e2) {}
  }
}

// ── Message Handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[BG] Message received:', JSON.stringify(msg));
  if (msg.type === 'export-current') {
    handleCurrentChat(msg.platform, msg.tabId)
      .then(sendResponse)
      .catch(e => { console.error('[BG] export-current error:', e); sendResponse({ error: e.message }); });
    return true;
  }
  if (msg.type === 'export-all') {
    handleAllHistory(msg.platform, msg.tabId, msg.delayConfig).catch(e => {
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

// extractors/chatgpt.js — ChatGPT extraction functions
// All run in the page's ISOLATED world via chrome.scripting.executeScript

function chatgptExtractCurrent() {
  var main = document.querySelector('main');
  if (!main) return { title: "ChatGPT Chat", messages: [] };
  var msgs = [];
  var turns = main.querySelectorAll('[data-testid^="conversation-turn-"]');
  for (var i = 0; i < turns.length; i++) {
    var turn = turns[i];
    var h4 = turn.querySelector('h4');
    var roleLabel = h4 ? h4.innerText.trim() : '';
    // Collect all text content from the turn
    var allText = turn.innerText || '';
    // Remove the role label from the beginning if it appears
    var content = allText;
    if (roleLabel && content.indexOf(roleLabel) === 0) {
      content = content.substring(roleLabel.length).trim();
    }
    // Split by newlines and filter empty
    var lines = content.split('\n').filter(function(l) { return l.trim().length > 0; });
    content = lines.join('\n').trim();
    if (!content) continue;
    var role = roleLabel.indexOf('ChatGPT') !== -1 ? 'assistant' : 'user';
    msgs.push({ role: role, content: content });
  }
  var title = (document.title || 'ChatGPT Chat').trim();
  return { title: title, messages: msgs };
}

function chatgptExtractConv() {
  return chatgptExtractCurrent().messages;
}

function chatgptGetItems() {
  var nav = document.querySelector('nav');
  if (!nav) return [];
  var links = nav.querySelectorAll('a[href*="/c/"]');
  var items = [];
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var t = a.innerText.trim().replace(/\s+/g, ' ');
    if (t && t.length > 1 && t.indexOf('新聊天') === -1 && t.indexOf('Search') === -1 && a.offsetParent !== null) {
      items.push({ title: t, href: a.getAttribute('href') });
    }
  }
  return items;
}

function chatgptOpenSidebar() {
  var nav = document.querySelector('nav');
  if (nav && nav.offsetParent !== null) return;
  var toggle = document.querySelector('[aria-label*="打开边栏"], [aria-label*="Open sidebar"], button[aria-label*="sidebar"]');
  if (toggle) { toggle.click(); return; }
  var allButtons = document.querySelectorAll('button');
  for (var i = 0; i < allButtons.length; i++) {
    var aria = allButtons[i].getAttribute('aria-label') || '';
    if (aria.indexOf('sidebar') !== -1 || aria.indexOf('边栏') !== -1) { allButtons[i].click(); return; }
  }
  var btns = document.querySelectorAll('button');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].innerText.trim().indexOf('打开边栏') !== -1) { btns[i].click(); return; }
  }
}

// extractors/claude.js — Claude extraction functions

function claudeExtractCurrent() {
  var msgs = [];
  var userMsgs = document.querySelectorAll('[data-testid="user-message"]');
  for (var i = 0; i < userMsgs.length; i++) {
    var um = userMsgs[i];
    var ps = um.querySelectorAll('p');
    var text = '';
    for (var j = 0; j < ps.length; j++) {
      var pt = ps[j].innerText.trim();
      if (pt) text += (text ? '\n' : '') + pt;
    }
    if (!text) text = um.innerText.trim();
    if (text) msgs.push({ role: 'user', content: text });
  }
  var assistantMsgs = document.querySelectorAll('p.font-claude-response-body');
  for (var i = 0; i < assistantMsgs.length; i++) {
    var text = assistantMsgs[i].innerText.trim();
    if (text) msgs.push({ role: 'assistant', content: text });
  }
  var title = 'Claude Chat';
  var headings = document.querySelectorAll('h1');
  for (var i = 0; i < headings.length; i++) {
    var ht = headings[i].innerText.trim();
    if (ht && ht.length > 1 && ht.length < 200) { title = ht; break; }
  }
  return { title: title, messages: msgs };
}

function claudeExtractConv() {
  return claudeExtractCurrent().messages;
}

function claudeGetItems() {
  var links = document.querySelectorAll('a[href*="/chat/"]');
  var items = [];
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var t = a.innerText.trim().replace(/\s+/g, ' ');
    if (t && t.length > 1 && t.indexOf('New chat') === -1 && a.offsetParent !== null) {
      items.push({ title: t, href: a.getAttribute('href') });
    }
  }
  return items;
}

function claudeOpenSidebar() {
  var sidebarBtn = document.querySelector('[aria-label="Sidebar"], [aria-label*="sidebar" i], button[aria-label*="menu"]');
  if (sidebarBtn) sidebarBtn.click();
}

// extractors/grok.js — Grok extraction functions

function grokExtractCurrent() {
  var META = ["毫秒","快速模式","畅所欲言","privacy","cookie","解释chat history","推荐聊天记录","让 think","新建聊天","语音","imagine"];
  var main = document.querySelector("main");
  if (!main) return { title: "Grok Chat", messages: [] };
  var msgs = [];
  var ps = main.querySelectorAll("p");
  for (var i = 0; i < ps.length; i++) {
    var text = ps[i].textContent.trim();
    if (!text) continue;
    var lower = text.toLowerCase();
    var skip = false;
    for (var j = 0; j < META.length; j++) { if (lower.indexOf(META[j]) !== -1) { skip = true; break; } }
    if (skip) continue;
    msgs.push({ role: msgs.length % 2 === 0 ? "user" : "assistant", content: text });
  }
  var al = document.querySelector('a[href^="/c/"].font-semibold, a[href^="/c/"][class*="active"]');
  var title = al ? al.textContent.trim().split("\n")[0].trim() : "Grok Chat";
  return { title: title, messages: msgs };
}

function grokExtractConv() {
  return grokExtractCurrent().messages;
}

function grokGetItems() {
  // Get items from command menu (which grokOpenSidebar opened)
  var items = grokGetItemsFromCommandMenu();
  if (items && items.length > 0) return items;

  // Fallback: get from sidebar (visible only)
  var links = document.querySelectorAll('aside a[href^="/c/"], nav a[href^="/c/"]');
  var items2 = [];
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var t = a.textContent.trim().replace(/\s+/g, " ");
    if (t && t.indexOf("新建聊天") === -1 && a.offsetParent !== null) {
      items2.push({ title: t, href: a.getAttribute("href") });
    }
  }
  return items2;
}

function grokGetItemsFromCommandMenu() {
  // The command menu should be open after grokOpenSidebar() was called
  // The <a> elements are empty (text is in sibling divs due to CSS grid layout)
  // We need to find each item, then extract text from sibling divs
  
  var cmdDialog = document.querySelector('div[data-analytics-name="command_menu"]');
  var items = [];
  
  if (cmdDialog) {
    // Get all cmdk-item divs that contain conversation links
    var itemDivs = cmdDialog.querySelectorAll('[cmdk-item][data-value^="conversation:"]');
    for (var i = 0; i < itemDivs.length; i++) {
      var item = itemDivs[i];
      var link = item.querySelector('a[href^="/c/"]');
      if (!link) continue;
      
      var href = link.getAttribute("href");
      
      // The text is in a sibling div, not inside <a>
      // Find the div with text class inside this item
      var textEl = item.querySelector('[class*="text-fg-primary"]');
      if (!textEl) {
        // Try to get any text from the item (excluding time stamps)
        var allText = item.textContent || '';
        // Remove timestamp patterns like "3小时前", "昨天", etc.
        var cleanText = allText.replace(/\d+(小时|天|月|年)前|\d+月\d+日|\d+年\d+月\d+日/g, '').trim();
        cleanText = cleanText.replace(/\s+/g, ' ').trim();
        if (cleanText && cleanText.length > 2 && cleanText.indexOf("新建私密聊天") === -1) {
          items.push({ title: cleanText, href: href });
        }
      } else {
        var title = textEl.textContent.trim().replace(/\s+/g, " ");
        if (title && title.indexOf("新建私密聊天") === -1) {
          items.push({ title: title, href: href });
        }
      }
    }
  }
  
  return items;
}

function grokOpenSidebar() {
  // Check if command menu is already open
  var cmdDialog = document.querySelector('div[data-analytics-name="command_menu"]');
  if (cmdDialog && cmdDialog.querySelector('[cmdk-list]')) return; // Already open
  
  // Find and click "显示全部" (or "See all" / "Show all") button
  // The button is inside a div with text "显示全部" or "See all"
  // Based on the HTML, it's a div with text "显示全部" inside cmdk-group-heading
  var allElements = document.querySelectorAll('div, span, a, button');
  for (var i = 0; i < allElements.length; i++) {
    var el = allElements[i];
    var text = (el.textContent || '').trim();
    // Match "全部" (Chinese), "See all", "Show all" or just "all"
    if (text === "显示全部" || text === "See all" || text === "Show all" || text === "all") {
      el.click();
      return;
    }
  }
}

// extractors/gemini.js — Gemini extraction functions

function geminiExtractCurrent() {
  var META = ["gemini is still syncing","gemini is ai and can make mistakes","enter a prompt","temporary chat","upgrade to google ai plus"];
  var main = document.querySelector("main");
  if (!main) return { title: "Gemini Chat", messages: [] };
  var msgs = [];
  var hs = main.querySelectorAll("h2, [role='heading'][aria-level='2']");
  for (var i = 0; i < hs.length; i++) {
    var n = hs[i];
    var text = n.textContent.trim();
    var inner = n.innerText || n.textContent;
    if (text.indexOf("You said") !== -1) {
      var parts = inner.split("\n\n");
      var msg = parts.length > 1 ? parts[1].trim() : parts[0].replace("You said","").trim();
      if (msg) msgs.push({ role: "user", content: msg });
    } else if (text.indexOf("Gemini said") !== -1 || text.indexOf("AI said") !== -1) {
      var content = [];
      var next = n.nextElementSibling;
      while (next) {
        var tag = next.tagName.toLowerCase();
        if (tag === "h2" || (tag === "div" && next.getAttribute("role") === "heading")) break;
        if (tag === "p" || tag === "structured-content-container") {
          var pt = next.textContent.trim();
          var lower = pt.toLowerCase();
          var skip = false;
          for (var j = 0; j < META.length; j++) { if (lower.indexOf(META[j]) !== -1) { skip = true; break; } }
          if (!skip && pt) content.push(pt);
        }
        next = next.nextElementSibling;
      }
      if (content.length > 0) msgs.push({ role: "assistant", content: content.join("\n") });
    }
  }
  var h1 = main.querySelector("h1");
  var title = h1 ? h1.textContent.trim() : "Gemini Chat";
  return { title: title, messages: msgs };
}

function geminiExtractConv() {
  return geminiExtractCurrent().messages;
}

function geminiGetItems() {
  var sideNav = document.querySelector('.side-nav-open, side-nav-menu');
  if (!sideNav) return [];
  var links = sideNav.querySelectorAll('a[href*="/app/"]');
  var items = [];
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var t = a.textContent.trim().replace(/\s+/g, " ");
    var href = a.getAttribute("href") || "";
    if (href === "/app" || href === "mystuff" || href === "/gems/view") continue;
    if (t && t !== "Gemini" && t !== "New chat" && t !== "My stuff" && t !== "Gems") {
      items.push({ title: t, href: href });
    }
  }
  return items;
}

function geminiOpenSidebar() {
  var sideNav = document.querySelector('.side-nav-open, side-nav-menu.side-nav-open');
  if (sideNav) return;
  var b = document.querySelector('button[aria-label="Main menu"]');
  if (b) b.click();
}

// background.js — extension controller
// Extraction logic lives in extractors/*.js (loaded via manifest.json)

// ── Helpers ──────────────────────────────────────────────────
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function formatSingleConv(title, messages) {
  var lines = [];
  lines.push("# " + title);
  lines.push("");
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    lines.push("**" + (m.role === "user" ? "You" : "Assistant") + "**");
    lines.push(m.content);
    lines.push("");
  }
  return lines.join("\n");
}

function formatTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function tryCatchSend(msg) {
  try {
    chrome.runtime.sendMessage(msg, function() {
      if (chrome.runtime.lastError) {
        console.warn("[BG] sendMessage lastError:", chrome.runtime.lastError.message);
      }
    });
  } catch(e) { console.warn("[BG] tryCatchSend error:", e.message); }
}

function cancelExport() { _cancelRequested = true; }

// ── Page HUD (injected into tab) ─────────────────────────────
function showProgress(current, total, msg) {
  var el = document.getElementById("__ai_export_progress__");
  if (!el) {
    el = document.createElement("div");
    el.id = "__ai_export_progress__";
    el.style.cssText = "position:fixed;bottom:8px;right:8px;z-index:99999;background:rgba(0,0,0,0.85);color:#fff;padding:12px 16px;border-radius:10px;font-size:13px;font-family:system-ui,sans-serif;opacity:1;pointer-events:none;max-width:360px;word-break:break-all;line-height:1.6;box-shadow:0 4px 20px rgba(0,0,0,0.4);";
    document.body.appendChild(el);
  }
  el.textContent = "[" + current + "/" + total + "] " + msg;
}

function clearProgress() {
  var el = document.getElementById("__ai_export_progress__");
  if (el) el.parentNode.removeChild(el);
}

function showToast(title) {
  var toast = document.createElement("div");
  toast.textContent = "\u2705 " + title;
  toast.style.cssText = "position:fixed;bottom:60px;right:16px;z-index:999999;background:#16a34a;color:#fff;padding:6px 14px;border-radius:8px;font-size:12px;font-family:system-ui;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:1;transition:opacity 0.5s;";
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = "0"; setTimeout(function() { toast.remove(); }, 500); }, 2500);
}

// ── Navigation: go to URL via page injection (more reliable than chrome.tabs.update)
async function navToPage(tabId, url) {
  // Use chrome.tabs.update for navigation (more reliable)
  await chrome.tabs.update(tabId, { url: url });
  // Give the tab time to start navigating
  await sleep(800);
}

// ── Wait for page content to appear after navigation ──────────
async function waitForPageReady(tabId, platform, maxWaitMs) {
  var totalMs = 0;
  var stepMs = 600;
  while (totalMs < maxWaitMs) {
    try {
      var result = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function() {
          var turns = document.querySelectorAll('[data-testid^="conversation-turn-"]').length;
          var userMsgs = document.querySelectorAll('[data-testid="user-message"]').length;
          var hs = document.querySelectorAll('h2, [role="heading"][aria-level="2"]').length;
          var ps = document.querySelectorAll('main p').length;
          var bodyLen = (document.body.innerText || '').length;
          var firstTurn = document.querySelector('[data-testid^="conversation-turn-"]');
          var turnHasContent = firstTurn ? (firstTurn.innerText || '').trim().length > 5 : false;
          return { turns: turns, userMsgs: userMsgs, hs: hs, ps: ps, bodyLen: bodyLen, turnHasContent: turnHasContent, url: window.location.href };
        },
      });
      var info = result[0].result;
      console.log("[BG] Page check (" + totalMs + "ms):", JSON.stringify(info));
      var ready = false;
      if (platform === "chatgpt") ready = info.turns >= 2 && info.turnHasContent;
      else if (platform === "claude") ready = info.userMsgs >= 1;
      else if (platform === "grok") ready = info.ps > 3 && info.bodyLen > 100;
      else if (platform === "gemini") ready = info.hs >= 2;
      if (ready) {
        console.log("[BG] Page ready at", totalMs, "ms — URL:", info.url);
        return;
      }
    } catch(e) {
      console.warn("[BG] Page check error:", e.message);
    }
    await sleep(stepMs);
    totalMs += stepMs;
  }
  console.log("[BG] Page wait timeout at", maxWaitMs, "ms");
}

// ── Extract all messages from current page, returning raw text for debug ─
async function extractAllMessages(tabId, platform) {
  var result = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function() {
      // ChatGPT: dump ALL text content from main element
      if (platform === "chatgpt") {
        var main = document.querySelector('main');
        if (!main) return JSON.stringify({ error: "no main", platform: "chatgpt" });
        var turns = main.querySelectorAll('[data-testid^="conversation-turn-"]');
        var dump = { turns: turns.length, items: [] };
        for (var i = 0; i < Math.min(turns.length, 3); i++) {
          dump.items.push({
            h4: turns[i].querySelector('h4') ? turns[i].querySelector('h4').innerText.trim() : "null",
            innerText: (turns[i].innerText || "").slice(0, 100),
            childCount: turns[i].children.length
          });
        }
        return JSON.stringify(dump);
      }
      // Gemini: dump heading-based structure
      if (platform === "gemini") {
        var main = document.querySelector('main');
        if (!main) return JSON.stringify({ error: "no main", platform: "gemini" });
        var hs = main.querySelectorAll('h2, [role="heading"][aria-level="2"]');
        var dump = { hs: hs.length, items: [] };
        for (var i = 0; i < Math.min(hs.length, 3); i++) {
          dump.items.push({
            text: hs[i].textContent.trim().slice(0, 80),
            tag: hs[i].tagName
          });
        }
        return JSON.stringify(dump);
      }
      return JSON.stringify({ error: "unknown platform" });
    },
    args: [],
  });
  return result[0].result;
}

// ── Download (page-injected, single Save As) ─────────────────
async function triggerDownload(tabId, content, filename) {
  console.log("[BG] triggerDownload called");
  var blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  var dataUrl = await new Promise(function(resolve) {
    var r = new FileReader();
    r.onload = function() { resolve(r.result); };
    r.readAsDataURL(blob);
  });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function(data) {
        var a = document.createElement("a");
        a.href = data.url;
        a.download = data.filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        var toast = document.createElement("div");
        toast.textContent = "\u2705 Saved: " + data.filename;
        toast.style.cssText = "position:fixed;bottom:60px;right:16px;z-index:999999;background:#16a34a;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;font-family:system-ui;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 5000);
      },
      args: [{ url: dataUrl, filename: filename }],
    });
    console.log("[BG] Download triggered");
  } catch(e) {
    console.error("[BG] triggerDownload error:", e.message);
    throw e;
  }
}

// ── Single chat export ────────────────────────────────────────
async function handleCurrentChat(platform, tabId) {
  console.log("[BG] handleCurrentChat called, tabId=", tabId, "platform=", platform);
  var fn;
  if (platform === 'grok') fn = grokExtractCurrent;
  else if (platform === 'chatgpt') fn = chatgptExtractCurrent;
  else if (platform === 'claude') fn = claudeExtractCurrent;
  else if (platform === 'gemini') fn = geminiExtractCurrent;
  if (!fn) throw new Error("No extractor found for: " + platform);
  var results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: fn,
    });
    console.log("[BG] extract results:", JSON.stringify(results[0]).slice(0, 200));
  } catch(e) {
    console.error("[BG] executeScript error:", e.message);
    throw e;
  }
  var result = results[0].result;
  if (!result || !result.messages || result.messages.length === 0) {
    throw new Error("No chat messages found on this page.");
  }
  var md = formatSingleConv(result.title, result.messages);
  var ts = formatTimestamp();
  var filename = platform + "-chat-" + ts + ".md";
  await triggerDownload(tabId, md, filename);
  return { lines: md.split("\n").length };
}

// ── All history export ───────────────────────────────────────
var _cancelRequested = false;
var _accumulatedContent = [];
var _accumulatedCount = 0;

async function handleAllHistory(platform, tabId) {
  console.log("[BG] handleAllHistory starting for", platform, "tabId=", tabId);
  _cancelRequested = false;
  _accumulatedContent = [];
  _accumulatedCount = 0;

  var tabUrl = "";
  try {
    var tabInfo = await chrome.tabs.get(tabId);
    tabUrl = tabInfo.url || "";
    console.log("[BG] Current tab URL:", tabUrl);
  } catch(e) {
    console.warn("[BG] Could not get tab URL:", e.message);
  }

  try {
    // Init HUD
    tryCatchSend({ type: "export-progress", msg: "Initializing…" });
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function(msg) {
        var el = document.getElementById("__ai_export_progress__");
        if (!el) {
          el = document.createElement("div");
          el.id = "__ai_export_progress__";
          el.style.cssText = "position:fixed;bottom:8px;right:8px;z-index:99999;background:rgba(0,0,0,0.85);color:#fff;padding:12px 16px;border-radius:10px;font-size:13px;font-family:system-ui,sans-serif;pointer-events:none;max-width:360px;word-break:break-all;line-height:1.6;box-shadow:0 4px 20px rgba(0,0,0,0.4);";
          document.body.appendChild(el);
        }
        el.textContent = msg;
      },
      args: ["Initializing…"],
    });

    // Open sidebar
    tryCatchSend({ type: "export-progress", msg: "Opening sidebar…" });
    // Open sidebar — use explicit platform mapping (no dynamic window[] in SW)
    var openSidebarFn;
    if (platform === 'grok') openSidebarFn = grokOpenSidebar;
    else if (platform === 'chatgpt') openSidebarFn = chatgptOpenSidebar;
    else if (platform === 'claude') openSidebarFn = claudeOpenSidebar;
    else if (platform === 'gemini') openSidebarFn = geminiOpenSidebar;
    if (openSidebarFn) {
      await chrome.scripting.executeScript({ target: { tabId: tabId }, func: openSidebarFn });
    }
    await sleep(1500);

    // Scroll to load more
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function() {
        var r = document.querySelector("main region") || document.querySelector("nav, aside") || document.body;
        var prev = 0;
        for (var i = 0; i < 30; i++) {
          r.scrollTop = r.scrollHeight;
          if (r.scrollHeight === prev) break;
          prev = r.scrollHeight;
        }
      },
    });
    await sleep(1000);

    // Get items
    tryCatchSend({ type: "export-progress", msg: "Finding conversations…" });
    var getItemsFn;
    if (platform === 'grok') getItemsFn = grokGetItems;
    else if (platform === 'chatgpt') getItemsFn = chatgptGetItems;
    else if (platform === 'claude') getItemsFn = claudeGetItems;
    else if (platform === 'gemini') getItemsFn = geminiGetItems;
    if (!getItemsFn) {
      tryCatchSend({ type: "export-progress", status: "error", msg: "No getItems function for: " + platform });
      return;
    }
    var itemsResult;
    console.log('[BG] About to executeScript for platform:', platform, 'tabId:', tabId);
    try {
      itemsResult = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: getItemsFn,
      });
      var items = itemsResult && itemsResult[0] && itemsResult[0].result;
      console.log('[BG] executeScript completed, items count:', items ? items.length : 0);
      if (items && items.length > 0) {
        console.log('[BG] First few items:', items.slice(0, 3));
      }
    } catch(e) {
      console.error("[BG] getItems error:", e.message);
      tryCatchSend({ type: "export-progress", status: "error", msg: "Could not read conversations. Try reloading the page." });
      await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clearProgress }).catch(function(){});
      return;
    }
    var items = itemsResult[0].result;
    console.log("[BG] Items found:", items ? items.length : 0);
    if (!items || items.length === 0) {
      tryCatchSend({ type: "export-progress", status: "error", msg: "No conversations found. Open the sidebar first." });
      await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clearProgress }).catch(function(){});
      return;
    }

    var total = items.length;
    var errors = 0;
    tryCatchSend({ type: "export-progress", msg: "Collecting 0/" + total + "… (download at end)" });

    for (var i = 0; i < items.length; i++) {
      if (_cancelRequested) {
        console.log("[BG] Cancel requested, breaking loop");
        break;
      }

      var item = items[i];
      console.log("[BG] Processing item", i + 1, "/", total, item.title);

      // Update HUD
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: showProgress,
          args: [i + 1, total, item.title],
        });
      } catch(e) { console.warn("[BG] showProgress error:", e.message); }
      tryCatchSend({ type: "export-progress", msg: "[" + (i + 1) + "/" + total + "] " + item.title });

      // Build full URL
      var navUrl = item.href;
      if (tabUrl && !item.href.startsWith('http')) {
        try {
          var base = new URL(tabUrl);
          navUrl = new URL(item.href, base).href;
        } catch(e) {}
      }

      // Navigate via chrome.tabs.update
      var messages = [];
      if (navUrl && tabId) {
        console.log("[BG] Navigating to:", navUrl);
        try {
          await navToPage(tabId, navUrl);
          await waitForPageReady(tabId, platform, 12000);
          // Poll extraction until we get messages — inline the extraction logic (no closure refs)
          var extractionDone = false;
          var waitMs = 0;
          while (waitMs < 12000 && !extractionDone) {
            await sleep(1000);
            waitMs += 1000;
            try {
              var ex = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: function(plat) {
                  if (plat === 'chatgpt') {
                    var main = document.querySelector('main');
                    if (!main) return [];
                    var msgs = [];
                    var turns = main.querySelectorAll('[data-testid^="conversation-turn-"]');
                    for (var i = 0; i < turns.length; i++) {
                      var turn = turns[i];
                      var h4 = turn.querySelector('h4');
                      var roleLabel = h4 ? h4.innerText.trim() : '';
                      var allText = turn.innerText || '';
                      if (roleLabel && allText.indexOf(roleLabel) === 0) {
                        allText = allText.substring(roleLabel.length).trim();
                      }
                      var lines = allText.split('\n').filter(function(l) { return l.trim().length > 0; });
                      var content = lines.join('\n').trim();
                      if (!content) continue;
                      var role = roleLabel.indexOf('ChatGPT') !== -1 ? 'assistant' : 'user';
                      msgs.push({ role: role, content: content });
                    }
                    return msgs;
                  }
                  if (plat === 'gemini') {
                    var main = document.querySelector('main');
                    if (!main) return [];
                    var META = ["gemini is still syncing","gemini is ai and can make mistakes","enter a prompt","temporary chat","upgrade to google ai plus"];
                    var msgs = [];
                    var hs = main.querySelectorAll('h2, [role="heading"][aria-level="2"]');
                    for (var i = 0; i < hs.length; i++) {
                      var n = hs[i];
                      var text = n.textContent.trim();
                      var inner = n.innerText || n.textContent;
                      if (text.indexOf("You said") !== -1) {
                        var parts = inner.split("\n\n");
                        var msg = parts.length > 1 ? parts[1].trim() : parts[0].replace("You said","").trim();
                        if (msg) msgs.push({ role: "user", content: msg });
                      } else if (text.indexOf("Gemini said") !== -1 || text.indexOf("AI said") !== -1) {
                        var content = [];
                        var next = n.nextElementSibling;
                        while (next) {
                          var tag = next.tagName.toLowerCase();
                          if (tag === "h2" || (tag === "div" && next.getAttribute("role") === "heading")) break;
                          if (tag === "p" || tag === "structured-content-container") {
                            var pt = next.textContent.trim();
                            var lower = pt.toLowerCase();
                            var skip = false;
                            for (var m = 0; m < META.length; m++) { if (lower.indexOf(META[m]) !== -1) { skip = true; break; } }
                            if (!skip && pt) content.push(pt);
                          }
                          next = next.nextElementSibling;
                        }
                        if (content.length > 0) msgs.push({ role: "assistant", content: content.join("\n") });
                      }
                    }
                    return msgs;
                  }
                  if (plat === 'grok') {
                    var main = document.querySelector('main');
                    if (!main) return [];
                    var META = ["毫秒","快速模式","畅所欲言","privacy","cookie","解释chat history","推荐聊天记录","让 think","新建聊天","语音","imagine"];
                    var msgs = [];
                    var ps = main.querySelectorAll('p');
                    for (var i = 0; i < ps.length; i++) {
                      var text = ps[i].textContent.trim();
                      if (!text) continue;
                      var lower = text.toLowerCase();
                      var skip = false;
                      for (var j = 0; j < META.length; j++) { if (lower.indexOf(META[j]) !== -1) { skip = true; break; } }
                      if (skip) continue;
                      msgs.push({ role: msgs.length % 2 === 0 ? "user" : "assistant", content: text });
                    }
                    return msgs;
                  }
                  if (plat === 'claude') {
                    var msgs = [];
                    var userMsgs = document.querySelectorAll('[data-testid="user-message"]');
                    for (var i = 0; i < userMsgs.length; i++) {
                      var um = userMsgs[i];
                      var ps = um.querySelectorAll('p');
                      var text = '';
                      for (var j = 0; j < ps.length; j++) { var pt = ps[j].innerText.trim(); if (pt) text += (text ? '\n' : '') + pt; }
                      if (!text) text = um.innerText.trim();
                      if (text) msgs.push({ role: 'user', content: text });
                    }
                    var assistantMsgs = document.querySelectorAll('p.font-claude-response-body');
                    for (var i = 0; i < assistantMsgs.length; i++) {
                      var text = assistantMsgs[i].innerText.trim();
                      if (text) msgs.push({ role: 'assistant', content: text });
                    }
                    return msgs;
                  }
                  return [];
                },
                args: [platform],
              });
              messages = ex[0].result || [];
              console.log("[BG] Extraction attempt (" + waitMs + "ms):", messages.length, "messages");
              if (messages.length > 0) { extractionDone = true; break; }
            } catch(e) {
              console.warn("[BG] Extraction attempt error:", e.message);
            }
          }
          // Show page debug overlay if no messages found
          if (messages.length === 0) {
            try {
              var dump = await extractAllMessages(tabId, platform);
              console.log("[BG] DOM dump:", dump);
              await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: function(dumpText) {
                  var div = document.createElement('div');
                  div.textContent = 'DEBUG DOM: ' + (dumpText || 'no data').slice(0, 300);
                  div.style.cssText = 'position:fixed;top:0;left:0;z-index:9999999;background:#111;color:#0f0;font-size:12px;font-family:monospace;padding:10px;max-width:100%;opacity:0.95;line-height:1.6;';
                  document.body.appendChild(div);
                  setTimeout(function() { div.remove(); }, 20000);
                },
                args: [dump],
              });
            } catch(e) { console.warn("[BG] debug dump error:", e.message); }
          }
        } catch(e) {
          console.error("[BG] Nav/wait error:", e.message);
          errors++;
          continue;
        }
      }
      console.log("[BG] Extracted", messages.length, "messages from:", item.title);

      if (messages && messages.length > 0) {
        _accumulatedContent.push({ title: item.title, messages: messages });
        _accumulatedCount++;
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: showToast,
            args: [item.title],
          });
        } catch(e) {}
      } else {
        errors++;
        console.warn("[BG] No messages for:", item.title);
      }
    }

    // Clear HUD
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: clearProgress,
    }).catch(function(){});

    // Download accumulated content
    if (_accumulatedContent.length === 0) {
      tryCatchSend({ type: "export-progress", status: "error", msg: "No conversations extracted. The page structure may have changed." });
      return;
    }
    console.log("[BG] Loop done, accumulated:", _accumulatedContent.length, "cancelRequested:", _cancelRequested);

    var allLines = [];
    for (var c = 0; c < _accumulatedContent.length; c++) {
      var conv = _accumulatedContent[c];
      if (c > 0) allLines.push("\n\n---\n\n");
      allLines.push(formatSingleConv(conv.title, conv.messages));
    }
    var combinedMd = allLines.join("");
    var ts = formatTimestamp();
    var filename = platform + "-all-history-" + ts + ".md";
    console.log("[BG] Markdown length:", combinedMd.length, "triggering download:", filename);

    tryCatchSend({ type: "export-progress", status: "done", msg: "Done! " + _accumulatedCount + " conversations collected.\nChoose where to save." });
    await triggerDownload(tabId, combinedMd, filename);

  } catch(err) {
    console.error("[BG] handleAllHistory catch error:", err.message, err.stack);
    tryCatchSend({ type: "export-progress", status: "error", msg: err.message });
    try { await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clearProgress }); } catch(e2) {}
  }
}

// ── Message routing ───────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  console.log("[BG] Message received:", JSON.stringify(msg));
  if (msg.type === "export-current") {
    handleCurrentChat(msg.platform, msg.tabId)
      .then(sendResponse)
      .catch(function(e) { console.error("[BG] export-current error:", e); sendResponse({ error: e.message }); });
    return true;
  }
  if (msg.type === "export-all") {
    handleAllHistory(msg.platform, msg.tabId)
      .catch(function(e) {
        console.error("[BG] export-all error:", e);
        tryCatchSend({ type: "export-progress", status: "error", msg: e.message });
      });
    return false;
  }
  if (msg.type === "cancel-export") {
    _cancelRequested = true;
    tryCatchSend({ type: "export-progress", status: "done", msg: "Stopped. Preparing download…" });
    return false;
  }
});

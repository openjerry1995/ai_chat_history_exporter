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
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function(u) { window.location.href = u; },
    args: [url],
  });
  // Wait for navigation to actually happen
  await sleep(500);
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
          return { turns: turns, userMsgs: userMsgs, hs: hs, ps: ps, bodyLen: bodyLen, url: window.location.href };
        },
      });
      var info = result[0].result;
      console.log("[BG] Page check (" + totalMs + "ms):", JSON.stringify(info));
      var ready = false;
      if (platform === "chatgpt") ready = info.turns >= 2;
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
  var fnName = platform + "ExtractCurrent";
  var fn = window[fnName];
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
    var openSidebarFn = window[platform + "OpenSidebar"];
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
    var getItemsFn = window[platform + "GetItems"];
    if (!getItemsFn) {
      tryCatchSend({ type: "export-progress", status: "error", msg: "No getItems function for: " + platform });
      return;
    }
    var itemsResult;
    try {
      itemsResult = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: getItemsFn,
      });
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

      // Navigate via page injection (window.location.href)
      if (navUrl && tabId) {
        console.log("[BG] Navigating to:", navUrl);
        try {
          await navToPage(tabId, navUrl);
          await waitForPageReady(tabId, platform, 12000);
          await sleep(1500); // extra render time
        } catch(e) {
          console.error("[BG] Navigation error:", e.message);
          errors++;
          continue;
        }
      }

      // Extract
      var extractConvFn = window[platform + "ExtractConv"];
      if (!extractConvFn) { console.warn("[BG] No extractConv for:", platform); errors++; continue; }
      var messages;
      try {
        var ex = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: extractConvFn,
        });
        messages = ex[0].result;
      } catch(e) {
        console.error("[BG] extract error:", e.message);
        errors++;
        tryCatchSend({ type: "export-progress", msg: "Skipped [" + (i + 1) + "/" + total + "]: read error." });
        continue;
      }
      console.log("[BG] Extracted", messages ? messages.length : 0, "messages from:", item.title);

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

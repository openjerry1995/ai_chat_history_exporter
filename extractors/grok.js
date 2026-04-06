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
  // Primary: get from command menu (Ctrl+K) which shows ALL conversations
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
  // Opens command menu (Ctrl+K), extracts all conversation links, closes it
  // This is language-independent and shows ALL conversations
  var dialog = document.querySelector('div[role="dialog"] dialog, dialog');
  var wasOpen = dialog && dialog.open;

  if (!wasOpen) {
    // Press Ctrl+K to open command menu
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, bubbles: true }));
  }

  // Wait for dialog to appear
  var maxWait = 3000;
  var start = Date.now();
  while (Date.now() - start < maxWait) {
    dialog = document.querySelector('div[role="dialog"] dialog, dialog');
    if (dialog && dialog.open) break;
    dialog = document.querySelector('dialog[open]');
    if (dialog) break;
  }

  // Also check for the command menu by role
  var cmdDialog = document.querySelector('div[role="dialog"]');
  var items = [];
  if (cmdDialog) {
    var links = cmdDialog.querySelectorAll('a[href^="/c/"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var t = a.textContent.trim().replace(/\s+/g, " ");
      if (t && a.getAttribute("href")) {
        items.push({ title: t, href: a.getAttribute("href") });
      }
    }
  }

  // If still no items, try generic dialog approach
  if (items.length === 0) {
    var allLinks = document.querySelectorAll('a[href^="/c/"]');
    for (var j = 0; j < allLinks.length; j++) {
      var link = allLinks[j];
      var txt = link.textContent.trim().replace(/\s+/g, " ");
      if (txt && link.getAttribute("href")) {
        items.push({ title: txt, href: link.getAttribute("href") });
      }
    }
  }

  // Close the dialog with Escape
  if (!wasOpen) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    setTimeout(function() {
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));
    }, 50);
  }

  return items;
}

function grokOpenSidebar() {
  // Open command menu via Ctrl+K - works regardless of language
  // This shows ALL conversations grouped by time period
  var dialog = document.querySelector('div[role="dialog"] dialog, dialog');
  if (dialog && dialog.open) return; // Already open

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, bubbles: true }));
  document.dispatchEvent(new KeyboardEvent("keyup", { key: "k", code: "KeyK", ctrlKey: true, bubbles: true }));
}

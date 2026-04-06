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
  console.log('[Grok] grokGetItems called');
  // Primary: get from command menu (Ctrl+K) which shows ALL conversations
  var items = grokGetItemsFromCommandMenu();
  console.log('[Grok] Items from command menu:', items ? items.length : 0, items);
  if (items && items.length > 0) return items;

  // Fallback: get from sidebar (visible only)
  console.log('[Grok] Trying sidebar fallback');
  var links = document.querySelectorAll('aside a[href^="/c/"], nav a[href^="/c/"]');
  console.log('[Grok] Sidebar links found:', links.length);
  var items2 = [];
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var t = a.textContent.trim().replace(/\s+/g, " ");
    if (t && t.indexOf("新建聊天") === -1 && a.offsetParent !== null) {
      items2.push({ title: t, href: a.getAttribute("href") });
    }
  }
  console.log('[Grok] Sidebar items:', items2.length, items2);
  return items2;
}

function grokGetItemsFromCommandMenu() {
  console.log('[Grok] grokGetItemsFromCommandMenu called');
  // Opens command menu (Ctrl+K), extracts all conversation links, closes it
  // This is language-independent and shows ALL conversations
  // The command menu is a div with data-analytics-name="command_menu" or aria-labelledby

  // Check if command menu is already open
  var cmdDialog = document.querySelector('div[data-analytics-name="command_menu"]');
  console.log('[Grok] cmdDialog found:', !!cmdDialog);
  var wasOpen = !!(cmdDialog && cmdDialog.querySelector('[cmdk-list]'));
  console.log('[Grok] wasOpen:', wasOpen);

  if (!wasOpen) {
    console.log('[Grok] Pressing Ctrl+K to open command menu');
    // Press Ctrl+K to open command menu
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, bubbles: true }));
    // Wait for dialog to appear
    var maxWait = 3000;
    var start = Date.now();
    while (Date.now() - start < maxWait) {
      cmdDialog = document.querySelector('div[data-analytics-name="command_menu"]');
      if (cmdDialog && cmdDialog.querySelector('[cmdk-list]')) break;
    }
    console.log('[Grok] After wait, cmdDialog:', !!cmdDialog);
  }

  // Extract all conversation links from the command menu
  var items = [];
  if (cmdDialog) {
    var links = cmdDialog.querySelectorAll('a[href^="/c/"]');
    console.log('[Grok] Links in cmdDialog:', links.length);
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var t = a.textContent.trim().replace(/\s+/g, " ");
      if (t && a.getAttribute("href")) {
        items.push({ title: t, href: a.getAttribute("href") });
      }
    }
  }

  // If still no items, try generic approach - look for any visible /c/ links
  if (items.length === 0) {
    console.log('[Grok] No items in cmdDialog, trying all /c/ links');
    var allLinks = document.querySelectorAll('a[href^="/c/"]');
    console.log('[Grok] Total /c/ links on page:', allLinks.length);
    for (var j = 0; j < allLinks.length; j++) {
      var link = allLinks[j];
      var txt = link.textContent.trim().replace(/\s+/g, " ");
      if (txt && link.getAttribute("href") && link.offsetParent !== null) {
        items.push({ title: txt, href: link.getAttribute("href") });
      }
    }
  }

  // Close the dialog with Escape if we opened it
  if (!wasOpen && cmdDialog) {
    console.log('[Grok] Closing command menu');
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    setTimeout(function() {
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));
    }, 50);
  }

  console.log('[Grok] Returning items:', items.length);
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

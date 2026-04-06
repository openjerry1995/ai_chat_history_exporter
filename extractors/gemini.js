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

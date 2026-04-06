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

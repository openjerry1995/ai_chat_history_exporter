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

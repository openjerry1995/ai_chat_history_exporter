// popup.js — detects platform and delegates to background.js
var _exporting = false;
var _detectedPlatform = null;

function log(msg) { console.log('[popup]', msg); }

function setStatus(msg, type) {
  var el = document.getElementById('status');
  if (!el) return;
  if (type === 'success' && msg.indexOf('Choose where to save') !== -1) {
    var plainPart = msg.replace('\n\nSupport the dev: ko-fi.com/jerryopen', '');
    el.innerHTML = '<span class="count">' + escHtml(plainPart) + '</span><span class="donate-hint">Enjoying it? Support the dev:</span><a class="donate-btn" href="https://ko-fi.com/jerryopen" target="_blank" rel="noopener">Buy me a coffee ☕</a>';
  } else {
    el.textContent = msg;
  }
  el.className = 'status ' + (type || '');
  el.classList.remove('hidden');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setProgressText(msg) {
  var el = document.getElementById('progress');
  if (!el) return;
  if (!msg) { el.classList.add('hidden'); el.textContent = ''; return; }
  el.classList.remove('hidden');
  el.textContent = msg;
}

function showCancel() {
  _exporting = true;
  var btn = document.getElementById('btn-cancel');
  if (btn) btn.classList.remove('hidden');
}

function hideCancel() {
  _exporting = false;
  var btn = document.getElementById('btn-cancel');
  if (btn) btn.classList.add('hidden');
}

function updateBadge(platform, label, cls) {
  var badge = document.getElementById('platform-badge');
  if (!badge) return;
  badge.textContent = label;
  badge.className = 'platform-badge ' + (cls || '');
}

function setButtonsEnabled(enabled) {
  document.getElementById('btn-export-current').disabled = !enabled;
  document.getElementById('btn-export-all').disabled = !enabled;
}

function detectPlatform(url) {
  if (!url) return null;
  if (url.indexOf('grok.com') !== -1) return 'grok';
  if (url.indexOf('gemini.google.com') !== -1) return 'gemini';
  if (url.indexOf('chatgpt.com') !== -1) return 'chatgpt';
  if (url.indexOf('claude.ai') !== -1) return 'claude';
  return null;
}

function detectPlatformLabel(platform) {
  if (platform === 'grok') return 'Grok';
  if (platform === 'gemini') return 'Gemini';
  if (platform === 'chatgpt') return 'ChatGPT';
  if (platform === 'claude') return 'Claude';
  return null;
}

// On load: detect current tab
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  if (tabs && tabs.length > 0 && tabs[0].url) {
    var platform = detectPlatform(tabs[0].url);
    if (platform) {
      _detectedPlatform = platform;
      var label = detectPlatformLabel(platform);
      updateBadge(platform, label + ' detected', 'detected');
      setButtonsEnabled(true);
    } else {
      updateBadge(null, 'Open a chat tab first', 'none');
      setButtonsEnabled(false);
      setStatus('Open a Grok, Gemini, ChatGPT, or Claude tab to start exporting.', 'error');
    }
  }
});

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.type === 'export-progress') {
    if (msg.status === 'error') {
      setStatus(msg.msg, 'error');
      hideCancel();
    } else if (msg.status === 'done') {
      setStatus(msg.msg, 'success');
      hideCancel();
    } else {
      setProgressText(msg.msg);
    }
  }
});

document.getElementById('btn-export-current').addEventListener('click', function() {
  launchExport('current');
});

document.getElementById('btn-export-all').addEventListener('click', function() {
  launchExport('all');
});

document.getElementById('btn-cancel').addEventListener('click', function() {
  if (!_exporting) return;
  try { chrome.runtime.sendMessage({ type: 'cancel-export' }); } catch(e) {}
});

function launchExport(scope) {
  if (!_detectedPlatform) {
    setStatus('Open a Grok, Gemini, ChatGPT, or Claude tab to start exporting.', 'error');
    return;
  }

  var platform = _detectedPlatform;

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) { setStatus('No active tab.', 'error'); return; }
    var tab = tabs[0];

    _exporting = true;
    if (scope === 'all') showCancel();
    setStatus(scope === 'all'
      ? 'Running... keep this tab in focus.\nAll conversations saved to ONE file at the end.'
      : 'Extracting... a file will download shortly.', 'success');
    setProgressText('');

    try {
      chrome.runtime.sendMessage({
        type: scope === 'all' ? 'export-all' : 'export-current',
        platform: platform,
        tabId: tab.id,
      });
    } catch(err) {
      setStatus(err.message, 'error');
      _exporting = false;
      hideCancel();
    }
  });
}

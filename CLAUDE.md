# CLAUDE.md

This file provides guidance to AI assistants working with this codebase.

## GitHub Push Safety

**Before pushing to GitHub, always verify:**
- No API keys, secrets, tokens, or credentials in committed files
- No sensitive personal data (login credentials, private URLs, etc.)
- Debug files and test output images are excluded via .gitignore
- The `tests/` folder and `*.png` debug images are never pushed

**If sensitive data is accidentally committed:**
1. Use `git reset --hard` to remove the commit locally
2. Force push to overwrite remote: `git push --force origin master`
3. Consider rotating any exposed credentials immediately

## Extension Architecture

- `background.js` - Main service worker with platform-specific extractors
- `popup.html/js/css` - Extension popup UI
- `manifest.json` - Chrome extension manifest
- `docs/privacy-policy.html` - Privacy policy for Chrome Web Store

## Supported Platforms

ChatGPT, Claude, Grok, Gemini - each with:
- `extractCurrent()` - Extract messages from current chat
- `extractConv()` - Extract messages (no title)
- `getItems()` - Get conversation list from sidebar
- `openSidebar()` - Open/find sidebar
- `scrollSidebar()` / `scrollPopupOnce()` - Scroll lazy-loading panels

## Privacy

This extension runs 100% locally. No data is sent to any external servers.

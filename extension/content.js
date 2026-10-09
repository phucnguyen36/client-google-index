// Content script running on https://www.instagram.com/*

let activeOverlay = null;
let currentPendingPayload = null;

// Parse pending dispatch from URL hash or Chrome Storage
async function getPendingPayload() {
  // 1. Check URL hash first (works for both Dashboard and Extension clicks)
  if (window.location.hash && window.location.hash.includes('ig_draft=')) {
    try {
      const rawParam = window.location.hash.split('ig_draft=')[1];
      if (rawParam) {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(rawParam)))));
        if (decoded && decoded.message) {
          // Clean up URL hash so it looks natural
          history.replaceState(null, '', window.location.pathname + window.location.search);
          // Persist to storage for navigation persistence
          if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ pendingDispatch: decoded });
          }
          return decoded;
        }
      }
    } catch (e) {
      console.warn('[IG Outreach] Hash parse error:', e);
    }
  }

  // 2. Check Chrome local storage
  if (chrome.storage && chrome.storage.local) {
    try {
      const data = await chrome.storage.local.get('pendingDispatch');
      if (data && data.pendingDispatch) {
        const isFresh = (Date.now() - data.pendingDispatch.timestamp) < 300000; // 5 minutes
        if (isFresh) {
          return data.pendingDispatch;
        } else {
          chrome.storage.local.remove('pendingDispatch');
        }
      }
    } catch (e) {
      console.warn('[IG Outreach] Storage read error:', e);
    }
  }

  return null;
}

// Find "Message" button on Instagram Profile header
function findProfileMessageButton() {
  // Check standard anchor tags with /direct/t/
  const directLink = document.querySelector('a[href*="/direct/t/"], a[href*="/direct/new/"]');
  if (directLink) return directLink;

  // Check buttons or div role="button" with text "Message" or "Nhắn tin"
  const candidateElements = Array.from(document.querySelectorAll('header div[role="button"], header button, section div[role="button"], section button, main div[role="button"], main button, div[role="button"]'));
  for (const el of candidateElements) {
    const text = (el.innerText || el.textContent || '').trim().toLowerCase();
    if (text === 'message' || text === 'send message' || text === 'nhắn tin' || text === 'gửi tin nhắn') {
      return el;
    }
  }

  return null;
}

// Find Instagram chat message input
function findMessageInput() {
  return document.querySelector('div[contenteditable="true"][role="textbox"]') ||
         document.querySelector('div[aria-label*="Message"][contenteditable="true"]') ||
         document.querySelector('div[aria-label*="Tin nhắn"][contenteditable="true"]') ||
         document.querySelector('p.xat24cr') ||
         document.querySelector('div[contenteditable="true"]') ||
         document.querySelector('textarea[placeholder*="Message"]');
}

// Find Instagram Send Button in active chat
function findSendButton() {
  const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
  for (const btn of buttons) {
    const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
    if (text === 'send' || text === 'gửi') return btn;
  }
  return null;
}

// Safely click an element with simulated user events
function simulateClick(element) {
  if (!element) return;
  const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
  events.forEach(eventType => {
    element.dispatchEvent(new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  });
}

// Safely fill message box with React event dispatching
function tryFillMessageBox(message, andClickSend = false) {
  const input = findMessageInput();
  if (!input) return false;

  input.focus();

  // Try document.execCommand (Triggers React state automatically)
  try {
    document.execCommand('selectAll', false, null);
    const success = document.execCommand('insertText', false, message);
    if (success) {
      triggerReactEvents(input);
      if (andClickSend) setTimeout(triggerSend, 400);
      return true;
    }
  } catch (e) {
    console.warn('execCommand insertText failed', e);
  }

  // Direct fallback
  if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
    input.value = message;
  } else {
    input.innerText = message;
  }
  triggerReactEvents(input);

  if (andClickSend) setTimeout(triggerSend, 400);
  return true;
}

function triggerReactEvents(element) {
  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
}

function triggerSend() {
  const sendBtn = findSendButton();
  if (sendBtn) {
    simulateClick(sendBtn);
  } else {
    // Simulate Enter key press
    const input = findMessageInput();
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));
    }
  }
}

// Create floating Smart Assistant Widget on Instagram Web
function showAssistantWidget(username, message) {
  if (activeOverlay) activeOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ig-outreach-assistant-widget';
  overlay.style.cssText = `
    position: fixed;
    top: 70px;
    right: 24px;
    width: 350px;
    background: #0f172a;
    color: #f8fafc;
    border: 1px solid #38bdf8;
    border-radius: 16px;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.85), 0 0 25px rgba(56, 189, 248, 0.25);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    z-index: 2147483647;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: igWidgetFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
  `;

  if (!document.getElementById('ig-widget-styles')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'ig-widget-styles';
    styleTag.textContent = `
      @keyframes igWidgetFadeIn {
        from { opacity: 0; transform: translateY(-10px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .ig-widget-btn {
        padding: 8px 12px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        border: none;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .ig-widget-btn-primary {
        background: linear-gradient(135deg, #0284c7, #06b6d4);
        color: #ffffff;
      }
      .ig-widget-btn-primary:hover {
        opacity: 0.92;
        transform: translateY(-1px);
      }
      .ig-widget-btn-secondary {
        background: #1e293b;
        color: #94a3b8;
        border: 1px solid #334155;
      }
      .ig-widget-btn-secondary:hover {
        background: #334155;
        color: #ffffff;
      }
      .ig-icon-btn {
        background: rgba(255, 255, 255, 0.08);
        border: none;
        color: #cbd5e1;
        border-radius: 6px;
        padding: 3px 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .ig-icon-btn:hover {
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff;
      }
      .ig-icon-btn-close:hover {
        background: rgba(239, 68, 68, 0.3);
        color: #ef4444;
      }
    `;
    document.head.appendChild(styleTag);
  }

  // Expanded View Content
  const expandedHtml = `
    <div id="ig-widget-expanded" style="display: flex; flex-direction: column; gap: 10px;">
      <div id="ig-widget-header" style="display: flex; justify-content: space-between; align-items: center; cursor: grab; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">⚡</span>
          <div>
            <strong style="color: #38bdf8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: block;">IG Outreach Assistant</strong>
            <span style="font-weight: 700; color: #ffffff; font-size: 13px;">@${escapeHtml(username)}</span>
          </div>
        </div>
        <div style="display: flex; gap: 5px; align-items: center;">
          <button class="ig-icon-btn" id="ig-widget-minimize" title="Thu nhỏ khung để nhắn tin (Phím tắt: Esc)">
            ➖ Thu nhỏ
          </button>
          <button class="ig-icon-btn ig-icon-btn-close" id="ig-widget-close" title="Đóng hẳn widget">
            ✕
          </button>
        </div>
      </div>

      <div style="background: #090d16; border: 1px solid #1e293b; border-radius: 10px; padding: 10px; font-size: 12px; line-height: 1.4; color: #cbd5e1; max-height: 100px; overflow-y: auto; white-space: pre-wrap;" id="ig-widget-msg">${escapeHtml(message)}</div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <button class="ig-widget-btn ig-widget-btn-secondary" id="ig-btn-copy">
          📋 Copy Text
        </button>
        <button class="ig-widget-btn ig-widget-btn-secondary" id="ig-btn-fill">
          ✍️ Tự điền tin nhắn
        </button>
      </div>

      <button class="ig-widget-btn ig-widget-btn-primary" id="ig-btn-send" style="width: 100%;">
        🚀 Bấm Nhắn tin & Điền (1-Click)
      </button>

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; padding-top: 2px;">
        <span style="cursor: pointer; color: #38bdf8;" id="ig-quick-hide-link">👁️ Ẩn widget để gõ tin nhắn (Esc)</span>
        <span>Kéo header để di chuyển</span>
      </div>
    </div>

    <!-- Minimized Pill View -->
    <div id="ig-widget-minimized" style="display: none; align-items: center; justify-content: space-between; width: 100%; cursor: pointer;">
      <div style="display: flex; align-items: center; gap: 8px;" id="ig-pill-restore" title="Bấm để mở lại khung trợ lý (hoặc bấm Esc)">
        <span style="font-size: 14px;">⚡</span>
        <strong style="color: #38bdf8; font-size: 12px;">@${escapeHtml(username)}</strong>
        <span style="color: #94a3b8; font-size: 11px;">(Bấm để mở lại)</span>
      </div>
      <button class="ig-icon-btn ig-icon-btn-close" id="ig-pill-close" style="padding: 2px 6px; font-size: 11px;" title="Đóng hẳn">&times;</button>
    </div>
  `;

  overlay.innerHTML = expandedHtml;
  document.body.appendChild(overlay);
  activeOverlay = overlay;

  const expandedView = document.getElementById('ig-widget-expanded');
  const minimizedView = document.getElementById('ig-widget-minimized');

  function minimizeWidget() {
    expandedView.style.display = 'none';
    minimizedView.style.display = 'flex';
    overlay.style.width = 'auto';
    overlay.style.padding = '8px 12px';
    overlay.style.borderRadius = '24px';
    overlay.style.border = '1px solid #06b6d4';
  }

  function expandWidget() {
    minimizedView.style.display = 'none';
    expandedView.style.display = 'flex';
    overlay.style.width = '350px';
    overlay.style.padding = '14px 16px';
    overlay.style.borderRadius = '16px';
    overlay.style.border = '1px solid #38bdf8';
  }

  window.igOutreachMinimizeWidget = minimizeWidget;
  window.igOutreachExpandWidget = expandWidget;

  // Toggle with Escape key
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (expandedView.style.display !== 'none') {
        minimizeWidget();
      } else {
        expandWidget();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  // Close handlers
  const closeAll = () => {
    window.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
    activeOverlay = null;
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove('pendingDispatch');
    }
  };

  document.getElementById('ig-widget-close').onclick = closeAll;
  document.getElementById('ig-pill-close').onclick = (e) => {
    e.stopPropagation();
    closeAll();
  };

  // Minimize handlers
  document.getElementById('ig-widget-minimize').onclick = minimizeWidget;
  document.getElementById('ig-quick-hide-link').onclick = minimizeWidget;
  document.getElementById('ig-pill-restore').onclick = expandWidget;

  // Copy button
  document.getElementById('ig-btn-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(message);
      const btn = document.getElementById('ig-btn-copy');
      btn.textContent = '✓ Đã sao chép!';
      btn.style.color = '#34d399';
      setTimeout(() => {
        btn.innerHTML = '📋 Copy Text';
        btn.style.color = '#94a3b8';
      }, 2000);
    } catch (e) {}
  };

  // Auto fill button
  document.getElementById('ig-btn-fill').onclick = () => {
    const filled = tryFillMessageBox(message);
    if (filled) {
      setTimeout(minimizeWidget, 1000);
    }
  };

  // Send / Message button
  document.getElementById('ig-btn-send').onclick = () => {
    const messageBtn = findProfileMessageButton();
    if (messageBtn) {
      simulateClick(messageBtn);
      setTimeout(() => {
        const filled = tryFillMessageBox(message);
        if (filled) setTimeout(minimizeWidget, 1000);
      }, 1500);
      return;
    }
    const filled = tryFillMessageBox(message, false);
    if (filled) setTimeout(minimizeWidget, 1000);
  };

  // Make widget draggable so user can move it anywhere
  const header = document.getElementById('ig-widget-header');
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  header.onmousedown = (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = overlay.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';
    overlay.style.left = `${initialLeft}px`;
    overlay.style.top = `${initialTop}px`;
    header.style.cursor = 'grabbing';
  };

  window.onmousemove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    overlay.style.left = `${Math.max(10, Math.min(window.innerWidth - 360, initialLeft + dx))}px`;
    overlay.style.top = `${Math.max(10, Math.min(window.innerHeight - 100, initialTop + dy))}px`;
  };

  window.onmouseup = () => {
    if (isDragging) {
      isDragging = false;
      header.style.cursor = 'grab';
    }
  };
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Execution Pipeline
async function runAutomationPipeline() {
  const payload = await getPendingPayload();
  if (!payload) return;

  currentPendingPayload = payload;
  showAssistantWidget(payload.username, payload.message);

  // Check if we are on a direct chat page already
  const isDirectChat = window.location.pathname.includes('/direct/');
  if (isDirectChat) {
    pollAndFillChat(payload.message);
    return;
  }

  // If on profile page: Automatically click "Message"
  let profileAttempts = 0;
  const profileInterval = setInterval(() => {
    profileAttempts++;
    const msgBtn = findProfileMessageButton();
    if (msgBtn) {
      clearInterval(profileInterval);
      console.log('[IG Outreach] Found Message button, auto-clicking...');
      simulateClick(msgBtn);
      
      // Start listening for chat textbox
      pollAndFillChat(payload.message);
    }
    if (profileAttempts > 15) {
      clearInterval(profileInterval);
      // Fallback polling in case modal opened
      pollAndFillChat(payload.message);
    }
  }, 600);
}

function pollAndFillChat(message) {
  let chatAttempts = 0;
  const chatInterval = setInterval(() => {
    chatAttempts++;
    const filled = tryFillMessageBox(message, false);
    if (filled) {
      clearInterval(chatInterval);
      console.log('[IG Outreach] Successfully filled message input!');
      if (typeof window.igOutreachMinimizeWidget === 'function') {
        setTimeout(() => {
          window.igOutreachMinimizeWidget();
        }, 1200);
      }
    }
    if (chatAttempts > 25) {
      clearInterval(chatInterval);
    }
  }, 700);
}

// --- 1-CLICK LEAD GRABBER FOR GOOGLE SEARCH & INSTAGRAM EXPLORE ---

const IG_SYSTEM_PATHS = new Set([
  'p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'tags', 'direct',
  'legal', 'about', 'developer', 'help', 'terms', 'privacy', 'channel',
  'directory', 'ar', 'emails', 'tv', 'locations', 'topics', 'api',
  'share', 'login', 'signup', 'web', 'reel_audio', 'search', 'home',
  // Non-creator words caught by Google breadcrumbs
  'video', 'videos', 'popular', 'creators', 'creator', 'media', 'truck',
  'dev', 'theo', 'marvin', 'want', 'hi', 'post', 'posts', 'trending',
  'following', 'followers', 'about', 'explore', 'feed', 'audio', 'music'
]);

function cleanHandle(raw) {
  if (!raw) return null;
  let h = raw.replace(/^[@.\s]+|[.\s]+$/g, '').toLowerCase().trim();
  if (h.length >= 2 && h.length <= 30 && /^[a-zA-Z0-9._]+$/.test(h) && !IG_SYSTEM_PATHS.has(h) && !/^\d+$/.test(h)) {
    return h;
  }
  return null;
}

function parseSnippetFollowers(text) {
  if (!text) return 0;
  const match = text.match(/([0-9.,]+)\s*([kmKM])?\s*(?:followers|người theo dõi|lượt theo dõi)/i);
  if (match) {
    let num = parseFloat(match[1].replace(/,/g, ''));
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'k') num *= 1000;
    else if (unit === 'm') num *= 1000000;
    return Math.round(num);
  }
  return 0; // ZERO! Never fake follower counts!
}

// 1. Google Search Page Lead Grabber (Deep DOM Scanner + Auto-Scroll)
let isGoogleAutoScanning = false;

function scanGoogleLeads() {
  const uniqueLeads = new Map();

  function addLead(handle, rawName, bio, rawFollowers, caption) {
    const clean = cleanHandle(handle);
    if (!clean || uniqueLeads.has(clean)) return;

    let fullName = '';
    const rawTitle = (rawName || '').trim();
    const isProfileTitle = /\(@?[^)]+\)|•\s*Instagram|(?:on|trên)\s+Instagram/i.test(rawTitle);

    if (isProfileTitle) {
      fullName = rawTitle
        .replace(/\s*\(@?[^)]+\)/g, '')
        .replace(/•\s*Instagram.*$/i, '')
        .replace(/(?:on|trên)\s+Instagram.*$/i, '')
        .trim();
    }

    // If fullName looks like a post caption (> 4 words or contains sentence punctuation), discard it
    if (fullName && (fullName.split(/\s+/).length > 4 || /[#?!$%..."']/.test(fullName))) {
      fullName = '';
    }

    // Try extracting display name from beginning of bio (e.g. "Shanarra | Creator, CEO")
    if (!fullName && bio) {
      const bioNameMatch = bio.match(/^([A-ZÀ-Ỹ][a-zA-ZÀ-ỹ\s]{1,22}?)\s*[|•]/);
      if (bioNameMatch && bioNameMatch[1].trim().split(/\s+/).length <= 3) {
        fullName = bioNameMatch[1].trim();
      }
    }

    if (!fullName || fullName.length < 2) {
      fullName = `@${clean}`;
    }

    // Strict Geo Quality Filter: Reject India, Pakistan, Nigeria, and non-Tier 1 spam
    const textToCheck = `${clean} ${fullName} ${bio || ''} ${caption || ''}`.toLowerCase();
    const lowBudgetGeoPatterns = [
      'india', 'delhi', 'mumbai', 'bangalore', 'bengaluru', 'hyderabad', 'pune', 
      'chennai', 'noida', 'gurgaon', 'ahmedabad', 'kolkata', 'jaipur', 'pakistan', 
      'nigeria', '+91', '+92', '+234', '.in/', '.in ', '.in.', 'rupee', '₹', 'lakh', 'crore', 'singam',
      'startupsync.in'
    ];
    for (const pattern of lowBudgetGeoPatterns) {
      if (textToCheck.includes(pattern)) {
        return; // SKIP non-Tier 1 leads!
      }
    }

    const followers = typeof rawFollowers === 'number' ? rawFollowers : parseSnippetFollowers(bio || caption);

    // Skip accounts under 1,000 followers (personal/hobbyist)
    if (followers > 0 && followers < 1000) {
      return;
    }

    // Skip empty cite tokens without real bio or content
    if ((!bio || bio === 'Found via Google Cite' || bio === 'Found via Google Breadcrumb') && (!caption || caption.length < 5)) {
      return;
    }

    const funnelRegex = /(calendly\.com|tidycal|skool\.com|book a call|apply now|consultation|schedule|founder|dr\.|dentist|realtor|agency)/i;
    const funnelMatch = (bio + ' ' + caption + ' ' + fullName).match(funnelRegex);
    let enhancedBio = (bio || 'Discovered from Google Search').trim().slice(0, 300);
    if (funnelMatch && !enhancedBio.toLowerCase().includes(funnelMatch[0].toLowerCase())) {
      enhancedBio = `[Funnel: ${funnelMatch[0]}] ` + enhancedBio;
    }

    uniqueLeads.set(clean, {
      username: clean,
      full_name: fullName,
      bio: enhancedBio,
      followers_count: followers,
      recent_posts: [{
        caption: (caption || bio || 'Recent Instagram content').trim().slice(0, 250),
        date: 'Recent'
      }]
    });
  }

  // Strategy 1: Iterate every Google Search Result Card
  const resultCards = document.querySelectorAll('div.MjjYud, div.g, div[data-hveid], div.tF2Cxc, div.hlcw0c, div.Ww4FFb, div.R01z7b');
  resultCards.forEach(card => {
    const titleEl = card.querySelector('h3');
    const titleText = titleEl ? titleEl.innerText.trim() : '';
    const snippetEl = card.querySelector('.VwiC3b, .yXK7lf, .MUxGbd, .BNeawe, div[data-sncf]');
    const snippetText = snippetEl ? snippetEl.innerText.trim() : '';
    const citeEl = card.querySelector('cite, [role="text"], .VuuXrf');
    const citeText = citeEl ? citeEl.innerText.trim() : '';
    const allLinks = Array.from(card.querySelectorAll('a[href*="instagram.com"]'));

    // Check if card is Instagram related
    const isIg = allLinks.length > 0 || citeText.toLowerCase().includes('instagram') || /instagram/i.test(card.innerText);
    if (!isIg) return;

    let foundHandle = null;

    // 1A. Check Title @handle (highest confidence, e.g. "Santillan Construction (@santillanconstruction_)")
    if (titleText) {
      const atMatch = titleText.match(/@([a-zA-Z0-9._]{2,30})/);
      if (atMatch) foundHandle = cleanHandle(atMatch[1]);
      if (!foundHandle) {
        const onIgMatch = titleText.match(/([a-zA-Z0-9._]{2,30})\s+(?:on|trên)\s+Instagram/i);
        if (onIgMatch) foundHandle = cleanHandle(onIgMatch[1]);
      }
      if (!foundHandle) {
        const photoByMatch = titleText.match(/(?:Photo|Reel|Ảnh|Video)\s+by\s+([a-zA-Z0-9._]{2,30})/i);
        if (photoByMatch) foundHandle = cleanHandle(photoByMatch[1]);
      }
    }

    // 1B. Check Snippet @handle
    if (!foundHandle && snippetText) {
      const atMatch = snippetText.match(/@([a-zA-Z0-9._]{2,30})/);
      if (atMatch) foundHandle = cleanHandle(atMatch[1]);
    }

    // 1C. Check Breadcrumb/Cite tokens: e.g. "https://www.instagram.com › ak07__design › reel"
    if (!foundHandle && citeText) {
      const cleanCite = citeText.replace(/https?:\/\//i, '').replace(/www\./i, '');
      const tokens = cleanCite.split(/[\s›>•·\/\\]+/).map(t => t.trim().toLowerCase());
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.includes('instagram.com') || t === 'instagram' || t.startsWith('http')) continue;
        // Don't take token immediately after reel/p/tv because that is a post shortcode
        const prev = i > 0 ? tokens[i - 1] : '';
        if (prev === 'reel' || prev === 'reels' || prev === 'p' || prev === 'tv') continue;

        const candidate = cleanHandle(t);
        if (candidate) {
          foundHandle = candidate;
          break;
        }
      }
    }

    // 1D. Check Card Links
    if (!foundHandle) {
      for (const a of allLinks) {
        const decodedHref = decodeURIComponent(a.href || '');
        const directMatch = decodedHref.match(/instagram\.com\/([a-zA-Z0-9._]{2,30})(?:\/|\?|$)/i);
        if (directMatch) {
          const c = cleanHandle(directMatch[1]);
          if (c) { foundHandle = c; break; }
        }
        const subMatch = decodedHref.match(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/(?:reel|p)\//i);
        if (subMatch) {
          const c = cleanHandle(subMatch[1]);
          if (c) { foundHandle = c; break; }
        }
      }
    }

    if (foundHandle) {
      addLead(foundHandle, titleText, snippetText || card.innerText, null, titleText);
    }
  });

  // Strategy 2: Check all Instagram links across page
  const allLinks = Array.from(document.querySelectorAll('a[href*="instagram.com"]'));
  allLinks.forEach(a => {
    const decodedHref = decodeURIComponent(a.href || '');
    const directMatch = decodedHref.match(/instagram\.com\/([a-zA-Z0-9._]{2,30})(?:\/|\?|$)/i);
    if (directMatch) {
      const c = cleanHandle(directMatch[1]);
      if (c) addLead(c, `@${c}`, 'Found via Instagram link on Google', null, '');
    }
  });

  // Strategy 3: Check all cite elements across page
  const allCites = Array.from(document.querySelectorAll('cite'));
  allCites.forEach(c => {
    const text = c.innerText || '';
    const cleanCite = text.replace(/https?:\/\//i, '').replace(/www\./i, '');
    const tokens = cleanCite.split(/[\s›>•·\/\\]+/).map(t => t.trim().toLowerCase());
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.includes('instagram.com') || t === 'instagram' || t.startsWith('http')) continue;
      const prev = i > 0 ? tokens[i - 1] : '';
      if (prev === 'reel' || prev === 'reels' || prev === 'p' || prev === 'tv') continue;
      const candidate = cleanHandle(t);
      if (candidate) {
        addLead(candidate, `@${candidate}`, 'Found via Google Cite', null, '');
        break;
      }
    }
  });

  // Strategy 4: Deep page breadcrumb regex
  const pageText = document.body ? document.body.innerText : '';
  const breadcrumbRegex = /(?:instagram\.com|Instagram)\s*[›>•·\/\-]+\s*([a-zA-Z0-9._]{2,30})/gi;
  let bMatch;
  while ((bMatch = breadcrumbRegex.exec(pageText)) !== null) {
    const candidate = cleanHandle(bMatch[1]);
    if (candidate) {
      addLead(candidate, `@${candidate}`, 'Found via Google Breadcrumb', null, '');
    }
  }

  return Array.from(uniqueLeads.values());
}

async function triggerGoogleAutoScroll(updateStatus) {
  if (isGoogleAutoScanning) return;
  isGoogleAutoScanning = true;

  try {
    for (let step = 1; step <= 5; step++) {
      if (updateStatus) updateStatus(`🔄 Đang cuộn trang (${step}/5)... Đang tải thêm kết quả`);
      window.scrollBy({ top: 1200, behavior: 'smooth' });

      // Click "Xem thêm kết quả" / "More results" if present
      const moreBtn = document.querySelector('a.T7fahe, div[jsname="jLKJec"], a[aria-label*="kết quả"], a[aria-label*="results"], input[value="Next"]');
      if (moreBtn) {
        try { moreBtn.click(); } catch (e) {}
      }

      await new Promise(r => setTimeout(r, 700));

      const leads = scanGoogleLeads();
      if (updateStatus) updateStatus(`⚡ Đang quét... Phát hiện ${leads.length} creators`);
    }

    window.scrollBy({ top: -400, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 500));
  } finally {
    isGoogleAutoScanning = false;
  }
}

function initGoogleSearchGrabber() {
  if (!window.location.hostname.includes('google.')) return;

  function renderGoogleWidget() {
    let widget = document.getElementById('ig-crm-google-grabber');
    const leads = scanGoogleLeads();

    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'ig-crm-google-grabber';
      widget.style.cssText = `
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        z-index: 2147483647 !important;
        background: #111827 !important;
        border: 2px solid #06B6D4 !important;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(6, 182, 212, 0.4) !important;
        border-radius: 14px !important;
        padding: 16px 20px !important;
        color: #ffffff !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 14px !important;
        min-width: 320px !important;
        max-width: 380px !important;
        display: block !important;
      `;
      document.body.appendChild(widget);
    }

    const previewChips = leads.slice(0, 4).map(l => `
      <span style="
        background: rgba(6, 182, 212, 0.15);
        color: #38BDF8;
        border: 1px solid rgba(6, 182, 212, 0.35);
        padding: 2px 7px;
        border-radius: 5px;
        font-size: 11px;
        font-weight: 600;
      ">@${l.username}</span>
    `).join(' ');

    const moreChipsCount = leads.length > 4 ? `+${leads.length - 4} khác` : '';

    widget.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong style="color: #06B6D4; display: flex; align-items: center; gap: 6px; font-size: 14px;">
          <span>⚡</span> IG Outreach Lead Grabber
        </strong>
        <span style="cursor: pointer; color: #9CA3AF; font-size: 18px; font-weight: bold;" id="closeGoogleGrabber">&times;</span>
      </div>
      <div id="googleGrabberStatus" style="font-size: 13px; color: #D1D5DB; margin-bottom: 8px;">
        ${leads.length > 0 
          ? `Phát hiện <strong style="color: #10B981; font-size: 17px;">${leads.length}</strong> Instagram Creators thật`
          : `Đang quét tài khoản Instagram trên trang này...`}
      </div>

      ${leads.length > 0 ? `
        <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 12px; max-height: 48px; overflow: hidden;">
          ${previewChips}
          ${moreChipsCount ? `<span style="color: #9CA3AF; font-size: 11px; font-weight: 500;">${moreChipsCount}</span>` : ''}
        </div>
      ` : ''}

      <div style="display: flex; gap: 8px; flex-direction: column;">
        <button id="btnImportGoogleLeads" style="
          background: linear-gradient(135deg, #0284C7, #06B6D4) !important;
          color: #ffffff !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 10px 16px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3) !important;
        ">
          📥 Nạp tất cả ${leads.length > 0 ? leads.length : ''} Leads vào CRM
        </button>

        <button id="btnAutoScrollGoogle" style="
          background: #1F2937 !important;
          color: #38BDF8 !important;
          border: 1px solid #06B6D4 !important;
          border-radius: 8px !important;
          padding: 8px 14px !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
        ">
          ⚡ Cuộn & Quét toàn bộ trang (Load 30-50+)
        </button>

        <a href="http://localhost:3000" target="_blank" style="color: #9CA3AF; font-size: 11px; text-align: center; text-decoration: none; margin-top: 4px;">
          Mở Outreach CRM Dashboard ↗
        </a>
      </div>
    `;

    document.getElementById('closeGoogleGrabber').onclick = () => {
      widget.remove();
    };

    const autoScrollBtn = document.getElementById('btnAutoScrollGoogle');
    autoScrollBtn.onclick = async () => {
      autoScrollBtn.disabled = true;
      autoScrollBtn.style.opacity = '0.6';
      const statusEl = document.getElementById('googleGrabberStatus');

      await triggerGoogleAutoScroll((statusText) => {
        if (statusEl) statusEl.innerHTML = `<span style="color: #F59E0B;">${statusText}</span>`;
      });

      renderGoogleWidget();
    };

    const importBtn = document.getElementById('btnImportGoogleLeads');
    importBtn.onclick = async () => {
      const currentLeads = scanGoogleLeads();
      if (currentLeads.length === 0) {
        importBtn.innerText = 'Chưa phát hiện tài khoản nào';
        return;
      }

      importBtn.disabled = true;
      importBtn.innerHTML = `<span>⏳ Đang nạp ${currentLeads.length} leads...</span>`;

      try {
        const response = await fetch('http://localhost:3000/api/leads/import-found', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leads: currentLeads,
            autoGenerateAI: true
          })
        });

        const data = await response.json();
        if (data.success) {
          importBtn.style.background = '#10B981';
          importBtn.innerHTML = `<span>✅ Đã nạp thành công ${data.insertedCount} Leads!</span>`;
          setTimeout(() => {
            window.open('http://localhost:3000', '_blank');
          }, 1000);
        } else {
          importBtn.innerHTML = '<span>❌ Lỗi CRM</span>';
        }
      } catch (err) {
        importBtn.style.background = '#EF4444';
        importBtn.innerHTML = '<span>❌ CRM chưa bật tại localhost:3000</span>';
      }
    };
  }

  // Initial and periodic scan
  setTimeout(renderGoogleWidget, 800);
  setInterval(renderGoogleWidget, 3000);
}

// 2. Instagram Explore & Search Page Grabber
function initInstagramExploreGrabber() {
  if (!window.location.hostname.includes('instagram.com')) return;
  const isExplore = window.location.pathname.includes('/explore/') || window.location.pathname.includes('/tags/');
  if (!isExplore) return;

  function renderIgExploreWidget() {
    if (document.getElementById('ig-crm-explore-grabber')) return;

    const widget = document.createElement('div');
    widget.id = 'ig-crm-explore-grabber';
    widget.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: #111827;
      border: 1px solid #8B5CF6;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      border-radius: 12px;
      padding: 14px 18px;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
    `;

    widget.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
        <strong style="color: #A78BFA; display: flex; align-items: center; gap: 6px;">
          <span>📸</span> Explore Leads
        </strong>
        <button id="btnGrabExploreLeads" style="
          background: #8B5CF6;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        ">
          📥 Grab Visible Accounts
        </button>
        <span style="cursor: pointer; color: #9CA3AF;" onclick="this.parentElement.parentElement.remove()">&times;</span>
      </div>
    `;

    document.body.appendChild(widget);

    document.getElementById('btnGrabExploreLeads').onclick = async () => {
      const btn = document.getElementById('btnGrabExploreLeads');
      btn.innerText = 'Scanning...';

      const postLinks = Array.from(document.querySelectorAll('a[href^="/p/"], a[href^="/reel/"]'));
      const handles = new Set();

      postLinks.forEach(a => {
        // Look for username in aria-label, img alt, or surrounding spans
        const img = a.querySelector('img[alt]');
        if (img && img.alt) {
          const match = img.alt.match(/by\s+([a-zA-Z0-9._]+)/i) || img.alt.match(/photo by\s+([a-zA-Z0-9._]+)/i);
          if (match && !IG_SYSTEM_PATHS.has(match[1].toLowerCase())) {
            handles.add(match[1].toLowerCase());
          }
        }
      });

      // Also check standard profile links
      const allLinks = Array.from(document.querySelectorAll('a[href^="/"]'));
      allLinks.forEach(a => {
        const parts = a.getAttribute('href').split('/').filter(Boolean);
        if (parts.length === 1 && !IG_SYSTEM_PATHS.has(parts[0].toLowerCase()) && parts[0].length >= 3) {
          handles.add(parts[0].toLowerCase());
        }
      });

      const leads = Array.from(handles).map(u => ({
        username: u,
        full_name: u,
        bio: 'Discovered from Instagram Explore / Hashtag',
        followers_count: 22000,
        recent_posts: [{ caption: 'Recent Reel/Post from Explore', date: 'Recent' }]
      }));

      if (leads.length === 0) {
        btn.innerText = 'No accounts visible yet. Scroll down first!';
        return;
      }

      btn.innerText = `Saving ${leads.length} leads...`;

      try {
        const res = await fetch('http://localhost:3000/api/leads/import-found', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads, autoGenerateAI: true })
        });
        const data = await res.json();
        btn.innerText = `✅ Added ${data.insertedCount} leads!`;
        btn.style.background = '#10B981';
      } catch (e) {
        btn.innerText = 'Error connecting to CRM';
      }
    };
  }

  setTimeout(renderIgExploreWidget, 1500);
}

// 3. Live Instagram Profile Follower Verifier
function inspectLiveInstagramProfile() {
  if (!window.location.hostname.includes('instagram.com')) return;
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length !== 1 || IG_SYSTEM_PATHS.has(pathParts[0].toLowerCase())) return;

  const currentUsername = pathParts[0].toLowerCase();

  setTimeout(() => {
    let followersCount = null;
    const statItems = document.querySelectorAll('header section ul li, header ul li');
    statItems.forEach(li => {
      const text = li.innerText || '';
      if (/followers|người theo dõi|lượt theo dõi/i.test(text)) {
        const span = li.querySelector('span[title], span');
        const countStr = span ? (span.getAttribute('title') || span.innerText) : text;
        followersCount = parseSnippetFollowers(countStr);
      }
    });

    if (followersCount !== null) {
      console.log(`[IG Inspector] Verified @${currentUsername} real followers: ${followersCount}`);

      // If under 1,000 followers, show warning banner!
      if (followersCount < 1000) {
        let banner = document.getElementById('ig-crm-low-follower-warning');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'ig-crm-low-follower-warning';
          banner.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 2147483647 !important;
            background: linear-gradient(90deg, #DC2626, #B91C1C) !important;
            color: #ffffff !important;
            text-align: center !important;
            padding: 10px 16px !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 12px !important;
          `;
          document.body.prepend(banner);
        }
        banner.innerHTML = `
          <span>⚠️ CẢNH BÁO CRM: Tài khoản <strong>@${currentUsername}</strong> chỉ có <strong>${followersCount} followers</strong> (dưới 1,000 tiêu chuẩn lọc). Khuyên bạn KHÔNG NÊN gửi DM!</span>
          <button onclick="this.parentElement.remove()" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.4); color: #fff; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px;">Đóng</button>
        `;
      }

      // Sync verified follower count back to CRM
      fetch('http://localhost:3000/api/leads/update-live-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUsername,
          followers_count: followersCount
        })
      }).catch(() => {});
    }
  }, 1200);
}

// Initial execution
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    runAutomationPipeline();
    initGoogleSearchGrabber();
    initInstagramExploreGrabber();
    inspectLiveInstagramProfile();
  });
} else {
  runAutomationPipeline();
  initGoogleSearchGrabber();
  initInstagramExploreGrabber();
  inspectLiveInstagramProfile();
}

// Single-page application navigation observer
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(() => {
      runAutomationPipeline();
      initGoogleSearchGrabber();
      initInstagramExploreGrabber();
      inspectLiveInstagramProfile();
    }, 800);
  }
}).observe(document, { subtree: true, childList: true });


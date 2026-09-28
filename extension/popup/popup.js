const API_BASE = 'http://localhost:3000';

const serverStatus = document.getElementById('serverStatus');
const extQuotaText = document.getElementById('extQuotaText');
const extProgressBar = document.getElementById('extProgressBar');
const nextLeadCard = document.getElementById('nextLeadCard');
const extTargetUsername = document.getElementById('extTargetUsername');
const extMessagePreview = document.getElementById('extMessagePreview');
const btnExtDispatch = document.getElementById('btnExtDispatch');
const emptyQueue = document.getElementById('emptyQueue');

let currentLead = null;

async function checkCRMConnection() {
  try {
    const res = await fetch(`${API_BASE}/api/leads/next-in-queue`);
    const data = await res.json();
    
    serverStatus.textContent = 'CRM Live';
    serverStatus.className = 'status-indicator online';

    // Update Quota
    if (data.quota) {
      extQuotaText.textContent = `${data.quota.sentToday} / ${data.quota.dailyLimit} DMs`;
      extProgressBar.style.width = `${data.quota.percentage}%`;
    }

    if (data.success && data.lead) {
      currentLead = data.lead;
      nextLeadCard.classList.remove('hidden');
      emptyQueue.classList.add('hidden');

      extTargetUsername.textContent = `@${data.lead.username}`;
      extMessagePreview.textContent = data.lead.ai_draft || '(No message draft)';
      btnExtDispatch.disabled = false;
    } else {
      currentLead = null;
      nextLeadCard.classList.add('hidden');
      emptyQueue.classList.remove('hidden');
    }
  } catch (err) {
    serverStatus.textContent = 'CRM Offline';
    serverStatus.className = 'status-indicator offline';
    nextLeadCard.classList.add('hidden');
    emptyQueue.classList.remove('hidden');
    emptyQueue.innerHTML = '<p>Unable to connect to CRM (localhost:3000). Please make sure backend is running.</p>';
  }
}

btnExtDispatch.addEventListener('click', async () => {
  if (!currentLead) return;

  const username = currentLead.username.replace(/^@/, '');
  const message = currentLead.ai_draft;

  // 1. Copy to clipboard
  try {
    await navigator.clipboard.writeText(message);
  } catch (e) {
    console.warn('Clipboard write error');
  }

  // 2. Save pending dispatch to chrome storage for content script
  if (chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({
      pendingDispatch: {
        username: username.toLowerCase(),
        message: message,
        leadId: currentLead.id,
        timestamp: Date.now()
      }
    });
  }

  // 3. Open Instagram Profile tab with payload hash
  let hashParam = '';
  try {
    hashParam = '#ig_draft=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify({
      username: username.toLowerCase(),
      message: message,
      timestamp: Date.now()
    })))));
  } catch (e) {}

  const profileUrl = `https://www.instagram.com/${encodeURIComponent(username)}/${hashParam}`;
  chrome.tabs.create({ url: profileUrl });

  // 4. Mark as sent on backend to log quota
  try {
    await fetch(`${API_BASE}/api/leads/${currentLead.id}/mark-sent`, { method: 'POST' });
  } catch (e) {
    console.error('Mark sent failed', e);
  }

  // 5. Reload status
  setTimeout(checkCRMConnection, 1000);
});

// 1-Click Page Grabber in Popup
const btnPopupGrab = document.getElementById('btnPopupGrab');
const popupGrabStatus = document.getElementById('popupGrabStatus');

if (btnPopupGrab) {
  btnPopupGrab.addEventListener('click', async () => {
    btnPopupGrab.disabled = true;
    btnPopupGrab.textContent = 'Scanning tab...';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      btnPopupGrab.disabled = false;
      btnPopupGrab.textContent = 'No active tab found';
      return;
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const handles = new Set();
          const sys = new Set([
            'p', 'reel', 'reels', 'explore', 'tags', 'stories', 'accounts', 'direct',
            'legal', 'about', 'developer', 'help', 'terms', 'privacy', 'tv', 'locations',
            'topics', 'api', 'instagram', 'search', 'web', 'share', 'login', 'signup'
          ]);

          function cleanHandle(raw) {
            if (!raw) return null;
            let h = raw.replace(/^[@.\s]+|[.\s]+$/g, '').toLowerCase().trim();
            if (h.length >= 2 && h.length <= 30 && /^[a-zA-Z0-9._]+$/.test(h) && !sys.has(h) && !/^\d+$/.test(h)) {
              return h;
            }
            return null;
          }

          // 1. Check Google Result Cards
          const cards = document.querySelectorAll('div.MjjYud, div.g, div[data-hveid], div.tF2Cxc, div.hlcw0c, div.Ww4FFb, div.R01z7b');
          cards.forEach(card => {
            const title = card.querySelector('h3')?.innerText || '';
            const snippet = card.querySelector('.VwiC3b, .yXK7lf, .MUxGbd, .BNeawe')?.innerText || '';
            const cite = card.querySelector('cite, [role="text"], .VuuXrf')?.innerText || '';

            // Check Title @handle
            if (title) {
              const m = title.match(/@([a-zA-Z0-9._]{2,30})/);
              if (m) {
                const c = cleanHandle(m[1]);
                if (c) { handles.add(c); return; }
              }
              const onIg = title.match(/([a-zA-Z0-9._]{2,30})\s+(?:on|trên)\s+Instagram/i);
              if (onIg) {
                const c = cleanHandle(onIg[1]);
                if (c) { handles.add(c); return; }
              }
            }

            // Check Snippet @handle
            if (snippet) {
              const m = snippet.match(/@([a-zA-Z0-9._]{2,30})/);
              if (m) {
                const c = cleanHandle(m[1]);
                if (c) { handles.add(c); return; }
              }
            }

            // Check Cite tokens
            if (cite) {
              const cleanCite = cite.replace(/https?:\/\//i, '').replace(/www\./i, '');
              const tokens = cleanCite.split(/[\s›>•·\/\\]+/).map(t => t.trim().toLowerCase());
              for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i];
                if (t.includes('instagram.com') || t === 'instagram' || t.startsWith('http')) continue;
                const prev = i > 0 ? tokens[i - 1] : '';
                if (prev === 'reel' || prev === 'reels' || prev === 'p' || prev === 'tv') continue;
                const c = cleanHandle(t);
                if (c) { handles.add(c); return; }
              }
            }
          });

          // 2. All Instagram links on page
          const links = Array.from(document.querySelectorAll('a[href*="instagram.com"]'));
          links.forEach(a => {
            const decodedHref = decodeURIComponent(a.href || '');
            const match = decodedHref.match(/instagram\.com\/([a-zA-Z0-9._]{2,30})(?:\/|\?|$)/i);
            if (match) {
              const c = cleanHandle(match[1]);
              if (c) handles.add(c);
            }
          });

          // 3. Breadcrumbs regex
          const text = document.body ? document.body.innerText : '';
          const bRegex = /(?:instagram\.com|Instagram)\s*[›>•·\/\-]+\s*([a-zA-Z0-9._]{2,30})/gi;
          let m;
          while ((m = bRegex.exec(text)) !== null) {
            const c = cleanHandle(m[1]);
            if (c) handles.add(c);
          }

          return Array.from(handles);
        }
      });

      const handles = results?.[0]?.result || [];
      if (handles.length === 0) {
        popupGrabStatus.style.display = 'block';
        popupGrabStatus.style.color = '#F59E0B';
        popupGrabStatus.textContent = 'No Instagram profiles found on this page.';
        btnPopupGrab.disabled = false;
        btnPopupGrab.textContent = '📥 Grab All Leads on Current Tab';
        return;
      }

      btnPopupGrab.textContent = `Importing ${handles.length} leads...`;

      const leads = handles.map(u => ({
        username: u,
        full_name: `@${u}`,
        bio: 'Grabbed from active browser tab via Extension',
        followers_count: 20000,
        recent_posts: [{ caption: 'Recent Instagram Reel / Post', date: 'Recent' }]
      }));

      const res = await fetch(`${API_BASE}/api/leads/import-found`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads, autoGenerateAI: true })
      });

      const data = await res.json();
      popupGrabStatus.style.display = 'block';
      popupGrabStatus.style.color = '#10B981';
      popupGrabStatus.textContent = `✅ Successfully imported ${data.insertedCount} leads into CRM!`;
      btnPopupGrab.textContent = `✅ Done (${data.insertedCount} Leads)`;
    } catch (err) {
      popupGrabStatus.style.display = 'block';
      popupGrabStatus.style.color = '#EF4444';
      popupGrabStatus.textContent = 'Error connecting to CRM (localhost:3000)';
      btnPopupGrab.disabled = false;
      btnPopupGrab.textContent = '📥 Grab All Leads on Current Tab';
    }
  });
}

// Init
checkCRMConnection();

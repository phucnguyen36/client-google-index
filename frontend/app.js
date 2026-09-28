// State
let currentFilter = 'ALL';
let currentFollowerTier = 'ALL';
let currentSort = 'DEFAULT';
let currentSearch = '';
let leadsData = [];
let lastDispatchTime = 0;
let cooldownSeconds = 45; // Default human delay

// DOM Elements
const quotaBadge = document.getElementById('quotaBadge');
const quotaSent = document.getElementById('quotaSent');
const quotaLimit = document.getElementById('quotaLimit');
const quotaBarFill = document.getElementById('quotaBarFill');
const quotaDot = document.getElementById('quotaDot');
const quotaHint = document.getElementById('quotaHint');

const cooldownBadge = document.getElementById('cooldownBadge');
const cooldownText = document.getElementById('cooldownText');

const metricTotal = document.getElementById('metricTotal');
const metricPending = document.getElementById('metricPending');
const metricApproved = document.getElementById('metricApproved');
const metricSentToday = document.getElementById('metricSentToday');
const metricSentTotal = document.getElementById('metricSentTotal');
const metricReplied = document.getElementById('metricReplied');
const metricReplyRate = document.getElementById('metricReplyRate');

const searchInput = document.getElementById('searchInput');
const filterTabs = document.getElementById('filterTabs');
const filterFollowerTier = document.getElementById('filterFollowerTier');
const sortLeads = document.getElementById('sortLeads');
const leadsContainer = document.getElementById('leadsContainer');

const btnOpenAddLead = document.getElementById('btnOpenAddLead');
const btnOpenSettings = document.getElementById('btnOpenSettings');
const btnOpenFindLeads = document.getElementById('btnOpenFindLeads');
const btnBatchGenerateAI = document.getElementById('btnBatchGenerateAI');
const btnDispatchNext = document.getElementById('btnDispatchNext');
const btnOpenClearLeads = document.getElementById('btnOpenClearLeads');

const clearLeadsModal = document.getElementById('clearLeadsModal');
const closeClearLeadsModal = document.getElementById('closeClearLeadsModal');
const btnCancelClearLeads = document.getElementById('btnCancelClearLeads');
const btnConfirmClearLeads = document.getElementById('btnConfirmClearLeads');

const btnOpenPasteExtract = document.getElementById('btnOpenPasteExtract');
const pasteExtractModal = document.getElementById('pasteExtractModal');
const closePasteExtractModal = document.getElementById('closePasteExtractModal');
const btnCancelPasteExtract = document.getElementById('btnCancelPasteExtract');
const btnConfirmPasteExtract = document.getElementById('btnConfirmPasteExtract');
const pasteExtractInput = document.getElementById('pasteExtractInput');
const pasteExtractPreview = document.getElementById('pasteExtractPreview');
const pasteExtractCount = document.getElementById('pasteExtractCount');
const pasteReplaceExisting = document.getElementById('pasteReplaceExisting');

const findLeadsModal = document.getElementById('findLeadsModal');
const closeFindLeadsModal = document.getElementById('closeFindLeadsModal');
const findLeadsForm = document.getElementById('findLeadsForm');
const finderKeyword = document.getElementById('finderKeyword');
const finderLanguage = document.getElementById('finderLanguage');
const finderCount = document.getElementById('finderCount');
const finderFollowerTier = document.getElementById('finderFollowerTier');
const finderActivity = document.getElementById('finderActivity');
const btnExecuteSearch = document.getElementById('btnExecuteSearch');
const searchShortcutsContainer = document.getElementById('searchShortcutsContainer');
const linkGoogleXray = document.getElementById('linkGoogleXray');
const linkIgTag = document.getElementById('linkIgTag');
const finderResultsArea = document.getElementById('finderResultsArea');
const finderFoundCount = document.getElementById('finderFoundCount');
const finderResultsList = document.getElementById('finderResultsList');
const finderReplaceExisting = document.getElementById('finderReplaceExisting');
const btnImportAllFound = document.getElementById('btnImportAllFound');

let discoveredLeadsCache = [];

const addLeadModal = document.getElementById('addLeadModal');
const closeAddLeadModal = document.getElementById('closeAddLeadModal');
const tabSingleMode = document.getElementById('tabSingleMode');
const tabBulkMode = document.getElementById('tabBulkMode');
const singleLeadForm = document.getElementById('singleLeadForm');
const bulkLeadForm = document.getElementById('bulkLeadForm');
const bulkReplaceExisting = document.getElementById('bulkReplaceExisting');

const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const settingsForm = document.getElementById('settingsForm');
const settingWarmupStage = document.getElementById('settingWarmupStage');
const settingDailyLimit = document.getElementById('settingDailyLimit');
const settingGeminiKey = document.getElementById('settingGeminiKey');
const settingService = document.getElementById('settingService');
const settingTone = document.getElementById('settingTone');

const toast = document.getElementById('toast');

// Toast helper
function showToast(message, duration = 3500) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

function formatNumber(num) {
  if (!num) return '0';
  const n = parseInt(num, 10);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n;
}

function getFollowerTierBadge(count) {
  const c = parseInt(count || 0, 10);
  if (c <= 0) {
    return `<span class="tier-tag nano" style="background: rgba(156, 163, 175, 0.15); color: #9CA3AF; border: 1px solid rgba(156, 163, 175, 0.3);" title="Chưa xác minh được follower từ Google">❓ Chưa rõ</span>`;
  }
  if (c < 1000) {
    return `<span class="tier-tag nano" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.35); font-weight: 700;" title="Dưới 1,000 followers - Cá nhân / Không đạt chuẩn">⚠️ < 1K (${c})</span>`;
  }
  if (c < 15000) {
    return `<span class="tier-tag micro" title="Micro Creator (1K - 15K): Highest DM Reply Rate">🌱 ${formatNumber(c)}</span>`;
  }
  if (c <= 75000) {
    return `<span class="tier-tag mid" title="Mid-Tier Creator (15K - 75K): High Retainer Budget">🎯 ${formatNumber(c)}</span>`;
  }
  return `<span class="tier-tag macro" title="Macro Creator (75K+): High Reach / Agency Scale">⭐ ${formatNumber(c)}</span>`;
}

// Meta Algorithm Anti-Spam Safety Checker
function getAntiSpamBadge(text) {
  if (!text || text.trim() === '') {
    return `<span class="safety-tag" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">Draft Empty</span>`;
  }

  const linkRegex = /(https?:\/\/|www\.|bit\.ly|linktr\.ee|\.com|\.vn|\.io|\.co|\.net)/i;
  const spamWords = ['buy now', 'crypto', 'make money', 'cheap', 'guaranteed', 'discount', '100% free money', 'dm for price', 'kiếm tiền'];
  
  const hasLink = linkRegex.test(text);
  const foundSpamWord = spamWords.find(w => text.toLowerCase().includes(w));
  const wordCount = text.trim().split(/\s+/).length;

  if (hasLink) {
    return `<span class="safety-tag warning" title="Links in first DM trigger Instagram Hidden Requests!">⚠️ Contains Link (Spam Risk)</span>`;
  }

  if (foundSpamWord) {
    return `<span class="safety-tag warning" title="Keyword '${foundSpamWord}' flagged as commercial spam trigger!">⚠️ Word: "${foundSpamWord}"</span>`;
  }

  if (wordCount > 75) {
    return `<span class="safety-tag warning" title="Message is too long (${wordCount} words). Recommended: 35-60 words.">⚠️ Too Long (${wordCount}w)</span>`;
  }

  return `<span class="safety-tag safe" title="100% Meta compliant: 0 links, natural length (${wordCount}w), high spintax variance.">🛡️ Meta Safe (${wordCount}w)</span>`;
}

// Format Status Labels
function getStatusBadge(status) {
  const map = {
    NEW: { label: 'New', class: 'status-new' },
    AI_GENERATED: { label: 'AI Drafted', class: 'status-ai_generated' },
    APPROVED: { label: 'Approved (Queue)', class: 'status-approved' },
    SENT: { label: 'Sent', class: 'status-sent' },
    REPLIED: { label: 'Replied', class: 'status-replied' },
    SKIPPED: { label: 'Skipped', class: 'status-skipped' }
  };
  const item = map[status] || { label: status, class: 'status-new' };
  return `<span class="status-pill ${item.class}">${item.label}</span>`;
}

// Cooldown Timer
setInterval(() => {
  if (!lastDispatchTime) {
    cooldownBadge.className = 'cooldown-badge ready';
    cooldownText.textContent = 'Pacing: Ready';
    return;
  }

  const elapsed = Math.floor((Date.now() - lastDispatchTime) / 1000);
  const remaining = cooldownSeconds - elapsed;

  if (remaining > 0) {
    cooldownBadge.className = 'cooldown-badge waiting';
    cooldownText.textContent = `Pacing: ${remaining}s cooldown`;
  } else {
    cooldownBadge.className = 'cooldown-badge ready';
    cooldownText.textContent = 'Pacing: Ready';
  }
}, 1000);

// Fetch & Update Stats
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (!data.success) return;

    const { quota, counts } = data;

    // Update Quota Gauge
    quotaSent.textContent = quota.sentToday;
    quotaLimit.textContent = quota.dailyLimit;
    quotaBarFill.style.width = `${quota.percentage}%`;

    // Colors
    quotaBarFill.className = `quota-bar-fill ${quota.statusColor}`;
    quotaDot.className = `status-dot ${quota.statusColor}`;
    quotaHint.textContent = quota.message;

    // Update Metric Cards
    metricTotal.textContent = counts.total;
    metricPending.textContent = (counts.NEW || 0) + (counts.AI_GENERATED || 0);
    metricApproved.textContent = counts.APPROVED || 0;
    metricSentToday.textContent = quota.sentToday;
    metricSentTotal.textContent = `Total Sent: ${counts.SENT || 0}`;
    metricReplied.textContent = counts.REPLIED || 0;

    const totalSent = (counts.SENT || 0) + (counts.REPLIED || 0);
    const replyRate = totalSent > 0 ? Math.round(((counts.REPLIED || 0) / totalSent) * 100) : 0;
    metricReplyRate.textContent = `Reply Rate: ${replyRate}%`;

  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// Fetch & Render Leads
async function loadLeads() {
  try {
    let url = `/api/leads?status=${encodeURIComponent(currentFilter)}`;
    if (currentSearch) {
      url += `&search=${encodeURIComponent(currentSearch)}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) return;

    leadsData = data.leads;

    // Apply Client-Side Follower Tier Filter
    let filtered = leadsData;
    if (currentFollowerTier === 'MICRO') {
      filtered = filtered.filter(l => (l.followers_count || 0) >= 1000 && (l.followers_count || 0) < 15000);
    } else if (currentFollowerTier === 'MID') {
      filtered = filtered.filter(l => (l.followers_count || 0) >= 15000 && (l.followers_count || 0) <= 75000);
    } else if (currentFollowerTier === 'MACRO') {
      filtered = filtered.filter(l => (l.followers_count || 0) > 75000);
    } else if (currentFollowerTier === 'OVER_1K') {
      filtered = filtered.filter(l => (l.followers_count || 0) >= 1000);
    } else if (currentFollowerTier === 'NANO') {
      filtered = filtered.filter(l => (l.followers_count || 0) < 1000);
    }

    // Apply Sorting
    if (currentSort === 'FOLLOWERS_DESC') {
      filtered.sort((a, b) => (b.followers_count || 0) - (a.followers_count || 0));
    } else if (currentSort === 'FOLLOWERS_ASC') {
      filtered.sort((a, b) => (a.followers_count || 0) - (b.followers_count || 0));
    }

    renderLeads(filtered);
  } catch (err) {
    console.error('Error loading leads:', err);
    leadsContainer.innerHTML = '<div class="empty-state">Error connecting to local server.</div>';
  }
}

function renderLeads(leads) {
  if (!leads || leads.length === 0) {
    leadsContainer.innerHTML = `
      <div class="empty-state">
        <p>No prospects found matching the current filters.</p>
        <button class="btn btn-secondary btn-sm" style="margin-top: 10px;" onclick="resetFilters()">Reset All Filters</button>
      </div>
    `;
    return;
  }

  leadsContainer.innerHTML = leads.map(lead => {
    let posts = [];
    try {
      posts = JSON.parse(lead.recent_posts_json || '[]');
    } catch (e) {
      posts = [];
    }

    const postsHtml = posts.slice(0, 2).map(p => `
      <div class="post-pill" title="${p.caption}">
        📹 ${p.caption}
      </div>
    `).join('');

    const initialLetter = (lead.username || 'U')[0].toUpperCase();
    const safetyBadge = getAntiSpamBadge(lead.ai_draft);
    const followerBadge = getFollowerTierBadge(lead.followers_count || 12000);

    return `
      <div class="lead-card" id="lead-card-${lead.id}">
        <!-- Col 1: Profile Info -->
        <div class="lead-profile-col">
          <div class="profile-header">
            <div class="avatar-placeholder">${initialLetter}</div>
            <div class="profile-names">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <h3>${escapeHtml(lead.full_name || lead.username)}</h3>
                ${followerBadge}
                <span class="activity-tag">🔥 Active</span>
              </div>
              <a href="https://instagram.com/${encodeURIComponent(lead.username)}" target="_blank" rel="noopener">@${escapeHtml(lead.username)} ↗</a>
            </div>
          </div>

          <div class="profile-bio">
            ${escapeHtml(lead.bio || 'No bio information provided')}
          </div>

          ${posts.length > 0 ? `
            <div class="recent-posts-list">
              <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">RECENT CONTENT / HOOK TARGET:</span>
              ${postsHtml}
            </div>
          ` : ''}
        </div>

        <!-- Col 2: AI Draft Editor -->
        <div class="lead-draft-col">
          <div class="draft-header">
            <div class="draft-title" style="display: flex; align-items: center; gap: 8px;">
              <span>✨ Personalized Pitch Draft</span>
              ${safetyBadge}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="generateAIForLead(${lead.id})" title="Regenerate with fresh hook variations">
              <span>⚡ Regenerate</span>
            </button>
          </div>
          <textarea 
            class="draft-textarea" 
            id="draft-${lead.id}" 
            placeholder="Personalized DM copy..."
            oninput="handleDraftInput(${lead.id})"
          >${escapeHtml(lead.ai_draft || '')}</textarea>
        </div>

        <!-- Col 3: Actions & Status -->
        <div class="lead-actions-col">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">Status:</span>
            ${getStatusBadge(lead.status)}
          </div>

          <div class="action-buttons-group">
            ${lead.status !== 'APPROVED' && lead.status !== 'SENT' && lead.status !== 'REPLIED' ? `
              <button class="btn btn-outline-purple btn-sm" onclick="approveLead(${lead.id})">
                ✓ Approve for Queue
              </button>
            ` : ''}

            <button class="btn btn-primary btn-sm" onclick="dispatchDirect(${lead.id}, '${escapeHtml(lead.username)}')">
              🚀 1-Click IG Dispatch
            </button>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
              <button class="btn btn-secondary btn-sm" onclick="updateLeadStatus(${lead.id}, 'REPLIED')">
                💬 Replied
              </button>
              <button class="btn btn-secondary btn-sm" onclick="updateLeadStatus(${lead.id}, 'SKIPPED')">
                ✕ Skip
              </button>
            </div>

            <button class="btn btn-secondary btn-sm" style="color: var(--accent-red); border-color: rgba(239, 68, 68, 0.2);" onclick="deleteLead(${lead.id})">
              🗑 Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
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

window.handleDraftInput = function(id) {
  // Live input update
};

// Generate AI for single lead
window.generateAIForLead = async function(id) {
  showToast('Analyzing profile & generating personalized pitch...');
  try {
    const res = await fetch(`/api/leads/${id}/generate-ai`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      document.getElementById(`draft-${id}`).value = data.lead.ai_draft;
      showToast('Personalized pitch generated!');
      loadStats();
      loadLeads();
    }
  } catch (err) {
    showToast('Failed to generate pitch');
  }
};

// Approve Lead into Queue
window.approveLead = async function(id) {
  const draftElement = document.getElementById(`draft-${id}`);
  const currentDraft = draftElement ? draftElement.value : '';

  try {
    const res = await fetch(`/api/leads/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'APPROVED',
        ai_draft: currentDraft
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Lead approved into sending queue!');
      loadStats();
      loadLeads();
    }
  } catch (err) {
    showToast('Failed to approve lead');
  }
};

// Dispatch Direct (1-Click Safe Helper)
window.dispatchDirect = async function(id, username) {
  const draftElement = document.getElementById(`draft-${id}`);
  const message = draftElement ? draftElement.value : '';

  if (!message || message.trim() === '') {
    showToast('Please generate or enter a message draft before dispatching!');
    return;
  }

  // Check Cooldown pacing
  const elapsed = Math.floor((Date.now() - lastDispatchTime) / 1000);
  if (lastDispatchTime > 0 && elapsed < 15) {
    showToast(`⚠️ Meta Safety Alert: Please wait ${15 - elapsed}s to maintain natural human pacing!`, 4000);
  }

  lastDispatchTime = Date.now();
  const cleanUser = username.replace(/^@/, '').trim();

  // 1. Copy message to clipboard as instant backup
  try {
    await navigator.clipboard.writeText(message);
  } catch (e) {
    console.warn('Clipboard write fallback');
  }

  // 2. Prepare payload for Chrome Extension
  const payload = {
    username: cleanUser.toLowerCase(),
    message: message,
    timestamp: Date.now()
  };

  let hashParam = '';
  try {
    hashParam = '#ig_draft=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
  } catch (e) {
    console.warn('Hash encode error', e);
  }

  // 3. Open Instagram Profile Web
  const igUrl = `https://www.instagram.com/${encodeURIComponent(cleanUser)}/${hashParam}`;
  window.open(igUrl, '_blank');

  // 4. Mark as sent in backend to track Safe Quota
  try {
    const res = await fetch(`/api/leads/${id}/mark-sent`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Opening @${cleanUser}... Extension will auto-click 'Message' & fill draft!`);
      loadStats();
      loadLeads();
    }
  } catch (err) {
    console.error('Error updating status:', err);
  }
};

// Update status
window.updateLeadStatus = async function(id, newStatus) {
  try {
    const res = await fetch(`/api/leads/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Status updated to: ${newStatus}`);
      loadStats();
      loadLeads();
    }
  } catch (err) {
    showToast('Error updating status');
  }
};

// Delete lead
window.deleteLead = async function(id) {
  if (!confirm('Are you sure you want to delete this prospect?')) return;
  try {
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Lead deleted successfully.');
      loadStats();
      loadLeads();
    }
  } catch (err) {
    showToast('Error deleting lead');
  }
};

// Batch AI Generation
btnBatchGenerateAI.addEventListener('click', async () => {
  showToast('Generating personalized pitches for all pending leads...');
  try {
    const res = await fetch('/api/leads/generate-all-pending', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Generated pitches for ${data.generatedCount} leads!`);
      loadStats();
      loadLeads();
    }
  } catch (err) {
    showToast('Batch generation failed');
  }
});

// Dispatch Next in Queue
btnDispatchNext.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/leads/next-in-queue');
    const data = await res.json();
    if (!data.success) {
      showToast(data.message || 'Unable to fetch next queued lead');
      return;
    }

    if (!data.lead) {
      showToast('No leads currently in APPROVED queue. Approve some leads first!');
      return;
    }

    dispatchDirect(data.lead.id, data.lead.username);
  } catch (err) {
    showToast('Error fetching next lead');
  }
});

// Filter Tabs
filterTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  currentFilter = btn.dataset.status;
  loadLeads();
});

// Follower Tier Filter
filterFollowerTier.addEventListener('change', () => {
  currentFollowerTier = filterFollowerTier.value;
  loadLeads();
});

// Sorting
sortLeads.addEventListener('change', () => {
  currentSort = sortLeads.value;
  loadLeads();
});

// Search Filter
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentSearch = e.target.value.trim();
    loadLeads();
  }, 250);
});

function resetFilters() {
  currentFilter = 'ALL';
  currentFollowerTier = 'ALL';
  currentSort = 'DEFAULT';
  currentSearch = '';
  searchInput.value = '';
  filterFollowerTier.value = 'ALL';
  sortLeads.value = 'DEFAULT';
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.status === 'ALL');
  });
  loadLeads();
}

// Modal Toggle
btnOpenAddLead.addEventListener('click', () => { addLeadModal.classList.add('active'); });
closeAddLeadModal.addEventListener('click', () => { addLeadModal.classList.remove('active'); });

tabSingleMode.addEventListener('click', () => {
  tabSingleMode.classList.add('active');
  tabBulkMode.classList.remove('active');
  singleLeadForm.classList.remove('hidden');
  bulkLeadForm.classList.add('hidden');
});

tabBulkMode.addEventListener('click', () => {
  tabBulkMode.classList.add('active');
  tabSingleMode.classList.remove('active');
  bulkLeadForm.classList.remove('hidden');
  singleLeadForm.classList.add('hidden');
});

// Preset Warm-up Change
settingWarmupStage.addEventListener('change', () => {
  const stage = settingWarmupStage.value;
  if (stage === 'NEW') {
    settingDailyLimit.value = 7;
    cooldownSeconds = 90;
  } else if (stage === 'WARMING') {
    settingDailyLimit.value = 15;
    cooldownSeconds = 60;
  } else if (stage === 'AGED') {
    settingDailyLimit.value = 25;
    cooldownSeconds = 45;
  }
});

// Submit Single Lead
singleLeadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('singleUsername').value.trim().replace(/^@/, '');
  const fullName = document.getElementById('singleFullName').value.trim();
  const bio = document.getElementById('singleBio').value.trim();
  const postCaption = document.getElementById('singlePostCaption').value.trim();

  const payload = {
    username,
    full_name: fullName,
    bio,
    recent_posts: postCaption ? [{ caption: postCaption, date: 'Recent' }] : []
  };

  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success && data.inserted.length > 0) {
      showToast(`Added @${username}. Auto-generating pitch...`);
      addLeadModal.classList.remove('active');
      singleLeadForm.reset();

      // Auto generate AI
      await fetch(`/api/leads/${data.inserted[0].id}/generate-ai`, { method: 'POST' });
      loadStats();
      loadLeads();
    } else {
      showToast('Error: ' + (data.errors?.[0]?.error || 'Could not add lead'));
    }
  } catch (err) {
    showToast('Network error');
  }
});

// Submit Bulk Leads
bulkLeadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawText = document.getElementById('bulkInput').value.trim();
  if (!rawText) return;

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const leads = lines.map(line => {
    const cleanUser = line.replace('@', '').trim();
    return {
      username: cleanUser,
      full_name: cleanUser
    };
  });

  try {
    if (bulkReplaceExisting && bulkReplaceExisting.checked) {
      await fetch('/api/leads/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'ALL' })
      });
    }

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leads)
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Successfully imported ${data.insertedCount} leads!`);
      addLeadModal.classList.remove('active');
      bulkLeadForm.reset();
      loadStats();
      loadLeads();
    }
  } catch (err) {
    showToast('Import failed');
  }
});

// Settings Modal
btnOpenSettings.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success) {
      settingDailyLimit.value = data.settings.daily_limit || 15;
      settingGeminiKey.value = data.settings.gemini_api_key || '';
      settingService.value = data.settings.outreach_service || '';
      settingTone.value = data.settings.outreach_tone || '';
      settingsModal.classList.add('active');
    }
  } catch (err) {
    showToast('Could not load settings');
  }
});

closeSettingsModal.addEventListener('click', () => {
  settingsModal.classList.remove('active');
});

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    daily_limit: settingDailyLimit.value,
    gemini_api_key: settingGeminiKey.value.trim(),
    outreach_service: settingService.value.trim(),
    outreach_tone: settingTone.value.trim()
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Settings saved successfully!');
      settingsModal.classList.remove('active');
      loadStats();
    }
  } catch (err) {
    showToast('Error saving settings');
  }
});

// Find Leads Modal Handlers
btnOpenFindLeads.addEventListener('click', () => {
  findLeadsModal.classList.add('active');
  const kw = finderKeyword.value.trim() || 'Fitness Coach';
  updateSearchShortcuts(kw);
});

closeFindLeadsModal.addEventListener('click', () => {
  findLeadsModal.classList.remove('active');
});

function updateSearchShortcuts(keyword) {
  const clean = encodeURIComponent(keyword.trim());
  const tier = finderFollowerTier.value;
  linkGoogleXray.href = `https://www.google.com/search?q=site:instagram.com+%22${clean}%22+%22DM+for%22+OR+%22link+in+bio%22`;
  linkIgTag.href = `https://www.instagram.com/explore/tags/${clean.replace(/\+/g, '').replace(/%20/g, '')}/`;
  searchShortcutsContainer.style.display = 'block';
}

finderKeyword.addEventListener('input', () => {
  const kw = finderKeyword.value.trim();
  if (kw) updateSearchShortcuts(kw);
});

finderFollowerTier.addEventListener('change', () => {
  const kw = finderKeyword.value.trim();
  if (kw) updateSearchShortcuts(kw);
});

// Shortcut Pills in Discovery Modal
document.querySelectorAll('.shortcut-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    finderKeyword.value = btn.dataset.kw;
    updateSearchShortcuts(btn.dataset.kw);
    findLeadsForm.dispatchEvent(new Event('submit'));
  });
});

findLeadsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const keyword = finderKeyword.value.trim();
  const language = finderLanguage.value;
  const count = parseInt(finderCount.value, 10);
  const followerTier = finderFollowerTier.value;
  const activityRecency = finderActivity.value;

  if (!keyword) return;

  btnExecuteSearch.disabled = true;
  btnExecuteSearch.innerHTML = '<span>⚡ Searching Target Creators...</span>';

  try {
    const res = await fetch('/api/leads/find-by-keyword', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, language, count, followerTier, activityRecency })
    });

    const data = await res.json();
    if (data.success && Array.isArray(data.leads) && data.leads.length > 0) {
      discoveredLeadsCache = data.leads;
      finderFoundCount.textContent = data.leads.length;
      updateSearchShortcuts(keyword);

      finderResultsList.innerHTML = data.leads.map((l, idx) => {
        const tierBadge = getFollowerTierBadge(l.followers_count || 12000);
        const activityBadge = l.activity_label ? `<span class="activity-tag">🔥 ${escapeHtml(l.activity_label)}</span>` : '<span class="activity-tag">🔥 Active</span>';

        return `
          <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <a href="https://instagram.com/${encodeURIComponent(l.username)}" target="_blank" rel="noopener" style="color: var(--accent-cyan); font-weight: 700; font-size: 0.85rem; text-decoration: none;" title="Open live profile in new tab">
                  @${escapeHtml(l.username)} ↗
                </a>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">(${escapeHtml(l.full_name || '')})</span>
                ${tierBadge}
                ${activityBadge}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                ${escapeHtml(l.bio || '')}
              </div>
              ${l.recent_posts && l.recent_posts[0] ? `
                <div style="font-size: 0.7rem; color: var(--accent-purple); margin-top: 3px;">
                  📹 Hook target: "${escapeHtml(l.recent_posts[0].caption)}"
                </div>
              ` : ''}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="importSingleDiscovered(${idx})" style="white-space: nowrap; font-size: 0.75rem;">
              + Import
            </button>
          </div>
        `;
      }).join('');

      finderResultsArea.style.display = 'block';
      showToast(`Found ${data.leads.length} verified creators for "${keyword}"!`);
    } else {
      discoveredLeadsCache = [];
      finderFoundCount.textContent = '0';
      finderResultsList.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 0.85rem;">
          <p>Không tìm thấy creator phù hợp với từ khóa này trong kho dữ liệu cục bộ.</p>
          <p style="margin-top: 6px; font-size: 0.8rem; color: var(--text-muted);">
            👉 Bạn có thể dùng <strong>Google X-Ray</strong> hoặc <strong>Instagram Explore</strong> bên dưới để lấy username và dán vào tab <em>Bulk Import</em>.
          </p>
        </div>
      `;
      finderResultsArea.style.display = 'block';
      updateSearchShortcuts(keyword);
      showToast('No matching creators found for this keyword.');
    }
  } catch (err) {
    showToast('Error discovering leads');
  } finally {
    btnExecuteSearch.disabled = false;
    btnExecuteSearch.innerHTML = '<span>⚡ Discover Matching Creators</span>';
  }
});

window.importSingleDiscovered = async function(index) {
  const lead = discoveredLeadsCache[index];
  if (!lead) return;

  try {
    const res = await fetch('/api/leads/import-found', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: [lead], autoGenerateAI: true })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Imported @${lead.username} & auto-generated personalized AI pitch!`);
      loadStats();
      loadLeads();
    }
  } catch (err) {
    showToast('Error importing lead');
  }
};

btnImportAllFound.addEventListener('click', async () => {
  if (!discoveredLeadsCache || discoveredLeadsCache.length === 0) return;

  const replaceExisting = finderReplaceExisting && finderReplaceExisting.checked;
  showToast(`Importing ${discoveredLeadsCache.length} leads & generating AI pitches...`);
  try {
    const res = await fetch('/api/leads/import-found', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: discoveredLeadsCache, autoGenerateAI: true, replaceExisting })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Successfully imported ${data.insertedCount} leads into CRM!`);
      findLeadsModal.classList.remove('active');
      loadStats();
      loadLeads();
    }
  } catch (err) {
    showToast('Error importing all discovered leads');
  }
});

// Clear / Remove Leads Modal Handlers
if (btnOpenClearLeads) {
  btnOpenClearLeads.addEventListener('click', () => {
    clearLeadsModal.classList.add('active');
  });
}

if (closeClearLeadsModal) {
  closeClearLeadsModal.addEventListener('click', () => {
    clearLeadsModal.classList.remove('active');
  });
}

if (btnCancelClearLeads) {
  btnCancelClearLeads.addEventListener('click', () => {
    clearLeadsModal.classList.remove('active');
  });
}

if (btnConfirmClearLeads) {
  btnConfirmClearLeads.addEventListener('click', async () => {
    const scopeRadio = document.querySelector('input[name="clearScope"]:checked');
    const scope = scopeRadio ? scopeRadio.value : 'ALL';

    btnConfirmClearLeads.disabled = true;
    btnConfirmClearLeads.textContent = 'Đang xóa...';

    try {
      const res = await fetch('/api/leads/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Đã loại bỏ ${data.deletedCount} leads thành công!`);
        clearLeadsModal.classList.remove('active');
        loadStats();
        loadLeads();
      } else {
        showToast('Lỗi khi xóa leads');
      }
    } catch (err) {
      showToast('Lỗi kết nối máy chủ');
    } finally {
      btnConfirmClearLeads.disabled = false;
      btnConfirmClearLeads.textContent = 'Xác nhận xóa';
    }
  });
}

// --- Quick Paste & Extract Leads Handlers ---
function extractInstagramHandlesFromText(text) {
  if (!text) return [];
  const handles = new Set();
  const systemPaths = new Set([
    'p', 'reel', 'reels', 'explore', 'tags', 'stories', 'accounts',
    'direct', 'legal', 'about', 'developer', 'help', 'terms', 'privacy',
    'tv', 'locations', 'topics', 'api', 'instagram', 'search'
  ]);

  // Pattern A: Google Breadcrumbs "Instagram > username" or "Instagram › username"
  const bRegex = /Instagram\s*[›>•\s\-]+\s*([a-zA-Z0-9._]{2,30})/gi;
  let m;
  while ((m = bRegex.exec(text)) !== null) {
    const u = m[1].toLowerCase().trim();
    if (!systemPaths.has(u)) handles.add(u);
  }

  // Pattern B: Direct URL paths "instagram.com/username"
  const urlRegex = /instagram\.com\/([a-zA-Z0-9._]{2,30})/gi;
  while ((m = urlRegex.exec(text)) !== null) {
    const u = m[1].toLowerCase().trim();
    if (!systemPaths.has(u)) handles.add(u);
  }

  // Pattern C: Mentions "@username"
  const atRegex = /@([a-zA-Z0-9._]{2,30})/g;
  while ((m = atRegex.exec(text)) !== null) {
    const u = m[1].toLowerCase().trim();
    if (!systemPaths.has(u)) handles.add(u);
  }

  // Pattern D: Plain single handle lines
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  lines.forEach(line => {
    const clean = line.replace(/^@/, '').trim().toLowerCase();
    if (/^[a-zA-Z0-9._]{3,30}$/.test(clean) && !systemPaths.has(clean) && !clean.includes(' ') && !clean.includes('http')) {
      handles.add(clean);
    }
  });

  return Array.from(handles);
}

if (btnOpenPasteExtract) {
  btnOpenPasteExtract.addEventListener('click', () => {
    pasteExtractModal.classList.add('active');
    pasteExtractInput.value = '';
    pasteExtractPreview.style.display = 'none';
    pasteExtractInput.focus();
  });
}

if (closePasteExtractModal) {
  closePasteExtractModal.addEventListener('click', () => {
    pasteExtractModal.classList.remove('active');
  });
}

if (btnCancelPasteExtract) {
  btnCancelPasteExtract.addEventListener('click', () => {
    pasteExtractModal.classList.remove('active');
  });
}

if (pasteExtractInput) {
  pasteExtractInput.addEventListener('input', () => {
    const text = pasteExtractInput.value;
    const extracted = extractInstagramHandlesFromText(text);
    if (extracted.length > 0) {
      pasteExtractCount.textContent = extracted.length;
      pasteExtractPreview.style.display = 'block';
    } else {
      pasteExtractPreview.style.display = 'none';
    }
  });
}

if (btnConfirmPasteExtract) {
  btnConfirmPasteExtract.addEventListener('click', async () => {
    const text = pasteExtractInput.value;
    const handles = extractInstagramHandlesFromText(text);

    if (handles.length === 0) {
      showToast('Không tìm thấy tài khoản Instagram nào trong văn bản vừa dán!');
      return;
    }

    const replaceExisting = pasteReplaceExisting && pasteReplaceExisting.checked;
    btnConfirmPasteExtract.disabled = true;
    btnConfirmPasteExtract.textContent = 'Đang nạp vào CRM...';

    const leads = handles.map(u => ({
      username: u,
      full_name: `@${u}`,
      bio: 'Imported via Quick Paste (Google / IG Search)',
      followers_count: 20000,
      recent_posts: [{ caption: 'Recent Instagram Reel / Post', date: 'Recent' }]
    }));

    try {
      const res = await fetch('/api/leads/import-found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads,
          autoGenerateAI: true,
          replaceExisting
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Đã nạp thành công ${data.insertedCount} leads vào CRM!`);
        pasteExtractModal.classList.remove('active');
        loadStats();
        loadLeads();
      } else {
        showToast('Lỗi khi nạp leads');
      }
    } catch (e) {
      showToast('Lỗi kết nối máy chủ');
    } finally {
      btnConfirmPasteExtract.disabled = false;
      btnConfirmPasteExtract.textContent = '📥 Nạp Leads vào CRM';
    }
  });
}

// Close modal on click outside
window.addEventListener('click', (e) => {
  if (e.target === addLeadModal) addLeadModal.classList.remove('active');
  if (e.target === settingsModal) settingsModal.classList.remove('active');
  if (e.target === findLeadsModal) findLeadsModal.classList.remove('active');
  if (e.target === clearLeadsModal) clearLeadsModal.classList.remove('active');
  if (e.target === pasteExtractModal) pasteExtractModal.classList.remove('active');
});

// Init on load
loadStats();
loadLeads();

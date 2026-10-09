const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const { db } = require('./database/db');
const { getTodayQuota, incrementSentCount, getSettings } = require('./services/quotaService');
const { generateGeminiAIDraft, extractSmartFirstName } = require('./services/aiService');
const { findLeadsByKeyword, getSearchShortcuts, calculateBudgetScore } = require('./services/leadFinderService');

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '../../frontend');

// Helper to parse JSON body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body || body.trim() === '') {
        return resolve({});
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        try {
          resolve(JSON.parse(body.replace(/\\"/g, '"')));
        } catch (e2) {
          resolve({});
        }
      }
    });
    req.on('error', () => resolve({}));
  });
}

// Helper to send JSON responses
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// Serve static frontend files
function serveStaticFile(req, res, pathname) {
  let filePath = path.join(FRONTEND_DIR, pathname === '/' ? 'index.html' : pathname);
  
  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Server Error');
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    // --- API ROUTES ---

    // GET /api/stats
    if (pathname === '/api/stats' && method === 'GET') {
      const quota = getTodayQuota();
      const statusCounts = db.prepare(`
        SELECT status, COUNT(*) as count FROM leads GROUP BY status
      `).all();

      const counts = {
        total: 0,
        NEW: 0,
        AI_GENERATED: 0,
        APPROVED: 0,
        SENT: 0,
        REPLIED: 0,
        SKIPPED: 0
      };

      for (const row of statusCounts) {
        counts[row.status] = row.count;
        counts.total += row.count;
      }

      return sendJSON(res, 200, {
        success: true,
        quota,
        counts
      });
    }

    // GET /api/leads
    if (pathname === '/api/leads' && method === 'GET') {
      const statusFilter = parsedUrl.query.status;
      const search = parsedUrl.query.search;

      let sql = 'SELECT * FROM leads WHERE 1=1';
      const params = [];

      if (statusFilter && statusFilter !== 'ALL') {
        sql += ' AND status = ?';
        params.push(statusFilter);
      }

      if (search) {
        sql += ' AND (username LIKE ? OR full_name LIKE ? OR bio LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      sql += ' ORDER BY id DESC';
      const leads = db.prepare(sql).all(...params);
      const enrichedLeads = leads.map(l => {
        const budget = calculateBudgetScore(l);
        return {
          ...l,
          budget_score: budget.score,
          budget_tier: budget.tier,
          budget_label: budget.label,
          budget_signals: budget.signals,
          meta_ads_url: budget.metaAdsUrl
        };
      });
      return sendJSON(res, 200, { success: true, leads: enrichedLeads });
    }

    // POST /api/leads (Single or Bulk)
    if (pathname === '/api/leads' && method === 'POST') {
      const body = await parseBody(req);
      const leadsToAdd = Array.isArray(body) ? body : [body];
      const inserted = [];
      const errors = [];

      const insertStmt = db.prepare(`
        INSERT INTO leads (username, full_name, bio, followers_count, recent_posts_json, status, notes)
        VALUES (?, ?, ?, ?, ?, 'NEW', ?)
      `);

      for (const item of leadsToAdd) {
        if (!item.username) {
          errors.push({ item, error: 'Username is required' });
          continue;
        }
        const cleanUsername = item.username.replace('@', '').trim().toLowerCase();
        try {
          const postsJson = typeof item.recent_posts === 'string' ? item.recent_posts : JSON.stringify(item.recent_posts || []);
          const result = insertStmt.run(
            cleanUsername,
            item.full_name || cleanUsername,
            item.bio || '',
            parseInt(item.followers_count || 0, 10),
            postsJson,
            item.notes || ''
          );
          inserted.push({ id: Number(result.lastInsertRowid), username: cleanUsername });
        } catch (e) {
          errors.push({ username: cleanUsername, error: 'Tài khoản đã tồn tại hoặc dữ liệu lỗi' });
        }
      }

      return sendJSON(res, 201, { success: true, insertedCount: inserted.length, inserted, errors });
    }

    // GET /api/leads/next-in-queue (For Chrome Extension)
    if (pathname === '/api/leads/next-in-queue' && method === 'GET') {
      const quota = getTodayQuota();
      if (!quota.canSend) {
        return sendJSON(res, 200, {
          success: false,
          blocked: true,
          message: 'Đã đạt giới hạn an toàn hôm nay. Tạm khóa hàng đợi gửi.',
          quota
        });
      }

      const lead = db.prepare(`
        SELECT * FROM leads WHERE status = 'APPROVED' ORDER BY id ASC LIMIT 1
      `).get();

      return sendJSON(res, 200, {
        success: true,
        lead: lead || null,
        quota
      });
    }

    // POST /api/leads/:id/generate-ai
    const matchGenerate = pathname.match(/^\/api\/leads\/(\d+)\/generate-ai$/);
    if (matchGenerate && method === 'POST') {
      const id = parseInt(matchGenerate[1], 10);
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!lead) return sendJSON(res, 404, { success: false, error: 'Lead not found' });

      const settings = getSettings();
      const draft = await generateGeminiAIDraft(lead, settings);

      db.prepare(`
        UPDATE leads 
        SET ai_draft = ?, status = CASE WHEN status = 'NEW' THEN 'AI_GENERATED' ELSE status END, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(draft, id);

      const updatedLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      return sendJSON(res, 200, { success: true, lead: updatedLead });
    }

    // POST /api/leads/generate-all-pending (Batch AI generation)
    if (pathname === '/api/leads/generate-all-pending' && method === 'POST') {
      const pendingLeads = db.prepare("SELECT * FROM leads WHERE status IN ('NEW', 'AI_GENERATED') OR ai_draft IS NULL").all();
      const settings = getSettings();
      let generatedCount = 0;

      for (const lead of pendingLeads) {
        const draft = await generateGeminiAIDraft(lead, settings);
        const smartName = extractSmartFirstName(lead);
        const cleanDisplayName = smartName ? `${smartName} (@${lead.username})` : `@${lead.username}`;
        db.prepare(`
          UPDATE leads 
          SET ai_draft = ?, full_name = ?, status = 'AI_GENERATED', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(draft, cleanDisplayName, lead.id);
        generatedCount++;
      }

      return sendJSON(res, 200, { success: true, generatedCount });
    }

    // POST /api/leads/find-by-keyword (Keyword Discovery Engine)
    if (pathname === '/api/leads/find-by-keyword' && method === 'POST') {
      const body = await parseBody(req);
      const keyword = body.keyword || 'fitness coach';
      const language = body.language || 'EN';
      const followerTier = body.followerTier || 'ALL';
      const activityRecency = body.activityRecency || 'ALL';
      const count = Math.min(Math.max(parseInt(body.count || 5, 10), 1), 25);
      const settings = getSettings();

      const discoveredLeads = await findLeadsByKeyword(keyword, language, count, followerTier, activityRecency, settings);
      const shortcuts = getSearchShortcuts(keyword, followerTier, activityRecency);

      return sendJSON(res, 200, {
        success: true,
        keyword,
        count: discoveredLeads.length,
        leads: discoveredLeads,
        shortcuts
      });
    }

    // POST /api/leads/import-found (Import discovered leads with optional auto-AI)
    if (pathname === '/api/leads/import-found' && method === 'POST') {
      const body = await parseBody(req);
      const leads = Array.isArray(body.leads) ? body.leads : [];
      const autoAI = body.autoGenerateAI !== false;
      const replaceExisting = body.replaceExisting === true;
      const settings = getSettings();

      if (replaceExisting) {
        db.prepare('DELETE FROM leads').run();
      }

      const insertStmt = db.prepare(`
        INSERT INTO leads (username, full_name, bio, followers_count, recent_posts_json, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      let insertedCount = 0;
      const insertedLeads = [];

      for (const item of leads) {
        const cleanUser = (item.username || '').replace(/^@/, '').trim().toLowerCase();
        if (!cleanUser) continue;

        try {
          const postsJson = JSON.stringify(item.recent_posts || []);
          const tempLead = { username: cleanUser, full_name: item.full_name || '', bio: item.bio || '', recent_posts_json: postsJson };
          const smartName = extractSmartFirstName(tempLead);
          const cleanDisplayName = smartName ? `${smartName} (@${cleanUser})` : `@${cleanUser}`;

          const result = insertStmt.run(
            cleanUser,
            cleanDisplayName,
            item.bio || '',
            item.followers_count || 0,
            postsJson,
            'NEW'
          );

          const newId = Number(result.lastInsertRowid);
          insertedCount++;
          insertedLeads.push({ id: newId, username: cleanUser, full_name: cleanDisplayName, bio: item.bio || '', recent_posts_json: postsJson });
        } catch (e) {
          // Ignore duplicates
        }
      }

      // Generate AI drafts in background so response returns immediately
      if (autoAI && insertedLeads.length > 0) {
        (async () => {
          for (const l of insertedLeads) {
            try {
              const draft = await generateGeminiAIDraft(l, settings);
              db.prepare(`
                UPDATE leads SET ai_draft = ?, status = 'AI_GENERATED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
              `).run(draft, l.id);
            } catch (err) {
              console.error('[AI Background Draft Error]', err.message);
            }
          }
        })();
      }

      return sendJSON(res, 200, { success: true, insertedCount });
    }

    // POST /api/leads/:id/approve
    const matchApprove = pathname.match(/^\/api\/leads\/(\d+)\/approve$/);
    if (matchApprove && method === 'POST') {
      const id = parseInt(matchApprove[1], 10);
      const body = await parseBody(req);
      
      const draftUpdate = body.ai_draft ? body.ai_draft : null;
      if (draftUpdate) {
        db.prepare("UPDATE leads SET ai_draft = ?, status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(draftUpdate, id);
      } else {
        db.prepare("UPDATE leads SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      }

      const updatedLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      return sendJSON(res, 200, { success: true, lead: updatedLead });
    }

    // POST /api/leads/:id/mark-sent
    const matchSent = pathname.match(/^\/api\/leads\/(\d+)\/mark-sent$/);
    if (matchSent && method === 'POST') {
      const id = parseInt(matchSent[1], 10);
      const nowStr = new Date().toISOString();

      db.prepare(`
        UPDATE leads 
        SET status = 'SENT', sent_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(nowStr, id);

      const newQuota = incrementSentCount();
      const updatedLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);

      return sendJSON(res, 200, { success: true, lead: updatedLead, quota: newQuota });
    }

    // POST /api/leads/:id/status
    const matchStatus = pathname.match(/^\/api\/leads\/(\d+)\/status$/);
    if (matchStatus && method === 'POST') {
      const id = parseInt(matchStatus[1], 10);
      const body = await parseBody(req);
      const newStatus = body.status;

      if (!['NEW', 'AI_GENERATED', 'APPROVED', 'SENT', 'REPLIED', 'SKIPPED'].includes(newStatus)) {
        return sendJSON(res, 400, { success: false, error: 'Trạng thái không hợp lệ' });
      }

      db.prepare("UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newStatus, id);
      const updatedLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      return sendJSON(res, 200, { success: true, lead: updatedLead });
    }

    // POST /api/leads/update-live-stats (Update verified follower count from live Instagram page)
    if (pathname === '/api/leads/update-live-stats' && method === 'POST') {
      const body = await parseBody(req);
      const username = (body.username || '').replace(/^@/, '').trim().toLowerCase();
      const followers = parseInt(body.followers_count, 10);
      if (username && !isNaN(followers)) {
        db.prepare('UPDATE leads SET followers_count = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?').run(followers, username);
        return sendJSON(res, 200, { success: true, username, followers });
      }
      return sendJSON(res, 400, { success: false, error: 'Invalid parameters' });
    }

    // PUT /api/leads/:id
    const matchPutLead = pathname.match(/^\/api\/leads\/(\d+)$/);
    if (matchPutLead && method === 'PUT') {
      const id = parseInt(matchPutLead[1], 10);
      const body = await parseBody(req);

      db.prepare(`
        UPDATE leads 
        SET full_name = COALESCE(?, full_name),
            bio = COALESCE(?, bio),
            ai_draft = COALESCE(?, ai_draft),
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(body.full_name, body.bio, body.ai_draft, body.notes, id);

      const updatedLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      return sendJSON(res, 200, { success: true, lead: updatedLead });
    }

    // POST /api/leads/clear (Clear leads by scope)
    if ((pathname === '/api/leads/clear' || pathname === '/api/leads/clear-all') && (method === 'POST' || method === 'DELETE')) {
      const body = await parseBody(req).catch(() => ({}));
      const scope = body.scope || 'ALL';
      let deletedCount = 0;

      if (scope === 'ALL') {
        const resDel = db.prepare('DELETE FROM leads').run();
        deletedCount = Number(resDel.changes);
      } else if (scope === 'SENT_OR_SKIPPED') {
        const resDel = db.prepare("DELETE FROM leads WHERE status IN ('SENT', 'SKIPPED', 'REPLIED')").run();
        deletedCount = Number(resDel.changes);
      } else if (scope === 'NEW_OR_UNAPPROVED') {
        const resDel = db.prepare("DELETE FROM leads WHERE status IN ('NEW', 'AI_GENERATED')").run();
        deletedCount = Number(resDel.changes);
      } else if (body.status) {
        const resDel = db.prepare('DELETE FROM leads WHERE status = ?').run(body.status);
        deletedCount = Number(resDel.changes);
      }

      return sendJSON(res, 200, { success: true, deletedCount, message: `Đã xóa ${deletedCount} leads.` });
    }

    // POST /api/leads/batch-delete
    if (pathname === '/api/leads/batch-delete' && method === 'POST') {
      const body = await parseBody(req);
      const ids = Array.isArray(body.ids) ? body.ids : [];
      let deletedCount = 0;

      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const resDel = db.prepare(`DELETE FROM leads WHERE id IN (${placeholders})`).run(...ids);
        deletedCount = Number(resDel.changes);
      }

      return sendJSON(res, 200, { success: true, deletedCount, message: `Đã xóa ${deletedCount} leads.` });
    }

    // DELETE /api/leads/:id
    const matchDeleteLead = pathname.match(/^\/api\/leads\/(\d+)$/);
    if (matchDeleteLead && method === 'DELETE') {
      const id = parseInt(matchDeleteLead[1], 10);
      db.prepare('DELETE FROM leads WHERE id = ?').run(id);
      return sendJSON(res, 200, { success: true, message: 'Đã xóa lead' });
    }

    // GET /api/settings
    if (pathname === '/api/settings' && method === 'GET') {
      return sendJSON(res, 200, { success: true, settings: getSettings() });
    }

    // POST /api/settings
    if (pathname === '/api/settings' && method === 'POST') {
      const body = await parseBody(req);
      const upsert = db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);

      for (const [k, v] of Object.entries(body)) {
        upsert.run(k, String(v));
      }

      return sendJSON(res, 200, { success: true, settings: getSettings() });
    }

    // Fallback: Static Files
    return serveStaticFile(req, res, pathname);

  } catch (err) {
    console.error('Server error:', err);
    return sendJSON(res, 500, { success: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Instagram Outreach CRM Backend running!`);
  console.log(`👉 Web Dashboard: http://localhost:${PORT}`);
  console.log(`👉 API Endpoints: http://localhost:${PORT}/api/stats`);
  console.log(`====================================================`);
});

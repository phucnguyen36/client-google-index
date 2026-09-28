const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, '../../outreach.db');
const db = new DatabaseSync(dbPath);

// Initialize Tables
function initDatabase() {
  // Foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Campaigns table
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_niche TEXT,
      pitch_goal TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Leads table
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT,
      bio TEXT,
      followers_count INTEGER DEFAULT 0,
      recent_posts_json TEXT,
      ai_draft TEXT,
      status TEXT DEFAULT 'NEW', -- NEW, AI_GENERATED, APPROVED, SENT, REPLIED, SKIPPED
      sent_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
    );
  `);

  // Daily dispatch logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD
      sent_count INTEGER DEFAULT 0,
      limit_max INTEGER DEFAULT 20
    );
  `);

  // Seed default settings if empty
  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');

  insertSetting.run('daily_limit', '20');
  insertSetting.run('gemini_api_key', '');
  insertSetting.run('sender_name', 'Alex');
  insertSetting.run('outreach_service', 'High-retention Video Editing for Reels & TikToks (Pacing, Sound Design & Visual Hooks)');
  insertSetting.run('outreach_tone', 'Casual, creator-to-creator, punchy, value-first, non-salesy');

  // Seed a sample campaign if empty
  const countCampaigns = db.prepare('SELECT COUNT(*) as count FROM campaigns').get();
  if (countCampaigns.count === 0) {
    const insertCampaign = db.prepare(`
      INSERT INTO campaigns (name, target_niche, pitch_goal)
      VALUES (?, ?, ?)
    `);
    const result = insertCampaign.run(
      'English Creators & Coaches (Short-form Video Editing)',
      'Fitness Coaches, SaaS Founders, Podcasters, Real Estate Creators (US/UK/EU)',
      'Pitch 1 free sample retention edit to turn cold creators into paying monthly retainer clients ($1,500 - $3,000/mo)'
    );
    const campaignId = Number(result.lastInsertRowid);

    // Seed verified live sample leads
    const insertLead = db.prepare(`
      INSERT INTO leads (campaign_id, username, full_name, bio, followers_count, recent_posts_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertLead.run(
      campaignId,
      'pedro_editor',
      'Pedro | Short Form Video Editor',
      'Helping creators & agencies scale with high-retention editing & sound design 🎬',
      45000,
      JSON.stringify([
        { caption: 'How to create seamless zoom transitions and dynamic subtitles in Premiere Pro.', date: '2 days ago', likes: 640 },
        { caption: '3 sound design mistakes ruining your retention rate on Reels 🎧', date: '4 days ago', likes: 1120 }
      ]),
      'NEW'
    );

    insertLead.run(
      campaignId,
      'jeremyethier',
      'Jeremy Ethier | Built With Science',
      'Science-backed fitness & nutrition advice to build muscle and burn fat faster 🔬',
      1200000,
      JSON.stringify([
        { caption: 'The 3 best tricep exercises backed by EMG research.', date: '1 day ago', likes: 5100 },
        { caption: 'Why doing excessive ab workouts will not burn stubborn belly fat.', date: '3 days ago', likes: 7800 }
      ]),
      'NEW'
    );

    insertLead.run(
      campaignId,
      'dan_kochel',
      'Dan Kochel | Motion & Video',
      'Visual hooks, motion graphics & viral pacing for top YouTube & Reel creators ⚡',
      68000,
      JSON.stringify([
        { caption: 'The 3-second hook formula that doubled our client video retention rate.', date: 'Yesterday', likes: 2400 },
        { caption: 'Behind the scenes: Motion tracking text in DaVinci Resolve.', date: '3 days ago', likes: 980 }
      ]),
      'NEW'
    );
  }
}

initDatabase();

module.exports = {
  db,
  initDatabase
};

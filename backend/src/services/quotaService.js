const { db } = require('../database/db');

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

function getTodayQuota() {
  const today = getTodayString();
  const settings = getSettings();
  const dailyLimit = parseInt(settings.daily_limit || '20', 10);

  let record = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(today);
  if (!record) {
    db.prepare('INSERT OR IGNORE INTO daily_logs (date, sent_count, limit_max) VALUES (?, 0, ?)').run(today, dailyLimit);
    record = { date: today, sent_count: 0, limit_max: dailyLimit };
  }

  const sent = record.sent_count;
  const remaining = Math.max(0, dailyLimit - sent);
  const percentage = Math.min(100, Math.round((sent / dailyLimit) * 100));

  let statusColor = 'green';
  let message = 'Hạn mức an toàn. Sẵn sàng gửi.';
  if (sent >= dailyLimit) {
    statusColor = 'red';
    message = 'Đã đạt giới hạn an toàn hôm nay. Tạm dừng để tránh bị Instagram kiểm tra.';
  } else if (percentage >= 75) {
    statusColor = 'yellow';
    message = 'Gần chạm ngưỡng an toàn hàng ngày. Hãy cẩn trọng.';
  }

  return {
    today,
    sentToday: sent,
    dailyLimit,
    remaining,
    percentage,
    statusColor,
    message,
    canSend: sent < dailyLimit
  };
}

function incrementSentCount() {
  const today = getTodayString();
  const settings = getSettings();
  const dailyLimit = parseInt(settings.daily_limit || '20', 10);

  // Ensure record exists
  getTodayQuota();

  db.prepare('UPDATE daily_logs SET sent_count = sent_count + 1 WHERE date = ?').run(today);
  return getTodayQuota();
}

module.exports = {
  getTodayString,
  getTodayQuota,
  incrementSentCount,
  getSettings
};

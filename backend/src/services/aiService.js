const { db } = require('../database/db');
const { getSettings } = require('./quotaService');

// English Spintax / Phrase variation pools for Video Editing Outreach
const EN_GREETINGS = [
  'Hey {{name}},',
  'Hi {{name}},',
  'Hey {{name}} - hope your week is going great!',
  'Hi {{name}}, quick note -'
];

const EN_HOOKS = [
  'Just watched your recent reel about "{{post_topic}}" - love the breakdown and how clearly you delivered that insight.',
  'Came across your video discussing "{{post_topic}}" - the value you dropped there was super sharp.',
  'Loved your recent post on "{{post_topic}}" - really solid delivery and message.',
  'Stumbled on your reel about "{{post_topic}}" - your content angle is really unique.'
];

const EN_VIDEO_OBSERVATIONS = [
  'Your content is top-tier, though I noticed the retention pacing and sound design in the first 3 seconds could be dialed in even further to keep viewers hooked till the end.',
  'Your delivery is great, but adding dynamic motion graphics and punchy visual hooks could easily double the watch-time on these reels.',
  'I feel with some tighter retention editing, sound fx, and bold B-roll transitions, your videos could easily pull 3x-5x the reach they deserve.'
];

const EN_SOFT_OFFERS = [
  'I’m a video editor specializing in high-retention short-form content. Would you be open if I edit 1 of your raw videos for free so you can see the difference in style & pacing?',
  'I edit retention-focused shorts/reels for creators in your niche. Mind if I take 1 of your recent clips and create a 30s high-energy sample edit for you completely free?',
  'I specialize in viral short-form editing and pacing. Would love to send over a 45s free revamped edit of your latest clip - no strings attached. Open to taking a look?'
];

// Vietnamese Spintax fallback
const VI_GREETINGS = [
  'Chào {{name}} nhé,',
  'Hi {{name}},',
  'Chào bạn {{name}},',
  'Hello {{name}} nha,'
];

const VI_COMPLIMENTS = [
  'Mình vừa xem video về "{{post_topic}}" của bạn, nội dung và chia sẻ rất thực tế.',
  'Tình cờ thấy bài post gần đây bạn chia sẻ về "{{post_topic}}", góc nhìn của bạn rất sâu sắc.',
  'Vừa xem qua bài chia sẻ "{{post_topic}}" trên profile của bạn, thấy rất nhiều điểm chạm giá trị.'
];

const VI_SOFT_CTAS = [
  'Bên mình chuyên dựng video ngắn (Reels/TikTok) giữ chân người xem cao. Bạn có tiện để mình dựng tặng thử 1 video mẫu hoàn toàn miễn phí xem độ hiệu quả không ha?',
  'Nếu bạn quan tâm, mình có thể gửi tóm tắt một vài mẫu video demo và case study tương tự để bạn tham khảo nhé?'
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function detectEnglish(text) {
  if (!text) return true; // Default to English for international creators
  // Simple heuristic for Vietnamese diacritics
  const viRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  return !viRegex.test(text);
}

function generateAlgorithmicDraft(lead, settings) {
  const rawName = (lead.full_name || lead.username).replace(/[@|•\-_].*/g, '').trim();
  const firstName = rawName.split(' ')[0] || lead.username;
  let posts = [];
  try {
    posts = JSON.parse(lead.recent_posts_json || '[]');
  } catch (e) {
    posts = [];
  }

  const isEnglish = detectEnglish((lead.bio || '') + ' ' + (lead.full_name || ''));

  if (isEnglish) {
    let postTopic = 'your latest video breakdown';
    if (posts.length > 0 && posts[0].caption) {
      const rawCaption = posts[0].caption.replace(/#\w+/g, '').trim();
      postTopic = rawCaption.length > 50 ? rawCaption.substring(0, 47) + '...' : rawCaption;
    }

    const greeting = getRandomItem(EN_GREETINGS).replace('{{name}}', firstName);
    const hook = getRandomItem(EN_HOOKS).replace('{{post_topic}}', postTopic);
    const observation = getRandomItem(EN_VIDEO_OBSERVATIONS);
    const offer = getRandomItem(EN_SOFT_OFFERS);

    return `${greeting}\n\n${hook} ${observation}\n\n${offer}`;
  } else {
    let postTopic = 'chia sẻ kinh nghiệm thực tế của bạn';
    if (posts.length > 0 && posts[0].caption) {
      const rawCaption = posts[0].caption;
      postTopic = rawCaption.length > 55 ? rawCaption.substring(0, 52) + '...' : rawCaption;
    }

    const greeting = getRandomItem(VI_GREETINGS).replace('{{name}}', firstName);
    const compliment = getRandomItem(VI_COMPLIMENTS).replace('{{post_topic}}', postTopic);
    const cta = getRandomItem(VI_SOFT_CTAS);

    return `${greeting}\n\n${compliment}\n\n${cta}`;
  }
}

async function generateGeminiAIDraft(lead, settings) {
  const apiKey = settings.gemini_api_key;
  if (!apiKey || apiKey.trim() === '') {
    return generateAlgorithmicDraft(lead, settings);
  }

  let posts = [];
  try {
    posts = JSON.parse(lead.recent_posts_json || '[]');
  } catch (e) {
    posts = [];
  }

  const postsSummary = posts.map((p, idx) => `Post ${idx + 1}: ${p.caption} (${p.date || 'recent'})`).join('\n');
  const isEnglish = detectEnglish((lead.bio || '') + ' ' + (lead.full_name || ''));

  const systemInstruction = `
You are an expert cold outreach specialist and high-converting video editor pitching to English-speaking creators, founders, and coaches on Instagram.

Target Lead Info:
- Name/Handle: ${lead.full_name || lead.username} (@${lead.username})
- Bio: ${lead.bio || 'N/A'}
- Recent Posts/Videos:
${postsSummary || 'No posts data'}

Sender Offer:
- Niche: High-retention Video Editing (Reels, TikToks, Shorts, YouTube)
- Specific Value: ${settings.outreach_service || 'Retention-focused video editing, visual hooks, punchy sound design & dynamic pacing'}
- Tone: ${settings.outreach_tone || 'Casual, peer-to-peer, respectful, non-salesy, punchy'}

CRITICAL RULES:
1. Language: ${isEnglish ? 'NATURAL CASUAL ENGLISH (US/UK creator tone)' : 'Natural conversational Vietnamese'}.
2. Length: Under 55-65 words total (3-4 short punchy lines max).
3. The Hook: Reference ONE specific insight, joke, or topic from their latest post/bio to prove you actually watched it.
4. The Bridge/Value: Briefly mention how their great content could get even higher retention with professional pacing/sound design/hooks.
5. The Soft CTA: Offer ONE free sample edit (e.g., "Mind if I edit 1 of your clips for free just to show you the difference?"). NO links, NO pricing, NO aggressive sales pitch.
6. Return ONLY the raw DM message text. No quotes, no placeholders, no explanations.
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemInstruction }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 250
        }
      })
    });

    if (!response.ok) {
      console.warn('Gemini API returned error, falling back to algorithmic engine:', response.statusText);
      return generateAlgorithmicDraft(lead, settings);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText && candidateText.trim().length > 0) {
      return candidateText.trim();
    }
  } catch (error) {
    console.error('Error calling Gemini API, fallback to algorithm:', error);
  }

  return generateAlgorithmicDraft(lead, settings);
}

module.exports = {
  generateGeminiAIDraft,
  generateAlgorithmicDraft
};


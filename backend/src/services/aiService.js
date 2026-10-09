const { db } = require('../database/db');
const { getSettings } = require('./quotaService');

// Words that are NEVER a person's first name (prevents "Hi Most", "Hi Join", "Hi Creator", "Hey link")
const NON_NAME_STOPLIST = new Set([
  'hey', 'hi', 'hello', 'yo', 'dear', 'welcome', 'chào', 'xin',
  'i', 'you', 'we', 'they', 'he', 'she', 'it', 'my', 'your', 'our', 'their',
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'in', 'on', 'at', 'to',
  'for', 'with', 'from', 'by', 'about', 'as', 'into', 'like', 'through', 'after',
  'over', 'between', 'out', 'against', 'during', 'without', 'before', 'under',
  'around', 'among', 'of', 'and', 'or', 'but', 'if', 'when', 'why', 'how', 'what',
  'where', 'who', 'are', 'is', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
  'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must',
  'join', 'link', 'most', 'worked', 'working', 'looking', 'calling', 'building',
  'scaling', 'helping', 'growing', 'making', 'creating', 'sharing', 'teaching',
  'stop', 'watch', 'read', 'listen', 'check', 'click', 'dm', 'follow', 'subscribe',
  'comment', 'drop', 'free', 'new', 'best', 'top', 'real', 'official', 'daily',
  'weekly', 'modern', 'luxury', 'custom', 'global', 'local', 'digital', 'online',
  'smart', 'fast', 'easy', 'simple', 'hard', 'big', 'small', 'high', 'low',
  'more', 'less', 'many', 'few', 'all', 'every', 'some', 'any', 'no', 'not',
  'never', 'always', 'just', 'only', 'also', 'very', 'really', 'so', 'too',
  'here', 'there', 'now', 'then', 'today', 'yesterday', 'tomorrow', 'unlock', 'stream',
  'creator', 'creators', 'founder', 'founders', 'ceo', 'coo', 'cto', 'cmo', 'cfo',
  'owner', 'coach', 'consultant', 'expert', 'specialist', 'mentor', 'speaker',
  'author', 'host', 'podcast', 'podcaster', 'editor', 'designer', 'developer',
  'builder', 'contractor', 'realtor', 'broker', 'agent', 'doctor', 'dr', 'dentist',
  'surgeon', 'lawyer', 'attorney', 'fitness', 'gym', 'workout', 'health', 'wellness',
  'nutrition', 'diet', 'crypto', 'forex', 'trading', 'trader', 'investor', 'investing',
  'wealth', 'finance', 'money', 'business', 'company', 'agency', 'studio', 'labs',
  'group', 'team', 'club', 'network', 'community', 'collective', 'academy', 'institute',
  'school', 'university', 'college', 'center', 'hub', 'lab', 'hq', 'inc', 'llc', 'ltd',
  'co', 'corp', 'saas', 'b2b', 'b2c', 'ai', 'tech', 'software', 'app', 'platform',
  'tool', 'tools', 'system', 'systems', 'solution', 'solutions', 'service', 'services',
  'product', 'products', 'brand', 'brands', 'marketing', 'sales', 'growth', 'seo',
  'ads', 'media', 'content', 'video', 'videos', 'reel', 'reels', 'short', 'shorts',
  'clip', 'clips', 'post', 'posts', 'photo', 'photos', 'design', 'architecture',
  'construction', 'homes', 'realty', 'estate', 'property', 'properties', 'auto',
  'car', 'cars', 'detailing', 'shop', 'store', 'ecommerce', 'shopify', 'amazon',
  'things', 'ways', 'tips', 'tricks', 'secrets', 'lessons', 'steps', 'rules', 'reasons',
  'step', 'vote', 'comment', 'submit', 'start', 'upload', 'chicago', 'springfield', 'louis'
]);

// Common first names to recognize inside concatenated usernames
const KNOWN_FIRST_NAMES = [
  'alexander', 'christopher', 'benjamin', 'nicholas', 'jonathan', 'stephen', 'guillaume', 'shanarra',
  'christian', 'lawrence', 'matthew', 'anthony', 'richard', 'charles', 'william', 'michael',
  'patrick', 'gregory', 'kenneth', 'timothy', 'jeffrey', 'brandon', 'zachary', 'douglas',
  'raymond', 'gabriel', 'bradley', 'russell', 'vincent', 'phillip', 'cameron', 'spencer',
  'garrett', 'faheema', 'justin', 'andrew', 'joshua', 'daniel', 'robert', 'thomas', 'joseph',
  'david', 'james', 'brian', 'kevin', 'jason', 'jacob', 'steven', 'edward', 'donald', 'george',
  'ronald', 'nathan', 'samuel', 'dennis', 'arthur', 'jordan', 'austin', 'dylan', 'logan',
  'albert', 'elijah', 'philip', 'eugene', 'trevor', 'julian', 'travis', 'marcus', 'carlos',
  'martin', 'victor', 'walter', 'harold', 'gerald', 'jeremy', 'taylor', 'conner', 'connor',
  'hunter', 'landon', 'cooper', 'parker', 'xavier', 'adrian', 'colton', 'damian', 'enrica',
  'pieter', 'arvid', 'alex', 'ryan', 'nick', 'erik', 'eric', 'chris', 'matt', 'mark',
  'john', 'paul', 'jack', 'luke', 'liam', 'noah', 'adam', 'kyle', 'sean', 'tane',
  'carl', 'bryan', 'bruce', 'alan', 'juan', 'wayne', 'randy', 'mason', 'ralph', 'bobby',
  'lukas', 'cole', 'grant', 'blake', 'chase', 'devon', 'derek', 'evan', 'cody', 'colin',
  'miles', 'simon', 'seth', 'shane', 'brett', 'craig', 'todd', 'troy', 'chad', 'brad',
  'greg', 'jeff', 'mike', 'dave', 'steve', 'jake', 'josh', 'tony', 'andy', 'henry',
  'peter', 'frank', 'scott', 'larry', 'jerry', 'tyler', 'aaron', 'keith', 'roger', 'terry',
  'jesse', 'billy', 'marco', 'lucas', 'mateo', 'diego', 'leo', 'max', 'sam', 'dan', 'ben',
  'tom', 'tim', 'jon', 'rob', 'bob', 'jim', 'joe', 'ian', 'eli', 'jay', 'ray', 'roy',
  'sarah', 'emily', 'jessica', 'ashley', 'amanda', 'melissa', 'nicole', 'heather',
  'michelle', 'amber', 'megan', 'rachel', 'lauren', 'rebecca', 'laura', 'andrea', 'angela',
  'maria', 'samantha', 'natalie', 'victoria', 'hannah', 'alexis', 'olivia', 'emma', 'sophia',
  'isabella', 'chloe', 'grace', 'claire', 'julia', 'maya', 'elena', 'nina', 'tara', 'kelly',
  'erin', 'katie', 'jenna', 'holly', 'brooke', 'lindsey', 'paige', 'molly', 'leah', 'monica',
  'vanessa', 'diana', 'claudia', 'wendy', 'lisa', 'karen', 'nancy', 'sandra', 'anna'
];

function capitalizeWord(w) {
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * Extracts a verified human first name (or "Dr. FirstName") from lead data, or returns null if brand/unknown.
 */
function extractSmartFirstName(lead) {
  const username = (lead.username || '').replace(/^@/, '').toLowerCase().trim();
  let rawFull = (lead.full_name || '').trim();
  const rawBio = (lead.bio || '').trim();
  const rawPosts = (lead.recent_posts_json || '').trim();
  const combinedText = `${rawFull} ${rawBio} ${rawPosts}`;

  // 1. Check for explicit "Dr. FirstName" in title, bio, or posts (e.g. "Dr. Chris Hill", "Dr. Faheema Ismail")
  const drTextMatch = combinedText.match(/\bDr\.?\s+([A-Z][a-z]{2,13})\b/);
  if (drTextMatch) {
    const drFirst = drTextMatch[1].toLowerCase();
    if (!NON_NAME_STOPLIST.has(drFirst)) {
      return `Dr. ${capitalizeWord(drFirst)}`;
    }
  }

  // 2. Check if username starts with "dr" + Known First Name (e.g. "drjordandavis_" -> "Dr. Jordan", "drtroypearce" -> "Dr. Troy")
  const drUserMatch = username.match(/^dr[._]?([a-z]{3,25})/);
  if (drUserMatch) {
    const afterDr = drUserMatch[1];
    for (const name of KNOWN_FIRST_NAMES) {
      if (afterDr.startsWith(name)) {
        return `Dr. ${capitalizeWord(name)}`;
      }
    }
  }

  // 3. If full_name contains "on Instagram:" or "trên Instagram:", extract the author name before it
  const onIgMatch = rawFull.match(/^([^:•|"\n]{2,35}?)\s+(?:on|trên)\s+Instagram/i);
  if (onIgMatch) {
    rawFull = onIgMatch[1].trim();
  }

  // 4. Try extracting from clean full_name (only if it doesn't look like a post caption)
  if (rawFull && !rawFull.startsWith('@')) {
    const firstSegment = rawFull.split(/[|•\-–—:(\n]/)[0].trim();
    const words = firstSegment.split(/\s+/).filter(Boolean);

    const looksLikeSentence = words.length > 3 || /[#0-9$%?..."'!🚀⚡🔥‼️✨]/.test(firstSegment);
    if (!looksLikeSentence && words.length >= 1 && words.length <= 3) {
      const candidate = words[0].replace(/[^a-zA-ZÀ-ỹ]/g, '');
      const lower = candidate.toLowerCase();
      if (
        candidate.length >= 2 &&
        candidate.length <= 14 &&
        !NON_NAME_STOPLIST.has(lower) &&
        lower !== username
      ) {
        return capitalizeWord(candidate);
      }
    }
  }

  // 5. Check if bio contains "FirstName LastName |" or starts with "FirstName |" (e.g. "Tane Rontal | Cosmetic Dentist")
  if (rawBio) {
    const pipeNameMatch = rawBio.match(/(?:^|\.\.\.\s+|\s)([A-Z][a-z]{2,12})(?:\s+[A-Z][a-z]{2,14})?\s*\|\s*[A-Z]/);
    if (pipeNameMatch) {
      const candidate = pipeNameMatch[1];
      if (!NON_NAME_STOPLIST.has(candidate.toLowerCase())) {
        return capitalizeWord(candidate);
      }
    }
  }

  // 6. Try splitting username by _ or . (e.g. "guillaume_moubeche" -> "Guillaume", "shanarra_goode" -> "Shanarra")
  const userTokens = username.split(/[._]+/).filter(Boolean);
  if (userTokens.length >= 1) {
    const firstToken = userTokens[0];
    if (KNOWN_FIRST_NAMES.includes(firstToken)) {
      return capitalizeWord(firstToken);
    }
  }

  // 7. Check if concatenated username starts with a known first name >= 4 chars (e.g. "sarahwinterdental" -> "Sarah")
  for (const name of KNOWN_FIRST_NAMES) {
    if (name.length >= 4 && username.startsWith(name) && username.length > name.length) {
      return capitalizeWord(name);
    }
  }

  // 8. If username itself is a known first name (e.g. "henry")
  if (KNOWN_FIRST_NAMES.includes(username)) {
    return capitalizeWord(username);
  }

  return null;
}

/**
 * Extracts a short, natural niche modifier that fits before "reels" / "content" (e.g. "cosmetic dentistry").
 */
function extractNaturalTopic(lead) {
  const combined = `${lead.username || ''} ${lead.full_name || ''} ${lead.bio || ''} ${lead.recent_posts_json || ''}`.toLowerCase();

  // Specific industry niches first (before generic words like AI)
  const topicMap = [
    { regex: /\bdental\b|\bdentist\b|\bcosmeticdentist\b|\borthodont\b|\bveneers\b|\bddS\b/i, label: 'cosmetic dentistry' },
    { regex: /\bconstruction\b|\bbuilder\b|\bcontractor\b|\brenovation\b|\bremodel\b/, label: 'custom build' },
    { regex: /\barchitect\b|\barchitecture\b|\binterior\b|\bvilla\b/, label: 'architecture & design' },
    { regex: /\breal estate\b|\brealtor\b|\bproperty\b|\bluxury homes\b|\bbroker\b/, label: 'real estate' },
    { regex: /\bdetailing\b|\bceramic coating\b|\bppf\b|\bautodetailing\b/, label: 'auto detailing' },
    { regex: /\bfitness\b|\bgym\b|\bworkout\b|\bphysique\b|\bpersonal trainer\b/, label: 'fitness' },
    { regex: /\bpodcast\b|\bepisode\b|\binterview\b/, label: 'podcast' },
    { regex: /\becommerce\b|\bshopify\b|\bdtc\b/, label: 'e-commerce' },
    { regex: /\bsaas\b|\bindiesaas\b|\bmrr\b|\bbuildinpublic\b|\bdevtools\b/, label: 'SaaS' },
    { regex: /\bai\b|\bartificial intelligence\b|\bautomation\b/, label: 'AI & automation' },
    { regex: /\bmarketing\b|\bagency\b|\blead gen\b|\bseo\b/, label: 'marketing' }
  ];

  for (const item of topicMap) {
    if (item.regex.test(combined)) {
      return item.label;
    }
  }

  return null;
}

function detectEnglish(text) {
  if (!text) return true;
  // Strip Google UI Vietnamese metadata (e.g. "160 lượt thích · 2 tháng trước · người theo dõi")
  const cleaned = text
    .replace(/lượt thích|tháng trước|ngày trước|tuần trước|năm trước|giờ trước|phút trước|người theo dõi|bài viết|trên instagram/gi, '');
  const viRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  return !viRegex.test(cleaned);
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Direct, peer-to-peer conversion copywriting generator (25-38 words, zero AI fluff).
 */
function generateAlgorithmicDraft(lead, settings) {
  const firstName = extractSmartFirstName(lead);
  const topic = extractNaturalTopic(lead);
  const isEnglish = detectEnglish((lead.bio || '') + ' ' + (lead.full_name || ''));

  if (isEnglish) {
    const nameGreeting = firstName ? `Hey ${firstName} —` : `Hey —`;
    const altGreeting = firstName ? `Hi ${firstName},` : `Quick question —`;
    const reelPhrase = topic ? `your recent ${topic} reels` : `your recent reels`;
    const contentPhrase = topic ? `your ${topic} content` : `your recent content`;

    const templates = [
      `${nameGreeting} saw ${reelPhrase}, solid stuff.\n\nAre you guys handling all your short-form editing in-house right now? Happy to cut a quick 30s sample from one of your existing clips (free) so you can compare the pacing.`,

      `${nameGreeting} been checking out ${contentPhrase}.\n\nQuick question: are you open to offloading your reel editing to save time? I'd love to put together 1 free test cut from your existing footage so you can judge the quality yourself.`,

      `${altGreeting} saw ${reelPhrase}.\n\nI help creators & brands turn talking-head clips into high-retention reels. Mind if I send over a quick 30s re-edit of one of your videos so you can see the difference in pacing?`,

      `${nameGreeting} loved ${reelPhrase}.\n\nHad a couple visual hook ideas that could boost watch time on your videos. Open to seeing a quick 30s test edit on one of your existing clips?`
    ];

    return getRandomItem(templates);
  } else {
    const nameGreeting = firstName ? `Chào ${firstName},` : `Chào bạn,`;
    const topicPhrase = topic ? ` về ${topic}` : '';

    const viTemplates = [
      `${nameGreeting} thấy kênh mình đang xây chuỗi Reels${topicPhrase} khá chất lượng.\n\nHiện bên bạn đã có editor riêng chưa hay vẫn tự dựng? Nếu tiện mình xin phép dựng thử 1 clip 30s (miễn phí) từ video sẵn có để bạn xem thử style nhé?`,

      `${nameGreeting} mình có xem qua các video gần đây trên kênh của bạn.\n\nBên mình chuyên dựng Reels/Shorts tối ưu giữ chân người xem (retention). Bạn có mở lòng nếu mình cắt tặng 1 bản demo 30s từ video cũ của bạn để bạn đối chiếu thử không?`
    ];

    return getRandomItem(viTemplates);
  }
}

async function generateGeminiAIDraft(lead, settings) {
  const apiKey = settings ? settings.gemini_api_key : '';
  if (!apiKey || apiKey.trim() === '') {
    return generateAlgorithmicDraft(lead, settings);
  }

  const firstName = extractSmartFirstName(lead);
  const topic = extractNaturalTopic(lead);
  const isEnglish = detectEnglish((lead.bio || '') + ' ' + (lead.full_name || ''));

  const systemInstruction = `
You are an elite B2B conversion copywriter writing an Instagram cold DM for a high-ticket short-form video editor / creative partner.

Prospect Details:
- Handle: @${lead.username}
- Verified First Name: ${firstName || 'NONE (This is a brand/clinic/company account or name is unknown — start with "Hey —" without a name)'}
- Core Topic/Niche: ${topic || 'short-form content'}
- Context Snippet: ${(lead.bio || '').slice(0, 180)}
- Offer: ${settings.outreach_service || 'High-retention short-form video editing (Reels/Shorts)'}

STRICT COPYWRITING RULES:
1. Language: ${isEnglish ? 'Natural, casual US peer-to-peer English' : 'Natural, concise business Vietnamese'}.
2. ULTRA-SHORT: 25 to 38 words MAXIMUM. 2 short paragraphs separated by a blank line.
3. NO FAKE FLATTERY: Never use AI clichés like "stumbled upon", "came across", "super sharp", "top-tier", "dialed in", "hope your week is going great", "no strings attached".
4. NO QUOTED TITLES: Never paste their post caption in quotation marks.
5. DIRECT TO THE POINT:
   - Line 1: Casual greeting + brief nod to their ${topic || 'recent'} reels.
   - Line 2: Ask if they handle short-form editing in-house or are open to seeing a quick 30s free test cut using one of their existing clips.
6. Return ONLY the raw DM text. No quotes, no markdown, no links.
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemInstruction }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 150
        }
      })
    });

    if (!response.ok) {
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
  generateAlgorithmicDraft,
  extractSmartFirstName,
  extractNaturalTopic
};

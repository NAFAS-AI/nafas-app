/* ============================================================
   NAFAS — User Profile API (api/user-profile.js)
   Handles: GET (fetch profile), POST (upsert), PATCH (add correction)
   © 2026 NAFAS FOR ARTIFICIAL INTELLIGENCE — CN-6573712
   ============================================================ */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sqpbusodwdjtlgaxrreg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

const ALLOWED_ORIGINS = [
  'https://nafas-app.com',
  'https://www.nafas-app.com',
  'https://nafas-app-blush.vercel.app'
];

function getCorsOrigin(req) {
  const origin = req.headers?.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (!origin) return ALLOWED_ORIGINS[0];
  return '';
}

async function supaFetch(path, method, body) {
  const opts = {
    method: method || 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json'
    }
  };
  if (method === 'POST') opts.headers['Prefer'] = 'return=representation,resolution=merge-duplicates';
  if (method === 'PATCH') opts.headers['Prefer'] = 'return=representation';
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, opts);
  if (!res.ok) throw new Error('Supabase error: ' + res.status);
  return res.json();
}

module.exports = async (req, res) => {
  // CORS
  const allowedOrigin = getCorsOrigin(req);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPABASE_KEY) return res.status(500).json({ error: 'Service unavailable' });

  try {
    // GET — fetch profile by visitor_id
    if (req.method === 'GET') {
      const vid = req.query?.vid;
      if (!vid) return res.status(400).json({ error: 'Missing vid parameter' });
      const data = await supaFetch(
        'nafas_user_profiles?visitor_id=eq.' + encodeURIComponent(vid) + '&limit=1',
        'GET'
      );
      return res.status(200).json(data.length > 0 ? data[0] : null);
    }

    // POST — upsert profile
    if (req.method === 'POST') {
      const profile = req.body;
      if (!profile?.visitor_id) return res.status(400).json({ error: 'Missing visitor_id' });
      
      // Sanitize
      const safe = {
        visitor_id: String(profile.visitor_id).slice(0, 50),
        display_name: String(profile.display_name || '').slice(0, 100),
        gender: ['male', 'female', 'unknown'].includes(profile.gender) ? profile.gender : 'unknown',
        dialect: ['khaleeji', 'egyptian', 'shami', 'maghrebi', 'unknown'].includes(profile.dialect) ? profile.dialect : 'khaleeji',
        age_group: String(profile.age_group || 'unknown').slice(0, 30),
        corrections: Array.isArray(profile.corrections) ? profile.corrections.slice(-20) : [],
        topics: Array.isArray(profile.topics) ? profile.topics.slice(-10) : [],
        preferences: typeof profile.preferences === 'object' ? profile.preferences : {},
        session_count: Math.max(0, parseInt(profile.session_count) || 0),
        last_mood: String(profile.last_mood || '').slice(0, 50),
        personality_notes: String(profile.personality_notes || '').slice(0, 500),
        updated_at: new Date().toISOString()
      };

      const data = await supaFetch('nafas_user_profiles', 'POST', safe);
      return res.status(200).json(data);
    }

    // PATCH — add a correction
    if (req.method === 'PATCH') {
      const { visitor_id, correction } = req.body || {};
      if (!visitor_id || !correction) return res.status(400).json({ error: 'Missing data' });

      // Fetch existing
      const existing = await supaFetch(
        'nafas_user_profiles?visitor_id=eq.' + encodeURIComponent(visitor_id) + '&limit=1',
        'GET'
      );

      const corrections = existing.length > 0 ? (existing[0].corrections || []) : [];
      // Avoid duplicates
      const isDup = corrections.some(c => c.wrong === correction.wrong && c.right === correction.right);
      if (!isDup) {
        corrections.push({
          wrong: String(correction.wrong).slice(0, 100),
          right: String(correction.right).slice(0, 100),
          date: new Date().toISOString()
        });
      }

      // Keep last 20 corrections
      const trimmed = corrections.slice(-20);

      if (existing.length > 0) {
        await supaFetch(
          'nafas_user_profiles?visitor_id=eq.' + encodeURIComponent(visitor_id),
          'PATCH',
          { corrections: trimmed, updated_at: new Date().toISOString() }
        );
      } else {
        await supaFetch('nafas_user_profiles', 'POST', {
          visitor_id: String(visitor_id).slice(0, 50),
          corrections: trimmed,
          updated_at: new Date().toISOString()
        });
      }

      return res.status(200).json({ ok: true, corrections: trimmed });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('User profile error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
};

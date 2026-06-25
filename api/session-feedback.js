// Nafas — Session Feedback API (Phase 2: Learning System)
// © Munira Ali Al Marri 2026
// Receives mood ratings after sessions and updates learning data

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sqpbusodwdjtlgaxrreg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcGJ1c29kd2RqdGxnYXhycmVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTQ2MDksImV4cCI6MjA5NTE5MDYwOX0.bglpaNzXgU4ufK7fuu5wMcvE6XYepD318C7mO54ML7I';

const DEFAULT_ORIGINS = [
  'https://nafas-app-blush.vercel.app',
  'https://nafas-app.com',
  'https://www.nafas-app.com'
];

async function supabaseFetch(path, method, body) {
  if (!SUPABASE_KEY) return null;
  const opts = {
    method: method || 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation,resolution=merge-duplicates' : 'return=representation'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  if (DEFAULT_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { visitor_id, mood_rating, topics } = req.body || {};

    if (!visitor_id || !mood_rating || mood_rating < 1 || mood_rating > 5) {
      return res.status(400).json({ error: 'visitor_id and mood_rating (1-5) required' });
    }

    // 1. Save session feedback
    await supabaseFetch('nafas_session_feedback', 'POST', {
      visitor_id,
      mood_rating,
      topics: topics || []
    });

    // 2. Update user profile with learning data
    const profile = await supabaseFetch(
      'nafas_user_profiles?visitor_id=eq.' + encodeURIComponent(visitor_id) + '&limit=1',
      'GET'
    );

    if (Array.isArray(profile) && profile.length > 0) {
      const user = profile[0];
      const totalSessions = (user.total_sessions || 0) + 1;
      const oldAvg = user.avg_rating || 0;
      const newAvg = ((oldAvg * (totalSessions - 1)) + mood_rating) / totalSessions;

      // Get this user's recent techniques (from last gemini response stored client-side)
      // Update profile
      await supabaseFetch('nafas_user_profiles', 'POST', {
        visitor_id,
        total_sessions: totalSessions,
        avg_rating: Math.round(newAvg * 100) / 100,
        updated_at: new Date().toISOString(),
        // Keep existing data
        display_name: user.display_name || '',
        gender: user.gender || 'unknown',
        dialect: user.dialect || 'khaleeji',
        corrections: user.corrections || [],
        topics: user.topics || [],
        preferences: user.preferences || {},
        personality_notes: user.personality_notes || '',
        effective_techniques: user.effective_techniques || [],
        session_count: user.session_count || 0
      });

      // 3. Phase 3: Update collective patterns
      // If rating >= 4, boost the techniques associated with this topic
      if (mood_rating >= 4 && Array.isArray(topics) && topics.length > 0) {
        for (const topic of topics.slice(0, 3)) {
          // Upsert pattern - increment success count
          const existing = await supabaseFetch(
            'nafas_technique_patterns?topic=eq.' + encodeURIComponent(topic) + '&gender=eq.' + encodeURIComponent(user.gender || 'unknown') + '&technique=eq.empathy&limit=1',
            'GET'
          );
          if (Array.isArray(existing) && existing.length > 0) {
            const p = existing[0];
            await supabaseFetch('nafas_technique_patterns', 'POST', {
              id: p.id,
              technique: p.technique,
              topic: p.topic,
              gender: p.gender,
              success_count: p.success_count + 1,
              total_count: p.total_count + 1,
              avg_rating: ((p.avg_rating * p.total_count) + mood_rating) / (p.total_count + 1),
              updated_at: new Date().toISOString()
            });
          } else {
            await supabaseFetch('nafas_technique_patterns', 'POST', {
              technique: 'empathy',
              topic: topic,
              gender: user.gender || 'unknown',
              success_count: mood_rating >= 4 ? 1 : 0,
              total_count: 1,
              avg_rating: mood_rating,
              updated_at: new Date().toISOString()
            });
          }
        }
      }
    }

    return res.status(200).json({ ok: true, message: 'Feedback saved — learning updated' });
  } catch (err) {
    console.error('Feedback error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
 
const app = express();
const PORT = process.env.PORT || 3000;
 
app.use(cors());
app.use(express.json());

// Landing page at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Main app at /app
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Static files (must come AFTER the explicit routes above)
app.use(express.static(path.join(__dirname, 'public')));
 
// ── Validate env vars loudly at startup ─────────────────────────────────────
const rawUrl = (process.env.SUPABASE_URL || '').trim();
const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
 
console.log('\n── Supabase config check ──────────────────────');
console.log('SUPABASE_URL:', rawUrl ? `"${rawUrl}"` : '❌ MISSING');
console.log('Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : (process.env.SUPABASE_ANON_KEY ? 'ANON (fallback)' : '❌ MISSING'));
console.log('Key length:', rawKey.length, rawKey.length > 0 ? `(starts "${rawKey.slice(0,15)}...")` : '');
if (!rawUrl.startsWith('https://') || !rawUrl.includes('.supabase.co')) {
  console.log('⚠️  SUPABASE_URL looks malformed! Expected format: https://xxxxx.supabase.co');
}
console.log('────────────────────────────────────────────────\n');
 
// Supabase admin client (service role for server-side ops, bypasses RLS)
const supabase = createClient(rawUrl, rawKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});
 
// Quick connectivity test at boot
(async () => {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) console.log('⚠️  Supabase test query failed (full error):', JSON.stringify(error, null, 2));
    else console.log('✓ Supabase connection OK\n');
  } catch (e) {
    console.log('⚠️  Supabase connection failed at boot:', e.message, '\n');
  }
})();
 
// ── Hardcoded coach voices ────────────────────────────────────────────────────
const assignedVoices = {
  Blaze: '6OzrBCQf8cjERkYgzSg8',  // Young Jamal
  Echo:  'Qggl4b0xRMiqOwhPtVWT',  // Ciara
  Sage:  'gx4234VtGf2pDCbrbUA8',  // Eleanor
  Nova:  'BZgkqPqms7Kj9ulSkVzn',  // Eve
  Rex:   'F2dJXHYSktFOVtCMu2w7',  // Anton
  Luna:  'pjcYQlDFKMbcOUp6F5GD',  // Brittney
};
console.log('🎙️ Voices assigned:', assignedVoices);
 
// ── Auth routes ───────────────────────────────────────────────────────────────
 
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});
 
app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});
 
app.post('/api/auth/signout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) await supabase.auth.admin?.signOut(token);
  res.json({ success: true });
});
 
// ── User data routes ──────────────────────────────────────────────────────────
 
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  req.token = token;
  next();
}
 
app.get('/api/user/stats', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', req.user.id)
    .single();
  if (error && error.code !== 'PGRST116') return res.status(400).json({ error: error.message });
  res.json({ stats: data || null });
});
 
app.post('/api/user/stats', requireAuth, async (req, res) => {
  const { stats } = req.body;
  const payload = { user_id: req.user.id, ...stats, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from('user_stats')
    .upsert(payload, { onConflict: 'user_id' });
  if (error) {
    console.error('Stats save error:', error);
    return res.status(400).json({ error: error.message });
  }
  res.json({ success: true });
});
 
app.post('/api/user/session', requireAuth, async (req, res) => {
  const { session } = req.body;
  const { error } = await supabase
    .from('sessions')
    .insert({ user_id: req.user.id, ...session });
  if (error) {
    console.error('Session save error:', error);
    return res.status(400).json({ error: error.message });
  }
  res.json({ success: true });
});
 
app.get('/api/user/sessions', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ sessions: data });
});
 
app.post('/api/user/profile', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: req.user.id, email: req.user.email });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});
 
// ── ElevenLabs voices ─────────────────────────────────────────────────────────
app.get('/api/voices', (req, res) => {
  res.json({ voices: assignedVoices });
});
 
// ── Claude chat ───────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, system } = req.body;
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'No Anthropic key' });
  try {
    const body = { model: 'claude-sonnet-4-5', max_tokens: 1000, messages };
    if (system) body.system = system;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) { const err = await response.text(); return res.status(response.status).json({ error: err }); }
    const data = await response.json();
    res.json({ text: data.content.map(i => i.text || '').join('') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
// Uses eleven_flash_v2_5 for minimum latency (~75ms vs turbo's ~400ms+)
// Streams audio directly — client receives and plays as it arrives
app.post('/api/speak', async (req, res) => {
  const { text, coach } = req.body;
  if (!process.env.ELEVENLABS_API_KEY) return res.status(500).json({ error: 'No ElevenLabs key' });
  if (!text?.trim()) return res.status(400).json({ error: 'No text' });
 
  const voiceId = assignedVoices[coach] || assignedVoices.Blaze;
 
  // Clean markdown formatting before sending to TTS
  const clean = text
    .replace(/\*\*/g,'').replace(/\*/g,'').replace(/_/g,'')
    .replace(/#{1,6}\s/g,'').replace(/`/g,'')
    .replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
 
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: clean,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.0,          // style=0 reduces latency significantly
          use_speaker_boost: false  // speaker boost adds latency, disable for speed
        },
        optimize_streaming_latency: 4  // max latency optimization (0-4, 4=fastest)
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }
    // Stream directly to client — audio starts playing as soon as first chunk arrives
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if behind proxy
    response.body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
// Catch-all falls back to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
 
app.listen(PORT, () => {
  console.log(`\n🎤 Conver running at http://localhost:${PORT}\n`);
  console.log('✓ ElevenLabs voices loaded\n');
});
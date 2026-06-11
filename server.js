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
app.use(express.static(path.join(__dirname, 'public')));

// Supabase admin client (service role for server-side ops)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Cache of assigned coach voices
let assignedVoices = null;

async function fetchAndAssignVoices() {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
  });
  if (!res.ok) throw new Error('Could not fetch voices');
  const data = await res.json();
  const voices = data.voices || [];
  const male = voices.filter(v => v.labels?.gender === 'male');
  const female = voices.filter(v => v.labels?.gender === 'female');
  const all = voices;
  const used = new Set();
  function pick(pool) {
    const available = pool.filter(v => !used.has(v.voice_id));
    const v = available[0] || all.find(v => !used.has(v.voice_id)) || all[0];
    used.add(v.voice_id);
    return v.voice_id;
  }
  assignedVoices = {
    Blaze: pick(male), Echo: pick(female), Sage: pick(male),
    Nova: pick(female), Rex: pick(male), Luna: pick(female),
  };
  console.log('🎙️ Voices assigned:', assignedVoices);
  return assignedVoices;
}

// ── Auth routes ───────────────────────────────────────────────────────────────

// Sign up
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// Sign in
app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// Sign out
app.post('/api/auth/signout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) await supabase.auth.admin?.signOut(token);
  res.json({ success: true });
});

// Get OAuth URL (Google, GitHub, etc.)
app.post('/api/auth/oauth', async (req, res) => {
  const { provider } = req.body;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `https://conver1-production.up.railway.app/auth/callback`, skipBrowserRedirect: false }
  });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ url: data.url });
});

// ── User data routes ──────────────────────────────────────────────────────────

// Middleware to verify JWT
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  req.token = token;
  next();
}

// Get user stats
app.get('/api/user/stats', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', req.user.id)
    .single();
  if (error && error.code !== 'PGRST116') return res.status(400).json({ error: error.message });
  res.json({ stats: data || null });
});

// Save user stats
app.post('/api/user/stats', requireAuth, async (req, res) => {
  const { stats } = req.body;
  const { error } = await supabase
    .from('user_stats')
    .upsert({ user_id: req.user.id, ...stats, updated_at: new Date().toISOString() });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// Save session
app.post('/api/user/session', requireAuth, async (req, res) => {
  const { session } = req.body;
  const { error } = await supabase
    .from('sessions')
    .insert({ user_id: req.user.id, ...session });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// Get sessions
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

// Ensure profile exists
app.post('/api/user/profile', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: req.user.id, email: req.user.email });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// ── ElevenLabs voices ─────────────────────────────────────────────────────────
app.get('/api/voices', async (req, res) => {
  if (!process.env.ELEVENLABS_API_KEY) return res.status(500).json({ error: 'No ElevenLabs key' });
  try {
    if (!assignedVoices) await fetchAndAssignVoices();
    res.json({ voices: assignedVoices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
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
app.post('/api/speak', async (req, res) => {
  const { text, coach } = req.body;
  if (!process.env.ELEVENLABS_API_KEY) return res.status(500).json({ error: 'No ElevenLabs key' });
  if (!text?.trim()) return res.status(400).json({ error: 'No text' });
  if (!assignedVoices) {
    try { await fetchAndAssignVoices(); }
    catch(e) { return res.status(500).json({ error: e.message }); }
  }
  const voiceId = assignedVoices[coach] || Object.values(assignedVoices)[0];
  const clean = text.replace(/\*\*/g,'').replace(/\*/g,'').replace(/_/g,'').replace(/#{1,6}\s/g,'').replace(/`/g,'').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY },
      body: JSON.stringify({ text: clean, model_id: 'eleven_turbo_v2', voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.35, use_speaker_boost: true } }),
    });
    if (!response.ok) { const err = await response.text(); return res.status(response.status).json({ error: err }); }
    res.setHeader('Content-Type', 'audio/mpeg');
    response.body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OAuth callback page
app.get('/auth/callback', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Signing in...</title></head><body>
    <script>
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#',''));
      const token = params.get('access_token');
      if (token) {
        localStorage.setItem('conver_token', token);
        localStorage.setItem('conver_refresh', params.get('refresh_token') || '');
      }
      window.location.href = '/';
    </script>
  </body></html>`);
});

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`\n🎤 Conver running at http://localhost:${PORT}\n`);
  if (process.env.ELEVENLABS_API_KEY) {
    try { await fetchAndAssignVoices(); console.log('✓ ElevenLabs voices loaded\n'); }
    catch(e) { console.log('⚠️ Could not load voices:', e.message); }
  }
});

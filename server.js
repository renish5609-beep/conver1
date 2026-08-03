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
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ── Validate env vars loudly at startup ──────────────────────────────────────
const rawUrl = (process.env.SUPABASE_URL || '').trim();
const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

console.log('\n── Supabase config check ──────────────────────');
console.log('SUPABASE_URL:', rawUrl ? `"${rawUrl}"` : 'MISSING');
console.log('Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : (process.env.SUPABASE_ANON_KEY ? 'ANON (fallback)' : 'MISSING'));
console.log('Key length:', rawKey.length, rawKey.length > 0 ? `(starts "${rawKey.slice(0,15)}...")` : '');
if (!rawUrl.startsWith('https://') || !rawUrl.includes('.supabase.co')) {
  console.log('WARNING: SUPABASE_URL looks malformed! Expected format: https://xxxxx.supabase.co');
}
console.log('────────────────────────────────────────────────\n');

// Supabase admin client — used ONLY for .from(...) data operations (profiles,
// user_stats, sessions). Never call .auth.signUp/.signInWithPassword/.getUser
// on this instance: those methods mutate the GoTrue client's internal
// "current session" even with persistSession:false (that option only controls
// whether the session is written to disk/localStorage, not whether the
// in-memory client holds onto it). Once mutated, every subsequent .from()
// call on this SAME shared instance silently executes as that signed-in
// user's own "authenticated" role instead of service_role — RLS then blocks
// operations the service role should have bypassed, for every request
// sharing this client until the next sign-in overwrites it again. Confirmed
// directly: an upsert that succeeds before any signInWithPassword() call on
// this client starts failing with "new row violates row-level security
// policy" immediately after one, with nothing else changed.
const supabase = createClient(rawUrl, rawKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

// Fresh, throwaway client for any operation that touches user identity
// (sign up, sign in, token verification, sign out) — isolates their session
// mutation from the admin client above so authenticating one user can never
// downgrade or cross-contaminate every other request's database access.
function freshAuthClient() {
  return createClient(rawUrl, rawKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Quick connectivity test at boot
(async () => {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) console.log('WARNING: Supabase test query failed:', JSON.stringify(error, null, 2));
    else console.log('Supabase connection OK\n');
  } catch (e) {
    console.log('WARNING: Supabase connection failed at boot:', e.message, '\n');
  }
})();

// ── Coach voices ─────────────────────────────────────────────────────────────
const assignedVoices = {
  Blaze: '6OzrBCQf8cjERkYgzSg8',  // Young Jamal
  Echo:  'Qggl4b0xRMiqOwhPtVWT',  // Ciara
  Sage:  'gx4234VtGf2pDCbrbUA8',  // Eleanor
  Nova:  'BZgkqPqms7Kj9ulSkVzn',  // Eve
  Rex:   'F2dJXHYSktFOVtCMu2w7',  // Anton
  Luna:  'pjcYQlDFKMbcOUp6F5GD',  // Brittney
};

// ── Cold Open scenario voices — split by confirmed gender ──────────────────
const coldOpenVoicesFemale = [
  '4O1sYUnmtThcBoSBrri7', // Female 1
  '6fZce9LFNG3iEITDfqZZ', // Female 2
  'CICpbs1ZGqlhQNbQmCUP', // Female 3
  'tIb1FHpzlwSiTGg6JxF0', // Female 4
  'hod33eJyEU4TLqiYFttr', // Female 5
  '8DzKSPdgEQPaK5vKG0Rs', // Female 6 (new)
  'yj30vwTGJxSHezdAGsv9', // Female 7 (new)
];

const coldOpenVoicesMale = [
  '1t1EeRixsJrKbiF1zwM6', // Male 1
  'Gubgw9l4dtIoQA9YZHgx', // Male 2
  'hIreuBly94QFepU63yel', // Male 3
  'EitqXD7jgIy0K5Z1zGGp', // Male 4
  'Ib97zM6uFBc71OWgj75I', // Male 5
  'wAGzRVkxKEs8La0lmdrE', // Male 6 (new)
];

// Combined pool for backward compat
const coldOpenVoices = [...coldOpenVoicesFemale, ...coldOpenVoicesMale];

function getRandomColdOpenVoice() {
  return coldOpenVoices[Math.floor(Math.random() * coldOpenVoices.length)];
}

function getColdOpenVoiceForGender(gender) {
  const pool = gender === 'male' ? coldOpenVoicesMale : coldOpenVoicesFemale;
  return pool[Math.floor(Math.random() * pool.length)];
}

console.log('Coach voices assigned:', assignedVoices);
console.log('Cold Open voice pool:', coldOpenVoices.length, 'voices\n');

// ── Text cleaning for TTS ─────────────────────────────────────────────────────
// Strips markdown, stage directions, and action text so TTS sounds natural
function cleanForTTS(text) {
  return text
    // Remove ALL asterisk-wrapped content *anything* — stage directions, actions, emphasis
    .replace(/\*[^*]*\*/g, '')
    // Remove ALL bracket-wrapped content [anything]
    .replace(/\[[^\]]*\]/g, '')
    // Remove ALL parenthetical actions (anything that looks like stage direction)
    .replace(/\([^)]{1,60}\)/g, '')
    // Remove markdown bold/italic remnants
    .replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '')
    .replace(/#{1,6}\s/g, '').replace(/`/g, '')
    // Remove written-out non-speech sounds
    .replace(/\b(ahem|hmm+|mhm|ugh|uh+|um+|er+|heh+|haha|hehe|lol|tsk|pfft|sigh|gasp)\b/gi, '')
    // Remove leftover punctuation from removed actions
    .replace(/\s*,\s*,/g, ',').replace(/\s*\.\s*\./g, '.') 
    // Clean up extra whitespace
    .replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await freshAuthClient().auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await freshAuthClient().auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

app.post('/api/auth/signout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) await freshAuthClient().auth.admin?.signOut(token);
  res.json({ success: true });
});

// ── User data routes ──────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const { data: { user }, error } = await freshAuthClient().auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  req.token = token;
  next();
}

app.get('/api/user/stats', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('user_stats').select('*').eq('user_id', req.user.id).single();
  if (error && error.code !== 'PGRST116') return res.status(400).json({ error: error.message });
  res.json({ stats: data || null });
});

app.post('/api/user/stats', requireAuth, async (req, res) => {
  const { stats } = req.body;
  const payload = { user_id: req.user.id, ...stats, updated_at: new Date().toISOString() };
  let { error } = await supabase.from('user_stats').upsert(payload, { onConflict: 'user_id' });
  // user_stats.user_id has a foreign key against profiles — if the one
  // POST /api/user/profile call at sign-in never fired or failed (a slow
  // network, a dropped request, anything), EVERY subsequent stats save
  // (streak, XP, sessions, everything) would fail on this FK constraint
  // forever, with nothing surfacing it since the client didn't check
  // response status either. Self-heal by creating the profile row here too
  // and retrying once, instead of leaving the account permanently stuck.
  if (error && error.code === '23503') {
    console.warn('Stats save hit missing profile row for user', req.user.id, '— creating it and retrying');
    const { error: profileErr } = await supabase.from('profiles').upsert({ id: req.user.id, email: req.user.email }, { onConflict: 'id' });
    if (!profileErr) {
      ({ error } = await supabase.from('user_stats').upsert(payload, { onConflict: 'user_id' }));
    }
  }
  if (error) { console.error('Stats save error:', error); return res.status(400).json({ error: error.message }); }
  res.json({ success: true });
});

app.post('/api/user/session', requireAuth, async (req, res) => {
  const { session } = req.body;
  const { error } = await supabase.from('sessions').insert({ user_id: req.user.id, ...session });
  if (error) { console.error('Session save error:', error); return res.status(400).json({ error: error.message }); }
  res.json({ success: true });
});

app.get('/api/user/sessions', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('sessions').select('*').eq('user_id', req.user.id)
    .order('created_at', { ascending: false }).limit(50);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ sessions: data });
});

app.post('/api/user/profile', requireAuth, async (req, res) => {
  const { error } = await supabase.from('profiles').upsert({ id: req.user.id, email: req.user.email });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// ── Voices API ────────────────────────────────────────────────────────────────
app.get('/api/voices', (req, res) => {
  res.json({ voices: assignedVoices, coldOpenVoices });
});

// Get a Cold Open voice for the requested gender
app.get('/api/coldopen-voice', (req, res) => {
  const gender = req.query.gender || 'female';
  res.json({ voiceId: getColdOpenVoiceForGender(gender), gender });
});

// ── Claude chat ───────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, system, maxTokens } = req.body;
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'No Anthropic key' });
  try {
    // Capped client override — callers with larger structured JSON output
    // (e.g. Mock Interview's 7-question debrief) can ask for more than the
    // 1000-token default without every other caller's request changing.
    const tokens = Math.min(Math.max(parseInt(maxTokens) || 1000, 1), 4000);
    const body = { model: 'claude-sonnet-4-5', max_tokens: tokens, messages };
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

// ── Mock Interview: resume text extraction ─────────────────────────────────
const multer = require('multer');
const resumeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.post('/api/extract-resume', resumeUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'No Anthropic key' });
  try {
    let text = '';
    if (req.file.mimetype === 'text/plain') {
      text = req.file.buffer.toString('utf-8');
    } else if (req.file.mimetype === 'application/pdf') {
      // Claude reads the PDF directly via its document content-block support
      const base64 = req.file.buffer.toString('base64');
      const result = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: 'Extract all text from this resume. Return only the text content, no commentary.' }
            ]
          }]
        })
      });
      if (!result.ok) { const err = await result.text(); return res.status(result.status).json({ error: err }); }
      const data = await result.json();
      text = (data.content || []).map(i => i.text || '').join('');
    } else {
      // DOCX and other binary formats — no dedicated parser here, so this
      // just strips non-printable bytes rather than pretending to fully
      // parse the format. Good enough as a fallback; the UI already tells
      // the user to paste resume text directly if extraction looks off.
      text = req.file.buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
    }
    res.json({ text: text.slice(0, 5000) });
  } catch (err) {
    console.error('Resume extraction error:', err);
    res.status(500).json({ error: 'Could not extract text' });
  }
});

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
app.post('/api/speak', async (req, res) => {
  const { text, coach, voiceId: overrideVoiceId } = req.body;
  if (!process.env.ELEVENLABS_API_KEY) return res.status(500).json({ error: 'No ElevenLabs key' });
  if (!text?.trim()) return res.status(400).json({ error: 'No text' });

  // Use override voiceId (for Cold Open) or fall back to coach voice
  const voiceId = overrideVoiceId || assignedVoices[coach] || assignedVoices.Blaze;

  // Clean text — strips markdown AND stage directions like *coughs* [laughs] etc.
  const clean = cleanForTTS(text);

  if (!clean) return res.status(400).json({ error: 'No speakable text after cleaning' });

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
          style: 0.0,
          use_speaker_boost: false
        },
        optimize_streaming_latency: 4
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');
    response.body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ElevenLabs STT token ──────────────────────────────────────────────────────
app.post('/api/stt-token', requireAuth, async (req, res) => {
  if (!process.env.ELEVENLABS_API_KEY) return res.status(500).json({ error: 'No ElevenLabs API key' });
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/convai/tokens', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) { const err = await response.text(); return res.status(response.status).json({ error: err }); }
    const data = await response.json();
    res.json({ token: data.token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deepgram temporary token — keeps the permanent API key off the client.
// Unlike the ElevenLabs token flow above, deliberately does NOT fall back to
// sending the raw DEEPGRAM_API_KEY if temp-key creation fails — that key
// grants full account access, and shipping it to the browser would let
// anyone who opens dev tools steal it and run up charges. On any failure
// here the client just falls back to the next STT engine instead.
app.get('/api/deepgram-token', requireAuth, async (req, res) => {
  if (!process.env.DEEPGRAM_API_KEY) {
    return res.status(404).json({ error: 'Deepgram not configured' });
  }
  try {
    const projectsRes = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { 'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}` }
    });
    if (!projectsRes.ok) throw new Error('Failed to list Deepgram projects');
    const projectsData = await projectsRes.json();
    const projectId = projectsData.projects?.[0]?.project_id;
    if (!projectId) throw new Error('No Deepgram project found');

    const tokenRes = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        comment: 'Conver temp key',
        scopes: ['usage:write'],
        time_to_live_in_seconds: 3600
      })
    });
    if (!tokenRes.ok) throw new Error('Failed to create Deepgram temp key');
    const tokenData = await tokenRes.json();
    if (!tokenData.key?.key) throw new Error('Deepgram temp key response missing key');
    res.json({ key: tokenData.key.key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Contact Form ─────────────────────────────────────────────
const { Resend } = require('resend');

app.post('/api/contact', async (req, res) => {
  const { name, email, topic, message } = req.body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message too long — max 2000 characters.' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('Contact form error: RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Email not configured.' });
  }

  try {
    // Constructed inside the try block — the Resend SDK throws synchronously
    // on a missing/malformed key, and since this is an async handler that
    // throw becomes an unhandled promise rejection Express never sees,
    // which crashes the whole Node process (not just this request). The
    // env-var guard above should already catch the "missing key" case, but
    // this keeps any other constructor failure from taking the site down too.
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Conver <onboarding@resend.dev>',
      to: 'appconver@gmail.com',
      replyTo: email,
      subject: `[Conver] ${topic || 'General'} — from ${name}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px">
          <h2 style="color:#7c6fff">New Conver Contact Form</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Topic:</strong> ${topic || 'General'}</p>
          <hr/>
          <p><strong>Message:</strong></p>
          <div style="background:#f5f5f5;padding:16px;border-radius:8px;white-space:pre-wrap">${message}</div>
        </div>
      `
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// ── Routing ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\nConver running at http://localhost:${PORT}\n`);
  console.log('ElevenLabs voices loaded\n');
});
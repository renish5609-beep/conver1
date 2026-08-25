require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// ── ElevenLabs Speech Engine (Voice Session / Cold Open / Debate) ──────────────
// Bridges ElevenLabs' STT+TTS to our own Claude call — see the engine.attach()
// block near the bottom of this file. anthropic here is a real SDK client
// (unlike /api/chat below, which is a raw-fetch proxy) because
// session.sendResponse() needs a real streaming async-iterable to auto-parse.
const el = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// conversationId -> { mode, systemPrompt, maxRounds }. Keyed by the REAL
// conversationId that getWebrtcToken() already returns up front (see the
// /api/speech-engine-token route) — not a guessed/pending key, so there's no
// window where onInit can't find its own session's metadata.
const sessionMeta = new Map();

// One Speech Engine resource per voice, not one shared engine — confirmed
// directly against the live API (not just the SDK's types) that Speech
// Engine's client-override policy only supports overriding firstMessage,
// nothing under tts/voiceId. There is no way to pick a different voice
// per-conversation on a single engine, so coach/character voice variety
// requires a separate fixed-voice engine per voice instead. Each key here
// is also the token endpoint's voiceKey and the path segment engine.attach()
// listens on below.
// Cold Open originally had a 13-voice pool (7 "female" + 6 "male") for
// real per-scenario variety, picked randomly client-side. First pass at
// this migration collapsed that down to just 2 fixed voices (one per
// gender) — every character of the same gender sounded identical, losing
// the variety the old pipeline had. Fixed by provisioning one engine per
// individual voice instead of per gender, same as coaches.
//
// Also: one of the original pool's "female" entries (tIb1FHpzlwSiTGg6JxF0,
// "Belle B - Conversational Chatbot Voice") is actually labeled male by
// ElevenLabs' own voice metadata — checked every voice ID directly via
// el.voices.get() rather than trust the old pool's grouping, and moved it
// to the male list (CM7) here.
const SPEECH_ENGINES = {
  Blaze: process.env.SPEECH_ENGINE_ID_BLAZE || process.env.SPEECH_ENGINE_ID,
  Echo: process.env.SPEECH_ENGINE_ID_ECHO,
  Sage: process.env.SPEECH_ENGINE_ID_SAGE,
  Nova: process.env.SPEECH_ENGINE_ID_NOVA,
  Rex: process.env.SPEECH_ENGINE_ID_REX,
  Luna: process.env.SPEECH_ENGINE_ID_LUNA,
  coldopen_cf1: process.env.SPEECH_ENGINE_ID_CF1,
  coldopen_cf2: process.env.SPEECH_ENGINE_ID_CF2,
  coldopen_cf3: process.env.SPEECH_ENGINE_ID_CF3,
  coldopen_cf4: process.env.SPEECH_ENGINE_ID_CF4,
  coldopen_cf5: process.env.SPEECH_ENGINE_ID_CF5,
  coldopen_cf6: process.env.SPEECH_ENGINE_ID_CF6,
  coldopen_cm1: process.env.SPEECH_ENGINE_ID_CM1,
  coldopen_cm2: process.env.SPEECH_ENGINE_ID_CM2,
  coldopen_cm3: process.env.SPEECH_ENGINE_ID_CM3,
  coldopen_cm4: process.env.SPEECH_ENGINE_ID_CM4,
  coldopen_cm5: process.env.SPEECH_ENGINE_ID_CM5,
  coldopen_cm6: process.env.SPEECH_ENGINE_ID_CM6,
  coldopen_cm7: process.env.SPEECH_ENGINE_ID_CM7,
};

// Same regex-based tone heuristic already used client-side for Warmup/Practice
// Lab (kept there — out of scope for this migration). Ported here because the
// Speech Engine's onTranscript handler runs server-side now, where the
// equivalent per-turn tone-aware system prompt needs to be built.
function detectTone(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b(haha|lol|hehe|lmao|funny|laugh|hilarious|cracking up)\b/.test(t)) return 'amused and laughing';
  if (/\b(frustrat|annoyed|pissed|angry|damn|ugh|argh|ridiculous|stupid|hate)\b/.test(t)) return 'frustrated';
  if (/\b(nervous|anxious|scared|worried|not sure|i think|maybe|kind of|sort of|i guess|honestly)\b/.test(t) || (t.match(/\b(um|uh|er)\b/g) || []).length >= 2) return 'nervous or uncertain';
  if (/\b(definitely|absolutely|clearly|i know|for sure|certain|confident|strong|exactly)\b/.test(t)) return 'confident';
  if (/\b(excited|amazing|incredible|awesome|love it|can't wait|pumped|thrilled)\b/.test(t)) return 'excited';
  if (/\b(tired|exhausted|drained|burned out|slow|struggling|hard time)\b/.test(t)) return 'tired or low energy';
  if (/\b(i think|i believe|in my opinion|from my perspective|reflecting|considering|actually)\b/.test(t)) return 'thoughtful and reflective';
  return null;
}

// Appends the same per-turn dynamic context the old client-side prompts used
// to compute fresh each turn (tone, and for Debate, round number/"final
// round" wording) onto the static base prompt the client sent once at
// session start. Recomputed from the transcript Speech Engine hands us each
// turn, so this stays accurate without the client needing to resend anything.
function augmentSystemPrompt(meta, transcript) {
  const userTurns = transcript.filter(m => m.role === 'user');
  const lastUserText = userTurns.length ? userTurns[userTurns.length - 1].content : '';
  const tone = detectTone(lastUserText);
  let extra = tone ? ` The person sounds ${tone}.` : '';
  if (meta.mode === 'debate' && meta.maxRounds) {
    const round = userTurns.length;
    extra += round >= meta.maxRounds
      ? ' This is the final round — give your strongest closing argument.'
      : ` Round ${round} of ${meta.maxRounds}. Push back hard on their point with a direct counter-argument.`;
  }
  return meta.systemPrompt + extra;
}

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
// This pool (and /api/coldopen-voice below) is no longer called by the
// live app — Cold Open moved to the Speech Engine pipeline, which picks its
// voice via pickColdOpenVoiceKey() in index.html from its own equivalent
// pool. Left here rather than deleted in case anything still references it,
// with the same gender fix applied for consistency: tIb1FHpzlwSiTGg6JxF0
// ("Belle B - Conversational Chatbot Voice") was filed here as female but
// is labeled male by ElevenLabs' own voice metadata (checked directly via
// el.voices.get(), not assumed) — moved to the male list.
const coldOpenVoicesFemale = [
  '4O1sYUnmtThcBoSBrri7', // Female 1
  '6fZce9LFNG3iEITDfqZZ', // Female 2
  'CICpbs1ZGqlhQNbQmCUP', // Female 3
  'hod33eJyEU4TLqiYFttr', // Female 4
  '8DzKSPdgEQPaK5vKG0Rs', // Female 5
  'yj30vwTGJxSHezdAGsv9', // Female 6
];

const coldOpenVoicesMale = [
  '1t1EeRixsJrKbiF1zwM6', // Male 1
  'Gubgw9l4dtIoQA9YZHgx', // Male 2
  'hIreuBly94QFepU63yel', // Male 3
  'EitqXD7jgIy0K5Z1zGGp', // Male 4
  'Ib97zM6uFBc71OWgj75I', // Male 5
  'wAGzRVkxKEs8La0lmdrE', // Male 6 (new)
  'tIb1FHpzlwSiTGg6JxF0', // Male 7 — reclassified from the female list above
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
  // total_sessions is a counter incremented alongside each session save —
  // if that increment ever silently failed (a dropped request, an old bug)
  // while the session row itself still saved fine, the counter permanently
  // drifts BEHIND the real number of completed sessions with no way to
  // self-correct. The actual row count in `sessions` is ground truth and
  // can only ever be >= what really happened, so use it as a floor.
  if (data) {
    const { count } = await supabase
      .from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
    if (typeof count === 'number' && count > (data.total_sessions || 0)) {
      data.total_sessions = count;
      supabase.from('user_stats').update({ total_sessions: count }).eq('user_id', req.user.id).then(() => {}, () => {});
    }
  }
  res.json({ stats: data || null });
});

app.post('/api/user/stats', requireAuth, async (req, res) => {
  const { stats, allowDecrease } = req.body;
  const payload = { user_id: req.user.id, ...stats, updated_at: new Date().toISOString() };
  // A stale browser tab (old cached JS, or just a tab that's been open since
  // before a more recent session elsewhere) holds a lower total_sessions/xp
  // in memory. Since this endpoint blindly upserted whatever the client
  // sent, ANY save from that stale tab — even something unrelated like
  // toggling a setting — silently dragged a correct, higher count back down.
  // Guard against that by never letting a save regress these two fields,
  // unless the request explicitly opts out (Clear History / Reset XP &
  // Level in Settings are the only legitimate reasons to go down).
  if (!allowDecrease && (payload.total_sessions !== undefined || payload.xp !== undefined || payload.streak !== undefined)) {
    const { data: existing } = await supabase
      .from('user_stats').select('total_sessions, xp, streak, settings').eq('user_id', req.user.id).maybeSingle();
    if (existing) {
      if (payload.total_sessions !== undefined) {
        payload.total_sessions = Math.max(payload.total_sessions || 0, existing.total_sessions || 0);
      }
      if (payload.xp !== undefined) {
        payload.xp = Math.max(payload.xp || 0, existing.xp || 0);
      }
      // streak needed the same guard as the two above — saveUserData() fires
      // unawaited from many places in a session (session-end, updateStreak,
      // even unrelated settings toggles), so multiple saves can be in flight
      // at once. Whichever lands last on the server used to win outright,
      // so a stale save still holding yesterday's lower streak could land
      // after a fresh increment and silently drag it back down.
      // Streak legitimately needs to go DOWN too though (missing a day
      // resets it to 0/1) — that's not staleness, it's real. Tell the two
      // apart using lastSessionDate: if this save's "last practiced" date
      // matches what's already stored, nothing about the streak should have
      // changed since that save, so never let it regress. If the date is
      // different, this is a genuine new-day update (increment or reset)
      // and the client's value is trusted as-is.
      if (payload.streak !== undefined) {
        const incomingDate = payload.settings?.lastSessionDate;
        const existingDate = existing.settings?.lastSessionDate;
        if (incomingDate && existingDate && incomingDate === existingDate) {
          payload.streak = Math.max(payload.streak || 0, existing.streak || 0);
        }
      }
    }
  }
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
    .order('created_at', { ascending: false }).limit(500); // was 50 — History display cap only; real count always comes from user_stats.total_sessions
  if (error) return res.status(400).json({ error: error.message });
  res.json({ sessions: data });
});

app.post('/api/user/profile', requireAuth, async (req, res) => {
  const { error } = await supabase.from('profiles').upsert({ id: req.user.id, email: req.user.email });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// ── Guest visit tracking ─────────────────────────────────────────────────────
// No auth required — this only ever increments a single counter row, never
// reads or writes anything tied to a person. Requires the app_stats table
// (key text primary key, value int8 default 0) to exist in Supabase with a
// guest_visits row seeded first — see setup notes.
app.post('/api/guest-visit', async (req, res) => {
  try {
    const { error: rpcError } = await supabase.rpc('increment_stat', { stat_key: 'guest_visits' });
    if (rpcError) {
      // Fallback for when the increment_stat SQL function hasn't been
      // created yet — read the current value and write it back up by one.
      // (Not atomic like the RPC, so back-to-back guest clicks in the same
      // instant could race and undercount by one — acceptable for a rough
      // counter. Blindly upserting value:1 here instead, like a naive
      // fallback would, silently resets the real count to 1 every time this
      // path runs, which is the bug this avoids.)
      const { data: existing } = await supabase
        .from('app_stats').select('value').eq('key', 'guest_visits').maybeSingle();
      await supabase
        .from('app_stats')
        .upsert({ key: 'guest_visits', value: (existing?.value || 0) + 1 }, { onConflict: 'key' });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Guest visit tracking error:', e);
    res.json({ success: false });
  }
});

app.get('/api/guest-visits', async (req, res) => {
  try {
    const { data } = await supabase
      .from('app_stats').select('value').eq('key', 'guest_visits').maybeSingle();
    res.json({ count: data?.value || 0 });
  } catch (e) {
    res.json({ count: 0 });
  }
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

// ── ElevenLabs Speech Engine token (Voice Session / Cold Open / Debate) ────────
// The client builds the same mode-appropriate system prompt it already knows
// how to build (coach persona, scenario, briefing, framework — all the logic
// already in index.html for these 3 modes) and sends the rendered text here
// once per session, rather than this endpoint trying to duplicate that
// client-side prompt-construction logic server-side. Per-turn dynamics (tone,
// debate round) get layered on top server-side in augmentSystemPrompt() above,
// recomputed fresh from the live transcript each turn.
app.post('/api/speech-engine-token', requireAuth, async (req, res) => {
  const { mode, systemPrompt, maxRounds, voiceKey } = req.body;
  if (!mode || !systemPrompt) {
    return res.status(400).json({ error: 'mode and systemPrompt are required' });
  }
  const engineId = SPEECH_ENGINES[voiceKey] || SPEECH_ENGINES.Blaze;
  if (!engineId) {
    return res.status(500).json({ error: 'Speech Engine not configured' });
  }
  try {
    const response = await el.conversationalAi.conversations.getWebrtcToken({
      agentId: engineId,
      participantName: req.user.id,
    });
    // getWebrtcToken() already returns the conversationId this token will
    // resolve to — store metadata under that real ID now, so onInit/
    // onTranscript (which only ever see conversationId, not this token) can
    // look it up directly. No guessing, no "pending:" placeholder key.
    sessionMeta.set(response.conversationId, { mode, systemPrompt, maxRounds });
    setTimeout(() => sessionMeta.delete(response.conversationId), 30 * 60 * 1000);
    res.json({ token: response.token, conversationId: response.conversationId });
  } catch (err) {
    console.error('Speech Engine token error:', err);
    res.status(500).json({ error: 'Failed to generate token' });
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

const httpServer = http.createServer(app);
// Each Speech Engine attach() adds its own 'upgrade' listener to route its
// own WS path — one per voice, legitimately (19 currently: 6 coaches + 13
// Cold Open voices), comfortably past Node's default max-listeners warning
// threshold of 10. Real, expected count here, not a leak.
httpServer.setMaxListeners(Object.keys(SPEECH_ENGINES).length + 10);

// Every engine shares this exact handler — the LLM/prompt logic doesn't
// care which physical engine (i.e. which fixed voice) carried the
// connection, only session.conversationId, which is unique regardless.
const speechEngineHandler = {
  debug: false,
  onInit(conversationId, session) {
    console.log('Speech Engine session started:', conversationId, sessionMeta.has(conversationId) ? '(meta found)' : '(NO META — token endpoint was skipped or meta already expired)');
  },
  async onTranscript(transcript, signal, session) {
    const meta = sessionMeta.get(session.conversationId);
    if (!meta) {
      // No metadata means this connection didn't come through our own
      // /api/speech-engine-token endpoint (or it expired) — nothing
      // safe to do except decline to respond.
      console.error('Speech Engine transcript with no session metadata:', session.conversationId);
      return;
    }
    const messages = transcript.map(m => ({
      role: m.role === 'agent' ? 'assistant' : 'user',
      content: m.content,
    }));
    try {
      const stream = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: augmentSystemPrompt(meta, transcript),
        messages,
        stream: true,
      }, { signal });
      await session.sendResponse(stream);
    } catch (err) {
      if (err?.name === 'AbortError') return; // user interrupted — expected, not an error
      console.error('Speech Engine LLM error:', err);
      await session.sendResponse('Sorry, I had trouble responding — could you say that again?');
    }
  },
  onClose(session) {
    sessionMeta.delete(session.conversationId);
  },
  onDisconnect(session) {
    sessionMeta.delete(session.conversationId);
  },
  onError(err, session) {
    console.error('Speech Engine error:', err);
  },
};

async function startServer() {
  const entries = Object.entries(SPEECH_ENGINES).filter(([, id]) => !!id);
  if (entries.length) {
    for (const [voiceKey, engineId] of entries) {
      const wsPath = '/speech-engine/ws/' + voiceKey.toLowerCase();
      try {
        const engine = await el.speechEngine.get(engineId);
        engine.attach(httpServer, wsPath, speechEngineHandler);
        console.log(`Speech Engine attached: ${voiceKey} -> ${wsPath}`);
      } catch (err) {
        // App still starts — this one voice's Speech Engine path will fail
        // per-request (the token endpoint returns 500) rather than the
        // whole server refusing to boot over one misconfigured voice.
        console.error(`Failed to attach Speech Engine for ${voiceKey}:`, err.message);
      }
    }
  } else {
    console.log('No SPEECH_ENGINE_ID_* env vars set — Speech Engine not attached (Voice Session/Cold Open/Debate will report an error until configured)');
  }

  httpServer.listen(PORT, () => {
    console.log(`\nConver running at http://localhost:${PORT}\n`);
    console.log('ElevenLabs voices loaded\n');
  });
}

startServer();
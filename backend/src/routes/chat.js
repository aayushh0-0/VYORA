/**
 * Stage 10 — AI Copilot Chat, Bounded Memory & Safety Incident Reporting Routes
 */
import { db, isoNow } from '../db.js';
import { id, str, json } from '../utils/helpers.js';
import { authOnly } from '../middleware/auth.js';
import {
  selectPolicy,
  redFlagResponse,
  unsupportedMedicalResponse,
  recognizeIntent,
  postCheckAnswer
} from '../services/aiSafety.js';
import { logAudit } from '../services/auditService.js';

export function getUserMemory(userId) {
  const row = db.prepare('SELECT memory_json, updated_at FROM copilot_memory WHERE user_id = ?').get(userId);
  const items = json(row?.memory_json, []);
  return {
    items: Array.isArray(items) ? items.slice(-12) : [],
    updatedAt: row?.updated_at || null
  };
}

export function saveUserMemory(userId, items) {
  const bounded = (Array.isArray(items) ? items : [])
    .map(x => str(typeof x === 'string' ? x : x?.note || x?.text || '', 240))
    .filter(Boolean)
    .slice(-12);
  const now = isoNow();
  db.prepare(
    `INSERT INTO copilot_memory (user_id, memory_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET memory_json = excluded.memory_json, updated_at = excluded.updated_at`
  ).run(userId, JSON.stringify(bounded), now);
  return { items: bounded, updatedAt: now };
}

export function registerChatRoutes(app) {
  app.get('/api/chat/memory', authOnly, (req, res) => {
    res.json(getUserMemory(req.user.sub));
  });

  app.put('/api/chat/memory', authOnly, (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const saved = saveUserMemory(req.user.sub, items);
    logAudit({ actorId: req.user.sub, action: 'copilot.memory_updated', targetType: 'copilot_memory', targetId: req.user.sub, metadata: { count: saved.items.length } });
    res.json(saved);
  });

  app.delete('/api/chat/memory', authOnly, (req, res) => {
    db.prepare('DELETE FROM copilot_memory WHERE user_id = ?').run(req.user.sub);
    logAudit({ actorId: req.user.sub, action: 'copilot.memory_cleared', targetType: 'copilot_memory', targetId: req.user.sub });
    res.json({ ok: true, items: [], message: 'Conversation memory cleared.' });
  });

  app.post('/api/ai/report', authOnly, (req, res) => {
    const reason = str(req.body?.reason, 300);
    if (!reason) return res.status(400).json({ error: 'A reason is required to report an AI response.' });
    const reportId = id(), now = isoNow();
    const mode = req.body?.mode === 'ovula' ? 'ovula' : 'vyora';
    db.prepare(
      `INSERT INTO ai_safety_reports (id, user_id, mode, user_message, ai_response, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(
      reportId,
      req.user.sub,
      mode,
      str(req.body?.userMessage, 1000) || null,
      str(req.body?.aiResponse, 2000) || null,
      reason,
      now
    );
    logAudit({ actorId: req.user.sub, action: 'ai.safety_reported', targetType: 'ai_safety_report', targetId: reportId, metadata: { mode, reason } });
    res.status(201).json({ id: reportId, status: 'open', createdAt: now, message: 'Thank you. Your report has been logged for safety review.' });
  });

  async function handleChatRequest(req, res) {
    const started = Date.now();
    const message = str(req.body?.message, 4000);
    const mode = req.body?.mode === 'ovula' ? 'ovula' : 'vyora';
    // Most recent 6 turns only; truncate each turn for latency
    const context = (Array.isArray(req.body?.history) ? req.body.history : [])
      .filter((x) => x && ['user', 'model'].includes(x.role) && typeof x.text === 'string')
      .slice(-6)
      .map((x) => ({ role: x.role, parts: [{ text: String(x.text).slice(0, 600) }] }));
    if (!message) return res.status(400).json({ error: 'Message is required.' });

    const personaKey = String(req.body?.persona || req.body?.personality || 'calm').toLowerCase();
    const PERSONAS = {
      calm: 'Tone: Calm Guide — warm, steady, brief.',
      drill: 'Tone: Drill Sergeant — direct, disciplined, respectful, short commands.',
      bro: 'Tone: Gym Bro — upbeat training partner, PG slang, form first.',
      nerd: 'Tone: Data Nerd — precise; state assumptions when estimating.'
    };
    const personaLine = PERSONAS[personaKey] || PERSONAS.calm;

    const intentInfo = recognizeIntent(message);
    const policyInfo = selectPolicy(mode, message);

    if (policyInfo.escalate) {
      logAudit({ actorId: req.user.sub, action: 'ai.red_flag_escalation', targetType: 'chat', metadata: { mode } });
      return res.json({ ...redFlagResponse(), intent: intentInfo });
    }
    if (policyInfo.refuseUnsupported) {
      logAudit({ actorId: req.user.sub, action: 'ai.unsupported_medical_refusal', targetType: 'chat', metadata: { mode } });
      return res.json({ ...unsupportedMedicalResponse(), intent: intentInfo });
    }

    // One memory read; optional save when user states a preference
    const memItems = getUserMemory(req.user.sub).items;
    if (req.body?.rememberPreference === true || /\b(no eggs|vegetarian|vegan|knee hurts|knee pain|prefer outdoor)\b/i.test(message)) {
      const snippet = str(message, 140);
      if (snippet && !memItems.includes(snippet)) {
        saveUserMemory(req.user.sub, [...memItems, snippet]);
        memItems.push(snippet);
      }
    }

    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!geminiKey) {
      return res.status(503).json({
        error: 'Gemini is not configured. Set GEMINI_API_KEY in the project root .env and restart the server.',
        intent: intentInfo
      });
    }

    // Compact system prompt (full safety policy only for escalate/refuse above)
    const memoryContext = memItems.length
      ? `Notes: ${memItems.slice(-6).join(' | ')}`
      : '';
    let profileBits = '';
    try {
      const profileRow = db.prepare('SELECT profile_json FROM profiles WHERE user_id = ?').get(req.user.sub);
      const profile = json(profileRow?.profile_json, {});
      if (profile && typeof profile === 'object') {
        const keys = ['goal', 'experience', 'daysPerWeek', 'equipment', 'sessionMinutes', 'diet', 'age'];
        const parts = keys.filter((k) => profile[k] != null && profile[k] !== '').map((k) => `${k}=${profile[k]}`);
        if (parts.length) profileBits = `Profile: ${parts.join(', ')}`;
      }
    } catch { /* optional */ }

    const systemText = [
      mode === 'ovula'
        ? 'You are OVULA, a supportive menstrual wellness companion in VYORA. Not a doctor.'
        : 'You are VYORA, a fitness and nutrition wellness copilot. Not a doctor.',
      'Never diagnose, prescribe, or change medication. For red-flag symptoms urge urgent care.',
      'Be practical and concise (usually under 120 words unless the user asks for detail).',
      personaLine,
      memoryContext,
      profileBits
    ].filter(Boolean).join('\n');

    const contents = [
      ...context,
      { role: 'user', parts: [{ text: message }] }
    ];

    // Single model call — no multi-model waterfall (that was the main latency tax)
    const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
    const generationConfig = {
      temperature: 0.5,
      maxOutputTokens: 384
    };

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(25_000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents,
            generationConfig
          })
        }
      );
      const data = await response.json().catch(() => ({}));
      const rawMsg = String(data?.error?.message || `Gemini request failed (${response.status}).`)
        .replace(/key=[^&\s'"]+/gi, 'key=REDACTED');

      if (!response.ok) {
        if (response.status === 429) {
          return res.status(429).json({
            error: 'Gemini quota or rate limit reached. Wait a minute and try a shorter message.',
            intent: intentInfo
          });
        }
        // One optional retry only when the configured model id is missing
        if (response.status === 404 || /NOT_FOUND|not found|is not found/i.test(rawMsg)) {
          const fallback = 'gemini-3.6-flash';
          if (fallback !== model) {
            const retry = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(fallback)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                signal: AbortSignal.timeout(25_000),
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: systemText }] },
                  contents,
                  generationConfig
                })
              }
            );
            const retryData = await retry.json().catch(() => ({}));
            if (retry.ok) {
              const answer = retryData?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n').trim();
              if (answer) {
                return res.json({
                  answer,
                  model: fallback,
                  intent: intentInfo,
                  latencyMs: Date.now() - started,
                  safety: { mode: policyInfo.mode, redFlag: false, postCheck: postCheckAnswer(answer) }
                });
              }
            }
            const retryMsg = String(retryData?.error?.message || rawMsg).replace(/key=[^&\s'"]+/gi, 'key=REDACTED');
            return res.status(502).json({ error: retryMsg, intent: intentInfo });
          }
        }
        return res.status(response.status >= 500 ? 502 : response.status).json({ error: rawMsg, intent: intentInfo });
      }

      const answer = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n').trim();
      if (!answer) return res.status(502).json({ error: 'AI returned an empty answer.' });

      res.json({
        answer,
        model,
        intent: intentInfo,
        latencyMs: Date.now() - started,
        safety: { mode: policyInfo.mode, redFlag: false, postCheck: postCheckAnswer(answer) }
      });
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || /aborted|timeout/i.test(String(err?.message || ''));
      res.status(502).json({
        error: timedOut
          ? 'Gemini took too long to respond. Try a shorter question.'
          : 'Could not reach Gemini. Check backend network connectivity.',
        intent: intentInfo
      });
    }
  }


  /** SSE streaming chat — one Gemini streamGenerateContent request */
  async function handleChatStream(req, res) {
    const started = Date.now();
    const message = str(req.body?.message, 4000);
    const mode = req.body?.mode === 'ovula' ? 'ovula' : 'vyora';
    const context = (Array.isArray(req.body?.history) ? req.body.history : [])
      .filter((x) => x && ['user', 'model'].includes(x.role) && typeof x.text === 'string')
      .slice(-6)
      .map((x) => ({ role: x.role, parts: [{ text: String(x.text).slice(0, 600) }] }));
    if (!message) return res.status(400).json({ error: 'Message is required.' });

    const personaKey = String(req.body?.persona || 'calm').toLowerCase();
    const PERSONAS = {
      calm: 'Tone: Calm Guide — warm, steady, brief.',
      drill: 'Tone: Drill Sergeant — direct, disciplined, respectful.',
      bro: 'Tone: Gym Bro — upbeat, form first.',
      nerd: 'Tone: Data Nerd — precise with uncertainty.'
    };
    const intentInfo = recognizeIntent(message);
    const policyInfo = selectPolicy(mode, message);
    if (policyInfo.escalate) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ type: 'done', answer: redFlagResponse().answer, intent: intentInfo })}\n\n`);
      return res.end();
    }
    if (policyInfo.refuseUnsupported) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ type: 'done', answer: unsupportedMedicalResponse().answer, intent: intentInfo })}\n\n`);
      return res.end();
    }

    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!geminiKey) {
      return res.status(503).json({ error: 'Gemini is not configured. Set GEMINI_API_KEY in the project root .env.' });
    }

    const memItems = getUserMemory(req.user.sub).items;
    const systemText = [
      mode === 'ovula' ? 'You are OVULA in VYORA. Not a doctor.' : 'You are VYORA, fitness/nutrition copilot. Not a doctor.',
      'Never diagnose or prescribe. Be concise (under 120 words unless asked).',
      PERSONAS[personaKey] || PERSONAS.calm,
      memItems.length ? `Notes: ${memItems.slice(-4).join(' | ')}` : ''
    ].filter(Boolean).join('\n');

    const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
    const contents = [...context, { role: 'user', parts: [{ text: message }] }];

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(30_000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents,
            generationConfig: { temperature: 0.5, maxOutputTokens: 384 }
          })
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg = String(errBody?.error?.message || `Gemini stream failed (${response.status})`)
          .replace(/key=[^&\s'"]+/gi, 'key=REDACTED');
        res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
        return res.end();
      }

      let full = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const chunk = JSON.parse(payload);
            const text = chunk?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
            if (text) {
              full += text;
              res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
            }
          } catch { /* ignore partial JSON */ }
        }
      }
      res.write(`data: ${JSON.stringify({
        type: 'done',
        answer: full.trim(),
        model,
        latencyMs: Date.now() - started,
        intent: intentInfo
      })}\n\n`);
      res.end();
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || /aborted|timeout/i.test(String(err?.message || ''));
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: timedOut ? 'Gemini took too long to respond.' : 'Could not reach Gemini.'
      })}\n\n`);
      res.end();
    }
  }

  app.post('/api/chat', authOnly, handleChatRequest);
  app.post('/api/ai/chat', authOnly, handleChatRequest);
  app.post('/api/chat/stream', authOnly, handleChatStream);
}

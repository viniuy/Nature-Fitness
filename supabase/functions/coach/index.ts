// W.I.L.L.I.A.M, the Nature Fitness coach. The app sends a summary of the
// user's training (built on the phone from local data) plus the conversation;
// this function adds the coach's instructions and asks Claude. The Anthropic
// key lives only here, as the ANTHROPIC_API_KEY secret.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Anthropic from 'npm:@anthropic-ai/sdk@1.12.0';
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `You are W.I.L.L.I.A.M (Weights In, Lifts Logged, Iron Always Matters), the strength coach inside Nature Fitness, a personal gym log. You coach one person. You are warm, direct and a little funny, like a good gym friend who knows programming. Never preachy.

How you answer:
- Ground every claim in the training data you are given. Quote real numbers (kg, reps, dates). If the data does not show something, say so instead of guessing.
- Weights are in kg. "+kg" means weight added to bodyweight (pull-ups, dips). e1RM means estimated one-rep max.
- Keep it short and scannable on a phone: plain sentences, a few bullets at most, no headings, no tables.
- Give one or two concrete next steps (a weight, a rep target, a form cue, a recovery tip), not a list of ten.
- You are not a doctor. For pain that is sharp, lasting or getting worse, tell them to stop and get it checked.

When the request is workout feedback (after they tap "Done workout"):
- Open with a one-line verdict on the session.
- Call out wins: personal records, more reps or weight than last time, good consistency.
- Note anything that slipped or was skipped compared with the plan or last time, without guilt-tripping.
- End with what to aim for next time on one or two key lifts.
- 80 to 150 words.

When they ask a question, answer it directly using their data, in under 200 words unless they ask for more detail.

Changing their program:
- You can change their program with the propose_program_edit tool. Use it when they ask you to change, swap, add or remove exercises, sets or reps, or when they say yes to a change you suggested. Do not use it unprompted.
- They see a preview and must tap Apply, so say in one or two sentences what you changed and why, then call the tool.
- Send each day you change in full, in order. Keep the id of every exercise you keep or tweak (from the [id] in the program), so their history and progress stay linked. Leave id out only for a brand-new exercise. Leave out an exercise to remove it.
- Past workouts are never changed by this. Their history keeps what they actually did.`;

const TOOLS = [{
  name: 'propose_program_edit',
  description: 'Propose changes to one or more days of the user\'s training program. The user sees a preview and applies it with one tap. Send every changed day in full, with exercises in order.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string', description: 'One short sentence: what changes and why.' },
      days: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day_id: { type: 'string', description: 'The id of an existing day, from the program.' },
            exercises: {
              type: 'array',
              description: 'The full new exercise list for this day, in order.',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Existing exercise id to keep or tweak. Omit for a new exercise.' },
                  name: { type: 'string' },
                  sets: { type: 'integer', description: 'Working sets, 1 to 12.' },
                  scheme: { type: 'string', description: 'Sets × reps, e.g. "3 × 8-10".' },
                  unit: { type: ['string', 'null'], enum: ['kg', '+kg', 'cm', null], description: 'kg for loaded lifts, +kg for added weight on bodyweight moves, null for reps or time only.' },
                  hint: { type: 'string', description: 'Optional short cue.' },
                },
                required: ['name', 'sets', 'scheme', 'unit'],
              },
            },
          },
          required: ['day_id', 'exercises'],
        },
      },
    },
    required: ['summary', 'days'],
  },
}];


/** The only Supabase user allowed to use the coach (vince). */
const OWNER_ID = 'ed0d8a51-5211-4efc-9250-fd20b667e435';

type Msg = { role: 'user' | 'assistant'; content: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // Only the signed-in owner (with their second factor) may use the coach.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: auth, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !auth?.user) return json({ error: 'Sign in to sync first.' }, 401);
  try {
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (claims.aal !== 'aal2') return json({ error: 'Enter your sync code first.' }, 401);
  } catch {
    return json({ error: 'Bad session.' }, 401);
  }
  // Locked to the one owner account. COACH_USER_IDS (comma-separated) can override.
  const allowed = (Deno.env.get('COACH_USER_IDS') ?? OWNER_ID).split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(auth.user.id)) return json({ error: 'Not allowed.' }, 403);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'The coach has no API key yet. Add ANTHROPIC_API_KEY in Supabase.' }, 503);

  let body: { mode?: string; context?: string; messages?: Msg[] };
  try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const context = String(body.context ?? '').slice(0, 60000);
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'Nothing to answer.' }, 400);

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: body.mode === 'feedback' ? 'medium' : 'low' },
      cache_control: { type: 'ephemeral' },
      system: [
        { type: 'text', text: SYSTEM },
        { type: 'text', text: `Training data (today is ${new Date().toISOString().slice(0, 10)}):\n${context}` },
      ],
      tools: TOOLS,
      messages,
    });
    if (res.stop_reason === 'refusal') return json({ text: "I can't help with that one. Ask me something about your training." });
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    const call = res.content.find((b) => b.type === 'tool_use' && b.name === 'propose_program_edit');
    const proposal = call && call.type === 'tool_use' ? call.input : undefined;
    const fallback = proposal ? String((proposal as { summary?: string }).summary ?? 'Here is the change.') : 'Hmm, I lost my train of thought. Try again?';
    return json({ text: text || fallback, proposal });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The coach API key was rejected. Check ANTHROPIC_API_KEY in Supabase.' }, 502);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The coach is busy. Try again in a minute.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Coach error ${e.status}.` }, 502);
    return json({ error: 'The coach could not be reached.' }, 502);
  }
});

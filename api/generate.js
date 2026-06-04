// Backend function (OpenRouter). Runs on Vercel's servers, so the key stays secret.
// Vercel turns this into:  yoursite.vercel.app/api/generate

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing OPENROUTER_API_KEY in Vercel settings." });

  const a = (req.body && req.body.adviser) || {};

  const systemPrompt = `You are the inbound conversion strategist for Marloo, an AI platform for financial advisers.

WHAT MARLOO IS: it records client meetings and turns them into compliant file notes, advice documents, tasks, forms, emails, and a persistent per-client knowledge base. It starts free and self-serve, billed per firm. "Marloo Teams" adds firm-wide compliance oversight. Buyers are advisers, planners and paraplanners across wealth, mortgage and insurance advice — conservative, regulated, cautious about client-data handling.

HOW CONVERSION WORKS (use this):
1. ACTIVATION is the first file note from a real client meeting, NOT signup. An adviser who hasn't recorded a meeting hasn't seen value; the job is getting them there.
2. STICKINESS comes from using it across several clients.
3. EXPANSION is the real revenue engine: solo adviser -> firm-wide (Teams) rollout. A heavy solo power-user near trial end is an expansion opportunity.
4. THE DOMINANT BLOCKER is trust: data security, retention/deletion, compliance. When that's the real objection, lead with concrete proof (SOC 2 Type 2, GDPR, auto-delete of recordings) before any feature pitch.
5. TAILOR to sub-vertical (a mortgage adviser needs fact-find notes, not wealth framing).

Be specific to THIS adviser, reference their actual behaviour, sound like Marloo (plain, respectful, adviser-to-adviser, no hype, no emoji, never pushy with a compliance-anxious buyer).

Respond with ONLY a JSON object, no markdown:
{
 "funnel_stage": "<short phrase>",
 "conversion_likelihood": "<Low | Medium | High>",
 "primary_blocker": "<1-2 sentences>",
 "recommended_play": "<2-3 sentences: the next-best-action and why it fits this adviser>",
 "outreach_channel": "<Email | In-app message | Sales call>",
 "outreach_subject": "<subject if Email, else empty string>",
 "outreach_message": "<the actual drafted outreach, ready to send>"
}`;

  const userPrompt = `Trial adviser:
Name: ${a.name}
Role: ${a.role}
Sub-vertical: ${a.vertical}
Region: ${a.region}
Trial day (of 14): ${a.trial_day}    Days left: ${a.trial_left}
Meetings recorded: ${a.meetings}    Active clients: ${a.clients}
Invited teammates: ${a.team_invited ? "yes" : "no"}
Behaviour / signal: ${a.signal}`;

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Copy the exact slug from openrouter.ai/models. Avoid "thinking"/reasoning
        // variants here — they spend tokens on hidden reasoning and can truncate the answer.
        model: "anthropic/claude-haiku-4.5",
        max_tokens: 1500,
        response_format: { type: "json_object" }, // ask for guaranteed-valid JSON
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: (data.error && data.error.message) || "AI request failed" });

    let text = (data.choices && data.choices[0] && data.choices[0].message.content || "").trim();
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

    let play;
    try { play = JSON.parse(text); }
    catch (e) {
      play = { funnel_stage: "—", conversion_likelihood: "Medium", primary_blocker: "(Model returned unstructured text.)",
        recommended_play: text.slice(0, 500), outreach_channel: "Email", outreach_subject: "", outreach_message: text };
    }
    return res.status(200).json(play);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

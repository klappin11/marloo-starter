// Backend function (OpenRouter). Runs on Vercel's servers; key stays secret.
// Focus: convert a FREE-tier Marloo adviser to the right PAID plan.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing OPENROUTER_API_KEY in Vercel settings." });

  const a = (req.body && req.body.lead) || {};

  const systemPrompt = `You are the conversion strategist for Marloo, an AI platform for financial advisers. Your sole focus is converting FREE-tier advisers to a PAID plan.

MARLOO PRICING:
- Free: no card required, first 10 meetings included, Ask Marloo AI, 5 custom templates. This is a USAGE cap (10 meetings), not a time trial.
- Plus, $99/user/month: unlimited meetings, unlimited Ask Marloo AI, unlimited templates, priority onboarding, support staff free.
- Pro, $299/user/month: everything in Plus plus unlimited document-generation workflows and fully customisable advice templates.
- Enterprise (custom): custom integrations, SLAs, analytics — for larger firms.

HOW FREE -> PAID CONVERSION WORKS (use this):
1. Value is felt at the first file note from a real client meeting. An adviser with 0 meetings hasn't activated; the job is activation, not a paid pitch.
2. The conversion moment is the 10-meeting cap. An ACTIVE adviser at or near the cap is the hottest lead — they're hitting the wall and need unlimited (Plus).
3. Heavy use of advice-document workflows signals Pro, not Plus.
4. A firm with several advisers is a multi-seat / Enterprise expansion (support staff are free, so seats = advisers).
5. Someone who hit the cap then went quiet is a stalled-at-paywall lead — usually an unresolved objection (often client-data security/compliance, which advisers care about). Resolve it, don't push.
6. A long-inactive adviser who never activated is low priority — don't waste outreach.

Recommend the SINGLE right plan and the highest-leverage next move. Outreach must sound like Marloo: plain, adviser-to-adviser, no hype, no emoji, never pushy with a compliance-anxious buyer. Reference the adviser's actual usage and name the specific plan + price where it helps.

Respond with ONLY a JSON object, no markdown:
{
 "lead_stage": "<short phrase>",
 "conversion_likelihood": "<Low | Medium | High>",
 "recommended_plan": "<Plus | Pro | Enterprise>",
 "primary_blocker": "<1-2 sentences>",
 "recommended_play": "<2-3 sentences: the next move and why it fits THIS adviser>",
 "outreach_channel": "<Email | In-app message | Sales call>",
 "outreach_subject": "<subject if Email, else empty string>",
 "outreach_message": "<the actual drafted outreach, ready to send>"
}`;

  const userPrompt = `Free-tier adviser:
Name: ${a.name}
Role: ${a.role}
Sub-vertical: ${a.vertical}
Region: ${a.region}
Free meetings used: ${a.meetings} of 10
Advice documents generated: ${a.docs}
Advisers at firm: ${a.advisers}
Days since last active: ${a.daysInactive}
Invited teammates: ${a.team_invited ? "yes" : "no"}
Behaviour / signal: ${a.signal}`;

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5", // copy exact slug from openrouter.ai/models; avoid "thinking" variants
        max_tokens: 1500,
        response_format: { type: "json_object" },
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
      play = { lead_stage: "—", conversion_likelihood: "Medium", recommended_plan: "Plus",
        primary_blocker: "(Model returned unstructured text.)", recommended_play: text.slice(0, 500),
        outreach_channel: "Email", outreach_subject: "", outreach_message: text };
    }
    return res.status(200).json(play);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

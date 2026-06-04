// Backend function — OpenRouter version.
// Runs on Vercel's SERVERS, so your API key stays secret (never in the browser).
// Vercel turns this file into:  yoursite.vercel.app/api/generate

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Reads your OpenRouter key from Vercel's settings (you'll add it in the dashboard).
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENROUTER_API_KEY in Vercel settings." });
  }

  const adviser = (req.body && req.body.adviser) || {};

  // The instruction to the AI. This is where your GTM thinking lives.
  const systemPrompt = `You are the conversion strategist for Marloo, an AI platform for financial advisers.
Marloo records client meetings and turns them into compliant file notes and advice documents.
Trials convert when an adviser experiences value (a file note from a real meeting), and the biggest
revenue comes from a solo adviser rolling Marloo out to their whole firm (Marloo Teams).
Advisers are cautious about client-data security and compliance, so be honest and never pushy.

Given one trial adviser, write a short conversion play in plain text with three labelled parts:
1. DIAGNOSIS — where they are and what's blocking them (1-2 sentences).
2. PLAY — the single best next move and why (1-2 sentences).
3. DRAFT OUTREACH — a short message to send, in a calm adviser-to-adviser tone, no hype.`;

  const userPrompt = `Adviser: ${adviser.name}
Role: ${adviser.role}
Behaviour: ${adviser.signal}`;

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,   // <-- OpenRouter uses "Bearer <key>"
        "Content-Type": "application/json"
        // Optional, OpenRouter likes these but they're not required:
        // "HTTP-Referer": "https://your-site.vercel.app",
        // "X-Title": "Marloo Conversion Agent"
      },
      body: JSON.stringify({
        // Copy the EXACT slug from openrouter.ai/models (use the copy button).
        // Examples: "anthropic/claude-haiku-4.5", "openai/gpt-4o-mini", or
        // "openrouter/auto" to let OpenRouter pick for you.
        model: "anthropic/claude-haiku-4.5",
        max_tokens: 700,
        messages: [
          { role: "system", content: systemPrompt },  // system prompt is just the first message here
          { role: "user", content: userPrompt }
        ]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: (data.error && data.error.message) || "AI request failed" });
    }

    // OpenRouter (OpenAI-style) puts the answer here:
    const play = (data.choices && data.choices[0] && data.choices[0].message.content || "").trim();
    return res.status(200).json({ play });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

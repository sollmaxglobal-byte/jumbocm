import { generateText } from "ai";

/** Server-only helper that translates an email template to French via Vercel AI Gateway. */
export async function translateEmailTemplate(subject: string, html: string) {
  const { text } = await generateText({
    model: "google/gemini-2.5-flash",
    system:
      "You translate transactional email templates from English to French (Cameroon). " +
      "Keep ALL HTML markup, inline styles and {{variable}} placeholders exactly as they are. " +
      "Translate only human-readable text. Reply with strict JSON: " +
      '{"subject":"...","html":"..."} and nothing else.',
    prompt: JSON.stringify({ subject, html }),
  });

  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const parsed = JSON.parse(cleaned) as { subject: string; html: string };
  return { subject: parsed.subject, html: parsed.html };
}

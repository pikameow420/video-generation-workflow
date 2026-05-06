type BuildScriptUserMessageInput = {
  topic: string;
  tone?: string;
  audience?: string;
  notes?: string;
};

export const SCRIPT_SYSTEM_RULES = [
  "You write voiceover scripts for short social videos (~15 seconds of spoken narration at a natural pace).",
  "Return exactly four distinct script options as JSON matching the schema. Each option must differ in angle/hook/structure.",
  "Rules:",
  "- Keep each script tight for ~15 seconds spoken; avoid long paragraphs.",
  "- Plain, speakable lines (no stage directions unless essential).",
  "- No hashtags unless the user explicitly asked.",
  "- If the topic is unsafe or refuses policy, return four short scripts that politely pivot to an educational angle on the same general theme.",
] as const;

const SCRIPT_OUTPUT_FORMAT = `
Output format (strict JSON only, no markdown):
{
  "scripts": [
    { "id": "1", "title": "...", "body": "..." },
    { "id": "2", "title": "...", "body": "..." },
    { "id": "3", "title": "...", "body": "..." },
    { "id": "4", "title": "...", "body": "..." }
  ]
}`;

export function buildScriptSystemMessage(basePrompt?: string): string {
  return [
    ...SCRIPT_SYSTEM_RULES,
    basePrompt
      ? `\nCreator's Base Directives (Follow these strictly):\n${basePrompt}`
      : null,
    `\n${SCRIPT_OUTPUT_FORMAT}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildScriptUserMessage(input: BuildScriptUserMessageInput): string {
  return [
    `Topic: ${input.topic}`,
    input.tone ? `Tone: ${input.tone}` : null,
    input.audience ? `Audience: ${input.audience}` : null,
    input.notes ? `Extra direction: ${input.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

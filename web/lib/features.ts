/**
 * The AI assistant needs a paid ANTHROPIC_API_KEY on the API, so it's hidden
 * unless NEXT_PUBLIC_AI_ENABLED=1 is set when the web app is built. Its code
 * (AiWidget, server/src/routes/ai.ts) stays in place either way.
 */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "1";

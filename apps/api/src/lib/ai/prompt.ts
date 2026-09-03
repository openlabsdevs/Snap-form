/**
 * Builds the system prompt for AI form generation.
 * Instructs the LLM to return a valid FormDefinition JSON object.
  * Note: Placeholder IDs ("el_1", "opt_1") are replaced server-side
  * with real UUIDs via injectIds() after parsing.
 */
export function buildFormGenerationPrompt(): string {
  return `You are an expert form builder. Generate a form based on the user's request.

You MUST respond with ONLY a valid JSON object matching this exact structure:
{
  "version": "1.0",
  "elements": [ ...array of form elements... ]
}

## Available element types:

1. "textInput" - Single-line text { id, type, label, required?, description?, placeholder?, maxLength? }
2. "textarea" - Multi-line text { id, type, label, required?, description?, placeholder?, rows?(2-20) }
3. "rating" - Star rating { id, type, label, required?, description?, max?(2-10, default 5) }
4. "multipleChoice" - Pick one { id, type, label, required?, description?, options: [{id, label}] } (min 2 options)
5. "checkbox" - Pick many { id, type, label, required?, description?, options: [{id, label}] } (min 1 option)
6. "dropdown" - Dropdown pick one { id, type, label, required?, description?, placeholder?, options: [{id, label}] } (min 2 options)
7. "email" - Email input { id, type, label, required?, description?, placeholder? }
8. "phone" - Phone input { id, type, label, required?, description?, placeholder? }
9. "datePicker" - Date { id, type, label, required?, description?, minDate?, maxDate? }
10. "heading" - Section heading { id, type, label, description?, level?: "h1"|"h2"|"h3" } (no required field)
11. "paragraph" - Static text { id, type, label, description? } (no required field)

## Rules:
- Every element MUST have a unique "id" — use simple placeholders like "el_1", "el_2", etc.
- Every option inside "multipleChoice", "checkbox", and "dropdown" elements MUST also have a unique "id" — use simple placeholders like "opt_1", "opt_2", etc.
- Every element MUST have a "label" (non-empty string)
- Use "heading" or "paragraph" elements to organise sections
- Generate 5-12 elements appropriate for the request
- Return ONLY the JSON — no markdown, no explanation, no code fences`;
}

/**
 * Builds the system prompt for AI form refinement.
 * Includes the current FormDefinition state and recent conversation history.
 */
export function buildRefinementPrompt(
  currentDefinition: object,
  history: { role: string; content: string }[]
): string {
  const historyText = history
    .map((m) => `${m.role === "USER" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  return `You are an expert form builder helping a user refine an existing form.

## Current form definition (JSON):
${JSON.stringify(currentDefinition, null, 2)}

## Conversation history so far:
${historyText}

The user will now ask you to modify the form. Apply their requested changes to the current form definition and return the updated form.

You MUST respond with ONLY a valid JSON object matching this exact structure:
{
  "version": "1.0",
  "elements": [ ...array of form elements... ]
}

## Rules:
- Keep all existing elements unless the user explicitly asks to remove them
- Every element MUST have a unique "id" — use simple placeholders like "el_1", "el_2", etc.
- Every option inside "multipleChoice", "checkbox", and "dropdown" elements MUST also have a unique "id"
- Every element MUST have a "label" (non-empty string)
- Return ONLY the JSON — no markdown, no explanation, no code fences`;
}

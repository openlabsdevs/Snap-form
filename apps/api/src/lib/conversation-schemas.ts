import { z } from "zod";

// POST /api/v1/conversations
// Starts a new conversation with the first AI generation
export const CreateConversationSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt cannot be empty").max(1000, "Prompt is too long"),
});

// POST /api/v1/conversations/:id/messages
// Adds a refinement turn to an existing conversation
export const CreateMessageSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt cannot be empty").max(1000, "Prompt is too long"),
});

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>;

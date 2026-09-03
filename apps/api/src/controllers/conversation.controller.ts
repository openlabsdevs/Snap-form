import { Request, Response, RequestHandler } from "express";
import { asyncHandler } from "../utils/async-handler";
import { FormDefinition, FormDefinitionSchema } from "@repo/types";
import { CreateConversationInput, CreateMessageInput } from "../lib/conversation-schemas";
import prisma from "../lib/db";
import { config } from "../lib/env";
import { aiClient } from "../lib/ai/client";
import { injectIds } from "../lib/ai/inject-ids";
import { buildFormGenerationPrompt, buildRefinementPrompt } from "../lib/ai/prompt";

// ============================================
// POST /api/v1/conversations
// Start a new conversation — first AI generation
// ============================================

export const createConversation: RequestHandler = asyncHandler(
    async (req: Request, res: Response) => {
        if (!config.ai.apiKey) {
            res.status(503).json({ success: false, message: "AI service not configured" });
            return;
        }

        const userId = res.locals.user.id as string;
        const { prompt } = req.body as CreateConversationInput;

        const systemPrompt = buildFormGenerationPrompt();

        let generatedData: FormDefinition | null = null;
        let rawResponse: string | null = null;

        const MAX_RETRIES = 1;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const result = await aiClient.chat.send(
                    {
                        chatRequest: {
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: prompt },
                            ],
                            model: config.ai.model,
                            stream: false,
                            responseFormat: { type: "json_object" },
                        },
                    },
                    { timeoutMs: 30000 }
                );

                const raw = result.choices[0]?.message?.content;
                if (!raw) {
                    if (attempt < MAX_RETRIES) continue;
                    res.status(502).json({ success: false, message: "AI returned an empty response" });
                    return;
                }

                const parsed = JSON.parse(raw);
                injectIds(parsed);
                const validated = FormDefinitionSchema.safeParse(parsed);

                if (!validated.success) {
                    if (attempt < MAX_RETRIES) continue;
                    res.status(422).json({
                        success: false,
                        message: "AI response did not match the expected form schema",
                        errors: validated.error.flatten(),
                    });
                    return;
                }

                generatedData = validated.data;
                rawResponse = raw;
                break;
            } catch (err) {
                if (attempt < MAX_RETRIES) continue;
                console.error("AI form generation failed:", err);
                res.status(422).json({
                    success: false,
                    message: "AI response was invalid or failed to generate",
                });
                return;
            }
        }

        if (!generatedData || !rawResponse) {
            return;
        }

        // Persist conversation + first message pair + FormVersion
        const conversation = await prisma.$transaction(async (tx) => {
            const convo = await tx.conversation.create({
                data: { userId },
            });

            const formVersion = await tx.formVersion.create({
                data: {
                    version: 0,
                    definition: generatedData!,
                    conversationId: convo.id,
                },
            });

            await tx.message.create({
                data: {
                    conversationId: convo.id,
                    role: "USER",
                    content: prompt,
                },
            });

            await tx.message.create({
                data: {
                    conversationId: convo.id,
                    role: "ASSISTANT",
                    content: rawResponse!,
                    formVersionId: formVersion.id,
                },
            });

            return { convo, formVersion };
        });

        res.status(201).json({
            success: true,
            data: {
                conversationId: conversation.convo.id,
                formVersion: {
                    id: conversation.formVersion.id,
                    version: conversation.formVersion.version,
                    definition: generatedData,
                },
            },
        });
    }
);

// ============================================
// POST /api/v1/conversations/:id/messages
// Add a refinement turn to an existing conversation
// ============================================

export const addMessage: RequestHandler = asyncHandler(
    async (req: Request, res: Response) => {
        if (!config.ai.apiKey) {
            res.status(503).json({ success: false, message: "AI service not configured" });
            return;
        }

        const userId = res.locals.user.id as string;
        const conversationId = req.params.id as string;
        const { prompt } = req.body as CreateMessageInput;

        // Verify conversation belongs to this user
        const conversation = await prisma.conversation.findFirst({
            where: { id: conversationId, userId },
        });

        if (!conversation) {
            res.status(404).json({ success: false, message: "Conversation not found" });
            return;
        }

        // Get current form definition (latest FormVersion)
        const latestVersion = await prisma.formVersion.findFirst({
            where: { conversationId },
            orderBy: { version: "desc" },
        });

        if (!latestVersion) {
            res.status(400).json({ success: false, message: "No form version found in this conversation" });
            return;
        }

        // Get last K message turns for context
        const windowSize = config.ai.conversationWindowSize;
        const recentMessages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: "desc" },
            take: windowSize * 2,
        });
        recentMessages.reverse();

        const currentDefinition = FormDefinitionSchema.safeParse(latestVersion.definition);
        if (!currentDefinition.success) {
            res.status(500).json({ success: false, message: "Current form definition is malformed" });
            return;
        }

        const systemPrompt = buildRefinementPrompt(
            currentDefinition.data,
            recentMessages.map((m) => ({ role: m.role, content: m.content }))
        );

        let generatedData: FormDefinition | null = null;
        let rawResponse: string | null = null;

        const MAX_RETRIES = 1;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const result = await aiClient.chat.send(
                    {
                        chatRequest: {
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: prompt },
                            ],
                            model: config.ai.model,
                            stream: false,
                            responseFormat: { type: "json_object" },
                        },
                    },
                    { timeoutMs: 30000 }
                );

                const raw = result.choices[0]?.message?.content;
                if (!raw) {
                    if (attempt < MAX_RETRIES) continue;
                    res.status(502).json({ success: false, message: "AI returned an empty response" });
                    return;
                }

                const parsed = JSON.parse(raw);
                injectIds(parsed);
                const validated = FormDefinitionSchema.safeParse(parsed);

                if (!validated.success) {
                    if (attempt < MAX_RETRIES) continue;
                    res.status(422).json({
                        success: false,
                        message: "AI response did not match the expected form schema",
                        errors: validated.error.flatten(),
                    });
                    return;
                }

                generatedData = validated.data;
                rawResponse = raw;
                break;
            } catch (err) {
                if (attempt < MAX_RETRIES) continue;
                console.error("AI refinement failed:", err);
                res.status(422).json({
                    success: false,
                    message: "AI response was invalid or failed to generate",
                });
                return;
            }
        }

        if (!generatedData || !rawResponse) {
            return;
        }

        // Persist new message pair + new FormVersion outside retry loop
        const newVersion = await prisma.$transaction(async (tx) => {
            const formVersion = await tx.formVersion.create({
                data: {
                    version: latestVersion.version + 1,
                    definition: generatedData!,
                    conversationId: conversationId,
                    ...(conversation.formId && { formId: conversation.formId }),
                },
            });

            await tx.message.create({
                data: { conversationId: conversationId, role: "USER", content: prompt },
            });

            await tx.message.create({
                data: {
                    conversationId: conversationId,
                    role: "ASSISTANT",
                    content: rawResponse!,
                    formVersionId: formVersion.id,
                },
            });

            return formVersion;
        });

        res.json({
            success: true,
            data: {
                formVersion: {
                    id: newVersion.id,
                    version: newVersion.version,
                    definition: generatedData,
                },
            },
        });
    }
);

// ============================================
// GET /api/v1/conversations/:id
// Fetch a conversation with its messages
// ============================================

export const getConversation: RequestHandler = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = res.locals.user.id as string;

        const conversation = await prisma.conversation.findFirst({
            where: { id: req.params.id, userId },
            include: {
                messages: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        id: true,
                        role: true,
                        content: true,
                        formVersionId: true,
                        createdAt: true,
                    },
                },
                formVersions: {
                    orderBy: { version: "asc" },
                    select: {
                        id: true,
                        version: true,
                        definition: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!conversation) {
            res.status(404).json({ success: false, message: "Conversation not found" });
            return;
        }

        res.json({ success: true, data: conversation });
    }
);

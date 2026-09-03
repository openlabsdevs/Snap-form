/// <reference types="bun-types" />
import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { createAuthenticatedClient, createAnonymousClient } from "../setup/auth";
import { cleanDb } from "../setup/db";
import { config } from "../../../../apps/api/src/lib/env";
import { aiClient } from "../../../../apps/api/src/lib/ai/client";
import type { Mock } from "bun:test";

const mockDefinition = {
    version: "1.0",
    elements: [
        {
            id: "550e8400-e29b-41d4-a716-446655440000",
            type: "textInput",
            label: "Full Name",
            required: true,
        },
        {
            id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            type: "email",
            label: "Email Address",
            required: true,
        },
    ],
};

describe("Conversation History", () => {
    let mockSend: Mock<(...args: any[]) => any>;
    let originalApiKey: string;

    beforeEach(async () => {
        await cleanDb();
        originalApiKey = config.ai.apiKey;
        config.ai.apiKey = "test-key";
    });

    afterEach(() => {
        config.ai.apiKey = originalApiKey;
        if (mockSend) {
            mockSend.mockRestore();
            mockSend = undefined as any;
        }
    });

    // ── POST /api/v1/conversations ──────────────────────────────────────

    it("should return 503 when AI is not configured", async () => {
        config.ai.apiKey = "";
        const { client } = await createAuthenticatedClient();
        const res = await client.post("/api/v1/conversations", { prompt: "feedback form" });
        expect(res.status).toBe(503);
    });

    it("should return 401 for unauthenticated requests", async () => {
        const res = await createAnonymousClient().post("/api/v1/conversations", { prompt: "feedback form" });
        expect(res.status).toBe(401);
    });

    it("should return 400 when prompt is missing", async () => {
        const { client } = await createAuthenticatedClient();
        const res = await client.post("/api/v1/conversations", {});
        expect(res.status).toBe(400);
        expect(res.data.message).toBe("Validation failed");
    });

    it("should create a conversation and return conversationId + formVersion v0", async () => {
        mockSend = spyOn(aiClient.chat, "send" as any).mockImplementation(async () => ({
            choices: [{ message: { content: JSON.stringify(mockDefinition) } }],
        })) as any;

        const { client } = await createAuthenticatedClient();
        const res = await client.post("/api/v1/conversations", { prompt: "Create a feedback form" });

        expect(res.status).toBe(201);
        expect(res.data.success).toBe(true);
        expect(res.data.data.conversationId).toBeDefined();
        expect(res.data.data.formVersion.version).toBe(0);
        const def = res.data.data.formVersion.definition;
        expect(def.version).toBe("1.0");
        expect(def.elements).toHaveLength(2);
        expect(def.elements[0].label).toBe("Full Name");
        expect(def.elements[0].type).toBe("textInput");
        expect(def.elements[1].label).toBe("Email Address");
        expect(def.elements[1].type).toBe("email");

    });

    // ── POST /api/v1/conversations/:id/messages ─────────────────────────

    it("should add a refinement turn and return FormVersion v1", async () => {
        mockSend = spyOn(aiClient.chat, "send" as any).mockImplementation(async () => ({
            choices: [{ message: { content: JSON.stringify(mockDefinition) } }],
        })) as any;

        const { client } = await createAuthenticatedClient();

        // First create a conversation
        const createRes = await client.post("/api/v1/conversations", { prompt: "feedback form" });
        expect(createRes.status).toBe(201);
        const conversationId = createRes.data.data.conversationId;

        // Then refine it
        const refineRes = await client.post(`/api/v1/conversations/${conversationId}/messages`, {
            prompt: "Add a phone number field",
        });

        expect(refineRes.status).toBe(200);
        expect(refineRes.data.success).toBe(true);
        expect(refineRes.data.data.formVersion.version).toBe(1);
    });

    it("should return 404 when refining a conversation that doesn't exist", async () => {
        const { client } = await createAuthenticatedClient();
        const res = await client.post("/api/v1/conversations/nonexistent-id/messages", {
            prompt: "Add a phone field",
        });
        expect(res.status).toBe(404);
    });

    it("should not allow one user to refine another user's conversation", async () => {
        mockSend = spyOn(aiClient.chat, "send" as any).mockImplementation(async () => ({
            choices: [{ message: { content: JSON.stringify(mockDefinition) } }],
        })) as any;

        const { client: client1 } = await createAuthenticatedClient();
        const { client: client2 } = await createAuthenticatedClient();

        const createRes = await client1.post("/api/v1/conversations", { prompt: "feedback form" });
        const conversationId = createRes.data.data.conversationId;

        const refineRes = await client2.post(`/api/v1/conversations/${conversationId}/messages`, {
            prompt: "Add a phone field",
        });
        expect(refineRes.status).toBe(404);
    });

    // ── GET /api/v1/conversations/:id ───────────────────────────────────

    it("should fetch a conversation with messages and formVersions", async () => {
        mockSend = spyOn(aiClient.chat, "send" as any).mockImplementation(async () => ({
            choices: [{ message: { content: JSON.stringify(mockDefinition) } }],
        })) as any;

        const { client } = await createAuthenticatedClient();
        const createRes = await client.post("/api/v1/conversations", { prompt: "feedback form" });
        const conversationId = createRes.data.data.conversationId;

        const getRes = await client.get(`/api/v1/conversations/${conversationId}`);

        expect(getRes.status).toBe(200);
        expect(getRes.data.data.messages).toHaveLength(2); // USER + ASSISTANT
        expect(getRes.data.data.formVersions).toHaveLength(1); // v0
    });

    it("should return 404 when fetching a conversation that doesn't exist", async () => {
        const { client } = await createAuthenticatedClient();
        const res = await client.get("/api/v1/conversations/nonexistent-id");
        expect(res.status).toBe(404);
    });
});

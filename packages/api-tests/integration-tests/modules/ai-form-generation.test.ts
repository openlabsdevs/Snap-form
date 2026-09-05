/// <reference types="bun-types" />
import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { createAuthenticatedClient, createAnonymousClient } from "../setup/auth";
import { cleanDb } from "../setup/db";
import { config } from "../../../../apps/api/src/lib/env";
import { aiClient } from "../../../../apps/api/src/lib/ai/client";
import type { Mock } from "bun:test";

describe("AI Form Generation", () => {
  let mockSend: Mock<(...args: any[]) => any>;
  let originalApiKey: string;
  let originalModel: string;

  beforeEach(async () => {
    await cleanDb();
    originalApiKey = config.ai.apiKey;
    originalModel = config.ai.model;
    config.ai.apiKey = "test-key";
    config.ai.model = "test-model";
  });

  afterEach(() => {
    config.ai.apiKey = originalApiKey;
    config.ai.model = originalModel;
    if (mockSend) {
      mockSend.mockRestore();
      mockSend = undefined as any;
    }
  });

  it("should return 503 when AI service is not configured", async () => {
    config.ai.apiKey = "";
    const { client } = await createAuthenticatedClient();
    const res = await client.post("/api/v1/forms/generate", {
      prompt: "Create a feedback form",
    });

    expect(res.status).toBe(503);
    expect(res.data.success).toBe(false);
    expect(res.data.message).toBe("AI service not configured");
  });

  it("should return 200 with a valid form definition on success", async () => {
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

    mockSend = spyOn(aiClient.chat, "send" as any).mockImplementation(async () => ({
      choices: [{ message: { content: JSON.stringify(mockDefinition) } }],
    })) as any;

    const { client } = await createAuthenticatedClient();
    const res = await client.post("/api/v1/forms/generate", {
      prompt: "Create a feedback form",
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    const definition = res.data.data.definition;
    const elementIds = definition.elements.map((e: any) => e.id);
    const mockIds = mockDefinition.elements.map((e) => e.id);

    expect(definition.version).toBe(mockDefinition.version);
    expect(elementIds).toHaveLength(2);
    expect(new Set(elementIds).size).toBe(2); // fresh, unique IDs
    expect(mockIds.some((id) => elementIds.includes(id))).toBe(false);
    expect(definition.elements.map((e: any) => e.label)).toEqual(
      mockDefinition.elements.map((e) => e.label),
    );
  });

  it("should return 422 when AI response does not match the form schema", async () => {
    mockSend = spyOn(aiClient.chat, "send" as any).mockImplementation(async () => ({
      choices: [{ message: { content: JSON.stringify({ foo: "bar" }) } }],
    })) as any;

    const { client } = await createAuthenticatedClient();
    const res = await client.post("/api/v1/forms/generate", {
      prompt: "Create a feedback form",
    });

    expect(res.status).toBe(422);
    expect(res.data.success).toBe(false);
    expect(res.data.message).toBe("AI response did not match the expected form schema");
    expect(res.data.errors).toBeDefined();
  });

  it("should return 502 when AI returns an empty response", async () => {
    mockSend = spyOn(aiClient.chat, "send" as any).mockImplementation(async () => ({
      choices: [{ message: { content: null } }],
    })) as any;

    const { client } = await createAuthenticatedClient();
    const res = await client.post("/api/v1/forms/generate", {
      prompt: "Create a feedback form",
    });

    expect(res.status).toBe(502);
    expect(res.data.success).toBe(false);
    expect(res.data.message).toBe("AI returned an empty response");
  });

  it("should return 422 when AI throws an exception", async () => {
    mockSend = spyOn(aiClient.chat, "send" as any).mockImplementation(async () => {
      throw new Error("AI service unavailable");
    }) as any;

    const { client } = await createAuthenticatedClient();
    const res = await client.post("/api/v1/forms/generate", {
      prompt: "Create a feedback form",
    });

    expect(res.status).toBe(422);
    expect(res.data.success).toBe(false);
    expect(res.data.message).toBe("AI response was invalid or failed to generate");
  });

  it("should return 401 for unauthenticated requests", async () => {
    const anonClient = createAnonymousClient();
    const res = await anonClient.post("/api/v1/forms/generate", {
      prompt: "Create a feedback form",
    });

    expect(res.status).toBe(401);
  });

  it("should return 400 when prompt is missing", async () => {
    const { client } = await createAuthenticatedClient();
    const res = await client.post("/api/v1/forms/generate", {});

    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(res.data.message).toBe("Validation failed");
  });
});

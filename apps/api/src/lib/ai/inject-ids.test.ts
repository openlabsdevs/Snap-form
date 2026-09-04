import { describe, it, expect } from "bun:test";
import { injectIds } from "./inject-ids";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("injectIds", () => {
  it("replaces element ids with valid UUID v4s", () => {
    const definition = {
      elements: [
        { id: "el_1", type: "textInput", label: "Name" },
        { id: "el_2", type: "email", label: "Email" },
      ],
    };

    injectIds(definition);

    for (const el of definition.elements) {
      expect(el.id).toMatch(UUID_REGEX);
      expect(el.id).not.toBe("el_1");
      expect(el.id).not.toBe("el_2");
    }
  });

  it("replaces option ids inside dropdown/checkbox/multipleChoice with valid UUIDs", () => {
    const definition = {
      elements: [
        {
          id: "el_1",
          type: "dropdown",
          label: "Subject",
          options: [
            { id: "opt_1", label: "Option A" },
            { id: "opt_2", label: "Option B" },
          ],
        },
      ],
    };

    injectIds(definition);

    const [firstEl] = definition.elements;
    const opts = firstEl?.options ?? [];
    for (const opt of opts) {
      expect(opt.id).toMatch(UUID_REGEX);
      expect(opt.id).not.toBe("opt_1");
      expect(opt.id).not.toBe("opt_2");
    }
  });

  it("all injected ids are unique across elements and options", () => {
    const definition = {
      elements: [
        { id: "el_1", type: "textInput", label: "Name" },
        {
          id: "el_2",
          type: "dropdown",
          label: "Role",
          options: [
            { id: "opt_1", label: "Admin" },
            { id: "opt_2", label: "User" },
          ],
        },
      ],
    };

    injectIds(definition);

    const [firstElement, secondElement] = definition.elements;
    const allIds = [
      firstElement?.id,
      secondElement?.id,
      ...(secondElement?.options ?? []).map((o) => o.id),
    ];

    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });

  it("handles empty elements array", () => {
    const definition = { elements: [] };
    injectIds(definition);
    expect(definition.elements).toEqual([]);
  });

  it("handles elements without options field", () => {
    const definition = {
      elements: [
        { id: "el_1", type: "heading", label: "Title" },
        { id: "el_2", type: "paragraph", label: "Text" },
      ],
    };
    injectIds(definition);
    for (const el of definition.elements) {
      expect(el.id).toMatch(UUID_REGEX);
    }
  });

  it("handles null options gracefully", () => {
    const definition = {
      elements: [
        { id: "el_1", type: "multipleChoice", label: "Pick", options: null },
      ],
    };
    injectIds(definition);
    expect(definition.elements[0]?.id).toMatch(UUID_REGEX);
  });

  it("handles missing elements key gracefully", () => {
    const definition = {};
    injectIds(definition);
    expect(definition).toEqual({});
  });

  it("skips null and primitive entries in elements array", () => {
    const definition = {
      elements: [
        null,
        "string",
        42,
        { id: "el_1", type: "textInput", label: "Name" },
      ],
    };
    injectIds(definition);
    expect((definition.elements[3] as { id: string }).id).toMatch(UUID_REGEX);
    expect(definition.elements[0]).toBeNull();
    expect(definition.elements[1]).toBe("string");
    expect(definition.elements[2]).toBe(42);
  });

  it("regenerates duplicate UUIDs to prevent collisions", () => {
    const existingUuid = "550e8400-e29b-41d4-a716-446655440000";
    const definition = {
      elements: [
        { id: existingUuid, type: "textInput", label: "Name" },
        { id: existingUuid, type: "email", label: "Email" },
      ],
    };
    injectIds(definition, true);
    expect(definition.elements[0]!.id).toBe(existingUuid);
    expect(definition.elements[1]!.id).toMatch(UUID_REGEX);
    expect(definition.elements[1]!.id).not.toBe(existingUuid);
  });
});

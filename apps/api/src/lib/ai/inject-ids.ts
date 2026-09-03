import { randomUUID } from "node:crypto";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function injectIds(
  definition: { elements?: unknown[] },
  preserveValidUuids = false
) {
  if (!Array.isArray(definition?.elements)) return;

  for (const el of definition.elements) {
    if (!el || typeof el !== "object") continue;
    const record = el as Record<string, unknown>;
    if (!preserveValidUuids || typeof record.id !== "string" || !UUID_REGEX.test(record.id)) {
      record.id = randomUUID();
    }

    const opts = record.options;
    if (Array.isArray(opts)) {
      for (const opt of opts) {
        if (!opt || typeof opt !== "object") continue;
        const optRecord = opt as Record<string, unknown>;
        if (!preserveValidUuids || typeof optRecord.id !== "string" || !UUID_REGEX.test(optRecord.id)) {
          optRecord.id = randomUUID();
        }
      }
    }
  }
}

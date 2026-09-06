import { randomUUID } from "node:crypto";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Recursively injects valid, unique UUIDs into form element definitions and options.
 * Optionally preserves existing valid UUIDs while preventing collisions.
 *
 * @param definition - Form definition containing an elements array.
 * @param preserveValidUuids - Whether to keep existing valid UUIDs (default: false).
 */
export function injectIds(
  definition: { elements?: unknown[] },
  preserveValidUuids = false,
) {
  if (!Array.isArray(definition?.elements)) return;

  const seenIds = new Set<string>();

  const getUniqueId = (candidate: unknown): string => {
    if (
      preserveValidUuids &&
      typeof candidate === "string" &&
      UUID_REGEX.test(candidate) &&
      !seenIds.has(candidate)
    ) {
      seenIds.add(candidate);
      return candidate;
    }
    let newId: string;
    do {
      newId = randomUUID();
    } while (seenIds.has(newId));
    seenIds.add(newId);
    return newId;
  };

  for (const el of definition.elements) {
    if (!el || typeof el !== "object") continue;
    const record = el as Record<string, unknown>;
    record.id = getUniqueId(record.id);

    const opts = record.options;
    if (Array.isArray(opts)) {
      for (const opt of opts) {
        if (!opt || typeof opt !== "object") continue;
        const optRecord = opt as Record<string, unknown>;
        optRecord.id = getUniqueId(optRecord.id);
      }
    }
  }
}

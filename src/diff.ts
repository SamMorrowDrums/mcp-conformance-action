/**
 * Core diffing logic for MCP servers
 *
 * Pure functions for comparing probe results - no I/O side effects.
 */

import type { ProbeResult, PrimitiveCounts } from "./types.js";
import { probeResultToFiles } from "./probe.js";

export interface DiffResult {
  endpoint: string;
  diff: string;
}

export interface ComparisonResult {
  baseName: string;
  targetName: string;
  hasDifferences: boolean;
  diffs: DiffResult[];
  baseCounts: PrimitiveCounts;
  targetCounts: PrimitiveCounts;
  baseError?: string;
  targetError?: string;
}

/**
 * Extract primitive counts from a probe result
 */
export function extractCounts(result: ProbeResult): PrimitiveCounts {
  return {
    tools: result.tools?.tools?.length || 0,
    prompts: result.prompts?.prompts?.length || 0,
    resources: result.resources?.resources?.length || 0,
    resourceTemplates: result.resourceTemplates?.resourceTemplates?.length || 0,
  };
}

/**
 * Compare two probe results and return structured diff results
 */
export function compareProbeResults(
  baseResult: ProbeResult,
  targetResult: ProbeResult
): DiffResult[] {
  const baseFiles = probeResultToFiles(baseResult);
  const targetFiles = probeResultToFiles(targetResult);
  const diffs: DiffResult[] = [];

  const allEndpoints = new Set([...baseFiles.keys(), ...targetFiles.keys()]);

  for (const endpoint of allEndpoints) {
    const baseContent = baseFiles.get(endpoint);
    const targetContent = targetFiles.get(endpoint);

    if (!targetContent && baseContent) {
      diffs.push({
        endpoint,
        diff: `Endpoint removed in target (was present in base)`,
      });
    } else if (targetContent && !baseContent) {
      diffs.push({
        endpoint,
        diff: `Endpoint added in target (not present in base)`,
      });
    } else if (baseContent !== targetContent) {
      const diff = generateJsonDiff(endpoint, baseContent || "", targetContent || "");
      if (diff) {
        diffs.push({ endpoint, diff });
      }
    }
  }

  return diffs;
}

/**
 * Generate semantic JSON diff
 */
export function generateJsonDiff(name: string, base: string, target: string): string | null {
  try {
    const baseObj = JSON.parse(base);
    const targetObj = JSON.parse(target);

    const differences = findJsonDifferences(baseObj, targetObj, "");

    if (differences.length === 0) {
      return null;
    }

    const diffLines = [`--- base/${name}.json`, `+++ target/${name}.json`, ""];
    diffLines.push(...differences);

    return diffLines.join("\n");
  } catch {
    // Fallback for non-JSON
    if (base === target) return null;
    return `--- base/${name}\n+++ target/${name}\n- ${base}\n+ ${target}`;
  }
}

/**
 * Recursively find differences between two JSON objects
 */
export function findJsonDifferences(base: unknown, target: unknown, path: string): string[] {
  const diffs: string[] = [];

  if (base === null || base === undefined) {
    if (target !== null && target !== undefined) {
      diffs.push(`+ ${path || "root"}: ${formatValue(target)}`);
    }
    return diffs;
  }

  if (target === null || target === undefined) {
    diffs.push(`- ${path || "root"}: ${formatValue(base)}`);
    return diffs;
  }

  if (typeof base !== typeof target) {
    diffs.push(`- ${path || "root"}: ${formatValue(base)}`);
    diffs.push(`+ ${path || "root"}: ${formatValue(target)}`);
    return diffs;
  }

  if (Array.isArray(base) && Array.isArray(target)) {
    return compareArrays(base, target, path);
  }

  if (typeof base === "object" && typeof target === "object") {
    const baseObj = base as Record<string, unknown>;
    const targetObj = target as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(baseObj), ...Object.keys(targetObj)]);

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;

      if (!(key in baseObj)) {
        diffs.push(`+ ${newPath}: ${formatValue(targetObj[key])}`);
      } else if (!(key in targetObj)) {
        diffs.push(`- ${newPath}: ${formatValue(baseObj[key])}`);
      } else {
        diffs.push(...findJsonDifferences(baseObj[key], targetObj[key], newPath));
      }
    }
    return diffs;
  }

  if (base !== target) {
    diffs.push(`- ${path}: ${formatValue(base)}`);
    diffs.push(`+ ${path}: ${formatValue(target)}`);
  }

  return diffs;
}

/**
 * Compare arrays by finding items by their identity
 */
function compareArrays(base: unknown[], target: unknown[], path: string): string[] {
  const diffs: string[] = [];

  const baseItems = new Map<string, { item: unknown; index: number }>();
  const targetItems = new Map<string, { item: unknown; index: number }>();

  base.forEach((item, index) => {
    const key = getItemKey(item, index);
    baseItems.set(key, { item, index });
  });

  target.forEach((item, index) => {
    const key = getItemKey(item, index);
    targetItems.set(key, { item, index });
  });

  // Find removed items
  for (const [key, { item }] of baseItems) {
    if (!targetItems.has(key)) {
      diffs.push(`- ${path}[${key}]: ${formatValue(item)}`);
    }
  }

  // Find added items
  for (const [key, { item }] of targetItems) {
    if (!baseItems.has(key)) {
      diffs.push(`+ ${path}[${key}]: ${formatValue(item)}`);
    }
  }

  // Find modified items
  for (const [key, { item: baseItem }] of baseItems) {
    const targetEntry = targetItems.get(key);
    if (targetEntry) {
      diffs.push(...findJsonDifferences(baseItem, targetEntry.item, `${path}[${key}]`));
    }
  }

  return diffs;
}

/**
 * Get a unique key for an array item
 */
function getItemKey(item: unknown, index: number): string {
  if (item === null || item === undefined || typeof item !== "object") {
    return `#${index}`;
  }

  const obj = item as Record<string, unknown>;

  if (typeof obj.name === "string") return obj.name;
  if (typeof obj.uri === "string") return obj.uri;
  if (typeof obj.uriTemplate === "string") return obj.uriTemplate;
  if (typeof obj.method === "string") return obj.method;

  return `#${index}`;
}

/**
 * Format a value for display in diff output
 */
export function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  if (typeof value === "string") {
    if (value.length > 100) {
      return JSON.stringify(value.slice(0, 100) + "...");
    }
    return JSON.stringify(value);
  }

  if (typeof value === "object") {
    const json = JSON.stringify(value);
    if (json.length > 200) {
      return json.slice(0, 200) + "...";
    }
    return json;
  }

  return String(value);
}

/**
 * Convert DiffResult array to Map for backward compatibility
 */
export function diffsToMap(diffs: DiffResult[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const { endpoint, diff } of diffs) {
    map.set(endpoint, diff);
  }
  return map;
}

/**
 * MCP Server Probe
 *
 * Probes an MCP server and collects capability snapshots.
 */
import type { ProbeResult, CustomMessage } from "./types.js";
export interface ProbeOptions {
    transport: "stdio" | "streamable-http";
    command?: string;
    args?: string[];
    url?: string;
    headers?: Record<string, string>;
    workingDir?: string;
    envVars?: Record<string, string>;
    customMessages?: CustomMessage[];
}
/**
 * Probes an MCP server and returns capability snapshots
 */
export declare function probeServer(options: ProbeOptions): Promise<ProbeResult>;
/**
 * Normalize a probe result for comparison by sorting arrays recursively
 */
export declare function normalizeProbeResult(result: unknown): unknown;
/**
 * Convert probe result to a map of endpoint -> JSON string
 */
export declare function probeResultToFiles(result: ProbeResult): Map<string, string>;

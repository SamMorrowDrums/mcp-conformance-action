#!/usr/bin/env npx tsx
/**
 * MCP Probe Tool
 *
 * Probes an MCP server and saves capability snapshots to JSON files.
 * Supports both stdio and streamable-http transports.
 *
 * Usage:
 *   npx tsx mcp-probe.ts -transport stdio -command ./path/to/server -out ./output-dir
 *   npx tsx mcp-probe.ts -transport streamable-http -url http://localhost:8080/mcp -out ./output-dir
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import * as fs from "fs/promises";
import * as path from "path";

interface ProbeArgs {
  transport: "stdio" | "streamable-http";
  command?: string;
  args?: string[];
  url?: string;
  outDir: string;
}

function parseArgs(): ProbeArgs {
  const args = process.argv.slice(2);
  const result: Partial<ProbeArgs> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "-transport":
        result.transport = args[++i] as "stdio" | "streamable-http";
        break;
      case "-command":
        result.command = args[++i];
        break;
      case "-args":
        // Collect all remaining args after -args until next flag
        result.args = [];
        while (i + 1 < args.length && !args[i + 1].startsWith("-")) {
          result.args.push(args[++i]);
        }
        break;
      case "-url":
        result.url = args[++i];
        break;
      case "-out":
        result.outDir = args[++i];
        break;
    }
  }

  // Validation
  if (!result.transport) {
    console.error("Error: -transport is required (stdio or streamable-http)");
    process.exit(1);
  }
  if (!result.outDir) {
    console.error("Error: -out is required");
    process.exit(1);
  }
  if (result.transport === "stdio" && !result.command) {
    console.error("Error: -command is required for stdio transport");
    process.exit(1);
  }
  if (result.transport === "streamable-http" && !result.url) {
    console.error("Error: -url is required for streamable-http transport");
    process.exit(1);
  }

  return result as ProbeArgs;
}

async function saveJson(outDir: string, filename: string, data: unknown): Promise<void> {
  // Use output_ prefix for compatibility with conformance-test.sh
  const filepath = path.join(outDir, `output_${filename}`);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  console.error(`  Saved output_${filename}`);
}

async function probeServer(args: ProbeArgs): Promise<void> {
  // Create the client
  const client = new Client(
    {
      name: "mcp-probe",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  let transport: StdioClientTransport | StreamableHTTPClientTransport;

  // Create appropriate transport
  if (args.transport === "stdio") {
    console.error(`Connecting via stdio: ${args.command} ${(args.args || []).join(" ")}`);
    transport = new StdioClientTransport({
      command: args.command!,
      args: args.args || [],
    });
  } else {
    console.error(`Connecting via streamable-http: ${args.url}`);
    transport = new StreamableHTTPClientTransport(new URL(args.url!));
  }

  try {
    // Connect to the server
    await client.connect(transport);
    console.error("Connected successfully");

    // Ensure output directory exists
    await fs.mkdir(args.outDir, { recursive: true });

    // Get server info and capabilities from the initialize handshake
    const serverCapabilities = client.getServerCapabilities();
    const serverInfo = client.getServerVersion();

    // Save initialize response info
    const initializeInfo = {
      serverInfo,
      capabilities: serverCapabilities,
    };
    await saveJson(args.outDir, "initialize.json", initializeInfo);

    // Probe tools if supported
    if (serverCapabilities?.tools) {
      try {
        const toolsResult = await client.listTools();
        await saveJson(args.outDir, "tools.json", toolsResult);
      } catch (error) {
        console.error(`  Warning: Failed to list tools: ${error}`);
      }
    } else {
      console.error("  Server does not support tools");
    }

    // Probe prompts if supported
    if (serverCapabilities?.prompts) {
      try {
        const promptsResult = await client.listPrompts();
        await saveJson(args.outDir, "prompts.json", promptsResult);
      } catch (error) {
        console.error(`  Warning: Failed to list prompts: ${error}`);
      }
    } else {
      console.error("  Server does not support prompts");
    }

    // Probe resources if supported
    if (serverCapabilities?.resources) {
      try {
        const resourcesResult = await client.listResources();
        await saveJson(args.outDir, "resources.json", resourcesResult);
      } catch (error) {
        console.error(`  Warning: Failed to list resources: ${error}`);
      }
    } else {
      console.error("  Server does not support resources");
    }

    // Probe resource templates if supported (part of resources capability)
    if (serverCapabilities?.resources) {
      try {
        const templatesResult = await client.listResourceTemplates();
        await saveJson(args.outDir, "resource_templates.json", templatesResult);
      } catch (error) {
        console.error(`  Warning: Failed to list resource templates: ${error}`);
      }
    }

    console.error("Probe complete");

    // Close the connection
    await transport.close();

    // Print success for the shell script to detect
    console.log("SUCCESS");
  } catch (error) {
    console.error(`Error probing server: ${error}`);
    // Try to close transport on error
    try {
      await transport.close();
    } catch {
      // Ignore close errors
    }
    process.exit(1);
  }
}

// Run
const args = parseArgs();
probeServer(args).catch((error) => {
  console.error(`Fatal error: ${error}`);
  process.exit(1);
});

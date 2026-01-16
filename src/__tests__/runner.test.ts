import { parseHeaders, parseConfigurations } from "../runner.js";
import { normalizeProbeResult } from "../probe.js";

describe("parseHeaders", () => {
  it("returns empty object for empty input", () => {
    expect(parseHeaders("")).toEqual({});
    expect(parseHeaders("  ")).toEqual({});
  });

  it("parses JSON object format", () => {
    const input = '{"Authorization": "Bearer token123", "X-Custom": "value"}';
    const result = parseHeaders(input);
    expect(result).toEqual({
      Authorization: "Bearer token123",
      "X-Custom": "value",
    });
  });

  it("parses colon-separated header format", () => {
    const input = `Authorization: Bearer token123
X-Custom: value`;
    const result = parseHeaders(input);
    expect(result).toEqual({
      Authorization: "Bearer token123",
      "X-Custom": "value",
    });
  });

  it("handles headers with colons in values", () => {
    const input = "X-Timestamp: 2024:01:15:12:00:00";
    const result = parseHeaders(input);
    expect(result).toEqual({
      "X-Timestamp": "2024:01:15:12:00:00",
    });
  });

  it("skips empty lines in colon-separated format", () => {
    const input = `Authorization: Bearer token

X-Custom: value`;
    const result = parseHeaders(input);
    expect(result).toEqual({
      Authorization: "Bearer token",
      "X-Custom": "value",
    });
  });

  it("trims whitespace from header names and values", () => {
    const input = "  Authorization  :   Bearer token  ";
    const result = parseHeaders(input);
    expect(result).toEqual({
      Authorization: "Bearer token",
    });
  });

  it("returns empty object for invalid JSON that doesn't look like headers", () => {
    const input = "not valid headers or json";
    const result = parseHeaders(input);
    expect(result).toEqual({});
  });
});

describe("parseConfigurations", () => {
  const defaultTransport = "stdio" as const;
  const defaultCommand = "node server.js";
  const defaultUrl = "http://localhost:3000/mcp";

  it("returns default config when input is empty", () => {
    const result = parseConfigurations("", defaultTransport, defaultCommand, defaultUrl);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "default",
      transport: "stdio",
      start_command: "node server.js",
      server_url: undefined,
    });
  });

  it("returns default config when input is empty array", () => {
    const result = parseConfigurations("[]", defaultTransport, defaultCommand, defaultUrl);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("default");
  });

  it("applies transport default to configs without transport", () => {
    const input = JSON.stringify([
      { name: "test1", args: "--read-only" },
      { name: "test2", args: "--dynamic" },
    ]);
    const result = parseConfigurations(input, defaultTransport, defaultCommand, defaultUrl);

    expect(result).toHaveLength(2);
    expect(result[0].transport).toBe("stdio");
    expect(result[1].transport).toBe("stdio");
  });

  it("applies start_command default to stdio configs without start_command", () => {
    const input = JSON.stringify([
      { name: "test1", args: "--read-only" },
      { name: "test2", start_command: "custom command" },
    ]);
    const result = parseConfigurations(input, defaultTransport, defaultCommand, defaultUrl);

    expect(result[0].start_command).toBe("node server.js");
    expect(result[1].start_command).toBe("custom command");
  });

  it("applies server_url default to http configs without server_url", () => {
    const input = JSON.stringify([
      { name: "test1", transport: "streamable-http" },
      { name: "test2", transport: "streamable-http", server_url: "http://custom:8080/mcp" },
    ]);
    const result = parseConfigurations(input, defaultTransport, defaultCommand, defaultUrl);

    expect(result[0].server_url).toBe("http://localhost:3000/mcp");
    expect(result[1].server_url).toBe("http://custom:8080/mcp");
  });

  it("preserves explicit transport values", () => {
    const input = JSON.stringify([
      { name: "stdio-test", transport: "stdio", start_command: "node server.js" },
      { name: "http-test", transport: "streamable-http", server_url: "http://localhost:3000" },
    ]);
    const result = parseConfigurations(input, defaultTransport, defaultCommand, defaultUrl);

    expect(result[0].transport).toBe("stdio");
    expect(result[1].transport).toBe("streamable-http");
  });

  it("handles github-mcp-server style configs (name + args only)", () => {
    const input = JSON.stringify([
      { name: "default", args: "" },
      { name: "read-only", args: "--read-only" },
      { name: "dynamic-toolsets", args: "--dynamic-toolsets" },
    ]);
    const result = parseConfigurations(input, "stdio", "go run ./cmd/server stdio", defaultUrl);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      name: "default",
      transport: "stdio",
      start_command: "go run ./cmd/server stdio",
    });
    expect(result[1]).toMatchObject({
      name: "read-only",
      transport: "stdio",
      start_command: "go run ./cmd/server stdio",
      args: "--read-only",
    });
  });
});

describe("normalizeProbeResult", () => {
  it("returns null/undefined as-is", () => {
    expect(normalizeProbeResult(null)).toBe(null);
    expect(normalizeProbeResult(undefined)).toBe(undefined);
  });

  it("returns primitives as-is", () => {
    expect(normalizeProbeResult("hello")).toBe("hello");
    expect(normalizeProbeResult(123)).toBe(123);
    expect(normalizeProbeResult(true)).toBe(true);
  });

  it("sorts object keys alphabetically", () => {
    const input = { zebra: 1, apple: 2, mango: 3 };
    const result = normalizeProbeResult(input);
    const keys = Object.keys(result as object);
    expect(keys).toEqual(["apple", "mango", "zebra"]);
  });

  it("sorts nested object keys", () => {
    const input = {
      outer: {
        zebra: 1,
        apple: 2,
      },
    };
    const result = normalizeProbeResult(input) as { outer: object };
    const nestedKeys = Object.keys(result.outer);
    expect(nestedKeys).toEqual(["apple", "zebra"]);
  });

  it("sorts arrays by JSON string representation", () => {
    const input = [
      { name: "zebra", value: 1 },
      { name: "apple", value: 2 },
    ];
    const result = normalizeProbeResult(input) as Array<{ name: string }>;
    expect(result[0].name).toBe("apple");
    expect(result[1].name).toBe("zebra");
  });

  it("handles embedded JSON in text fields", () => {
    const embeddedJson = JSON.stringify({ zebra: 1, apple: 2 });
    const input = {
      content: [{ type: "text", text: embeddedJson }],
    };
    const result = normalizeProbeResult(input) as {
      content: Array<{ text: string }>;
    };
    // The embedded JSON should be normalized (keys sorted)
    const parsed = JSON.parse(result.content[0].text);
    const keys = Object.keys(parsed);
    expect(keys).toEqual(["apple", "zebra"]);
  });

  it("handles embedded JSON arrays in text fields", () => {
    const embeddedJson = JSON.stringify([{ name: "zebra" }, { name: "apple" }]);
    const input = {
      content: [{ type: "text", text: embeddedJson }],
    };
    const result = normalizeProbeResult(input) as {
      content: Array<{ text: string }>;
    };
    // The embedded JSON array should be normalized and sorted
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed[0].name).toBe("apple");
    expect(parsed[1].name).toBe("zebra");
  });

  it("leaves non-JSON text fields unchanged", () => {
    const input = {
      content: [{ type: "text", text: "Hello, world!" }],
    };
    const result = normalizeProbeResult(input) as {
      content: Array<{ text: string }>;
    };
    expect(result.content[0].text).toBe("Hello, world!");
  });

  it("produces consistent JSON output regardless of input key order", () => {
    const input1 = { z: 1, a: 2, m: { x: 1, b: 2 } };
    const input2 = { a: 2, m: { b: 2, x: 1 }, z: 1 };

    const result1 = JSON.stringify(normalizeProbeResult(input1));
    const result2 = JSON.stringify(normalizeProbeResult(input2));

    expect(result1).toBe(result2);
  });
});

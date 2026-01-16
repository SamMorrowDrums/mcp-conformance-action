import { parseHeaders, parseConfigurations } from "../runner.js";

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

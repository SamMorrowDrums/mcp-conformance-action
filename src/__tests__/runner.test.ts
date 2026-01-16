import { parseHeaders } from "../runner.js";

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

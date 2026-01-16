# MCP Conformance Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-MCP%20Conformance%20Test-blue?logo=github)](https://github.com/marketplace/actions/mcp-conformance-test)
[![GitHub release](https://img.shields.io/github/v/release/SamMorrowDrums/mcp-conformance-action)](https://github.com/SamMorrowDrums/mcp-conformance-action/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A GitHub Action for testing [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server conformance between versions. This action detects behavioral changes in your MCP server by comparing the current branch against a base reference, helping you catch unintended regressions and document intentional API changes.

## Overview

MCP servers expose tools, resources, and prompts to AI assistants. As these servers evolve, it's critical to understand how changes affect their external behavior. This action automates conformance testing by:

1. Building your MCP server from both the current branch and a baseline (merge-base, tag, or specified ref)
2. Sending identical MCP protocol requests to both versions
3. Comparing responses and generating a detailed diff report
4. Surfacing results directly in GitHub's Job Summary

The action is **language-agnostic**—it executes whatever install, build, and start commands you provide.

## Quick Start

Create `.github/workflows/conformance.yml` in your repository:

```yaml
name: Conformance Test

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
    tags: ['v*']

permissions:
  contents: read

jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: SamMorrowDrums/mcp-conformance-action@v1
        with:
          install_command: "npm ci"
          build_command: "npm run build"
          start_command: "node dist/stdio.js"
```

## Language Examples

### Go

```yaml
jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-go@v5
        with:
          go-version-file: 'go.mod'

      - uses: SamMorrowDrums/mcp-conformance-action@v1
        with:
          install_command: "go mod download"
          build_command: "go build -o bin/server ./cmd/stdio"
          start_command: "./bin/server"
```

### Python

```yaml
jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - uses: SamMorrowDrums/mcp-conformance-action@v1
        with:
          install_command: "pip install -e ."
          start_command: "python -m my_mcp_server"
```

### TypeScript / Node.js

```yaml
jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: SamMorrowDrums/mcp-conformance-action@v1
        with:
          install_command: "npm ci"
          build_command: "npm run build"
          start_command: "node dist/stdio.js"
```

### Rust

```yaml
jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: dtolnay/rust-toolchain@stable

      - uses: SamMorrowDrums/mcp-conformance-action@v1
        with:
          install_command: "cargo fetch"
          build_command: "cargo build --release"
          start_command: "./target/release/my-mcp-server"
```

### C# / .NET

```yaml
jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - uses: SamMorrowDrums/mcp-conformance-action@v1
        with:
          install_command: "dotnet restore"
          build_command: "dotnet build -c Release"
          start_command: "dotnet run --no-build -c Release"
```

## Testing Multiple Transports

Test both stdio and HTTP transports in a single run using the `configurations` input:

```yaml
- uses: SamMorrowDrums/mcp-conformance-action@v1
  with:
    install_command: "npm ci"
    build_command: "npm run build"
    configurations: |
      [
        {
          "name": "stdio",
          "transport": "stdio",
          "start_command": "node dist/stdio.js"
        },
        {
          "name": "streamable-http",
          "transport": "streamable-http",
          "start_command": "node dist/http.js",
          "server_url": "http://localhost:3000/mcp"
        }
      ]
```

## Inputs Reference

### Required Inputs

| Input | Description |
|-------|-------------|
| `install_command` | Command to install dependencies (e.g., `npm ci`, `pip install -e .`, `go mod download`) |

### Server Configuration

| Input | Description | Default |
|-------|-------------|---------|
| `build_command` | Command to build the server. Optional for interpreted languages. | `""` |
| `start_command` | Command to start the server for stdio transport | `""` |
| `transport` | Transport type: `stdio` or `streamable-http` | `stdio` |
| `server_url` | Server URL for HTTP transport (e.g., `http://localhost:3000/mcp`) | `""` |
| `configurations` | JSON array of test configurations for testing multiple transports | `""` |
| `server_timeout` | Timeout in seconds to wait for server response | `10` |
| `env_vars` | Environment variables as newline-separated `KEY=VALUE` pairs | `""` |

Either `start_command` (for stdio) or `server_url` (for HTTP) must be provided, unless using `configurations`.

### Comparison Configuration

| Input | Description | Default |
|-------|-------------|---------|
| `compare_ref` | Git ref to compare against. Auto-detects merge-base on PRs or previous tag on tag pushes if not specified. | `""` |

### Configuration Object Schema

When using `configurations`, each object supports:

| Field | Description | Required |
|-------|-------------|----------|
| `name` | Identifier for this configuration (appears in report) | Yes |
| `transport` | `stdio` or `streamable-http` | No (default: `stdio`) |
| `start_command` | Server start command | Yes (unless using external server) |
| `server_url` | URL for HTTP transport | Required if transport is `streamable-http` |
| `env_vars` | Additional environment variables | No |

## How It Works

### Execution Flow

1. **Baseline Detection**: Determines the comparison ref:
   - For pull requests: merge-base with target branch
   - For tag pushes: previous tag (e.g., `v1.1.0` compares against `v1.0.0`)
   - Explicit: uses `compare_ref` if provided
2. **Build Baseline**: Creates a git worktree at the baseline ref and builds the server
3. **Build Current**: Builds the server from the current branch
4. **Conformance Testing**: Sends MCP protocol requests to both servers:
   - `initialize` - Server capabilities and metadata
   - `tools/list` - Available tools and their schemas
   - `resources/list` - Available resources
   - `prompts/list` - Available prompts
5. **Report Generation**: Produces a Markdown report with diffs, uploaded as an artifact and displayed in Job Summary

### What Gets Compared

The action compares JSON responses from both server versions for each MCP method. Differences appear as unified diffs in the report. Common expected differences include:

- New tools, resources, or prompts added
- Schema changes (new parameters, updated descriptions)
- Capability changes (new features enabled)
- Version string updates

## Transport Support

### stdio Transport

The default transport communicates with your server via stdin/stdout using JSON-RPC:

```yaml
- uses: SamMorrowDrums/mcp-conformance-action@v1
  with:
    install_command: "npm ci"
    build_command: "npm run build"
    start_command: "node dist/stdio.js"
```

### Streamable HTTP Transport

For servers exposing an HTTP endpoint:

```yaml
- uses: SamMorrowDrums/mcp-conformance-action@v1
  with:
    install_command: "npm ci"
    build_command: "npm run build"
    start_command: "node dist/http.js"
    transport: "streamable-http"
    server_url: "http://localhost:3000/mcp"
```

The action will:
1. Start the server using `start_command`
2. Poll the endpoint until it responds (up to `server_timeout` seconds)
3. Send MCP requests via HTTP POST
4. Terminate the server after tests complete

For pre-deployed servers, omit `start_command`:

```yaml
- uses: SamMorrowDrums/mcp-conformance-action@v1
  with:
    install_command: "true"
    transport: "streamable-http"
    server_url: "https://mcp.example.com/api"
```

## Version Comparison Strategies

### Pull Requests

On pull requests, the action automatically compares against the merge-base with the target branch. This shows exactly what changes the PR introduces.

### Tag Releases

When triggered by a tag push matching `v*`, the action finds the previous tag and compares against it:

```yaml
on:
  push:
    tags: ['v*']

# v1.2.0 will automatically compare against v1.1.0
```

### Explicit Baseline

Specify any git ref to compare against:

```yaml
- uses: SamMorrowDrums/mcp-conformance-action@v1
  with:
    install_command: "npm ci"
    compare_ref: "v1.0.0"
    start_command: "node dist/stdio.js"
```

## Artifacts and Reports

The action produces:

1. **Job Summary**: Inline Markdown report in the GitHub Actions UI showing test results and diffs
2. **Artifact**: `conformance-report` artifact containing `CONFORMANCE_REPORT.md` for download or further processing

## Recommended Workflow

```yaml
name: Conformance Test

on:
  workflow_dispatch:
  pull_request:
    branches: [main]
  push:
    branches: [main]
    tags: ['v*']

permissions:
  contents: read

jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: SamMorrowDrums/mcp-conformance-action@v1
        with:
          install_command: "npm ci"
          build_command: "npm run build"
          configurations: |
            [
              {
                "name": "stdio",
                "transport": "stdio",
                "start_command": "node dist/stdio.js"
              },
              {
                "name": "streamable-http",
                "transport": "streamable-http",
                "start_command": "node dist/http.js",
                "server_url": "http://localhost:3000/mcp"
              }
            ]
```

## Troubleshooting

### Server fails to start

- Check that `start_command` works locally
- Increase `server_timeout` for slow-starting servers
- Verify all dependencies are installed by `install_command`

### Missing baseline

- Ensure `fetch-depth: 0` in your checkout step
- For new repositories, the first run may fail (no baseline exists)

### HTTP transport connection refused

- Verify `server_url` matches your server's listen address
- Ensure the server binds to `0.0.0.0` or `127.0.0.1`, not just `localhost` on some systems
- Check firewall or container networking if running in Docker

## License

MIT License. See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Related Resources

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [MCP Go SDK](https://github.com/modelcontextprotocol/go-sdk)

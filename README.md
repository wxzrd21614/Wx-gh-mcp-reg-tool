# Wx GitHub MCP Registry Tool

> **MCP Server for searching and installing servers from the GitHub modelcontextprotocol/servers registry**

GitHub and the Model Context Protocol team created an amazing registry of 2000+ MCP servers, but forgot to provide a way to search and install them programmatically. This tool fixes that gap.

## Why This Exists

- ✅ **Search 2000+ MCP servers** from the official GitHub registry
- ✅ **Autonomous installation** - CLI can install servers without manual config editing
- ✅ **Category filtering** - Official integrations vs community servers
- ✅ **Pagination support** - Browse through all available servers

## Installation

### For GitHub Copilot CLI

Add to your `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "wx-gh-registry": {
      "type": "local",
      "command": "node",
      "args": ["path/to/Wx-gh-mcp-reg-tool/index.js"],
      "tools": []
    }
  },
  "alwaysAllow": [
    {"server": "wx-gh-registry", "tool": "search_github_mcp_servers"},
    {"server": "wx-gh-registry", "tool": "list_all_github_mcp_servers"},
    {"server": "wx-gh-registry", "tool": "install_mcp_server"}
  ]
}
```

### Manual Installation

```bash
git clone https://github.com/YOUR_USERNAME/Wx-gh-mcp-reg-tool.git
cd Wx-gh-mcp-reg-tool
npm install
```

## Tools

### 1. `search_github_mcp_servers`
Search for MCP servers by keyword.

**Parameters:**
- `query` (required): Search term (e.g., "playwright", "database")
- `limit` (optional): Max results (default: 10, max: 50)
- `category` (optional): Filter by "official", "community", or "all" (default)

**Example:**
```
Search for 'playwright' servers in the GitHub registry
```

### 2. `list_all_github_mcp_servers`
List all available servers with pagination.

**Parameters:**
- `limit` (optional): Results per page (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `category` (optional): Filter by "official", "community", or "all"

**Example:**
```
List the first 50 MCP servers from the GitHub registry
```

### 3. `install_mcp_server`
Autonomously install an MCP server to your config.

**Parameters:**
- `server_name` (required): Name of the server (e.g., "playwright")
- `github_url` (required): GitHub URL (e.g., "https://github.com/microsoft/playwright-mcp")
- `config_name` (optional): Custom name in config (default: uses server_name)

**Example:**
```
Install the Playwright server from https://github.com/microsoft/playwright-mcp
```

## Usage with GitHub Copilot CLI

Once configured, you can use natural language:

```
> Search for database servers in the MCP registry

> List all official MCP servers

> Install the Playwright server from the results
```

The CLI will autonomously call the tools and install servers without manual intervention.

## How It Works

1. **Fetches** the latest README from github.com/modelcontextprotocol/servers
2. **Parses** markdown list format to extract ~2000 servers
3. **Searches** through names and descriptions
4. **Installs** by generating correct npx/npm commands and updating mcp-config.json

## Requirements

- **Node.js** ≥18.0.0
- **GitHub Copilot CLI** with MCP support

## License

MIT

## Credits

Created because GitHub forgot to provide this functionality natively 🤷

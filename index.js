#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const GITHUB_README_URL = 'https://raw.githubusercontent.com/modelcontextprotocol/servers/main/README.md';

class GitHubServersSearchServer {
  constructor() {
    this.server = new Server(
      {
        name: 'wx-gh-mcp-reg-tool',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_github_mcp_servers',
          description: 'Search the official GitHub modelcontextprotocol/servers repository README for MCP servers. Searches through 2000+ community and official servers including names, descriptions, and links.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g., "playwright", "database", "kubernetes"). Searches server names and descriptions.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10, max: 50)',
                default: 10,
              },
              category: {
                type: 'string',
                description: 'Filter by category: "official" for official integrations, "community" for community servers, or "all" (default)',
                enum: ['official', 'community', 'all'],
                default: 'all',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'list_all_github_mcp_servers',
          description: 'List all available MCP servers from the GitHub repository with pagination support.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Number of servers to return (default: 20, max: 100)',
                default: 20,
              },
              offset: {
                type: 'number',
                description: 'Number of servers to skip for pagination (default: 0)',
                default: 0,
              },
              category: {
                type: 'string',
                description: 'Filter by category: "official", "community", or "all" (default)',
                enum: ['official', 'community', 'all'],
                default: 'all',
              },
            },
          },
        },
        {
          name: 'install_mcp_server',
          description: 'Install an MCP server by adding it to the mcp-config.json file. Generates the correct configuration based on the server name.',
          inputSchema: {
            type: 'object',
            properties: {
              server_name: {
                type: 'string',
                description: 'The name of the server to install (e.g., "playwright", "github", "postgres")',
              },
              github_url: {
                type: 'string',
                description: 'The GitHub URL of the server (e.g., "https://github.com/microsoft/playwright-mcp")',
              },
              config_name: {
                type: 'string',
                description: 'What to name this server in the config (default: uses server_name)',
              },
            },
            required: ['server_name', 'github_url'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'search_github_mcp_servers') {
        return await this.handleSearch(request.params.arguments);
      } else if (request.params.name === 'list_all_github_mcp_servers') {
        return await this.handleList(request.params.arguments);
      } else if (request.params.name === 'install_mcp_server') {
        return await this.handleInstall(request.params.arguments);
      }
      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  async fetchReadme() {
    try {
      const response = await fetch(GITHUB_README_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch README: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      throw new Error(`Error fetching GitHub README: ${error.message}`);
    }
  }

  parseServers(readme) {
    const servers = [];
    
    // Regular expression to match server entries in markdown list format
    // Matches: • [Name](url) - Description
    const serverRegex = /^•\s+\[([^\]]+)\]\(([^)]+)\)(?:\s*-\s*(.+))?$/gm;
    
    let match;
    
    // Split by sections to identify official vs community
    const officialSection = readme.match(/### 🎖️ Official Integrations([\s\S]*?)###/);
    const communitySection = readme.match(/### 🌎 Community Servers([\s\S]*?)##\s+📚 Resources/);
    
    if (officialSection) {
      let text = officialSection[1];
      while ((match = serverRegex.exec(text)) !== null) {
        servers.push({
          name: match[1].trim(),
          url: match[2].trim(),
          description: match[3]?.trim() || 'No description available',
          category: 'official',
        });
      }
    }
    
    if (communitySection) {
      let text = communitySection[1];
      while ((match = serverRegex.exec(text)) !== null) {
        servers.push({
          name: match[1].trim(),
          url: match[2].trim(),
          description: match[3]?.trim() || 'No description available',
          category: 'community',
        });
      }
    }
    
    return servers;
  }

  async handleSearch(args) {
    const query = args.query.toLowerCase();
    const limit = Math.min(args.limit || 10, 50);
    const category = args.category || 'all';

    const readme = await this.fetchReadme();
    const allServers = this.parseServers(readme);
    
    // Filter by category
    let servers = allServers;
    if (category !== 'all') {
      servers = servers.filter(s => s.category === category);
    }

    // Search in name and description
    const results = servers.filter(server => 
      server.name.toLowerCase().includes(query) || 
      server.description.toLowerCase().includes(query)
    ).slice(0, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query,
            total_results: results.length,
            showing: Math.min(results.length, limit),
            category_filter: category,
            servers: results.map(server => ({
              name: server.name,
              url: server.url,
              description: server.description,
              category: server.category,
              installation: this.getInstallationInfo(server),
            })),
          }, null, 2),
        },
      ],
    };
  }

  async handleList(args) {
    const limit = Math.min(args.limit || 20, 100);
    const offset = args.offset || 0;
    const category = args.category || 'all';

    const readme = await this.fetchReadme();
    const allServers = this.parseServers(readme);
    
    // Filter by category
    let servers = allServers;
    if (category !== 'all') {
      servers = servers.filter(s => s.category === category);
    }

    const paginatedServers = servers.slice(offset, offset + limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total_servers: servers.length,
            showing: paginatedServers.length,
            offset,
            limit,
            category_filter: category,
            has_more: offset + limit < servers.length,
            servers: paginatedServers.map(server => ({
              name: server.name,
              url: server.url,
              description: server.description,
              category: server.category,
              installation: this.getInstallationInfo(server),
            })),
          }, null, 2),
        },
      ],
    };
  }

  getInstallationInfo(server) {
    // Extract package name from GitHub URL or description
    const githubMatch = server.url.match(/github\.com\/([^/]+)\/([^/]+)/);
    
    if (githubMatch) {
      const [, owner, repo] = githubMatch;
      
      // Common patterns for npm packages
      if (server.name.toLowerCase().includes('playwright') && owner === 'microsoft') {
        return {
          type: 'npm',
          command: 'npx @playwright/mcp@latest',
          config_example: {
            command: 'npx',
            args: ['@playwright/mcp@latest']
          }
        };
      }
      
      // Default npm installation guess
      return {
        type: 'npm',
        command: `npx -y ${repo}@latest`,
        github: `${owner}/${repo}`,
        config_example: {
          command: 'npx',
          args: ['-y', `${repo}@latest`]
        }
      };
    }
    
    return {
      type: 'unknown',
      message: 'Check the GitHub repository for installation instructions',
      url: server.url
    };
  }

  async handleInstall(args) {
    const { server_name, github_url, config_name } = args;
    const configPath = process.env.USERPROFILE + '\\.copilot\\mcp-config.json';
    const fs = await import('fs/promises');
    
    try {
      // Read existing config
      let config;
      try {
        const configData = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(configData);
      } catch (err) {
        // If file doesn't exist, create new config
        config = { mcpServers: {}, alwaysAllow: [] };
      }
      
      // Extract owner/repo from GitHub URL
      const githubMatch = github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!githubMatch) {
        throw new Error('Invalid GitHub URL format');
      }
      
      const [, owner, repo] = githubMatch;
      const name = config_name || server_name;
      
      // Generate config based on common patterns
      let serverConfig;
      if (owner === 'microsoft' && repo === 'playwright-mcp') {
        serverConfig = {
          type: 'local',
          command: 'npx',
          args: ['@playwright/mcp@latest'],
          tools: []
        };
      } else {
        // Default pattern
        serverConfig = {
          type: 'local',
          command: 'npx',
          args: ['-y', `${repo}@latest`],
          tools: []
        };
      }
      
      // Add server to config
      config.mcpServers[name] = serverConfig;
      
      // Write config back
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Successfully installed ${server_name} as "${name}"`,
              config_path: configPath,
              server_config: serverConfig,
              note: 'You may need to restart your CLI client for changes to take effect',
              github: `${owner}/${repo}`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              config_path: configPath,
            }, null, 2),
          },
        ],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GitHub MCP Registry Tool running on stdio');
  }
}

const server = new GitHubServersSearchServer();
server.run().catch(console.error);

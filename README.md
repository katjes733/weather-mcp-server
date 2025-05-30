# MCP Server Sample Project

This is a sample project for the Model Context Protocol (MCP) server using Bun.

- [MCP Server Sample Project](#mcp-server-sample-project)
  - [Background](#background)
  - [Prerequisites](#prerequisites)
  - [Setup Project](#setup-project)
  - [Build](#build)
  - [Setup Claude Desktop](#setup-claude-desktop)
  - [Usage](#usage)

## Background

It demonstrates how to set up a basic server that can handle tool requests and execute them. It supports adding two numbers and includes a system prompt guiding the LLM to handles the request appropriately.

## Prerequisites

1. [Bun](https://bun.sh/docs/installation#installing) must be installed.
2. [Claude Desktop](https://claude.ai/download) should be installed.

## Setup Project

1. Run:

   ```sh
   bun install
   ```

2. _(Optional)_ Run the following to verify integrity of the project:

   ```sh
   bun run verify
   ```

## Build

1. Run:

   ```sh
   bun run build
   ```

This will bundle all code into a single `build/main.js` that can be consumed.

## Setup Claude Desktop

This section is influenced by this general [guide](https://modelcontextprotocol.io/quickstart/user) with specifics for this use case.

1. Start Claude Desktop and open Settings (**not** Account setting).
2. Click on `Developer` in the left-hand bar of the Settings pane, and then click on `Edit Config`.
3. Edit the file `claude_desktop_config.json` and add the following:

   ```json
   {
     "mcpServers": {
       "<sample-mcp-app>": {
         "command": "bun",
         "args": ["run", "<path_to_project>/build/main.js"]
       }
     }
   }
   ```

   - Replace <sample-mcp-app> with the name of your MCP Server: e.g. `my-mcp-server`
   - Replace <path_to_project> with the path to your project; e.g.: `/Users/username/Documents/projects/create-mcp-server-app-bun`

4. Restart Claude Desktop; this is important as Claude Desktop will otherwise not apply changes to `claude_desktop_config.json`.
5. On the main screen, click the `Search and Tools` button and then on your MCP server name. Ensure that it is enabled.

## Usage

1. You can start by simply asking Claude to add two numbers: `add 2 and 3`, which outputs the corresponding result.
2. You can also ask Claude to add two numbers: `add numbers`. This will trigger a follow-up request to provide the two numbers. Once provided, the response will contain the corresponding result.

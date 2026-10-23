<div align="center">

# ⏰ Pocket Reminders for Claude

**A tiny local MCP server that gives Claude a to-do list that survives between chats.**

`TypeScript` · `Model Context Protocol` · `Local-first` · `MIT`

</div>

---

## Why this exists

Chats with Claude start from a blank slate. Pocket Reminders adds a small
persistent queue that Claude can write to and read from, so you can say
*"remind me to review the budget tomorrow"* in one conversation and have
Claude surface it in the next.

Everything runs on your own computer. No accounts, no cloud, no network calls.

## What Claude can do with it

| Tool | What it does |
|------|--------------|
| `remind_me` | Save a reminder with a priority of `high`, `normal` or `low` |
| `check_reminders` | List active reminders, urgent first, optionally filtered by priority |
| `complete_reminder` | Mark an item as done |
| `delete_reminder` | Remove an item entirely |
| `move_to_notes` | Export an item to a Markdown note file and retire it from the queue |
| `clear_old_reminders` | Purge finished or exported items older than N days (default 7) |
| `help` | Print built-in usage instructions |

Reminders are ordered by priority first, then oldest to newest.

## Requirements

- Node.js **18 or newer**
- Claude Desktop (or any MCP client that can launch a local stdio server)

> The browser version of claude.ai cannot launch local servers, so use the
> desktop app or a client such as Claude Code.

## Installation

### The fast way

```bash
git clone <your-repo-url>
cd <repo-folder>
node setup.mjs
```

The setup script installs packages, compiles the TypeScript, and adds the
server to your Claude Desktop config. A backup of the old config is kept next
to it. If your config file contains invalid JSON, the script stops and prints
the snippet for you to add by hand.

### The manual way

1. Install and compile:
   ```bash
   npm install
   npm run build
   ```
2. In Claude Desktop open **Settings → Developer → Edit Config** and add:
   ```json
   {
     "mcpServers": {
       "reminders": {
         "command": "node",
         "args": ["/absolute/path/to/this/repo/dist/index.js"]
       }
     }
   }
   ```
3. Quit Claude Desktop completely (use the tray or menu bar icon, not just the
   window close button) and start it again.

### Windows notes

- Use forward slashes in paths: `"F:/Projects/pocket-reminders/dist/index.js"`.
- If Claude cannot find Node, put the full path in `command`. Find it with
  `where.exe node`, for example `"C:/Program Files/nodejs/node.exe"`.

### Claude Code

```bash
claude mcp add reminders node /absolute/path/to/this/repo/dist/index.js
```

## Trying it out

Once Claude restarts, try prompts like:

- "Remind me to renew my passport, high priority."
- "What reminders do I have?"
- "Show only my high priority reminders."
- "Mark the passport reminder as done."
- "Save the passport reminder to my notes with the comment 'bring old passport'."
- "Clear anything finished more than 14 days ago."

## Where your data lives

| Data | Location |
|------|----------|
| Reminder queue | `~/.claude_reminders.json` (your home folder) |
| Exported notes | `~/Documents/Obsidian/Brain/Reminders/` as `.md` files |

The export folder is defined in `src/index.ts` inside `moveToNotes`. Change the
path there and run `npm run build` if you want notes saved elsewhere.

Each reminder is stored with an id, text, priority, creation time and status
(`active`, `completed` or `moved`).

## Troubleshooting

**Claude says the server could not start**
1. Run `node dist/index.js` in the project folder. You should see
   `mcp-reminders MCP server running on stdio`. Press Ctrl+C to stop it.
2. If that works, the issue is the config. Check the absolute path, switch
   `command` to the full Node path, and make sure the JSON is valid.
3. Read the log: `~/Library/Logs/Claude/mcp-server-reminders.log` on macOS or
   `%APPDATA%\Claude\logs\mcp-server-reminders.log` on Windows.

**Tools do not appear**
Claude was probably not fully quit. Exit from the tray or menu bar and reopen.

**`dist/` is missing**
Run `npm run build`.

**Testing interactively**
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Development

```bash
npm run dev     # compile and launch
npm run build   # compile only
npm run lint    # check code style
```

Source lives in `src/index.ts`. Compiled output goes to `dist/` and is not
committed.

## Contributing

Issues and pull requests are welcome. Please keep changes small and focused,
and describe how you tested them.

## License

Released under the MIT License.

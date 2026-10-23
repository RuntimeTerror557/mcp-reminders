<div align="center">

# ⏰ Pocket Reminders

**A tiny to-do list you can talk to, with two front doors: Claude (via MCP) and Alexa.**

`TypeScript` · `Node.js` · `Model Context Protocol` · `Alexa Custom Skill` · `MIT`

</div>

---

## Why this exists

Chats with Claude start from a blank slate. Pocket Reminders adds a small
persistent queue that Claude can write to and read from, so you can say
*"remind me to review the budget tomorrow"* in one conversation and have
Claude surface it in the next.

The same idea is also available as an **Alexa skill**, so you can say
*"Alexa, open pocket reminders"* and *"remind me to renew my passport"*
hands-free.

The project has two independent parts:

| Part | File | Runs where | Storage |
|------|------|------------|---------|
| **Claude MCP server** | `src/index.ts` | Your own computer (stdio) | `~/.claude_reminders.json` |
| **Alexa skill** | `alexa.js` | Alexa-Hosted (AWS Lambda) | Amazon S3, one record per Alexa user |

> **The two parts do not share data.** Reminders you add by voice appear only
> in the Alexa skill, and reminders you give Claude appear only in the MCP
> server. See [Keeping the two in sync](#keeping-the-two-in-sync).

The MCP server is fully local: no accounts, no cloud, no network calls. The
Alexa skill is the opposite by nature, since it runs on Amazon's
infrastructure and stores reminders in the S3 bucket that Alexa-Hosted
provides for your skill.

---

# Part 1: Claude (MCP server)

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

Each reminder is stored with an id, text (`content`), priority, creation time
and status (`active`, `completed` or `moved`).

---

# Part 2: Alexa skill

The whole skill lives in a single file, `alexa.js`. It includes the request
handlers, the storage layer and, in a comment at the bottom, the interaction
model JSON you paste into the Alexa console.

## What you can say

The invocation name is **"pocket reminders"**.

| Intent | Example phrases |
|--------|-----------------|
| Open the skill | "Alexa, open pocket reminders" |
| Add a reminder | "remind me to renew my passport" · "add a reminder to call the bank" · "add reminder buy milk" |
| Add with priority | "add a high priority reminder to call the bank" · "set a low priority reminder to water the plants" · "create a high priority reminder to pay rent" |
| List reminders | "what are my reminders" · "read my reminders" · "list my reminders" · "check my reminders" · "what do I need to do" |
| Complete one | "complete reminder 2" · "mark reminder 2 as done" · "finish reminder 2" · "mark number 2 done" |
| Delete one | "delete reminder 3" · "remove reminder 3" · "delete number 3" |
| Clear finished | "clear completed reminders" · "clear finished reminders" · "clean up my reminders" |
| Help / exit | "help" · "stop" · "cancel" · "no" |

Priorities are `high`, `normal` (the default) and `low`. Spoken synonyms are
mapped for you: *urgent, important, top, critical* mean high; *medium, regular,
standard* mean normal; *minor, whenever, unimportant* mean low.

### How the list and numbers work

- Alexa reads your **active** reminders, high priority first, then oldest to
  newest, up to **10** at a time. If you have more, she tells you how many are
  left.
- Reminders are referred to by their **position in that spoken list**
  ("Number 1", "Number 2"), not by an id.
- Positions shift when you complete or delete something. Ask for the list again
  before acting if you are unsure which number is which.
- Completed reminders stay in storage until you say "clear completed
  reminders".

## Deploying (free, about 10 minutes)

You need a free [Amazon developer account](https://developer.amazon.com/alexa/console/ask).
The skill uses **Alexa-Hosted (Node.js)**, which supplies the Lambda function
and the S3 bucket for you.

1. **Create the skill.** In the [Alexa developer console](https://developer.amazon.com/alexa/console/ask)
   choose **Create Skill**, name it `Pocket Reminders`, pick **Custom**, then
   **Alexa-hosted (Node.js)**, then **Start from Scratch**.
2. **Add the interaction model.** Open **Build → Interaction Model → JSON
   Editor**. Copy the JSON from the bottom of `alexa.js` (the block under
   `INTERACTION MODEL`, starting at `{ "interactionModel": ...`), paste it in,
   click **Save**, then **Build Model**.
3. **Add the code.** Open the **Code** tab, open `lambda/index.js` and replace
   everything with the contents of `alexa.js`. Open `lambda/package.json` and
   confirm these dependencies are listed (the Alexa-Hosted template already
   includes all three):
   - `ask-sdk-core`
   - `ask-sdk-model`
   - `ask-sdk-s3-persistence-adapter`

   Click **Deploy**.
4. **Test.** Open the **Test** tab, switch the dropdown to **Development**,
   then type or say:
   ```
   open pocket reminders
   ```

Once it works in the simulator, it is also available on any Echo device or
Alexa app signed in to the same Amazon account, while the skill is in
development.

## Where your Alexa data lives

| Environment | Storage |
|-------------|---------|
| Alexa-Hosted | S3 bucket provided through the `S3_PERSISTENCE_BUCKET` environment variable, keyed by Alexa user id |
| Anywhere else (local testing) | `pocket_reminders.json` in your system temp folder |

The skill picks S3 automatically when `S3_PERSISTENCE_BUCKET` is set. The temp
file fallback is for local testing only and may be wiped by your OS.

Each Alexa reminder is stored with an id (`rem_<timestamp>`), text, priority,
creation time, status (`active` or `completed`) and an optional completion
time.

## Alexa troubleshooting

**"There was a problem with the requested skill's response"**
Open the **Code** tab, then **CloudWatch Logs** (or the logs link in the
editor) and look for `Skill error:`. The most common causes are a missing
dependency in `lambda/package.json` or a build that was saved but not deployed.

**Alexa does not understand a phrase**
Re-check that you clicked **Build Model** after pasting the JSON. Add more
sample utterances under the relevant intent and rebuild.

**Reminders are gone after a while**
You are probably running outside Alexa-Hosted and using the temp-folder
fallback. Deploy through Alexa-Hosted for real persistence.

**The reminder text is cut off or odd**
The reminder text is captured as free speech, so recognition quality depends
on Alexa. Speak the task right after "remind me to".

---

## Keeping the two in sync

The two parts are separate on purpose. The MCP server writes a local file;
the Alexa skill writes to S3 inside Amazon's cloud, and the two use slightly
different record shapes (`content` versus `text`, and string ids versus
spoken positions).

Practical options if you want one shared list:

- **Use them as two lists.** For example, Alexa for quick household
  reminders, Claude for work and planning.
- **Add a shared backend.** Point both at one small HTTP API or cloud
  database and have `src/index.ts` and `alexa.js` read and write the same
  record format. This is not built in today.

## Troubleshooting (Claude side)

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

## Project layout

```
.
├── src/
│   ├── index.ts            # Claude MCP server
│   └── tests/              # Test scaffolding
├── alexa.js                # Alexa skill (copy into the Alexa console, see Part 2)
├── setup.mjs               # One-command install for Claude Desktop
├── package.json
└── tsconfig.json
```

`alexa.js` is **not** part of the TypeScript build. It is meant to be pasted
into an Alexa-Hosted skill, where it runs as CommonJS. Because this
repository's `package.json` sets `"type": "module"`, running `alexa.js`
directly with Node from the repo root will fail with `require is not defined`.
Keep it as a reference copy, or rename it to `alexa.cjs` if you want to run it
locally.

## Development

```bash
npm run dev     # compile and launch the MCP server
npm run build   # compile only
npm run lint    # check code style
```

MCP source lives in `src/index.ts`. Compiled output goes to `dist/` and is not
committed.

## Contributing

Issues and pull requests are welcome, whether it is a bug fix, a new voice
phrase, a new MCP tool, or a documentation improvement. Please keep changes
small and focused so they are easy to review.

### Ways to help

- **Report a bug.** Open an issue with what you did, what you expected, and
  what happened instead. Include your OS, Node version (`node -v`), and which
  part is affected (Claude MCP server or Alexa skill). Paste relevant log
  lines from the Claude log or CloudWatch, with any personal reminder text
  removed.
- **Suggest a feature.** Describe the problem you are trying to solve before
  proposing a solution. Features that fit well include shared storage between
  the MCP server and the Alexa skill, due dates, and more Alexa phrasings.
- **Improve the docs.** Fixes to this README, clearer setup steps, and
  platform-specific notes (Linux, other MCP clients) are always welcome.
- **Add Alexa sample utterances.** If Alexa misses a natural phrasing, add it
  to the relevant intent in the interaction model at the bottom of `alexa.js`.

### Getting set up

1. Fork the repository and clone your fork.
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. Create a branch with a short descriptive name:
   ```bash
   git checkout -b fix/complete-reminder-error
   ```
4. Make your changes, then run the checks below.

### Before you open a pull request

```bash
npm run build   # must compile without errors
npm run lint    # must pass with no new warnings
npm test        # must pass
```

Then check the following:

- **MCP server changes** (`src/index.ts`): test with the inspector,
  `npx @modelcontextprotocol/inspector node dist/index.js`, and confirm each
  tool you touched still returns a sensible result.
- **Alexa skill changes** (`alexa.js`): test in the Alexa developer console
  **Test** tab using typed or spoken phrases. If you changed the interaction
  model, rebuild it and list the phrases you tried.
- **Keep the two parts compatible.** If you change the reminder record shape
  in one part, say so in the pull request, since the two do not share data
  today.
- **Update the docs.** If you add or rename a tool, voice command, or file,
  update the relevant table in this README in the same pull request.

### Code style

- TypeScript for the MCP server, following the existing ESLint rules. Run
  `npm run lint:fix` to fix simple issues automatically.
- Match the style of the surrounding code, and prefer clear names over
  comments that restate the code.
- No new dependencies unless they are clearly needed. Mention why in the pull
  request.
- Never commit secrets, personal reminders, `.env` files, or your local
  `~/.claude_reminders.json`.

### Commit messages and pull requests

- Write commit messages in the imperative mood, for example
  `Fix crash when priority is missing`.
- Keep each pull request to one logical change.
- In the description, explain **what** changed, **why**, and **how you tested
  it**. Link the related issue if there is one.
- Be open to feedback. Reviews are about the code, and follow-up commits on
  the same branch are the normal way to address comments.

### Code of conduct

Be kind and constructive. Harassment, personal attacks and discriminatory
language are not tolerated in issues, pull requests or discussions.

## License

Released under the MIT License.

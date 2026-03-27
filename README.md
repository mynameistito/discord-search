# discord-search
Search Discord server messages from your terminal. Filter by author, content type, mentions, and more. Export to JSON or CSV.
Licensed under MIT. See [LICENSE](LICENSE) for details.

> [!WARNING]
> This is an **unofficial** tool. It is not affiliated with, endorsed by, or connected to Discord in any way.
>
> It uses Discord's public API to search messages in servers where **your** bot has the proper permissions. You are fully responsible for complying with Discord's [Terms of Service](https://discord.com/terms), [Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy), and [Message Content Intent Review Policy](https://support-dev.discord.com/hc/en-us/articles/5324827539479-Message-Content-Intent-Review-Policy).
>
> Do not use this tool to scrape servers you don't own or for any purpose that violates user privacy. Rate limits are handled automatically, but excessive use can still get your bot token flagged.

## Prerequisites
- [Bun](https://bun.sh) installed
- A Discord account
- A server where you have admin rights

## Getting your Discord credentials
You'll need three things from the Discord Developer Portal:

### 1. Bot Token
- Go to https://discord.com/developers/applications
- Click "New Application" and give it a name
- Navigate to "Bot" in the left sidebar
- Click "Reset Token" to generate a new token
- Copy and save it somewhere secure (you won't see it again)

### 2. Client ID
- In the same application, go to "General Information"
- Copy the "Application ID" — this is your Client ID

### 3. Invite the bot to your server
- Go to "OAuth2" > "URL Generator"
- Under "Scopes", check "bot"
- Under "Bot Permissions", check:
  - Read Messages/View Channels
  - Read Message History
- Copy the generated URL and open it in your browser
- Select your server and authorize

### 4. Get your Guild ID
- In Discord, enable Developer Mode (Settings > Advanced > Developer Mode)
- Right-click your server name and select "Copy Server ID"

## Installation
```bash
git clone https://github.com/mynameistito/discord-search
cd discord-search
bun install
```
### Optional
Create a .env file in the project root:
```bash
cp .env.example .env
```
This is optional, you will be asked for these when running the tool.

## Usage
Run the tool:
```bash
bun run index.ts
```
Or with command-line options:
```
bun run index.ts --token YOUR_TOKEN
bun run index.ts --guild 123456789
bun run index.ts --client-id 123456789
bun run index.ts --help
```

> [!NOTE]
> **Current Implementation Status**
>
> - `discord-search --help`: Shows help message ✓
> - `discord-search --version`: Shows version number ✓
> - Interactive mode: Not yet implemented (see `src/index.ts`)
> - Search command: Not yet implemented (see `src/index.ts`)
> - Preset command: Not yet implemented (see `src/index.ts`)
> - Settings command: Not yet implemented (see `src/index.ts`)
>
> Refer to `src/index.ts` for the current implementation status of each command.

Interactive mode
The CLI guides you through setting up searches:
1. Choose "New search" to start
2. Enter your Guild ID (server ID)
3. Optionally filter by content, author, mentions, or content types
4. Browse results or export them

> [!WARNING]
> Interactive mode and all subcommands (search, preset, settings) are currently unimplemented. Running these will display an error message and exit with code 1. Only `--help` and `--version` are functional in this release.

**Search filters**
- Content text search
- Author IDs (comma-separated)
- Author type: user, bot, or webhook
- Mentions (user IDs)
- Channel IDs
- Content types: embed, image, video, file, link, sticker, sound, poll, snapshot
- Sort by timestamp or relevance
- Include/exclude NSFW channels

**Export formats**
- JSON with full message data
- CSV with message summaries
- CSV with embed details
- CSV with extracted embed fields

**Presets**
Save search configurations to reuse later:
- Save any search as a named preset
- Load presets quickly
- Bulk run multiple presets

## Development
```bash
bun run check      # Lint and format check
bun run fix        # Auto-fix linting issues
bun run typecheck  # Type checking
```
## Contributing
Open an issue or pull request if you have ideas or find bugs.

## Discord's Links
- **[Discord - Terms of Service](https://discord.com/terms)**
- **[Discord - Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy)**
- **[Discord Content Intent Review Policy](https://support-dev.discord.com/hc/en-us/articles/5324827539479-Message-Content-Intent-Review-Policy)**

## License
MIT. See LICENSE (LICENSE).

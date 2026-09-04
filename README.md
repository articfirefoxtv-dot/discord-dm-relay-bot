# Discord DM Relay Bot

This bot forwards direct messages to one Discord account and sends replies back to the original sender.

## How it works

1. Someone sends the bot a direct message.
2. The bot sends that message to the configured owner.
3. The owner replies directly to the relay message.
4. The bot delivers the reply to the original sender.

Only direct messages are relayed. Bot messages are ignored so the bot cannot create a forwarding loop.

## Discord setup

1. Create or open the bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **Bot**, enable **Message Content Intent**.
3. Invite the bot to Discord using the OAuth2 URL generator with the `bot` scope and permission to send messages.
4. Reset the bot token if it was ever pasted into chat or committed to a repository.

## Run locally

```bash
npm install
cp .env.example .env
```

Put the bot token in `.env`, then run:

```bash
npm start
```

Never commit `.env`.

## Run 24/7

GitHub stores the code but does not run a process continuously. Connect this repository to a background-worker host such as Render, Railway, Fly.io, or another always-on Node.js host.

This repository includes `render.yaml`, so Render can create the worker with the build and start commands already filled in.

Use:

- Build command: `npm install`
- Start command: `npm start`
- Environment variable: `DISCORD_BOT_TOKEN`
- Environment variable: `DISCORD_OWNER_ID` set to `1456456736071225519`

Do not put the bot token in GitHub. Add it as a secret/environment variable in the hosting provider.
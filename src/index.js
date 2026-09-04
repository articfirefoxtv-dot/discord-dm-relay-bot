import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const token = process.env.DISCORD_BOT_TOKEN;
const ownerId = process.env.DISCORD_OWNER_ID ?? "1456456736071225519";
const stateFile = path.resolve(
  process.env.DISCORD_RELAY_STATE_PATH ?? "data/relay-state.json",
);
const messageLimit = 2_000;

if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is required");
}

let relayMessageToUser = {};

async function loadState() {
  try {
    const saved = JSON.parse(await readFile(stateFile, "utf8"));
    if (saved && typeof saved === "object" && saved.relayMessageToUser) {
      relayMessageToUser = saved.relayMessageToUser;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Could not load relay state:", error.message);
    }
  }
}

async function saveState() {
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(
    stateFile,
    `${JSON.stringify({ relayMessageToUser }, null, 2)}\n`,
  );
}

function splitMessage(text) {
  const chunks = [];
  for (let index = 0; index < text.length; index += messageLimit) {
    chunks.push(text.slice(index, index + messageLimit));
  }
  return chunks.length ? chunks : ["(empty message)"];
}

async function sendText(recipient, text) {
  const sent = [];
  for (const chunk of splitMessage(text)) {
    sent.push(await recipient.send(chunk));
  }
  return sent;
}

function contentWithAttachments(message) {
  const attachments = [...message.attachments.values()].map(
    (attachment) => attachment.url,
  );
  return [message.content.trim(), ...attachments]
    .filter(Boolean)
    .join("\n") || "(empty message)";
}

function userIdFromRelay(content) {
  return content.match(/User ID:\s*(\d{15,25})/)?.[1] ?? null;
}

async function getRelayedUserId(message) {
  const referenceId = message.reference?.messageId;
  if (!referenceId) return null;

  if (relayMessageToUser[referenceId]) {
    return relayMessageToUser[referenceId];
  }

  try {
    const referenced = await message.fetchReference();
    return userIdFromRelay(referenced.content);
  } catch {
    return null;
  }
}

async function handleOwnerReply(message, client) {
  const userId = await getRelayedUserId(message);
  if (!userId) {
    await message.reply(
      "Reply directly to one of my relay messages to send a response.",
    );
    return;
  }

  try {
    const recipient = await client.users.fetch(userId);
    await sendText(recipient, contentWithAttachments(message));
    await message.react("✅");
    console.log(`Delivered owner reply to ${userId}`);
  } catch (error) {
    console.error(`Could not deliver owner reply to ${userId}:`, error.message);
    await message.reply(
      "I could not deliver that response. The recipient may have blocked the bot or closed their DMs.",
    );
  }
}

async function handleMessage(message, client) {
  if (message.author.bot || !message.channel.isDMBased()) return;

  if (message.author.id === ownerId) {
    await handleOwnerReply(message, client);
    return;
  }

  try {
    const owner = await client.users.fetch(ownerId);
    const text = [
      "[Discord relay]",
      `Message from ${message.author.globalName ?? message.author.username}`,
      `User ID: ${message.author.id}`,
      "",
      contentWithAttachments(message),
      "",
      "Reply directly to this message to respond.",
    ].join("\n");
    const relayMessages = await sendText(owner, text);
    if (relayMessages[0]) {
      relayMessageToUser[relayMessages[0].id] = message.author.id;
      await saveState();
    }
    console.log(`Relayed message from ${message.author.id}`);
  } catch (error) {
    console.error(
      `Could not relay message from ${message.author.id}:`,
      error.message,
    );
  }
}

await loadState();

const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.on("messageCreate", (message) => {
  void handleMessage(message, client).catch((error) => {
    console.error("Unhandled relay error:", error);
  });
});

client.once("clientReady", (readyClient) => {
  console.log(`Discord relay is ready as ${readyClient.user.tag}`);
  console.log(`Relay recipient: ${ownerId}`);
});

client.on("error", (error) => {
  console.error("Discord client error:", error);
});

await client.login(token);
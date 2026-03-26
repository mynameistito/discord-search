import type { Embed, Message } from "@/discord/schemas.ts";

export type FlattenedEmbed = {
  channelId: string;
  embed: Embed;
  messageAuthor: { id: string; username: string; bot?: boolean };
  messageId: string;
  messageTimestamp: string;
};

export type ExtractedFieldRow = {
  channelId: string;
  embedDescription: string | null;
  embedTitle: string | null;
  fields: Record<string, string>;
  messageId: string;
  messageTimestamp: string;
};

export type CollatedData = {
  byAuthor: Record<string, { count: number; username: string; bot?: boolean }>;
  byChannel: Record<string, number>;
  embeds: FlattenedEmbed[];
  embedsByAuthor: Record<string, number>;
  embedsByDomain: Record<string, number>;
  embedsByProvider: Record<string, number>;
  embedsByType: Record<string, number>;
  extractedFields: ExtractedFieldRow[];
  messages: Message[];
  totalEmbeds: number;
  totalMessages: number;
};

const extractDomain = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

const increment = (record: Record<string, number>, key: string): void => {
  record[key] = (record[key] ?? 0) + 1;
};

const processEmbed = (embed: Embed, data: CollatedData): void => {
  if (embed.type) {
    increment(data.embedsByType, embed.type);
  }
  if (embed.provider?.name) {
    increment(data.embedsByProvider, embed.provider.name);
  }
  if (embed.author?.name) {
    increment(data.embedsByAuthor, embed.author.name);
  }

  if (embed.url) {
    const domain = extractDomain(embed.url);
    if (domain) {
      increment(data.embedsByDomain, domain);
    }
  }
};

const extractFields = (
  embed: Embed,
  msg: Message,
  data: CollatedData
): void => {
  if (!embed.fields || embed.fields.length === 0) {
    return;
  }

  const fields: Record<string, string> = {};
  for (const field of embed.fields) {
    fields[field.name] = field.value;
  }

  data.extractedFields.push({
    messageId: msg.id,
    channelId: msg.channel_id,
    messageTimestamp: msg.timestamp,
    embedTitle: embed.title ?? null,
    embedDescription: embed.description ?? null,
    fields,
  });
};

const processMessage = (msg: Message, data: CollatedData): void => {
  increment(data.byChannel, msg.channel_id);

  const authorEntry = data.byAuthor[msg.author.id];
  if (authorEntry) {
    authorEntry.count++;
  } else {
    data.byAuthor[msg.author.id] = {
      count: 1,
      username: msg.author.username,
      bot: msg.author.bot,
    };
  }

  const embeds = msg.embeds ?? [];
  data.totalEmbeds += embeds.length;

  for (const embed of embeds) {
    data.embeds.push({
      messageId: msg.id,
      channelId: msg.channel_id,
      messageTimestamp: msg.timestamp,
      messageAuthor: {
        id: msg.author.id,
        username: msg.author.username,
        bot: msg.author.bot,
      },
      embed,
    });

    processEmbed(embed, data);
    extractFields(embed, msg, data);
  }
};

export const collateResults = (messages: Message[]): CollatedData => {
  const data: CollatedData = {
    totalMessages: messages.length,
    byChannel: {},
    byAuthor: {},
    totalEmbeds: 0,
    embedsByType: {},
    embedsByProvider: {},
    embedsByDomain: {},
    embedsByAuthor: {},
    messages,
    embeds: [],
    extractedFields: [],
  };

  for (const msg of messages) {
    processMessage(msg, data);
  }

  return data;
};

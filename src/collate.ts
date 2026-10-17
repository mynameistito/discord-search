import type { Embed, Message } from "@/discord/schemas.ts";

/** An embed paired with the message and author it came from. */
export interface FlattenedEmbed {
  channelId: string;
  embed: Embed;
  messageAuthor: { id: string; username: string; bot?: boolean };
  messageId: string;
  messageTimestamp: string;
}

/** Extracted embed fields with their originating message metadata. */
export interface ExtractedFieldRow {
  channelId: string;
  embedDescription: string | null;
  embedTitle: string | null;
  fields: Record<string, string>;
  messageId: string;
  messageTimestamp: string;
}

/** Aggregated messages, embeds, and author/channel statistics. */
export interface CollatedData {
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
}

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
  if (embed.type !== undefined && embed.type.length > 0) {
    increment(data.embedsByType, embed.type);
  }

  if (embed.provider?.name !== undefined && embed.provider.name.length > 0) {
    increment(data.embedsByProvider, embed.provider.name);
  }

  if (embed.author?.name !== undefined && embed.author.name.length > 0) {
    increment(data.embedsByAuthor, embed.author.name);
  }

  if (embed.url !== undefined && embed.url.length > 0) {
    const domain = extractDomain(embed.url);

    if (domain !== null) {
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
    channelId: msg.channel_id,
    embedDescription: embed.description ?? null,
    embedTitle: embed.title ?? null,
    fields,
    messageId: msg.id,
    messageTimestamp: msg.timestamp,
  });
};

const processMessage = (msg: Message, data: CollatedData): void => {
  increment(data.byChannel, msg.channel_id);

  const authorEntry = data.byAuthor[msg.author.id];

  if (authorEntry) {
    authorEntry.count += 1;
  } else {
    data.byAuthor[msg.author.id] = {
      bot: msg.author.bot,
      count: 1,
      username: msg.author.username,
    };
  }

  const embeds = msg.embeds ?? [];
  data.totalEmbeds += embeds.length;

  for (const embed of embeds) {
    data.embeds.push({
      channelId: msg.channel_id,
      embed,
      messageAuthor: {
        bot: msg.author.bot,
        id: msg.author.id,
        username: msg.author.username,
      },
      messageId: msg.id,
      messageTimestamp: msg.timestamp,
    });

    processEmbed(embed, data);
    extractFields(embed, msg, data);
  }
};

/**
 * Aggregate messages into export and summary data.
 *
 * @param messages - Messages returned by Discord search.
 * @returns Collated counts and rows for the supplied messages.
 */
export const collateResults = (messages: Message[]): CollatedData => {
  const data: CollatedData = {
    byAuthor: {},
    byChannel: {},
    embeds: [],
    embedsByAuthor: {},
    embedsByDomain: {},
    embedsByProvider: {},
    embedsByType: {},
    extractedFields: [],
    messages,
    totalEmbeds: 0,
    totalMessages: messages.length,
  };

  for (const msg of messages) {
    processMessage(msg, data);
  }

  return data;
};

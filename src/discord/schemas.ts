import { z } from "zod";

// Embed sub-objects

export const EmbedFooterSchema = z.object({
  text: z.string(),
  icon_url: z.string().optional(),
  proxy_icon_url: z.string().optional(),
});

export const EmbedImageSchema = z.object({
  url: z.string(),
  proxy_url: z.string().optional(),
  height: z.number().optional(),
  width: z.number().optional(),
});

export const EmbedThumbnailSchema = z.object({
  url: z.string(),
  proxy_url: z.string().optional(),
  height: z.number().optional(),
  width: z.number().optional(),
});

export const EmbedVideoSchema = z.object({
  url: z.string().optional(),
  proxy_url: z.string().optional(),
  height: z.number().optional(),
  width: z.number().optional(),
});

export const EmbedProviderSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
});

export const EmbedAuthorSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  icon_url: z.string().optional(),
  proxy_icon_url: z.string().optional(),
});

export const EmbedFieldSchema = z.object({
  name: z.string(),
  value: z.string(),
  inline: z.boolean().optional(),
});

export const EmbedSchema = z.object({
  title: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  timestamp: z.string().optional(),
  color: z.number().optional(),
  footer: EmbedFooterSchema.optional(),
  image: EmbedImageSchema.optional(),
  thumbnail: EmbedThumbnailSchema.optional(),
  video: EmbedVideoSchema.optional(),
  provider: EmbedProviderSchema.optional(),
  author: EmbedAuthorSchema.optional(),
  fields: z.array(EmbedFieldSchema).optional(),
});

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  discriminator: z.string().optional(),
  avatar: z.string().nullable().optional(),
  bot: z.boolean().optional(),
});

export const AttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  size: z.number(),
  url: z.string(),
  proxy_url: z.string().optional(),
  content_type: z.string().optional(),
});

export const MessageSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  author: UserSchema,
  content: z.string(),
  timestamp: z.string(),
  edited_timestamp: z.string().nullable().optional(),
  tts: z.boolean().optional(),
  mention_everyone: z.boolean().optional(),
  mentions: z.array(UserSchema).optional(),
  pinned: z.boolean().optional(),
  type: z.number().optional(),
  embeds: z.array(EmbedSchema).optional(),
  attachments: z.array(AttachmentSchema).optional(),
  referenced_message: z
    .object({
      id: z.string(),
      channel_id: z.string(),
      author: UserSchema.optional(),
      content: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export const SearchResponseSchema = z.object({
  total_results: z.number(),
  messages: z.array(z.array(MessageSchema)),
  doing_deep_historical_index: z.boolean().optional(),
  documents_indexed: z.number().optional(),
  threads: z.array(z.unknown()).optional(),
  members: z.array(z.unknown()).optional(),
});

export const IndexNotReadyResponseSchema = z.object({
  message: z.string(),
  code: z.number(),
  documents_indexed: z.number().optional(),
  retry_after: z.number(),
});

export const SearchParamsSchema = z.object({
  attachmentExtension: z.array(z.string()).optional(),
  attachmentFilename: z.array(z.string()).optional(),
  authorId: z.array(z.string()).optional(),
  authorType: z.array(z.enum(["user", "bot", "webhook"])).optional(),
  channelId: z.array(z.string()).optional(),
  content: z.string().optional(),
  embedProvider: z.array(z.string()).optional(),
  embedType: z
    .array(z.enum(["image", "video", "gif", "sound", "article"]))
    .optional(),
  guildId: z.string(),
  has: z
    .array(
      z.enum([
        "image",
        "sound",
        "video",
        "file",
        "sticker",
        "embed",
        "link",
        "poll",
        "snapshot",
      ])
    )
    .optional(),
  includeNsfw: z.boolean().optional(),
  linkHostname: z.array(z.string()).optional(),
  maxId: z.string().optional(),
  mentionEveryone: z.boolean().optional(),
  mentions: z.array(z.string()).optional(),
  mentionsRoleId: z.array(z.string()).optional(),
  minId: z.string().optional(),
  pinned: z.boolean().optional(),
  repliedToMessageId: z.array(z.string()).optional(),
  repliedToUserId: z.array(z.string()).optional(),
  slop: z.number().optional(),
  sortBy: z.enum(["timestamp", "relevance"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

// Inferred types
export type Embed = z.infer<typeof EmbedSchema>;
export type EmbedField = z.infer<typeof EmbedFieldSchema>;
export type User = z.infer<typeof UserSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type IndexNotReadyResponse = z.infer<typeof IndexNotReadyResponseSchema>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;

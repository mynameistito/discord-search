import { z } from "zod";

export const MAX_OFFSET = 9975;
export const MAX_PAGE_SIZE = 25;

export const SNOWFLAKE_REGEX = /^\d{17,20}$/u;

const snowflakeSchema = z.string().regex(SNOWFLAKE_REGEX, {
  message: "Invalid Discord ID: must be a 17-20 digit numeric snowflake",
});

const snowflakeArraySchema = z.array(snowflakeSchema);

// Embed sub-objects

export const EmbedFooterSchema = z.object({
  icon_url: z.string().optional(),
  proxy_icon_url: z.string().optional(),
  text: z.string(),
});

const EmbedMediaSchema = z.object({
  height: z.number().optional(),
  proxy_url: z.string().optional(),
  url: z.string(),
  width: z.number().optional(),
});

export const EmbedImageSchema = EmbedMediaSchema;
export const EmbedThumbnailSchema = EmbedMediaSchema;

export const EmbedVideoSchema = z.object({
  height: z.number().optional(),
  proxy_url: z.string().optional(),
  url: z.string().optional(),
  width: z.number().optional(),
});

export const EmbedProviderSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
});

export const EmbedAuthorSchema = z.object({
  icon_url: z.string().optional(),
  name: z.string(),
  proxy_icon_url: z.string().optional(),
  url: z.string().optional(),
});

export const EmbedFieldSchema = z.object({
  inline: z.boolean().optional(),
  name: z.string(),
  value: z.string(),
});

export const EmbedSchema = z.object({
  author: EmbedAuthorSchema.optional(),
  color: z.number().optional(),
  description: z.string().optional(),
  fields: z.array(EmbedFieldSchema).optional(),
  footer: EmbedFooterSchema.optional(),
  image: EmbedImageSchema.optional(),
  provider: EmbedProviderSchema.optional(),
  thumbnail: EmbedThumbnailSchema.optional(),
  timestamp: z.string().optional(),
  title: z.string().optional(),
  type: z.string().optional(),
  url: z.string().optional(),
  video: EmbedVideoSchema.optional(),
});

export const UserSchema = z.object({
  avatar: z.string().nullable().optional(),
  bot: z.boolean().optional(),
  discriminator: z.string().optional(),
  id: snowflakeSchema,
  username: z.string(),
});

export const AttachmentSchema = z.object({
  content_type: z.string().optional(),
  filename: z.string(),
  id: snowflakeSchema,
  proxy_url: z.string().optional(),
  size: z.number(),
  url: z.string(),
});

export const MessageSchema = z.object({
  attachments: z.array(AttachmentSchema).optional(),
  author: UserSchema,
  channel_id: snowflakeSchema,
  content: z.string(),
  edited_timestamp: z.string().nullable().optional(),
  embeds: z.array(EmbedSchema).optional(),
  guild_id: snowflakeSchema.optional(),
  id: snowflakeSchema,
  mention_everyone: z.boolean().optional(),
  mentions: z.array(UserSchema).optional(),
  pinned: z.boolean().optional(),
  referenced_message: z
    .object({
      author: UserSchema.optional(),
      channel_id: snowflakeSchema,
      content: z.string().optional(),
      id: snowflakeSchema,
    })
    .nullable()
    .optional(),
  timestamp: z.string(),
  tts: z.boolean().optional(),
  type: z.number().optional(),
});

export const ThreadSchema = z.object({
  guild_id: snowflakeSchema.optional(),
  id: snowflakeSchema,
  member_count: z.number().optional(),
  message_count: z.number().optional(),
  name: z.string().optional(),
  parent_id: snowflakeSchema.nullable().optional(),
  thread_metadata: z
    .object({
      archive_timestamp: z.string().optional(),
      archived: z.boolean(),
      auto_archive_duration: z.number().optional(),
      locked: z.boolean().optional(),
    })
    .optional(),
  type: z.number(),
});

export const MemberSchema = z.object({
  avatar: z.string().nullable().optional(),
  deaf: z.boolean().optional(),
  joined_at: z.string().optional(),
  mute: z.boolean().optional(),
  nick: z.string().nullable().optional(),
  roles: z.array(snowflakeSchema).optional(),
  user_id: snowflakeSchema.optional(),
});

export const SearchResponseSchema = z.object({
  documents_indexed: z.number().optional(),
  doing_deep_historical_index: z.boolean().optional(),
  members: z.array(MemberSchema).optional(),
  messages: z.array(z.array(MessageSchema)),
  threads: z.array(ThreadSchema).optional(),
  total_results: z.number(),
});

export const RateLimitBodySchema = z.object({
  retry_after: z.number(),
});

export const IndexNotReadyResponseSchema = z.object({
  code: z.number(),
  documents_indexed: z.number().optional(),
  message: z.string(),
  retry_after: z.number(),
});

export const SearchParamsSchema = z.object({
  attachmentExtension: z.array(z.string()).optional(),
  attachmentFilename: z.array(z.string()).optional(),
  authorId: snowflakeArraySchema.optional(),
  authorType: z.array(z.enum(["user", "bot", "webhook"])).optional(),
  channelId: snowflakeArraySchema.optional(),
  content: z.string().optional(),
  embedProvider: z.array(z.string()).optional(),
  embedType: z
    .array(z.enum(["image", "video", "gif", "sound", "article"]))
    .optional(),
  guildId: snowflakeSchema,
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
  limit: z.number().int().min(1).optional(),
  linkHostname: z.array(z.string()).optional(),
  maxId: snowflakeSchema.optional(),
  mentionEveryone: z.boolean().optional(),
  mentions: snowflakeArraySchema.optional(),
  mentionsRoleId: snowflakeArraySchema.optional(),
  minId: snowflakeSchema.optional(),
  offset: z.number().int().min(0).max(MAX_OFFSET).optional(),
  pinned: z.boolean().optional(),
  repliedToMessageId: snowflakeArraySchema.optional(),
  repliedToUserId: snowflakeArraySchema.optional(),
  slop: z.number().int().min(0).optional(),
  sortBy: z.enum(["timestamp", "relevance"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// Inferred types
/** Inferred Discord embed payload. */
export type Embed = z.infer<typeof EmbedSchema>;

/** Inferred embed field payload. */
export type EmbedField = z.infer<typeof EmbedFieldSchema>;

/** Inferred Discord user payload. */
export type User = z.infer<typeof UserSchema>;

/** Inferred Discord message payload. */
export type Message = z.infer<typeof MessageSchema>;

/** Inferred Discord thread payload. */
export type Thread = z.infer<typeof ThreadSchema>;

/** Inferred Discord guild-member payload. */
export type Member = z.infer<typeof MemberSchema>;

/** Inferred Discord message-search response. */
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/** Inferred response returned while Discord indexes search results. */
export type IndexNotReadyResponse = z.infer<typeof IndexNotReadyResponseSchema>;

/** Inferred and validated search filter parameters. */
export type SearchParams = z.infer<typeof SearchParamsSchema>;

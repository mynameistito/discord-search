import { z } from "zod";

export const MAX_OFFSET = 9975;
export const MAX_PAGE_SIZE = 25;

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

const snowflakeSchema = z
  .string()
  .regex(SNOWFLAKE_REGEX, {
    message: "Invalid Discord ID: must be a 17-20 digit numeric snowflake",
  })
  .max(20, { message: "Discord ID exceeds maximum length of 20 characters" });

const snowflakeArraySchema = z.array(snowflakeSchema);

// Embed sub-objects

export const EmbedFooterSchema = z.object({
  text: z.string(),
  icon_url: z.string().optional(),
  proxy_icon_url: z.string().optional(),
});

const EmbedMediaSchema = z.object({
  url: z.string(),
  proxy_url: z.string().optional(),
  height: z.number().optional(),
  width: z.number().optional(),
});

export const EmbedImageSchema = EmbedMediaSchema;
export const EmbedThumbnailSchema = EmbedMediaSchema;

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
  id: snowflakeSchema,
  username: z.string(),
  discriminator: z.string().optional(),
  avatar: z.string().nullable().optional(),
  bot: z.boolean().optional(),
});

export const AttachmentSchema = z.object({
  id: snowflakeSchema,
  filename: z.string(),
  size: z.number(),
  url: z.string(),
  proxy_url: z.string().optional(),
  content_type: z.string().optional(),
});

export const MessageSchema = z.object({
  id: snowflakeSchema,
  channel_id: snowflakeSchema,
  guild_id: snowflakeSchema.optional(),
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
      id: snowflakeSchema,
      channel_id: snowflakeSchema,
      author: UserSchema.optional(),
      content: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export const ThreadSchema = z.object({
  id: snowflakeSchema,
  type: z.number(),
  name: z.string().optional(),
  guild_id: snowflakeSchema.optional(),
  parent_id: snowflakeSchema.nullable().optional(),
  message_count: z.number().optional(),
  member_count: z.number().optional(),
  thread_metadata: z
    .object({
      archived: z.boolean(),
      auto_archive_duration: z.number().optional(),
      archive_timestamp: z.string().optional(),
      locked: z.boolean().optional(),
    })
    .optional(),
});

export const MemberSchema = z.object({
  user_id: snowflakeSchema.optional(),
  nick: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  roles: z.array(snowflakeSchema).optional(),
  joined_at: z.string().optional(),
  deaf: z.boolean().optional(),
  mute: z.boolean().optional(),
});

export const SearchResponseSchema = z.object({
  total_results: z.number(),
  messages: z.array(z.array(MessageSchema)),
  doing_deep_historical_index: z.boolean().optional(),
  documents_indexed: z.number().optional(),
  threads: z.array(ThreadSchema).optional(),
  members: z.array(MemberSchema).optional(),
});

export const RateLimitBodySchema = z.object({
  retry_after: z.number(),
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
  linkHostname: z.array(z.string()).optional(),
  maxId: snowflakeSchema.optional(),
  mentionEveryone: z.boolean().optional(),
  mentions: snowflakeArraySchema.optional(),
  mentionsRoleId: snowflakeArraySchema.optional(),
  minId: snowflakeSchema.optional(),
  pinned: z.boolean().optional(),
  repliedToMessageId: snowflakeArraySchema.optional(),
  repliedToUserId: snowflakeArraySchema.optional(),
  slop: z.number().int().min(0).optional(),
  sortBy: z.enum(["timestamp", "relevance"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  offset: z.number().int().min(0).max(MAX_OFFSET).optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});

// Inferred types
export type Embed = z.infer<typeof EmbedSchema>;
export type EmbedField = z.infer<typeof EmbedFieldSchema>;
export type User = z.infer<typeof UserSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Thread = z.infer<typeof ThreadSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type IndexNotReadyResponse = z.infer<typeof IndexNotReadyResponseSchema>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;

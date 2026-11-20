import { Schema } from "effect";

export const MAX_OFFSET = 9975;
export const MAX_PAGE_SIZE = 25;

export const SNOWFLAKE_REGEX = /^\d{17,20}$/u;

const snowflakeSchema = Schema.String.check(
  Schema.isPattern(SNOWFLAKE_REGEX, {
    message: "Invalid Discord ID: must be a 17-20 digit numeric snowflake",
  })
);

const snowflakeArraySchema = Schema.Array(snowflakeSchema);

export const EmbedFooterSchema = Schema.Struct({
  icon_url: Schema.String.pipe(Schema.optional),
  proxy_icon_url: Schema.String.pipe(Schema.optional),
  text: Schema.String,
});

const EmbedMediaSchema = Schema.Struct({
  height: Schema.Finite.pipe(Schema.optional),
  proxy_url: Schema.String.pipe(Schema.optional),
  url: Schema.String,
  width: Schema.Finite.pipe(Schema.optional),
});

export const EmbedImageSchema = EmbedMediaSchema;
export const EmbedThumbnailSchema = EmbedMediaSchema;

export const EmbedVideoSchema = Schema.Struct({
  height: Schema.Finite.pipe(Schema.optional),
  proxy_url: Schema.String.pipe(Schema.optional),
  url: Schema.String.pipe(Schema.optional),
  width: Schema.Finite.pipe(Schema.optional),
});

export const EmbedProviderSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.optional),
  url: Schema.String.pipe(Schema.optional),
});

export const EmbedAuthorSchema = Schema.Struct({
  icon_url: Schema.String.pipe(Schema.optional),
  name: Schema.String,
  proxy_icon_url: Schema.String.pipe(Schema.optional),
  url: Schema.String.pipe(Schema.optional),
});

export const EmbedFieldSchema = Schema.Struct({
  inline: Schema.Boolean.pipe(Schema.optional),
  name: Schema.String,
  value: Schema.String,
});

export const EmbedSchema = Schema.Struct({
  author: EmbedAuthorSchema.pipe(Schema.optional),
  color: Schema.Finite.pipe(Schema.optional),
  description: Schema.String.pipe(Schema.optional),
  fields: Schema.Array(EmbedFieldSchema).pipe(Schema.optional),
  footer: EmbedFooterSchema.pipe(Schema.optional),
  image: EmbedImageSchema.pipe(Schema.optional),
  provider: EmbedProviderSchema.pipe(Schema.optional),
  thumbnail: EmbedThumbnailSchema.pipe(Schema.optional),
  timestamp: Schema.String.pipe(Schema.optional),
  title: Schema.String.pipe(Schema.optional),
  type: Schema.String.pipe(Schema.optional),
  url: Schema.String.pipe(Schema.optional),
  video: EmbedVideoSchema.pipe(Schema.optional),
});

export const UserSchema = Schema.Struct({
  avatar: Schema.String.pipe(Schema.NullOr).pipe(Schema.optional),
  bot: Schema.Boolean.pipe(Schema.optional),
  discriminator: Schema.String.pipe(Schema.optional),
  id: snowflakeSchema,
  username: Schema.String,
});

export const AttachmentSchema = Schema.Struct({
  content_type: Schema.String.pipe(Schema.optional),
  filename: Schema.String,
  id: snowflakeSchema,
  proxy_url: Schema.String.pipe(Schema.optional),
  size: Schema.Finite,
  url: Schema.String,
});

export const MessageSchema = Schema.Struct({
  attachments: Schema.Array(AttachmentSchema).pipe(Schema.optional),
  author: UserSchema,
  channel_id: snowflakeSchema,
  content: Schema.String,
  edited_timestamp: Schema.String.pipe(Schema.NullOr).pipe(Schema.optional),
  embeds: Schema.Array(EmbedSchema).pipe(Schema.optional),
  guild_id: snowflakeSchema.pipe(Schema.optional),
  id: snowflakeSchema,
  mention_everyone: Schema.Boolean.pipe(Schema.optional),
  mentions: Schema.Array(UserSchema).pipe(Schema.optional),
  pinned: Schema.Boolean.pipe(Schema.optional),
  referenced_message: Schema.Struct({
    author: UserSchema.pipe(Schema.optional),
    channel_id: snowflakeSchema,
    content: Schema.String.pipe(Schema.optional),
    id: snowflakeSchema,
  })
    .pipe(Schema.NullOr)
    .pipe(Schema.optional),
  timestamp: Schema.String,
  tts: Schema.Boolean.pipe(Schema.optional),
  type: Schema.Finite.pipe(Schema.optional),
});

export const ThreadSchema = Schema.Struct({
  guild_id: snowflakeSchema.pipe(Schema.optional),
  id: snowflakeSchema,
  member_count: Schema.Finite.pipe(Schema.optional),
  message_count: Schema.Finite.pipe(Schema.optional),
  name: Schema.String.pipe(Schema.optional),
  parent_id: snowflakeSchema.pipe(Schema.NullOr).pipe(Schema.optional),
  thread_metadata: Schema.Struct({
    archive_timestamp: Schema.String.pipe(Schema.optional),
    archived: Schema.Boolean,
    auto_archive_duration: Schema.Finite.pipe(Schema.optional),
    locked: Schema.Boolean.pipe(Schema.optional),
  }).pipe(Schema.optional),
  type: Schema.Finite,
});

export const MemberSchema = Schema.Struct({
  avatar: Schema.String.pipe(Schema.NullOr).pipe(Schema.optional),
  deaf: Schema.Boolean.pipe(Schema.optional),
  joined_at: Schema.String.pipe(Schema.optional),
  mute: Schema.Boolean.pipe(Schema.optional),
  nick: Schema.String.pipe(Schema.NullOr).pipe(Schema.optional),
  roles: Schema.Array(snowflakeSchema).pipe(Schema.optional),
  user_id: snowflakeSchema.pipe(Schema.optional),
});

export const SearchResponseSchema = Schema.Struct({
  documents_indexed: Schema.Finite.pipe(Schema.optional),
  doing_deep_historical_index: Schema.Boolean.pipe(Schema.optional),
  members: Schema.Array(MemberSchema).pipe(Schema.optional),
  messages: Schema.Array(Schema.Array(MessageSchema)),
  threads: Schema.Array(ThreadSchema).pipe(Schema.optional),
  total_results: Schema.Finite,
});

export const RateLimitBodySchema = Schema.Struct({
  retry_after: Schema.Finite,
});

export const IndexNotReadyResponseSchema = Schema.Struct({
  code: Schema.Finite,
  documents_indexed: Schema.Finite.pipe(Schema.optional),
  message: Schema.String,
  retry_after: Schema.Finite,
});

export const SearchParamsSchema = Schema.Struct({
  attachmentExtension: Schema.Array(Schema.String).pipe(
    Schema.optional,
    Schema.mutableKey
  ),
  attachmentFilename: Schema.Array(Schema.String).pipe(
    Schema.optional,
    Schema.mutableKey
  ),
  authorId: snowflakeArraySchema.pipe(Schema.optional, Schema.mutableKey),
  authorType: Schema.Array(Schema.Literals(["user", "bot", "webhook"])).pipe(
    Schema.optional,
    Schema.mutableKey
  ),
  channelId: snowflakeArraySchema.pipe(Schema.optional, Schema.mutableKey),
  content: Schema.String.pipe(Schema.optional, Schema.mutableKey),
  embedProvider: Schema.Array(Schema.String).pipe(
    Schema.optional,
    Schema.mutableKey
  ),
  embedType: Schema.Array(
    Schema.Literals(["image", "video", "gif", "sound", "article"])
  ).pipe(Schema.optional, Schema.mutableKey),
  guildId: snowflakeSchema.pipe(Schema.mutableKey),
  has: Schema.Array(
    Schema.Literals([
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
  ).pipe(Schema.optional, Schema.mutableKey),
  includeNsfw: Schema.Boolean.pipe(Schema.optional, Schema.mutableKey),
  limit: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)).pipe(
    Schema.optional,
    Schema.mutableKey
  ),
  linkHostname: Schema.Array(Schema.String).pipe(
    Schema.optional,
    Schema.mutableKey
  ),
  maxId: snowflakeSchema.pipe(Schema.optional, Schema.mutableKey),
  mentionEveryone: Schema.Boolean.pipe(Schema.optional, Schema.mutableKey),
  mentions: snowflakeArraySchema.pipe(Schema.optional, Schema.mutableKey),
  mentionsRoleId: snowflakeArraySchema.pipe(Schema.optional, Schema.mutableKey),
  minId: snowflakeSchema.pipe(Schema.optional, Schema.mutableKey),
  offset: Schema.Int.check(
    Schema.isBetween({ minimum: 0, maximum: MAX_OFFSET })
  ).pipe(Schema.optional, Schema.mutableKey),
  pinned: Schema.Boolean.pipe(Schema.optional, Schema.mutableKey),
  repliedToMessageId: snowflakeArraySchema.pipe(
    Schema.optional,
    Schema.mutableKey
  ),
  repliedToUserId: snowflakeArraySchema.pipe(
    Schema.optional,
    Schema.mutableKey
  ),
  slop: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)).pipe(
    Schema.optional,
    Schema.mutableKey
  ),
  sortBy: Schema.Literals(["timestamp", "relevance"]).pipe(
    Schema.optional,
    Schema.mutableKey
  ),
  sortOrder: Schema.Literals(["asc", "desc"]).pipe(
    Schema.optional,
    Schema.mutableKey
  ),
});

/** Inferred Discord embed payload. */
export type Embed = typeof EmbedSchema.Type;

/** Inferred embed field payload. */
export type EmbedField = typeof EmbedFieldSchema.Type;

/** Inferred Discord user payload. */
export type User = typeof UserSchema.Type;

/** Inferred Discord message payload. */
export type Message = typeof MessageSchema.Type;

/** Inferred Discord thread payload. */
export type Thread = typeof ThreadSchema.Type;

/** Inferred Discord guild-member payload. */
export type Member = typeof MemberSchema.Type;

/** Inferred Discord message-search response. */
export type SearchResponse = typeof SearchResponseSchema.Type;

/** Inferred response returned while Discord indexes search results. */
export type IndexNotReadyResponse = typeof IndexNotReadyResponseSchema.Type;

/** Inferred and validated search filter parameters. */
export type SearchParams = typeof SearchParamsSchema.Type;

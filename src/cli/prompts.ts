import {
  cancel,
  confirm,
  isCancel,
  multiselect,
  password,
  select,
  text,
} from "@clack/prompts";
import { z } from "zod";

import { INTEGER_REGEX, parseCommaSeparated } from "@/cli/utils.ts";
import { SNOWFLAKE_REGEX } from "@/discord/schemas.ts";
import type { SearchParams } from "@/discord/schemas.ts";

const VALID_CONTENT_FILTERS = new Set([
  "embed",
  "file",
  "image",
  "link",
  "poll",
  "snapshot",
  "sound",
  "sticker",
  "video",
]);

const INVALID_INTEGER_MESSAGE = "Must be a number";

const PROMPT_CANCEL_MESSAGE = "Search cancelled.";

const parsePromptResult = <Input, Schema extends z.ZodType<Input>>(
  input: Input | symbol,
  schema: Schema
): z.infer<Schema> => {
  if (isCancel(input)) {
    cancel(PROMPT_CANCEL_MESSAGE);
    process.exit(0);
  }

  return schema.parse(input);
};

/**
 * Exit the process when a Clack prompt is cancelled.
 *
 * @param value - The prompt result or Clack's cancellation symbol.
 */
export const handleCancel: CancelPrompt = <T>(
  value: T | symbol
): asserts value is T => {
  if (isCancel(value)) {
    cancel(PROMPT_CANCEL_MESSAGE);
    process.exit(0);
  }
};

const textResultSchema = z.string();

/** Parse a text-prompt result, terminating cleanly on cancellation.
 *
 * @param input - Text prompt response or Clack's cancellation symbol.
 * @returns The validated prompt text.
 */
export const parseTextPrompt = (input: string | symbol): string =>
  parsePromptResult(input, textResultSchema);

const booleanResultSchema = z.boolean();

/** Parse a confirmation result, terminating cleanly on cancellation.
 *
 * @param input - Confirmation response or Clack's cancellation symbol.
 * @returns The validated confirmation value.
 */
export const parseBooleanPrompt = (input: boolean | symbol): boolean =>
  parsePromptResult(input, booleanResultSchema);

const authorTypesSchema = z.array(z.enum(["user", "bot", "webhook"]));

const contentFiltersSchema = z.array(
  z.enum([
    "embed",
    "file",
    "image",
    "link",
    "poll",
    "snapshot",
    "sound",
    "sticker",
    "video",
  ])
);

const sortBySchema = z.enum(["timestamp", "relevance"]);

const sortOrderSchema = z.enum(["desc", "asc"]);

type CancelPrompt = <T>(value: T | symbol) => asserts value is T;

/**
 * Prompt for a Discord bot token.
 *
 * @returns The entered bot token.
 */
export const promptForToken = async (): Promise<string> =>
  parsePromptResult(
    await password({
      message: "Enter your Discord Bot Token:",
      validate: (value) =>
        value?.trim().length !== undefined && value.trim().length > 0
          ? undefined
          : "Token cannot be empty",
    }),
    textResultSchema
  );

/**
 * Prompt for Discord search parameters.
 *
 * @param defaultGuildId - Optional guild ID to prefill.
 * @returns The validated search parameters.
 */
export const promptForSearchParams = async (
  defaultGuildId?: string
): Promise<SearchParams> => {
  const guildId = parsePromptResult(
    await text({
      initialValue: defaultGuildId,
      message: "Guild (Server) ID:",
      validate: (v) => {
        const trimmed = v?.trim() ?? "";

        if (trimmed.length === 0) {
          return "Guild ID is required";
        }

        return SNOWFLAKE_REGEX.test(trimmed)
          ? undefined
          : "Guild ID must be a 17–20 digit Discord snowflake";
      },
    }),
    textResultSchema
  );

  const content = parsePromptResult(
    await text({
      message: "Content filter (leave empty for all):",
      placeholder: "search text...",
    }),
    textResultSchema
  );

  const authorIds = parsePromptResult(
    await text({
      message: "Author IDs (comma-separated, leave empty for all):",
      placeholder: "123456789,987654321",
    }),
    textResultSchema
  );

  const filterByAuthorType = parsePromptResult(
    await confirm({
      initialValue: false,
      message: "Filter by author type?",
    }),
    booleanResultSchema
  );

  let authorType: ("user" | "bot" | "webhook")[] | undefined;

  if (filterByAuthorType) {
    const selected = parsePromptResult(
      await multiselect({
        message: "Author type:",
        options: [
          { label: "Users", value: "user" },
          { label: "Bots", value: "bot" },
          { label: "Webhooks", value: "webhook" },
        ],
        required: false,
      }),
      authorTypesSchema
    );

    if (selected.length > 0) {
      authorType = selected.filter(
        (value): value is "user" | "bot" | "webhook" =>
          value === "user" || value === "bot" || value === "webhook"
      );
    }
  }

  const mentionIds = parsePromptResult(
    await text({
      message: "Mentions user IDs (comma-separated, leave empty to skip):",
      placeholder: "123456789",
    }),
    textResultSchema
  );

  const channelIds = parsePromptResult(
    await text({
      message: "Channel IDs (comma-separated, leave empty for all):",
      placeholder: "123456789,987654321",
    }),
    textResultSchema
  );

  const hasFilter = parsePromptResult(
    await multiselect({
      message: "Has content type (select none to skip):",
      options: [
        { label: "Embed", value: "embed" },
        { label: "Image", value: "image" },
        { label: "Video", value: "video" },
        { label: "File", value: "file" },
        { label: "Link", value: "link" },
        { label: "Sticker", value: "sticker" },
        { label: "Sound", value: "sound" },
        { label: "Poll", value: "poll" },
        { label: "Snapshot", value: "snapshot" },
      ],
      required: false,
    }),
    contentFiltersSchema
  );

  const sortBy = parsePromptResult(
    await select({
      message: "Sort by:",
      options: [
        { label: "Timestamp", value: "timestamp" },
        { label: "Relevance", value: "relevance" },
      ],
    }),
    sortBySchema
  );

  const sortOrder = parsePromptResult(
    await select({
      message: "Sort order:",
      options: [
        { label: "Newest first", value: "desc" },
        { label: "Oldest first", value: "asc" },
      ],
    }),
    sortOrderSchema
  );

  const includeNsfw = parsePromptResult(
    await confirm({
      initialValue: false,
      message: "Include NSFW channels?",
    }),
    booleanResultSchema
  );

  const limitInput = parsePromptResult(
    await text({
      message: "Max messages to fetch (leave empty for all):",
      placeholder: "e.g. 100",
      validate: (v) => {
        const trimmed = v?.trim() ?? "";

        return trimmed.length > 0 && !INTEGER_REGEX.test(trimmed)
          ? INVALID_INTEGER_MESSAGE
          : undefined;
      },
    }),
    textResultSchema
  );

  const offsetInput = parsePromptResult(
    await text({
      message: "Offset / skip first N results (leave empty for 0):",
      placeholder: "e.g. 50",
      validate: (v) => {
        const trimmed = v?.trim() ?? "";

        return trimmed.length > 0 && !INTEGER_REGEX.test(trimmed)
          ? INVALID_INTEGER_MESSAGE
          : undefined;
      },
    }),
    textResultSchema
  );

  const params: SearchParams = {
    guildId: guildId.trim(),
    includeNsfw,
    sortBy,
    sortOrder,
  };

  const contentStr = content.trim();

  if (contentStr) {
    params.content = contentStr;
  }

  const authorIdList = parseCommaSeparated(authorIds);

  if (authorIdList && authorIdList.length > 0) {
    params.authorId = authorIdList;
  }

  if (authorType) {
    params.authorType = authorType;
  }

  const mentionList = parseCommaSeparated(mentionIds);

  if (mentionList && mentionList.length > 0) {
    params.mentions = mentionList;
  }

  const channelList = parseCommaSeparated(channelIds);

  if (channelList && channelList.length > 0) {
    params.channelId = channelList;
  }

  const hasFilterArr = hasFilter;

  if (hasFilterArr.length > 0) {
    params.has = hasFilterArr.filter(
      (filter): filter is NonNullable<SearchParams["has"]>[number] =>
        VALID_CONTENT_FILTERS.has(filter)
    );
  }

  const limitStr = limitInput.trim();

  if (limitStr.length > 0) {
    params.limit = Math.trunc(Number(limitStr));
  }

  const offsetStr = offsetInput.trim();

  if (offsetStr.length > 0) {
    params.offset = Math.trunc(Number(offsetStr));
  }

  return params;
};

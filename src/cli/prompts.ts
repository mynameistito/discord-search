import {
  cancel,
  confirm,
  isCancel,
  multiselect,
  password,
  select,
  text,
} from "@clack/prompts";
import type { SearchParams } from "@/discord/schemas.ts";

export const handleCancel = (value: unknown): void => {
  if (isCancel(value)) {
    cancel("Search cancelled.");
    process.exit(0);
  }
};

export const parseCommaSeparated = (value: string): string[] | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

export const promptForToken = async (): Promise<string> => {
  const token = await password({
    message: "Enter your Discord Bot Token:",
    validate: (v) => (v?.trim() ? undefined : "Token cannot be empty"),
  });
  handleCancel(token);
  return token as string;
};

export const promptForSearchParams = async (
  defaultGuildId?: string
): Promise<SearchParams> => {
  const guildId = await text({
    message: "Guild (Server) ID:",
    initialValue: defaultGuildId,
    validate: (v) => {
      if (!v?.trim()) {
        return "Guild ID is required";
      }
    },
  });
  handleCancel(guildId);

  const content = await text({
    message: "Content filter (leave empty for all):",
    placeholder: "search text...",
  });
  handleCancel(content);

  const authorIds = await text({
    message: "Author IDs (comma-separated, leave empty for all):",
    placeholder: "123456789,987654321",
  });
  handleCancel(authorIds);

  const filterByAuthorType = await confirm({
    message: "Filter by author type?",
    initialValue: false,
  });
  handleCancel(filterByAuthorType);

  let authorType: string | undefined;
  if (filterByAuthorType) {
    const selected = await select({
      message: "Author type:",
      options: [
        { value: "user", label: "Users only" },
        { value: "bot", label: "Bots only" },
        { value: "webhook", label: "Webhooks only" },
      ],
    });
    handleCancel(selected);
    authorType = selected as string;
  }

  const mentionIds = await text({
    message: "Mentions user IDs (comma-separated, leave empty to skip):",
    placeholder: "123456789",
  });
  handleCancel(mentionIds);

  const channelIds = await text({
    message: "Channel IDs (comma-separated, leave empty for all):",
    placeholder: "123456789,987654321",
  });
  handleCancel(channelIds);

  const hasFilter = await multiselect({
    message: "Has content type (select none to skip):",
    options: [
      { value: "embed", label: "Embed" },
      { value: "image", label: "Image" },
      { value: "video", label: "Video" },
      { value: "file", label: "File" },
      { value: "link", label: "Link" },
      { value: "sticker", label: "Sticker" },
      { value: "sound", label: "Sound" },
      { value: "poll", label: "Poll" },
      { value: "snapshot", label: "Snapshot" },
    ],
    required: false,
  });
  handleCancel(hasFilter);

  const sortBy = await select({
    message: "Sort by:",
    options: [
      { value: "timestamp", label: "Timestamp" },
      { value: "relevance", label: "Relevance" },
    ],
  });
  handleCancel(sortBy);

  const sortOrder = await select({
    message: "Sort order:",
    options: [
      { value: "desc", label: "Newest first" },
      { value: "asc", label: "Oldest first" },
    ],
  });
  handleCancel(sortOrder);

  const includeNsfw = await confirm({
    message: "Include NSFW channels?",
    initialValue: false,
  });
  handleCancel(includeNsfw);

  const limitInput = await text({
    message: "Max messages to fetch (leave empty for all):",
    placeholder: "e.g. 100",
    validate: (v) => {
      if (v?.trim() && Number.isNaN(Number.parseInt(v.trim(), 10))) {
        return "Must be a number";
      }
    },
  });
  handleCancel(limitInput);

  const offsetInput = await text({
    message: "Offset / skip first N results (leave empty for 0):",
    placeholder: "e.g. 50",
    validate: (v) => {
      if (v?.trim() && Number.isNaN(Number.parseInt(v.trim(), 10))) {
        return "Must be a number";
      }
    },
  });
  handleCancel(offsetInput);

  const params: SearchParams = {
    guildId: (guildId as string).trim(),
    sortBy: sortBy as "timestamp" | "relevance",
    sortOrder: sortOrder as "asc" | "desc",
    includeNsfw: includeNsfw as boolean,
  };

  const contentStr = (content as string).trim();
  if (contentStr) {
    params.content = contentStr;
  }

  const authorIdList = parseCommaSeparated(authorIds as string);
  if (authorIdList) {
    params.authorId = authorIdList;
  }

  if (authorType) {
    params.authorType = [authorType as "user" | "bot" | "webhook"];
  }

  const mentionList = parseCommaSeparated(mentionIds as string);
  if (mentionList) {
    params.mentions = mentionList;
  }

  const channelList = parseCommaSeparated(channelIds as string);
  if (channelList) {
    params.channelId = channelList;
  }

  const hasFilterArr = hasFilter as string[];
  if (hasFilterArr.length > 0) {
    params.has = hasFilterArr as SearchParams["has"];
  }

  const limitStr = (limitInput as string).trim();
  if (limitStr) {
    params.limit = Number.parseInt(limitStr, 10);
  }

  const offsetStr = (offsetInput as string).trim();
  if (offsetStr) {
    params.offset = Number.parseInt(offsetStr, 10);
  }

  return params;
};

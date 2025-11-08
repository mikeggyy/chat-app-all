const sanitizeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
};

export const buildConversationMetadata = (history) => {
  const messages = Array.isArray(history) ? history : [];
  if (!messages.length) {
    return {};
  }

  const reversed = [...messages].reverse();
  const latestMessage = reversed[0] ?? null;
  const latestPartnerMessage =
    reversed.find((entry) => sanitizeString(entry?.role) === "partner") ?? null;

  const metadata = {};

  const latestText = sanitizeString(latestMessage?.text);
  if (latestText) {
    metadata.lastMessage = latestText;
  }

  const latestTimestamp = sanitizeString(latestMessage?.createdAt);
  if (latestTimestamp) {
    metadata.lastMessageAt = latestTimestamp;
  }

  const partnerReplyAt = sanitizeString(latestPartnerMessage?.createdAt);
  if (partnerReplyAt) {
    metadata.partnerLastRepliedAt = partnerReplyAt;
  }

  const partnerReplyText = sanitizeString(latestPartnerMessage?.text);
  if (partnerReplyText) {
    metadata.partnerLastMessage = partnerReplyText;
  }

  const latestRole = sanitizeString(latestMessage?.role);
  if (latestRole) {
    metadata.lastSpeaker = latestRole;
  }

  const updatedAt =
    sanitizeString(metadata.partnerLastRepliedAt) ||
    sanitizeString(metadata.lastMessageAt);

  metadata.updatedAt = updatedAt || new Date().toISOString();

  return metadata;
};

export const normalizeMetadataCharacterId = (value) => {
  const sanitized = sanitizeString(value);
  return sanitized.length ? sanitized : value;
};

export const trimMetadataString = sanitizeString;


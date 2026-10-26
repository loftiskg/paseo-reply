export const PLUGIN_ID = "selected-reply";
export interface Target { serverId: string; agentId: string }
export interface Quote extends Target { id: string; messageId: string; text: string; comment: string }
export interface Attachment {
  kind: "plugin_resource";
  pluginId: string;
  sourceId: string;
  sourceTitle: string;
  sourceIcon: string;
  item: { id: string; identifier: string; title: string; subtitle: string; url: string; text: string; resourceType: string };
}

export function draftKey(target: Target): string {
  if (!target.serverId || !target.agentId) throw new Error("The conversation could not be identified.");
  return `agent:${target.serverId}:${target.agentId}`;
}

export function toAttachment(quote: Quote): Attachment {
  if (!quote.text.trim()) throw new Error("Select some assistant text first.");
  return {
    kind: "plugin_resource", pluginId: PLUGIN_ID, sourceId: "quotes",
    sourceTitle: "Reply", sourceIcon: "Quote",
    item: {
      id: quote.id, identifier: "Quote", resourceType: "chat_quote",
      title: quote.comment.trim().slice(0, 70) || quote.text.trim().slice(0, 70),
      // Only schema-supported fields are persisted by Paseo. Keep lossless editable data here.
      subtitle: JSON.stringify({ version: 1, ...quote }),
      url: `paseo-reply://quote/${encodeURIComponent(quote.id)}`,
      text: `Selected assistant text (message ${quote.messageId}):\n${quote.text}` +
        (quote.comment ? `\n\nYour comment:\n${quote.comment}` : ""),
    },
  };
}

export function readQuote(value: unknown): Quote | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Partial<Attachment>;
  if (a.kind !== "plugin_resource" || a.pluginId !== PLUGIN_ID || a.sourceId !== "quotes") return null;
  try {
    const q = JSON.parse(a.item?.subtitle ?? "") as Quote & { version: number };
    if (q.version !== 1 || ![q.id, q.messageId, q.text, q.comment, q.serverId, q.agentId].every(v => typeof v === "string") ||
        !q.id || !q.messageId || !q.text.trim() || !q.serverId || !q.agentId || a.item?.id !== q.id) return null;
    return q;
  } catch { return null; }
}

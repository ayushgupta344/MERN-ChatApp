import useScrollToBottom from "../../hooks/useScrollToBottom";
import { MessageBubble } from "./MessageBubble";
import { NoConversationPlaceholder } from "./NoConversationPlaceholder";
import { useSelectedConversation } from "../../hooks/useSelectedConversation";
import { useChatStore } from "../../store/useChatStore";

// ── Date Grouping Helper ─────────────────────────────────────────────────────
function getDateLabel(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 6);

  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";
  if (date >= startOfWeek) {
    return date.toLocaleDateString([], { weekday: "long" }); // e.g. "Monday"
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Groups a flat list of messages (from useChatStore.messages) by calendar date.
 * Returns an array of { label: string, messages: RawMessage[] }
 */
function groupMessagesByDate(rawMessages) {
  const groups = [];
  let currentLabel = null;

  for (const msg of rawMessages) {
    const label = getDateLabel(msg.createdAt);
    if (label !== currentLabel) {
      groups.push({ label, messages: [] });
      currentLabel = label;
    }
    groups[groups.length - 1].messages.push(msg);
  }

  return groups;
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────
function MessageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden px-2 py-4 sm:px-3 sm:py-5">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={`flex w-full ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`h-10 animate-pulse rounded-2xl bg-surface ${
              i % 2 === 0 ? "rounded-bl-md" : "rounded-br-md"
            }`}
            style={{ width: `${[45, 60, 35, 55, 40, 50][i]}%` }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function MessageList() {
  const { activeConversation, activeConversationId } = useSelectedConversation();

  // Raw messages with createdAt timestamps for date grouping
  const rawMessages = useChatStore((state) => state.messages);
  const isMessagesLoading = useChatStore((state) => state.isMessagesLoading);

  const lastMessageId = activeConversation?.messages.at(-1)?.id;
  const messagesScrollRef = useScrollToBottom(activeConversationId, lastMessageId);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {!activeConversation ? (
        <NoConversationPlaceholder />
      ) : isMessagesLoading ? (
        <MessageSkeleton />
      ) : (
        <div
          ref={messagesScrollRef}
          className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-3 sm:py-4"
        >
          {rawMessages.length === 0 ? (
            <p className="my-auto text-center text-sm text-muted">
              No messages yet. Say hello! 👋
            </p>
          ) : (
            groupMessagesByDate(rawMessages).map(({ label, messages: group }) => (
              <div key={label}>
                {/* Date divider */}
                <div className="my-3 flex items-center gap-3">
                  <div className="flex-1 border-t border-border" />
                  <p className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted">
                    {label}
                  </p>
                  <div className="flex-1 border-t border-border" />
                </div>

                {/* Messages for this date group */}
                <div className="flex flex-col gap-1">
                  {group.map((message) => {
                    // Map raw message to the shape MessageBubble expects
                    const mappedMsg = activeConversation.messages.find(
                      (m) => m.id === message._id,
                    );
                    if (!mappedMsg) return null;
                    return <MessageBubble key={mappedMsg.id} message={mappedMsg} />;
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

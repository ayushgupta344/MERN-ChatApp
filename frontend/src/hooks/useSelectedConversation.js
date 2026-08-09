import { useMediaQuery } from "./useMediaQuery";
import { formatMessageTime } from "../lib/utils";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

export function getInitials(name) {
  if (!name) return "??";
  return name
    .split(" ")
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join("");
}

function mapUserToConversation({ user, messages, authUser, onlineUsers }) {
  const mappedMessages = messages.map((message) => ({
    id: message._id,
    role: String(message.senderId) === String(authUser?._id) ? "me" : "them",
    text: message.text || "",
    time: formatMessageTime(message.createdAt),
    imageUrl: message.image,
    videoUrl: message.video,
  }));

  const onlineSet = new Set(onlineUsers.map((id) => String(id)));
  const isOnline = onlineSet.has(String(user._id));

  return {
    id: String(user._id),
    peer: {
      name: user.fullName,
      subtitle: user.email,
      isOnline,
      avatarUrl: user.profilePic,
      initials: getInitials(user.fullName),
    },
    messages: mappedMessages,
  };
}

export function useSelectedConversation() {
  const activeConversationId = useChatStore(
    (state) => state.activeConversationId,
  );
  const conversations = useChatStore((state) => state.conversations);
  const users = useChatStore((state) => state.users);
  const messages = useChatStore((state) => state.messages);

  const authUser = useAuthStore((state) => state.authUser);
  const onlineUsers = useAuthStore((state) => state.onlineUsers);

  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const selectedUser = activeConversationId
    ? users.find((user) => String(user._id) === String(activeConversationId)) ||
      conversations.find((user) => String(user._id) === String(activeConversationId))
    : null;

  const activeConversation = selectedUser
    ? mapUserToConversation({
        user: selectedUser,
        messages,
        authUser,
        onlineUsers,
      })
    : null;

  return {
    activeConversation,
    activeConversationId,
    isLargeScreen,
  };
}

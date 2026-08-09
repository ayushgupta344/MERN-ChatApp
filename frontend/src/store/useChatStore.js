import { create } from "zustand";
import { persist } from "zustand/middleware";

import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

export const useChatStore = create(
  persist(
    (set, get) => ({
      users: [],
      conversations: [],
      messages: [],
      selectedUser: null,
      isConversationsLoading: false,
      isUsersLoading: false,
      isMessagesLoading: false,
      activeConversationId: null,
      searchQuery: "",
      sidebarTab: "chats",
      composerText: "",
      isSoundEnabled: true,
      isSendingMedia: false,

      getUsers: async () => {
        set({ isUsersLoading: true });
        try {
          const res = await axiosInstance.get("/messages/users");
          set((state) => ({
            users: res.data,
            selectedUser:
              state.selectedUser &&
              res.data.some((user) => String(user._id) === String(state.selectedUser._id))
                ? state.selectedUser
                : null,
          }));
        } catch (error) {
          console.error("Error in getUsers:", error.message);
        } finally {
          set({ isUsersLoading: false });
        }
      },

      getConversations: async () => {
        set({ isConversationsLoading: true });
        try {
          const res = await axiosInstance.get("/messages/conversations");
          set({ conversations: res.data });
        } catch (error) {
          console.error("Error in getConversations:", error.message);
        } finally {
          set({ isConversationsLoading: false });
        }
      },

      getMessages: async (userId) => {
        if (!userId) return;
        set({ isMessagesLoading: true });
        try {
          const res = await axiosInstance.get(`/messages/${userId}`);
          set({ messages: res.data });
        } catch (error) {
          toast.error(
            error.response?.data?.message || "Failed to load messages",
          );
        } finally {
          set({ isMessagesLoading: false });
        }
      },

      sendMessage: async (messageData) => {
        const { selectedUser, messages } = get();
        if (!selectedUser) return false;

        try {
          const res = await axiosInstance.post(
            `/messages/send/${selectedUser._id}`,
            messageData,
          );
          set({ messages: [...messages, res.data], composerText: "" });

          // Optimistically move this conversation to top of sidebar
          set((state) => {
            const partnerId = String(selectedUser._id);
            const alreadyInConversations = state.conversations.some(
              (c) => String(c._id) === partnerId,
            );
            if (alreadyInConversations) {
              const updated = state.conversations.filter(
                (c) => String(c._id) !== partnerId,
              );
              const existing = state.conversations.find(
                (c) => String(c._id) === partnerId,
              );
              return { conversations: [existing, ...updated] };
            } else {
              return { conversations: [selectedUser, ...state.conversations] };
            }
          });

          return true;
        } catch (error) {
          toast.error(
            error.response?.data?.message || "Failed to send message",
          );
          return false;
        }
      },

      // ─────────────────────────────────────────────────────────────────────
      // GLOBAL REAL-TIME SOCKET LISTENER:
      // Listens for ALL incoming messages across the entire app.
      // Updates active chat messages AND sidebar conversations automatically!
      // ─────────────────────────────────────────────────────────────────────
      initSocketListener: (socket) => {
        if (!socket) return;

        // Clean up previous listener to prevent duplicates
        socket.off("newMessage");

        socket.on("newMessage", (newMessage) => {
          const { activeConversationId, conversations, users } = get();
          const senderIdStr = String(newMessage.senderId);
          const receiverIdStr = String(newMessage.receiverId);
          const myId = String(useAuthStore.getState().authUser?._id);
          const currentActiveIdStr = activeConversationId ? String(activeConversationId) : null;

          // 1. If the message belongs to the currently active conversation, append it
          const isForCurrentChat =
            currentActiveIdStr &&
            ((senderIdStr === currentActiveIdStr && receiverIdStr === myId) ||
              (senderIdStr === myId && receiverIdStr === currentActiveIdStr));

          if (isForCurrentChat) {
            set((state) => ({ messages: [...state.messages, newMessage] }));
          }

          // 2. Always move the chat partner to the top of the sidebar list
          const partnerId = senderIdStr === myId ? receiverIdStr : senderIdStr;

          set((state) => {
            const existingConv = state.conversations.find(
              (c) => String(c._id) === partnerId,
            );
            const userObj =
              existingConv || state.users.find((u) => String(u._id) === partnerId);

            if (!userObj) return {};

            const filteredConvs = state.conversations.filter(
              (c) => String(c._id) !== partnerId,
            );
            return { conversations: [userObj, ...filteredConvs] };
          });
        });
      },

      subscribeToMessages: (userId) => {
        // Fallback for component compatibility: binds listener if socket is ready
        const socket = useAuthStore.getState().socket;
        if (socket) {
          get().initSocketListener(socket);
        }
      },

      unsubscribeFromMessages: () => {
        // No-op for global listener so real-time background notifications work smoothly
      },

      setSelectedUser: (selectedUser) => set({ selectedUser }),

      setActiveConversationId: (activeConversationId) => {
        set((state) => ({
          activeConversationId,
          selectedUser: activeConversationId
            ? state.users.find((user) => String(user._id) === String(activeConversationId)) ||
              state.conversations.find(
                (user) => String(user._id) === String(activeConversationId),
              ) ||
              null
            : null,
          messages: activeConversationId ? state.messages : [],
        }));
      },

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setComposerText: (composerText) => set({ composerText }),
      setSoundEnabled: (isSoundEnabled) => set({ isSoundEnabled }),

      sendTextMessage: async (conversationId) => {
        const messageText = get().composerText.trim();
        if (!conversationId || !messageText) return false;

        return get().sendMessage({ text: messageText });
      },

      sendMediaMessage: async ({ conversationId, file }) => {
        if (!conversationId || !file) return false;

        const formData = new FormData();
        formData.append("media", file);

        set({ isSendingMedia: true });
        try {
          return await get().sendMessage(formData);
        } finally {
          set({ isSendingMedia: false });
        }
      },
    }),
    {
      name: "imessage-storage",
      partialize: (state) => ({ isSoundEnabled: state.isSoundEnabled }),
    },
  ),
);

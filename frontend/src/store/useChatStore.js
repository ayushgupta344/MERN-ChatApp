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
              res.data.some((user) => user._id === state.selectedUser._id)
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

          // Optimistically move this conversation to the top of the sidebar
          // instead of re-fetching the entire list from the server.
          set((state) => {
            const partnerId = String(selectedUser._id);
            const alreadyInConversations = state.conversations.some(
              (c) => String(c._id) === partnerId,
            );
            if (alreadyInConversations) {
              // Bring existing conversation to the top
              const updated = state.conversations.filter(
                (c) => String(c._id) !== partnerId,
              );
              const existing = state.conversations.find(
                (c) => String(c._id) === partnerId,
              );
              return { conversations: [existing, ...updated] };
            } else {
              // New conversation — add the selectedUser to the top
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
      // FIX: Use a named handler stored on the store so we can remove only
      // THIS specific listener (not all "newMessage" listeners globally).
      // This prevents the React Strict Mode double-invoke race condition.
      // ─────────────────────────────────────────────────────────────────────
      _newMessageHandler: null,

      subscribeToMessages: (userId) => {
        if (!userId) return;

        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        // Remove the previous named handler if one exists, safely.
        const prevHandler = get()._newMessageHandler;
        if (prevHandler) {
          socket.off("newMessage", prevHandler);
        }

        // Create a new named handler scoped to the current userId (conversation partner).
        const handler = (newMessage) => {
          const senderIdStr = String(newMessage.senderId);
          const receiverIdStr = String(newMessage.receiverId);
          const userIdStr = String(userId);
          const myId = String(useAuthStore.getState().authUser?._id);

          // Only append the message if it belongs to the active conversation:
          // Either they sent it to me, or I sent it to them (for multi-tab support).
          const isRelevant =
            (senderIdStr === userIdStr && receiverIdStr === myId) ||
            (senderIdStr === myId && receiverIdStr === userIdStr);

          if (!isRelevant) return;

          set((state) => ({ messages: [...state.messages, newMessage] }));

          // Bring this conversation to the top of the sidebar optimistically.
          set((state) => {
            const partnerId = userIdStr;
            const updated = state.conversations.filter(
              (c) => String(c._id) !== partnerId,
            );
            const existing = state.conversations.find(
              (c) => String(c._id) === partnerId,
            );
            if (existing) {
              return { conversations: [existing, ...updated] };
            }
            return {};
          });
        };

        socket.on("newMessage", handler);
        set({ _newMessageHandler: handler });
      },

      unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        const handler = get()._newMessageHandler;
        if (socket && handler) {
          socket.off("newMessage", handler);
        }
        set({ _newMessageHandler: null });
      },

      setSelectedUser: (selectedUser) => set({ selectedUser }),

      setActiveConversationId: (activeConversationId) => {
        set((state) => ({
          activeConversationId,
          selectedUser: activeConversationId
            ? state.users.find((user) => user._id === activeConversationId) ||
              state.conversations.find(
                (user) => user._id === activeConversationId,
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

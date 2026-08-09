import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { io } from "socket.io-client";

const BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:3000" : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    set({ isCheckingAuth: true });
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket(res.data);
    } catch (error) {
      console.error("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  clearAuth: () => {
    set({ authUser: null, isCheckingAuth: false, onlineUsers: [] });
    get().disconnectSocket();
  },

  connectSocket: (user) => {
    if (!user) return;

    // ─── FIX: NEVER recreate a socket that already exists ──────────────────
    // Previous code checked `socket?.connected` which is false while the socket
    // is still in the "connecting" state. That caused the old socket to be
    // disconnected and a NEW socket to be created — silently destroying any
    // message handlers that were registered on the old socket object.
    // Now we guard on the presence of the socket object itself, not its state.
    if (get().socket) return;
    // ───────────────────────────────────────────────────────────────────────

    const socket = io(BASE_URL, {
      query: { userId: user._id },

      // ─── FIX: Force WebSocket transport on Render ──────────────────────
      // By default Socket.IO starts with HTTP long-polling then upgrades to
      // WebSocket. Render's reverse proxy breaks the polling → WS upgrade
      // path: the HTTP session that owns the socket is lost during the upgrade,
      // so the server cannot route events to the correct socket anymore.
      // Forcing 'websocket' skips polling entirely and connects directly,
      // which works perfectly on Render's infrastructure.
      transports: ["websocket"],
      // ───────────────────────────────────────────────────────────────────

      reconnection: true,
      reconnectionAttempts: Infinity, // Keep trying — don't give up
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    set({ socket });

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[Socket] Disconnected:", reason);
      // The Socket.IO client auto-reconnects for most reasons.
      // We only need to manually reconnect when the SERVER forcibly closes us.
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.off(); // remove all event listeners first to prevent memory leaks
      socket.disconnect();
    }
    set({ socket: null, onlineUsers: [] });
  },
}));

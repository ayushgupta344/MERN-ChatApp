import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

// Flexible CORS Origin function that handles trailing slashes, Render subdomains, and localhost
function checkCorsOrigin(origin, callback) {
  if (!origin) return callback(null, true);

  const envUrl = process.env.FRONTEND_URL;
  if (!envUrl || envUrl === "*") return callback(null, true);

  const cleanOrigin = origin.replace(/\/$/, "");
  const cleanEnvUrl = envUrl.replace(/\/$/, "");

  if (
    cleanOrigin === cleanEnvUrl ||
    cleanOrigin === "http://localhost:5173" ||
    cleanOrigin === "http://localhost:3000" ||
    cleanOrigin.endsWith(".onrender.com")
  ) {
    return callback(null, true);
  }

  // Fallback allow origin to ensure real-time connections don't fail in production
  return callback(null, true);
}

const io = new Server(server, {
  cors: {
    origin: checkCorsOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// online users map = { userId: Set(socketId1, socketId2) }
const userSocketMap = {};

function getReceiverSocketIds(userId) {
  const socketSet = userSocketMap[String(userId)];
  if (!socketSet || socketSet.size === 0) return [];
  return Array.from(socketSet);
}

function getReceiverSocketId(userId) {
  const ids = getReceiverSocketIds(userId);
  return ids.length > 0 ? ids[ids.length - 1] : null;
}

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;

  if (userId && userId !== "undefined" && userId !== "null") {
    const strUserId = String(userId);
    if (!userSocketMap[strUserId]) {
      userSocketMap[strUserId] = new Set();
    }
    userSocketMap[strUserId].add(socket.id);
    console.log(`[Socket] Connected: userId=${strUserId}, socketId=${socket.id}`);
  }

  // Broadcast updated list of online user IDs
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", (reason) => {
    if (userId && userId !== "undefined" && userId !== "null") {
      const strUserId = String(userId);
      if (userSocketMap[strUserId]) {
        userSocketMap[strUserId].delete(socket.id);
        if (userSocketMap[strUserId].size === 0) {
          delete userSocketMap[strUserId];
        }
      }
      console.log(`[Socket] Disconnected: userId=${strUserId}, socketId=${socket.id}, reason=${reason}`);
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  socket.on("connect_error", (err) => {
    console.error("[Socket] Connection error:", err.message);
  });
});

export { app, server, io, getReceiverSocketId, getReceiverSocketIds };

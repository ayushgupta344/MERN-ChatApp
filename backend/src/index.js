import express from "express";
import dotenv from "dotenv/config";
import { connectDB } from "./lib/db.js";
import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import fs from "fs";
import path from "path";
import job from "./lib/cron.js";
import clerkWebhook from "./webhooks/clerk.webhook.js";
import authRouter from "./routes/auth.routes.js";
import messageRouter from "./routes/message.routes.js";
import { server, app } from "./lib/socket.js";

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL;
const publicDir = path.join(process.cwd(), "public");

// Clerk webhook must be registered before express.json() to receive raw body
app.use(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  clerkWebhook,
);

app.use(express.json({ limit: "10mb" }));
app.use(
  cors({
    origin: FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(clerkMiddleware());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/messages", messageRouter);

// Serve built frontend in production
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get("/{*any}", (req, res, next) => {
    res.sendFile(path.join(publicDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

// Global error handler — catches Multer errors (file too large, wrong type), etc.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);

  // Multer-specific errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File is too large. Maximum size is 25 MB." });
  }
  if (err.message === "Only image and video uploads are allowed") {
    return res.status(415).json({ message: err.message });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: err.message || "Internal server error" });
});

server.listen(PORT, () => {
  connectDB();
  console.log(`Server is running on port ${PORT}`);
  if (process.env.NODE_ENV === "production") {
    job.start();
  }
});
import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./lib/db.js";
import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import fs from "fs";
import path from "path";
import job from "./lib/cron.js";
import clerkWebhook from "./webhooks/clerk.webhook.js";
import authRouter from "./routes/auth.routes.js";
dotenv.config();
const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL;
const publicDir = path.join(process.cwd(), "public");
app.use(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  clerkWebhook,
);
app.use(express.json());
app.use(cors(
  {origin:process.env.FRONTEND_URL,
  credentials:true}
));
app.use(clerkMiddleware()); 
app.get('/health', (req, res) => {
  res.send('Hello World!');
});
app.use('/api/auth',authRouter);
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get("/{*any}", (req, res, next) => {
    res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
  });
}

app.listen(process.env.PORT, () => {
  connectDB();
  console.log(`Server is running on port ${process.env.PORT}`);
  if(process.env.NODE_ENV === "production") {
    job.start();
}
}
)
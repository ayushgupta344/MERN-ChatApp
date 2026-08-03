import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./lib/db.js";
import { clerkMiddleware } from "@clerk/express";
import cors from "cors"; 
dotenv.config();
const app = express();
app.get('/', (req, res) => {
  res.send('Hello World!');
});
app.use(express.json());
app.use(cors(
  {origin:process.env.FRONTEND_URL,
  credentials:true}
));
app.use(clerkMiddleware()); 
app.listen(process.env.PORT, () => {
  connectDB();
  console.log(`Server is running on port ${process.env.PORT}`);
}
)
import express from "express";
import cors from "cors";

// Ensure DB connection is established when the server starts
import db from "./db.js";

import authRoutes from "./routes/authRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import classRoutes from "./routes/classRoutes.js";
import lecturerRoutes from "./routes/lecturerRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import monitoringRoutes from "./routes/monitoringRoutes.js";

const app = express();

// Middleware
app.use(
  cors({ origin: "http://localhost:3000", methods: ["GET", "POST", "PUT", "DELETE"], credentials: true })
);
app.use(express.json());

// Mount routes
app.use("/api/users", authRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/lecturer", lecturerRoutes);
app.use("/api/students", studentRoutes);

// Health endpoints
app.get("/", (req, res) => res.send("Backend is running"));
app.get("/api/health", (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || "development" }));

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

export default app;
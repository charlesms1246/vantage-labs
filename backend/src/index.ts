import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { logger } from "./services/logger";
import { config } from "./config/env";
import { Orchestrator } from "./agents/orchestrator";
import { Eric } from "./agents/eric";
import { Harper } from "./agents/harper";
import { Rishi } from "./agents/rishi";
import { Yasmin } from "./agents/yasmin";
import { WebSocketHandler } from "./websocket/handler";
import logsRouter from "./routes/logs";
import apiRoutes from "./routes/api";
import healthRoutes from "./routes/health";
import { errorHandler } from "./middleware/error";
import { optionalAuth } from "./middleware/auth";

const app = express();
const httpServer = createServer(app);

const corsOptions = {
  origin: config.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

const io = new Server(httpServer, {
  cors: { origin: config.FRONTEND_URL, methods: ["GET", "POST"], credentials: true },
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(optionalAuth);

app.use("/logs", logsRouter);
app.use("/api", apiRoutes);
app.use("/health", healthRoutes);

// Initialize agent swarm
const orchestrator = new Orchestrator();
orchestrator.registerAgent(new Eric());
orchestrator.registerAgent(new Harper());
orchestrator.registerAgent(new Rishi());
orchestrator.registerAgent(new Yasmin());

// WebSocket
new WebSocketHandler(io, orchestrator);

app.use(errorHandler);

httpServer.listen(config.PORT, () => {
  logger.info("SYSTEM", `Vantage Labs Backend running on port ${config.PORT}`);
  logger.info("SYSTEM", `Agents registered: ${orchestrator.getAgentNames().join(", ")}`);
  logger.info("SYSTEM", `WebSocket: ws://localhost:${config.PORT}`);
  logger.info("SYSTEM", `Logs: http://localhost:${config.PORT}/logs`);
});

export { app, httpServer };

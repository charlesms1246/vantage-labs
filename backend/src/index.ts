import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { config } from "./config/env";
import { Orchestrator } from "./agents/orchestrator";
import { Eric } from "./agents/eric";
import { Harper } from "./agents/harper";
import { Rishi } from "./agents/rishi";
import { Yasmin } from "./agents/yasmin";
import { WebSocketHandler } from "./websocket/handler";
import apiRoutes from "./routes/api";
import healthRoutes from "./routes/health";
import { errorHandler } from "./middleware/error";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.FRONTEND_URL, methods: ["GET", "POST"] },
});

app.use(cors({ origin: config.FRONTEND_URL }));
app.use(express.json());

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
  console.log(`Vantage Labs Backend running on port ${config.PORT}`);
  console.log(`Agents registered: ${orchestrator.getAgentNames().join(", ")}`);
  console.log(`WebSocket: ws://localhost:${config.PORT}`);
  console.log(`Health: http://localhost:${config.PORT}/health`);
});

export { app, httpServer };

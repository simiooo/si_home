import { Server, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyToken } from "./utils/jwt.js";

interface ClientConnection {
  ws: WebSocket;
  userId: number;
  deviceId: string;
}

const clients = new Map<number, ClientConnection[]>();

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const token = url.searchParams.get("token");
      const deviceId = url.searchParams.get("deviceId");

      if (!token || !deviceId) {
        ws.close(1008, "Missing token or deviceId");
        return;
      }

      const payload = verifyToken(token);
      if (!payload) {
        ws.close(1008, "Invalid token");
        return;
      }

      const userId = payload.userId;

      const clientConn: ClientConnection = { ws, userId, deviceId };
      
      if (!clients.has(userId)) {
        clients.set(userId, []);
      }
      clients.get(userId)!.push(clientConn);

      console.log(`WebSocket connected: user ${userId}, device ${deviceId}`);

      ws.on("close", () => {
        const userClients = clients.get(userId);
        if (userClients) {
          const index = userClients.findIndex(c => c.ws === ws);
          if (index > -1) {
            userClients.splice(index, 1);
          }
          if (userClients.length === 0) {
            clients.delete(userId);
          }
        }
        console.log(`WebSocket disconnected: user ${userId}, device ${deviceId}`);
      });

      ws.on("error", (error: Error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
      });

      ws.send(JSON.stringify({ type: "connected", data: { deviceId } }));
    } catch (error) {
      console.error("WebSocket connection error:", error);
      ws.close(1011, "Internal error");
    }
  });
}

export function broadcastToUser(
  userId: number,
  message: unknown,
  excludeDeviceId?: string
): void {
  const userClients = clients.get(userId);
  if (!userClients) return;

  const messageStr = JSON.stringify(message);
  
  for (const client of userClients) {
    if (excludeDeviceId && client.deviceId === excludeDeviceId) continue;
    
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  }
}

export function broadcastOperation(
  userId: number,
  operation: {
    type: "ADD" | "UPDATE" | "DELETE";
    entityType: "collection" | "tab";
    entityId: string;
    collectionId?: string;
    data: Record<string, unknown>;
    version: number;
  },
  sourceDeviceId: string
): void {
  broadcastToUser(
    userId,
    {
      type: "operation",
      data: {
        ...operation,
        deviceId: sourceDeviceId,
        timestamp: new Date().toISOString(),
      },
    },
    sourceDeviceId
  );
}

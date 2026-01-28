import "dotenv/config";
import { Application } from "@oak/oak";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { initDatabase } from "./db.js";
import authRoutes from "./routes/authRoutes.js";
import syncRoutes from "./routes/syncRoutes.js";
import { setupWebSocket } from "./websocket.js";

const app = new Application();
const PORT = parseInt(process.env.PORT || "3000");

app.use(async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 200;
    return;
  }

  await next();
});

app.use(authRoutes.routes());
app.use(authRoutes.allowedMethods());

app.use(syncRoutes.routes());
app.use(syncRoutes.allowedMethods());

app.use((ctx) => {
  ctx.response.body = { message: "Si Home Server API" };
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log(`Server is running on http://localhost:${PORT}`);
    
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", async () => {
        const body = Buffer.concat(chunks);
        
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        
        const requestInit: RequestInit = {
          method: req.method,
          headers: req.headers as Record<string, string>,
        };
        
        if (body.length > 0) {
          requestInit.body = body;
        }
        
        const request = new Request(url.toString(), requestInit);
        
        const response = await app.handle(request);
        
        if (response) {
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          
          if (response.body) {
            const reader = response.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          }
        }
        
        res.end();
      });
    });
    
    setupWebSocket(server);
    
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
    
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

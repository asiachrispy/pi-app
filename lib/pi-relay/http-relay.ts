import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";

interface RelayQueues {
  server: string[];
  client: string[];
}

const queues = new Map<string, RelayQueues>();

function getQueues(serverId: string): RelayQueues {
  let entry = queues.get(serverId);
  if (!entry) {
    entry = { server: [], client: [] };
    queues.set(serverId, entry);
  }
  return entry;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export function startPiRelayServer(port: number, host = "127.0.0.1"): ReturnType<typeof createServer> {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const match = url.pathname.match(/^\/relay\/([^/]+)\/(server|client)(?:\/poll)?$/);
      if (!match) {
        writeJson(res, 404, { error: "Not found" });
        return;
      }
      const serverId = decodeURIComponent(match[1] ?? "");
      const role = match[2] as "server" | "client";
      const peer: "server" | "client" = role === "server" ? "client" : "server";
      const queuesForSession = getQueues(serverId);

      if (url.pathname.endsWith("/poll")) {
        const timeoutMs = Number(url.searchParams.get("timeout") ?? "25000");
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const message = queuesForSession[role].shift();
          if (message) {
            writeJson(res, 200, { message });
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        writeJson(res, 204, { message: null });
        return;
      }

      if (req.method !== "POST") {
        writeJson(res, 405, { error: "Method not allowed" });
        return;
      }

      const body = await readBody(req);
      queuesForSession[peer].push(body);
      writeJson(res, 200, { ok: true });
    } catch (error) {
      writeJson(res, 500, { error: String(error) });
    }
  });

  server.listen(port, host);
  return server;
}

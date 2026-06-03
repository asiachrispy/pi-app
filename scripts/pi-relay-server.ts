#!/usr/bin/env node
import { startPiRelayServer } from "../lib/pi-relay/http-relay";

const port = Number(process.env.PI_RELAY_PORT ?? "30142");
const host = process.env.PI_RELAY_HOST ?? "127.0.0.1";

const server = startPiRelayServer(port, host);
console.log(`pi-relay listening on http://${host}:${port}`);
process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});

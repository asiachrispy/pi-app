#!/usr/bin/env node
import { parseOfferUrl } from "../lib/pi-relay/connection-offer";
import { runRelayClientProxy } from "../lib/pi-relay/tunnel";

const offerInput = process.argv[2];
if (!offerInput) {
  console.error("Usage: pi-relay-client <offer-url-or-fragment>");
  process.exit(1);
}

const offer = parseOfferUrl(offerInput);
if (!offer) {
  console.error("Invalid offer URL — expected #pi-offer= fragment");
  process.exit(1);
}

const listenPort = Number(process.env.PI_RELAY_CLIENT_PORT ?? "30143");
const listenHost = process.env.PI_RELAY_CLIENT_HOST ?? "127.0.0.1";

const server = await runRelayClientProxy({
  relayEndpoint: offer.relay.endpoint,
  serverId: offer.serverId,
  hostPublicKeyB64: offer.hostPublicKeyB64,
  listenPort,
  listenHost,
});

console.log(`pi-relay client proxy: http://${listenHost}:${listenPort} (E2EE via ${offer.relay.endpoint})`);
process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});

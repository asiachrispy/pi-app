export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
  createdAt: string;
  userAgent?: string;
}

export interface PushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subscriptions: PushSubscriptionRecord[];
}

export const PUSH_CONFIG_FILENAME = "pi-web-push.json";

export interface PushPublicStatus {
  enabled: boolean;
  publicKey: string | null;
  subscriptionCount: number;
}

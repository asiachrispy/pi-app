declare module "web-push" {
  interface VapidKeys {
    publicKey: string;
    privateKey: string;
  }

  interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  interface WebPush {
    generateVAPIDKeys(): VapidKeys;
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(subscription: PushSubscription, payload: string | Buffer, options?: unknown): Promise<void>;
  }

  const webpush: WebPush;
  export default webpush;
}

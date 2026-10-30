// Toute la configuration vient de variables d'environnement (voir .env.example).
const env = process.env;

export const config = {
  production: env.NODE_ENV === "production" || env.VERCEL_ENV === "production",
  databaseUrl: env.DATABASE_URL ?? "",
  secret: env.SESSION_SECRET ?? "",
  appUrl: (env.APP_URL ?? "").replace(/\/$/, ""),
  // « demo » : le code OTP est renvoyé à l'écran (aucun SMS). « sms » : envoi réel.
  otpMode: (env.OTP_MODE ?? "demo") as "demo" | "sms",
  smsProvider: (env.SMS_PROVIDER ?? "console") as "console" | "http",
  smsApiUrl: env.SMS_API_URL ?? "",
  smsApiKey: env.SMS_API_KEY ?? "",
  smsSender: env.SMS_SENDER ?? "XweTche",
  // « simule » : paiement fictif confirmé automatiquement. « webhook » : confirmation par le prestataire.
  paymentMode: (env.PAYMENT_MODE ?? "simule") as "simule" | "webhook",
  paymentWebhookSecret: env.PAYMENT_WEBHOOK_SECRET ?? "",
  cronSecret: env.CRON_SECRET ?? "",
  // Autorise les modes de démonstration (OTP affiché, paiement simulé) même en production.
  autoriserDemo: env.ALLOW_DEMO === "1",
  blobConfigured: !!(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID),
};

export function verifierConfig() {
  const problemes: string[] = [];
  if (!config.databaseUrl) problemes.push("DATABASE_URL manquant");
  if (config.secret.length < 32) problemes.push("SESSION_SECRET manquant ou trop court (32 caractères minimum)");
  return problemes;
}

export const demoAutorisee = () => !config.production || config.autoriserDemo;

import { ensureDefaultWhatsAppFlow } from "./bootstrap.server";

async function run() {
  try {
    await ensureDefaultWhatsAppFlow();
    process.exit(0);
  } catch (err) {
    console.error("Bootstrap failed:", err);
    process.exit(1);
  }
}

run();

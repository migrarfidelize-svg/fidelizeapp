import { ensureDefaultWhatsAppFlow } from "./bootstrap.server";

async function run() {
  try {
    const establishmentId = process.argv[2];
    if (!establishmentId) throw new Error("Uso: run-bootstrap <establishment_id>");
    await ensureDefaultWhatsAppFlow(establishmentId);
    process.exit(0);
  } catch (err) {
    console.error("Bootstrap failed:", err);
    process.exit(1);
  }
}

run();

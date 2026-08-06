import { getPublicMenuBySlug } from "./src/lib/menu.functions";

async function run() {
  console.log("DEBUG: Iniciando teste...");
  try {
    const res = await getPublicMenuBySlug({ data: { slug: "fidelize-testes" } });
    console.log("DEBUG: Resposta recebida:", res ? "Estabelecimento encontrado" : "Nulo");
    if (res) {
        console.log("Establishment ID:", res.establishment.id);
        console.log("Menu Status:", res.menu?.status);
    }
  } catch (e) {
    console.error("DEBUG: ERRO CAPTURADO");
    console.error("Name:", e.name);
    console.error("Message:", e.message);
    if (e.stack) console.error("Stack:", e.stack);
  }
}

run();

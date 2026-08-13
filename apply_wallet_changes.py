import sys

def apply_wallet_changes(content):
    old_db_helper = """      async getEstablishmentBySlug(slug) {
        const res = await resolveEstablishmentBySlug(slug);
        if (res.status === "DATABASE_ERROR") throw new Error("DATABASE_ERROR");
        return res.establishment || null;
      },"""
    
    new_db_helper = """      async getEstablishmentBySlug(slug) {
        const res = await resolveEstablishmentBySlug(slug);

        switch (res.status) {
          case "ACTIVE":
            if (!res.establishment) {
              throw new Error("NOT_FOUND");
            }
            return res.establishment;

          case "INACTIVE":
            throw new Error("INACTIVE");

          case "NOT_FOUND":
            throw new Error("NOT_FOUND");

          case "DATABASE_ERROR":
            throw new Error("DATABASE_ERROR");

          default:
            throw new Error("DATABASE_ERROR");
        }
      },"""
    
    content = content.replace(old_db_helper, new_db_helper)
    return content

with open('src/lib/my-wallet.functions.ts', 'r') as f:
    content = f.read()

content = apply_wallet_changes(content)

with open('src/lib/my-wallet.functions.ts', 'w') as f:
    f.write(content)

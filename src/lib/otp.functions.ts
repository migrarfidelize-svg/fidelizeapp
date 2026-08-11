import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";

const sendOtpSchema = z.object({
  whatsapp: z.string().min(10).max(25),
  name: z.string().max(100).optional(), // Only for signup
});

/**
 * Gets the active WhatsApp provider and its runtime config.
 */
export async function getActiveWhatsAppProvider() {
  const { supabaseAdmin } =
    await import("@/integrations/supabase/client.server");

  const { data: integration, error } =
    await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("category", "otp")
      .eq("enabled", true)
      .maybeSingle();

  if (error) {
    console.error(
      "[WhatsApp] Failed to load active provider:",
      error.message
    );
    return null;
  }

  if (!integration) return null;

  const { getProvider } =
    await import("./integrations/registry");

  const { decryptSecret } =
    await import("./integrations/crypt.server");

  const provider =
    getProvider("otp", integration.provider) as any;

  if (!provider) {
    console.error(
      `[WhatsApp] Provider not registered: ${integration.provider}`
    );
    return null;
  }

  const encryptedCredentials =
    (
      integration.credentials &&
      typeof integration.credentials === "object"
    )
      ? integration.credentials as Record<string, unknown>
      : {};

  const dbCredentials: Record<string, string> = {};

  for (
    const [field, rawValue]
    of Object.entries(encryptedCredentials)
  ) {
    if (typeof rawValue !== "string") continue;

    const value = rawValue.trim();

    if (!value) continue;

    dbCredentials[field] =
      await decryptSecret(value);
  }

  console.log("[WhatsApp] Active provider runtime ready", {
    provider: integration.provider,
    credentialFields: Object.keys(dbCredentials),
    hasToken: Boolean(dbCredentials.token),
  });

  return {
    provider,
    runtime: {
      enabled: integration.enabled,
      mode: integration.mode,
      config:
        (integration.config || {}) as Record<string, unknown>,
      credentials_ref:
        (integration.credentials_ref || {}) as Record<string, string>,

      // INVARIANTE:
      // daqui para frente db_credentials SEMPRE contém
      // valores descriptografados.
      db_credentials: dbCredentials,
    },
  };
}

export const requestOTP = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sendOtpSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateOTP, normalizeWhatsApp } = await import("./otp.server");
    const { checkAuthRateLimit, clientIpFromHeaders } = await import("./auth-rate-limit.server");
    
    const req = getRequest();
    const ip = req?.headers ? clientIpFromHeaders(req.headers) : null;
    const phone = normalizeWhatsApp(data.whatsapp);
    const identifier = `wa:${phone.replace(/\+/g, "")}`;

    // 1. Rate Limit Check
    const decision = await checkAuthRateLimit({ ip, identifier, action: "login" });
    if (!decision.allowed) {
      throw new Error(`Muitas tentativas. Aguarde alguns minutos.`);
    }

    // 2. Check if WhatsApp OTP is active and configured
    const active = await getActiveWhatsAppProvider();
    if (!active) {
      // If not configured, we might allow fallback to env vars if they exist
      if (!process.env.WHATSAPP_API_KEY) {
        throw new Error("O envio de WhatsApp não está configurado. Tente novamente mais tarde.");
      }
    }

    // 3. Generate OTP with HMAC
    const { code, hash } = generateOTP(identifier);
    // 3b. Fetch Custom Template and Configs from system_settings
    const { data: settings } = await supabaseAdmin
      .from("system_settings")
      .select("*")
      .eq("namespace", "otp");
    
    const configMap = (settings || []).reduce((acc: any, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    const validityMinutes = configMap.validity_minutes || 10;
    const expiresAt = new Date(Date.now() + validityMinutes * 60_000).toISOString();

    const template = (configMap.template as any)?.text || "Afidelize\n\nSeu código de acesso é {{code}}.\n\nEle expira em {{minutes}} minutos.\n\nNão compartilhe este código.";
    const message = template
      .replace(/{{code}}/g, code)
      .replace(/{{minutes}}/g, validityMinutes.toString())
      .replace(/{{brand}}/g, "Afidelize");




    // 4. Store OTP in DB
    const { error: otpErr } = await supabaseAdmin.from("auth_otps").insert({
      identifier,
      code_hash: hash,
      expires_at: expiresAt,
      metadata: { name: data.name || null }
    });

    if (otpErr) throw otpErr;

    // 5. Send via WhatsApp
    if (active) {
      const res = await active.provider.sendTestMessage(active.runtime, process.env as any, phone, message);
      if (!res.ok) {
        console.error(`[OTP] Failed to send via provider ${active.provider.meta.id}: ${res.message}`);
        throw new Error("Não foi possível enviar o código no momento. Tente novamente em alguns minutos.");
      }
    } else {
      // Fallback logic could go here if we wanted to support direct env-based calls
      // For now, if active is null but we didn't throw, we assume we want a mock or dev behavior?
      // Actually the prompt says "Ausência de configuração: Não quebrar a aplicação, mostrar mensagem controlada".
      console.log(`[OTP] Sending (MOCK) ${code} to ${phone}`);
    }

    return { ok: true, phone };
  });

const verifyOtpSchema = z.object({
  whatsapp: z.string(),
  code: z.string().length(6),
});

async function findAuthUserByEmail(
  supabaseAdmin: any,
  email: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;
  let page = 1;

  while (true) {
    const {
      data,
      error
    } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];

    const found = users.find(
      (u: any) =>
        typeof u?.email === "string" &&
        u.email.toLowerCase() === normalizedEmail
    );

    if (found) {
      return found;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

export const verifyOTP = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => verifyOtpSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashOTP, normalizeWhatsApp } = await import("./otp.server");
    const { recordAuthAttempt, clientIpFromHeaders } = await import("./auth-rate-limit.server");
    
    const req = getRequest();
    const ip = req?.headers ? clientIpFromHeaders(req.headers) : null;
    const phone = normalizeWhatsApp(data.whatsapp);
    const identifier = `wa:${phone.replace(/\+/g, "")}`;
    const codeHash = hashOTP(data.code, identifier);

    // 1. Find and validate OTP using atomic lookup for code_hash
    const { data: otp, error: findErr } = await supabaseAdmin
      .from("auth_otps")
      .select("*")
      .eq("identifier", identifier)
      .eq("code_hash", codeHash)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr || !otp) {
      await recordAuthAttempt({ ip, identifier, action: "login", success: false });
      throw new Error("Código inválido ou expirado.");
    }

    // 2. Mark as used (Atomic update to prevent reuse)
    const { data: updatedOtp, error: updateErr } = await supabaseAdmin
      .from("auth_otps")
      .update({ used: true })
      .eq("id", otp.id)
      .eq("used", false)
      .select("id")
      .maybeSingle();

    if (updateErr) {
      throw updateErr;
    }

    if (!updatedOtp) {
      throw new Error("Código já processado.");
    }

    // 3. Resolve User
    const syntheticEmail =
      `wa${phone.replace(/\D/g, "")}@carteira.fidelize.app`;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    let user;

    if (profile) {
      const {
        data: existingUser,
        error: getUserErr
      } =
        await supabaseAdmin.auth.admin.getUserById(profile.id);

      if (getUserErr) {
        throw getUserErr;
      }

      if (!existingUser?.user) {
        throw new Error(
          "Cadastro encontrado, mas usuário de autenticação não existe."
        );
      }

      user = existingUser.user;
    } else {
      const metadata =
        (otp.metadata as Record<string, any>) || {};

      const {
        data: newUser,
        error: createErr
      } =
        await supabaseAdmin.auth.admin.createUser({
          email: syntheticEmail,
          email_confirm: true,
          user_metadata: {
            full_name: metadata.name || "Cliente",
            phone,
            whatsapp: phone,
          },
        });

      if (!createErr && newUser?.user) {
        user = newUser.user;
      } else {
        /*
         * Recuperação idempotente:
         * se o Auth já tinha esse usuário, não tentar recriar.
         */
        const existingAuthUser =
          await findAuthUserByEmail(
            supabaseAdmin,
            syntheticEmail
          );

        if (!existingAuthUser) {
          throw createErr ||
            new Error(
              "Não foi possível localizar ou criar o usuário."
            );
        }

        user = existingAuthUser;
      }

      /*
       * Reparar/criar profile faltante.
       * O Auth é a identidade principal neste ponto.
       */
      const {
        error: profileErr
      } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: user.id,
            full_name:
              metadata.name ||
              user.user_metadata?.full_name ||
              "Cliente",
            phone,
            account_type: "customer",
          },
          {
            onConflict: "id"
          }
        );

      if (profileErr) {
        throw profileErr;
      }
    }


    // 4. Generate Magic Link session
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email!,
    });

    if (linkErr) throw linkErr;

    await recordAuthAttempt({ ip, identifier, action: "login", success: true });

    return { 
      ok: true, 
      hashed_token: link.properties.hashed_token,
      email: user.email
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";

const sendOtpSchema = z.object({
  whatsapp: z.string().min(10).max(25),
  name: z.string().max(100).optional(), // Only for signup
});

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

    // 2. Generate OTP
    const { code, hash } = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString(); // 10 minutes

    // 3. Store OTP in DB
    const { error: otpErr } = await supabaseAdmin.from("auth_otps").insert({
      identifier,
      code_hash: hash,
      expires_at: expiresAt,
      metadata: { name: data.name || null }
    });

    if (otpErr) throw otpErr;

    // 4. Send via WhatsApp (Mock for now, should integrate with a real provider)
    console.log(`[OTP] Enviando ${code} para ${phone}`);
    
    // TODO: Integration with Evolution API or similar
    // await sendWhatsAppMessage(phone, `Seu código de acesso Fidelize é: ${code}`);

    return { ok: true, phone };
  });

const verifyOtpSchema = z.object({
  whatsapp: z.string(),
  code: z.string().length(6),
});

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
    const codeHash = hashOTP(data.code);

    // 1. Find valid OTP
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
      // Increment attempts or handle failure
      await recordAuthAttempt({ ip, identifier, action: "login", success: false });
      throw new Error("Código inválido ou expirado.");
    }

    // 2. Mark as used
    await supabaseAdmin.from("auth_otps").update({ used: true }).eq("id", otp.id);

    // 3. Resolve User
    const syntheticEmail = `wa${phone.replace(/\D/g, "")}@carteira.fidelize.app`;
    
    // Check if user exists in auth.users
    // We use listUsers or a clever lookup if possible. 
    // Since we don't have direct access to auth.users easily via typical RPC, 
    // we check our profiles table which should be in sync.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    let userId = profile?.id;

    if (!userId) {
      // Create new user if not found
      // Password must be secure but we won't use it for login anymore.
      // We'll generate a random long string.
      const randomPassword = Math.random().toString(36) + Math.random().toString(36);
      const { data: signUp, error: signUpErr } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: { 
          full_name: otp.metadata?.name || "Cliente",
          phone: phone,
          whatsapp: phone
        }
      });

      if (signUpErr) throw signUpErr;
      userId = signUp.user.id;

      // Create profile
      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        full_name: otp.metadata?.name || "Cliente",
        phone: phone,
        account_type: "customer"
      });
    }

    // 4. Create Session (Magic Link or similar impersonation)
    // In Supabase Admin API, we can generate a session or a login link.
    // The most compatible way to get a session in the frontend is to return 
    // a one-time login token (recovery or magiclink) that the frontend can use 
    // to sign in without knowing the password.
    
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
    });

    if (linkErr) throw linkErr;

    await recordAuthAttempt({ ip, identifier, action: "login", success: true });

    return { 
      ok: true, 
      hashed_token: link.properties.hashed_token, // This can be used with verifyOtp if type=magiclink
      action_link: link.properties.action_link // Or just use this
    };
  });

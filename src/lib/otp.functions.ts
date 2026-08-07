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

    // 4. Send via WhatsApp (Mock for now)
    console.log(`[OTP] Sending ${code} to ${phone}`);
    // Real integration: await sendWhatsAppOTP(phone, code);

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

    // 1. Find and validate OTP
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

    // 2. Mark as used
    await supabaseAdmin.from("auth_otps").update({ used: true }).eq("id", otp.id);

    // 3. Resolve User
    const syntheticEmail = `wa${phone.replace(/\D/g, "")}@carteira.fidelize.app`;
    
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    let user;

    if (!profile) {
      // New User
      const { data: newUser, error: signUpErr } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: { 
          full_name: otp.metadata?.name || "Cliente",
          phone: phone,
          whatsapp: phone
        }
      });
      if (signUpErr) throw signUpErr;
      user = newUser.user;

      await supabaseAdmin.from("profiles").insert({
        id: user.id,
        full_name: otp.metadata?.name || "Cliente",
        phone: phone,
        account_type: "customer"
      });
    } else {
      // Existing User
      const { data: existingUser, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      if (getUserErr) throw getUserErr;
      user = existingUser.user;
    }

    // 4. Generate Magic Link session
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email!,
    });

    if (linkErr) throw linkErr;

    await recordAuthAttempt({ ip, identifier, action: "login", success: true });

    // The hashed_token can be verified by the client via supabase.auth.verifyOtp
    return { 
      ok: true, 
      hashed_token: link.properties.hashed_token,
      email: user.email
    };
  });

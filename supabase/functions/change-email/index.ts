// Supabase Edge Function: change-email (Pontregiszter v1.13.0)
// Egy fiók belépési e-mail címét javítja. Csak admin jogú felhasználó hívhatja:
// Admin, Szülő-admin, Vezetőedző, Edző. A jelszó nem változik.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EDITORS = ["admin", "szulo_admin", "vezetoedzo", "edzo"];

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return reply(401, { error: "Hiányzó Authorization header" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // A hívó ellenőrzése a saját tokenje alapján
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user: caller }, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !caller) return reply(401, { error: "Érvénytelen session" });

    const { data: callerProfile } = await admin
      .from("profiles").select("role").eq("id", caller.id).single();
    if (!callerProfile || !EDITORS.includes(callerProfile.role)) {
      return reply(403, { error: "Ehhez nincs jogosultságod" });
    }

    const body = await req.json();
    const userId = body.user_id;
    const newEmail = String(body.new_email || "").trim().toLowerCase();
    if (!userId || !newEmail) return reply(400, { error: "user_id és new_email kötelező" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return reply(400, { error: "Az e-mail cím formátuma nem jó" });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles").select("id, email, competitor_id").eq("id", userId).single();
    if (profileError || !profile) return reply(404, { error: "Nem találom a fiókot" });

    const oldEmail = profile.email;
    if ((oldEmail || "").toLowerCase() === newEmail) {
      return reply(400, { error: "Ez a cím már be van állítva" });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
      user_metadata: { username: newEmail },
    });
    if (updateError) {
      const taken = /already|registered|exists/i.test(updateError.message);
      return reply(400, {
        error: taken ? "Ez az e-mail cím már egy másik fiókhoz tartozik" : "Módosítás sikertelen: " + updateError.message,
      });
    }

    const { error: profileUpdateError } = await admin
      .from("profiles").update({ email: newEmail }).eq("id", userId);
    if (profileUpdateError) {
      // A két hely ne térjen el: a belépési címet visszaállítjuk
      if (oldEmail) {
        await admin.auth.admin.updateUserById(userId, {
          email: oldEmail, email_confirm: true, user_metadata: { username: oldEmail },
        });
      }
      return reply(500, { error: "Módosítás sikertelen: " + profileUpdateError.message });
    }

    // A versenyző adatlapján is ugyanaz a cím szerepeljen
    if (profile.competitor_id) {
      await admin.from("competitors").update({ email: newEmail }).eq("id", profile.competitor_id);
    }

    return reply(200, { success: true, email: newEmail });
  } catch (err) {
    return reply(500, { error: (err as Error).message || "Ismeretlen hiba" });
  }
});

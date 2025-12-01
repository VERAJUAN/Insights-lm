// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { email, password, fullName, role, organizationId } = await req.json();

    if (!email || !password || !role || !organizationId) {
      return new Response(
        JSON.stringify({ error: "email, password, role y organizationId son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["administrator", "reader"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Rol inválido. Debe ser 'administrator' o 'reader'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Crear usuario en Auth usando la API de administrador (service role)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || null,
      },
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      throw authError;
    }

    const userId = authData.user?.id;
    if (!userId) {
      throw new Error("No se pudo crear el usuario en Auth");
    }

    // Actualizar/insertar perfil con rol y organización
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email,
        full_name: fullName || null,
        role,
        organization_id: organizationId,
      }, { onConflict: "id" });

    if (profileError) {
      console.error("Error updating profile:", profileError);
      throw profileError;
    }

    return new Response(
      JSON.stringify({ success: true, userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-create-user:", error);
    return new Response(
      JSON.stringify({ error: error.message ?? "Error al crear el usuario" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


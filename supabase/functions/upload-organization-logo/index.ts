import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.role !== "administrator") {
      return new Response(
        JSON.stringify({ error: "Only administrators can upload logos" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.organization_id) {
      return new Response(
        JSON.stringify({ error: "User does not belong to an organization" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/svg+xml", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "Invalid file type. Only images are allowed (PNG, JPG, GIF, SVG, WEBP)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: "File too large. Maximum size is 5MB" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "png";
    const organizationId = profile.organization_id;

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Create directory structure in public/logos/{organizationId}/
    // Note: In Supabase Edge Functions, we don't have direct access to the project's file system
    // So we'll return the base64 data and path, and the file should be saved via a script or manual process
    // Alternatively, you could use Supabase Storage with a public bucket for logos
    
    const logoPath = `/logos/${organizationId}/logo.${fileExtension}`;
    const logoUrl = logoPath; // Relative path that will be served from public/

    // Try to save file using Deno file system (if running locally)
    try {
      // Get the project root (assuming we're in supabase/functions/upload-organization-logo/)
      const projectRoot = Deno.cwd();
      const logosDir = `${projectRoot}/../../public/logos/${organizationId}`;
      
      // Create directory if it doesn't exist
      try {
        await Deno.mkdir(logosDir, { recursive: true });
      } catch (e) {
        // Directory might already exist, that's ok
        if (!(e instanceof Deno.errors.AlreadyExists)) {
          console.warn("Could not create logos directory:", e);
        }
      }

      // Write file
      const filePath = `${logosDir}/logo.${fileExtension}`;
      const fileBytes = new Uint8Array(arrayBuffer);
      await Deno.writeFile(filePath, fileBytes);
      
      console.log(`Logo saved successfully to: ${filePath}`);
    } catch (fileError) {
      // If file system access fails (e.g., in production), log warning but continue
      // The base64 data is still returned so the file can be saved manually or via script
      console.warn("Could not save file to local file system:", fileError);
      console.log("File will need to be saved manually using the base64 data or via a script");
    }

    return new Response(
      JSON.stringify({
        success: true,
        logoUrl,
        logoPath,
        base64, // Include base64 in case file system write failed
        organizationId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error uploading logo:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


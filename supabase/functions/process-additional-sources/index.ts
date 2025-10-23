import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { type, notebookId, urls, title, content, timestamp, sourceIds } = await req.json();
    
    console.log(`Process additional sources received ${type} request for notebook ${notebookId}`);

    const webhookUrl = Deno.env.get("ADDITIONAL_SOURCES_WEBHOOK_URL");
    if (!webhookUrl) {
      throw new Error("ADDITIONAL_SOURCES_WEBHOOK_URL not configured");
    }

    const authToken = Deno.env.get("NOTEBOOK_GENERATION_AUTH");
    if (!authToken) {
      throw new Error("NOTEBOOK_GENERATION_AUTH not configured");
    }

    let webhookPayload;
    
    if (type === "multiple-websites") {
      webhookPayload = {
        type: "multiple-websites",
        notebookId,
        urls,
        sourceIds,
        timestamp
      };
    } else if (type === "copied-text") {
      webhookPayload = {
        type: "copied-text",
        notebookId,
        title,
        content,
        sourceId: sourceIds?.[0],
        timestamp
      };
    } else {
      throw new Error(`Unsupported type: ${type}`);
    }

    console.log("Sending webhook payload:", JSON.stringify(webhookPayload, null, 2));

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authToken,
        ...corsHeaders
      },
      body: JSON.stringify(webhookPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Webhook request failed:", response.status, errorText);
      throw new Error(`Webhook request failed: ${response.status} - ${errorText}`);
    }

    const webhookResponse = await response.text();
    console.log("Webhook response:", webhookResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `${type} data sent to webhook successfully`,
      webhookResponse 
    }), {
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders 
      },
    });

  } catch (error) {
    console.error("Process additional sources error:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders 
      },
    });
  }
});
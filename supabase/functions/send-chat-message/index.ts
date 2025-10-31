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
    const { session_id, message, user_id } = await req.json();
    
    console.log("Received message:", { session_id, message, user_id });

    const webhookUrl = Deno.env.get("NOTEBOOK_CHAT_URL");
    const authHeader = Deno.env.get("NOTEBOOK_GENERATION_AUTH");
    
    if (!webhookUrl) {
      throw new Error("NOTEBOOK_CHAT_URL environment variable not set");
    }

    if (!authHeader) {
      throw new Error("NOTEBOOK_GENERATION_AUTH environment variable not set");
    }

    console.log("Sending to webhook with auth header");

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        session_id,
        message,
        user_id,
        timestamp: new Date().toISOString()
      })
    });

    if (!webhookResponse.ok) {
      console.error(`Webhook responded with status: ${webhookResponse.status}`);
      const errorText = await webhookResponse.text();
      console.error("Webhook error response:", errorText);
      throw new Error(`Webhook responded with status: ${webhookResponse.status}`);
    }

    const webhookData = await webhookResponse.json();
    console.log("Webhook response:", webhookData);

    return new Response(
      JSON.stringify({ success: true, data: webhookData }),
      { 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        } 
      }
    );

  } catch (error) {
    console.error("Error in send-chat-message:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send message to webhook" 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        }
      }
    );
  }
});
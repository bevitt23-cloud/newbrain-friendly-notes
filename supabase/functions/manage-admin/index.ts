import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the calling user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    // Check caller is admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!callerRole) throw new Error("Forbidden: not an admin");

    const body = await req.json();
    const { action, email, role_id } = body;

    if (action === "add") {
      if (!email) throw new Error("Email is required");

      // Look up user by email
      const { data: lookupData, error: lookupErr } = await supabaseAdmin.auth.admin.listUsers({ filter: `email.eq.${email}` });
      if (lookupErr) throw lookupErr;

      const targetUser = lookupData.users[0];
      if (!targetUser) {
        return new Response(
          JSON.stringify({ error: `No user found with email ${email}. They need to sign up first.` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: insertErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: targetUser.id, role: "admin" });

      if (insertErr) {
        if (insertErr.code === "23505") {
          return new Response(
            JSON.stringify({ error: "This user is already an admin." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw insertErr;
      }

      return new Response(
        JSON.stringify({ success: true, user_id: targetUser.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      if (!role_id) throw new Error("role_id is required");

      // Don't let admin remove themselves
      const { data: targetRole } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("id", role_id)
        .single();

      if (targetRole?.user_id === user.id) {
        return new Response(
          JSON.stringify({ error: "You cannot remove your own admin role." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("id", role_id);

      if (deleteErr) throw deleteErr;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: e.message.includes("Forbidden") ? 403 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

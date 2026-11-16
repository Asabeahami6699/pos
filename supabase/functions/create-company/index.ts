import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// 1. CORS Headers (Required for Browser requests)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 2. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { companyName, phone, location, plan, adminEmail, adminPassword, adminFullName } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3. Create company in public table
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert([{ name: companyName, phone, location, plan, status: 'active' }])
      .select()
      .single();

    if (companyError || !companyData) throw companyError || new Error('Failed to create company');

    const companyId = companyData.id;

    // 4. Create Admin in Supabase Auth (For Login)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // Auto-verify so they can login immediately
    });

    if (authError || !authData.user) throw authError || new Error('Failed to create admin user');

    const userId = authData.user.id;

    // 5. Create Admin in public 'users' table (For Role/Company Data)
    // FIXED: Removed 'email' here because your schema doesn't have this column
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: userId,
        company_id: companyId,
        role: 'company_admin',
        full_name: adminFullName,
      }]);

    if (userError) throw userError;

    return new Response(JSON.stringify({ success: true, companyId, userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
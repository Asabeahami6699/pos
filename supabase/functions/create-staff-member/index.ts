import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get request body
    const { companyId, branchId, fullName, email, password, sales_type } = await req.json();

    // Validate required fields
    if (!companyId || !branchId || !fullName || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Creating user for company:', companyId);

    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        sales_type: sales_type || 'retail',
        company_id: companyId
      }
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    const userId = authData.user.id;

    // 2. Create user record in public.users table
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: userId,
        company_id: companyId,
        role: 'salesperson',
        full_name: fullName,
        sales_type: sales_type || 'retail',
      }]);

    if (userError) {
      console.error('User record error:', userError);
      
      // Clean up: delete the auth user if user record creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      
      return new Response(
        JSON.stringify({ error: `Failed to create user record: ${userError.message}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Assign to branch
    const { error: assignError } = await supabaseAdmin
      .from('branch_staff')
      .insert([{
        user_id: userId,
        branch_id: branchId,
      }]);

    if (assignError) {
      console.error('Branch assignment error:', assignError);
      return new Response(
        JSON.stringify({ error: `Failed to assign to branch: ${assignError.message}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Get branch name for response
    const { data: branchData } = await supabaseAdmin
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .single();

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId, 
        branchName: branchData?.name || 'Unknown Branch',
        message: 'Staff member created successfully' 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err: any) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
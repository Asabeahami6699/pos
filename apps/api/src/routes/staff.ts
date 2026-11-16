import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole, requireActiveSubscription, type AuthenticatedRequest } from '../middleware/auth.js';

export const staffRouter = Router();

const createStaffSchema = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid(),
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  sales_type: z.enum(['retail', 'wholesale', 'both']).optional(),
});

staffRouter.post('/', requireAuth, requireRole('company_admin'), requireActiveSubscription, async (req: AuthenticatedRequest, res) => {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  const { companyId, branchId, fullName, email, password, sales_type } = parsed.data;

  if (req.companyId && req.companyId !== companyId) {
    return res.status(403).json({ success: false, error: 'Cannot create staff for another company' });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, sales_type: sales_type ?? 'retail', company_id: companyId },
    });

    if (authError || !authData.user) {
      throw authError ?? new Error('Failed to create auth user');
    }

    const userId = authData.user.id;

    const { error: userError } = await supabase.from('users').insert([{
      id: userId,
      company_id: companyId,
      role: 'salesperson',
      full_name: fullName,
      sales_type: sales_type ?? 'retail',
    }]);

    if (userError) {
      await supabase.auth.admin.deleteUser(userId);
      throw userError;
    }

    const { error: assignError } = await supabase.from('branch_staff').insert([{
      user_id: userId,
      branch_id: branchId,
    }]);

    if (assignError) {
      await supabase.from('users').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
      throw assignError;
    }

    const { data: branchData } = await supabase
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .single();

    return res.status(201).json({
      success: true,
      data: {
        userId,
        branchName: branchData?.name ?? 'Unknown Branch',
      },
      message: 'Staff member created successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

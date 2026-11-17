import { supabase } from './supabase';
import { shopRoutes } from './roleRedirect';

/** Returns true when the current session is a customer account. */
export async function isSignedInCustomer(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return false;

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single();

  return profile?.role === 'customer';
}

export function customerAuthPaths(redirect = shopRoutes.checkout) {
  return {
    login: shopRoutes.customerLogin(redirect),
    signup: shopRoutes.customerSignup(redirect),
  };
}

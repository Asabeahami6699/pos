import { supabase } from '../lib/supabase';
import type{ CartItem, Customer, Payment, User, Branch } from '../types/index.ts';

export const saleService = {
  async processSale({
    cart,
    total,
    customer,
    payment,
    salesType,
    user,
    selectedBranch
  }: {
    cart: CartItem[];
    total: number;
    customer: Customer;
    payment: Payment;
    salesType: 'retail' | 'wholesale';
    user: User;
    selectedBranch: Branch;
  }) {
    if (payment.amount < total && payment.method !== 'split') {
      throw new Error('Insufficient payment');
    }

    const now = new Date();

    // Create sale record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{
        company_id: selectedBranch.company_id,
        branch_id: selectedBranch.id,
        salesperson_id: user.id,
        total: total,
        payment_method: payment.method,
        payment_received: payment.amount,
        change_given: Math.max(0, payment.amount - total),
        payment_notes: payment.notes,
        sales_type: salesType,
        customer_name: customer.name || null,
        customer_phone: customer.phone || null,
        created_at: now.toISOString()
      }])
      .select()
      .single();

    if (saleError) throw saleError;

    // Create sale items
    const saleItems = cart.map(item => ({
      sale_id: sale.id,
      product_id: item.product.id,
      quantity: item.quantity,
      price: item.unitPrice * (1 - item.discount / 100),
      original_price: item.product.price,
      wholesale_price: item.product.wholesale_price,
      sales_type: salesType
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) throw itemsError;

    // Update inventory for each item
    for (const item of cart) {
      await supabase
        .from('branch_inventory')
        .update({ quantity: (item.product.stock || 0) - item.quantity })
        .eq('product_id', item.product.id)
        .eq('branch_id', selectedBranch.id);
    }

    // Create transaction log
    await supabase
      .from('transaction_logs')
      .insert([{
        company_id: selectedBranch.company_id,
        branch_id: selectedBranch.id,
        user_id: user.id,
        action_type: 'sale',
        reference_id: sale.id,
        amount: total,
        details: {
          sales_type: salesType,
          payment_method: payment.method,
          items_count: cart.length,
          customer: customer.name || 'Walk-in'
        }
      }]);

    // Update user stats
    await supabase
      .from('user_stats')
      .upsert({
        user_id: user.id,
        total_sales: total,
        sales_count: 1,
        last_sale_at: now.toISOString(),
        sales_type: salesType
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    return sale;
  },

  async processReturn({
    saleId,
    items,
    reason,
    user,
    selectedBranch
  }: {
    saleId: string;
    items: any[];
    reason: string;
    user: User;
    selectedBranch: Branch;
  }) {
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('sales_type')
      .eq('id', saleId)
      .single();

    if (saleError) throw saleError;

    const { api } = await import('../lib/api.js');
    const result = await api.createReturn({
      sale_id: saleId,
      branch_id: selectedBranch.id,
      company_id: selectedBranch.company_id,
      reason,
      sales_type: (sale.sales_type as 'retail' | 'wholesale') || 'retail',
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
      })),
    });

    const totalRefund = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return { id: result.data.id, total_refund: totalRefund };
  }
};
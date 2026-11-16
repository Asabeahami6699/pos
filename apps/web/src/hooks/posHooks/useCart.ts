import { useState, useCallback, useMemo, useEffect } from 'react';
import type{ CartItem, Product } from '../../types/index';
import { toast } from 'sonner';

export interface CartPricingOptions {
  taxRatePercent?: number;
  discountsEnabled?: boolean;
  maxDiscountPercent?: number;
}

export const useCart = (
  salesType: 'retail' | 'wholesale',
  pricing: CartPricingOptions = {},
) => {
  const taxRatePercent = pricing.taxRatePercent ?? 16;
  const discountsEnabled = pricing.discountsEnabled !== false;
  const maxDiscountPercent = pricing.maxDiscountPercent ?? 100;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercentage, setDiscountPercentageState] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);

  const setDiscountPercentage = useCallback(
    (value: number) => {
      if (!discountsEnabled) {
        setDiscountPercentageState(0);
        return;
      }
      const clamped = Math.min(Math.max(Number(value) || 0, 0), maxDiscountPercent);
      setDiscountPercentageState(clamped);
    },
    [discountsEnabled, maxDiscountPercent],
  );

  useEffect(() => {
    if (!discountsEnabled) {
      setDiscountPercentageState(0);
      setDiscountAmount(0);
      setCart((prev) => prev.map((item) => (item.discount ? { ...item, discount: 0 } : item)));
      return;
    }
    setDiscountPercentageState((prev) => Math.min(prev, maxDiscountPercent));
  }, [discountsEnabled, maxDiscountPercent]);

  const getProductPrice = useCallback((product: Product): number => {
    if (salesType === 'wholesale') {
      return product.wholesale_price || product.price * 0.8;
    }
    return product.price;
  }, [salesType]);

  const addToCart = useCallback((product: Product, options?: { silent?: boolean }): boolean => {
    if (!product.stock || product.stock <= 0) {
      toast.error('Out of Stock', {
        description: `${product.name} is currently unavailable`,
        icon: '🚫'
      });
      return false;
    }

    const currentStock = product.stock;
    const existingItem = cart.find(item => item.product.id === product.id);
    const currentQtyInCart = existingItem ? existingItem.quantity : 0;

    if (currentQtyInCart + 1 > currentStock) {
      toast.warning('Insufficient Stock', {
        description: `Only ${currentStock} units of ${product.name} available`,
        action: { label: 'OK', onClick: () => {} }
      });
      return false;
    }

    const unitPrice = getProductPrice(product);
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { 
        product, 
        quantity: 1, 
        unitPrice,
        discount: 0 
      }]);
    }

    if (!options?.silent) {
      toast.success('Added to Cart', {
        description: `${product.name} added to your cart`,
        icon: '🛒'
      });
    }
    return true;
  }, [cart, getProductPrice]);

  const removeFromCart = useCallback((productId: string) => {
    const productName = cart.find(item => item.product.id === productId)?.product.name;
    setCart(cart.filter(item => item.product.id !== productId));
    if (productName) {
      toast.success('Removed from Cart', {
        description: `${productName} removed from your cart`
      });
    }
  }, [cart]);

  const updateQuantity = useCallback((productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }

    const item = cart.find(item => item.product.id === productId);
    if (!item) return;

    const currentStock = item.product.stock || 0;
    if (newQuantity > currentStock) {
      toast.warning('Stock Limit', {
        description: `Maximum stock available: ${currentStock} units`,
        icon: '⚠️'
      });
      return;
    }

    setCart(cart.map(item => 
      item.product.id === productId 
        ? { ...item, quantity: newQuantity }
        : item
    ));
  }, [cart, removeFromCart]);

  const applyDiscount = useCallback((productId: string, discount: number) => {
    if (!discountsEnabled) {
      toast.error('Discounts disabled', {
        description: 'Ask your admin to enable POS discounts in Settings',
      });
      return;
    }
    const clamped = Math.min(Math.max(Number(discount) || 0, 0), maxDiscountPercent);
    const productName = cart.find(item => item.product.id === productId)?.product.name;
    setCart(cart.map(item => 
      item.product.id === productId 
        ? { ...item, discount: clamped }
        : item
    ));
    
    if (productName) {
      toast.info('Discount Applied', {
        description: `${clamped}% off applied to ${productName}`,
        icon: '🎉'
      });
    }
  }, [cart, discountsEnabled, maxDiscountPercent]);

  const setDiscountAmountSafe = useCallback(
    (value: number) => {
      if (!discountsEnabled) {
        setDiscountAmount(0);
        return;
      }
      setDiscountAmount(Math.max(Number(value) || 0, 0));
    },
    [discountsEnabled],
  );

  const clearCart = useCallback(() => {
    if (cart.length > 0) {
      toast.promise(
        new Promise((resolve) => {
          setCart([]);
          setDiscountPercentageState(0);
          setDiscountAmount(0);
          resolve('Cart cleared');
        }),
        {
          loading: 'Clearing cart...',
          success: 'Cart cleared successfully',
          error: 'Failed to clear cart'
        }
      );
    }
  }, [cart]);

  const calculateItemTotal = useCallback((item: CartItem): number => {
    const priceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
    return priceAfterDiscount * item.quantity;
  }, []);

  const calculateSubtotal = useCallback((): number => {
    return cart.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  }, [cart, calculateItemTotal]);

  const calculateTotalDiscount = useCallback((): number => {
    if (!discountsEnabled) return 0;
    const subtotal = calculateSubtotal();
    const percentageDiscount = subtotal * (discountPercentage / 100);
    return percentageDiscount + discountAmount;
  }, [calculateSubtotal, discountPercentage, discountAmount, discountsEnabled]);

  const calculateTax = useCallback((): number => {
    const taxableAmount = Math.max(0, calculateSubtotal() - calculateTotalDiscount());
    return taxableAmount * (taxRatePercent / 100);
  }, [calculateSubtotal, calculateTotalDiscount, taxRatePercent]);

  const calculateTotal = useCallback((): number => {
    const subtotal = calculateSubtotal();
    const discount = calculateTotalDiscount();
    const tax = calculateTax();
    return subtotal - discount + tax;
  }, [calculateSubtotal, calculateTotalDiscount, calculateTax]);

  const updateCartForProductChange = useCallback((updatedProduct: Product) => {
    setCart(prevCart => {
      const itemIndex = prevCart.findIndex(item => item.product.id === updatedProduct.id);
      if (itemIndex >= 0) {
        const updatedCart = [...prevCart];
        const unitPrice = getProductPrice(updatedProduct);
        
        updatedCart[itemIndex] = {
          ...updatedCart[itemIndex],
          product: updatedProduct,
          unitPrice: unitPrice
        };
        
        return updatedCart;
      }
      return prevCart;
    });
  }, [getProductPrice]);

  const removeProductFromCart = useCallback((productId: string) => {
    setCart(prevCart => {
      const item = prevCart.find(item => item.product.id === productId);
      if (item) {
        toast.warning('Product Unavailable', {
          description: `${item.product.name} has been removed from your cart`,
          icon: '⚠️'
        });
        return prevCart.filter(item => item.product.id !== productId);
      }
      return prevCart;
    });
  }, []);

  const checkCartAgainstStock = useCallback((productId: string, newStock: number) => {
    setCart(prevCart => {
      const itemIndex = prevCart.findIndex(item => item.product.id === productId);
      if (itemIndex >= 0) {
        const item = prevCart[itemIndex];
        if (item.quantity > newStock) {
          toast.warning('Stock Reduced', {
            description: `${item.product.name} stock reduced. Adjusting quantity from ${item.quantity} to ${newStock}`,
            icon: '⚠️',
            action: {
              label: 'OK',
              onClick: () => {}
            }
          });
          
          const updatedCart = [...prevCart];
          updatedCart[itemIndex] = {
            ...item,
            quantity: Math.min(item.quantity, newStock)
          };
          
          if (updatedCart[itemIndex].quantity === 0) {
            return updatedCart.filter(item => item.product.id !== productId);
          }
          
          return updatedCart;
        }
      }
      return prevCart;
    });
  }, []);

  const cartTotalItems = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  return {
    cart,
    cartTotalItems,
    discountPercentage,
    discountAmount,
    setDiscountPercentage,
    setDiscountAmount: setDiscountAmountSafe,
    taxRatePercent,
    discountsEnabled,
    maxDiscountPercent,
    addToCart,
    removeFromCart,
    updateQuantity,
    applyDiscount,
    clearCart,
    calculateItemTotal,
    calculateSubtotal,
    calculateTotalDiscount,
    calculateTax,
    calculateTotal,
    updateCartForProductChange,
    removeProductFromCart,
    checkCartAgainstStock,
    getProductPrice
  };
};
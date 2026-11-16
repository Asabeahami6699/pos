// src/components/admin/ProductCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../Button';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Plus, 
  Minus,
  MoreVertical,
  Edit,
  Trash2,
  History,
  ArrowRightLeft,
  X
} from 'lucide-react';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    sku: string;
    price: number;
    wholesale_price?: number;
    low_stock_threshold: number;
    retail_stock?: number;
    wholesale_stock?: number;
    total_stock?: number;
    warehouse_stock?: number;
    branch_retail_stock?: number;
    branch_wholesale_stock?: number;
    price_change_percentage?: number;
    is_low_stock?: boolean;
  };
  onDelete?: (id: string) => void;
  onEdit?: () => void;
  onAllocate?: () => void;
  onRemove?: () => void;
  onViewHistory?: () => void;
  showBranch?: string;
  showWarehouse?: boolean;
  compact?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onDelete,
  onEdit,
  onAllocate,
  onRemove,
  onViewHistory,
  showBranch,
  showWarehouse = false,
  compact = false
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<'bottom' | 'top'>('bottom');

  // Close menu when clicking outside and adjust position
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleScroll = () => {
      if (isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isMenuOpen]);

  // Adjust menu position based on available space
  useEffect(() => {
    if (isMenuOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 400; // Approximate max menu height
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      
      setMenuPosition(spaceBelow < menuHeight && spaceAbove > spaceBelow ? 'top' : 'bottom');
    }
  }, [isMenuOpen]);

  // Calculate stocks
  const retailStock = product.branch_retail_stock ?? product.retail_stock ?? 0;
  const wholesaleStock = product.branch_wholesale_stock ?? product.wholesale_stock ?? 0;
  const totalStock = product.total_stock ?? (retailStock + wholesaleStock);
  const warehouseStock = product.warehouse_stock ?? 0;
  
  // Determine if low stock
  const isLowStock = product.is_low_stock || totalStock <= product.low_stock_threshold;
  
  // Calculate savings percentage
  const savingsPercentage = product.wholesale_price && product.wholesale_price < product.price
    ? Math.round((1 - product.wholesale_price / product.price) * 100)
    : 0;

  // Count available actions
  const hasActions = onEdit || onAllocate || onRemove || onViewHistory || onDelete;
  
  // Count total actions
  const actionCount = [
    onEdit,
    onAllocate && warehouseStock > 0,
    onRemove && totalStock > 0,
    onViewHistory,
    onDelete
  ].filter(Boolean).length;

  if (compact) {
    return (
      <div className="bg-card rounded-lg border border-border p-3 hover:shadow-md transition-all duration-200 relative group">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 min-w-0">
            <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="font-medium text-foreground truncate text-sm">{product.name}</h3>
              <p className="text-xs text-muted-foreground truncate">SKU: {product.sku}</p>
            </div>
          </div>
          
          {/* Actions Menu Button - Floating */}
          {hasActions && (
            <div className="relative" ref={menuRef}>
              <button
                ref={buttonRef}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-1.5 hover:bg-secondary rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 relative z-10"
                aria-label="Product actions"
              >
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Floating Dropdown Menu */}
              {isMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  
                  {/* Floating Menu */}
                  <div 
                    className={`fixed z-50 w-64 bg-card rounded-xl shadow-2xl border border-border py-1 animate-in fade-in zoom-in-95 duration-200
                      ${menuPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
                    style={{
                      left: buttonRef.current ? 
                        Math.min(
                          buttonRef.current.getBoundingClientRect().right - 256,
                          window.innerWidth - 272
                        ) : 'auto',
                      ...(menuPosition === 'top' 
                        ? { bottom: buttonRef.current ? window.innerHeight - buttonRef.current.getBoundingClientRect().top : 'auto' }
                        : { top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom : 'auto' }
                      )
                    }}
                  >
                    <div className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-secondary/60/50">
                      <div className="flex items-center justify-between">
                        <span>Product Actions</span>
                        <span className="bg-muted text-foreground px-2 py-0.5 rounded-full text-xs">
                          {actionCount}
                        </span>
                      </div>
                    </div>
                    
                    {/* Scrollable Content */}
                    <div className="max-h-80 overflow-y-auto overscroll-contain">
                      {onEdit && (
                        <button
                          onClick={() => { onEdit(); setIsMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-secondary/60 flex items-center gap-3 transition-colors group"
                        >
                          <div className="w-6 h-6 bg-secondary rounded-lg flex items-center justify-center group-hover:bg-muted">
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="flex-1 font-medium">Edit Product</span>
                          <span className="text-xs text-muted-foreground">⌘E</span>
                        </button>
                      )}
                      
                      {onAllocate && warehouseStock > 0 && (
                        <button
                          onClick={() => { onAllocate(); setIsMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-sm text-indigo-600 hover:bg-indigo-500/100/10 flex items-center gap-3 transition-colors group"
                        >
                          <div className="w-6 h-6 bg-indigo-500/15 rounded-lg flex items-center justify-center group-hover:bg-indigo-200">
                            <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                          </div>
                          <span className="flex-1 font-medium">Allocate to Branch</span>
                          <span className="text-xs bg-indigo-500/15 text-indigo-700 px-2 py-1 rounded-full">
                            {warehouseStock}
                          </span>
                        </button>
                      )}
                      
                      {onRemove && totalStock > 0 && (
                        <button
                          onClick={() => { onRemove(); setIsMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-sm text-orange-600 hover:bg-orange-500/10 flex items-center gap-3 transition-colors group"
                        >
                          <div className="w-6 h-6 bg-orange-500/15 rounded-lg flex items-center justify-center group-hover:bg-orange-200">
                            <Minus className="w-4 h-4 text-orange-600" />
                          </div>
                          <span className="flex-1 font-medium">Remove Stock</span>
                          <span className="text-xs bg-orange-500/15 text-orange-700 px-2 py-1 rounded-full">
                            {totalStock}
                          </span>
                        </button>
                      )}
                      
                      {onViewHistory && (
                        <button
                          onClick={() => { onViewHistory(); setIsMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-secondary/60 flex items-center gap-3 transition-colors group"
                        >
                          <div className="w-6 h-6 bg-secondary rounded-lg flex items-center justify-center group-hover:bg-muted">
                            <History className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="flex-1 font-medium">Price History</span>
                        </button>
                      )}
                      
                      {onDelete && (
                        <>
                          <div className="border-t border-border my-1"></div>
                          <button
                            onClick={() => { 
                              if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
                                onDelete(product.id); 
                                setIsMenuOpen(false);
                              }
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-500/10 flex items-center gap-3 transition-colors group"
                          >
                            <div className="w-6 h-6 bg-red-500/15 rounded-lg flex items-center justify-center group-hover:bg-red-200">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </div>
                            <span className="flex-1 font-medium">Delete Product</span>
                            <span className="text-xs bg-red-500/15 text-red-700 px-2 py-1 rounded-full">
                              Permanent
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                    
                    {/* Footer */}
                    <div className="border-t border-border bg-secondary/60 p-1">
                      <button
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <div className="w-5 h-5 bg-muted rounded flex items-center justify-center">
                          <X className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <span className="font-medium">Close Menu</span>
                        <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                          ESC
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Retail</p>
            <p className="font-semibold">₵{product.price.toFixed(2)}</p>
            <p className="text-xs">{retailStock} units</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Wholesale</p>
            <p className="font-semibold text-green-600">
              ₵{product.wholesale_price?.toFixed(2) || 'N/A'}
            </p>
            <p className="text-xs">{wholesaleStock} units</p>
          </div>
        </div>
        
        {isLowStock && (
          <div className="mt-2 p-1.5 bg-red-500/10 border border-red-100 rounded text-xs flex items-center">
            <AlertCircle className="w-3 h-3 text-red-500 mr-1 flex-shrink-0" />
            <span className="text-red-700">Low stock</span>
          </div>
        )}
      </div>
    );
  }
  
  // Standard view
  return (
    <div className="bg-card rounded-lg border border-border p-4 hover:shadow-md transition-all duration-200 relative group">
      <div className="flex justify-between items-start mb-3">
        <div className="min-w-0 flex-1 pr-12">
          <div className="flex items-center space-x-2 mb-1">
            <Package className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
            {showBranch && (
              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-700 text-xs rounded-full truncate">
                {showBranch}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">SKU: {product.sku}</p>
          
          <div className="flex items-center space-x-4 mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Retail</p>
              <p className="font-bold text-lg">₵{product.price.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{retailStock} units</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wholesale</p>
              <p className="font-bold text-lg text-green-600">
                ₵{product.wholesale_price?.toFixed(2) || 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground">{wholesaleStock} units</p>
            </div>
            {savingsPercentage > 0 && (
              <div className="bg-emerald-500/10 px-2 py-1 rounded">
                <p className="text-xs font-semibold text-green-700">Save {savingsPercentage}%</p>
              </div>
            )}
          </div>
          
          {/* Stock summary */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Total:</span>
              <span className={`font-semibold ${isLowStock ? 'text-red-600' : 'text-foreground'}`}>
                {totalStock} units
              </span>
            </div>
            {showWarehouse && warehouseStock > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Warehouse:</span>
                <span className="font-semibold text-blue-600">{warehouseStock}</span>
              </div>
            )}
            {product.price_change_percentage && (
              <div className={`flex items-center ${
                product.price_change_percentage > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {product.price_change_percentage > 0 ? (
                  <TrendingUp className="w-4 h-4 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 mr-1" />
                )}
                <span className="text-xs font-medium">
                  {Math.abs(product.price_change_percentage)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions Menu Button - Floating */}
        {hasActions && (
          <div className="relative" ref={menuRef}>
            <button
              ref={buttonRef}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-secondary rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 relative z-10"
              aria-label="Product actions"
            >
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Floating Dropdown Menu */}
            {isMenuOpen && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMenuOpen(false)}
                />
                
                {/* Floating Menu */}
                <div 
                  className={`fixed z-50 w-72 bg-card rounded-xl shadow-2xl border border-border py-1 animate-in fade-in zoom-in-95 duration-200
                    ${menuPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
                  style={{
                    left: buttonRef.current ? 
                      Math.min(
                        buttonRef.current.getBoundingClientRect().right - 288,
                        window.innerWidth - 304
                      ) : 'auto',
                    ...(menuPosition === 'top' 
                      ? { bottom: buttonRef.current ? window.innerHeight - buttonRef.current.getBoundingClientRect().top : 'auto' }
                      : { top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom : 'auto' }
                    )
                  }}
                >
                  {/* Header */}
                  <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-secondary/60/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        <span>{product.name}</span>
                      </div>
                      <span className="bg-muted text-foreground px-2 py-0.5 rounded-full text-xs">
                        {actionCount}
                      </span>
                    </div>
                  </div>
                  
                  {/* Scrollable Content */}
                  <div className="max-h-96 overflow-y-auto overscroll-contain">
                    {onEdit && (
                      <button
                        onClick={() => { onEdit(); setIsMenuOpen(false); }}
                        className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-secondary/60 flex items-center gap-3 transition-colors group"
                      >
                        <div className="w-7 h-7 bg-secondary rounded-lg flex items-center justify-center group-hover:bg-muted">
                          <Edit className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="flex-1 font-medium">Edit Product</span>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded group-hover:bg-muted">
                          ⌘E
                        </span>
                      </button>
                    )}
                    
                    {onAllocate && warehouseStock > 0 && (
                      <button
                        onClick={() => { onAllocate(); setIsMenuOpen(false); }}
                        className="w-full px-4 py-3 text-left text-sm text-indigo-600 hover:bg-indigo-500/100/10 flex items-center gap-3 transition-colors group"
                      >
                        <div className="w-7 h-7 bg-indigo-500/15 rounded-lg flex items-center justify-center group-hover:bg-indigo-200">
                          <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                        </div>
                        <span className="flex-1 font-medium">Allocate to Branch</span>
                        <span className="text-xs bg-indigo-500/15 text-indigo-700 px-2 py-1 rounded-full">
                          {warehouseStock} avail
                        </span>
                      </button>
                    )}
                    
                    {onRemove && totalStock > 0 && (
                      <button
                        onClick={() => { onRemove(); setIsMenuOpen(false); }}
                        className="w-full px-4 py-3 text-left text-sm text-orange-600 hover:bg-orange-500/10 flex items-center gap-3 transition-colors group"
                      >
                        <div className="w-7 h-7 bg-orange-500/15 rounded-lg flex items-center justify-center group-hover:bg-orange-200">
                          <Minus className="w-4 h-4 text-orange-600" />
                        </div>
                        <span className="flex-1 font-medium">Remove Stock</span>
                        <span className="text-xs bg-orange-500/15 text-orange-700 px-2 py-1 rounded-full">
                          {totalStock} units
                        </span>
                      </button>
                    )}
                    
                    {onViewHistory && (
                      <button
                        onClick={() => { onViewHistory(); setIsMenuOpen(false); }}
                        className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-secondary/60 flex items-center gap-3 transition-colors group"
                      >
                        <div className="w-7 h-7 bg-secondary rounded-lg flex items-center justify-center group-hover:bg-muted">
                          <History className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="flex-1 font-medium">Price History</span>
                      </button>
                    )}
                    
                    {onDelete && (
                      <>
                        <div className="border-t border-border my-1"></div>
                        <button
                          onClick={() => { 
                            if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
                              onDelete(product.id); 
                              setIsMenuOpen(false);
                            }
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-500/10 flex items-center gap-3 transition-colors group"
                        >
                          <div className="w-7 h-7 bg-red-500/15 rounded-lg flex items-center justify-center group-hover:bg-red-200">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </div>
                          <span className="flex-1 font-medium">Delete Product</span>
                          <span className="text-xs bg-red-500/15 text-red-700 px-2 py-1 rounded-full">
                            Permanent
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div className="border-t border-border bg-secondary/60 p-1">
                    <button
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <div className="w-5 h-5 bg-muted rounded flex items-center justify-center">
                        <X className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <span className="font-medium">Close Menu</span>
                      <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                        ESC
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Low stock warning */}
      {isLowStock && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-100 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Low Stock Alert</p>
            <p className="text-xs text-red-700 mt-0.5">
              Only {totalStock} units left (threshold: {product.low_stock_threshold})
            </p>
            {onAllocate && warehouseStock > 0 && (
              <button
                onClick={onAllocate}
                className="mt-2 text-xs bg-red-500/15 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 font-medium"
              >
                <Plus className="w-3 h-3" />
                Allocate ({warehouseStock} avail)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
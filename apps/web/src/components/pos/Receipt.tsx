import React, { useRef } from 'react';
import { Printer, Download } from 'lucide-react';

interface CartItem {
  product: {
    name: string;
    sku: string;
    price: number;
    wholesale_price?: number;
  };
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface ReceiptProps {
  sale: CartItem[];
  total: number;
  customer: {
    name?: string;
    phone?: string;
    email?: string;
  };
  salesType: 'retail' | 'wholesale';
  branch: {
    name: string;
    address?: string;
    phone?: string;
  };
  salesperson: {
    full_name?: string;
    id: string;
  };
  subtotal?: number;
  tax?: number;
  onPrint?: () => void;
  onSave?: () => void;
}

export const Receipt: React.FC<ReceiptProps> = ({
  sale,
  total,
  customer,
  salesType,
  branch,
  salesperson,
  subtotal: propSubtotal,
  tax: propTax,
  onPrint,
  onSave
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const receiptNumber = `REC-${Date.now().toString().slice(-8)}`;
  const date = new Date().toLocaleString();
  
  // Calculate totals if not provided
  const subtotal = propSubtotal || sale.reduce((sum, item) => 
    sum + (item.unitPrice * item.quantity * (1 - item.discount / 100)), 0);
  const tax = propTax || (subtotal * 0.16);
  const calculatedTotal = subtotal + tax;
  const finalTotal = total || calculatedTotal;

  const isWholesale = salesType === 'wholesale';

  // Print receipt
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      printReceipt();
    }
  };

  // Download as PDF
  const handleDownload = async () => {
    if (onSave) {
      onSave();
    } else {
      await downloadReceipt();
    }
  };

  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !receiptRef.current) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${receiptNumber}</title>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Courier New', 'Monaco', monospace;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            padding: 15px;
            background: white;
            max-width: 380px;
            margin: 0 auto;
          }
          
          .print-header {
            text-align: center;
            border-bottom: 2px dashed #ccc;
            padding-bottom: 15px;
            margin-bottom: 15px;
          }
          
          .print-header h1 {
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
          }
          
          .print-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
            margin: 5px 0;
          }
          
          .print-store {
            font-size: 16px;
            font-weight: bold;
            margin: 5px 0;
          }
          
          .print-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 15px;
            font-size: 11px;
          }
          
          .print-items {
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            margin: 15px 0;
            padding: 10px 0;
          }
          
          .item-row {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 5px;
            padding: 5px 0;
            border-bottom: 1px dashed #ddd;
          }
          
          .item-row:last-child {
            border-bottom: none;
          }
          
          .item-header {
            font-weight: bold;
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
            margin-bottom: 5px;
          }
          
          .print-totals {
            margin: 15px 0;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            font-size: 11px;
          }
          
          .grand-total {
            border-top: 2px solid #000;
            margin-top: 5px;
            padding-top: 8px;
            font-size: 14px;
            font-weight: bold;
          }
          
          .print-footer {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px dashed #000;
            font-size: 9px;
            text-align: center;
            color: #666;
          }
          
          .print-wholesale {
            background-color: #e3f2fd;
            padding: 5px;
            border-radius: 4px;
            margin: 5px 0;
          }
          
          .print-retail {
            background-color: #f3e5f5;
            padding: 5px;
            border-radius: 4px;
            margin: 5px 0;
          }
          
          .discount-badge {
            background-color: #ffebee;
            color: #c62828;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 9px;
            margin-left: 5px;
          }
          
          .wholesale-price {
            color: #1565c0;
            font-weight: bold;
          }
          
          @media print {
            @page {
              margin: 0;
              size: 80mm auto;
            }
            
            body {
              padding: 10px;
              width: 80mm;
            }
            
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>${isWholesale ? 'WHOLESALE INVOICE' : 'RETAIL RECEIPT'}</h1>
          <div class="print-badge" style="background-color: ${isWholesale ? '#e3f2fd' : '#f3e5f5'}; color: ${isWholesale ? '#1565c0' : '#7b1fa2'};">
            ${isWholesale ? '📦 WHOLESALE' : '🛍️ RETAIL'}
          </div>
          <div class="print-store">${branch?.name || 'Store'}</div>
          ${branch?.address ? `<div>${branch.address}</div>` : ''}
          ${branch?.phone ? `<div>Tel: ${branch.phone}</div>` : ''}
        </div>
        
        <div class="print-info">
          <div>
            <strong>Receipt #:</strong><br>
            ${receiptNumber}
          </div>
          <div style="text-align: right;">
            <strong>Date:</strong><br>
            ${date}
          </div>
        </div>
        
        <div class="${isWholesale ? 'print-wholesale' : 'print-retail'}">
          <strong>${isWholesale ? 'WHOLESALE TRANSACTION' : 'RETAIL TRANSACTION'}</strong><br>
          <small>${isWholesale ? 'Bulk pricing applied' : 'Standard retail pricing'}</small>
        </div>
        
        <div style="margin: 10px 0;">
          <strong>BILL TO:</strong><br>
          ${customer.name || 'Walk-in Customer'}<br>
          ${customer.phone ? `Phone: ${customer.phone}<br>` : ''}
          ${customer.email ? `Email: ${customer.email}` : ''}
        </div>
        
        <div style="display: flex; justify-content: space-between; margin: 10px 0;">
          <div>
            <strong>Served by:</strong><br>
            ${salesperson?.full_name || 'Sales Staff'}
          </div>
          <div style="text-align: right;">
            <strong>Staff ID:</strong><br>
            ${salesperson?.id?.slice(-6) || 'N/A'}
          </div>
        </div>
        
        <div class="print-items">
          <div class="item-row item-header">
            <div>ITEM</div>
            <div>QTY</div>
            <div>PRICE</div>
            <div>TOTAL</div>
          </div>
          
          ${sale.map((item, index) => {
            const itemTotal = item.unitPrice * item.quantity * (1 - item.discount / 100);
            const hasWholesalePrice = item.product.wholesale_price && 
              item.product.wholesale_price !== item.product.price;
            
            return `
              <div class="item-row">
                <div>
                  ${item.product.name}
                  <br><small>${item.product.sku}</small>
                  ${hasWholesalePrice && isWholesale ? '<br><small class="wholesale-price">Wholesale Price</small>' : ''}
                  ${item.discount > 0 ? `<span class="discount-badge">${item.discount}% off</span>` : ''}
                </div>
                <div>${item.quantity}</div>
                <div>$${item.unitPrice.toFixed(2)}</div>
                <div><strong>$${itemTotal.toFixed(2)}</strong></div>
              </div>
            `;
          }).join('')}
        </div>
        
        <div class="print-totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          
          ${sale.some(item => item.discount > 0) ? `
            <div style="margin: 5px 0; padding: 5px; background: #fff8e1; border-radius: 4px;">
              <strong>Discounts:</strong><br>
              ${sale.filter(item => item.discount > 0).map(item => `
                ${item.product.name}: -$${(item.unitPrice * item.quantity * (item.discount / 100)).toFixed(2)}
              `).join('<br>')}
            </div>
          ` : ''}
          
          <div class="total-row">
            <span>Tax (16%):</span>
            <span>$${tax.toFixed(2)}</span>
          </div>
          
          <div class="total-row grand-total">
            <span>TOTAL AMOUNT:</span>
            <span style="color: ${isWholesale ? '#1565c0' : '#000'};">
              $${finalTotal.toFixed(2)}
            </span>
          </div>
          
          <div class="${isWholesale ? 'print-wholesale' : 'print-retail'}" style="margin-top: 10px; text-align: center;">
            ${sale.length} items • ${isWholesale ? 'Wholesale Purchase' : 'Retail Purchase'}
          </div>
        </div>
        
        <div class="print-footer">
          <div style="margin-bottom: 10px;">
            <strong>PAYMENT STATUS:</strong><br>
            <span style="color: #2e7d32; font-weight: bold;">PAID IN FULL</span>
          </div>
          
          <div style="margin: 10px 0;">
            Thank you for your ${isWholesale ? 'business' : 'purchase'}!<br>
            <small>Transaction ID: ${salesperson?.id?.slice(-8) || receiptNumber}</small>
          </div>
          
          <div style="margin-top: 15px; border-top: 1px dashed #999; padding-top: 10px;">
            <strong>Return Policy:</strong><br>
            ${isWholesale 
              ? 'Wholesale: 14 days for credit. Original packaging required.' 
              : 'Retail: 7 days with original receipt. Conditions apply.'}
          </div>
          
          <div style="margin-top: 15px; font-size: 8px; color: #999;">
            This is a computer-generated receipt.<br>
            No signature required. Keep for your records.<br>
            Powered by Inventory Management System
          </div>
        </div>
        
        <script>
          window.onload = function() {
            // Auto-print when page loads
            setTimeout(() => {
              window.print();
              setTimeout(() => window.close(), 1000);
            }, 500);
          }
          
          // Fallback for print
          document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'p') {
              e.preventDefault();
              window.print();
            }
          });
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      const element = receiptRef.current;
      const opt = {
        margin: 0.5,
        filename: `receipt_${receiptNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        },
        jsPDF: { 
          unit: 'in', 
          format: [3.15, 11.69], // 80mm width (thermal printer size)
          orientation: 'portrait' 
        }
      };

      await html2pdf().set(opt).from(element).save();
      
      toast.success('Receipt downloaded successfully!');
    } catch (error) {
      console.error('Failed to download receipt:', error);
      toast.error('Failed to download receipt');
      // Fallback to print if download fails
      printReceipt();
    }
  };

  return (
    <div className="relative">
      {/* Print Controls */}
      <div className="no-print flex justify-end gap-2 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          title="Print Receipt"
        >
          <Printer size={18} />
          Print Receipt
        </button>
        
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          title="Download as PDF"
        >
          <Download size={18} />
          Save as PDF
        </button>
        
        <div className="flex-1 text-right">
          <span className="text-sm text-gray-600">
            Receipt #{receiptNumber}
          </span>
        </div>
      </div>

      {/* Receipt Content */}
      <div ref={receiptRef} className="receipt-container">
        <div className="w-80 bg-card print:bg-white p-6 font-mono shadow-lg rounded-lg border border-border print:border-gray-200 print:text-black">
          {/* Receipt Header */}
          <div className="text-center mb-6 border-b pb-4">
            <h1 className={`text-2xl font-bold ${isWholesale ? 'text-blue-700' : 'text-gray-900'}`}>
              {isWholesale ? 'WHOLESALE INVOICE' : 'RETAIL RECEIPT'}
            </h1>
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-2 ${
              isWholesale 
                ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
            }`}>
              {isWholesale ? '📦 WHOLESALE' : '🛍️ RETAIL'}
            </div>
            <p className="text-lg font-semibold text-gray-800 mt-2">{branch?.name || 'Store'}</p>
            {branch?.address && <p className="text-sm text-gray-600">{branch.address}</p>}
            {branch?.phone && <p className="text-sm text-gray-600">Tel: {branch.phone}</p>}
          </div>

          {/* Receipt Info */}
          <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="font-medium text-gray-700">Receipt #:</p>
              <p className="text-gray-900">{receiptNumber}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-700">Date:</p>
              <p className="text-gray-900">{date}</p>
            </div>
          </div>

          {/* Sales Type Badge */}
          <div className={`mb-4 p-2 rounded-lg text-center ${
            isWholesale 
              ? 'bg-blue-50 border border-blue-200' 
              : 'bg-indigo-50 border border-indigo-200'
          }`}>
            <p className="font-bold text-sm">
              {isWholesale ? 'WHOLESALE TRANSACTION' : 'RETAIL TRANSACTION'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {isWholesale 
                ? 'Bulk pricing applied • Business purchase' 
                : 'Standard retail pricing • Consumer purchase'}
            </p>
          </div>

          {/* Customer Info */}
          <div className="mb-4 border-b pb-4">
            <p className="text-sm font-medium text-gray-700 mb-1">BILL TO:</p>
            <p className="text-gray-900 font-medium">{customer.name || 'Walk-in Customer'}</p>
            {customer.phone && <p className="text-sm text-gray-600">Phone: {customer.phone}</p>}
            {customer.email && <p className="text-sm text-gray-600">Email: {customer.email}</p>}
            {!customer.name && !customer.phone && (
              <p className="text-sm text-gray-500 italic">No customer information provided</p>
            )}
          </div>

          {/* Salesperson Info */}
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-700">Served by:</p>
                <p className="text-gray-900">{salesperson?.full_name || 'Sales Staff'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">Staff ID:</p>
                <p className="text-gray-900 text-sm">{salesperson?.id?.slice(-6) || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border-t border-b border-gray-300 py-4 my-4">
            <div className="grid grid-cols-12 gap-1 text-xs font-bold text-gray-700 mb-3 pb-2 border-b">
              <div className="col-span-5">ITEM</div>
              <div className="col-span-2 text-center">QTY</div>
              <div className="col-span-3 text-right">UNIT PRICE</div>
              <div className="col-span-2 text-right">TOTAL</div>
            </div>
            
            {sale.map((item, index) => {
              const itemTotal = item.unitPrice * item.quantity * (1 - item.discount / 100);
              const hasWholesalePrice = item.product.wholesale_price && 
                item.product.wholesale_price !== item.product.price;
              
              return (
                <div key={index} className="grid grid-cols-12 gap-1 py-2 border-b border-gray-100 last:border-0">
                  <div className="col-span-5">
                    <p className="text-sm font-medium">{item.product.name}</p>
                    <p className="text-xs text-gray-500">{item.product.sku}</p>
                    {isWholesale && hasWholesalePrice && (
                      <div className="flex items-center mt-1">
                        <span className="text-xs text-green-600 bg-green-50 px-1 py-0.5 rounded">
                          Wholesale Price
                        </span>
                        <span className="text-xs text-gray-400 line-through ml-2">
                          ${item.product.price.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {item.discount > 0 && (
                      <span className="text-xs text-red-600 bg-red-50 px-1 py-0.5 rounded mt-1 inline-block">
                        {item.discount}% off
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 text-center text-sm font-medium">{item.quantity}</div>
                  <div className="col-span-3 text-right">
                    <div className="text-sm font-medium">${item.unitPrice.toFixed(2)}</div>
                    {!isWholesale && hasWholesalePrice && (
                      <div className="text-xs text-blue-600">Wholesale: ${item.product.wholesale_price?.toFixed(2)}</div>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="text-sm font-bold">${itemTotal.toFixed(2)}</div>
                    {item.discount > 0 && (
                      <div className="text-xs text-gray-500">
                        Save: ${(item.unitPrice * item.quantity * (item.discount / 100)).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Section */}
          <div className="mb-6">
            {/* Discount Summary */}
            {sale.some(item => item.discount > 0) && (
              <div className="mb-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <p className="text-sm font-medium text-yellow-800 mb-1">Discounts Applied:</p>
                {sale
                  .filter(item => item.discount > 0)
                  .map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.product.name}:</span>
                      <span className="text-green-600 font-medium">
                        -${(item.unitPrice * item.quantity * (item.discount / 100)).toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              
              {/* Sales Type Note */}
              <div className={`text-xs px-2 py-1 rounded ${
                isWholesale 
                  ? 'bg-blue-50 text-blue-700 border border-blue-500/20' 
                  : 'bg-gray-50 text-gray-600 border border-gray-100'
              }`}>
                {isWholesale 
                  ? '✓ Wholesale pricing applied to all items' 
                  : '✓ Standard retail pricing'}
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax (16%):</span>
                <span className="font-medium">${tax.toFixed(2)}</span>
              </div>
              
              <div className={`flex justify-between text-lg font-bold border-t pt-3 mt-2 ${
                isWholesale ? 'border-blue-200' : 'border-gray-200'
              }`}>
                <span>TOTAL AMOUNT:</span>
                <span className={isWholesale ? 'text-blue-700' : 'text-gray-900'}>
                  ${finalTotal.toFixed(2)}
                </span>
              </div>
              
              {/* Sales Type Summary */}
              <div className={`mt-3 p-2 rounded text-center text-sm ${
                isWholesale 
                  ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                  : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
              }`}>
                <p className="font-medium">
                  {isWholesale 
                    ? `${sale.length} items • Wholesale Purchase` 
                    : `${sale.length} items • Retail Purchase`}
                </p>
                <p className="text-xs mt-1">
                  {isWholesale 
                    ? 'This is a business transaction with wholesale pricing' 
                    : 'This is a consumer retail transaction'}
                </p>
              </div>
            </div>
          </div>

          {/* Payment & Terms */}
          <div className="border-t pt-4">
            <div className="text-center mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">PAYMENT STATUS:</p>
              <div className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                PAID IN FULL
              </div>
            </div>
            
            <div className="text-xs text-gray-500 space-y-1">
              <p className="text-center">Thank you for your {isWholesale ? 'business' : 'purchase'}!</p>
              <div className="border-t border-gray-200 pt-3 mt-3">
                <p className="font-medium text-gray-700 mb-1">Return Policy:</p>
                <p>
                  {isWholesale 
                    ? 'Wholesale items may be returned within 14 days for credit. Original packaging required.'
                    : 'Retail items can be returned within 7 days with original receipt. Conditions apply.'}
                </p>
              </div>
              <div className="border-t border-gray-200 pt-3 mt-3">
                <p className="text-center">
                  <span className="font-medium">Powered by</span> Inventory Management System
                </p>
                <p className="text-center text-xs mt-1">Transaction ID: {salesperson?.id?.slice(-8) || receiptNumber}</p>
              </div>
            </div>
          </div>

          {/* Print Instructions */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              This is a computer-generated receipt. No signature required.
              <br />
              Keep this receipt for your records and returns.
            </p>
          </div>
        </div>
      </div>

      {/* Toast Notification Component (Add to your app) */}
      <style jsx global>{`
        .no-print {
          @media print {
            display: none !important;
          }
        }
        
        .receipt-container {
          @media print {
            width: 80mm !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
};

// Toast utility function
const toast = {
  success: (message: string) => {
    // Implement your toast notification here
    console.log('Success:', message);
    alert(message); // Fallback
  },
  error: (message: string) => {
    console.error('Error:', message);
    alert(message); // Fallback
  }
};

export default Receipt;          
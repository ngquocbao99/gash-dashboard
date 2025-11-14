import React, { useRef, useState } from 'react';
import gashLogo from '../assets/image/gash-logo.svg';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from '../hooks/useToast';

const BillModal = ({ isOpen, onClose, billData }) => {
  const { showToast } = useToast();
  const billRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  if (!isOpen || !billData) {
    return null;
  }

  const formatPrice = (price) => {
    return price !== undefined && price !== null
      ? new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
      }).format(price)
      : 'N/A';
  };

  const formatDate = (dateString) => {
    return dateString ? new Date(dateString).toLocaleDateString('vi-VN') : 'N/A';
  };

  const renderItemsTable = () => (
    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db' }}>
      <thead>
        <tr style={{ backgroundColor: '#f9fafb' }}>
          <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Product</th>
          <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Color</th>
          <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Size</th>
          <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Quantity</th>
          <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Unit Price</th>
          <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {billData.items?.map((item, index) => (
          <tr key={index}>
            <td style={{ border: '1px solid #d1d5db', padding: '12px' }}>
              <p style={{ fontWeight: 600, color: '#1f2937', margin: 0 }}>{item.productName || 'N/A'}</p>
            </td>
            <td style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center', color: '#6b7280' }}>
              {item.color || 'N/A'}
            </td>
            <td style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center', color: '#6b7280' }}>
              {item.size || 'N/A'}
            </td>
            <td style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center', fontWeight: 500 }}>
              {item.quantity || 0}
            </td>
            <td style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'right', color: '#6b7280' }}>
              {formatPrice(item.unitPrice)}
            </td>
            <td style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>
              {formatPrice(item.totalPrice)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const handleExportPDF = async () => {
    if (!billData) {
      showToast('Unable to export PDF: No bill data', 'error');
      return;
    }

    try {
      const pdfContent = document.createElement('div');
      pdfContent.style.cssText = `
        width: 800px;
        background: white;
        font-family: Arial, sans-serif;
        color: #000;
        padding: 20px;
        box-sizing: border-box;
      `;

      pdfContent.innerHTML = `
        <div style="background: linear-gradient(to right, #7B542F, #B6771D); padding: 32px; border-bottom: 4px solid #FF9D00; color: white;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="display: flex; align-items: center;">
              <div style="width: 200px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 16px; padding: 8px;">
                <img src="${gashLogo}" alt="GASH Logo" style="height: 48px; width: auto;" />
              </div>
              <div>
                <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">Modern fashion for everyone</p>
              </div>
            </div>
            <div style="text-align: right;">
              <h2 style="font-size: 30px; font-weight: bold; color: white; margin: 0 0 8px 0;">INVOICE</h2>
              <p style="color: rgba(255,255,255,0.9); margin: 0;">Date: ${formatDate(billData.order?.orderDate)}</p>
              <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">Order ID: #${billData.order?.orderId || billData.order?._id || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div style="padding: 32px; border-bottom: 1px solid #e5e7eb;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
            <div style="background: #FFCF71; padding: 24px; border-radius: 8px; border-left: 4px solid #B6771D;">
              <h3 style="font-size: 18px; font-weight: bold; color: #7B542F; margin: 0 0 16px 0;">BILL TO:</h3>
              <div style="color: #374151;">
                <p style="color: #4b5563; margin: 0 0 4px 0;">Name: ${billData.customer?.name || 'N/A'}</p>
                <p style="color: #4b5563; margin: 0 0 4px 0;">Email: ${billData.customer?.email || 'N/A'}</p>
                <p style="color: #4b5563; margin: 0 0 4px 0;">Phone: ${billData.customer?.phone || 'N/A'}</p>
                <p style="color: #4b5563; margin: 0;">Address: ${billData.customer?.address || 'N/A'}</p>
              </div>
            </div>
            <div style="background: #FFCF71; padding: 24px; border-radius: 8px; border-left: 4px solid #B6771D;">
              <h3 style="font-size: 18px; font-weight: bold; color: #7B542F; margin: 0 0 16px 0;">PAY TO:</h3>
              <div style="color: #374151;">
                <p style="font-weight: 600; color: #111827; margin: 0 0 4px 0;">GASH Company</p>
                <p style="color: #4b5563; margin: 0 0 4px 0;">support@gash.com</p>
                <p style="color: #4b5563; margin: 0 0 4px 0;">600 Nguyễn Văn Cừ Nối Dài</p>
                <p style="color: #4b5563; margin: 0;">An Bình, Bình Thủy, Cần Thơ</p>
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 24px;">
          <h3 style="font-size: 18px; font-weight: bold; color: #1f2937; margin: 0 0 16px 0;">ORDER ITEMS</h3>
          ${renderItemsTable().outerHTML}
        </div>

        <div style="padding: 32px; background-color: #FFCF71; border-top: 1px solid #e5e7eb;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
            <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 18px; font-weight: bold; color: #7B542F; margin: 0 0 16px 0;">PAYMENT INFORMATION</h3>
              <div style="color: #374151; space-y: 8px;">
                <p style="margin: 0;"><span style="font-weight: 600;">Method:</span> ${billData.order?.paymentMethod || 'N/A'}</p>
                <p style="margin: 0;"><span style="font-weight: 600;">Status:</span> ${billData.order?.paymentStatus?.toUpperCase() || 'N/A'}</p>
                ${billData.discount?.voucher ? `
                  <p style="margin: 0;"><span style="font-weight: 600;">Voucher:</span> ${billData.discount.voucher.code} (${billData.discount.voucher.discountValue}${billData.discount.voucher.discountType === 'percentage' ? '%' : '₫'} off)</p>
                ` : ''}
              </div>
            </div>
            <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 18px; font-weight: bold; color: #7B542F; margin: 0 0 16px 0;">PRICE SUMMARY</h3>
              <div style="space-y: 8px;">
                <div style="display: flex; justify-content: space-between;">
                  <span>Subtotal:</span>
                  <span>${formatPrice(billData.summary?.subtotal)}</span>
                </div>
                ${billData.summary?.discount > 0 ? `
                  <div style="display: flex; justify-content: space-between; color: #B6771D;">
                    <span>Discount:</span>
                    <span>-${formatPrice(billData.summary.discount)}</span>
                  </div>
                ` : ''}
                <hr style="border-color: #d1d5db;" />
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px;">
                  <span>Total:</span>
                  <span style="color: #B6771D;">${formatPrice(billData.summary?.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 24px; background-color: #FFCF71; text-align: center; color: #4b5563;">
          <p style="margin: 0 0 4px 0;">Thank you for your purchase!</p>
          <p style="font-size: 14px; margin: 0;">For support, contact: support@gash.com</p>
        </div>
      `;

      document.body.appendChild(pdfContent);

      const canvas = await html2canvas(pdfContent, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width / 2;
      const imgHeight = canvas.height / 2;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`invoice_${billData.order?.orderId || billData.order?._id || 'bill'}.pdf`);

      document.body.removeChild(pdfContent);
      showToast('PDF exported successfully', 'success');
    } catch (err) {
      showToast('Failed to export PDF', 'error');
    }
  };

  return (
    <>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl border-2 w-full max-w-3xl transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95 max-h-[90vh] flex flex-col overflow-hidden" style={{ borderColor: '#A86523' }}>
          <div className="bg-white z-10 p-3 sm:p-4 lg:p-5 border-b shrink-0" style={{ borderColor: '#A86523' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Bill Details</h2>
              <div className="flex items-center gap-2 lg:gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={handleExportPDF}
                  className="px-3 lg:px-4 py-2 lg:py-3 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md font-medium text-xs lg:text-sm flex items-center space-x-2"
                  style={{ backgroundColor: '#E9A319' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A86523'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E9A319'}
                >
                  <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export PDF</span>
                </button>
                <button
                  type="button"
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ '--tw-ring-color': '#A86523' }}
                  onClick={onClose}
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div
            ref={billRef}
            className="p-3 lg:p-4 flex-1 overflow-y-auto hide-scrollbar"
            style={{
              scrollbarWidth: 'none', /* Firefox */
              msOverflowStyle: 'none', /* IE and Edge */
            }}
          >
            <div className="bg-white border-2 shadow-md" style={{ borderColor: '#A86523' }}>
              {/* Header */}
              <div className="p-4 lg:p-5 border-b-4 border-orange-400" style={{ background: 'linear-gradient(to right, #7B542F, #B6771D)' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-36 h-12 bg-white/20 rounded-lg flex items-center justify-center p-2">
                      <img src={gashLogo} alt="GASH Logo" className="h-10 w-auto" />
                    </div>
                    <div className="text-white/90">
                      <p className="text-xs lg:text-sm">Modern fashion for everyone</p>
                    </div>
                  </div>
                  <div className="text-right text-white">
                    <h2 className="text-xl lg:text-2xl font-bold mb-1">INVOICE</h2>
                    <p className="text-xs lg:text-sm">Date: {formatDate(billData.order?.orderDate)}</p>
                    <p className="text-xs lg:text-sm">Order ID: #{billData.order?.orderId || billData.order?._id || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Bill To / Pay To */}
              <div className="p-4 lg:p-5 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#FFCF71', borderLeft: '4px solid #B6771D' }}>
                    <h3 className="text-base font-bold mb-3" style={{ color: '#7B542F' }}>BILL TO:</h3>
                    <div className="text-gray-700 space-y-0.5">
                      <p className="text-sm text-gray-600">Name: {billData.customer?.name || 'N/A'}</p>
                      <p className="text-sm text-gray-600">Email: {billData.customer?.email || 'N/A'}</p>
                      <p className="text-sm text-gray-600">Phone: {billData.customer?.phone || 'N/A'}</p>
                      <p className="text-sm text-gray-600">Address: {billData.customer?.address || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#FFCF71', borderLeft: '4px solid #B6771D' }}>
                    <h3 className="text-base font-bold mb-3" style={{ color: '#7B542F' }}>PAY TO:</h3>
                    <div className="text-gray-700 space-y-0.5">
                      <p className="text-sm font-semibold text-gray-900">GASH Company</p>
                      <p className="text-sm text-gray-600">support@gash.com</p>
                      <p className="text-sm text-gray-600">600 Nguyễn Văn Cừ Nối Dài</p>
                      <p className="text-sm text-gray-600">An Bình, Bình Thủy, Cần Thơ</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="p-4">
                <h3 className="text-base font-bold text-gray-800 mb-3">ORDER ITEMS</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">Product</th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700">Color</th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700">Size</th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700">Quantity</th>
                        <th className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold text-gray-700">Unit Price</th>
                        <th className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billData.items?.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-3 py-2">
                            <p className="text-sm font-semibold text-gray-800">{item.productName || 'N/A'}</p>
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm text-gray-600">
                            {item.color || 'N/A'}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm text-gray-600">
                            {item.size || 'N/A'}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm font-medium">
                            {item.quantity || 0}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right text-sm text-gray-600">
                            {formatPrice(item.unitPrice)}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold text-gray-800">
                            {formatPrice(item.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Info */}
              <div className="p-4 lg:p-5 border-t border-gray-200" style={{ backgroundColor: '#FFCF71' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <h3 className="text-base font-bold mb-3" style={{ color: '#7B542F' }}>PAYMENT INFORMATION</h3>
                    <div className="text-gray-700 space-y-1.5 text-sm">
                      <p><span className="font-semibold">Method:</span> {billData.order?.paymentMethod || 'N/A'}</p>
                      <p><span className="font-semibold">Payment Status:</span> {billData.order?.paymentStatus ? billData.order.paymentStatus.charAt(0).toUpperCase() + billData.order.paymentStatus.slice(1) : 'N/A'}</p>
                      {billData.discount?.voucher && (
                        <p><span className="font-semibold">Voucher:</span> {billData.discount.voucher.code} ({billData.discount.voucher.discountValue}{billData.discount.voucher.discountType === 'percentage' ? '%' : '₫'} off)</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <h3 className="text-base font-bold mb-3" style={{ color: '#7B542F' }}>PRICE SUMMARY</h3>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatPrice(billData.summary?.subtotal)}</span>
                      </div>
                      {billData.summary?.discount > 0 && (
                        <div className="flex justify-between" style={{ color: '#B6771D' }}>
                          <span>Discount:</span>
                          <span>-{formatPrice(billData.summary.discount)}</span>
                        </div>
                      )}
                      <hr className="border-gray-300" />
                      <div className="flex justify-between font-bold text-base">
                        <span>Total:</span>
                        <span style={{ color: '#B6771D' }}>{formatPrice(billData.summary?.totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200" style={{ backgroundColor: '#FFCF71' }}>
                <div className="text-center text-gray-600">
                  <p className="mb-1 text-sm">Thank you for your purchase!</p>
                  <p className="text-xs">For support, contact: support@gash.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BillModal;


const PDFDocument = require('pdfkit');

const generateInvoicePDF = (orderData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30 });
      let buffers = [];

      doc.on('data', (data) => {
        buffers.push(data);
      });

      doc.on('end', () => {
        const pdf = Buffer.concat(buffers);
        resolve(pdf);
      });

      doc.on('error', reject);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('LocalBiz', { align: 'left' });
      doc.fontSize(10).font('Helvetica').text('Invoice', { align: 'right', moveUp: 1.5 });
      doc.fontSize(9).text(`Invoice #: INV-${orderData.orderId}`, { align: 'right' });
      doc.fontSize(9).text(`Date: ${new Date(orderData.createdAt).toLocaleDateString()}`, { align: 'right' });

      // Divider
      doc.moveTo(30, 80).lineTo(580, 80).stroke();

      // Store & Customer Info
      doc.fontSize(11).font('Helvetica-Bold').text('Store Information', 100);
      doc.fontSize(9).font('Helvetica');
      doc.text(`${orderData.store.storeName}`, 100);
      doc.text(`${orderData.store.address}`, 100);
      doc.text(`${orderData.store.city}`, 100);
      doc.text(`Phone: ${orderData.store.phone}`, 100);

      doc.fontSize(11).font('Helvetica-Bold').text('Customer Information', 330);
      doc.fontSize(9).font('Helvetica');
      doc.text(`${orderData.customer.fullName}`, 330, 100);
      doc.text(`Email: ${orderData.customer.email}`, 330);
      doc.text(`Phone: ${orderData.customer.phone}`, 330);

      doc.fontSize(11).font('Helvetica-Bold').text('Delivery Address', 100, 160);
      doc.fontSize(9).font('Helvetica');
      doc.text(`${orderData.deliveryAddress.street}`, 100);
      doc.text(`${orderData.deliveryAddress.city}`, 100);

      // Divider
      doc.moveTo(30, 210).lineTo(580, 210).stroke();

      // Items Table Header
      const tableTop = 230;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Product Name', 40, tableTop);
      doc.text('Qty', 300, tableTop);
      doc.text('Unit Price (PKR)', 360, tableTop);
      doc.text('Total (PKR)', 480, tableTop);

      doc.moveTo(30, tableTop + 15).lineTo(580, tableTop + 15).stroke();

      // Items
      let yPosition = tableTop + 25;
      doc.fontSize(9).font('Helvetica');

      orderData.items.forEach((item) => {
        doc.text(item.productName || 'Product', 40, yPosition);
        doc.text(item.quantity.toString(), 300, yPosition);
        doc.text(item.unitPrice.toFixed(2), 360, yPosition);
        doc.text(item.total.toFixed(2), 480, yPosition);
        yPosition += 20;
      });

      // Divider
      doc.moveTo(30, yPosition).lineTo(580, yPosition).stroke();

      // Totals
      yPosition += 10;
      doc.fontSize(10).font('Helvetica');
      doc.text('Subtotal (PKR):', 350, yPosition);
      doc.text(orderData.totalAmount.toFixed(2), 480, yPosition);

      yPosition += 20;
      doc.text('Tax (PKR):', 350, yPosition);
      doc.text('0.00', 480, yPosition);

      yPosition += 20;
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Grand Total (PKR):', 350, yPosition);
      doc.text(orderData.totalAmount.toFixed(2), 480, yPosition);

      // Payment Info
      yPosition += 40;
      doc.fontSize(10).font('Helvetica-Bold').text('Payment Details', 40, yPosition);
      yPosition += 15;
      doc.fontSize(9).font('Helvetica');
      doc.text(`Method: ${orderData.paymentMethod.toUpperCase()}`, 40, yPosition);
      yPosition += 15;
      doc.text(`Status: ${orderData.paymentStatus.toUpperCase()}`, 40, yPosition);

      // Footer
      doc.fontSize(8).font('Helvetica').text('Thank you for shopping with LocalBiz!', 40, 750, {
        align: 'center',
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateInvoicePDF;

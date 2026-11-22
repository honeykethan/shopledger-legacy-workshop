const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function makeOrder(coupon) {
  const items = [{
    id: 1,
    sku: 'RICE-001',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];
  const totals = pricing.computeTotals(items, coupon || '');

  return {
    id: 9001,
    date: '22/11/2026',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice matches the billed total and HSN GST breakdown', () => {
  const items = [{
    id: 1,
    sku: 'RICE-001',
    name: 'Rice',
    hsn: '1006',
    price: 640,
    qty: 1
  }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures({
    items,
    coupon: 'SAVE10',
    total: billed.total,
    tax: billed.tax
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.8);
  assert.equal(figures.discount, 64);
  assert.equal(figures.tax, 28.8);
  assert.equal(figures.cgst, 14.4);
  assert.equal(figures.sgst, 14.4);
  assert.equal(figures.total, 604.8);
  assert.equal(figures.total, billed.total);
  assert.equal(figures.tax, billed.tax);
});

test('CURRENT BEHAVIOUR: billed totals use the HSN slab and tax the discounted taxable value', () => {
  const order = makeOrder('WELCOME');
  const billed = pricing.computeTotals(order.items, order.coupon);

  assert.equal(billed.subtotal, 100);
  assert.equal(billed.discount, 5);
  assert.equal(billed.lines[0].gstPercent, 5);
  assert.equal(billed.lines[0].taxable, 95);
  assert.equal(billed.tax, 4.75);
  assert.equal(billed.cgst, 2.38);
  assert.equal(billed.sgst, 2.37);
  assert.equal(billed.total, 99.75);
});

test('invoice uses the billed HSN rate and applies the coupon before GST', () => {
  const order = makeOrder('WELCOME');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 100);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.cgst, 2.38);
  assert.equal(figures.sgst, 2.37);
  assert.equal(figures.total, order.total);
});

test('invoice matches billed HSN GST on an order without a coupon', () => {
  const order = makeOrder('');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
});

test('GST reconciliation reports matching invoice and ledger amounts', () => {
  const order = makeOrder('WELCOME');
  const reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 4.75);
  assert.equal(reconciliation.rows[0].invoiceTax, 4.75);
  assert.equal(reconciliation.rows[0].ledgerTotal, 99.75);
  assert.equal(reconciliation.rows[0].invoiceTotal, 99.75);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

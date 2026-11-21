import { describe, expect, it } from 'vitest';
import {
  isTrustedInvoiceUrl,
  paymentStepFromResult,
  parseCurrency,
  invoiceFilename,
  type PaymentCheckResult,
} from '../src/payment/helpers';

const base: PaymentCheckResult = {
  isPaymentPage: true,
  status: 'unknown',
  hasInvoice: false,
  message: '',
};

describe('isTrustedInvoiceUrl', () => {
  it('accepts https IVAC domains', () => {
    expect(isTrustedInvoiceUrl('https://payment.ivacbd.com/invoice.pdf')).toBe(true);
    expect(isTrustedInvoiceUrl('https://ivacbd.com/receipt/1')).toBe(true);
  });

  it('rejects http, lookalike and foreign domains', () => {
    expect(isTrustedInvoiceUrl('http://payment.ivacbd.com/invoice.pdf')).toBe(false);
    expect(isTrustedInvoiceUrl('https://evilivacbd.com/invoice.pdf')).toBe(false);
    expect(isTrustedInvoiceUrl('https://ivacbd.com.evil.com/invoice.pdf')).toBe(false);
    expect(isTrustedInvoiceUrl('https://example.com/invoice.pdf')).toBe(false);
  });

  it('rejects dangerous or invalid values', () => {
    expect(isTrustedInvoiceUrl('javascript:alert(1)')).toBe(false);
    expect(isTrustedInvoiceUrl('not a url')).toBe(false);
    expect(isTrustedInvoiceUrl(undefined)).toBe(false);
  });
});

describe('paymentStepFromResult', () => {
  it('does not touch state when not on a payment page', () => {
    expect(paymentStepFromResult({ ...base, isPaymentPage: false })).toBeNull();
  });

  it('maps failed and pending', () => {
    expect(paymentStepFromResult({ ...base, status: 'failed' })).toBe('payment_failed');
    expect(paymentStepFromResult({ ...base, status: 'pending' })).toBe('payment_pending');
  });

  it('requires evidence before marking success', () => {
    expect(paymentStepFromResult({ ...base, status: 'success' })).toBe('unknown_status');
    expect(
      paymentStepFromResult({ ...base, status: 'success', hasInvoice: true })
    ).toBe('payment_success');
    expect(
      paymentStepFromResult({ ...base, status: 'success', confirmationNumber: 'AB123456' })
    ).toBe('payment_success');
  });

  it('treats unclear status as unknown', () => {
    expect(paymentStepFromResult({ ...base, status: 'unknown' })).toBe('unknown_status');
  });
});

describe('helpers', () => {
  it('parses currency', () => {
    expect(parseCurrency('BDT 800')).toBe('BDT');
    expect(parseCurrency('৳ 800')).toBe('৳');
    expect(parseCurrency(undefined)).toBe('');
  });

  it('builds a safe filename with the right extension', () => {
    expect(invoiceFilename('https://payment.ivacbd.com/a/b.png', 1)).toBe('IVAC/Invoice_1.png');
    expect(invoiceFilename('https://payment.ivacbd.com/download?id=5', 2)).toBe('IVAC/Invoice_2.pdf');
  });
});
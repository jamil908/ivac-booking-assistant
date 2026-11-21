import type { BookingStep, PaymentInfo } from '../types';

export interface PaymentCheckResult {
  isPaymentPage: boolean;
  status: 'success' | 'pending' | 'failed' | 'unknown';
  hasInvoice: boolean;
  invoiceUrl?: string;
  confirmationNumber?: string;
  amount?: string;
  message: string;
}

const TRUSTED_DOMAIN = 'ivacbd.com';

/** শুধু https এবং ivacbd.com (বা তার subdomain) গ্রহণযোগ্য */
export function isTrustedInvoiceUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    return (
      url.hostname === TRUSTED_DOMAIN ||
      url.hostname.endsWith('.' + TRUSTED_DOMAIN)
    );
  } catch {
    return false;
  }
}

/** null মানে: এটা payment পেজ না, তাই state ছুঁয়ো না */
export function paymentStepFromResult(r: PaymentCheckResult): BookingStep | null {
  if (!r.isPaymentPage) return null;

  switch (r.status) {
    case 'failed':
      return 'payment_failed';
    case 'pending':
      return 'payment_pending';
    case 'success':
      // শুধু পেজের লেখা দেখে সফল ধরা হচ্ছে, তাই প্রমাণ (রেফারেন্স বা invoice) লাগবে
      return r.confirmationNumber || r.hasInvoice
        ? 'payment_success'
        : 'unknown_status';
    default:
      return 'unknown_status';
  }
}

export function parseCurrency(amount?: string): string {
  const match = amount?.match(/BDT|৳|USD|\$|EUR|€/i);
  return match ? match[0].toUpperCase() : '';
}

export function buildPaymentInfo(r: PaymentCheckResult): PaymentInfo {
  return {
    amount: r.amount ?? '',
    currency: parseCurrency(r.amount),
    paymentStatus: r.status,
  };
}

export function invoiceFilename(url: string, now: number = Date.now()): string {
  let ext = 'pdf';
  try {
    const m = new URL(url).pathname.toLowerCase().match(/\.(pdf|png|jpe?g)$/);
    if (m?.[1]) ext = m[1];
  } catch {
    // ডিফল্ট pdf
  }
  return `IVAC/Invoice_${now}.${ext}`;
}
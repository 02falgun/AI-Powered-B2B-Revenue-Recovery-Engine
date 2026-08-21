'use client';

import { useState } from 'react';

export interface RazorpayCheckoutButtonProps {
  readonly amountPaise: number;
  readonly invoiceId: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerPhone?: string;
  readonly buttonText?: string;
  readonly className?: string;
  readonly onPaymentSuccess?: (data: Record<string, unknown>) => void;
  readonly onPaymentError?: (errorMessage: string) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
    };
  }
}

/**
 * Loads Razorpay Checkout JS script dynamically.
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

export function RazorpayCheckoutButton({
  amountPaise,
  invoiceId,
  customerName,
  customerEmail,
  customerPhone = '+919999999999',
  buttonText = 'Pay Now with Razorpay Checkout',
  className = '',
  onPaymentSuccess,
  onPaymentError,
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setStatusMessage(null);

    // 1. Ensure Razorpay checkout.js script is loaded
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded || !window.Razorpay) {
      const errorMsg =
        'Failed to load Razorpay Checkout script. Please check your internet connection.';
      setStatusMessage(errorMsg);
      onPaymentError?.(errorMsg);
      setLoading(false);
      return;
    }

    // 2. Call Backend API to create order
    try {
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise,
          invoiceId,
          receipt: `rcpt_${invoiceId.slice(0, 8)}_${Date.now()}`,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderData.success || !orderData.order_id) {
        const errorMsg = orderData.error ?? 'Failed to create Razorpay payment order.';
        setStatusMessage(`Error: ${errorMsg}`);
        onPaymentError?.(errorMsg);
        setLoading(false);
        return;
      }

      // 3. Configure Razorpay Standard Checkout options
      const publicKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || orderData.key_id;

      const options = {
        key: publicKey,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'RecoverAI B2B Recovery',
        description: `Payment for Invoice #${invoiceId.slice(0, 8)}`,
        order_id: orderData.order_id,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        notes: {
          invoice_id: invoiceId,
        },
        theme: {
          color: '#4f46e5', // Indigo modern theme
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          setStatusMessage('Verifying payment signature with backend...');

          try {
            // STEP 3: Verify Payment Signature on Backend
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                invoice_id: invoiceId,
                amount_paid_paise: amountPaise,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyData.success && verifyData.verified) {
              setStatusMessage('✅ Payment verified successfully!');
              onPaymentSuccess?.(verifyData);
            } else {
              const errorMsg =
                verifyData.error ?? 'Payment verification failed: invalid signature.';
              setStatusMessage(`❌ Verification Failed: ${errorMsg}`);
              onPaymentError?.(errorMsg);
            }
          } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Verification request failed';
            setStatusMessage(`❌ Error: ${errorMsg}`);
            onPaymentError?.(errorMsg);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            console.log('[Razorpay Modal] User dismissed checkout modal.');
          },
        },
      };

      // 4. Open Razorpay Checkout Modal
      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on('payment.failed', function (resp: Record<string, unknown>) {
        const errorObj = (resp.error ?? {}) as Record<string, unknown>;
        const failReason = String(errorObj.description ?? 'Payment processing failed.');
        setStatusMessage(`❌ Payment Failed: ${failReason}`);
        onPaymentError?.(failReason);
        setLoading(false);
      });

      razorpayInstance.open();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Checkout initiation error';
      setStatusMessage(`Error: ${errorMsg}`);
      onPaymentError?.(errorMsg);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading || amountPaise < 100}
        className={
          className ||
          'inline-flex items-center justify-center gap-2 py-3 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm transition-colors shadow-md'
        }
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
            <span>Opening Checkout...</span>
          </>
        ) : (
          <>
            <span>💳</span>
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {statusMessage && (
        <div className="text-xs font-mono text-center px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-300">
          {statusMessage}
        </div>
      )}
    </div>
  );
}

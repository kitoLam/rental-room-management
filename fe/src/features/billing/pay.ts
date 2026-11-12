import { billingApi, MIN_ONLINE_PAYMENT, PAYABLE, type BillingInvoice } from '@/services/billing'
import { useMutation } from '@tanstack/react-query'

/** Starts a VNPay payment for the unpaid part of an invoice and leaves for the gateway. */
export function usePayInvoice() {
  return useMutation({
    mutationFn: billingApi.payOnline,
    onSuccess: ({ paymentUrl }) => {
      window.location.href = paymentUrl
    },
  })
}

export function canPayOnline(invoice: BillingInvoice) {
  const remaining = invoice.remainingAmount ?? invoice.totalAmount
  return PAYABLE.includes(invoice.status) && remaining >= MIN_ONLINE_PAYMENT
}

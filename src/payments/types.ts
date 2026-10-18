export const BOLD_CURRENCY = "COP" as const;
export const BOLD_CHECKOUT_SRC = "https://checkout.bold.co/library/boldPaymentButton.js";
export const BOLD_VOUCHER_API = "https://payments.api.bold.co/v2/payment-voucher";

export type BoldEnvironment = "test" | "prod";
export type BoldTxStatus =
  | "APPROVED"
  | "REJECTED"
  | "FAILED"
  | "VOIDED"
  | "PROCESSING"
  | "PENDING"
  | "NO_TRANSACTION_FOUND";

export type PaymentProvider = "bold";
export type PaymentPurpose = "order" | (string & {});

export type PaymentIntentStatus =
  | "created"
  | "pending"
  | "approved"
  | "declined"
  | "voided"
  | "error";

export type BoldDocumentType = "CC" | "CE" | "PA" | "NIT" | "TI";

export type BoldCustomerData = {
  email?: string;
  fullName?: string;
  phone?: string;
  dialCode?: string;
  documentNumber?: string;
  documentType?: BoldDocumentType;
};

export type BoldBillingAddress = {
  address?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  country?: string;
};

/** Config del constructor `BoldCheckout` (camelCase, docs oficiales). */
export type BoldCheckoutConfig = {
  orderId: string;
  currency: typeof BOLD_CURRENCY;
  amount: string;
  apiKey: string;
  integritySignature: string;
  description?: string;
  redirectionUrl?: string;
  originUrl?: string;
  /** Unix en milisegundos. El ejemplo oficial del constructor es de 13 dígitos. */
  expirationDate?: number;
  renderMode: "embedded";
  customerData?: string;
  billingAddress?: string;
  extraData1?: string;
  extraData2?: string;
};

export type BoldVoucher = {
  link_id?: string;
  transaction_id?: string;
  total?: number;
  subtotal?: number;
  description?: string;
  reference_id?: string;
  payment_method?: string;
  payer_email?: string;
  payment_status?: BoldTxStatus | string;
};

export type BoldWebhookEvent = {
  id?: string;
  type?: string;
  subject?: string;
  source?: string;
  time?: number;
  data?: {
    payment_id?: string;
    merchant_id?: string;
    amount?: { currency?: string; total?: number; tip?: number };
    metadata?: { reference?: string };
    payment_method?: string;
    payer_email?: string;
    bold_code?: string;
  };
};

export type PaymentIntent = {
  id: string;
  purpose: PaymentPurpose;
  provider: PaymentProvider;
  reference: string;
  amountCop: number;
  currency: typeof BOLD_CURRENCY;
  status: PaymentIntentStatus;
  redirectPath: string;
  metadata: Record<string, string>;
  customerEmail?: string;
  providerTransactionId?: string;
  providerPaymentType?: string;
  providerStatus?: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  appliedAt?: number;
};

export type BoldCheckoutSession = {
  reference: string;
  amountCop: number;
  currency: typeof BOLD_CURRENCY;
  purpose: PaymentPurpose;
  redirectPath: string;
  checkout: BoldCheckoutConfig;
  metadata: Record<string, string>;
};

export type CreateBoldSessionInput = {
  purpose: PaymentPurpose;
  amountCop: number;
  redirectPath: string;
  metadata?: Record<string, string>;
  reference?: string;
  description?: string;
  expiresAt?: number;
  customer?: BoldCustomerData;
  billingAddress?: BoldBillingAddress;
};

export type AppliedPayment = {
  intent: PaymentIntent;
  voucher: BoldVoucher;
  duplicate: boolean;
};

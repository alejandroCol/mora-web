export type PaymentPolicy = {
  /** true = Bold y Addi cobran en producción. */
  live: boolean;
  updatedAt: number;
};

export const DEFAULT_PAYMENT_POLICY: PaymentPolicy = {
  live: true,
  updatedAt: 0,
};

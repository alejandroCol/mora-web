export type InvoiceStatus = "pending" | "success" | "failed" | "skipped";

export type InvoiceSnapshot = {
  status: InvoiceStatus;
  prefix?: string;
  documentNumber?: string;
  resolutionNumber?: string;
  cufe?: string;
  pdfUrl?: string;
  error?: string;
  skippedReason?: string;
  attemptedAt?: number;
  finalizedAt?: number;
};

export type InvoiceEmitResult = {
  attempted: boolean;
  snapshot: InvoiceSnapshot;
};

import type { PaymentIntentStatus } from "./types";

export function mapBoldStatus(status: string): PaymentIntentStatus {
  switch (status.toUpperCase()) {
    case "APPROVED":
    case "SALE_APPROVED":
    case "PAID":
      return "approved";
    case "REJECTED":
    case "SALE_REJECTED":
      return "declined";
    case "VOIDED":
    case "VOID_APPROVED":
      return "voided";
    case "FAILED":
    case "VOID_REJECTED":
      return "error";
    default:
      return "pending";
  }
}

export function isTerminalIntentStatus(status: PaymentIntentStatus) {
  return status === "approved" || status === "declined" || status === "voided" || status === "error";
}

export function isApprovedStatus(status: string) {
  return mapBoldStatus(status) === "approved";
}

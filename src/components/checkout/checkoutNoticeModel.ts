import { isColombianMobilePhone } from "@/payments/public";

export type CheckoutFixField = "phone" | "document" | "email" | "name" | "shipping";

export type CheckoutNotice = {
  message: string;
  action?: {
    label: string;
    step: number;
    field?: CheckoutFixField;
  };
};

export function noticeForValidation(message: string, step: number): CheckoutNotice {
  return parseCheckoutError(message, step);
}

export function parseCheckoutError(message: string, step = 2): CheckoutNotice {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (/celular|teléfono|telefono|phone|10 dígitos|10 digitos/.test(lower)) {
    return {
      message: friendlyPhoneMessage(text),
      action: { label: "Corregir teléfono", step: 0, field: "phone" },
    };
  }
  if (/cédula|cedula|nit|documento/.test(lower)) {
    return {
      message: text,
      action: { label: "Corregir documento", step: 0, field: "document" },
    };
  }
  if (/correo|email/.test(lower)) {
    return {
      message: text,
      action: { label: "Corregir correo", step: 0, field: "email" },
    };
  }
  if (/nombre/.test(lower) && !/correo/.test(lower)) {
    return {
      message: text,
      action: { label: "Revisar tus datos", step: 0, field: "name" },
    };
  }
  if (/envío|envio|destino|dirección|direccion|cotiz/.test(lower)) {
    return {
      message: text,
      action: { label: "Corregir envío", step: 1, field: "shipping" },
    };
  }
  if (step === 0) {
    return { message: text, action: { label: "Completar datos", step: 0 } };
  }
  if (step === 1) {
    return { message: text, action: { label: "Revisar envío", step: 1, field: "shipping" } };
  }
  return {
    message: text,
    action: { label: "Revisar datos", step: 0 },
  };
}

function friendlyPhoneMessage(raw: string) {
  if (/addi/i.test(raw)) {
    return "Addi pide un celular colombiano de 10 dígitos, empezando en 3 (ej. 300 123 4567).";
  }
  return raw;
}

export function addiPhoneIssue(phone: string): CheckoutNotice | null {
  if (!phone.trim()) {
    return {
      message: "Falta el teléfono para pagar con Addi.",
      action: { label: "Agregar teléfono", step: 0, field: "phone" },
    };
  }
  if (!isColombianMobilePhone(phone)) {
    return {
      message: "Addi pide un celular colombiano de 10 dígitos, empezando en 3 (ej. 300 123 4567).",
      action: { label: "Corregir teléfono", step: 0, field: "phone" },
    };
  }
  return null;
}

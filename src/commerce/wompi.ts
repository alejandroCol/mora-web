export type WompiWidgetConfig = {
  currency: "COP";
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature: { integrity: string };
  redirectUrl: string;
  expirationTime?: string;
  customerData: {
    email: string;
    fullName: string;
    phoneNumber: string;
    phoneNumberPrefix: string;
    legalId?: string;
    legalIdType?: string;
  };
  shippingAddress: {
    addressLine1: string;
    addressLine2?: string;
    country: "CO";
    city: string;
    phoneNumber: string;
    region: string;
    name: string;
  };
};

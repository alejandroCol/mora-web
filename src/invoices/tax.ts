export type InvoiceLineInput = {
  description: string;
  code: string;
  gross: number;
};

export type MatiasTaxLine = {
  description: string;
  code: string;
  lineExtension: number;
  taxAmount: number;
  taxableAmount: number;
  gross: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function copToDecimal2(n: number) {
  return round2(n).toFixed(2);
}

export function splitInclusive(gross: number) {
  const payable = round2(gross);
  const taxable = round2(payable / 1.19);
  const taxAmount = round2(payable - taxable);
  return { payable, taxable, taxAmount };
}

export function buildInvoiceLines(lines: InvoiceLineInput[], withVat: boolean) {
  const prepared: MatiasTaxLine[] = lines
    .filter((line) => Number.isFinite(line.gross) && line.gross > 0)
    .map((line) => {
      const gross = round2(line.gross);
      if (!withVat) {
        return {
          description: line.description,
          code: line.code,
          lineExtension: gross,
          taxAmount: 0,
          taxableAmount: 0,
          gross,
        };
      }
      const split = splitInclusive(gross);
      return {
        description: line.description,
        code: line.code,
        lineExtension: split.taxable,
        taxAmount: split.taxAmount,
        taxableAmount: split.taxable,
        gross,
      };
    });

  const payable = round2(prepared.reduce((sum, line) => sum + line.gross, 0));
  const lineExtension = round2(
    prepared.reduce((sum, line) => sum + line.lineExtension, 0),
  );
  const taxAmount = round2(prepared.reduce((sum, line) => sum + line.taxAmount, 0));

  return {
    lines: prepared,
    payable,
    lineExtension,
    taxExclusiveAmount: withVat ? copToDecimal2(lineExtension) : "0",
    taxInclusiveAmount: copToDecimal2(payable),
    documentTaxTotals: withVat
      ? [
          {
            tax_id: "1",
            tax_amount: taxAmount,
            taxable_amount: lineExtension,
            percent: 19,
          },
        ]
      : [],
  };
}

export function formatAdsMoney(value: number, currency = "COP") {
  const zeroDecimals = currency === "COP" || value >= 1000;
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: zeroDecimals ? 0 : 2,
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString("es-CO")} ${currency}`;
  }
}

export function formatCount(value: number) {
  return Math.round(value).toLocaleString("es-CO");
}

/** «1,4 %» con una cifra decimal. */
export function formatPercent(value: number) {
  return `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
}

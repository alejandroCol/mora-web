export function paidDetail(paidNote: string) {
  const base = "Tu pago quedó aprobado. Te escribimos a tu correo con cada paso.";
  return paidNote ? `${base} ${paidNote}` : base;
}

/** «sábado 21 de noviembre, 9:51 p. m.» en hora de Colombia. */
export function offerDeadline(at: number) {
  const day = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
  const time = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(at)
    .replace(/\s+/g, " ");
  return `${day.replace(",", "")}, ${time}`;
}

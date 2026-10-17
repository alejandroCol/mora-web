import { redirect } from "next/navigation";

export default function EliminarCuentaLegacyRedirect() {
  redirect("/app/eliminar-cuenta");
}

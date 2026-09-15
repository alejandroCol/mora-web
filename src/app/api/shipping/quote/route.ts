import { NextRequest } from "next/server";
import { quoteShipping } from "@/server/quoteShipping";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      departamento?: string;
      ciudad?: string;
      direccion?: string;
      nombre?: string;
      telefono?: string;
      subtotal?: number;
      piezas?: number;
    };
    if (!body.departamento?.trim() || !body.ciudad?.trim() || !body.direccion?.trim()) {
      return Response.json(
        { ok: false, error: "Departamento, ciudad y dirección." },
        { status: 400 },
      );
    }
    const result = await quoteShipping({
      departamento: body.departamento,
      ciudad: body.ciudad,
      direccion: body.direccion,
      nombre: body.nombre,
      telefono: body.telefono,
      subtotal: Number(body.subtotal) || 0,
      piezas: Number(body.piezas) || 1,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos cotizar el envío.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

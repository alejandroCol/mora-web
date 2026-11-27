import type { WhatsAppMessage } from "@/growth/types";
import { buscarMunicipio } from "@/lib/colombiaGeo";

/** Datos de envío y cliente que el cliente manda por chat, listos para la venta. */
export type OrderData = {
  firstName?: string;
  lastName?: string;
  documentNumber?: string;
  phone?: string;
  email?: string;
  departamento?: string;
  ciudad?: string;
  direccion?: string;
  referencia?: string;
};

export type ChatOrderData = {
  data: OrderData;
  /** Vino con etiquetas («Cédula: …»), p. ej. respondiendo «Datos del pedido». Se puede llenar solo. */
  labeled: boolean;
};

type Slot = "name" | "lastName" | "documentNumber" | "phone" | "email" | "ciudad" | "departamento" | "direccion" | "referencia";

const EMAIL_RE = /[^\s@:;,<>()]+@[^\s@:;,<>()]+\.[a-z]{2,}/i;
const ADDRESS_RE =
  /^(calle|cll|cl|carrera|cra|cr|kr|kra|carrea|avenida|av|ak|ac|diagonal|dg|transversal|tv|trans|circular|cq|manzana|mz|autopista|km|vereda)\b/;
const REFERENCE_RE = /^(barrio|apto|apartamento|apt|torre|conjunto|edificio|casa|unidad|interior|bloque|piso|oficina)\b/;
const NOT_A_NAME_RE =
  /\b(hola|buen[oa]s?|dias|tardes|noches|gracias|listo|ok|si|claro|perfecto|quiero|me|el|la|los|del|por|favor|pedido|anillo|mora|talla|pro|ultra)\b/;

/** Minúsculas y sin tildes; conserva el largo para poder recortar el original con los mismos índices. */
function fold(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slotOf(label: string): Slot | null {
  const key = fold(label).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!key || key.length > 32) return null;
  if (/^(nombres?( completos?)?|nombres? y apellidos?|quien recibe|destinatari[oa])$/.test(key)) return "name";
  if (/^apellidos?$/.test(key)) return "lastName";
  if (/^((numero|no|num)( de)? )?(cedula|documento|identificacion|cc|c c|nit)( de ciudadania)?$/.test(key)) {
    return "documentNumber";
  }
  if (/^((numero|no|num)( de)? )?(celular|cel|telefono|tel|movil|whatsapp|contacto)$/.test(key)) return "phone";
  if (/^(correo( electronico)?|e ?mail|mail|gmail)$/.test(key)) return "email";
  if (/^(ciudad|municipio|ciudad y departamento|ciudad departamento)$/.test(key)) return "ciudad";
  if (/^(departamento|depto|dpto)$/.test(key)) return "departamento";
  if (/^(direccion( completa| de (envio|entrega))?|dir)$/.test(key)) return "direccion";
  if (/^(barrio|barrio apto|barrio y apto|apto|apartamento|torre|conjunto|indicaciones|referencia|detalles?)( .*)?$/.test(key)) {
    return "referencia";
  }
  return null;
}

/** «Cédula 1032…» o «CC: 1032…» sin dos puntos o con ellos. */
const INLINE_LABEL_RE =
  /^(nombre completo|nombre|cedula|c\.? ?c\.?|documento|celular|cel|telefono|tel|whatsapp|correo|email|direccion|ciudad|barrio|apto|apartamento)\s+(.+)$/;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function cleanPhone(value: string) {
  const raw = onlyDigits(value);
  const local = raw.length === 12 && raw.startsWith("57") ? raw.slice(2) : raw;
  return local.length >= 7 && local.length <= 10 ? local : "";
}

function cleanDocument(value: string) {
  const raw = onlyDigits(value);
  return raw.length >= 5 && raw.length <= 12 ? raw : "";
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").replace(/^[\s,.;:-]+|[\s,.;]+$/g, "");
}

/** En Colombia: dos nombres y dos apellidos. «Laura Gómez» → Laura / Gómez. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const words = cleanText(full).split(" ").filter(Boolean);
  if (words.length <= 1) return { firstName: words[0] ?? "", lastName: "" };
  const cut = words.length >= 4 ? 2 : 1;
  return { firstName: words.slice(0, cut).join(" "), lastName: words.slice(cut).join(" ") };
}

function looksLikeName(line: string) {
  const words = line.trim().split(/\s+/);
  return (
    words.length >= 2 &&
    words.length <= 5 &&
    /^[\p{L}' ]+$/u.test(line.trim()) &&
    !NOT_A_NAME_RE.test(fold(line))
  );
}

/** Lee un mensaje del cliente. Entiende la plantilla «Datos del pedido» y líneas sueltas. */
export function parseOrderData(text: string): { data: OrderData; found: number; labeled: number } {
  const out: OrderData = {};
  const refs: string[] = [];
  let name = "";
  let nameGuess = "";
  let cityRaw = "";
  let deptRaw = "";
  let labeled = 0;
  let pending: Slot | null = null;

  function put(slot: Slot, raw: string): boolean {
    const value = cleanText(raw);
    if (!value) return false;
    switch (slot) {
      case "name":
        name = value;
        return true;
      case "lastName":
        out.lastName = value;
        return true;
      case "documentNumber": {
        const doc = cleanDocument(value);
        if (doc) out.documentNumber = doc;
        return Boolean(doc);
      }
      case "phone": {
        const phone = cleanPhone(value);
        if (phone) out.phone = phone;
        return Boolean(phone);
      }
      case "email": {
        const email = EMAIL_RE.exec(value)?.[0];
        if (email) out.email = email.toLowerCase();
        return Boolean(email);
      }
      case "ciudad": {
        cityRaw = value;
        const geo = buscarMunicipio(value);
        if (geo) {
          out.departamento = geo.departamento;
          out.ciudad = geo.ciudad;
        }
        return true;
      }
      case "departamento":
        deptRaw = value;
        return true;
      case "direccion":
        out.direccion = value;
        return true;
      case "referencia":
        refs.push(value);
        return true;
    }
  }

  const lines = text.normalize("NFC").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (!line) continue;
    const folded = fold(line);
    // «CC 5212… y mi correo es ana@…»: el correo sale aunque la línea sea de otro dato.
    const mail = EMAIL_RE.exec(line)?.[0];
    if (mail) out.email = mail.toLowerCase();

    const colon = line.search(/[:=]/);
    if (colon > 0) {
      const slot = slotOf(line.slice(0, colon));
      if (slot) {
        const value = line.slice(colon + 1).trim();
        pending = value ? null : slot;
        if (value && put(slot, slot === "referencia" && /^barrio/.test(folded) ? `Barrio ${value}` : value)) labeled += 1;
        continue;
      }
    }

    const inline = INLINE_LABEL_RE.exec(folded);
    if (inline) {
      const slot = slotOf(inline[1]);
      const value = line.slice(line.length - inline[2].length);
      if (slot && put(slot, slot === "referencia" ? line : value)) {
        labeled += 1;
        pending = null;
        continue;
      }
    }

    const label = slotOf(line);
    if (label) {
      pending = label;
      continue;
    }

    if (pending) {
      const slot = pending;
      pending = null;
      if (put(slot, line)) {
        labeled += 1;
        continue;
      }
    }

    const email = EMAIL_RE.exec(line)?.[0];
    if (email) {
      out.email = email.toLowerCase();
      continue;
    }
    if (/^[\d\s.+()-]+$/.test(line)) {
      const raw = onlyDigits(line);
      if (/^(57)?3\d{9}$/.test(raw)) out.phone = cleanPhone(raw);
      else if (cleanDocument(raw)) out.documentNumber = cleanDocument(raw);
      continue;
    }
    if (ADDRESS_RE.test(folded) || /#\s*\d/.test(line)) {
      out.direccion = cleanText(line);
      continue;
    }
    if (REFERENCE_RE.test(folded)) {
      refs.push(cleanText(line));
      continue;
    }
    if (line.length <= 40 && !out.ciudad) {
      const geo = buscarMunicipio(line);
      if (geo) {
        out.departamento = geo.departamento;
        out.ciudad = geo.ciudad;
        continue;
      }
    }
    if (!nameGuess && looksLikeName(line)) nameGuess = line;
  }

  // «Rionegro» existe en dos departamentos: con «Departamento: Antioquia» ya se sabe cuál.
  if (cityRaw && deptRaw && !out.ciudad) {
    const geo = buscarMunicipio(`${cityRaw}, ${deptRaw}`);
    if (geo) {
      out.departamento = geo.departamento;
      out.ciudad = geo.ciudad;
    }
  }
  if (refs.length) out.referencia = refs.join(" · ");
  const found = Object.values(out).filter(Boolean).length;
  // Un nombre suelto solo cuenta si el mensaje trae otros datos: si no, es charla.
  const fullName = name || (found >= 2 ? nameGuess : "");
  if (fullName) {
    const split = splitName(fullName);
    out.firstName = split.firstName;
    if (!out.lastName && split.lastName) out.lastName = split.lastName;
  }
  return { data: out, found: Object.values(out).filter(Boolean).length, labeled };
}

/** Mensajes del cliente que se leen buscando datos; los más nuevos ganan. */
const SCAN_INBOUND = 30;

export function orderDataFromChat(messages: WhatsAppMessage[]): ChatOrderData {
  const inbound = messages.filter((message) => message.direction === "in" && message.text).slice(-SCAN_INBOUND);
  const data: OrderData = {};
  let labeled = false;
  for (const message of inbound) {
    const parsed = parseOrderData(message.text);
    if (parsed.found === 0) continue;
    Object.assign(data, parsed.data);
    if (parsed.labeled >= 2) labeled = true;
  }
  return { data, labeled };
}

export function hasOrderData(data: OrderData) {
  return Object.values(data).some(Boolean);
}

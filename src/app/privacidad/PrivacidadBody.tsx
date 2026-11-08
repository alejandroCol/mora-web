"use client";

import Link from "next/link";
import { BRAND } from "@/brand";
import {
  LegalDocument,
  legalLink,
  type LegalCopy,
  type LegalSection,
} from "@/components/legal/LegalDocument";
import type { LegalLang } from "@/components/legal/lang";

const CONTACT = BRAND.contact.email;

const strong = "font-medium text-ink";

function english(): LegalCopy {
  const sections: LegalSection[] = [
    {
      id: "who",
      kicker: "01",
      title: "Who we are",
      body: (
        <>
          <p>
            <strong className={strong}>{BRAND.name}</strong> (“Mora”, “we”, “us”) operates the{" "}
            <strong className={strong}>Mora Ring</strong> app for iPhone and Android, the{" "}
            <strong className={strong}>Círculo</strong> service at{" "}
            <Link href="/circulo" className={legalLink}>
              moraring.com/circulo
            </Link>
            , and this store and support site at{" "}
            <Link href="/" className={legalLink}>
              moraring.com
            </Link>
            .
          </p>
          <p>
            Mora is a <strong className={strong}>wellness</strong> experience. We are not a medical
            service and our products are not certified clinical devices.
          </p>
        </>
      ),
    },
    {
      id: "data",
      kicker: "02",
      title: "Data we process",
      body: (
        <>
          <p>Depending on how you use Mora, we may process:</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
            <li>
              <strong className={strong}>Account:</strong> email and credentials (Firebase Authentication)
              if you sign in to Círculo or create an account in the app.
            </li>
            <li>
              <strong className={strong}>Ring profile:</strong> sex, age, height, weight, and preferences
              (units, notifications, visual tone). Used for day estimates, not clinical reports.
            </li>
            <li>
              <strong className={strong}>Ring data:</strong> sleep, steps, activity, heart rate, recovery
              (HRV), blood oxygen, stress/tide, skin temperature, and other wellness readings depending on
              model. Synced over Bluetooth and stored <strong className={strong}>on your phone first</strong>.
            </li>
            <li>
              <strong className={strong}>Cycle (optional):</strong> period dates, estimated fertile window,
              and intimacy if you enable it. <strong className={strong}>Stays on the device only</strong>{" "}
              and is not included in summaries you upload to Círculo.
            </li>
            <li>
              <strong className={strong}>Círculo (optional):</strong> if you turn on “Upload daily
              summaries”, we send aggregated summaries (e.g. steps, sleep, tide). We do not upload
              heart-rate series or cycle data.
            </li>
            <li>
              <strong className={strong}>Store:</strong> name, contact, shipping address, and payment data
              processed by payment providers; we do not store full card numbers on our servers.
            </li>
            <li>
              <strong className={strong}>Technical use:</strong> minimal diagnostic logs, app identifiers,
              and aggregated analytics to improve stability (e.g. Firebase), without selling your health
              history.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "where",
      kicker: "03",
      title: "Where your data lives",
      body: (
        <>
          <p>
            The ring talks to the app over <strong className={strong}>Bluetooth</strong>. Most of your
            history stays in local phone storage until you choose to share summaries or use Círculo.
          </p>
          <p>
            Cloud services (account, Círculo, opt-in summaries) use{" "}
            <strong className={strong}>Google Firebase</strong> (Firestore, Cloud Functions,
            Authentication), with traffic encrypted in transit (HTTPS/TLS).
          </p>
          <p>
            <strong className={strong}>Apple Health (iOS, optional):</strong> if you turn on “Save to
            Health” in the app, Mora <strong className={strong}>writes</strong> steps, distance, active
            energy, heart rate, blood oxygen, sleep stages, workouts and mindful minutes measured by your
            ring into the Health app on your iPhone. Mora{" "}
            <strong className={strong}>never reads</strong> data from Health, and nothing from Health is
            sent to our servers or used for advertising. You can switch each data type off in Health ›
            Sharing › Apps › Mora, and delete what was written from Health at any time.
          </p>
          <p>
            <strong className={strong}>Health Connect (Android, optional):</strong> the same applies on
            Android. If you turn on “Save to Health Connect”, Mora{" "}
            <strong className={strong}>writes</strong> steps, distance, active energy, heart rate, blood
            oxygen, sleep sessions, workouts and mindful minutes into Health Connect. Mora asks for
            write‑only permissions and <strong className={strong}>never reads</strong> from Health
            Connect. You can revoke each permission or delete Mora’s data from the Health Connect app.
          </p>
        </>
      ),
    },
    {
      id: "purposes",
      kicker: "04",
      title: "Why we use it",
      body: (
        <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
          <li>Show sleep, movement, tide, and other ring signals in the app.</li>
          <li>Pair your ring, gentle reminders, and settings you choose.</li>
          <li>Run Círculo: invites, shared steps, and summaries you opt into.</li>
          <li>Process orders, shipping, and store support messages.</li>
          <li>Meet legal obligations and protect service security.</li>
        </ul>
      ),
    },
    {
      id: "sharing",
      kicker: "05",
      title: "Who we share with",
      body: (
        <>
          <p>
            <strong className={strong}>We do not sell</strong> your personal data or wellness history.
          </p>
          <p>We share only what is needed with:</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
            <li>
              <strong className={strong}>People in your Círculo</strong>, according to what you choose to
              share.
            </li>
            <li>
              <strong className={strong}>Service providers</strong> that help us operate (hosting,
              transactional email, payments, messaging), under contract and limited access.
            </li>
            <li>
              <strong className={strong}>Authorities</strong>, when required by law.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "permissions",
      kicker: "06",
      title: "Phone permissions",
      body: (
        <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
          <li>
            <strong className={strong}>Bluetooth:</strong> required to find and sync the ring.
          </li>
          <li>
            <strong className={strong}>Notifications:</strong> optional, for gentle alerts and cycle
            reminders if enabled.
          </li>
          <li>
            <strong className={strong}>Location (Android):</strong> on some devices the OS requires it for
            BLE scanning; Mora does not use maps or track where you go.
          </li>
        </ul>
      ),
    },
    {
      id: "control",
      kicker: "07",
      title: "Your choices",
      body: (
        <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
          <li>Turn off “Upload daily summaries” in Profile at any time.</li>
          <li>Unpair the ring or delete app data from your phone settings.</li>
          <li>
            Sign out of Círculo, or request full account deletion at{" "}
            <Link href="/app/eliminar-cuenta" className={legalLink}>
              moraring.com/app/eliminar-cuenta
            </Link>
            .
          </li>
          <li>
            Email{" "}
            <a href={`mailto:${CONTACT}`} className={legalLink}>
              {CONTACT}
            </a>{" "}
            for access, correction, or deletion of data tied to your account.
          </li>
        </ul>
      ),
    },
    {
      id: "children",
      kicker: "08",
      title: "Children",
      body: (
        <p>
          Mora Ring is not directed at children under 13. If you believe we collected a child’s data
          without parental consent, contact us and we will delete it.
        </p>
      ),
    },
    {
      id: "changes",
      kicker: "09",
      title: "Changes",
      body: (
        <p>
          We may update this policy. We will post the revision date on this page. Continued use after a
          change means you have read the current version.
        </p>
      ),
    },
  ];

  return {
    kicker: "Legal · Wellness",
    title: "Privacy Policy",
    lead: "Your ring lives on your phone. Círculo only uploads summaries if you turn it on.",
    updated: "Last updated · October 17, 2026",
    navLabel: "On this page",
    intro: (
      <p>
        This policy describes how we handle personal data when you use{" "}
        <strong className={strong}>Mora Ring</strong>, <strong className={strong}>Círculo</strong>, and{" "}
        <strong className={strong}>moraring.com</strong>. Ring readings are for wellness only; they do not
        replace professional medical advice.
      </p>
    ),
    chips: ["Local first", "Círculo opt-in", "Cycle stays local"],
    sections,
    footer: (
      <>
        <p className="text-[14px] leading-7 text-soft">
          Privacy questions?{" "}
          <a href={`mailto:${CONTACT}`} className="font-medium text-ink underline decoration-bloom underline-offset-2">
            {CONTACT}
          </a>
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-[13px] font-medium text-ink/70">
          <Link href="/terminos?lang=en" className="underline-offset-2 hover:text-ink hover:underline">
            Terms
          </Link>
          <Link href="/" className="underline-offset-2 hover:text-ink hover:underline">
            Back to moraring.com
          </Link>
        </div>
      </>
    ),
  };
}

function spanish(): LegalCopy {
  const sections: LegalSection[] = [
    {
      id: "who",
      kicker: "01",
      title: "Quiénes somos",
      body: (
        <>
          <p>
            <strong className={strong}>{BRAND.name}</strong> (“Mora”, “nosotros”) opera la app{" "}
            <strong className={strong}>Mora Ring</strong> para iPhone y Android, el servicio{" "}
            <strong className={strong}>Círculo</strong> en{" "}
            <Link href="/circulo" className={legalLink}>
              moraring.com/circulo
            </Link>
            , y esta tienda y sitio de soporte en{" "}
            <Link href="/" className={legalLink}>
              moraring.com
            </Link>
            .
          </p>
          <p>
            Mora es una experiencia de <strong className={strong}>bienestar</strong>. No somos un servicio
            médico y nuestros productos no son dispositivos clínicos certificados.
          </p>
        </>
      ),
    },
    {
      id: "data",
      kicker: "02",
      title: "Datos que tratamos",
      body: (
        <>
          <p>Según cómo uses Mora, podemos tratar:</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
            <li>
              <strong className={strong}>Cuenta:</strong> correo y credenciales (Firebase Authentication)
              si entras a Círculo o creas una cuenta en la app.
            </li>
            <li>
              <strong className={strong}>Perfil del anillo:</strong> sexo, edad, estatura, peso y
              preferencias (unidades, notificaciones, tono visual). Sirven para estimaciones del día, no
              para informes clínicos.
            </li>
            <li>
              <strong className={strong}>Datos del anillo:</strong> sueño, pasos, actividad, pulso,
              recuperación (VFC), oxígeno en sangre, estrés/marea, temperatura de la piel y otras lecturas
              de bienestar según el modelo. Se sincronizan por Bluetooth y se guardan{" "}
              <strong className={strong}>primero en tu teléfono</strong>.
            </li>
            <li>
              <strong className={strong}>Ciclo (opcional):</strong> fechas de periodo, ventana fértil
              estimada e intimidad si lo activas.{" "}
              <strong className={strong}>Se queda solo en el dispositivo</strong> y no entra en los
              resúmenes que subes a Círculo.
            </li>
            <li>
              <strong className={strong}>Círculo (opcional):</strong> si activas «Subir resúmenes del
              día», enviamos resúmenes agregados (por ejemplo pasos, sueño, marea). No subimos la serie de
              pulso ni los datos de ciclo.
            </li>
            <li>
              <strong className={strong}>Tienda:</strong> nombre, contacto, dirección de envío y datos de
              pago que procesan los proveedores de pago; no guardamos el número completo de la tarjeta en
              nuestros servidores.
            </li>
            <li>
              <strong className={strong}>Uso técnico:</strong> registros mínimos de diagnóstico,
              identificadores de la app y analítica agregada para mejorar la estabilidad (por ejemplo
              Firebase), sin vender tu historial de salud.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "where",
      kicker: "03",
      title: "Dónde viven tus datos",
      body: (
        <>
          <p>
            El anillo habla con la app por <strong className={strong}>Bluetooth</strong>. Casi todo tu
            historial se queda en el teléfono hasta que decides compartir resúmenes o usar Círculo.
          </p>
          <p>
            Los servicios en la nube (cuenta, Círculo, resúmenes opcionales) usan{" "}
            <strong className={strong}>Google Firebase</strong> (Firestore, Cloud Functions,
            Authentication), con el tráfico cifrado en tránsito (HTTPS/TLS).
          </p>
          <p>
            <strong className={strong}>Salud de Apple (iOS, opcional):</strong> si activas «Guardar en
            Salud» en la app, Mora <strong className={strong}>escribe</strong> en la app Salud de tu
            iPhone los pasos, la distancia, la energía activa, el pulso, el oxígeno, las fases de sueño,
            los entrenos y los minutos de calma que midió tu anillo. Mora{" "}
            <strong className={strong}>nunca lee</strong> datos de Salud, y nada de Salud se envía a
            nuestros servidores ni se usa para publicidad. Puedes apagar cada tipo en Salud › Compartir ›
            Apps › Mora y borrar lo escrito desde Salud cuando quieras.
          </p>
          <p>
            <strong className={strong}>Health Connect (Android, opcional):</strong> en Android pasa lo
            mismo. Si activas «Guardar en Health Connect», Mora{" "}
            <strong className={strong}>escribe</strong> en Health Connect los pasos, la distancia, la
            energía activa, el pulso, el oxígeno, las sesiones de sueño, los entrenos y los minutos de
            calma. Mora pide permisos solo de escritura y <strong className={strong}>nunca lee</strong>{" "}
            de Health Connect. Puedes quitar cada permiso o borrar los datos de Mora desde la app Health
            Connect.
          </p>
        </>
      ),
    },
    {
      id: "purposes",
      kicker: "04",
      title: "Para qué los usamos",
      body: (
        <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
          <li>Mostrar sueño, movimiento, marea y otras señales del anillo en la app.</li>
          <li>Vincular tu anillo, avisos suaves y los ajustes que eliges.</li>
          <li>Operar Círculo: invitaciones, pasos compartidos y los resúmenes que aceptas subir.</li>
          <li>Procesar pedidos, envíos y mensajes de soporte de la tienda.</li>
          <li>Cumplir obligaciones legales y proteger la seguridad del servicio.</li>
        </ul>
      ),
    },
    {
      id: "sharing",
      kicker: "05",
      title: "Con quién compartimos",
      body: (
        <>
          <p>
            <strong className={strong}>No vendemos</strong> tus datos personales ni tu historial de
            bienestar.
          </p>
          <p>Compartimos solo lo necesario con:</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
            <li>
              <strong className={strong}>Las personas de tu Círculo</strong>, según lo que eliges
              compartir.
            </li>
            <li>
              <strong className={strong}>Proveedores</strong> que nos ayudan a operar (alojamiento, correo
              transaccional, pagos, mensajería), bajo contrato y con acceso limitado.
            </li>
            <li>
              <strong className={strong}>Autoridades</strong>, cuando la ley lo exige.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "permissions",
      kicker: "06",
      title: "Permisos del teléfono",
      body: (
        <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
          <li>
            <strong className={strong}>Bluetooth:</strong> necesario para encontrar y sincronizar el
            anillo.
          </li>
          <li>
            <strong className={strong}>Notificaciones:</strong> opcionales, para avisos suaves y
            recordatorios de ciclo si los activas.
          </li>
          <li>
            <strong className={strong}>Ubicación (Android):</strong> en algunos dispositivos el sistema la
            pide para buscar por Bluetooth; Mora no usa mapas ni sigue por dónde vas.
          </li>
        </ul>
      ),
    },
    {
      id: "control",
      kicker: "07",
      title: "Tus decisiones",
      body: (
        <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
          <li>Puedes apagar «Subir resúmenes del día» en Yo cuando quieras.</li>
          <li>Desvincular el anillo o borrar los datos de la app desde los ajustes del teléfono.</li>
          <li>
            Salir de Círculo, o pedir la eliminación completa de la cuenta en{" "}
            <Link href="/app/eliminar-cuenta" className={legalLink}>
              moraring.com/app/eliminar-cuenta
            </Link>
            .
          </li>
          <li>
            Escribe a{" "}
            <a href={`mailto:${CONTACT}`} className={legalLink}>
              {CONTACT}
            </a>{" "}
            para acceder, corregir o eliminar datos ligados a tu cuenta.
          </li>
        </ul>
      ),
    },
    {
      id: "children",
      kicker: "08",
      title: "Niños",
      body: (
        <p>
          Mora Ring no está dirigida a menores de 13 años. Si crees que recogimos datos de un niño sin el
          consentimiento de sus padres, escríbenos y los eliminaremos.
        </p>
      ),
    },
    {
      id: "changes",
      kicker: "09",
      title: "Cambios",
      body: (
        <p>
          Podemos actualizar esta política. Publicaremos la fecha de revisión en esta página. Seguir
          usando el servicio después de un cambio significa que leíste la versión vigente.
        </p>
      ),
    },
  ];

  return {
    kicker: "Legal · Bienestar",
    title: "Política de privacidad",
    lead: "Tu anillo vive en tu teléfono. Círculo solo sube resúmenes si tú lo activas.",
    updated: "Última actualización · 17 de octubre de 2026",
    navLabel: "En esta página",
    intro: (
      <p>
        Esta política describe cómo tratamos los datos personales cuando usas{" "}
        <strong className={strong}>Mora Ring</strong>, <strong className={strong}>Círculo</strong> y{" "}
        <strong className={strong}>moraring.com</strong>. Las lecturas del anillo son de bienestar; no
        sustituyen el consejo de un profesional de la salud.
      </p>
    ),
    chips: ["Primero en el teléfono", "Círculo opcional", "El ciclo se queda"],
    sections,
    footer: (
      <>
        <p className="text-[14px] leading-7 text-soft">
          ¿Dudas de privacidad?{" "}
          <a href={`mailto:${CONTACT}`} className="font-medium text-ink underline decoration-bloom underline-offset-2">
            {CONTACT}
          </a>
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-[13px] font-medium text-ink/70">
          <Link href="/terminos?lang=es" className="underline-offset-2 hover:text-ink hover:underline">
            Condiciones
          </Link>
          <Link href="/" className="underline-offset-2 hover:text-ink hover:underline">
            Volver a moraring.com
          </Link>
        </div>
      </>
    ),
  };
}

export function PrivacidadBody({ initial }: { initial: LegalLang }) {
  return <LegalDocument initial={initial} copy={{ es: spanish(), en: english() }} />;
}

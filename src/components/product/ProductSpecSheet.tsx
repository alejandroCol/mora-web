import Link from "next/link";
import type { ModelId } from "@/lib/catalog";
import { specCompare, specDisclaimer, specSheet } from "@/lib/productSpec";
import { SpecIcon } from "./SpecIcon";

function CompareTable({ current }: { current: ModelId }) {
  const on = "bg-[#f4f3f8] text-[#1d1d1f]";
  return (
    <table className="spec-compare">
      <thead>
        <tr>
          <th scope="col" className="w-[30%]">
            <span className="sr-only">Dato</span>
          </th>
          <th scope="col" className={current === "aero" ? `${on} rounded-t-lg font-semibold` : ""}>
            Pro
          </th>
          <th scope="col" className={current === "titan" ? `${on} rounded-t-lg font-semibold` : ""}>
            Ultra
          </th>
        </tr>
      </thead>
      <tbody>
        {specCompare.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td className={current === "aero" ? on : ""}>{row.aero}</td>
            <td className={current === "titan" ? on : ""}>{row.titan}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * La ficha técnica, siempre abierta: tres cifras, la lista de datos y lo que lee el anillo.
 * La comparación va plegada en un `<details>`, que sigue en el HTML: es texto que Google lee.
 */
export function ProductSpecSheet({ modelId }: { modelId: ModelId }) {
  const sheet = specSheet[modelId];
  const [bond, ...rest] = [...sheet.readings].reverse();
  const tiles = rest.reverse();
  return (
    <section aria-labelledby="spec-title">
      <h2 id="spec-title" className="sheet-title">
        Ficha técnica
      </h2>

      <dl className="spec-stats">
        {sheet.stats.map((stat) => (
          <div key={stat.label} className="spec-stat">
            <dt className="spec-stat-label">{stat.label}</dt>
            <dd>
              <span className="spec-stat-pre">{stat.pre}</span>
              <span className="spec-stat-value">{stat.value}</span>
            </dd>
          </div>
        ))}
      </dl>

      <dl className="spec-list">
        {sheet.specs.map((row) => (
          <div key={row.label} className="spec-li">
            <dt>{row.label}</dt>
            <dd>
              {row.value}
              {row.note ? <span className="spec-li-note">{row.note}</span> : null}
            </dd>
          </div>
        ))}
      </dl>

      <h3 className="sheet-sub">Lo que lee</h3>
      <ul className="read-grid">
        {tiles.map((item, index) => (
          <li
            key={item.label}
            className={`read-tile ${tiles.length % 2 && index === tiles.length - 1 ? "read-tile-span" : ""}`}
          >
            <SpecIcon id={item.icon} />
            <p className="read-name">{item.label}</p>
            <p className="read-desc">{item.value}</p>
          </li>
        ))}
        {bond ? (
          <li className="read-tile read-tile-wide">
            <span className="read-badge">
              <SpecIcon id={bond.icon} />
            </span>
            <span>
              <span className="read-name">{bond.label}</span>
              <span className="read-desc">{bond.value}</span>
            </span>
          </li>
        ) : null}
      </ul>

      <details className="spec-more">
        <summary>
          Comparar Pro y Ultra
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="spec-more-body">
          <p>{sheet.lead}</p>
          <CompareTable current={modelId} />
        </div>
      </details>
    </section>
  );
}

/** Letra pequeña al final de la ficha: qué es y qué no, y a dónde ir por envíos y garantía. */
export function ProductFinePrint() {
  const link =
    "underline decoration-[#d2d2d7] underline-offset-2 transition-colors hover:text-[#1d1d1f]";
  return (
    <div className="text-[11px] leading-4 tracking-[-0.005em] text-[#86868b]">
      <p>{specDisclaimer}</p>
      <p className="mt-2">
        <Link href="/envios-y-garantia" className={link}>
          Envíos, cambios y garantía
        </Link>
        {" · "}
        <Link href="/datos-del-sueno" className={link}>
          Cómo se calcula el sueño
        </Link>
      </p>
    </div>
  );
}

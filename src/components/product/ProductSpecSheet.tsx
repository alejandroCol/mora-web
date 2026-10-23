import type { ModelId } from "@/lib/catalog";
import { specCompare, specDisclaimer, specSheet, type SpecRow } from "@/lib/productSpec";

function SpecTable({ title, rows }: { title: string; rows: SpecRow[] }) {
  return (
    <div className="mt-4">
      <p className="px-3.5 text-[10px] text-soft">{title}</p>
      <table className="mt-1.5 w-full border-collapse text-left text-[12px] leading-4">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line">
              <th
                scope="row"
                className="w-[34%] px-3.5 py-2 align-top font-normal text-soft"
              >
                {row.label}
              </th>
              <td className="px-3.5 py-2 align-top text-[#1d1d1f]">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareTable({ current }: { current: ModelId }) {
  return (
    <div className="mt-4">
      <p className="px-3.5 text-[10px] text-soft">Pro y Ultra</p>
      <table className="mt-1.5 w-full border-collapse text-left text-[11px] leading-4">
        <thead>
          <tr className="border-t border-line">
            <th scope="col" className="w-[28%] px-3.5 py-2 font-normal text-soft">
              <span className="sr-only">Dato</span>
            </th>
            <th
              scope="col"
              className={`px-2 py-2 font-normal ${current === "aero" ? "bg-[#f4f3f8] font-medium text-[#1d1d1f]" : "text-soft"}`}
            >
              Pro{current === "aero" ? " · este" : ""}
            </th>
            <th
              scope="col"
              className={`px-2 py-2 font-normal ${current === "titan" ? "bg-[#f4f3f8] font-medium text-[#1d1d1f]" : "text-soft"}`}
            >
              Ultra{current === "titan" ? " · este" : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {specCompare.map((row) => (
            <tr key={row.label} className="border-t border-line">
              <th scope="row" className="px-3.5 py-2 align-top font-normal text-soft">
                {row.label}
              </th>
              <td
                className={`px-2 py-2 align-top ${current === "aero" ? "bg-[#f4f3f8] text-[#1d1d1f]" : "text-[#1d1d1f]"}`}
              >
                {row.aero}
              </td>
              <td
                className={`px-2 py-2 align-top ${current === "titan" ? "bg-[#f4f3f8] text-[#1d1d1f]" : "text-[#1d1d1f]"}`}
              >
                {row.titan}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProductSpecSheet({ modelId }: { modelId: ModelId }) {
  const sheet = specSheet[modelId];
  return (
    <div className="spec-in mt-4 overflow-hidden rounded-2xl border border-line bg-white/85 pb-5">
      <p className="px-3.5 pt-3.5 text-[12px] leading-4 text-[#1d1d1f]">
        {sheet.lead}
      </p>
      <SpecTable title="Ficha" rows={sheet.specs} />
      <SpecTable title="En la app" rows={sheet.readings} />
      <p className="mt-3 px-3.5 text-[12px] leading-4 text-[#1d1d1f]">{sheet.extra}</p>
      <CompareTable current={modelId} />
      <p className="mt-3 px-3.5 text-[12px] leading-4 text-[#1d1d1f]">{sheet.choose}</p>
      <p className="mt-2 px-3.5 text-[11px] leading-4 text-soft">{specDisclaimer}</p>
    </div>
  );
}

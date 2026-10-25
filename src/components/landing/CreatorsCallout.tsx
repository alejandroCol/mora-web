import Link from "next/link";

export function CreatorsCallout({ className = "" }: { className?: string }) {
  return (
    <div className={`world-creators-copy ${className}`.trim()}>
      <p className="world-creators-kicker">Soy creador UGC</p>
      <h2 id="creators-callout-title" className="world-creators-title">
        Quiero recibir el producto en primicia
      </h2>
      <p className="world-creators-lead">Regístrate y revisamos tus redes contigo.</p>
      <Link href="/creadores" className="world-creators-cta">
        Registrarse
      </Link>
    </div>
  );
}

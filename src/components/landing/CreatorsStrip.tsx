import Link from "next/link";

export function CreatorsStrip() {
  return (
    <section id="creadores-home" className="creators-strip" aria-labelledby="creators-callout-title">
      <div className="creators-strip-art" aria-hidden>
        <span className="creators-arc creators-arc-nw" />
        <span className="creators-arc creators-arc-se" />
      </div>
      <div className="creators-strip-copy">
        <h2 id="creators-callout-title">Soy creador UGC</h2>
        <p className="creators-strip-lead">Quiero recibir el producto en primicia</p>
        <Link href="/creadores" className="creators-strip-cta">
          Registrarse
        </Link>
      </div>
    </section>
  );
}

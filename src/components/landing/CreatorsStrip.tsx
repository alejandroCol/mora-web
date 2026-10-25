import { CreatorsCallout } from "./CreatorsCallout";

export function CreatorsStrip() {
  return (
    <section className="creators-strip" aria-labelledby="creators-callout-title">
      <div className="creators-strip-glow" aria-hidden />
      <CreatorsCallout />
    </section>
  );
}

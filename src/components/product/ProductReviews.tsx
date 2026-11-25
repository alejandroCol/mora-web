import { productReviews } from "@/lib/productReviews";

function Stars({ value }: { value: number }) {
  return (
    <span className="review-stars" role="img" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 12 12" aria-hidden className={n <= value ? "" : "review-star-off"}>
          <path d="M6 .9 7.5 4.2l3.6.4-2.7 2.4.8 3.5L6 8.7l-3.2 1.8.8-3.5L.9 4.6l3.6-.4Z" />
        </svg>
      ))}
    </span>
  );
}

/** Como las reseñas de la App Store: la nota grande y tarjetas que se deslizan de lado. */
export function ProductReviews() {
  if (!productReviews.length) return null;
  const average =
    productReviews.reduce((sum, review) => sum + review.stars, 0) / productReviews.length;
  const score = average.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <section aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="sheet-title">
        Reseñas
      </h2>
      <div className="rev-score">
        <span className="rev-score-num">{score}</span>
        <span className="rev-score-side">
          <Stars value={Math.round(average)} />
          <span>
            de 5 · {productReviews.length} {productReviews.length === 1 ? "reseña" : "reseñas"}
          </span>
        </span>
      </div>
      <ul className="rev-rail hide-scroll">
        {productReviews.map((review) => (
          <li key={review.id} className="rev-card">
            <div className="rev-top">
              <Stars value={review.stars} />
              <span className="rev-name">{review.name}</span>
            </div>
            <p className="rev-title">{review.title}</p>
            <p className="rev-text">{review.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

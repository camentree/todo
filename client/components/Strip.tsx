export function Strip({
  sigils,
  offers,
  onInsert,
}: {
  sigils: string[];
  offers: string[];
  onInsert: (text: string) => void;
}) {
  return (
    <div className="strip">
      {sigils.map((sigil) => (
        <button
          type="button"
          key={sigil}
          className="chip"
          data-plain="true"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onInsert(sigil)}
        >
          {sigil}
        </button>
      ))}

      <span className="strip-divide" />

      {offers.map((offer) => (
        <button
          type="button"
          key={offer}
          className="chip"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onInsert(offer)}
        >
          {offer}
        </button>
      ))}
    </div>
  );
}

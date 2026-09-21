import { useStore } from "../data/store.tsx";

export function ErrorSprite() {
  const store = useStore();
  if (!store.error) return null;
  return (
    <div className="error-report">
      <button className="error-sprite" onClick={store.dismissError}>
        error
      </button>
      <div className="error-detail">{store.error}</div>
    </div>
  );
}

import { useStore } from "../data/store.tsx";

export function ErrorSprite() {
  const store = useStore();
  if (!store.error) return null;
  return (
    <button className="error-sprite" onClick={store.dismissError}>
      {store.error}
    </button>
  );
}

export function trace(
  what: string,
  detail: Record<string, unknown> = {},
): void {
  void fetch("/api/trace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      what: what,
      at: Math.round(performance.now()),
      ...detail,
    }),
  }).catch(() => {});
}

let started = false;

export function markStarted(): void {
  started = true;
}

export function hasStarted(): boolean {
  return started;
}

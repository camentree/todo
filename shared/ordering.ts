export function reassignSlots(positions: number[]): number[] {
  const ascending = [...positions].sort(
    (left, right) => left - right,
  );
  const slots: number[] = [];

  for (const [index, position] of ascending.entries()) {
    const previous = slots[index - 1];
    slots.push(
      previous === undefined
        ? position
        : Math.max(position, previous + 1),
    );
  }

  return slots;
}

let counter = 0;

/** Returns a monotonically increasing line ID, unique across all terminal phases. */
export function nextLineId(): number {
  return ++counter;
}

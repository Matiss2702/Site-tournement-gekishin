/** Grand final uses round 0 in the bracket schema. */
export const GRAND_FINAL_ROUND = 0;

export function sortDraftRounds(a: number, b: number) {
  if (a === GRAND_FINAL_ROUND) return 1;
  if (b === GRAND_FINAL_ROUND) return -1;
  if (a > 0 && b > 0) return a - b;
  if (a > 0) return -1;
  if (b > 0) return 1;
  return b - a;
}

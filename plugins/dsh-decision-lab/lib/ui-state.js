/** Pure UI transition; original tool metadata is never mutated. */
export function changeWeight(weights, id, value) {
  if (!Object.hasOwn(weights, id)) throw new Error('Unknown criterion.');
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('Each weight must be a finite number from 0 to 100.');
  }
  const next = { ...weights, [id]: value };
  if (!Object.values(next).some(weight => weight > 0)) throw new Error('Keep at least one positive weight.');
  return next;
}

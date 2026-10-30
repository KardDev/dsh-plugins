// Deliberately fictional; tests must never be mistaken for market evidence.
export function fixture() {
  const score = (value) => ({ value, low: value - 1, high: value + 1, basis: 'assumption', note: 'Fictional test input; not measured.' });
  return { version: 1, title: 'Choose a launch strategy', question: 'Which approach matches our priorities?',
    criteria: [{ id: 'speed', label: 'Speed', weight: 70 }, { id: 'care', label: 'Confidence', weight: 30 }],
    options: [{ id: 'fast', label: 'Fast launch', scores: { speed: score(9), care: score(3) } },
      { id: 'pilot', label: 'Careful pilot', scores: { speed: score(4), care: score(9) } }],
    assumptions: ['All inputs in this example are fictional.'] };
}

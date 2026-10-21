// Shared by validation and the formula tokenizer; never a property-chain grammar.
export const IDENTIFIER_SOURCE = '[\\p{L}_][\\p{L}\\p{M}\\p{N}_]{0,63}';
const pattern = new RegExp(`^${IDENTIFIER_SOURCE}$`, 'u');
export const validIdentifier = value => typeof value === 'string' && pattern.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);

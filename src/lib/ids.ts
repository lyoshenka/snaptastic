import { customAlphabet } from "nanoid";

// URL-safe alphabet, excludes look-alikes (0/O, 1/l/I).
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ID_LENGTH = 8;

const generate = customAlphabet(ALPHABET, ID_LENGTH);

export function newId(): string {
  return generate();
}

export function newIdPair(): { snapId: string; imageId: string } {
  // Independent entropy: two separate calls — never derive one from the other.
  return { snapId: generate(), imageId: generate() };
}

export const ID_REGEX = new RegExp(`^[${ALPHABET}]{${ID_LENGTH}}$`);

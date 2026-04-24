import { parseSnykCodeOutput } from "./snyk-code.js";

/**
 * A parsed finding from a SAST tool — matches the fields expected by the
 * scorer's FINDINGS_JSON parser. No `id` needed; the scorer generates synthetic IDs.
 */
export interface FindingRecord {
  type: string;
  file: string;
  line?: number;
  severity: string;
  description: string;
}

export type ParserFn = (stdout: string) => FindingRecord[];

const PARSERS: Record<string, ParserFn> = {
  "snyk-code": parseSnykCodeOutput,
};

export function getParser(key: string): ParserFn {
  const parser = PARSERS[key];
  if (!parser) {
    throw new Error(`Unknown parser "${key}". Available: ${Object.keys(PARSERS).join(", ")}`);
  }
  return parser;
}

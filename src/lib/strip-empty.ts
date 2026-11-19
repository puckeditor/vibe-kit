/**
 * Drop empty values from an API input.
 *
 * Puck fields and the AI write `""` for an unset option, so this treats `""`,
 * `null` and `undefined` as left out.
 *
 * @param input The input.
 * @returns A copy without empty values. Anything but an object becomes `{}`.
 */
export const stripEmpty = (input: unknown): Record<string, unknown> => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined,
    ),
  );
};

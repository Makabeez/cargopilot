/**
 * IATA air waybill number check: 3-digit airline prefix + 7-digit serial +
 * 1 check digit, where check digit = serial mod 7.
 */
export function awbCheckDigit(serial7: string): number {
  return Number(serial7) % 7;
}

export function isValidAwb(awb: string): boolean {
  const m = /^(\d{3})-?(\d{7})(\d)$/.exec(awb.trim());
  if (!m) return false;
  return awbCheckDigit(m[2]) === Number(m[3]);
}

export function fixAwb(awb: string): string {
  const m = /^(\d{3})-?(\d{7})\d$/.exec(awb.trim());
  if (!m) throw new Error(`Not an AWB: ${awb}`);
  return `${m[1]}-${m[2]}${awbCheckDigit(m[2])}`;
}

import { adToBs, bsToAd, getDaysInBsMonth, NEPALI_MONTHS_EN, NEPALI_MONTHS_NE } from "./nepali-calendar";

export interface FiscalYearInfo {
  code: string;           // "83/84"
  slug: string;           // "83-84"
  fullCode: string;       // "2083/84"
  label: string;          // "FY 2083/84 (83/84)"
  startBsYear: number;    // 2083
  endBsYear: number;      // 2084
  startDateBs: string;    // "2083-04-01"
  endDateBs: string;      // "2084-03-31"
  startDate: Date;        // AD date for Shrawan 1, 2083
  endDate: Date;          // AD date for Ashadh (end), 2084
  startDateAdFormatted: string; // "17 Jul 2026"
  endDateAdFormatted: string;   // "15 Jul 2027"
  isCurrent: boolean;
}

export interface FiscalMonthInfo {
  fiscalIndex: number;    // 1 to 12 (1 = Shrawan, 12 = Ashadh)
  bsMonth: number;        // 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3
  bsYear: number;
  monthNameEn: string;
  monthNameNe: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Returns the current Nepali Bikram Sambat fiscal year based on a reference date (defaults to now)
 * In Nepal, Fiscal Year starts Shrawan 1 (Month 4) and ends Ashadh (Month 3 of next year).
 */
export function getCurrentNepaliFiscalYear(referenceDate = new Date()): FiscalYearInfo {
  const bs = adToBs(referenceDate);
  // If BS month is 4 (Shrawan) to 12 (Chaitra), current FY started this BS year
  // If BS month is 1 (Baisakh) to 3 (Ashadh), current FY started previous BS year
  const startBsYear = bs.month >= 4 ? bs.year : bs.year - 1;
  return buildFiscalYearFromStart(startBsYear, true);
}

function formatAdDate(d: Date): string {
  try {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Builds a FiscalYearInfo object from starting BS year (e.g. 2083 -> FY 2083/84)
 */
export function buildFiscalYearFromStart(startBsYear: number, isCurrent = false): FiscalYearInfo {
  const endBsYear = startBsYear + 1;
  const startCode = (startBsYear % 100).toString().padStart(2, "0");
  const endCode = (endBsYear % 100).toString().padStart(2, "0");
  const code = `${startCode}/${endCode}`;
  const slug = `${startCode}-${endCode}`;
  const fullCode = `${startBsYear}/${endCode}`;

  const daysInAshadh = getDaysInBsMonth(endBsYear, 3);

  const startDate = bsToAd(startBsYear, 4, 1);
  startDate.setHours(0, 0, 0, 0);

  const endDate = bsToAd(endBsYear, 3, daysInAshadh);
  endDate.setHours(23, 59, 59, 999);

  return {
    code,
    slug,
    fullCode,
    label: `FY ${fullCode} (${code})`,
    startBsYear,
    endBsYear,
    startDateBs: `${startBsYear}-04-01`,
    endDateBs: `${endBsYear}-03-${daysInAshadh.toString().padStart(2, "0")}`,
    startDate,
    endDate,
    startDateAdFormatted: formatAdDate(startDate),
    endDateAdFormatted: formatAdDate(endDate),
    isCurrent,
  };
}

/**
 * List of selectable Nepali Fiscal Years (allows custom start years to be merged)
 */
export function getAvailableFiscalYears(
  referenceDate = new Date(),
  customStartYears: number[] = []
): FiscalYearInfo[] {
  const current = getCurrentNepaliFiscalYear(referenceDate);
  const startYears = new Set<number>();

  // Default range: 3 years ahead and 5 years back
  for (let y = current.startBsYear + 3; y >= current.startBsYear - 5; y--) {
    startYears.add(y);
  }
  for (const cy of customStartYears) {
    if (cy >= 2000 && cy <= 2150) {
      startYears.add(cy);
    }
  }

  const sorted = Array.from(startYears).sort((a, b) => b - a);
  return sorted.map((y) => buildFiscalYearFromStart(y, y === current.startBsYear));
}

/**
 * Parses a fiscal year string like "83/84", "83-84", "2083/84", "2083-84"
 * Returns null if "ALL" or invalid
 */
export function parseFiscalYearCode(input?: string | null): FiscalYearInfo | null {
  if (!input) return null;
  const cleaned = input.trim().toLowerCase();
  if (cleaned === "all" || cleaned === "unfiltered") return null;

  const match = cleaned.match(/(\d{2,4})[-/](\d{2})/);
  if (!match) return null;

  let startYear = parseInt(match[1], 10);
  if (startYear < 100) {
    // 2-digit e.g. "83" -> "2083"
    startYear += 2000;
  }

  const current = getCurrentNepaliFiscalYear();
  return buildFiscalYearFromStart(startYear, startYear === current.startBsYear);
}

/**
 * Resolves the active fiscal year using search param or cookie, falling back to current FY.
 * If explicitly set to "ALL", returns null (all records).
 */
export function resolveActiveFiscalYear(paramValue?: string | null, cookieValue?: string | null): FiscalYearInfo | null {
  const val = paramValue || cookieValue;
  if (!val) {
    return getCurrentNepaliFiscalYear();
  }
  if (val.toLowerCase() === "all") {
    return null;
  }
  const parsed = parseFiscalYearCode(val);
  return parsed || getCurrentNepaliFiscalYear();
}

/**
 * Returns the 12 fiscal months in standard Nepalese order:
 * 1. Shrawan (Month 4)
 * 2. Bhadra (Month 5)
 * 3. Ashwin (Month 6)
 * 4. Kartik (Month 7)
 * 5. Mangsir (Month 8)
 * 6. Poush (Month 9)
 * 7. Magh (Month 10)
 * 8. Falgun (Month 11)
 * 9. Chaitra (Month 12)
 * 10. Baisakh (Month 1, next year)
 * 11. Jestha (Month 2, next year)
 * 12. Ashadh (Month 3, next year)
 */
export function getFiscalMonths(startBsYear: number): FiscalMonthInfo[] {
  const months: FiscalMonthInfo[] = [];

  // Months 4 to 12 in starting BS year
  for (let m = 4; m <= 12; m++) {
    const days = getDaysInBsMonth(startBsYear, m);
    const start = bsToAd(startBsYear, m, 1);
    start.setHours(0, 0, 0, 0);
    const end = bsToAd(startBsYear, m, days);
    end.setHours(23, 59, 59, 999);

    months.push({
      fiscalIndex: m - 3,
      bsMonth: m,
      bsYear: startBsYear,
      monthNameEn: NEPALI_MONTHS_EN[m - 1],
      monthNameNe: NEPALI_MONTHS_NE[m - 1],
      startDate: start,
      endDate: end,
    });
  }

  // Months 1 to 3 in ending BS year
  const endBsYear = startBsYear + 1;
  for (let m = 1; m <= 3; m++) {
    const days = getDaysInBsMonth(endBsYear, m);
    const start = bsToAd(endBsYear, m, 1);
    start.setHours(0, 0, 0, 0);
    const end = bsToAd(endBsYear, m, days);
    end.setHours(23, 59, 59, 999);

    months.push({
      fiscalIndex: m + 9,
      bsMonth: m,
      bsYear: endBsYear,
      monthNameEn: NEPALI_MONTHS_EN[m - 1],
      monthNameNe: NEPALI_MONTHS_NE[m - 1],
      startDate: start,
      endDate: end,
    });
  }

  return months;
}

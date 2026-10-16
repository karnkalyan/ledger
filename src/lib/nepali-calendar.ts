/**
 * Bikram Sambat (BS) <-> Anno Domini (AD) Nepali Calendar Conversion Engine
 * Integrated with battle-tested NepaliFunctions from kashtrix-oss-bss
 */
import { NepaliFunctions } from "./nepaliFunctions";


export const NEPALI_MONTHS_EN = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

export const NEPALI_MONTHS_NE = [
  "बैशाख",
  "जेठ",
  "असार",
  "श्रावण",
  "भाद्र",
  "असोज",
  "कार्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फाल्गुन",
  "चैत",
] as const;

export const NEPALI_DAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const NEPALI_DAYS_NE = [
  "आइतबार",
  "सोमबार",
  "मंगलबार",
  "बुधबार",
  "बिहिबार",
  "शुक्रबार",
  "शनिबार",
] as const;

// Number of days in each month for BS years 1970 to 2100 (12 months per year)
export const BS_CALENDAR_DATA: Record<number, number[]> = {
  1970: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1971: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1972: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  1973: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1974: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1975: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  1976: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1977: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1978: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  1979: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1980: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1981: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  1982: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1983: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1984: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  1985: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1986: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1987: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  1988: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1989: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1990: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  1991: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1992: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1993: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  1994: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1995: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1996: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  1997: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1998: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1999: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2000: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2001: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2002: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2003: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2004: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2005: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2006: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2007: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2008: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2009: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2010: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2011: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2012: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2013: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2014: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2015: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2016: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2017: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2018: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2019: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2020: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2021: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2022: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2023: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2024: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2025: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2026: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2027: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2028: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2029: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2030: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2031: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2032: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2033: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2034: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2035: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2036: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2037: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2038: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2039: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2040: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2041: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2042: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2043: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2044: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2045: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2046: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2047: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2048: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2049: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2050: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2051: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2052: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2053: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2054: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2055: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2056: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2057: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2058: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2059: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2060: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2061: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2062: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2063: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2064: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2065: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2066: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2067: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2068: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2069: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2070: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2071: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2072: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2074: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2085: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2086: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2087: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2088: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2089: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2090: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2091: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2092: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2093: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2094: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2095: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2096: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2097: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2098: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2099: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2100: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
};

// Anchor: 2000-01-01 BS corresponds to 1943-04-13 AD
const REFERENCE_BS_YEAR = 2000;
const REFERENCE_AD_DATE = new Date(Date.UTC(1943, 3, 13)); // 13 April 1943 UTC

export interface NepaliDateObj {
  year: number;
  month: number; // 1 - 12 (1 = Baisakh)
  day: number;   // 1 - 32
  monthName: string;
  monthNameNe: string;
  dayOfWeek: string;
  dayOfWeekNe: string;
  formatted: string; // YYYY-MM-DD
  formattedText: string; // e.g. "7 Ashwin 2081"
}

/**
 * Get total days from Reference BS date (2000-01-01) to the given BS date
 */
function getDaysFromRefBs(bsYear: number, bsMonth: number, bsDay: number): number {
  let totalDays = 0;
  
  if (bsYear >= REFERENCE_BS_YEAR) {
    for (let y = REFERENCE_BS_YEAR; y < bsYear; y++) {
      const yearMonths = BS_CALENDAR_DATA[y] || BS_CALENDAR_DATA[2080];
      for (const mDays of yearMonths) {
        totalDays += mDays;
      }
    }
    const curYearMonths = BS_CALENDAR_DATA[bsYear] || BS_CALENDAR_DATA[2080];
    for (let m = 0; m < bsMonth - 1; m++) {
      totalDays += curYearMonths[m];
    }
    totalDays += (bsDay - 1);
  } else {
    for (let y = bsYear; y < REFERENCE_BS_YEAR; y++) {
      const yearMonths = BS_CALENDAR_DATA[y] || BS_CALENDAR_DATA[2000];
      for (const mDays of yearMonths) {
        totalDays -= mDays;
      }
    }
    const curYearMonths = BS_CALENDAR_DATA[bsYear] || BS_CALENDAR_DATA[2000];
    for (let m = 0; m < bsMonth - 1; m++) {
      totalDays += curYearMonths[m];
    }
    totalDays += (bsDay - 1);
  }
  return totalDays;
}

/**
 * Convert Bikram Sambat (BS) date to Gregorian (AD) Date
 */
/**
 * Convert Bikram Sambat (BS) date to Gregorian (AD) Date
 */
export function bsToAd(bsYear: number, bsMonth: number, bsDay: number): Date {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const bsStr = `${bsYear}-${pad(bsMonth)}-${pad(bsDay)}`;
  try {
    const adRes = NepaliFunctions.BS2AD(bsStr, "YYYY-MM-DD", "YYYY-MM-DD");
    if (typeof adRes === "string") {
      const [y, m, d] = adRes.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    if (adRes && typeof adRes === "object") {
      return new Date(adRes.year, adRes.month - 1, adRes.day);
    }
  } catch {
    // fallback
  }
  const daysOffset = getDaysFromRefBs(bsYear, bsMonth, bsDay);
  return new Date(REFERENCE_AD_DATE.getTime() + daysOffset * 86400000);
}

/**
 * Convert Gregorian (AD) Date to Bikram Sambat (BS) date object
 */
export function adToBs(adDateInput: Date | string | number): NepaliDateObj {
  const adDate = typeof adDateInput === "string" || typeof adDateInput === "number" ? new Date(adDateInput) : adDateInput;
  if (!adDate || isNaN(adDate.getTime())) {
    const today = new Date();
    return adToBs(today);
  }

  const yyyy = adDate.getFullYear();
  const mm = String(adDate.getMonth() + 1).padStart(2, "0");
  const dd = String(adDate.getDate()).padStart(2, "0");
  const adStr = `${yyyy}-${mm}-${dd}`;

  try {
    const bsRes = NepaliFunctions.AD2BS(adStr, "YYYY-MM-DD", "YYYY-MM-DD");
    const [curYear, curMonth, curDay] = typeof bsRes === "string"
      ? bsRes.split("-").map(Number)
      : [bsRes.year, bsRes.month, bsRes.day];

    const monthIdx = Math.max(0, Math.min(11, curMonth - 1));
    const monthName = NEPALI_MONTHS_EN[monthIdx];
    const monthNameNe = NEPALI_MONTHS_NE[monthIdx];
    const dayOfWeekIdx = adDate.getDay();
    const dayOfWeek = NEPALI_DAYS_EN[dayOfWeekIdx];
    const dayOfWeekNe = NEPALI_DAYS_NE[dayOfWeekIdx];

    const pad = (n: number) => n.toString().padStart(2, "0");
    const formatted = `${curYear}-${pad(curMonth)}-${pad(curDay)}`;
    const formattedText = `${curDay} ${monthName}, ${curYear}`;

    return {
      year: curYear,
      month: curMonth,
      day: curDay,
      monthName,
      monthNameNe,
      dayOfWeek,
      dayOfWeekNe,
      formatted,
      formattedText,
    };
  } catch {
    // fallback
  }

  const daysOffset = Math.round((Date.UTC(adDate.getFullYear(), adDate.getMonth(), adDate.getDate()) - REFERENCE_AD_DATE.getTime()) / 86400000);
  let curYear = REFERENCE_BS_YEAR;
  let curMonth = 1;
  let curDay = 1;
  let diffDays = daysOffset;

  if (diffDays >= 0) {
    while (true) {
      const yearMonths = BS_CALENDAR_DATA[curYear] || [31,31,32,31,31,31,30,29,30,29,30,30];
      const yearDays = yearMonths.reduce((a, b) => a + b, 0);
      if (diffDays >= yearDays && curYear < 2100) {
        diffDays -= yearDays;
        curYear++;
      } else {
        break;
      }
    }
    const months = BS_CALENDAR_DATA[curYear] || [31,31,32,31,31,31,30,29,30,29,30,30];
    for (let m = 0; m < 12; m++) {
      if (diffDays >= months[m]) {
        diffDays -= months[m];
        curMonth++;
      } else {
        curDay += diffDays;
        break;
      }
    }
  }

  const monthIdx = Math.max(0, Math.min(11, curMonth - 1));
  const monthName = NEPALI_MONTHS_EN[monthIdx];
  const monthNameNe = NEPALI_MONTHS_NE[monthIdx];
  const dayOfWeekIdx = adDate.getDay();
  const dayOfWeek = NEPALI_DAYS_EN[dayOfWeekIdx];
  const dayOfWeekNe = NEPALI_DAYS_NE[dayOfWeekIdx];

  const pad = (n: number) => n.toString().padStart(2, "0");
  const formatted = `${curYear}-${pad(curMonth)}-${pad(curDay)}`;
  const formattedText = `${curDay} ${monthName}, ${curYear}`;

  return {
    year: curYear,
    month: curMonth,
    day: curDay,
    monthName,
    monthNameNe,
    dayOfWeek,
    dayOfWeekNe,
    formatted,
    formattedText,
  };
}

/**
 * Get the exact start and end Gregorian dates for a given Bikram Sambat (BS) month
 * Very useful for monthly ledger queries and financial reports
 */
export function getBsMonthRange(bsYear: number, bsMonth: number): { startDate: Date; endDate: Date; monthName: string; daysInMonth: number } {
  const months = BS_CALENDAR_DATA[bsYear] || [31,31,32,31,31,31,30,29,30,29,30,30];
  const daysInMonth = months[bsMonth - 1] || 30;

  const startDate = bsToAd(bsYear, bsMonth, 1);
  startDate.setHours(0, 0, 0, 0);

  const endDate = bsToAd(bsYear, bsMonth, daysInMonth);
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate,
    endDate,
    monthName: NEPALI_MONTHS_EN[bsMonth - 1] || "Month",
    daysInMonth,
  };
}

/**
 * Get list of available Bikram Sambat years for dropdowns
 */
export function getNepaliYearList(start = 2070, end = 2095): number[] {
  const years: number[] = [];
  for (let y = start; y <= end; y++) {
    years.push(y);
  }
  return years;
}

/**
 * Get number of days in a given BS Year and Month
 */
export function getDaysInBsMonth(bsYear: number, bsMonth: number): number {
  try {
    return NepaliFunctions.GetDaysInBsMonth(bsYear, bsMonth) || 30;
  } catch {
    const months = BS_CALENDAR_DATA[bsYear] || [31,31,32,31,31,31,30,29,30,29,30,30];
    return months[bsMonth - 1] || 30;
  }
}

/**
 * Formats a date into a clean dual display: "2081-06-07 BS (2024-09-23 AD)"
 */
export function formatDualDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const bs = adToBs(d);
  const adY = d.getFullYear();
  const adM = String(d.getMonth() + 1).padStart(2, "0");
  const adD = String(d.getDate()).padStart(2, "0");
  return `${bs.formatted} BS (${adY}-${adM}-${adD} AD)`;
}

/**
 * Formats a date cleanly in Bikram Sambat format: "7 Ashwin 2081 BS"
 */
export function formatBsDate(date: Date | string | null | undefined, includeDayOfWeek = false): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const bs = adToBs(d);
  if (includeDayOfWeek) {
    return `${bs.dayOfWeek}, ${bs.day} ${bs.monthName} ${bs.year} BS`;
  }
  return `${bs.day} ${bs.monthName} ${bs.year} BS`;
}

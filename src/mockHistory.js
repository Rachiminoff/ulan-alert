// Demo history shown when no real server is configured (VITE_API_URL not set).
// start/end are hours on a 24-hour clock; lead = minutes between alert and rain (null = no alert).
export const HISTORY = {
  today: [],
  yesterday: [
    { start: 2.17, end: 3.0, lead: 28 },
    { start: 13.67, end: 14.5, lead: 24 },
    { start: 17.08, end: 17.33, lead: null },
  ],
};

export function fmt(h) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  const ap = hh >= 12 ? "PM" : "AM";
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${ap}`;
}

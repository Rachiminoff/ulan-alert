// Records interactions for usability exports and the optional live terminal view.
const start = Date.now();
const rows = [];
const listeners = new Set();

export function logEvent(action, detail = "") {
  const row = { t_ms: Date.now() - start, at: new Date().toLocaleTimeString(), action, detail: String(detail) };
  rows.push(row);
  listeners.forEach((listener) => listener(row));
}

export function getRecentEvents(limit = 80) {
  return rows.slice(-limit).reverse();
}

export function subscribeToEvents(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function downloadLog() {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = ["t_ms,action,detail", ...rows.map((r) => [r.t_ms, esc(r.action), esc(r.detail)].join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `ulan_alert_session_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

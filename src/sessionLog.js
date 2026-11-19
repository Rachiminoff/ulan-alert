// Records every interaction so a facilitator can export time-on-task and error data
// for the usability test (tasks T1-T4 and the SUS session).
const start = Date.now();
const rows = [];

export function logEvent(action, detail = "") {
  rows.push({ t_ms: Date.now() - start, action, detail: String(detail) });
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

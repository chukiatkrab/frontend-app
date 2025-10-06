// src/api.js
const API_BASE = "/api/classroom";

function getApiKey() { return process.env.REACT_APP_API_KEY; }
function getToken()  { return localStorage.getItem("token") || ""; }

// ---- helper: ต่อ cache-buster ให้ถูก (ใส่ ? หรือ & อัตโนมัติ) ----
function withBuster(path) {
  return path.includes("?") ? `${path}&_=${Date.now()}` : `${path}?_=${Date.now()}`;
}

async function readError(res) {
  const ct = res.headers.get("content-type") || "";
  try { if (ct.includes("application/json")) return JSON.stringify(await res.json()); return await res.text(); }
  catch { return "(no error body)"; }
}

export async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "x-api-key": getApiKey(),
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...options, headers });

  if (res.status === 401) { localStorage.removeItem("token"); throw new Error("Unauthorized (token อาจหมดอายุ)"); }
  if (!res.ok) { const detail = await readError(res); throw new Error(`HTTP ${res.status} ${detail}`); }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Non-JSON response: ${text.slice(0,200)}...`);
  }
  return await res.json();
}

/* ========== Utils ========== */
export function getStatusIdFromPost(post) {
  return post?.statusId || post?.id || post?._id || post?.status?.id || post?.status?._id || null;
}

function extractList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const candidates = [
    data.data, data.items, data.result, data.rows, data.records, data.list,
    data.class, data.classes, data.members, data.students,
  ].filter(Boolean);
  for (const c of candidates) if (Array.isArray(c)) return c;
  const deep = data?.data;
  if (deep) {
    const inner = [deep.items, deep.result, deep.rows, deep.records, deep.list];
    for (const c of inner) if (Array.isArray(c)) return c;
    if (Array.isArray(deep)) return deep;
  }
  const arrays = [];
  const visit = (obj, d=0) => {
    if (!obj || typeof obj !== "object" || d>2) return;
    for (const [,v] of Object.entries(obj)) {
      if (Array.isArray(v)) arrays.push(v);
      else if (v && typeof v === "object") visit(v, d+1);
    }
  };
  visit(data);
  arrays.sort((a,b)=> b.filter(x=>x&&typeof x==='object').length - a.filter(x=>x&&typeof x==='object').length);
  return arrays[0] || [];
}

/* ========== Profile / Feed / Comment / Like ========== */
export const getProfile = () => apiFetch(withBuster(`/profile`), { method: "GET" });
export const getFeed    = () => apiFetch(withBuster(`/status`),  { method: "GET" });

export const postStatus = (text) =>
  apiFetch(`/status`, { method: "POST", body: JSON.stringify({ text, content: text, message: text, status: text }) });

export const postComment = (statusId, text) =>
  apiFetch(`/comment`, { method: "POST", body: JSON.stringify({ statusId, postId: statusId, text, content: text, message: text }) });

export const likeStatus   = (statusId) => apiFetch(`/like`, { method: "POST", body: JSON.stringify({ statusId }) });
export const unlikeStatus = async (statusId) => {
  try { return await apiFetch(`/unlike`, { method: "POST", body: JSON.stringify({ statusId }) }); }
  catch (e) {
    if (String(e.message).includes("404") || String(e.message).includes("405")) {
      return await apiFetch(`/like`, { method: "POST", body: JSON.stringify({ statusId }) });
    }
    throw e;
  }
};

/* ========== Members ========== */
export async function getAllClasses() {
  const paths = [ `/class`, `/classes`, `/members`, `/students` ];
  for (const p of paths) {
    try {
      const data = await apiFetch(withBuster(p), { method: "GET" });
      const list = extractList(data);
      if (Array.isArray(list) && list.length) return list;
    } catch {}
  }
  // บางระบบใช้ POST
  try {
    const data = await apiFetch(`/class`, { method: "POST", body: JSON.stringify({}) });
    const list = extractList(data);
    if (Array.isArray(list) && list.length) return list;
  } catch {}
  return [];
}

export async function getMembersByYear(year) {
  // ❗ ใช้ withBuster ให้ถูกทั้งกรณีมี ? และไม่มี ?
  const tryPaths = [
    withBuster(`/class/${encodeURIComponent(year)}`),
    withBuster(`/class?year=${encodeURIComponent(year)}`),
    withBuster(`/classes?year=${encodeURIComponent(year)}`),
    withBuster(`/members?year=${encodeURIComponent(year)}`),
    withBuster(`/students?year=${encodeURIComponent(year)}`),
  ];
  for (const p of tryPaths) {
    try {
      const data = await apiFetch(p, { method: "GET" });
      const list = extractList(data);
      if (Array.isArray(list) && list.length) return list;
    } catch {}
  }
  // fallback: ทั้งหมด (ให้ UI กรองเอง)
  return await getAllClasses();
}

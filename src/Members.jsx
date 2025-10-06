// src/Members.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getMembersByYear, getAllClasses } from "./api";

/* ---- แสดงชื่อ/รหัส ---- */
const pickName = (m) =>
  m.name || m.fullname || m.fullName || m.displayName ||
  m.username || m.email || m.profile?.name || m.profile?.fullname || "ไม่ทราบชื่อ";

const pickId = (m) =>
  m.studentId || m.stdId || m.sid || m.id || m._id || m.email || "-";

/* ---- เดาคีย์ปี & อ่านค่า ---- */
function collectYearCandidates(list) {
  const keys = new Set();
  const visit = (obj, prefix = "", depth=0) => {
    if (!obj || typeof obj !== "object" || depth>2) return;
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      const num = typeof v === "string" ? Number(v) : v;
      if (typeof num === "number" && isFinite(num) && num >= 1950 && num <= 2600) {
        keys.add(path);
      } else if (v && typeof v === "object") visit(v, path, depth+1);
    }
  };
  list.slice(0,200).forEach((row)=>visit(row));
  return [...keys].sort();
}
const readByPath = (obj, path) => path.split(".").reduce((acc,k)=>(acc?acc[k]:undefined), obj);

export default function MembersPage() {
  const [year, setYear] = useState(2023);
  const [all, setAll] = useState([]);         // “ทุกคน” จาก API
  const [items, setItems] = useState([]);      // หลังกรอง
  const [yearKey, setYearKey] = useState("");  // คีย์ปีที่ใช้กรอง
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // โหลดข้อมูล: เอา “ทุกคน” มาก่อนให้เห็นแน่ ๆ
  useEffect(() => {
    (async () => {
      setLoading(true); setError("");
      try {
        // 1) ลองยิงตรงตามปีเพื่อโชว์ข้อมูลเร็ว
        const byYear = await getMembersByYear(year);
        const base = Array.isArray(byYear) && byYear.length ? byYear : await getAllClasses();

        setAll(Array.isArray(base) ? base : []);
        // หาคีย์ปี
        const found = collectYearCandidates(Array.isArray(base) ? base : []);
        setCandidates(found);
        const prefer = ["year","entryYear","admitYear","batch","generation","classYear","profile.year","student.year"];
        const auto = prefer.find((k)=>found.includes(k)) || found[0] || "";
        setYearKey((prev)=>prev || auto);
      } catch (e) {
        console.error(e);
        setError(e.message || "โหลดข้อมูลสมาชิกไม่สำเร็จ");
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // กรองตามปี + yearKey (ถ้าไม่เจอ yearKey จะแสดง “ทุกคน”)
  useEffect(() => {
    if (!all.length) { setItems([]); return; }
    if (!yearKey) { setItems(all); return; } // ✅ แสดงทั้งหมดก่อนเพื่อให้เห็นข้อมูลแน่ๆ
    const filtered = all.filter((m)=>{
      const v = readByPath(m, yearKey);
      const num = typeof v === "string" ? Number(v) : v;
      return Number(num) === Number(year);
    });
    setItems(filtered);
  }, [all, year, yearKey]);

  const existingYears = useMemo(() => {
    if (!yearKey) return [];
    const set = new Set(
      all.map((m)=>readByPath(m, yearKey))
         .map((v)=> (typeof v==="string"?Number(v):v))
         .filter((v)=> typeof v==="number" && isFinite(v))
    );
    return [...set].sort((a,b)=>b-a);
  }, [all, yearKey]);

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <h3 className="section-title" style={{ margin:0 }}>สมาชิกชั้นปี</h3>
          <div style={{ flex:1 }} />

          {/* ถ้าหาคีย์ปีได้ แสดงตัวเลือก; ถ้าไม่ได้จะแสดง "(ไม่พบคีย์ปีอัตโนมัติ)" แล้วโชว์ทุกคน */}
          <select className="select" value={yearKey} onChange={(e)=>setYearKey(e.target.value)} style={{ minWidth:220 }}>
            {!candidates.length && <option value="">(ไม่พบคีย์ปีอัตโนมัติ)</option>}
            {candidates.map((k)=> <option key={k} value={k}>ปีจาก: {k}</option>)}
          </select>

          <select className="select" value={year} onChange={(e)=>setYear(Number(e.target.value))} style={{ width:140 }}>
            {(existingYears.length?existingYears:[2025,2024,2023,2022,2021]).map((y)=>(
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <div className="badge">ทั้งหมด: {items.length} คน</div>
        </div>
      </div>

      {loading && <p>กำลังโหลด…</p>}
      {error && <pre className="alert alert-danger" style={{ whiteSpace:"pre-wrap" }}>{error}</pre>}

      {!loading && !error && items.length===0 && (
        <div className="card">ไม่มีข้อมูลสมาชิกสำหรับปี {year} (ลองเลือก “ปีจาก: …” ให้ตรงคีย์ปี หรือปล่อยว่างเพื่อแสดงทั้งหมด)</div>
      )}

      <div className="grid grid-2 grid-3">
        {items.map((m,i)=>(
          <div key={m.id || m._id || m.studentId || m.email || i} className="card">
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div className="brand-badge" style={{ width:34, height:34, borderRadius:12 }}>👤</div>
              <div>
                <div style={{ fontWeight:700 }}>{pickName(m)}</div>
                <div className="badge">{pickId(m)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

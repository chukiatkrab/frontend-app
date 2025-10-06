import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "/api/classroom"; // ใช้คู่กับ setupProxy.js

export default function Login({ setToken }) {
  const nav = useNavigate();
  const [email, setEmail] = useState(() => localStorage.getItem("remember_username") || "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => !!localStorage.getItem("remember_username"));
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { document.body.style.margin = 0; return () => (document.body.style.margin = ""); }, []);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !password) return setError("กรุณากรอกอีเมลและรหัสผ่าน");
    if (!process.env.REACT_APP_API_KEY) return setError("ไม่พบค่า REACT_APP_API_KEY ใน .env (อย่าลืม restart)");

    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/signin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": process.env.REACT_APP_API_KEY, // สำคัญ!
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const detail = ct.includes("application/json") ? JSON.stringify(await res.json()) : await res.text();
        throw new Error(`เข้าสู่ระบบไม่สำเร็จ (HTTP ${res.status}) ${detail || ""}`);
      }

      const data = await res.json();
      const token = data?.token || data?.access_token || data?.data?.token || "";
      if (!token) throw new Error("ไม่พบ token ในผลลัพธ์จากเซิร์ฟเวอร์");

      if (remember) localStorage.setItem("remember_username", email.trim());
      else localStorage.removeItem("remember_username");

      localStorage.setItem("token", token);
      setToken?.(token);
      nav("/feed", { replace: true });
    } catch (err) {
      setError(err.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-wrap">
        <div className="auth-left">
          <h1 className="auth-title">เข้าระบบได้อย่างมั่นใจ</h1>
          <p>UI เฉียบ สะอาดตา พร้อมเชื่อมต่อ API จริงด้วย Bearer Token และ x-api-key</p>
          <ul className="auth-bullets">
            <li>🎯 รองรับทุกขนาดหน้าจอ</li>
            <li>🔐 ส่งคีย์ปลอดภัยผ่าน .env</li>
            <li>⚡ ประสบการณ์ผู้ใช้ลื่นไหล</li>
          </ul>
        </div>

        <div className="card" style={{ width: "min(94vw, 420px)", marginInline: "auto" }}>
          <h2 className="section-title">Sign in</h2>

          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="field">
              <label className="label">อีเมล</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                placeholder="your.name@kkumail.com"
                autoComplete="username"
                disabled={busy}
              />
            </div>

            <div className="field">
              <label className="label">รหัสผ่าน</label>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  style={{ paddingRight: 44 }}
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={()=>setShowPwd(v=>!v)}
                  className="btn-ghost"
                  style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", padding:"6px 8px", borderRadius:10 }}
                >
                  {showPwd ? "Hide" : "Show"}
                </button>
              </div>
              <p className="help">กด Show เพื่อดูรหัสผ่านชั่วคราว</p>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 12 }}>
              <label style={{ cursor:"pointer" }}>
                <input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} disabled={busy} /> Remember me
              </label>
              <a className="navlink" href="#" onClick={(e)=>e.preventDefault()}>Forgot Password?</a>
            </div>

            <button className="btn" disabled={busy || !email.trim() || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <p style={{ marginTop: 12, color:"var(--muted)", textAlign:"center" }}>
              Don’t have an account? <a className="navlink" href="#" onClick={(e)=>e.preventDefault()}>Sign up</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

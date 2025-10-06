// src/App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import Login from "./Login.jsx";
import FeedPage from "./Feed.jsx";
import MembersPage from "./Members.jsx";
import { getProfile } from "./api";
import "./App.css";

const getToken = () => localStorage.getItem("token") || "";
const setTokenLS = (t) => localStorage.setItem("token", t);
const clearTokenLS = () => localStorage.removeItem("token");

function ProtectedRoute({ children }) {
  const t = getToken();
  if (!t) return <Navigate to="/login" replace />;
  return children;
}

function Shell({ onLogout, me, children }) {
  return (
    <div>
      <header className="navbar">
        <div className="container navbar-inner">
          <div className="brand">
            <span className="brand-badge">K</span>
            <span>KKU Classroom</span>
          </div>
          <div className="spacer" />
          <Link to="/feed" className="navlink">ฟีด</Link>
          <Link to="/members" className="navlink">สมาชิก</Link>

          {me?.name || me?.fullname || me?.email ? (
            <span className="navlink" style={{ opacity:.9 }}>
              👤 {me.name || me.fullname || me.email}
            </span>
          ) : null}

          <button className="btn" onClick={onLogout}>ออกจากระบบ</button>
        </div>
      </header>
      <main className="container" style={{ paddingTop: 16 }}>{children}</main>
      <div className="footer">© {new Date().getFullYear()} KKU Classroom</div>
    </div>
  );
}

function AppInner() {
  const [token, setToken] = useState(getToken());
  const [me, setMe] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    if (token) setTokenLS(token);
  }, [token]);

  // โหลดโปรไฟล์เมื่อมี token
  useEffect(() => {
    (async () => {
      if (!getToken()) { setMe(null); return; }
      try {
        const data = await getProfile();
        setMe(data?.data || data); // บาง API ใส่ไว้ใต้ data
      } catch (e) {
        console.warn("โหลดโปรไฟล์ไม่สำเร็จ:", e);
        setMe(null);
      }
    })();
  }, [token]);

  const handleSetToken = (t) => {
    setToken(t);
    setTokenLS(t);
    nav("/feed", { replace: true });
  };

  const handleLogout = () => {
    clearTokenLS();
    setToken("");
    setMe(null);
    nav("/login", { replace: true });
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to={token ? "/feed" : "/login"} replace />} />
      <Route path="/login" element={<Login setToken={handleSetToken} />} />
      <Route
        path="/feed"
        element={
          <ProtectedRoute>
            <Shell onLogout={handleLogout} me={me}>
              <FeedPage me={me} />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/members"
        element={
          <ProtectedRoute>
            <Shell onLogout={handleLogout} me={me}>
              <MembersPage />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App(){
  return (
    <BrowserRouter>
      <AppInner/>
    </BrowserRouter>
  );
}

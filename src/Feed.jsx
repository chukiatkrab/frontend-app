// src/Feed.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  getFeed,
  postStatus,
  postComment,
  likeStatus,
  unlikeStatus,
  getStatusIdFromPost,
} from "./api";

/* ---------- helpers: comments multi-key ---------- */
const COMMENT_KEYS = ["comments", "comment", "commentList", "replies", "replyList"];
function readComments(post) {
  for (const k of COMMENT_KEYS) {
    const v = post?.[k];
    if (Array.isArray(v)) return { list: v, key: k };
  }
  return { list: [], key: "comments" };
}
function writeComments(post, newList, keyHint) {
  const key = COMMENT_KEYS.includes(keyHint)
    ? keyHint
    : COMMENT_KEYS.find((k) => Array.isArray(post?.[k])) || "comments";
  return { ...post, [key]: newList };
}

/* ---------- helpers: author name ---------- */
function deepFindName(obj, visited = new WeakSet(), path = []) {
  if (!obj || typeof obj !== "object" || visited.has(obj)) return null;
  visited.add(obj);
  const prefer = [
    "name", "fullName", "fullname", "displayName",
    "authorName", "ownerName", "username", "nickName", "email", "mail",
  ];
  for (const k of prefer) {
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase() === k.toLowerCase()) {
        const v = obj[key];
        if (typeof v === "string" && v.trim()) return { value: v, path: [...path, key] };
      }
    }
  }
  const pat = /(name|full|display|author|owner|user|email|creator)/i;
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string" && pat.test(key) && val.trim())
      return { value: val, path: [...path, key] };
  }
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === "object") {
      const found = deepFindName(val, visited, [...path, key]);
      if (found) return found;
    }
  }
  return null;
}
function resolveAuthor(post, me) {
  const direct =
    post.author?.name ||
    post.owner?.name ||
    post.user?.name ||
    post.createdBy?.name ||
    post.authorName ||
    post.ownerName ||
    post.username ||
    post.displayName ||
    post.email;
  if (direct) return direct;
  const meId = me?.id || me?._id || me?.userId;
  const postOwnerId =
    post.userId ||
    post.ownerId ||
    post.authorId ||
    post.createdById ||
    post.user?.id ||
    post.owner?.id ||
    post.author?.id;
  if (me && meId && postOwnerId && String(meId) === String(postOwnerId)) {
    return me.name || me.fullname || me.displayName || me.email || "ฉัน";
  }
  const found = deepFindName(post);
  return found?.value || "ไม่ทราบชื่อ";
}

/* ---------- localStorage persistence (Like) ---------- */
const LS_LIKED = "liked_status_ids";
const LS_LIKE_OVERRIDES = "like_count_overrides";

function loadLikedSet() {
  try {
    const raw = localStorage.getItem(LS_LIKED);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(arr);
  } catch { return new Set(); }
}
function saveLikedSet(set) {
  localStorage.setItem(LS_LIKED, JSON.stringify([...set]));
}
function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem(LS_LIKE_OVERRIDES)) || {};
  } catch { return {}; }
}
function saveOverrides(map) {
  localStorage.setItem(LS_LIKE_OVERRIDES, JSON.stringify(map));
}

/** ใช้ตอนโหลดฟีด: เอา local like มาทับสถานะ + ตัวเลขขั้นต่ำ */
function applyLocalLikes(list) {
  const liked = loadLikedSet();
  const overrides = loadOverrides();
  return list.map((p) => {
    const id = getStatusIdFromPost(p);
    if (!id) return p;
    let out = { ...p };
    if (liked.has(String(id))) out._liked = true;
    const baseCount = out._likeCount ?? (out.likes?.length ?? out.likes ?? 0);
    const minCount = overrides[String(id)];
    if (typeof minCount === "number" && minCount > baseCount) {
      out._likeCount = minCount;
    }
    return out;
  });
}

/* ---------- Components ---------- */
function CommentBox({ onSubmit, busy }) {
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const ok = await onSubmit(text.trim());
    if (ok) { setText(""); inputRef.current?.focus(); }
  };
  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <input ref={inputRef} className="input" style={{ flex: 1 }}
             value={text} onChange={(e)=>setText(e.target.value)}
             placeholder="แสดงความคิดเห็น…" disabled={busy}/>
      <button className="btn-ghost" disabled={busy}>ส่ง</button>
    </form>
  );
}

function PostCard({ post, me, onOptimistic, onSync }) {
  const author = resolveAuthor(post, me);
  const statusId = getStatusIdFromPost(post);
  const { list: comments } = readComments(post);
  const [showComments, setShowComments] = useState(false);

  const likeCount = post._likeCount ?? (post.likes?.length ?? post.likes ?? 0);
  const liked = !!(post._liked ?? post.liked);

  const setLocalLike = (nextLiked) => {
    onOptimistic(statusId, (p) => {
      const base = p._likeCount ?? (p.likes?.length ?? p.likes ?? 0);
      let next = { ...p, _liked: nextLiked };
      if (nextLiked && !p._liked) next._likeCount = base + 1;
      if (!nextLiked && p._liked) next._likeCount = Math.max(0, base - 1);
      return next;
    });
  };

  const onToggleLike = async () => {
    if (!statusId) return alert("ไม่พบ statusId ของโพสต์นี้");
    const idStr = String(statusId);
    const likedSet = loadLikedSet();
    const overrides = loadOverrides();
    const next = !liked;

    // optimistic + persist
    setLocalLike(next);
    if (next) {
      likedSet.add(idStr);
      // บันทึก "ตัวเลขขั้นต่ำ" เพื่อกันเด้งลงหลัง sync
      const currentShown = likeCount + (liked ? 0 : 1);
      overrides[idStr] = Math.max(overrides[idStr] || 0, currentShown);
    } else {
      likedSet.delete(idStr);
      delete overrides[idStr];
    }
    saveLikedSet(likedSet);
    saveOverrides(overrides);

    try {
      if (next) await likeStatus(statusId);
      else await unlikeStatus(statusId);
    } catch (e) {
      // rollback local persist
      setLocalLike(!next);
      if (!next) { likedSet.add(idStr); overrides[idStr] = likeCount; }
      else { likedSet.delete(idStr); delete overrides[idStr]; }
      saveLikedSet(likedSet); saveOverrides(overrides);
      console.error("Toggle like error:", e);
      alert(e.message || "ดำเนินการไม่สำเร็จ");
    } finally {
      onSync(); // sync ของจริง แล้วค่อยทับด้วย local ใน loadFeed อีกชั้น
    }
  };

  const onComment = async (text) => {
    if (!statusId) { alert("ไม่พบ statusId ของโพสต์นี้"); return false; }
    setShowComments(true);
    onOptimistic(statusId, (p) => {
      const { list, key } = readComments(p);
      const temp = { id: `tmp-${Date.now()}`, text, author: { name: me?.name || me?.email || "ฉัน" }, _temp: true };
      return writeComments(p, [...list, temp], key);
    });
    try { await postComment(statusId, text); onSync(); return true; }
    catch (e) { onSync(); console.error("Comment error:", e); alert(e.message || "คอมเมนต์ไม่สำเร็จ"); return false; }
  };

  return (
    <div className="card">
      <div className="post-head">
        <div className="brand-badge" style={{ width: 34, height: 34, borderRadius: 12 }}>★</div>
        <div>
          <div className="post-author">{author}</div>
          <div className="post-meta">โพสต์ล่าสุด</div>
        </div>
      </div>

      <div className="post-body">{post.text || post.content || post.message || post.status}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
        <button
          className="like-btn"
          onClick={onToggleLike}
          aria-pressed={liked}
          title={liked ? "ยกเลิกถูกใจ" : "ถูกใจ"}
          style={{
            "--like-bg": liked
              ? "linear-gradient(90deg,#22c55e,#16a34a)"
              : "linear-gradient(90deg,#334155,#1f2937)",
            "--like-shadow": liked ? "0 0 0 6px rgba(34,197,94,.15)" : "0 0 0 0 rgba(0,0,0,0)",
            transform: liked ? "scale(1.02)" : "scale(1)",
          }}
        >
          <span className="like-icon" aria-hidden="true">👍</span>
          <span>{liked ? "Liked" : "Like"}</span>
        </button>

        <div className="badge">👍 {likeCount}</div>

        <div style={{ flex: 1 }} />

        <button
          className="btn-ghost"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          aria-controls={`comments-${statusId || ""}`}
        >
          {showComments ? "ซ่อนคอมเมนต์" : "แสดงคอมเมนต์"} ({comments.length})
        </button>
      </div>

      {showComments && (
        <div id={`comments-${statusId || ""}`} style={{ marginTop: 8 }}>
          {comments.map((c, i) => (
            <div key={c.id || i} style={{ borderTop: "1px solid var(--line)", padding: "8px 0", fontSize: 14 }}>
              <strong>{c.author?.name || c.user?.name || c.username || deepFindName(c)?.value || "anon"}:</strong>{" "}
              {c.text || c.content || c.message}
            </div>
          ))}
          <CommentBox onSubmit={onComment} />
        </div>
      )}
    </div>
  );
}

/* ---------- Feed page ---------- */
export default function FeedPage({ me }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");

  const computeList = (data) => (Array.isArray(data) ? data : data?.data || []);

  const loadFeed = async () => {
    setBusy(true); setError("");
    try {
      const data = await getFeed();
      const list = computeList(data);
      // ⬅️ ทับด้วยสถานะ Like จาก localStorage
      setItems(applyLocalLikes(list));
    } catch (e) {
      console.error("Load feed error:", e);
      setError(e.message || "โหลดฟีดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const optimisticUpdate = (statusId, updater) => {
    setItems((prev) => prev.map((p) => (getStatusIdFromPost(p) === statusId ? updater(p) : p)));
  };

  const syncNow = async () => {
    await new Promise((r) => setTimeout(r, 150));
    await loadFeed();
  };

  useEffect(() => { loadFeed(); }, []);

  const onPost = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await postStatus(text.trim()); setText(""); await syncNow(); }
    catch (e) { console.error("Post status error:", e); alert(e.message || "โพสต์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="card">
        <h3 className="section-title">โพสต์สถานะ</h3>
        <form onSubmit={onPost}>
          <textarea className="textarea" rows={3} placeholder="สถานะของคุณ…"
                    value={text} onChange={(e)=>setText(e.target.value)} disabled={busy}/>
          <div style={{ textAlign: "right", marginTop: 8 }}>
            <button className="btn" disabled={busy}>โพสต์</button>
          </div>
        </form>
      </div>

      {error && <p className="alert alert-danger">{error}</p>}
      {busy && !items.length && <p>กำลังโหลด…</p>}

      <div className="grid">
        {items.map((p, i) => (
          <PostCard key={p.id || p._id || i} post={p} me={me}
            onOptimistic={optimisticUpdate} onSync={syncNow}/>
        ))}
      </div>
    </>
  );
}

/* ==== inject CSS for like button effect ==== */
(function injectLikeCss() {
  if (document.getElementById("__like_css")) return;
  const css = `
  .like-btn {
    display:inline-flex; align-items:center; gap:8px;
    padding:8px 14px; border:none; border-radius:12px;
    background: var(--like-bg, linear-gradient(90deg,#334155,#1f2937));
    color:#fff; font-weight:700; cursor:pointer;
    box-shadow: var(--like-shadow, 0 0 0 0 rgba(0,0,0,0));
    transition: transform .08s ease, box-shadow .25s ease;
    outline: none;
  }
  .like-btn:hover { transform: scale(1.03); }
  .like-btn:active { transform: scale(0.98); }
  .like-icon { filter: drop-shadow(0 2px 6px rgba(2,132,199,.2)); }
  `;
  const style = document.createElement("style");
  style.id = "__like_css";
  style.textContent = css;
  document.head.appendChild(style);
})();

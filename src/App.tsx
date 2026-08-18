import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
  type Auth,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';

// ── Types ─────────────────────────────────────────────────────────────────────
export type Genre =
  | 'Romantasy'
  | 'Fantasy'
  | 'Romance'
  | 'Mystery/Thriller'
  | 'Horror'
  | 'Contemporary'
  | 'Classics'
  | 'Non-Fiction';

export type BookStatus = 'shelf' | 'tbr' | 'reading' | 'wishlist';

export interface Book {
  id: number;
  title: string;
  author: string;
  category: string;
  genre: Genre;
  subgenre: string;
  series: string | null;
  sn: number | null;
  read: boolean;
  status: BookStatus;
  readAt: number | null;
  readYear: number | null;
  rating: number | null;
  note: string;
  rereads: number[];
  tropes?: string[];
}

export interface Goals {
  yearly: number;
  monthly: number;
  readProgress: number | null;
  monthProgress: number | null;
}

// ── Safe Firebase Singletons ──────────────────────────────────────────────────
let auth: Auth | null = null;
let db: Firestore | null = null;
let provider: GoogleAuthProvider | null = null;

try {
  const firebaseConfig = {
    apiKey: 'AIzaSyD2p_VgfHQhGja_Xb-XrSwLUxqUdrpipzA',
    authDomain: 'personal-library-99222.firebaseapp.com',
    projectId: 'personal-library-99222',
    storageBucket: 'personal-library-99222.firebasestorage.app',
    messagingSenderId: '188028941942',
    appId: '1:188028941942:web:8e9aee68e9a22091935157',
  };
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
} catch (e) {
  console.warn('Firebase initialization skipped/failed in this environment:', e);
}

const saveToFirestore = async (uid: string, books: Book[], goals: Goals) => {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), { books, goals });
    const publicBooks = books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      genre: b.genre,
      subgenre: b.subgenre,
      series: b.series,
      sn: b.sn,
      read: b.read,
      readYear: b.readYear,
      status: b.status,
      rating: b.rating ?? null,
      note: b.note ?? '',
    }));
    await setDoc(doc(db, 'public', uid), { books: publicBooks, updatedAt: Date.now() });
  } catch (err) {
    console.error('Firestore save failed:', err);
  }
};

// ── Configuration & Maps ─────────────────────────────────────────────────────
const GENRE_CFG: Record<string, { accent: string; dim: string }> = {
  Romantasy: { accent: '#4ade80', dim: '#14532d' },
  Fantasy: { accent: '#a78bfa', dim: '#2d1b69' },
  Romance: { accent: '#fb7185', dim: '#6b1a2e' },
  'Mystery/Thriller': { accent: '#fbbf24', dim: '#6b4a04' },
  Horror: { accent: '#f87171', dim: '#5b1a1a' },
  Contemporary: { accent: '#f97316', dim: '#431407' },
  Classics: { accent: '#e5c97a', dim: '#5a4000' },
  'Non-Fiction': { accent: '#60a5fa', dim: '#1e3a5f' },
};

const SUBGENRES: Record<string, string[]> = {
  Romantasy: ['Romantasy', 'Mythology Romance', 'Paranormal Romance', 'Historical Fantasy', 'Dark Romantasy'],
  Fantasy: ['Dark Fantasy', 'Urban Fantasy', 'YA Fantasy', 'High Fantasy', 'Historical Fantasy', 'Mythology Romance'],
  Romance: ['Contemporary Romance', 'Dark Romance', 'Sports Romance', 'Holiday Romance', 'New Adult Romance', 'College Romance'],
  'Mystery/Thriller': ['Cozy Mystery', 'YA Mystery', 'Historical Mystery', 'Thriller', 'Dark Thriller', 'Conspiracy Thriller'],
  Horror: ['Gothic Horror', 'Dark Fiction', 'Horror Comedy'],
  Contemporary: ['Contemporary Fiction', 'Literary Fiction', 'Cozy Fiction', 'New Adult', 'Chick Lit'],
  Classics: ['Gothic Classic', 'Russian Lit', 'French Lit', 'British Lit', 'American Lit', 'Fairy Tales', 'German Lit'],
  'Non-Fiction': ['Memoir', 'Self-Help', 'Philosophy', 'Language Learning'],
};

const STORAGE_KEY = 'myshelf-v7';
const GOALS_KEY = 'myshelf-goals-v1';

const TAB_CFG: Record<string, { label: string; color: string }> = {
  home: { label: '✦ Home', color: '#c084fc' },
  shelf: { label: '📚 Shelf', color: '#a78bfa' },
  tbr: { label: '🔖 TBR', color: '#fb923c' },
  reading: { label: '📖 Reading', color: '#34d399' },
  wishlist: { label: '✨ Wishlist', color: '#f472b6' },
};

const STATUS_COLORS: Record<string, string> = {
  shelf: '#a78bfa',
  tbr: '#fb923c',
  reading: '#34d399',
  wishlist: '#f472b6',
};

const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth();

// ── Data Helpers ────────────────────────────────────────────────────────────
const generateUid = () => Math.floor(Date.now() + Math.random() * 1000);

export const baseBook = (extra: Partial<Book>): Book => ({
  id: generateUid(),
  title: '',
  author: '',
  category: 'Fiction',
  genre: 'Fantasy',
  subgenre: '',
  series: null,
  sn: null,
  read: false,
  status: 'shelf',
  readAt: null,
  readYear: null,
  rating: null,
  note: '',
  rereads: [],
  ...extra,
});

const base = baseBook;

const migrateBooks = (books: any[]): Book[] =>
  books.map((b) => ({
    ...b,
    status: b.status || 'shelf',
    readAt: b.readAt || null,
    readYear: b.readYear || null,
    rating: b.rating ?? null,
    note: b.note ?? '',
    rereads: b.rereads ?? [],
  }));

const fa = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Fantasy', subgenre: sg, series: sr, sn });
const rt = (id: number, t: string, a: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Romantasy', subgenre: 'Romantasy', series: sr, sn });
const cl = (id: number, t: string, a: string, sg: string) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Classics', subgenre: sg, series: null, sn: null });
const m = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Mystery/Thriller', subgenre: sg, series: sr, sn });
const co = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Contemporary', subgenre: sg, series: sr, sn });
const nf = (id: number, t: string, a: string, sg: string) => base({ id, title: t, author: a, category: 'Non-Fiction', genre: 'Non-Fiction', subgenre: sg, series: null, sn: null });

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

const exportCSV = (books: Book[]) => {
  const headers = ['Title', 'Author', 'Genre', 'Subgenre', 'Series', '#', 'Status', 'Read', 'Year Read', 'Rating', 'Note'];
  const rows = books.map((b) =>
    [b.title, b.author, b.genre, b.subgenre || '', b.series || '', b.sn != null ? b.sn : '', b.status, b.read ? 'Yes' : 'No', b.readYear || '', b.rating || '', (b.note || '').replace(/"/g, "'")]
      .map((v) => `"${v}"`)
      .join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'myshelf.csv';
  a.click();
  URL.revokeObjectURL(url);
};

// ── Seed Library ────────────────────────────────────────────────────────────
const SEED: Book[] = [
  fa(1, 'The Awakening', 'C.Peckham & S.Valenti', 'Paranormal Romance', 'Zodiac Academy', 1),
  fa(12, 'Caraval', 'Stephanie Garber', 'YA Fantasy', 'Caraval', 1),
  rt(36, 'Fourth Wing', 'Rebecca Yarros', 'The Empyrean', 1),
  cl(205, 'Dracula', 'Bram Stoker', 'Gothic Classic'),
  m(711, 'The Housemaid', 'Freida McFadden', 'Thriller', 'The Housemaid', 1),
  co(112, 'Legends & Lattes', 'Travis Baldree', 'Cozy Fiction', null, null),
  nf(716, 'Meditations', 'Marcus Aurelius', 'Philosophy'),
];

const ALL_BOOKS: Book[] = SEED;

// ── UI Components ─────────────────────────────────────────────────────────────
function StarRating({ rating, onChange, size = 'sm' }: { rating: number | null; onChange?: (r: number) => void; size?: 'sm' | 'md' }) {
  const [hover, setHover] = useState(0);
  const sz = size === 'md' ? '1.1rem' : '0.75rem';
  return (
    <div style={{ display: 'flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => onChange?.(s === rating ? 0 : s)}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          style={{
            fontSize: sz,
            cursor: onChange ? 'pointer' : 'default',
            color: s <= (hover || rating || 0) ? '#fbbf24' : 'rgba(255,255,255,0.15)',
            lineHeight: 1,
            transition: 'color 0.1s',
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function Pill({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        whiteSpace: 'nowrap',
        fontSize: '0.7rem',
        padding: '0.3rem 0.75rem',
        borderRadius: '9999px',
        border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
        background: active ? color + '25' : 'transparent',
        color: active ? color : 'rgba(255,255,255,0.35)',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function GoalRing({ count, goal, label, emoji, gradStart, gradEnd, gradId }: { count: number; goal: number; label: string; emoji: string; gradStart: string; gradEnd: string; gradId: string }) {
  const pct = goal ? Math.min(100, Math.round((count / goal) * 100)) : 0;
  const R = 46;
  const circ = 2 * Math.PI * R;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ position: 'relative', width: '110px', height: '110px' }}>
        <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle
            cx="55"
            cy="55"
            r={R}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circ}`}
            strokeDashoffset={`${circ * (1 - pct / 100)}`}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradStart} />
              <stop offset="100%" stopColor={gradEnd} />
            </linearGradient>
          </defs>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.3rem', lineHeight: 1 }}>{count}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem' }}>of {goal || '?'}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: gradStart, fontSize: '0.75rem', fontWeight: 600 }}>
          {emoji} {label}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem' }}>{pct}% complete</div>
      </div>
    </div>
  );
}

function PaceGauge({ read, goal, year }: { read: number; goal: number; year: number }) {
  if (!goal) return null;
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(year, 0, 0).getTime()) / 86400000);
  const daysInYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  const expectedByNow = Math.round((dayOfYear / daysInYear) * goal);
  const pct = Math.min(100, Math.round((read / goal) * 100));
  const ahead = read >= expectedByNow;
  const diff = Math.abs(read - expectedByNow);
  const monthsLeft = 12 - now.getMonth();
  const booksLeft = Math.max(0, goal - read);
  const needPerMonth = monthsLeft > 0 ? Math.ceil(booksLeft / monthsLeft) : booksLeft;
  const arcR = 52;
  const cx = 70;
  const cy = 70;
  const startAngle = -210;
  const endAngle = 30;
  const sweep = endAngle - startAngle;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcX = (a: number) => cx + arcR * Math.cos(toRad(a));
  const arcY = (a: number) => cy + arcR * Math.sin(toRad(a));
  const pctAngle = startAngle + (pct / 100) * sweep;
  const expectedAngle = startAngle + Math.min(1, expectedByNow / goal) * sweep;
  const largeArc = (pct / 100) * sweep > 180 ? 1 : 0;

  return (
    <div style={{ background: '#0e0b1e', borderRadius: '0.875rem', border: '1px solid rgba(255,255,255,0.07)', padding: '1rem', marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'white', marginBottom: '0.5rem' }}>📈 {year} Reading Pace</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <svg width="140" height="110" viewBox="0 0 140 110">
          <path d={`M ${arcX(startAngle)} ${arcY(startAngle)} A ${arcR} ${arcR} 0 1 1 ${arcX(endAngle)} ${arcY(endAngle)}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round" />
          {pct > 0 && <path d={`M ${arcX(startAngle)} ${arcY(startAngle)} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcX(pctAngle)} ${arcY(pctAngle)}`} fill="none" stroke="url(#gaugeGrad)" strokeWidth="10" strokeLinecap="round" />}
          <line x1={cx} y1={cy} x2={cx + (arcR + 8) * Math.cos(toRad(expectedAngle))} y2={cy + (arcR + 8) * Math.sin(toRad(expectedAngle))} stroke="#fb923c" strokeWidth="2" strokeLinecap="round" />
          <circle cx={cx + (arcR - 4) * Math.cos(toRad(expectedAngle))} cy={cy + (arcR - 4) * Math.sin(toRad(expectedAngle))} r="3" fill="#fb923c" />
          <circle cx={cx} cy={cy} r="4" fill="rgba(255,255,255,0.2)" />
          <text x={cx} y={cy - 14} textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
            {read}
          </text>
          <text x={cx} y={cy - 2} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8">
            of {goal}
          </text>
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ background: ahead ? 'rgba(52,211,153,0.1)' : 'rgba(251,146,60,0.1)', border: `1px solid ${ahead ? 'rgba(52,211,153,0.3)' : 'rgba(251,146,60,0.3)'}`, borderRadius: '0.5rem', padding: '0.4rem 0.6rem', marginBottom: '0.4rem' }}>
            <div style={{ fontSize: '0.7rem', color: ahead ? '#34d399' : '#fb923c', fontWeight: 700 }}>{ahead ? `✦ ${diff} ahead of pace` : `${diff} behind pace`}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.5rem', padding: '0.4rem 0.6rem', marginBottom: '0.4rem' }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>Expected by now</div>
            <div style={{ fontSize: '0.85rem', color: '#fb923c', fontWeight: 700 }}>{expectedByNow} books</div>
          </div>
          <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>need ~{needPerMonth}/mo to finish</div>
        </div>
      </div>
    </div>
  );
}

function buildRows(books: Book[], maxW: number) {
  const SPINE_GAP = 2;
  const spines = books.map((b) => ({
    read: b.read,
    h: 65 + (Number(b.id) % 12),
    w: 11 + (Number(b.id) % 7),
    color: GENRE_CFG[b.genre]?.accent || '#a78bfa',
    tilt: Number(b.id) % 41 === 0 ? 3 : Number(b.id) % 61 === 0 ? -3 : 0,
  }));

  const result: { spine: (typeof spines)[0]; x: number }[][] = [];
  let row: { spine: (typeof spines)[0]; x: number }[] = [];
  let rowW = 0;

  for (const spine of spines) {
    const needed = spine.w + SPINE_GAP;
    if (rowW + needed > maxW && row.length > 0) {
      result.push(row);
      row = [];
      rowW = 0;
    }
    row.push({ spine, x: rowW });
    rowW += needed;
  }
  if (row.length > 0) result.push(row);
  return result;
}

function ShelfRow({ row, isLast, gradId }: { row: { spine: any; x: number }[]; isLast: boolean; gradId: string }) {
  const SHELF_H = 82;
  const PLANK_H = 15;
  const WALL_GAP = 5;
  const last = row[row.length - 1];
  const vbW = Math.max((last?.x ?? 0) + (last?.spine.w ?? 0) + 4, 300);
  const rowH = SHELF_H + PLANK_H + (isLast ? 0 : WALL_GAP);

  return (
    <svg width="100%" viewBox={`0 0 ${vbW} ${rowH}`} preserveAspectRatio="xMinYMin meet" style={{ display: 'block' }}>
      <rect x={0} y={0} width={vbW} height={SHELF_H} fill="#110e22" />
      <rect x={0} y={0} width={vbW} height={20} fill="rgba(0,0,0,0.15)" />
      {row.map(({ spine: s, x }, i) => {
        const bookY = SHELF_H - s.h;
        const cx = x + s.w / 2;
        return (
          <g key={i} transform={s.tilt !== 0 ? `rotate(${s.tilt},${cx},${SHELF_H})` : undefined}>
            <rect x={x + 1} y={bookY + 2} width={s.w} height={s.h} fill="rgba(0,0,0,0.5)" rx={1} />
            <rect x={x} y={bookY} width={s.w} height={s.h} fill={s.color} opacity={s.read ? 0.88 : 0.34} rx={1} />
            <rect x={x} y={bookY} width={s.w} height={3} fill={s.read ? 'rgba(255,255,240,0.55)' : 'rgba(255,255,240,0.12)'} rx={1} />
          </g>
        );
      })}
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9B6E4A" />
          <stop offset="100%" stopColor="#3a2010" />
        </linearGradient>
      </defs>
      <rect x={0} y={SHELF_H + 1} width={vbW} height={PLANK_H - 3} fill={`url(#${gradId})`} />
    </svg>
  );
}

function BookshelfVisual({ books }: { books: Book[] }) {
  const [showModal, setShowModal] = useState(false);
  const total = books.length;
  const readCount = books.filter((b) => b.read).length;
  const pct = total ? Math.round((readCount / total) * 100) : 0;
  const rows = useMemo(() => buildRows(books, 860), [books]);
  const previewRows = rows.slice(0, 3);

  return (
    <>
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 65, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', padding: '1rem' }}>
          <div style={{ background: '#0d0a1c', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', maxHeight: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.1rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'white' }}>📚 Your Library</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.1rem' }}>
                  {readCount} of {total} read · {pct}% · {rows.length} shelves
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: 'white', cursor: 'pointer', padding: '0.3rem 0.65rem', borderRadius: '0.5rem' }}>
                ✕
              </button>
            </div>
            <div style={{ overflowY: 'auto', background: '#0a0614', padding: '6px 0', flex: 1 }}>
              {rows.map((row, ri) => (
                <ShelfRow key={ri} row={row} isLast={ri === rows.length - 1} gradId={`wm${ri}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#0e0b1e', borderRadius: '0.875rem', border: '1px solid rgba(255,255,255,0.07)', padding: '1rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'white' }}>📚 Your Library</div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
            {readCount} of {total} read · {pct}%
          </div>
        </div>
        <div style={{ background: '#0a0614', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
          {previewRows.map((row, ri) => (
            <ShelfRow key={ri} row={row} isLast={ri === previewRows.length - 1} gradId={`wp${ri}`} />
          ))}
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            width: '100%',
            marginTop: '0.6rem',
            padding: '0.5rem',
            background: 'rgba(167,139,250,0.07)',
            border: '1px solid rgba(167,139,250,0.18)',
            borderRadius: '0.65rem',
            color: '#a78bfa',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🔍 View full shelf ({rows.length} shelves · {total} books)
        </button>
      </div>
    </>
  );
}

function BookDetailModal({ book, onClose, onUpdate, onReread }: { book: Book; onClose: () => void; onUpdate: (id: number, patch: Partial<Book>) => void; onReread: (id: number) => void }) {
  const [synopsis, setSynopsis] = useState('');
  const [loadingSyn, setLoadingSyn] = useState(false);
  const [tropes, setTropes] = useState<string[]>(book.tropes || []);
  const [loadingTropes, setLoadingTropes] = useState(false);
  const [newTrope, setNewTrope] = useState('');
  const [note, setNote] = useState(book.note || '');
  const [editingNote, setEditingNote] = useState(false);
  const [rating, setRating] = useState<number | null>(book.rating ?? null);

  const cfg = GENRE_CFG[book.genre] || GENRE_CFG['Fantasy'];

  useEffect(() => {
    (async () => {
      setLoadingSyn(true);
      try {
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(book.title)}+inauthor:${encodeURIComponent(book.author)}&maxResults=1`);
        const data = await res.json();
        const desc = data.items?.[0]?.volumeInfo?.description;
        if (desc) setSynopsis(desc.replace(/<[^>]*>/g, '').slice(0, 600) + (desc.length > 600 ? '…' : ''));
        else setSynopsis('No synopsis available.');
      } catch {
        setSynopsis('Could not load synopsis.');
      }
      setLoadingSyn(false);
    })();
  }, [book.id, book.title, book.author]);

  const fetchTropes = async () => {
    setLoadingTropes(true);
    try {
      const res = await fetch('/.netlify/functions/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{ role: 'user', content: `List 5 common tropes for "${book.title}" by ${book.author}. Return ONLY a JSON array of short trope names (2-4 words each): ["trope1","trope2",...]` }],
        }),
      });
      const data = await res.json();
      const text = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) setTropes([...new Set([...tropes, ...parsed])]);
    } catch {}
    setLoadingTropes(false);
  };

  const inpStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '0.6rem',
    padding: '0.5rem 0.75rem',
    color: 'white',
    fontSize: '0.85rem',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }}>
      <div style={{ background: '#0d0a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.25rem 1.25rem 0 0', padding: '1.5rem', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'white', marginBottom: '0.25rem' }}>{book.title}</div>
            <div style={{ fontSize: '0.8rem', color: cfg.accent }}>{book.author}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.3rem' }}>
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <StarRating
            rating={rating}
            onChange={(r) => {
              setRating(r);
              onUpdate(book.id, { rating: r });
            }}
            size="md"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Synopsis</div>
          {loadingSyn ? <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.78rem' }}>Loading…</div> : <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{synopsis}</div>}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>Tropes</div>
            <button onClick={fetchTropes} disabled={loadingTropes} style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)', cursor: 'pointer' }}>
              {loadingTropes ? '…' : '✦ AI suggest'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
            {tropes.map((t, i) => (
              <span key={i} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              value={newTrope}
              onChange={(e) => setNewTrope(e.target.value)}
              placeholder="Add a trope…"
              style={{ ...inpStyle, fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
            />
            <button
              onClick={() => {
                if (newTrope.trim()) {
                  const nt = [...tropes, newTrope.trim()];
                  setTropes(nt);
                  onUpdate(book.id, { tropes: nt });
                  setNewTrope('');
                }
              }}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.5rem', padding: '0.35rem 0.65rem', cursor: 'pointer' }}
            >
              +
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>Review / Note</div>
            {!editingNote && <button onClick={() => setEditingNote(true)} style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>✎ Edit</button>}
          </div>
          {editingNote ? (
            <div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ ...inpStyle, resize: 'vertical', lineHeight: 1.5, marginBottom: '0.4rem' }} />
              <button
                onClick={() => {
                  onUpdate(book.id, { note });
                  setEditingNote(false);
                }}
                style={{ background: '#6d28d9', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.78rem' }}
              >
                Save Note
              </button>
            </div>
          ) : note ? (
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', background: 'rgba(255,255,255,0.03)', padding: '0.6rem', borderRadius: '0.5rem' }}>"{note}"</div>
          ) : (
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)', cursor: 'pointer' }} onClick={() => setEditingNote(true)}>
              Tap to add a review…
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {book.read && (
            <button onClick={() => onReread(book.id)} style={{ flex: 1, background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '0.75rem', padding: '0.55rem', fontWeight: 600, cursor: 'pointer' }}>
              🔁 Re-read in {THIS_YEAR}
            </button>
          )}
          <button
            onClick={() => {
              onUpdate(book.id, { read: !book.read, readYear: !book.read ? THIS_YEAR : null, readAt: !book.read ? Date.now() : null });
              onClose();
            }}
            style={{ flex: 1, background: book.read ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)', color: book.read ? '#f87171' : '#34d399', border: '1px solid', borderRadius: '0.75rem', padding: '0.55rem', fontWeight: 600, cursor: 'pointer' }}
          >
            {book.read ? 'Mark Unread' : '✓ Mark Read'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalForm({
  book,
  onSave,
  onClose,
  tab,
  allBooks = [],
}: {
  book: Book | null;
  onSave: (b: Book) => void;
  onClose: () => void;
  tab: string;
  allBooks?: Book[];
}) {
  const [mode, setMode] = useState('single');
  const [shelfGenre, setShelfGenre] = useState<Genre>('Romance');
  const [shelfStatus, setShelfStatus] = useState<BookStatus>((tab === 'home' ? 'shelf' : tab) as BookStatus);
  const [shelfRead, setShelfRead] = useState(false);
  const [dupWarning, setDupWarning] = useState('');

  const blank = baseBook({ status: (tab === 'home' ? 'shelf' : tab) as BookStatus });
  const [f, setF] = useState<Book>(book ? { ...book } : blank);
  const [identifying, setId] = useState(false);
  const [idMsg, setIdMsg] = useState('');
  const [suggestions, setSuggestions] = useState<{ title: string; author: string; cover: string }[]>([]);
  const [showSug, setShowSug] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const sugTimer = useRef<any>(null);

  const set = (k: keyof Book, v: any) => setF((p) => ({ ...p, [k]: v }));

  const searchGoogleBooks = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowSug(false);
      return;
    }
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&maxResults=5&printType=books`);
      const data = await res.json();
      const items = (data.items || []).map((item: any) => ({
        title: item.volumeInfo.title || '',
        author: (item.volumeInfo.authors || []).join(', '),
        cover: item.volumeInfo.imageLinks?.smallThumbnail || '',
      }));
      setSuggestions(items);
      setShowSug(items.length > 0);
    } catch {
      setSuggestions([]);
    }
  };

  const handleTitleChange = (val: string) => {
    set('title', val);
    setDupWarning('');
    if (allBooks.some((b) => b.title.toLowerCase() === val.trim().toLowerCase() && b.id !== f.id)) {
      setDupWarning(`"${val}" is already in your shelf!`);
    }
    clearTimeout(sugTimer.current);
    sugTimer.current = setTimeout(() => searchGoogleBooks(val), 400);
  };

  const handleCoverPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setId(true);
    setIdMsg('Identifying…');
    try {
      const b64 = await fileToBase64(file);
      const res = await fetch('/.netlify/functions/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: file.type, data: b64 } },
                { type: 'text', text: 'Identify the book. Return ONLY JSON: {"title":"…","author":"…"}. Unknown: {"title":"","author":""}.' },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      const p = JSON.parse((data.content?.[0]?.text || '').replace(/```json|```/g, '').trim());
      if (p.title) {
        set('title', p.title);
        setIdMsg('✓ Identified!');
      }
      if (p.author) set('author', p.author);
    } catch {
      setIdMsg("Couldn't identify cover.");
    }
    setId(false);
  };

  const inp: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '0.6rem',
    padding: '0.5rem 0.75rem',
    color: 'white',
    fontSize: '0.85rem',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: '1rem' }}>
      <div style={{ background: '#0e0b1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ color: 'white', fontWeight: 'bold', marginBottom: '0.85rem', fontSize: '1.05rem' }}>{book ? 'Edit Book' : 'Add Book'}</h2>

        {!book && (
          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.65rem', padding: '0.25rem' }}>
            {['single', 'bulk', 'photo'].map((mv) => (
              <button key={mv} onClick={() => setMode(mv)} style={{ flex: 1, padding: '0.35rem', borderRadius: '0.5rem', border: 'none', background: mode === mv ? '#6d28d9' : 'transparent', color: 'white', cursor: 'pointer', fontSize: '0.72rem' }}>
                {mv === 'single' ? 'Single' : mv === 'bulk' ? 'Bulk' : '📸 Scan'}
              </button>
            ))}
          </div>
        )}

        {mode === 'single' ? (
          <>
            {!book && (
              <div style={{ marginBottom: '0.75rem' }}>
                <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverPhoto} />
                <button onClick={() => photoRef.current?.click()} disabled={identifying} style={{ width: '100%', padding: '0.55rem', borderRadius: '0.6rem', border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                  {identifying ? 'Identifying…' : '📷 Scan cover'}
                </button>
                {idMsg && <div style={{ fontSize: '0.7rem', color: '#34d399', marginTop: '0.2rem', textAlign: 'center' }}>{idMsg}</div>}
              </div>
            )}

            <div style={{ marginBottom: '0.65rem', position: 'relative' }}>
              <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', display: 'block', marginBottom: '0.2rem' }}>Title</label>
              <input value={f.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Book title" style={inp} />
              {dupWarning && <div style={{ fontSize: '0.7rem', color: '#fb923c', marginTop: '0.2rem' }}>{dupWarning}</div>}

              {showSug && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#1a1035', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0.65rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {suggestions.map((sug, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        set('title', sug.title);
                        if (sug.author) set('author', sug.author);
                        setShowSug(false);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', cursor: 'pointer' }}
                    >
                      {sug.cover && <img src={sug.cover} alt="" style={{ width: '24px', height: '36px', objectFit: 'cover' }} />}
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'white' }}>{sug.title}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>{sug.author}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '0.65rem' }}>
              <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', display: 'block', marginBottom: '0.2rem' }}>Author</label>
              <input value={f.author} onChange={(e) => set('author', e.target.value)} placeholder="Author name" style={inp} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                onClick={() => {
                  if (!f.title.trim()) return;
                  onSave({ ...f, id: f.id || generateUid() });
                }}
                style={{ flex: 1, background: '#6d28d9', color: 'white', border: 'none', borderRadius: '0.75rem', padding: '0.6rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Save
              </button>
              <button onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '0.75rem', padding: '0.6rem', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', display: 'block', marginBottom: '0.35rem' }}>Batch Genre & Status</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select value={shelfGenre} onChange={(e) => setShelfGenre(e.target.value as Genre)} style={{ ...inp, flex: 1 }}>
                  {Object.keys(SUBGENRES).map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select value={shelfStatus} onChange={(e) => setShelfStatus(e.target.value as BookStatus)} style={{ ...inp, flex: 1 }}>
                  <option value="shelf">Shelf</option>
                  <option value="tbr">TBR</option>
                  <option value="reading">Reading</option>
                  <option value="wishlist">Wishlist</option>
                </select>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={shelfRead} onChange={(e) => setShelfRead(e.target.checked)} /> Mark batch as read
            </label>
            <button
              onClick={onClose}
              style={{ width: '100%', background: '#6d28d9', color: 'white', border: 'none', borderRadius: '0.75rem', padding: '0.6rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── App Main Component ────────────────────────────────────────────────────────
export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');
  const [goals] = useState<Goals>(() => {
    try {
      const raw = localStorage.getItem(GOALS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { yearly: 50, monthly: 4, readProgress: null, monthProgress: null };
  });
  const [user, setUser] = useState<User | null>(null);
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [modal, setModal] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};

    if (auth) {
      unsub = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (u) {
          try {
            const snap = await getDoc(doc(db!, 'users', u.uid));
            if (snap.exists()) {
              const data = snap.data();
              const cloud = migrateBooks(data.books || []);
              const ids = new Set(cloud.map((b) => b.id));
              setBooks([...cloud, ...ALL_BOOKS.filter((b) => !ids.has(b.id))]);
            } else {
              setBooks(ALL_BOOKS);
              await saveToFirestore(u.uid, ALL_BOOKS, goals);
            }
          } catch {
            setBooks(ALL_BOOKS);
          }
        } else {
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const local = migrateBooks(JSON.parse(raw));
              const ids = new Set(local.map((b) => b.id));
              setBooks([...local, ...ALL_BOOKS.filter((b) => !ids.has(b.id))]);
            } else setBooks(ALL_BOOKS);
          } catch {
            setBooks(ALL_BOOKS);
          }
        }
        setLoading(false);
      });
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const local = migrateBooks(JSON.parse(raw));
          const ids = new Set(local.map((b) => b.id));
          setBooks([...local, ...ALL_BOOKS.filter((b) => !ids.has(b.id))]);
        } else setBooks(ALL_BOOKS);
      } catch {
        setBooks(ALL_BOOKS);
      }
      setLoading(false);
    }

    return () => unsub();
  }, [goals]);

  const persist = (nb: Book[]) => {
    setBooks(nb);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nb));
      localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    } catch {}
    if (user) saveToFirestore(user.uid, nb, goals);
  };

  const update = (id: number, patch: Partial<Book>) => {
    const updated = books.map((b) => (b.id === id ? { ...b, ...patch } : b));
    persist(updated);
    if (detailBook?.id === id) setDetailBook((prev) => (prev ? { ...prev, ...patch } : null));
  };

  const handleReread = (id: number) => {
    const book = books.find((b) => b.id === id);
    if (!book) return;
    const rr = book.rereads || [];
    if (!rr.includes(THIS_YEAR)) update(id, { rereads: [...rr, THIS_YEAR] });
  };

  if (loading)
    return (
      <div style={{ background: '#06040f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
        ✦ Loading library…
      </div>
    );

  const readCount = books.filter((b) => b.read).length;
  const thisMonthReadCount = books.filter((b) => b.read && b.readAt && new Date(b.readAt).getMonth() === THIS_MONTH && new Date(b.readAt).getFullYear() === THIS_YEAR).length;

  return (
    <div style={{ background: '#06040f', minHeight: '100vh', color: 'white', fontFamily: 'Georgia, serif', padding: '1rem' }}>
      {detailBook && <BookDetailModal book={detailBook} onClose={() => setDetailBook(null)} onUpdate={update} onReread={handleReread} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', color: '#e8d9ff', fontWeight: 'bold' }}>✦ My Shelf</h1>
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{books.length} total books</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => exportCSV(books)} style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.8rem', cursor: 'pointer' }}>
            📤 CSV
          </button>
          {user ? (
            <button onClick={() => auth && signOut(auth)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.8rem', cursor: 'pointer' }}>
              Sign Out
            </button>
          ) : (
            <button onClick={() => auth && provider && signInWithPopup(auth, provider)} style={{ background: '#6d28d9', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.8rem', cursor: 'pointer' }}>
              Sign In
            </button>
          )}
          <button onClick={() => setModal('add')} style={{ background: '#34d399', color: '#042f2e', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>
            + Add
          </button>
        </div>
      </div>

      <PaceGauge read={readCount} goal={goals.yearly} year={THIS_YEAR} />

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
        <GoalRing count={readCount} goal={goals.yearly} label={`${THIS_YEAR} Goal`} emoji="📅" gradStart="#a78bfa" gradEnd="#7c3aed" gradId="yearGrad" />
        <GoalRing count={thisMonthReadCount} goal={goals.monthly} label="Monthly Goal" emoji="🌸" gradStart="#fb7185" gradEnd="#be123c" gradId="monthGrad" />
      </div>

      <BookshelfVisual books={books} />

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {Object.entries(TAB_CFG).map(([k, cfg]) => (
          <Pill key={k} label={cfg.label} active={tab === k} color={cfg.color} onClick={() => setTab(k)} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
        {books
          .filter((b) => (tab === 'home' || tab === 'shelf' ? true : b.status === tab))
          .map((b) => (
            <div key={b.id} onClick={() => setDetailBook(b)} style={{ background: '#0e0b1e', borderRadius: '0.75rem', padding: '0.875rem', border: `1px solid ${STATUS_COLORS[b.status]}40`, cursor: 'pointer' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: 'white' }}>{b.title}</div>
              <div style={{ fontSize: '0.75rem', color: '#a78bfa', marginTop: '0.1rem' }}>{b.author}</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.4rem' }}>{b.genre}</div>
            </div>
          ))}
      </div>

      {modal === 'add' && (
        <ModalForm
          book={null}
          tab={tab}
          allBooks={books}
          onSave={(nb) => {
            persist([...books, nb]);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
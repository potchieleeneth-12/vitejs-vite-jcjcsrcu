import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import { initializeApp } from 'firebase/app';

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD2p_VgfHQhGja_Xb-XrSwLUxqUdrpipzA',
  authDomain: 'personal-library-99222.firebaseapp.com',
  projectId: 'personal-library-99222',
  storageBucket: 'personal-library-99222.firebasestorage.app',
  messagingSenderId: '188028941942',
  appId: '1:188028941942:web:8e9aee68e9a22091935157',
};

let _auth: any = null, _db: any = null, _provider: any = null;
let _signInWithPopup: any = null, _signOut: any = null, _onAuthStateChanged: any = null;
let _doc: any = null, _getDoc: any = null, _setDoc: any = null;
let firebaseReady = false;

const initFirebase = async () => {
  try {
    const app = initializeApp(firebaseConfig);
    _auth = getAuth(app);
    _db = getFirestore(app);
    _provider = new GoogleAuthProvider();
    _signInWithPopup = signInWithPopup;
    _signOut = signOut;
    _onAuthStateChanged = onAuthStateChanged;
    _doc = doc; _getDoc = getDoc; _setDoc = setDoc;
    firebaseReady = true;
    return true;
  } catch { return false; }
};

const saveToFirestore = async (uid: string, books: any[], goals: any) => {
  if (!firebaseReady) return;
  try {
    await _setDoc(_doc(_db, 'users', uid), { books, goals });
    const publicBooks = books.map((b: any) => ({
      id: b.id, title: b.title, author: b.author, genre: b.genre,
      subgenre: b.subgenre, series: b.series, sn: b.sn,
      read: b.read, readYear: b.readYear, status: b.status,
      rating: b.rating ?? null, note: b.note ?? '',
    }));
    await _setDoc(_doc(_db, 'public', uid), { books: publicBooks, updatedAt: Date.now() });
  } catch {}
};

// ── Config ────────────────────────────────────────────────────────────────────
const GENRE_CFG: Record<string, { accent: string; dim: string }> = {
  Romantasy:          { accent: '#4ade80', dim: '#14532d' },
  Fantasy:            { accent: '#a78bfa', dim: '#2d1b69' },
  Romance:            { accent: '#fb7185', dim: '#6b1a2e' },
  'Mystery/Thriller': { accent: '#fbbf24', dim: '#6b4a04' },
  Horror:             { accent: '#f87171', dim: '#5b1a1a' },
  Contemporary:       { accent: '#f97316', dim: '#431407' },
  Classics:           { accent: '#e5c97a', dim: '#5a4000' },
  'Non-Fiction':      { accent: '#60a5fa', dim: '#1e3a5f' },
};

const SUBGENRES: Record<string, string[]> = {
  Romantasy:          ['Romantasy','Mythology Romance','Paranormal Romance','Historical Fantasy','Dark Romantasy'],
  Fantasy:            ['Dark Fantasy','Urban Fantasy','YA Fantasy','High Fantasy','Historical Fantasy','Mythology Romance'],
  Romance:            ['Contemporary Romance','Dark Romance','Sports Romance','Holiday Romance','New Adult Romance','College Romance'],
  'Mystery/Thriller': ['Cozy Mystery','YA Mystery','Historical Mystery','Thriller','Dark Thriller','Conspiracy Thriller'],
  Horror:             ['Gothic Horror','Dark Fiction','Horror Comedy'],
  Contemporary:       ['Contemporary Fiction','Literary Fiction','Cozy Fiction','New Adult','Chick Lit'],
  Classics:           ['Gothic Classic','Russian Lit','French Lit','British Lit','American Lit','Fairy Tales','German Lit'],
  'Non-Fiction':      ['Memoir','Self-Help','Philosophy','Language Learning'],
};

const STORAGE_KEY = 'myshelf-v8';
const GOALS_KEY   = 'myshelf-goals-v1';

const TAB_CFG: Record<string, { label: string; color: string }> = {
  home:     { label: '✦ Home',       color: '#c084fc' },
  shelf:    { label: '📚 Shelf',     color: '#a78bfa' },
  tbr:      { label: '🔖 TBR',       color: '#fb923c' },
  reading:  { label: '📖 Reading',   color: '#34d399' },
  insights: { label: '📊 Insights',  color: '#c084fc' },
  wishlist: { label: '✨ Wishlist',  color: '#f472b6' },
};

const STATUS_COLORS: Record<string, string> = {
  shelf: '#a78bfa', tbr: '#fb923c', reading: '#34d399', wishlist: '#f472b6',
};

const THIS_YEAR  = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth();

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Date.now() + Math.random();
const base = (extra: any) => ({ read: false, status: 'shelf', readAt: null, readYear: null, rating: null, note: '', rereads: [], ...extra });
const migrateBooks = (books: any[]) => books.map((b: any) => ({
  ...b,
  status: b.status || 'shelf',
  readAt: b.readAt || null,
  readYear: b.readYear || null,
  rating: b.rating ?? null,
  note: b.note ?? '',
  rereads: b.rereads ?? [],
}));

const fa  = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Fantasy', subgenre: sg, series: sr, sn });
const rt = (id: number, t: string, a: string, arg4: string | null, arg5: any = null, arg6: number | null = null) => {
  const has6Args = arg6 !== null && arg6 !== undefined;
  const subgenre = has6Args ? (arg4 || 'Romantasy') : 'Romantasy';
  const series = has6Args ? arg5 : arg4;
  const sn = has6Args ? arg6 : arg5;
  return base({ id, title: t, author: a, category: 'Fiction', genre: 'Romantasy', subgenre, series, sn });
};
const r   = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Romance', subgenre: sg, series: sr, sn });
const m   = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Mystery/Thriller', subgenre: sg, series: sr, sn });
const h   = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Horror', subgenre: sg, series: sr, sn });
const co  = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Contemporary', subgenre: sg, series: sr, sn });
const cl  = (id: number, t: string, a: string, sg: string) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Classics', subgenre: sg, series: null, sn: null });
const nf  = (id: number, t: string, a: string, sg: string) => base({ id, title: t, author: a, category: 'Non-Fiction', genre: 'Non-Fiction', subgenre: sg, series: null, sn: null });

const processAndCompressImage = (file: File, maxDimension = 1500): Promise<{ b64: string; mime: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context failed'));
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const b64 = dataUrl.split(',')[1];
      resolve({ b64, mime: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

const exportCSV = (books: any[]) => {
  const headers = ['Title','Author','Genre','Subgenre','Series','#','Status','Read','Year Read','Rating','Note'];
  const rows = books.map(b => [
    b.title, b.author, b.genre, b.subgenre||'', b.series||'', b.sn!=null?b.sn:'',
    b.status, b.read?'Yes':'No', b.readYear||'', b.rating||'', (b.note||'').replace(/"/g,"'"),
  ].map(v=>`"${v}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'myshelf.csv'; a.click();
  URL.revokeObjectURL(url);
};

// ── Seed Data ─────────────────────────────────────────────────────────────────
const SEED = [
  fa(1,'The Awakening','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',1),
  fa(2,'Ruthless Fae','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',2),
  fa(3,'The Reckoning','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',3),
  fa(4,'Shadow Princess','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',4),
  fa(5,'Cursed Fates','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',5),
  fa(11,'The Big Ass Party','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',5.5),
  fa(6,'Fated Throne','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',6),
  fa(7,'Heartless Sky','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',7),
  fa(8,'Sorrow and Starlight','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',8),
  fa(9,'Beyond the Veil','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',8.5),
  fa(10,'Restless Stars','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',9),
  fa(779,'Dark Fae','C.Peckham & S.Valenti','Paranormal Romance','Ruthless Boys of the Zodiac',1),
  fa(780,'Savage Fae','C.Peckham & S.Valenti','Paranormal Romance','Ruthless Boys of the Zodiac',2),
  fa(781,'Vicious Fae','C.Peckham & S.Valenti','Paranormal Romance','Ruthless Boys of the Zodiac',3),
  fa(782,'Broken Fae','C.Peckham & S.Valenti','Paranormal Romance','Ruthless Boys of the Zodiac',4),
  fa(783,'Warrior Fae','C.Peckham & S.Valenti','Paranormal Romance','Ruthless Boys of the Zodiac',5),
  fa(510,'Hollow','C. Peckham & S. Valenti','Paranormal Romance','Crown of Hearts & Chaos',1),
  fa(511,'Never Keep','C. Peckham & S. Valenti','Paranormal Romance','Sins of the Zodiac',1),
  fa(12,'Caraval','Stephanie Garber','YA Fantasy','Caraval',1),
  fa(13,'Legendary','Stephanie Garber','YA Fantasy','Caraval',2),
  fa(14,'Finale','Stephanie Garber','YA Fantasy','Caraval',3),
  fa(700,'Once Upon a Broken Heart','Stephanie Garber','YA Fantasy','Once Upon a Broken Heart',1),
  fa(701,'The Ballad of Never After','Stephanie Garber','YA Fantasy','Once Upon a Broken Heart',2),
  fa(702,'A Curse for True Love','Stephanie Garber','YA Fantasy','Once Upon a Broken Heart',3),
  fa(15,'Alchemy of Secrets','Stephanie Garber','YA Fantasy',null,null),
  m(16,'The Inheritance Games','Jennifer Lynn Barnes','YA Mystery','The Inheritance Games',1),
  m(17,'The Hawthorne Legacy','Jennifer Lynn Barnes','YA Mystery','The Inheritance Games',2),
  m(18,'The Final Gambit','Jennifer Lynn Barnes','YA Mystery','The Inheritance Games',3),
  m(19,'Games Untold','Jennifer Lynn Barnes','YA Mystery','The Inheritance Games',4),
  m(20,'The Brothers Hawthorne','Jennifer Lynn Barnes','YA Mystery','The Inheritance Games',5),
  m(21,'The Naturals','Jennifer Lynn Barnes','YA Mystery','The Naturals',1),
  m(890,'Killer Spirit','Jennifer Lynn Barnes','YA Mystery','The Squad',2),
  fa(847,'Glorious Rivals','Jennifer Lynn Barnes','YA Fantasy',null,null),
  m(22,'Stalking Jack the Ripper','Kerri Maniscalco','Historical Mystery','Stalking Jack the Ripper',1),
  m(24,'Hunting Prince Dracula','Kerri Maniscalco','Historical Mystery','Stalking Jack the Ripper',2),
  m(23,'Escaping from Houdini','Kerri Maniscalco','Historical Mystery','Stalking Jack the Ripper',3),
  m(25,'Capturing the Devil','Kerri Maniscalco','Historical Mystery','Stalking Jack the Ripper',4),
  fa(26,'Kingdom of the Wicked','Kerri Maniscalco','Dark Fantasy','Kingdom of the Wicked',1),
  fa(27,'Kingdom of the Cursed','Kerri Maniscalco','Dark Fantasy','Kingdom of the Wicked',2),
  fa(28,'Kingdom of the Feared','Kerri Maniscalco','Dark Fantasy','Kingdom of the Wicked',3),
  fa(29,'Throne of the Fallen','Kerri Maniscalco','Dark Fantasy','Throne of the Fallen',1),
  fa(30,'Throne of Secrets','Kerri Maniscalco','Dark Fantasy','Throne of the Fallen',2),
  fa(31,'Divine Rivals','Rebecca Ross','YA Fantasy','Letters of Enchantment',1),
  fa(32,'Ruthless Vows','Rebecca Ross','YA Fantasy','Letters of Enchantment',2),
  fa(167,'A River Enchanted','Rebecca Ross','Historical Fantasy','Elements of Cadence',1),
  fa(168,'A Fire Endless','Rebecca Ross','Historical Fantasy','Elements of Cadence',2),
  fa(33,'Wild Reverence','Rebecca Ross','YA Fantasy',null,null),
  fa(34,'The Foxglove King','Hannah Whitten','Dark Fantasy','The Nightshade Crown',1),
  fa(35,'The Hemlock Queen','Hannah Whitten','Dark Fantasy','The Nightshade Crown',2),
  fa(304,'For the Wolf','Hannah Whitten','Dark Fantasy','The Wilderwood',1),
  rt(36,'Fourth Wing','Rebecca Yarros','The Empyrean',1),
  rt(37,'Iron Flame','Rebecca Yarros','The Empyrean',2),
  rt(38,'Onyx Storm','Rebecca Yarros','The Empyrean',3),
  rt(39,'A Fate Inked in Blood','Danielle L. Jensen','Saga of the Unfated',1),
  rt(40,'A Curse Carved in Bone','Danielle L. Jensen','Saga of the Unfated',2),
  rt(41,"The Assassin's Blade",'Sarah J. Maas','Throne of Glass',0),
  rt(42,'Throne of Glass','Sarah J. Maas','Throne of Glass',1),
  rt(43,'Crown of Midnight','Sarah J. Maas','Throne of Glass',2),
  rt(44,'Heir of Fire','Sarah J. Maas','Throne of Glass',3),
  rt(45,'Queen of Shadows','Sarah J. Maas','Throne of Glass',4),
  rt(46,'Empire of Storms','Sarah J. Maas','Throne of Glass',5),
  rt(47,'Tower of Dawn','Sarah J. Maas','Throne of Glass',6),
  rt(48,'Kingdom of Ash','Sarah J. Maas','Throne of Glass',7),
  rt(645,'A Court of Thorns and Roses','Sarah J. Maas','A Court of Thorns and Roses',1),
  rt(646,'A Court of Mist and Fury','Sarah J. Maas','A Court of Thorns and Roses',2),
  rt(647,'A Court of Wings and Ruin','Sarah J. Maas','A Court of Thorns and Roses',3),
  rt(648,'A Court of Frost and Starlight','Sarah J. Maas','A Court of Thorns and Roses',3.5),
  rt(649,'A Court of Silver Flames','Sarah J. Maas','A Court of Silver Flames',4),
  rt(650,'House of Earth and Blood','Sarah J. Maas','Crescent City',1),
  rt(651,'House of Sky and Breath','Sarah J. Maas','Crescent City',2),
  rt(652,'House of Flame and Shadow','Sarah J. Maas','Crescent City',3),
  fa(684,'The Final Empire','Brandon Sanderson','High Fantasy','Mistborn',1),
  fa(685,'The Well of Ascension','Brandon Sanderson','High Fantasy','Mistborn',2),
  fa(686,'The Hero of Ages','Brandon Sanderson','High Fantasy','Mistborn',3),
];

const seen = new Set<number>();
const ALL_BOOKS: any[] = [];
for (const b of SEED) {
  if (!seen.has(b.id)) { seen.add(b.id); ALL_BOOKS.push(b); }
}

function StarRating({ rating, onChange, size = 'sm' }: { rating: number|null; onChange?: (r: number) => void; size?: 'sm'|'md' }) {
  const [hover, setHover] = useState(0);
  const sz = size === 'md' ? '1.1rem' : '0.75rem';
  return (
    <div style={{ display:'flex', gap:'1px' }}>
      {[1,2,3,4,5].map(s => (
        <span key={s}
          onClick={() => onChange?.(s === rating ? 0 : s)}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          style={{ fontSize: sz, cursor: onChange ? 'pointer' : 'default', color: s <= (hover || rating || 0) ? '#fbbf24' : 'rgba(255,255,255,0.15)', lineHeight: 1, transition: 'color 0.1s' }}>
          ★
        </span>
      ))}
    </div>
  );
}

function Pill({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ whiteSpace:'nowrap',fontSize:'0.7rem',padding:'0.3rem 0.75rem',borderRadius:'9999px',border:active?`1px solid ${color}`:'1px solid rgba(255,255,255,0.1)',background:active?color+'25':'transparent',color:active?color:'rgba(255,255,255,0.35)',cursor:'pointer',fontWeight:active?600:400 }}>
      {label}
    </button>
  );
}

function GoalRing({ count, goal, label, emoji, gradStart, gradEnd, gradId }: {
  count: number; goal: number; label: string; emoji: string; gradStart: string; gradEnd: string; gradId: string;
}) {
  const pct = goal ? Math.min(100, Math.round((count / goal) * 100)) : 0;
  const R = 46; const circ = 2 * Math.PI * R;
  return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem' }}>
      <div style={{ position:'relative',width:'110px',height:'110px' }}>
        <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"/>
          <circle cx="55" cy="55" r={R} fill="none" stroke={`url(#${gradId})`} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={`${circ}`} strokeDashoffset={`${circ*(1-pct/100)}`}
            style={{ transition:'stroke-dashoffset 0.8s ease' }}/>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradStart}/>
              <stop offset="100%" stopColor={gradEnd}/>
            </linearGradient>
          </defs>
        </svg>
        <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
          <span style={{ color:'white',fontWeight:'bold',fontSize:'1.3rem',lineHeight:1 }}>{count}</span>
          <span style={{ color:'rgba(255,255,255,0.3)',fontSize:'0.6rem' }}>of {goal||'?'}</span>
        </div>
      </div>
      <div style={{ textAlign:'center' }}>
        <div style={{ color:gradStart,fontSize:'0.75rem',fontWeight:600 }}>{emoji} {label}</div>
        <div style={{ color:'rgba(255,255,255,0.3)',fontSize:'0.65rem' }}>{pct}% complete</div>
      </div>
    </div>
  );
}

function PaceGauge({ read, goal, year }: { read: number; goal: number; year: number }) {
  if (!goal) return null;
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(year,0,0).getTime()) / 86400000);
  const daysInYear = ((year%4===0&&year%100!==0)||year%400===0) ? 366 : 365;
  const expectedByNow = Math.round((dayOfYear / daysInYear) * goal);
  const pct = Math.min(100, Math.round((read/goal)*100));
  const ahead = read >= expectedByNow;
  const diff = Math.abs(read - expectedByNow);
  const monthsLeft = 12 - now.getMonth();
  const booksLeft = Math.max(0, goal - read);
  const needPerMonth = monthsLeft > 0 ? Math.ceil(booksLeft / monthsLeft) : booksLeft;
  const arcR = 52; const cx = 70; const cy = 70;
  const startAngle = -210; const endAngle = 30; const sweep = endAngle - startAngle;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcX = (a: number) => cx + arcR * Math.cos(toRad(a));
  const arcY = (a: number) => cy + arcR * Math.sin(toRad(a));
  const pctAngle = startAngle + (pct/100)*sweep;
  const expectedAngle = startAngle + (Math.min(1,expectedByNow/goal))*sweep;
  const largeArc = (pct/100)*sweep > 180 ? 1 : 0;
  return (
    <div style={{ background:'#0e0b1e',borderRadius:'0.875rem',border:'1px solid rgba(255,255,255,0.07)',padding:'1rem',marginBottom:'0.75rem' }}>
      <div style={{ fontSize:'0.78rem',fontWeight:'600',color:'white',marginBottom:'0.5rem' }}>📈 {year} Reading Pace</div>
      <div style={{ display:'flex',alignItems:'center',gap:'1rem' }}>
        <svg width="140" height="110" viewBox="0 0 140 110">
          <path d={`M ${arcX(startAngle)} ${arcY(startAngle)} A ${arcR} ${arcR} 0 1 1 ${arcX(endAngle)} ${arcY(endAngle)}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round"/>
          {pct > 0 && <path d={`M ${arcX(startAngle)} ${arcY(startAngle)} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcX(pctAngle)} ${arcY(pctAngle)}`} fill="none" stroke="url(#gaugeGrad)" strokeWidth="10" strokeLinecap="round"/>}
          <line x1={cx} y1={cy} x2={cx + (arcR+8)*Math.cos(toRad(expectedAngle))} y2={cy + (arcR+8)*Math.sin(toRad(expectedAngle))} stroke="#fb923c" strokeWidth="2" strokeLinecap="round"/>
          <circle cx={cx + (arcR-4)*Math.cos(toRad(expectedAngle))} cy={cy + (arcR-4)*Math.sin(toRad(expectedAngle))} r="3" fill="#fb923c"/>
          <circle cx={cx} cy={cy} r="4" fill="rgba(255,255,255,0.2)"/>
          <text x={cx} y={cy-14} textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">{read}</text>
          <text x={cx} y={cy-2} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8">of {goal}</text>
          <defs><linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#4ade80"/><stop offset="100%" stopColor="#a78bfa"/></linearGradient></defs>
          <text x={arcX(startAngle)-6} y={arcY(startAngle)+4} fill="rgba(255,255,255,0.25)" fontSize="7">0</text>
          <text x={arcX(endAngle)+2} y={arcY(endAngle)+4} fill="rgba(255,255,255,0.25)" fontSize="7">{goal}</text>
        </svg>
        <div style={{ flex:1 }}>
          <div style={{ background:ahead?'rgba(52,211,153,0.1)':'rgba(251,146,60,0.1)',border:`1px solid ${ahead?'rgba(52,211,153,0.3)':'rgba(251,146,60,0.3)'}`,borderRadius:'0.5rem',padding:'0.4rem 0.6rem',marginBottom:'0.4rem' }}>
            <div style={{ fontSize:'0.7rem',color:ahead?'#34d399':'#fb923c',fontWeight:700 }}>{ahead?`✦ ${diff} ahead of pace`:`${diff} behind pace`}</div>
          </div>
          <div style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'0.5rem',padding:'0.4rem 0.6rem',marginBottom:'0.4rem' }}>
            <div style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.4)' }}>Expected by now</div>
            <div style={{ fontSize:'0.85rem',color:'#fb923c',fontWeight:700 }}>{expectedByNow} books</div>
          </div>
          <div style={{ fontSize:'0.62rem',color:'rgba(255,255,255,0.3)' }}>need ~{needPerMonth}/mo to finish</div>
        </div>
      </div>
    </div>
  );
}

function buildRows(books: any[], maxW: number) {
  const SPINE_GAP = 2;
  const spines = [...books].sort((a, b) => (a.id * 2654435761 % 99991) - (b.id * 2654435761 % 99991)).map(b => ({
    read:  b.read,
    h:     65 + (b.id % 12),
    w:     11 + (b.id % 7),
    color: GENRE_CFG[b.genre]?.accent || '#a78bfa',
    tilt:  (b.id % 41 === 0) ? 3 : (b.id % 61 === 0) ? -3 : 0,
  }));
  const result: { spine: typeof spines[0]; x: number }[][] = [];
  let row: { spine: typeof spines[0]; x: number }[] = [];
  let rowW = 0;
  for (const spine of spines) {
    const needed = spine.w + SPINE_GAP;
    if (rowW + needed > maxW && row.length > 0) { result.push(row); row = []; rowW = 0; }
    row.push({ spine, x: rowW });
    rowW += needed;
  }
  if (row.length > 0) result.push(row);
  return result;
}

function ShelfRow({ row, isLast, gradId }: { row: { spine: any; x: number }[]; isLast: boolean; gradId: string; }) {
  const SHELF_H = 82; const PLANK_H = 15; const WALL_GAP = 5;
  const last = row[row.length - 1];
  const vbW  = Math.max((last?.x ?? 0) + (last?.spine.w ?? 0) + 4, 300);
  const rowH = SHELF_H + PLANK_H + (isLast ? 0 : WALL_GAP);

  return (
    <svg width="100%" viewBox={`0 0 ${vbW} ${rowH}`} preserveAspectRatio="xMinYMin meet" style={{ display:'block' }}>
      <rect x={0} y={0} width={vbW} height={SHELF_H} fill="#110e22"/>
      <rect x={0} y={0} width={vbW} height={20} fill="rgba(0,0,0,0.15)"/>
      {row.map(({ spine: s, x }, i) => {
        const bookY = SHELF_H - s.h;
        const cx = x + s.w / 2;
        const linesY = bookY + 14;
        const lineCount = Math.floor((s.h - 22) / 13);
        return (
          <g key={i} transform={s.tilt !== 0 ? `rotate(${s.tilt},${cx},${SHELF_H})` : undefined}>
            <rect x={x+1} y={bookY+2} width={s.w} height={s.h} fill="rgba(0,0,0,0.5)" rx={1}/>
            <rect x={x} y={bookY} width={s.w} height={s.h} fill={s.color} opacity={s.read ? 0.88 : 0.34} rx={1}/>
            <rect x={x} y={bookY} width={s.w} height={3} fill={s.read ? 'rgba(255,255,240,0.55)' : 'rgba(255,255,240,0.12)'} rx={1}/>
            <rect x={x} y={bookY+3} width={2} height={s.h-5} fill={s.read ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.05)'}/>
            <rect x={x+s.w-1} y={bookY+3} width={1} height={s.h-5} fill="rgba(0,0,0,0.35)"/>
            {Array.from({ length: lineCount }, (_, li) => (
              <line key={li} x1={x+3} y1={linesY + li*13} x2={x+s.w-3} y2={linesY + li*13} stroke={s.read ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)'} strokeWidth={0.9}/>
            ))}
          </g>
        );
      })}
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9B6E4A"/>
          <stop offset="15%" stopColor="#7A5030"/>
          <stop offset="65%" stopColor="#57341A"/>
          <stop offset="100%" stopColor="#3a2010"/>
        </linearGradient>
      </defs>
      <rect x={0} y={SHELF_H} width={vbW} height={1} fill="rgba(255,255,255,0.18)"/>
      <rect x={0} y={SHELF_H+1} width={vbW} height={PLANK_H-3} fill={`url(#${gradId})`}/>
      <rect x={0} y={SHELF_H+PLANK_H-2} width={vbW} height={3} fill="rgba(0,0,0,0.55)"/>
      {!isLast && <rect x={0} y={SHELF_H+PLANK_H} width={vbW} height={WALL_GAP} fill="#0a0614"/>}
    </svg>
  );
}

function ShelfModal({ books, onClose }: { books: any[]; onClose: () => void }) {
  const total = books.length;
  const readCount = books.filter(b => b.read).length;
  const pct = total ? Math.round((readCount / total) * 100) : 0;
  const rows = useMemo(() => buildRows(books, 860), [books.length, readCount]);

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:65,background:'rgba(0,0,0,0.9)' }}/>
      <div style={{ position:'fixed',inset:0,zIndex:66,display:'flex',flexDirection:'column',padding:'1rem',pointerEvents:'none' }}>
        <div style={{ background:'#0d0a1c',borderRadius:'1rem',border:'1px solid rgba(255,255,255,0.1)',display:'flex',flexDirection:'column',maxHeight:'100%',overflow:'hidden',pointerEvents:'all' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.85rem 1.1rem',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0 }}>
            <div>
              <div style={{ fontSize:'0.9rem',fontWeight:'bold',color:'white' }}>📚 Your Library</div>
              <div style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.35)',marginTop:'0.1rem' }}>{readCount} of {total} read · {pct}% · {rows.length} shelves</div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)',border:'none',color:'rgba(255,255,255,0.55)',cursor:'pointer',fontSize:'1rem',borderRadius:'0.5rem',padding:'0.3rem 0.65rem',lineHeight:1 }}>✕</button>
          </div>
          <div style={{ overflowY:'auto',background:'#0a0614',padding:'6px 0',flex:1 }}>
            {rows.map((row, ri) => <ShelfRow key={ri} row={row} isLast={ri===rows.length-1} gradId={`wm${ri}`}/>)}
          </div>
        </div>
      </div>
    </>
  );
}

function BookshelfVisual({ books }: { books: any[] }) {
  const [showModal, setShowModal] = useState(false);
  const total = books.length;
  const readCount = books.filter(b => b.read).length;
  const pct = total ? Math.round((readCount / total) * 100) : 0;
  const rows = useMemo(() => buildRows(books, 860), [books.length, readCount]);
  const previewRows = rows.slice(0, 3);

  return (
    <>
      {showModal && <ShelfModal books={books} onClose={() => setShowModal(false)}/>}
      <div style={{ background:'#0e0b1e',borderRadius:'0.875rem',border:'1px solid rgba(255,255,255,0.07)',padding:'1rem',marginBottom:'0.75rem' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.7rem' }}>
          <div style={{ fontSize:'0.78rem',fontWeight:'600',color:'white' }}>📚 Your Library</div>
          <div style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.3)' }}>{readCount} of {total} read &nbsp;·&nbsp; {pct}%</div>
        </div>
        <div style={{ background:'#0a0614',borderRadius:'0.5rem',overflow:'hidden',border:'1px solid rgba(255,255,255,0.05)' }}>
          {previewRows.map((row, ri) => (
            <ShelfRow key={ri} row={row} isLast={ri === previewRows.length - 1} gradId={`wp${ri}`}/>
          ))}
        </div>
        <button onClick={() => setShowModal(true)} style={{ width:'100%',marginTop:'0.6rem',padding:'0.5rem',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.4rem',background:'rgba(167,139,250,0.07)',border:'1px solid rgba(167,139,250,0.18)',borderRadius:'0.65rem',color:'#a78bfa',fontSize:'0.75rem',fontWeight:600,cursor:'pointer' }}>
          <span>🔍 View full shelf</span>
          <span style={{ opacity:0.45,fontWeight:400,fontSize:'0.7rem' }}>({rows.length} shelves · {total} books)</span>
        </button>
      </div>
    </>
  );
}

// ── BookDetailModal ────────────────────────────────────────────────────────────
function BookDetailModal({ book, onClose, onUpdate, onReread }: { book: any; onClose: () => void; onUpdate: (id: any, patch: any) => void; onReread: (id: any) => void }) {
  const [synopsis, setSynopsis] = useState('');
  const [loadingSyn, setLoadingSyn] = useState(false);
  const [tropes, setTropes] = useState<string[]>(book.tropes || []);
  const [loadingTropes, setLoadingTropes] = useState(false);
  const [note, setNote] = useState(book.note || '');
  const [rating, setRating] = useState<number|null>(book.rating ?? null);
  const [editingNote, setEditingNote] = useState(false);
  const cfg = GENRE_CFG[book.genre] || GENRE_CFG['Fantasy'];
  const rereads: number[] = book.rereads || [];

  useEffect(() => {
    (async () => {
      setLoadingSyn(true);
      try {
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(book.title)}+inauthor:${encodeURIComponent(book.author)}&maxResults=1`);
        const data = await res.json();
        const desc = data.items?.[0]?.volumeInfo?.description;
        if (desc) setSynopsis(desc.replace(/<[^>]*>/g,'').slice(0,600)+(desc.length>600?'…':''));
        else setSynopsis('No synopsis available.');
      } catch { setSynopsis('Could not load synopsis.'); }
      setLoadingSyn(false);
    })();
  }, [book.id]);

  const fetchTropes = async () => {
    setLoadingTropes(true);
    try {
      const res = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `List 5 common tropes for "${book.title}" by ${book.author}. Return ONLY a raw JSON array of short trope names (2-4 words each): ["trope1","trope2",...]`
        })
      });
      const data = await res.json();
      const text = (data.text || '').replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) setTropes([...new Set([...tropes, ...parsed])]);
    } catch {}
    setLoadingTropes(false);
  };

  const saveNote = () => { onUpdate(book.id,{note,rating}); setEditingNote(false); };

  return (
    <div style={{ position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end',justifyContent:'center',background:'rgba(0,0,0,0.85)' }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{ background:'#0d0a1c',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'1.25rem 1.25rem 0 0',padding:'1.5rem',width:'100%',maxWidth:'600px',maxHeight:'90vh',overflowY:'auto' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1rem' }}>
          <div style={{ flex:1,minWidth:0,paddingRight:'1rem' }}>
            <div style={{ fontSize:'1.05rem',fontWeight:'bold',color:'white',lineHeight:1.3,marginBottom:'0.25rem' }}>{book.title}</div>
            <div style={{ fontSize:'0.8rem',color:cfg.accent+'cc',marginBottom:'0.2rem' }}>{book.author}</div>
            {book.series&&<div style={{ fontSize:'0.7rem',color:'rgba(255,255,255,0.3)' }}>{book.series}{book.sn!=null?` #${book.sn}`:''}</div>}
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:'1.3rem',flexShrink:0 }}>✕</button>
        </div>
        <div style={{ display:'flex',gap:'0.4rem',flexWrap:'wrap',marginBottom:'1rem' }}>
          <span style={{ fontSize:'0.65rem',padding:'0.15rem 0.5rem',borderRadius:'9999px',background:cfg.dim,color:cfg.accent }}>{book.genre}</span>
          {book.subgenre&&<span style={{ fontSize:'0.65rem',padding:'0.15rem 0.5rem',borderRadius:'9999px',background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.4)' }}>{book.subgenre}</span>}
          {book.read&&<span style={{ fontSize:'0.65rem',padding:'0.15rem 0.5rem',borderRadius:'9999px',background:'rgba(52,211,153,0.1)',color:'#34d399' }}>✓ Read {book.readYear||''}</span>}
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'1rem' }}>
          <StarRating rating={rating} onChange={r=>{ const nr=r===rating?null:r; setRating(nr); onUpdate(book.id,{rating:nr}); }} size="md"/>
          {rating&&<span style={{ fontSize:'0.7rem',color:'rgba(255,255,255,0.3)' }}>{rating}/5</span>}
        </div>
        <div style={{ marginBottom:'1rem' }}>
          <div style={{ fontSize:'0.72rem',color:'rgba(255,255,255,0.4)',marginBottom:'0.35rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em' }}>Synopsis</div>
          {loadingSyn?(<div style={{ color:'rgba(255,255,255,0.2)',fontSize:'0.78rem' }}>Loading…</div>):(<div style={{ fontSize:'0.78rem',color:'rgba(255,255,255,0.6)',lineHeight:1.6 }}>{synopsis}</div>)}
        </div>
        <div style={{ marginBottom:'1rem' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.35rem' }}>
            <div style={{ fontSize:'0.72rem',color:'rgba(255,255,255,0.4)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em' }}>Tropes</div>
            <button onClick={fetchTropes} disabled={loadingTropes} style={{ fontSize:'0.65rem',padding:'0.15rem 0.5rem',borderRadius:'9999px',border:'1px solid rgba(167,139,250,0.4)',background:'rgba(167,139,250,0.1)',color:'#a78bfa',cursor:'pointer' }}>{loadingTropes?'…':'✦ AI suggest'}</button>
          </div>
          <div style={{ display:'flex',gap:'0.35rem',flexWrap:'wrap',marginBottom:'0.4rem' }}>
            {tropes.map((t,i)=>(<span key={i} style={{ display:'flex',alignItems:'center',gap:'0.25rem',fontSize:'0.68rem',padding:'0.2rem 0.5rem',borderRadius:'9999px',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.6)',border:'1px solid rgba(255,255,255,0.1)' }}>{t}<span onClick={()=>{const nt=tropes.filter((_,j)=>j!==i);setTropes(nt);onUpdate(book.id,{tropes:nt});}} style={{ cursor:'pointer',color:'rgba(255,255,255,0.3)',fontSize:'0.7rem' }}>×</span></span>))}
            {tropes.length===0&&<span style={{ fontSize:'0.72rem',color:'rgba(255,255,255,0.2)' }}>No tropes yet</span>}
          </div>
        </div>
        <div style={{ display:'flex',gap:'0.5rem',flexWrap:'wrap' }}>
          {book.read&&(<button onClick={()=>onReread(book.id)} style={{ flex:1,minWidth:'120px',background:'rgba(167,139,250,0.1)',color:'#a78bfa',border:'1px solid rgba(167,139,250,0.3)',borderRadius:'0.75rem',padding:'0.55rem',fontWeight:600,cursor:'pointer',fontSize:'0.78rem' }}>🔁 Re-read in {THIS_YEAR}</button>)}
          <button onClick={()=>{onUpdate(book.id,{read:!book.read,readYear:!book.read?THIS_YEAR:null,readAt:!book.read?Date.now():null});onClose();}} style={{ flex:1,minWidth:'120px',background:book.read?'rgba(239,68,68,0.1)':'rgba(52,211,153,0.1)',color:book.read?'#f87171':'#34d399',border:`1px solid ${book.read?'rgba(239,68,68,0.3)':'rgba(52,211,153,0.3)'}`,borderRadius:'0.75rem',padding:'0.55rem',fontWeight:600,cursor:'pointer',fontSize:'0.78rem' }}>{book.read?'Mark Unread':'✓ Mark Read'}</button>
        </div>
      </div>
    </div>
  );
}

// ── ModalForm (With Gemini OCR & AI) ───────────────────────────────────────────
function ModalForm({ book, onSave, onSaveMany, onClose, tab, allSeries, allBooks }: {
  book: any; onSave: (b: any) => void; onSaveMany: (bs: any[]) => void; onClose: () => void; tab: string; allSeries: string[]; allBooks: any[];
}) {
  const [mode, setMode] = useState('single');
  const [shelfGenre, setShelfGenre] = useState('Romance');
  const [shelfStatus, setShelfStatus] = useState(tab==='home'?'shelf':tab);
  const [shelfRead, setShelfRead] = useState(false);
  const blank = { title:'',author:'',category:'Fiction',genre:'Fantasy',subgenre:'Romantasy',series:'',sn:'',read:false,status:tab==='home'?'shelf':tab,readAt:null,readYear:null,rating:null,note:'',rereads:[] };
  const [f, setF] = useState(book ? {...book,sn:book.sn??'',series:book.series??'',rating:book.rating??null,note:book.note??''} : blank);
  const [identifying, setId] = useState(false);
  const [idMsg, setIdMsg] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: any) => setF((p: any) => ({...p,[k]:v}));

  const handleCoverPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setId(true);
    setIdMsg('Identifying with Gemini…');

    try {
      const { b64, mime } = await processAndCompressImage(file);
      const res = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Identify the book in this cover image. Return ONLY a JSON object: {"title":"...","author":"..."}. If unknown return {"title":"","author":""}. Do not include markdown code block formatting.',
          image: { b64, mime }
        }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      const text = data.text || '';
      const match = text.match(/\{[\s\S]*\}/);

      if (match) {
        const p = JSON.parse(match[0]);
        if (p.title) { set('title', p.title); setIdMsg('✓ Book identified!'); }
        else setIdMsg("Couldn't identify — fill in manually.");
        if (p.author) set('author', p.author);
      } else {
        setIdMsg("Couldn't identify — fill in manually.");
      }
    } catch {
      setIdMsg("Couldn't identify — fill in manually.");
    }
    setId(false);
    setTimeout(() => setIdMsg(''), 3000);
  };

  const shelfInputRef = useRef<HTMLInputElement>(null);
  const [shelfImg, setShelfImg] = useState<string|null>(null);
  const [shelfB64, setShelfB64] = useState('');
  const [shelfMime, setShelfMime] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState('');
  const [scanned, setScanned] = useState<{title:string;author:string;selected:boolean}[]>([]);
  const [scanDone, setScanDone] = useState(false);

  const handleShelfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { b64, mime } = await processAndCompressImage(file);
      setShelfB64(b64);
      setShelfMime(mime);
      setShelfImg(URL.createObjectURL(file));
      setScanned([]);
      setScanErr('');
      setScanDone(false);
    } catch {
      setScanErr("Failed to process image format. Try another photo.");
    }
  };

  const runScan = async () => {
    if (!shelfB64) return;
    setScanning(true);
    setScanErr('');
    setScanned([]);

    try {
      const res = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Look at every single book spine visible in this bookshelf photo. Read each title and author carefully.\nReturn ONLY a raw JSON array of objects:\n[{"title":"Exact Title","author":"Author Name"},...]\n- Include every spine you can read\n- Use empty string for unknown author\n- Do not include markdown ticks.`,
          image: { b64: shelfB64, mime: shelfMime }
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      const rawText = data.text || '';

      const match = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!match) throw new Error("Could not parse book list from photo response.");

      const list = JSON.parse(match[0]);
      if (!Array.isArray(list)) throw new Error("Parsed result is not an array.");

      setScanned(list.map((b: any) => ({
        title: b.title || '',
        author: b.author || '',
        selected: true
      })));
    } catch (err: any) {
      setScanErr(err.message || "Couldn't read the shelf — try a clearer photo with good lighting.");
    }
    setScanning(false);
  };

  const submitSingle = () => {
    if (!f.title.trim()||!f.author.trim()) return;
    onSave({ ...f, sn:f.sn!==''?Number(f.sn):null, series:f.series||null, id:f.id||uid(),
      readAt: f.read&&!f.readAt ? Date.now() : f.readAt,
      readYear: f.read ? (f.readYear||THIS_YEAR) : null,
      rating: f.rating||null, note: f.note||'',
    });
  };

  const inp: React.CSSProperties = { width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.6rem',padding:'0.5rem 0.75rem',color:'white',fontSize:'0.85rem',boxSizing:'border-box' };

  return (
    <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)',padding:'1rem' }}>
      <div style={{ background:'#0e0b1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'1rem',padding:'1.5rem',width:'100%',maxWidth:'480px',maxHeight:'93vh',overflowY:'auto' }}>
        <h2 style={{ color:'white',fontWeight:'bold',marginBottom:'0.85rem',fontSize:'1.05rem' }}>{book?'Edit Book':'Add Book'}</h2>
        <div style={{ marginBottom:'0.65rem' }}>
          <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>Title</label>
          <input value={f.title} onChange={e=>set('title',e.target.value)} placeholder="Book title" style={inp}/>
        </div>
        <div style={{ marginBottom:'0.65rem' }}>
          <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>Author</label>
          <input value={f.author} onChange={e=>set('author',e.target.value)} placeholder="Author name" style={inp}/>
        </div>
        <div style={{ display:'flex',gap:'0.75rem',marginTop:'1rem' }}>
          <button onClick={submitSingle} style={{ flex:1,background:'#6d28d9',color:'white',border:'none',borderRadius:'0.75rem',padding:'0.6rem',fontWeight:'600',cursor:'pointer' }}>{book?'Save':'Add'}</button>
          <button onClick={onClose} style={{ flex:1,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.5)',border:'none',borderRadius:'0.75rem',padding:'0.6rem',cursor:'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── App Main Component ────────────────────────────────────────────────────────
export default function App() {
  const [books,       setBooks]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState('home');
  const [goals,       setGoals]       = useState<any>({ yearly:0, monthly:0, readProgress:null, monthProgress:null });
  const [user,        setUser]        = useState<any>(null);
  const [authReady,   setAuthReady]   = useState(false);
  const [search,      setSearch]      = useState('');
  const [fGenre,      setFGenre]      = useState('All');
  const [fSub,        setFSub]        = useState('All');
  const [fRead,       setFRead]       = useState('All');
  const [fSeries,     setFSeries]     = useState('All');
  const [sortBy,      setSortBy]      = useState<'title'|'author'|'dateAdded'|'series'>('title');
  const [modal,       setModal]       = useState<string|null>(null);
  const [editBook,    setEditBook]    = useState<any>(null);
  const [randomPick,  setRandomPick]  = useState<any[] | null>(null);
  const [detailBook,  setDetailBook]  = useState<any>(null);

  useEffect(() => {
    (async () => {
      const fbOk = await initFirebase();
      if (fbOk) {
        const unsub = _onAuthStateChanged(_auth, async (u: any) => {
          setUser(u); setAuthReady(true);
          if (u) {
            try {
              const snap = await _getDoc(_doc(_db, 'users', u.uid));
              if (snap.exists()) {
                const data = snap.data();
                setBooks(migrateBooks(data.books || []));
                if (data.goals) setGoals(data.goals);
              } else {
                setBooks(ALL_BOOKS);
              }
            } catch { setBooks(ALL_BOOKS); }
          } else {
            setBooks(ALL_BOOKS);
          }
          setLoading(false);
        });
        return () => unsub();
      } else {
        setBooks(ALL_BOOKS); setAuthReady(true); setLoading(false);
      }
    })();
  }, []);

  const tabBooks = useMemo(() => {
    if (tab === 'home') return [];
    if (tab === 'shelf') return books;
    return books.filter(b => b.status === tab);
  }, [books, tab]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tabBooks.filter((b: any) => {
      if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q) && !(b.series||'').toLowerCase().includes(q)) return false;
      if (fGenre !== 'All' && b.genre !== fGenre) return false;
      if (fSub !== 'All' && b.subgenre !== fSub) return false;
      if (tab === 'shelf' && fRead !== 'All' && (fRead === 'Read') !== b.read) return false;
      if (fSeries !== 'All' && b.series !== fSeries) return false;
      return true;
    });
  }, [tabBooks, search, fGenre, fSub, fRead, fSeries, tab]);

  // Surprise Me Handler: Picks 5 random unread books
  const pickRandom = useCallback(() => {
    const unreadBooks = books.filter((b: any) => !b.read);
    if (!unreadBooks.length) return;

    const shuffled = [...unreadBooks].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5);

    setRandomPick(selected);
  }, [books]);

  const update = (id: any, patch: any) => {
    const updated = books.map(b => b.id === id ? { ...b, ...patch } : b);
    setBooks(updated);
    if (user) saveToFirestore(user.uid, updated, goals);
  };

  if (!authReady || loading) return <div style={{ background:'#06040f',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#a78bfa' }}>Loading shelf…</div>;

  return (
    <div style={{ background:'#06040f',minHeight:'100vh',color:'white',fontFamily:'Georgia,serif' }}>
      {/* Header */}
      <div style={{ background:'#0d0a1c',borderBottom:'1px solid rgba(255,255,255,0.07)',position:'sticky',top:0,zIndex:40,padding:'0.8rem 1rem' }}>
        <div style={{ maxWidth:'960px',margin:'0 auto' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.6rem' }}>
            <div style={{ color:'#e8d9ff',fontWeight:'bold',fontSize:'1.1rem' }}>✦ My Shelf</div>
            <button onClick={() => setModal('add')} style={{ background:'#6d28d9',color:'white',border:'none',borderRadius:'0.75rem',padding:'0.45rem 0.9rem',fontWeight:'600',cursor:'pointer' }}>+ Add</button>
          </div>
          {/* Tabs */}
          <div style={{ display:'flex',gap:'0.3rem' }}>
            {Object.entries(TAB_CFG).map(([k,cfg]) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex:1,padding:'0.4rem 0.2rem',borderRadius:'0.65rem',border:`1px solid ${tab===k?cfg.color:'rgba(255,255,255,0.08)'}`,background:tab===k?cfg.color+'22':'transparent',color:tab===k?cfg.color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:'0.65rem' }}>
                {cfg.label}
              </button>
            ))}
          </div>
          {/* Surprise Me Button in TBR Tab */}
          {tab === 'tbr' && (
            <div style={{ marginTop:'0.5rem',display:'flex',gap:'0.5rem',alignItems:'center' }}>
              <button onClick={pickRandom} style={{ fontSize:'0.72rem',padding:'0.3rem 0.8rem',borderRadius:'9999px',border:'1px solid rgba(251,146,60,0.5)',background:'rgba(251,146,60,0.15)',color:'#fb923c',cursor:'pointer',fontWeight:600 }}>
                🎲 Surprise me
              </button>
              <span style={{ fontSize:'0.7rem',color:'rgba(255,255,255,0.3)' }}>{filtered.length} shown</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth:'960px',margin:'0 auto',padding:'1rem' }}>
        {tab !== 'home' && (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'0.75rem' }}>
            {filtered.map((b: any) => (
              <div key={b.id} style={{ background:'rgba(255,255,255,0.03)',borderRadius:'1rem',border:'1px solid rgba(255,255,255,0.1)',padding:'0.875rem' }}>
                <div style={{ fontWeight:'bold',fontSize:'0.9rem' }}>{b.title}</div>
                <div style={{ fontSize:'0.78rem',color:'#a78bfa' }}>{b.author}</div>
                {b.series && <div style={{ fontSize:'0.7rem',color:'rgba(255,255,255,0.3)' }}>{b.series} #{b.sn}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {detailBook && <BookDetailModal book={detailBook} onClose={() => setDetailBook(null)} onUpdate={update} onReread={() => {}}/>}
      {modal === 'add' && <ModalForm book={null} tab={tab} allSeries={[]} allBooks={books} onSave={(b) => setBooks([...books, b])} onSaveMany={(bs) => setBooks([...books, ...bs])} onClose={() => setModal(null)}/>}

      {/* Surprise Me Modal - 5 Unread Picks */}
      {randomPick && randomPick.length > 0 && (
        <div style={{ position:'fixed',inset:0,zIndex:70,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)',padding:'1rem' }}>
          <div style={{ background:'#0e0b1a',border:'1px solid rgba(251,146,60,0.4)',borderRadius:'1.2rem',padding:'1.5rem',width:'100%',maxWidth:'460px',maxHeight:'85vh',overflowY:'auto' }}>
            
            <div style={{ textAlign:'center',marginBottom:'1rem' }}>
              <div style={{ fontSize:'2.2rem',lineHeight:1,marginBottom:'0.3rem' }}>🎲</div>
              <div style={{ fontSize:'1rem',fontWeight:'bold',color:'white' }}>Your 5 Surprise Reads</div>
              <div style={{ fontSize:'0.72rem',color:'rgba(255,255,255,0.4)',marginTop:'0.2rem' }}>Selected at random from your unread collection</div>
            </div>

            {/* List of 5 Books */}
            <div style={{ display:'flex',flexDirection:'column',gap:'0.55rem',marginBottom:'1.25rem' }}>
              {randomPick.map((b: any, idx: number) => {
                const cfg = GENRE_CFG[b.genre] || GENRE_CFG['Fantasy'];
                return (
                  <div 
                    key={b.id || idx} 
                    onClick={() => { setRandomPick(null); setDetailBook(b); }}
                    style={{ background:'rgba(255,255,255,0.03)',borderRadius:'0.75rem',borderLeft:`3px solid ${cfg.accent}`,padding:'0.65rem 0.85rem',textAlign:'left',cursor:'pointer',transition:'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  >
                    <div style={{ fontSize:'0.85rem',fontWeight:'bold',color:'white',marginBottom:'0.15rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                      {idx + 1}. {b.title}
                    </div>
                    <div style={{ fontSize:'0.72rem',color:cfg.accent + 'cc' }}>{b.author}</div>
                    {b.series && (
                      <div style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.3)',marginTop:'0.15rem' }}>
                        {b.series}{b.sn != null ? ` #${b.sn}` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div style={{ display:'flex',gap:'0.75rem' }}>
              <button onClick={pickRandom} style={{ flex:1,background:'rgba(251,146,60,0.18)',color:'#fb923c',border:'1px solid rgba(251,146,60,0.4)',borderRadius:'0.75rem',padding:'0.65rem',cursor:'pointer',fontWeight:600,fontSize:'0.82rem' }}>
                Reshuffle 🎲
              </button>
              <button onClick={() => setRandomPick(null)} style={{ flex:1,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.5)',border:'none',borderRadius:'0.75rem',padding:'0.65rem',cursor:'pointer',fontSize:'0.82rem' }}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
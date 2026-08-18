import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

// ── Firebase Singletons ──────────────────────────────────────────────────────
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
  console.warn('Firebase init skipped or restricted:', e);
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

// ── Config ────────────────────────────────────────────────────────────────────
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
  insights: { label: '📊 Insights', color: '#c084fc' },
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const generateUid = () => Math.floor(Date.now() + Math.random() * 100000);

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
const r = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Romance', subgenre: sg, series: sr, sn });
const m = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Mystery/Thriller', subgenre: sg, series: sr, sn });
const h = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Horror', subgenre: sg, series: sr, sn });
const co = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Contemporary', subgenre: sg, series: sr, sn });
const cl = (id: number, t: string, a: string, sg: string) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Classics', subgenre: sg, series: null, sn: null });
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

// ── Seed Library Data ────────────────────────────────────────────────────────
const SEED: Book[] = [
  fa(1,'The Awakening','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',1),
  fa(2,'Ruthless Fae','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',2),
  fa(3,'The Reckoning','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',3),
  fa(4,'Shadow Princess','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',4),
  fa(5,'Cursed Fates','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',5),
  fa(6,'Fated Throne','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',6),
  fa(7,'Heartless Sky','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',7),
  fa(8,'Sorrow and Starlight','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',8),
  fa(9,'Beyond the Veil','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',8.5),
  fa(10,'Restless Stars','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',9),
  fa(11,'The Big Ass Party','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',5.5),
  fa(12,'Caraval','Stephanie Garber','YA Fantasy','Caraval',1),
  fa(13,'Legendary','Stephanie Garber','YA Fantasy','Caraval',2),
  fa(14,'Finale','Stephanie Garber','YA Fantasy','Caraval',3),
  fa(15,'Alchemy of Secrets','Stephanie Garber','YA Fantasy',null,null),
  m(16,'The Inheritance Games','Jennifer Lynn Barnes','YA Mystery','The Inheritance Games',1),
  m(17,'The Hawthorne Legacy','Jennifer Lynn Barnes','YA Mystery','The Inheritance Games',2),
  m(18,'The Final Gambit','Jennifer Lynn Barnes','YA Mystery','The Inheritance Games',3),
  m(19,'Games Untold','Jennifer Lynn Barnes','YA Mystery','The Inheritance Games',4),
  m(20,'The Brothers Hawthorne','Jennifer Lynn Barnes','YA Mystery','The Inheritance Games',5),
  m(21,'The Naturals','Jennifer Lynn Barnes','YA Mystery','The Naturals',1),
  m(22,'Stalking Jack the Ripper','Kerri Maniscalco','Historical Mystery','Stalking Jack the Ripper',1),
  m(23,'Escaping from Houdini','Kerri Maniscalco','Historical Mystery','Stalking Jack the Ripper',2),
  m(24,'Hunting Prince Dracula','Kerri Maniscalco','Historical Mystery','Stalking Jack the Ripper',3),
  m(25,'Capturing the Devil','Kerri Maniscalco','Historical Mystery','Stalking Jack the Ripper',4),
  fa(26,'Kingdom of the Wicked','Kerri Maniscalco','Dark Fantasy','Kingdom of the Wicked',1),
  fa(27,'Kingdom of the Cursed','Kerri Maniscalco','Dark Fantasy','Kingdom of the Wicked',2),
  fa(28,'Kingdom of the Feared','Kerri Maniscalco','Dark Fantasy','Kingdom of the Wicked',3),
  fa(29,'Throne of the Fallen','Kerri Maniscalco','Dark Fantasy','Throne of the Fallen',1),
  fa(30,'Throne of Secrets','Kerri Maniscalco','Dark Fantasy','Throne of the Fallen',2),
  fa(31,'Divine Rivals','Rebecca Ross','YA Fantasy','Letters of Enchantment',1),
  fa(32,'Ruthless Vows','Rebecca Ross','YA Fantasy','Letters of Enchantment',2),
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
  fa(92,'A Darker Shade of Magic','V.E. Schwab','High Fantasy','Shades of Magic',1),
  fa(49,'A Gathering of Shadows','V.E. Schwab','High Fantasy','Shades of Magic',2),
  fa(50,'A Conjuring of Light','V.E. Schwab','High Fantasy','Shades of Magic',3),
  fa(91,'The Fragile Threads of Power','V.E. Schwab','High Fantasy','Shades of Magic',4),
  fa(90,'Vicious','V.E. Schwab','Dark Fantasy','Villains',1),
  fa(51,'Gallant','V.E. Schwab','Dark Fantasy',null,null),
  fa(52,'City of Bones','Cassandra Clare','Urban Fantasy','The Mortal Instruments',1),
  fa(53,'City of Ashes','Cassandra Clare','Urban Fantasy','The Mortal Instruments',2),
  fa(54,'City of Glass','Cassandra Clare','Urban Fantasy','The Mortal Instruments',3),
  fa(55,'City of Fallen Angels','Cassandra Clare','Urban Fantasy','The Mortal Instruments',4),
  fa(56,'City of Lost Souls','Cassandra Clare','Urban Fantasy','The Mortal Instruments',5),
  fa(57,'City of Heavenly Fire','Cassandra Clare','Urban Fantasy','The Mortal Instruments',6),
  rt(93,'From Blood and Ash','Jennifer L. Armentrout','Blood and Ash',1),
  rt(94,'A Kingdom of Flesh and Fire','Jennifer L. Armentrout','Blood and Ash',2),
  rt(95,'The Crown of Gilded Bones','Jennifer L. Armentrout','Blood and Ash',3),
  rt(96,'The War of Two Queens','Jennifer L. Armentrout','Blood and Ash',4),
  rt(97,'A Soul of Ash and Blood','Jennifer L. Armentrout','Blood and Ash',5),
  rt(98,'The Primal of Blood and Bone','Jennifer L. Armentrout','Blood and Ash',6),
  rt(99,'A Shadow in the Ember','Jennifer L. Armentrout','Flesh and Fire',1),
  rt(100,'A Light in the Flame','Jennifer L. Armentrout','Flesh and Fire',2),
  rt(101,'A Fire in the Flesh','Jennifer L. Armentrout','Flesh and Fire',3),
  fa(442,'Obsidian','Jennifer L. Armentrout','Paranormal Romance','Lux',1),
  fa(443,'Onyx','Jennifer L. Armentrout','Paranormal Romance','Lux',2),
  fa(444,'Opal','Jennifer L. Armentrout','Paranormal Romance','Lux',3),
  rt(58,'Shield of Sparrows','Devney Perry',null,null),
  rt(59,'The Hurricane Wars','Thea Guanzon','The Hurricane Wars',1),
  fa(60,'A Tempest of Tea','Hafsah Faizal','YA Fantasy','Blood and Tea',1),
  fa(61,'Sweet Nightmare','Tracy Wolff','Dark Fantasy',null,null),
  rt(63,'The Serpent and the Wolf','Rebecca Robinson',null,null),
  fa(64,'House of Blight','Mayen R. Martineau','Dark Fantasy',null,null),
  fa(65,'Daughter of No Worlds','Carissa Broadbent','Dark Fantasy','War of Lost Hearts',1),
  fa(66,'Mother of Death & Dawn','Carissa Broadbent','Dark Fantasy','War of Lost Hearts',3),
  fa(67,'I Will Not Let Them Take Me','Unknown','Dark Fantasy',null,null),
  fa(68,'The Wrath of the Fallen','Amber V. Nicole','Dark Fantasy','Gods & Monsters',4),
  rt(69,'Behooved','M. Stevenson',null,null),
  fa(70,'Heat of Everflame','Penn Cole','High Fantasy','Forging of Light',3),
  rt(71,'When the Moon Hatched','Sarah A. Parker','The Moonfall Series',1),
  fa(102,'Chaos & Flame','Tessa Gratton & Justina Ireland','YA Fantasy','Chaos & Flame',1),
  fa(103,'Blood & Fury','Tessa Gratton & Justina Ireland','YA Fantasy','Chaos & Flame',2),
  fa(104,'The Prison Healer','Lynette Noni','YA Fantasy','The Prison Healer',1),
  fa(105,'The Blood Traitor','Lynette Noni','YA Fantasy','The Prison Healer',3),
  fa(106,'The Nightblood Prince','Molly X. Chang','YA Fantasy',null,null),
  fa(107,'A Forgery of Fate','Elizabeth Lim','Historical Fantasy',null,null),
  fa(109,'A Forbidden Alchemy','Stacey McEwan','Dark Fantasy',null,null),
  fa(111,'Hush, Hush','Becca Fitzpatrick','Paranormal Romance','Hush Hush',1),
  fa(160,'A Theory of Dreaming','Ava Reid','YA Fantasy','A Study in Drowning',2),
  fa(161,'Dawn of the Firebird','Sarah Mughal Rana','YA Fantasy',null,null),
  fa(162,'Coldwire','Chloe Gong','YA Fantasy',null,null),
  rt(163,'Thorn Season','Kiera Azar',null,null),
  fa(164,'Fallen City','Adrienne Young','YA Fantasy',null,null),
  fa(165,'Seven Deadly Thorns','Amber Hamilton','Dark Fantasy',null,null),
  rt(166,'Alchemised','Senlinyu',null,null),
  fa(167,'A River Enchanted','Rebecca Ross','Historical Fantasy','Elements of Cadence',1),
  fa(168,'A Fire Endless','Rebecca Ross','Historical Fantasy','Elements of Cadence',2),
  fa(169,'Twin Crowns','C.Doyle & K.Webber','YA Fantasy','Twin Crowns',1),
  fa(170,'Cursed Crowns','C.Doyle & K.Webber','YA Fantasy','Twin Crowns',2),
  fa(171,'Everless','Sara Holland','YA Fantasy','Everless',1),
  fa(172,'Evermore','Sara Holland','YA Fantasy','Everless',2),
  fa(176,'The Rogue King','Abigail Owen','Paranormal Romance','Inferno Rising',1),
  fa(177,'The Warrior King','Abigail Owen','Paranormal Romance','Inferno Rising',2),
  fa(178,'The Blood King','Abigail Owen','Paranormal Romance','Inferno Rising',3),
  fa(179,'The Cursed King','Abigail Owen','Paranormal Romance','Inferno Rising',4),
  fa(180,'A Touch of Ruin','Scarlett St. Clair','Mythology Romance','Hades x Persephone',2),
  fa(181,'A Touch of Malice','Scarlett St. Clair','Mythology Romance','Hades x Persephone',3),
  fa(182,'A Touch of Chaos','Scarlett St. Clair','Mythology Romance','Hades x Persephone',4),
  fa(183,'A Game of Retribution','Scarlett St. Clair','Mythology Romance','Hades Saga',2),
  fa(184,'A Game of Gods','Scarlett St. Clair','Mythology Romance','Hades Saga',3),
  fa(186,'House of Salt and Sorrows','Erin A. Craig','Dark Fantasy','Sisters of the Salt',1),
  fa(187,'House of Roots and Ruin','Erin A. Craig','Dark Fantasy','Sisters of the Salt',2),
  fa(188,'Small Favors','Erin A. Craig','Dark Fantasy',null,null),
  fa(328,'The Thirteenth Child','Erin A. Craig','Dark Fantasy',null,null),
  rt(190,'Inadequate Heir','Bridget E. Baker',null,null),
  fa(198,'Twilight','Stephenie Meyer','Paranormal Romance','Twilight Saga',1),
  fa(199,'New Moon','Stephenie Meyer','Paranormal Romance','Twilight Saga',2),
  fa(200,'Eclipse','Stephenie Meyer','Paranormal Romance','Twilight Saga',3),
  fa(201,'Breaking Dawn','Stephenie Meyer','Paranormal Romance','Twilight Saga',4),
  fa(202,'Midnight Sun','Stephenie Meyer','Paranormal Romance','Twilight Saga',5),
  fa(222,'The Lightning Thief','Rick Riordan','YA Fantasy','Percy Jackson',1),
  fa(223,'The Sea of Monsters','Rick Riordan','YA Fantasy','Percy Jackson',2),
  fa(224,"The Titan's Curse",'Rick Riordan','YA Fantasy','Percy Jackson',3),
  fa(225,'The Battle of the Labyrinth','Rick Riordan','YA Fantasy','Percy Jackson',4),
  fa(226,'The Last Olympian','Rick Riordan','YA Fantasy','Percy Jackson',5),
  fa(227,'The Chalice of the Gods','Rick Riordan','YA Fantasy','Percy Jackson',6),
  fa(228,'The Lost Hero','Rick Riordan','YA Fantasy','Heroes of Olympus',1),
  fa(229,'The Son of Neptune','Rick Riordan','YA Fantasy','Heroes of Olympus',2),
  fa(230,'The Mark of Athena','Rick Riordan','YA Fantasy','Heroes of Olympus',3),
  fa(231,'The House of Hades','Rick Riordan','YA Fantasy','Heroes of Olympus',4),
  fa(232,'The Blood of Olympus','Rick Riordan','YA Fantasy','Heroes of Olympus',5),
  fa(233,'The Red Pyramid','Rick Riordan','YA Fantasy','Kane Chronicles',1),
  fa(234,'The Throne of Fire','Rick Riordan','YA Fantasy','Kane Chronicles',2),
  fa(235,"The Serpent's Shadow",'Rick Riordan','YA Fantasy','Kane Chronicles',3),
  fa(236,'Shatter Me','Tahereh Mafi','YA Fantasy','Shatter Me',1),
  fa(237,'Unravel Me','Tahereh Mafi','YA Fantasy','Shatter Me',2),
  fa(238,'Unite Me','Tahereh Mafi','YA Fantasy','Shatter Me',2.5),
  fa(239,'Ignite Me','Tahereh Mafi','YA Fantasy','Shatter Me',3),
  fa(240,'Restore Me','Tahereh Mafi','YA Fantasy','Shatter Me',4),
  fa(241,'Defy Me','Tahereh Mafi','YA Fantasy','Shatter Me',5),
  fa(242,'Find Me','Tahereh Mafi','YA Fantasy','Shatter Me',5.5),
  fa(243,'Imagine Me','Tahereh Mafi','YA Fantasy','Shatter Me',6),
  fa(244,'Believe Me','Tahereh Mafi','YA Fantasy','Shatter Me',6.5),
  fa(245,'Watch Me','Tahereh Mafi','YA Fantasy','Shatter Me',null),
  fa(246,'This Woven Kingdom','Tahereh Mafi','YA Fantasy','This Woven Kingdom',1),
  fa(247,'These Infinite Threads','Tahereh Mafi','YA Fantasy','This Woven Kingdom',2),
  fa(248,'All This Twisted Glory','Tahereh Mafi','YA Fantasy','This Woven Kingdom',3),
  fa(249,'Lightlark','Alex Aster','YA Fantasy','Lightlark',1),
  fa(250,'Nightbane','Alex Aster','YA Fantasy','Lightlark',2),
  fa(251,'Skyshade','Alex Aster','YA Fantasy','Lightlark',3),
  fa(253,'Anatomy: A Love Story','Dana Schwartz','Historical Fantasy','Anatomy Duology',1),
  fa(254,'Immortality: A Love Story','Dana Schwartz','Historical Fantasy','Anatomy Duology',2),
  fa(255,'To Kill a Shadow','Katherine Quinn','Dark Fantasy','Kingdom of Lies',1),
  fa(256,'To Shatter the Night','Katherine Quinn','Dark Fantasy','Kingdom of Lies',2),
  fa(257,'Powerless','Lauren Roberts','YA Fantasy','Powerless',1),
  fa(258,'Reckless','Lauren Roberts','YA Fantasy','Powerless',2),
  fa(259,'Powerful','Lauren Roberts','YA Fantasy','Powerless',0.5),
  fa(260,'Heartless Hunter','Kristen Ciccarelli','Dark Fantasy','Crimson Moth',1),
  fa(261,'Rebel Witch','Kristen Ciccarelli','Dark Fantasy','Crimson Moth',2),
  fa(262,'Serpent & the Wings of Night','Carissa Broadbent','Dark Fantasy','Crowns of Nyaxia',1),
  fa(263,'Ashes & the Star-Cursed King','Carissa Broadbent','Dark Fantasy','Crowns of Nyaxia',2),
  fa(264,'Songbird & the Heart of Stone','Carissa Broadbent','Dark Fantasy','Crowns of Nyaxia',3),
  fa(265,'The Fallen & the Kiss of Dusk','Carissa Broadbent','Dark Fantasy','Crowns of Nyaxia',null),
  fa(266,'Daughter of the Pirate King','Tricia Levenseller','YA Fantasy','Daughter of the Pirate King',1),
  fa(267,'Daughter of the Siren Queen','Tricia Levenseller','YA Fantasy','Daughter of the Pirate King',2),
  fa(268,'Vengeance of the Pirate Queen','Tricia Levenseller','YA Fantasy','Daughter of the Pirate King',3),
  fa(269,'Belladonna','Adalyn Grace','Dark Fantasy','Belladonna',1),
  fa(574,'Foxglove','Adalyn Grace','Dark Fantasy','Belladonna',2),
  fa(270,'Wisteria','Adalyn Grace','Dark Fantasy','Belladonna',3),
  fa(159,'Holly','Adalyn Grace','Dark Fantasy','Belladonna',3.5),
  fa(306,'The Phoenix King','Aparna Verma','High Fantasy','The Ravence Trilogy',1),
  fa(317,'Ninth House','Leigh Bardugo','Dark Fantasy','Alex Stern',1),
  fa(318,'Hell Bent','Leigh Bardugo','Dark Fantasy','Alex Stern',2),
  fa(319,'Shadow and Bone','Leigh Bardugo','YA Fantasy','Shadow and Bone Trilogy',1),
  fa(320,'Siege and Storm','Leigh Bardugo','YA Fantasy','Shadow and Bone Trilogy',2),
  fa(321,'Ruin and Rising','Leigh Bardugo','YA Fantasy','Shadow and Bone Trilogy',3),
  fa(322,'Gild','Raven Kennedy','Mythology Romance','The Plated Prisoner',1),
  fa(323,'Glint','Raven Kennedy','Mythology Romance','The Plated Prisoner',2),
  fa(324,'Gleam','Raven Kennedy','Mythology Romance','The Plated Prisoner',3),
  fa(325,'Glow','Raven Kennedy','Mythology Romance','The Plated Prisoner',4),
  fa(326,'The Wolves of Ruin','Raven Kennedy','Mythology Romance','The Plated Prisoner',null),
  rt(327,'Dire Bound','Sable Sorensen',null,null),
  rt(330,'Assistant to the Villain','Hannah Nicole Maehren','The Villain',1),
  rt(331,'Apprentice to the Villain','Hannah Nicole Maehren','The Villain',2),
  rt(332,'Accomplice to the Villain','Hannah Nicole Maehren','The Villain',3),
  fa(333,'Broken Bonds','J. Bree','Paranormal Romance',null,null),
  fa(334,'In the Veins of the Drowning','Kalie Cassidy','Dark Fantasy',null,null),
  fa(335,'Book of Night','Holly Black','Dark Fantasy',null,null),
  fa(336,"The Prisoner's Throne",'Holly Black','YA Fantasy','The Stolen Heir Duology',2),
  fa(337,'The Stolen Heir','Holly Black','YA Fantasy','The Stolen Heir Duology',1),
  fa(338,'How the King of Elfhame Learned to Hate Stories','Holly Black','YA Fantasy','The Folk of the Air',null),
  fa(339,'The Cruel Prince','Holly Black','YA Fantasy','The Folk of the Air',1),
  fa(340,'The Wicked King','Holly Black','YA Fantasy','The Folk of the Air',2),
  fa(341,'The Queen of Nothing','Holly Black','YA Fantasy','The Folk of the Air',3),
  fa(342,'Rhapsodic','Laura Thalassa','Mythology Romance','The Bargainer',1),
  fa(343,'A Strange Hymn','Laura Thalassa','Mythology Romance','The Bargainer',2),
  fa(344,'The Emperor of Evening Stars','Laura Thalassa','Mythology Romance','The Bargainer',3),
  fa(345,'Dark Harmony','Laura Thalassa','Mythology Romance','The Bargainer',4),
  fa(353,"Harry Potter and the Philosopher's Stone",'J.K. Rowling','YA Fantasy','Harry Potter',1),
  fa(354,'Harry Potter and the Chamber of Secrets','J.K. Rowling','YA Fantasy','Harry Potter',2),
  fa(355,'Harry Potter and the Prisoner of Azkaban','J.K. Rowling','YA Fantasy','Harry Potter',3),
  fa(356,'Harry Potter and the Goblet of Fire','J.K. Rowling','YA Fantasy','Harry Potter',4),
  fa(357,'Harry Potter and the Order of the Phoenix','J.K. Rowling','YA Fantasy','Harry Potter',5),
  fa(358,'Harry Potter and the Half-Blood Prince','J.K. Rowling','YA Fantasy','Harry Potter',6),
  fa(359,'Harry Potter and the Deathly Hallows','J.K. Rowling','YA Fantasy','Harry Potter',7),
  rt(437,'Rule of the Aurora King','Nisha J. Tuli','Artefacts of Ouranos',1),
  rt(438,'Vow of the Shadow King','Nisha J. Tuli','Artefacts of Ouranos',2),
  rt(155,'Fate of the Sun King','Nisha J. Tuli','Artefacts of Ouranos',3),
  rt(156,'Tale of the Heart Queen','Nisha J. Tuli','Artefacts of Ouranos',4),
  fa(439,'Five Broken Blades','Mai Corland','High Fantasy','Five Broken Blades',1),
  fa(440,'Four Ruined Realms','Mai Corland','High Fantasy','Five Broken Blades',2),
  fa(441,'Three Stolen Oaths','Mai Corland','High Fantasy','Five Broken Blades',3),
  rt(434,'A Dawn of Onyx','Kate Golden','Sacred Stones',1),
  rt(435,'A Promise of Peridot','Kate Golden','Sacred Stones',2),
  rt(436,'Metal Signer','Rachel Schneider',null,null),
  h(72,'House of Hollow','Krystal Sutherland','Dark Fiction',null,null),
  h(119,'Tourist Season','Brynne Weaver','Horror Comedy','Seasons of Carnage',1),
  h(120,'Butcher & Blackbird','Brynne Weaver','Dark Fiction','The Ruinous Love Trilogy',1),
  h(121,'Leather & Lark','Brynne Weaver','Dark Fiction','The Ruinous Love Trilogy',2),
  h(122,'Scythe & Sparrow','Brynne Weaver','Dark Fiction','The Ruinous Love Trilogy',3),
  h(123,'Her Soul to Take','Harley Laroux','Dark Fiction','Soul Cauldron',1),
  h(124,'Her Soul for Revenge','Harley Laroux','Dark Fiction','Soul Cauldron',2),
  h(312,'Gothikana','RuNyx','Gothic Horror',null,null),
  m(75,'Finlay Donovan is Killing It','Elle Cosimano','Cozy Mystery','Finlay Donovan',1),
  m(76,'Finlay Donovan Knocks Em Dead','Elle Cosimano','Cozy Mystery','Finlay Donovan',2),
  m(77,'Finlay Donovan Jumps the Gun','Elle Cosimano','Cozy Mystery','Finlay Donovan',3),
  m(78,'Finlay Donovan Rolls the Dice','Elle Cosimano','Cozy Mystery','Finlay Donovan',4),
  m(86,'Arsenic and Adobo','Mia P. Manansala','Cozy Mystery','Tita Rosies Kitchen Mystery',1),
  m(87,'Homicide and Halo-Halo','Mia P. Manansala','Cozy Mystery','Tita Rosies Kitchen Mystery',2),
  m(88,'Blackmail and Bibingka','Mia P. Manansala','Cozy Mystery','Tita Rosies Kitchen Mystery',3),
  m(89,'Murder and Mamon','Mia P. Manansala','Cozy Mystery','Tita Rosies Kitchen Mystery',4),
  m(191,'Angels & Demons','Dan Brown','Conspiracy Thriller','Robert Langdon',1),
  m(192,'The Da Vinci Code','Dan Brown','Conspiracy Thriller','Robert Langdon',2),
  m(193,'The Lost Symbol','Dan Brown','Conspiracy Thriller','Robert Langdon',3),
  m(194,'Inferno','Dan Brown','Conspiracy Thriller','Robert Langdon',4),
  m(195,'Origin','Dan Brown','Conspiracy Thriller','Robert Langdon',5),
  m(196,'Deception Point','Dan Brown','Thriller',null,null),
  m(197,'Digital Fortress','Dan Brown','Thriller',null,null),
  m(203,'Gone Girl','Gillian Flynn','Thriller',null,null),
  m(204,'The Witness','Sandra Brown','Thriller',null,null),
  m(275,'Verity','Colleen Hoover','Thriller',null,null),
  m(313,'Silence and Shadows','Beaty','Thriller',null,null),
  m(126,'The Mindfck Series','S.T. Abby','Dark Thriller','The Mindfck Series',null),
  cl(205,'Dracula','Bram Stoker','Gothic Classic'),
  cl(206,'The Phantom of the Opera','Gaston Leroux','Gothic Classic'),
  cl(207,'Animal Farm','George Orwell','British Lit'),
  cl(208,'Pride and Prejudice','Jane Austen','British Lit'),
  cl(209,'Anna Karenina','Leo Tolstoy','Russian Lit'),
  cl(210,'The Picture of Dorian Gray','Oscar Wilde','British Lit'),
  cl(211,'The Jungle Book','Rudyard Kipling','British Lit'),
  cl(212,"Grimm's Fairy Tales",'J.L.C. & W.C. Grimm','Fairy Tales'),
  cl(214,'A Christmas Carol','Charles Dickens','British Lit'),
  cl(215,'Crime and Punishment','Fyodor Dostoevsky','Russian Lit'),
  cl(216,'Great Expectations','Charles Dickens','British Lit'),
  cl(217,'Frankenstein','Mary Shelley','Gothic Classic'),
  cl(218,'For Whom the Bell Tolls','Ernest Hemingway','American Lit'),
  co(112,'Legends & Lattes','Travis Baldree','Cozy Fiction',null,null),
  co(329,'Bookshops & Bonedust','Travis Baldree','Cozy Fiction',null,null),
  co(173,'The Wedding Witch','Erin Sterling','Cozy Fiction','Graves Glen',null),
  co(274,'It Ends With Us','Colleen Hoover','Contemporary Fiction',null,null),
  co(276,'Me Before You','Jojo Moyes','Contemporary Fiction','Me Before You',1),
  co(280,'Normal People','Sally Rooney','Literary Fiction',null,null),
  co(281,'The Fault in Our Stars','John Green','Contemporary Fiction',null,null),
  co(282,'The Party Crasher','Sophie Kinsella','Chick Lit',null,null),
  co(298,"To All the Boys I've Loved Before",'Jenny Han','New Adult','To All the Boys',1),
  co(299,'P.S. I Still Love You','Jenny Han','New Adult','To All the Boys',2),
  co(300,'Always and Forever, Lara Jean','Jenny Han','New Adult','To All the Boys',3),
  co(301,'Lessons in Chemistry','Bonnie Garmus','Literary Fiction',null,null),
  co(308,'The Perks of Being a Wallflower','Stephen Chbosky','Contemporary Fiction',null,null),
  co(315,'A Brief History of Living Forever','Jaroslav Kalfar','Literary Fiction',null,null),
  r(79,'Neon Gods','Katee Robert','Dark Romance','Dark Olympus',1),
  r(80,'Electric Idol','Katee Robert','Dark Romance','Dark Olympus',2),
  r(81,'Cruel Seduction','Katee Robert','Dark Romance','Dark Olympus',3),
  r(82,'Radiant Sin','Katee Robert','Dark Romance','Dark Olympus',4),
  r(83,'Wicked Beauty','Katee Robert','Dark Romance','Dark Olympus',5),
  r(84,'Midnight Ruin','Katee Robert','Dark Romance','Dark Olympus',6),
  r(85,'Dark Restraint','Katee Robert','Dark Romance','Dark Olympus',7),
  r(62,'House of Rayne','Harley Laroux','Dark Romance',null,null),
  r(108,'Anathema','Keri Lake','Dark Romance',null,null),
  r(118,'The Predator','RUNYX','Dark Romance',null,null),
  r(125,'Highest Bidder','L.Landish & W.Winters','Dark Romance',null,null),
  r(127,'The Sweetest Obsession','Danielle Lori','Dark Romance','The Made',null),
  r(128,'The Darkest Temptation','Danielle Lori','Dark Romance','The Made',null),
  r(129,'Lights Out','Navessa Allen','Dark Romance',null,null),
  r(130,'Caught Up','Navessa Allen','Dark Romance',null,null),
  r(131,"The Mercenary's Mortician",'Alexandra St. Pierre','Dark Romance',null,null),
  r(132,'Hooked','Emily McIntire','Dark Romance','Never After',1),
  r(133,'Scarred','Emily McIntire','Dark Romance','Never After',2),
  r(134,'Wretched','Emily McIntire','Dark Romance','Never After',3),
  r(135,'Twisted','Emily McIntire','Dark Romance','Never After',4),
  r(136,'Crossed','Emily McIntire','Dark Romance','Never After',5),
  r(137,'Hexed','Emily McIntire','Dark Romance','Never After',6),
  r(138,'Vow of Revenge','P. Rayne','Dark Romance','Mafia Marriages',1),
  r(139,"The Mafia King's Sister",'P. Rayne','Dark Romance','Mafia Marriages',2),
  r(140,'Craving My Rival','P. Rayne','Dark Romance','Mafia Marriages',3),
  r(141,'Nightfall','Penelope Douglas','Dark Romance',"Devil's Night",4),
  r(142,'Credence','Penelope Douglas','Dark Romance',null,null),
  r(143,'Pen Pal','J.T. Geissinger','Contemporary Romance',null,null),
  r(144,'Brutal Vows','J.T. Geissinger','Dark Romance','Queens & Monsters',1),
  r(145,'Savage Hearts','J.T. Geissinger','Dark Romance','Queens & Monsters',2),
  r(146,'Haunting Adeline','H.D. Carlton','Dark Romance','Cat and Mouse',1),
  r(147,'Hunting Adeline','H.D. Carlton','Dark Romance','Cat and Mouse',2),
  r(148,'Does It Hurt','H.D. Carlton','Dark Romance',null,null),
  r(149,'The Initiation','Nikki Sloane','Dark Romance',null,null),
  r(150,'Insatiable','Leigh Rivers','Dark Romance','Edge of Darkness',1),
  r(151,'Priest','Sierra Simone','Dark Romance','New Camelot',1),
  r(152,'That Sik Luv','Jescie Hall','Dark Romance',null,null),
  r(185,'Promises & Pomegranates','Sav R. Miller','Dark Romance','Monsters & Muses',1),
  r(189,'Beautiful Villain','Rebecca Kenney','Dark Romance',null,null),
  r(305,'American Queen','Sierra Simone','Dark Romance','New Camelot',1),
  r(346,'Pestilence','Laura Thalassa','Dark Romance','The Four Horsemen',1),
  r(347,'Famine','Laura Thalassa','Dark Romance','The Four Horsemen',2),
  r(348,'War','Laura Thalassa','Dark Romance','The Four Horsemen',3),
  r(349,'Death','Laura Thalassa','Dark Romance','The Four Horsemen',4),
  r(350,'Bewitched','Laura Thalassa','Dark Romance','Bewitched',1),
  r(351,'Bespelled','Laura Thalassa','Dark Romance','Bewitched',2),
  r(352,'The Curse That Binds','Laura Thalassa','Dark Romance','Bewitched',3),
  r(73,'Love Wager','Lynn Painter','Contemporary Romance',null,null),
  r(74,'Mr. Wrong Number','Lynn Painter','Contemporary Romance','Wrong Number',1),
  r(113,'Pucking Strong','Emily Rath','Sports Romance',null,null),
  r(114,'Fake Skating','Lynn Painter','Sports Romance',null,null),
  r(115,'The Christmas Fix','Lucy Score','Holiday Romance',null,null),
  r(116,'Something Wilder','Christina Lauren','Contemporary Romance',null,null),
  r(117,'A Heart for Christmas','Sophie Jomain','Holiday Romance',null,null),
  r(174,'Hot Hex Boyfriend','Carly Bloom','Contemporary Romance',null,null),
  r(175,'Happy Medium','Sarah Adler','Contemporary Romance',null,null),
  r(252,'Summer in the City','Alex Aster','Contemporary Romance',null,null),
  r(277,'Better Than the Movies','Lynn Painter','Contemporary Romance','Better Than the Movies',1),
  r(278,'Nothing Like the Movies','Lynn Painter','Contemporary Romance','Better Than the Movies',2),
  r(279,'The Do-Over','Lynn Painter','Contemporary Romance',null,null),
  r(283,'Pucking Sweet','Emily Rath','Sports Romance',null,null),
  r(284,'Pucking Around','Emily Rath','Sports Romance',null,null),
  r(285,'Flock','Kate Stewart','Contemporary Romance','The Ravenhood',1),
  r(286,'Exodus','Kate Stewart','Contemporary Romance','The Ravenhood',2),
  r(287,'The Finish Line','Kate Stewart','Contemporary Romance','The Ravenhood',3),
  r(288,'A Long Time Coming','Meghan Quinn','Contemporary Romance',null,null),
  r(289,'So Not Meant to Be','Meghan Quinn','Contemporary Romance',null,null),
  r(290,'A Not So Meet Cute','Meghan Quinn','Contemporary Romance',null,null),
  r(291,'Unsteady','Peyton Corinne','New Adult Romance',null,null),
  r(292,'Unloved','Peyton Corinne','New Adult Romance',null,null),
  r(293,'All Rhodes Lead Here','Mariana Zapata','Contemporary Romance',null,null),
  r(294,'It Happened One Christmas','Hannah Bonam-Young','Holiday Romance',null,null),
  r(295,'Fifty Shades of Grey','E.L. James','Contemporary Romance','Fifty Shades',1),
  r(296,'Fifty Shades Darker','E.L. James','Contemporary Romance','Fifty Shades',2),
  r(297,'Fifty Shades Freed','E.L. James','Contemporary Romance','Fifty Shades',3),
  r(302,'The Trouble with Dating Lexi','Madyn Rose','Contemporary Romance',null,null),
  r(303,'The Enchanted Hacienda','J.C. Cervantes','Contemporary Romance',null,null),
  r(314,'The Striker','Unknown','Sports Romance',null,null),
  r(316,'Ruling Destiny','Alyson Noel','Contemporary Romance',null,null),
  r(271,'Twisted Games','Ana Huang','Contemporary Romance','Twisted',2),
  r(272,'Twisted Hate','Ana Huang','Contemporary Romance','Twisted',3),
  r(273,'Twisted Lies','Ana Huang','Contemporary Romance','Twisted',4),
  r(360,'King of Wrath','Ana Huang','Contemporary Romance','Kings of Sin',1),
  r(361,'King of Pride','Ana Huang','Contemporary Romance','Kings of Sin',2),
  r(362,'King of Greed','Ana Huang','Contemporary Romance','Kings of Sin',3),
  r(363,'King of Sloth','Ana Huang','Contemporary Romance','Kings of Sin',4),
  r(364,'King of Envy','Ana Huang','Contemporary Romance','Kings of Sin',5),
  r(365,'If We Ever Meet Again','Ana Huang','Contemporary Romance','Dirty Air',1),
  r(366,'If the Sun Never Sets','Ana Huang','Contemporary Romance','Dirty Air',2),
  r(367,'If Love Had a Price','Ana Huang','Contemporary Romance','Dirty Air',3),
  r(368,'If We Were Perfect','Ana Huang','Contemporary Romance','Dirty Air',4),
  r(369,'Binding 13','Chloe Walsh','New Adult Romance','Boys of Tommen',1),
  r(370,'Keeping 13','Chloe Walsh','New Adult Romance','Boys of Tommen',2),
  r(371,'Saving 6','Chloe Walsh','New Adult Romance','Boys of Tommen',3),
  r(372,'Redeeming 6','Chloe Walsh','New Adult Romance','Boys of Tommen',4),
  r(373,'Losing 6','Chloe Walsh','New Adult Romance','Boys of Tommen',5),
  r(374,'Releasing 10','Chloe Walsh','New Adult Romance','Boys of Tommen',6),
  r(375,'The Deal','Elle Kennedy','College Romance','Off Campus',1),
  r(376,'The Mistake','Elle Kennedy','College Romance','Off Campus',2),
  r(377,'The Score','Elle Kennedy','College Romance','Off Campus',3),
  r(378,'The Goal','Elle Kennedy','College Romance','Off Campus',4),
  r(379,'The Legacy','Elle Kennedy','College Romance','Off Campus',5),
  r(380,'The Chase','Elle Kennedy','College Romance','Briar U',1),
  r(381,'The Risk','Elle Kennedy','College Romance','Briar U',2),
  r(382,'The Play','Elle Kennedy','College Romance','Briar U',3),
  r(383,'The Date','Elle Kennedy','College Romance','Briar U',4),
  r(384,'The Graham Effect','Elle Kennedy','Sports Romance',null,null),
  r(385,'The Dixon Rule','Elle Kennedy','Sports Romance',null,null),
  r(386,'The Charlie Method','Elle Kennedy','Sports Romance',null,null),
  r(387,'Mile High','Liz Tomforde','Sports Romance','Windy City',1),
  r(388,'The Right Move','Liz Tomforde','Sports Romance','Windy City',2),
  r(389,'Caught Up','Liz Tomforde','Sports Romance','Windy City',3),
  r(390,'Play Along','Liz Tomforde','Sports Romance','Windy City',4),
  r(391,'Rewind It Back','Liz Tomforde','Sports Romance','Windy City',5),
  r(392,'Garrett & Hannah','Liz Tomforde','Sports Romance',null,null),
  r(393,'Mr. Charming','Piper Rayne','Contemporary Romance','Whoever Next Door',1),
  r(394,'Mr. Swoony','Piper Rayne','Contemporary Romance','Whoever Next Door',2),
  r(395,'Mr. Broody','Piper Rayne','Contemporary Romance','Whoever Next Door',3),
  r(396,'Mr. Heartbreaker','Piper Rayne','Contemporary Romance','Whoever Next Door',4),
  r(397,"The One I Didn't Expect",'Piper Rayne','Contemporary Romance','Whoever Next Door',5),
  r(398,'The One I Stole Beside','Piper Rayne','Contemporary Romance','Whoever Next Door',6),
  r(399,'Flawless','Elsie Silver','Contemporary Romance','Chestnut Springs',1),
  r(400,'Heartless','Elsie Silver','Contemporary Romance','Chestnut Springs',2),
  r(401,'Powerless','Elsie Silver','Contemporary Romance','Chestnut Springs',3),
  r(402,'Reckless','Elsie Silver','Contemporary Romance','Chestnut Springs',4),
  r(403,'Hopeless','Elsie Silver','Contemporary Romance','Chestnut Springs',5),
  r(404,'Wild Love','Elsie Silver','Contemporary Romance','Rose Hill',1),
  r(405,'Wild Eyes','Elsie Silver','Contemporary Romance','Rose Hill',2),
  r(406,'Wild Side','Elsie Silver','Contemporary Romance','Rose Hill',3),
  r(407,'Wild Card','Elsie Silver','Contemporary Romance','Rose Hill',4),
  r(433,'Off to the Races','Elsie Silver','Contemporary Romance',null,null),
  r(408,'Consider Me','Becka Mack','Sports Romance','Playing for Keeps',1),
  r(409,'Unravel Me','Becka Mack','Sports Romance','Playing for Keeps',2),
  r(410,'Play With Me','Becka Mack','Sports Romance','Playing for Keeps',3),
  r(411,'Fall With Me','Becka Mack','Sports Romance','Playing for Keeps',4),
  r(412,'Indigo Ridge','Devney Perry','Contemporary Romance','Edens',1),
  r(413,'Juniper Hill','Devney Perry','Contemporary Romance','Edens',2),
  r(414,'Whiskey Business','K.A. Tucker','Contemporary Romance',null,null),
  r(415,'The Simple Wild','K.A. Tucker','Contemporary Romance','Wild',1),
  r(416,'Pretty Reckless','Penelope Douglas','New Adult Romance','All Saints High',1),
  r(417,'Broken Knight','Penelope Douglas','New Adult Romance','All Saints High',2),
  r(418,'Angry God','Penelope Douglas','New Adult Romance','All Saints High',3),
  r(419,'Damaged Goods','Penelope Douglas','New Adult Romance','All Saints High',4),
  r(420,'The Love Hypothesis','Ali Hazelwood','Contemporary Romance',null,null),
  r(421,'Love on the Brain','Ali Hazelwood','Contemporary Romance',null,null),
  r(422,'Love, Theoretically','Ali Hazelwood','Contemporary Romance',null,null),
  r(423,'Loathe to Love You','Ali Hazelwood','Contemporary Romance',null,null),
  r(424,'Deep End','Unknown','Contemporary Romance',null,null),
  r(425,'It Happened in a Heartbeat','Unknown','Contemporary Romance',null,null),
  r(426,'Hook, Line, and Sinker','Tessa Bailey','Contemporary Romance',null,null),
  r(427,'Secretly Yours','Helena Hunting','Contemporary Romance',null,null),
  r(428,'Unfortunately Yours','Tessa Bailey','Contemporary Romance',null,null),
  r(429,'Things We Never Got','Unknown','Contemporary Romance',null,null),
  r(430,'Things We Hide from the Fire','Unknown','Contemporary Romance',null,null),
  r(431,'Things We Left','Unknown','Contemporary Romance',null,null),
  r(432,'Dishonestly Yours','Krista & Becca Ritchie','Contemporary Romance',null,null),
  nf(307,'The Glass Castle','Jeannette Walls','Memoir'),
  nf(309,'The Present Age','Soren Kierkegaard','Philosophy'),
  nf(310,'Kind of Coping','Unknown','Self-Help'),
  nf(311,'Prime Nihongo','Masatomi Shigo','Language Learning'),
  r(445,'Secretly Married','Trrevistenglimmer','Contemporary Romance',null,null),
  r(446,'Baka Sakali','Jonaxx','Contemporary Romance','Jonaxx War Series',1),
  r(447,'Mapansin Kaya?','Jonaxx','Contemporary Romance','Jonaxx War Series',2),
  r(448,'End This War','Jonaxx','Contemporary Romance','Jonaxx War Series',3),
  r(449,'My Prince (Books 1 & 2)','Alyloony','Contemporary Romance','My Prince',null),
  r(450,'Voiceless','HaveYouSeenThisGirL','Contemporary Romance','Voiceless',1),
  r(451,'Voiceless 2','HaveYouSeenThisGirL','Contemporary Romance','Voiceless',2),
  r(452,'Love Me Harder','Jamille Fuma','Contemporary Romance',null,null),
  r(453,'Spending the Night with the Ellison Heir','Jonquil','Contemporary Romance','Heir Series',1),
  r(454,'In Love with the Campus Heir','Jonquil','Contemporary Romance','Heir Series',2),
  r(455,'Treize de Cordova','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',1),
  r(456,'Randolf Emmanuel Fontanilla','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',2),
  r(457,'Juanito "Yeoji" Buenzalido','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',3),
  r(458,'Denniz Terrano','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',4),
  r(459,'Zech Marquez','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',5),
  r(460,'Lantis Nakago','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',6),
  r(461,'Silva Arellano','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',7),
  r(462,'Vincent Noblejas','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',8),
  r(463,'Vash Ilustre','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',9),
  r(464,'Rex Zagdameo','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',10),
  r(465,'Ken Arboleda','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',11),
  r(466,'Rath Zagdameo','Sonia Francesca','Contemporary Romance','The Billionaire Boys Club',12),
  r(467,'Toxic','Shana Del Viejo','Contemporary Romance',null,null),
  r(468,'My Not-So Secret Fiancé','Autumn Castillo','Contemporary Romance',null,null),
  r(469,"Creed's Lover",'C.C.','Dark Romance',null,null),
  r(470,"The Devil's Kiss",'Martha Cecilia','Contemporary Romance','K Series',1),
  r(471,'Ang Sisiw at ang Agila','Martha Cecilia','Contemporary Romance','K Series',2),
  r(472,'Dahil Ikaw','Martha Cecilia','Contemporary Romance','K Series',3),
  r(473,'Jewel, Black Diamond','Martha Cecilia','Contemporary Romance','K Series',4),
  r(474,'The Rain in España','4Reuminct','Contemporary Romance','University Series',1),
  r(475,'Safe Skies, Archer','4Reuminct','Contemporary Romance','University Series',2),
  r(476,'Chasing in the Wild','4Reuminct','Contemporary Romance','University Series',3),
  r(477,'Avenues of the Diamond','4Reuminct','Contemporary Romance','University Series',4),
  r(478,'Play the Queen','AkosiIbarra','Contemporary Romance',null,null),
  co(479,'Montello High: School of Gangsters','SielAlstreim','Contemporary Fiction','Montello High Saga',1),
  co(480,'Snow White is a Gangster','SielAlstreim','Contemporary Fiction','Montello High Saga',2),
  co(481,'Dark Fairy Tale','SielAlstreim','Contemporary Fiction','Montello High Saga',3),
  r(482,'Marrying Mr. Popular','Chrispepper','Contemporary Romance',null,null),
  r(483,'Unwanted Marriage','OwwSIC','Contemporary Romance',null,null),
  r(484,"Let's Talk About Us",'Marielicious','New Adult Romance',null,null),
  r(485,'The Sixth String','Purplena','Contemporary Romance',null,null),
  r(486,'Apple Snap','Crestfallenmoon','Contemporary Romance',null,null),
  r(487,'Bridal Shower','Soju','Contemporary Romance',null,null),
  r(488,'My Naughty Love','Mizrian49','Contemporary Romance',null,null),
  r(489,'Wild and Wrangled','Lyla Sage','Contemporary Romance','Dusty Boots',null),
  r(490,'Body Check','Elle Kennedy','Sports Romance',null,null),
  r(491,'Good Girl Complex','Elle Kennedy','Contemporary Romance','Avalon Bay',1),
  r(492,'Bad Girl Reputation','Elle Kennedy','Contemporary Romance','Avalon Bay',2),
  r(493,'The Summer Girl','Elle Kennedy','Contemporary Romance','Avalon Bay',3),
  r(494,'Say You Swear','Meagan Brandy','Contemporary Romance',null,null),
  fa(495,'The Book of Azrael','Amber V. Nicole','Dark Fantasy','Gods & Monsters',1),
  fa(496,'Bury Our Bones in the Midnight Soil','V.E. Schwab','Dark Fantasy',null,null),
  fa(497,'For She is Wrath','Emily Varga','Dark Fantasy',null,null),
  fa(498,'The Gods Below','Andrea Stewart','High Fantasy','The Hollow Covenant',1),
  co(499,'The Seven Husbands of Evelyn Hugo','Taylor Jenkins Reid','Literary Fiction',null,null),
  fa(500,'Immortal','Sue Lynn Tan','High Fantasy',null,null),
  fa(501,'Heir of Storms','Lauryn Hamilton Murray','High Fantasy',null,null),
  fa(502,'The God and the Gumiho','Sophie Kim','YA Fantasy',null,null),
  fa(503,'The Girl With No Reflection','Keshe Chow','YA Fantasy',null,null),
  fa(504,'The Teller of Small Fortunes','Julie Leong','High Fantasy',null,null),
  fa(505,"The Swan's Daughter",'Roshani Chokshi','YA Fantasy',null,null),
  fa(506,'Long Live Evil','Sarah Rees Brennan','Dark Fantasy',null,null),
  fa(507,'The Dagger and the Flame','Catherine Doyle','Dark Fantasy','The City of Fantome',1),
  fa(508,'Immortal Dark','Tigest Girma','Dark Fantasy',null,null),
  m(509,'The Last One','Rachel Howzell Hall','Thriller',null,null),
  fa(510,'Hollow','C. Peckham & S. Valenti','Paranormal Romance','Crown of Hearts & Chaos',1),
  fa(511,'Never Keep','C. Peckham & S. Valenti','Paranormal Romance','Sins of the Zodiac',1),
  fa(512,'Filthy Rich Fae','Geneva Lee','Dark Romantasy','Filthy Rich Fae',null),
  fa(513,'Filthy Rich Vampire','Geneva Lee','Dark Romantasy','Filthy Rich Vampires',1),
  fa(514,'Godkiller','Hannah Kaner','High Fantasy','Fallen Gods',1),
  fa(515,'The Gilded Crown','Marianne Gordon','High Fantasy',null,null),
  fa(516,'House of Bone and Blood','Alexis L. Menard','Dark Fantasy',null,null),
  fa(517,'Never the Roses','Jennifer K. Lambert','Dark Fantasy',null,null),
  fa(518,'North is the Night','Emily Rath','Dark Fantasy',null,null),
  fa(519,'Nightweaver','R.M. Gray','Dark Fantasy',null,null),
  fa(520,'The Cursed','Harper L. Woods','Dark Fantasy','The Coven',1),
  fa(521,'The Coven','Harper L. Woods','Dark Fantasy','The Coven',2),
  fa(522,'Heir','Sabaa Tahir','High Fantasy',null,null),
  fa(523,'The Night Ends with Fire','K.X. Song','High Fantasy',null,null),
  fa(524,'The Night Is Defying','Chloe C. Penaranda','Dark Fantasy','Night Is Series',1),
  fa(525,'The Stars Are Dying','Chloe C. Penaranda','Dark Fantasy','Night Is Series',2),
  fa(526,'The Courting of Bristol Keats','Mary E. Pearson','High Fantasy',null,null),
  fa(527,'This Monster of Mine','Shalini Abeysekara','YA Fantasy',null,null),
  fa(528,'Where Shadows Meet','Patrice Caldwell','YA Fantasy',null,null),
  fa(529,'The Scorpion and the Night Blossom','Amélie Wen Zhao','Historical Fantasy',null,null),
  fa(530,'Between Two Kings','Lindsay Straube','Dark Fantasy','Poison Beauties',1),
  fa(531,'Kiss of the Basilisk','Lindsay Straube','Dark Fantasy','Poison Beauties',2),
  fa(532,'The Ex Hex','Erin Sterling','Contemporary Romance','Graves Glen',1),
  fa(533,"Barbarian's Mate",'Ruby Dixon','Paranormal Romance','Ice Planet Barbarians',null),
  r(534,'Court of the Vampire Queen','Katee Robert','Dark Romance',null,null),
  r(535,'Dowry of Blood','S.T. Gibson','Dark Romance',null,null),
  r(536,"A Demon's Guide to Wooing a Witch",'Sarah Hawley','Contemporary Romance',null,null),
  r(537,'What the Hex','Jessica Clare','Contemporary Romance',null,null),
  r(538,'Check & Mate','Ali Hazelwood','Contemporary Romance',null,null),
  r(539,'Deep End','Ali Hazelwood','Contemporary Romance',null,null),
  r(540,'It Happened One Summer','Tessa Bailey','Contemporary Romance','Bellinger Sisters',1),
  r(541,'Secretly Yours','Tessa Bailey','Contemporary Romance',null,null),
  r(542,'Things We Never Got Over','Lucy Score','Contemporary Romance','Knockemout',1),
  r(543,'Things We Hide from the Light','Lucy Score','Contemporary Romance','Knockemout',2),
  r(544,'Things We Left Behind','Lucy Score','Contemporary Romance','Knockemout',3),
  r(545,'Chasing Hardlee','Madyn Rose','Contemporary Romance',null,null),
  r(546,'Done and Dusted','Lyla Sage','Contemporary Romance','Dusty Boots',1),
  r(547,'Swift and Saddled','Lyla Sage','Contemporary Romance','Dusty Boots',2),
  r(548,'Lost and Lassoed','Lyla Sage','Contemporary Romance','Dusty Boots',3),
  r(549,'The American Roommate Experiment','Elena Armas','Contemporary Romance',null,null),
  r(550,'Love and Other Flight Delays','Denise Williams','Contemporary Romance',null,null),
  r(551,'Not Another Love Song','Julie Soto','Contemporary Romance',null,null),
  r(552,'The Fine Print','Lauren Asher','Contemporary Romance','Bandini Brothers',1),
  r(553,'Terms and Conditions','Lauren Asher','Contemporary Romance','Bandini Brothers',2),
  r(554,'Final Offer','Lauren Asher','Contemporary Romance','Bandini Brothers',3),
  r(555,'Love Redesigned','Lauren Asher','Contemporary Romance',null,null),
  r(556,'Love Unwritten','Lauren Asher','Contemporary Romance',null,null),
  r(557,'Throttled','Lauren Asher','Sports Romance','Dirty Air',1),
  r(558,'The Happy Ever After Playlist','Abby Jimenez','Contemporary Romance',null,null),
  r(559,'The Friend Zone','Abby Jimenez','Contemporary Romance',null,null),
  r(560,'Next-Door Nemesis','Alexa Martin','Contemporary Romance',null,null),
  r(561,'Mr. Fixer Upper','Lucy Score','Contemporary Romance',null,null),
  r(562,"Archer's Voice",'Mia Sheridan','Contemporary Romance',null,null),
  r(563,'Same Time Next Summer','Annabel Monaghan','Contemporary Romance',null,null),
  r(564,'The Breakup Tour','E. Wibberley & A. Siegemund-Broka','Contemporary Romance',null,null),
  r(565,'Summer Reading','Jenn McKinlay','Contemporary Romance',null,null),
  r(566,'Collide','Bal Khabra','Sports Romance',null,null),
  r(567,'Canadian Boyfriend','Jenny Holiday','Contemporary Romance',null,null),
  r(568,'Love Your Life','Sophie Kinsella','Contemporary Romance',null,null),
  r(569,'Pretty Reckless','L.J. Shen','New Adult Romance','All Saints',1),
  r(570,'Broken Knight','L.J. Shen','New Adult Romance','All Saints',2),
  r(571,'Angry God','L.J. Shen','New Adult Romance','All Saints',3),
  r(572,'Damaged Goods','L.J. Shen','New Adult Romance','All Saints',4),
  r(573,'Psyche and Eros','Luna McNamara','Contemporary Romance',null,null),
  fa(575,'The Invisible Life of Addie LaRue','V.E. Schwab','Dark Fantasy',null,null),
  r(576,'Tweet Cute','Emma Lord','Contemporary Romance',null,null),
  r(577,'Love & Other Words','Christina Lauren','Contemporary Romance',null,null),
  r(578,'Book Lovers','Emily Henry','Contemporary Romance',null,null),
  r(579,'If I Stopped Haunting You','Colby Wilkens','Contemporary Romance',null,null),
  r(580,'Twisted Knight','K. Bromberg','Contemporary Romance',null,null),
  r(581,"Life's Too Short",'K. Bromberg','Contemporary Romance',null,null),
  r(582,'The Dead Romantics','Ashley Poston','Contemporary Romance',null,null),
  r(583,'Grey','E.L. James','Contemporary Romance','Fifty Shades',null),
  r(584,'Cross My Heart','Roxy Sloane','Contemporary Romance',null,null),
  r(585,'That Prince is Mine','Jacy Lee','Contemporary Romance',null,null),
  r(586,'The Long Game','Elena Armas','Contemporary Romance',null,null),
  r(587,'The Spanish Love Deception','Elena Armas','Contemporary Romance',null,null),
  r(588,'The Seven Year Slip','Ashley Poston','Contemporary Romance',null,null),
  r(589,'Icebreaker','Hannah Grace','Sports Romance','Maple Hills',1),
  r(590,'Wildfire','Hannah Grace','Sports Romance','Maple Hills',2),
  r(591,'Daydream','Hannah Grace','Sports Romance','Maple Hills',3),
  r(592,'Sanctuary of the Shadow','Aurora Ascher','Dark Romance',null,null),
  r(593,'Heavenbreaker','Sara Wolf','Dark Romance',null,null),
  fa(594,'The Shadows Between Us','Tricia Levenseller','YA Fantasy',null,null),
  fa(595,'The Robin on the Oak Throne','K.A. Linde','Dark Fantasy','Wren & Robin',1),
  fa(596,'The Wren in the Holly Library','K.A. Linde','Dark Fantasy','Wren & Robin',2),
  fa(597,'The Monster and the Last Blood Match','K.A. Linde','Dark Fantasy',null,null),
  fa(598,'Blood of Hercules','Jasmine Mas','Dark Fantasy','Villains of Lore',1),
  fa(599,'Bonds of Hercules','Jasmine Mas','Dark Fantasy','Villains of Lore',2),
  fa(600,'The Games Gods Play','Abigail Owen','Paranormal Romance',null,null),
  fa(601,'Three Shattered Souls','Mai Corland','High Fantasy','Five Broken Blades',null),
  fa(602,'The Bond That Burns','Briar Boleyn','Dark Fantasy',null,null),
  fa(603,'On Wings of Blood','Briar Boleyn','Dark Fantasy',null,null),
  fa(604,'The Things Gods Break','Abigail Owen','Paranormal Romance',null,null),
  fa(605,'A Dance of Lies','Brittney Arena','YA Fantasy',null,null),
  fa(606,'Sorcery and Small Magics','Maiga Doocy','YA Fantasy',null,null),
  fa(607,'Graceless Heart','Isabel Ibanez','YA Fantasy',null,null),
  fa(608,'A Song to Drown Rivers','Ann Liang','Historical Fantasy',null,null),
  fa(609,'Firebird','Juliette Cross','Dark Fantasy',null,null),
  rt(610,'Immortal Consequences','I.V. Marie',null,null),
  cl(611,'The Long Valley','John Steinbeck','American Lit'),
  cl(612,'The Screwtape Letters','C.S. Lewis','British Lit'),
  fa(613,'The Knight and the Moth','Rachel Gillig','Dark Fantasy',null,null),
  fa(614,'Never Ever After','Sue Lynn Tan','High Fantasy',null,null),
  fa(615,'The Rose Bargain','Sasha Peyton Smith','YA Fantasy',null,null),
  fa(616,'The Floating World','Axie Oh','YA Fantasy',null,null),
  fa(617,'Katabasis','R.F. Kuang','Historical Fantasy',null,null),
  fa(618,'A Language of Dragons','S.F. Williamson','YA Fantasy',null,null),
  fa(619,'Sleep Like Death','Kalynn Bayron','YA Fantasy',null,null),
  r(620,'Nocticadia','Keri Lake','Dark Romance',null,null),
  fa(621,'The Glittering Edge','Alyssa Villaire','Dark Fantasy',null,null),
  fa(622,'Gifted & Talented','Olivie Blake','Dark Fantasy',null,null),
  fa(623,'Cruel is the Light','Sophie Clark','YA Fantasy',null,null),
  fa(624,'The Never List','Jade Presley','Dark Fantasy',null,null),
  fa(625,'The Half King','Melissa Landers','YA Fantasy',null,null),
  fa(626,'For Whom the Belle Tolls','Jaysea Lynn','Dark Fantasy',null,null),
  fa(627,'The Darkness Within Us','Tricia Levenseller','YA Fantasy',null,null),
  r(628,'Rose in Chains','Julie Soto','Contemporary Romance',null,null),
  r(629,'Repeat After Me','Jessica Warman','Contemporary Romance',null,null),
  fa(630,'One Dark Window','Rachel Gillig','Dark Fantasy','The Shepherd King',1),
  fa(631,'Two Twisted Crowns','Rachel Gillig','Dark Fantasy','The Shepherd King',2),
  nf(632,'On the Origins and History of Consciousness','Erich Neumann','Philosophy'),
  rt(633,'Grim and Oro: Dueling Crowns Edition','Alex Aster','Lightlark',null),
  fa(634,'Taken to the Fae','Jesse Elliott','Dark Fantasy',null,null),
  rt(635,'The Wingless King','K.C. Wayssem',null,null),
  fa(636,'The Ever King','LJ Andrews','Dark Fantasy','The Ever King',1),
  fa(637,'The Ever Queen','LJ Andrews','Dark Fantasy','The Ever King',2),
  fa(638,'Phantasma','Kaylie Smith','Dark Fantasy',null,null),
  fa(639,'Enchantry','Kaylie Smith','Dark Fantasy',null,null),
  rt(640,'Quicksilver','Callie Hart','Fae & Alchemy',1),
  rt(641,'Brimstone','Callie Hart','Fae & Alchemy',2),
  co(642,'The Spellshop','Sarah Henning','Cozy Fiction',null,null),
  co(643,'The Enchanted Greenhouse','Unknown','Cozy Fiction',null,null),
  fa(644,'A Study in Drowning','Ava Reid','YA Fantasy','A Study in Drowning',1),
  rt(645,'A Court of Thorns and Roses','Sarah J. Maas','A Court of Thorns and Roses',1),
  rt(646,'A Court of Mist and Fury','Sarah J. Maas','A Court of Thorns and Roses',2),
  rt(647,'A Court of Wings and Ruin','Sarah J. Maas','A Court of Thorns and Roses',3),
  rt(648,'A Court of Frost and Starlight','Sarah J. Maas','A Court of Thorns and Roses',3.5),
  rt(649,'A Court of Silver Flames','Sarah J. Maas','A Court of Thorns and Roses',4),
  rt(650,'House of Earth and Blood','Sarah J. Maas','Crescent City',1),
  rt(651,'House of Sky and Breath','Sarah J. Maas','Crescent City',2),
  rt(652,'House of Flame and Shadow','Sarah J. Maas','Crescent City',3),
  fa(653,'Spark of the Everflame','Penn Cole','High Fantasy','Forging of Light',1),
  fa(654,'Glow of Everflame','Penn Cole','High Fantasy','Forging of Light',2),
  fa(656,'An Ember in the Ashes','Sabaa Tahir','High Fantasy','An Ember in the Ashes',1),
  fa(657,'A Torch Against the Night','Sabaa Tahir','High Fantasy','An Ember in the Ashes',2),
  fa(658,'A Reaper at the Gates','Sabaa Tahir','High Fantasy','An Ember in the Ashes',3),
  fa(659,'A Sky Beyond the Storm','Sabaa Tahir','High Fantasy','An Ember in the Ashes',4),
  fa(660,'Crescendo','Becca Fitzpatrick','Paranormal Romance','Hush Hush',2),
  fa(661,'Silence','Becca Fitzpatrick','Paranormal Romance','Hush Hush',3),
  fa(662,'Finale','Becca Fitzpatrick','Paranormal Romance','Hush Hush',4),
  fa(663,'Empire of the Vampire','Jay Kristoff','Dark Fantasy','Empire of the Vampire',1),
  fa(664,'Empire of the Damned','Jay Kristoff','Dark Fantasy','Empire of the Vampire',2),
  fa(665,'Forging Silver into Stars','Brigid Kemmerer','YA Fantasy','Forging Silver into Stars',1),
  fa(666,'Carving Shadows into Gold','Brigid Kemmerer','YA Fantasy','Forging Silver into Stars',2),
  fa(667,'A Broken Blade','Melissa Blair','Dark Fantasy','The Halfling series',1),
  fa(668,'A Vicious Game','Melissa Blair','Dark Fantasy','The Halfling series',3),
  fa(669,'An Honored Vow','Melissa Blair','Dark Fantasy','The Halfling series',4),
  r(671,'Brutal Prince','Sophie Lark','Dark Romance','Brutal Birthright',1),
  r(672,'Stolen Heir','Sophie Lark','Dark Romance','Brutal Birthright',2),
  r(673,'Savage Lover','Sophie Lark','Dark Romance','Brutal Birthright',3),
  r(674,'Bloody Heart','Sophie Lark','Dark Romance','Brutal Birthright',4),
  r(675,'Broken Vow','Sophie Lark','Dark Romance','Brutal Birthright',5),
  r(676,'Heavy Crown','Sophie Lark','Dark Romance','Brutal Birthright',6),
  r(677,'There Are No Saints','Sophie Lark','Dark Romance','Sinners Duet',1),
  r(678,'There Is No Devil','Sophie Lark','Dark Romance','Sinners Duet',2),
  fa(679,'Sword Catcher','Cassandra Clare','High Fantasy','Sword Catcher',1),
  fa(680,'What Lies Beyond the Veil','Harper L. Woods','Dark Fantasy','Of Flesh & Bone',1),
  fa(681,'What Hunts Inside the Shadows','Harper L. Woods','Dark Fantasy','Of Flesh & Bone',2),
  fa(682,'What Lurks Between the Fates','Harper L. Woods','Dark Fantasy','Of Flesh & Bone',3),
  fa(683,'What Sleeps Within the Cove','Harper L. Woods','Dark Fantasy','Of Flesh & Bone',4),
  fa(684,'The Final Empire','Brandon Sanderson','High Fantasy','Mistborn',1),
  fa(685,'The Well of Ascension','Brandon Sanderson','High Fantasy','Mistborn',2),
  fa(686,'The Hero of Ages','Brandon Sanderson','High Fantasy','Mistborn',3),
  cl(687,'The Metamorphosis','Franz Kafka','German Lit'),
  cl(688,'The Trial','Franz Kafka','German Lit'),
  cl(689,'The Castle','Franz Kafka','German Lit'),
  cl(690,'Amerika','Franz Kafka','German Lit'),
  cl(691,'In the Penal Colony and Other Short Stories','Franz Kafka','German Lit'),
  fa(692,'Crave','Tracy Wolff','Paranormal Romance','Crave',1),
  fa(693,'Crush','Tracy Wolff','Paranormal Romance','Crave',2),
  fa(694,'Covet','Tracy Wolff','Paranormal Romance','Crave',3),
  fa(695,'Court','Tracy Wolff','Paranormal Romance','Crave',4),
  fa(696,'Charm','Tracy Wolff','Paranormal Romance','Crave',5),
  fa(697,'Cherish','Tracy Wolff','Paranormal Romance','Crave',6),
  nf(698,'12 Rules for Life','Jordan B. Peterson','Self-Help'),
  nf(699,'Beyond Order','Jordan B. Peterson','Self-Help'),
  fa(700,'Once Upon a Broken Heart','Stephanie Garber','YA Fantasy','Once Upon a Broken Heart',1),
  fa(701,'The Ballad of Never After','Stephanie Garber','YA Fantasy','Once Upon a Broken Heart',2),
  fa(702,'A Curse for True Love','Stephanie Garber','YA Fantasy','Once Upon a Broken Heart',3),
  fa(703,'Red Queen','Victoria Aveyard','YA Fantasy','Red Queen',1),
  fa(704,'Glass Sword','Victoria Aveyard','YA Fantasy','Red Queen',2),
  fa(705,"King's Cage",'Victoria Aveyard','YA Fantasy','Red Queen',3),
  fa(706,'War Storm','Victoria Aveyard','YA Fantasy','Red Queen',4),
  fa(707,'Broken Throne','Victoria Aveyard','YA Fantasy','Red Queen',4.5),
  m(708,"A Good Girl's Guide to Murder",'Holly Jackson','YA Mystery',"A Good Girl's Guide to Murder",1),
  m(709,'Good Girl, Bad Blood','Holly Jackson','YA Mystery',"A Good Girl's Guide to Murder",2),
  m(710,'As Good as Dead','Holly Jackson','YA Mystery',"A Good Girl's Guide to Murder",3),
  m(711,'The Housemaid','Freida McFadden','Thriller','The Housemaid',1),
  m(712,"The Housemaid's Secret",'Freida McFadden','Thriller','The Housemaid',2),
  m(713,"The Housemaid's Husband",'Freida McFadden','Thriller','The Housemaid',3),
  r(714,'Out on a Limb','Hannah Bonam-Young','Contemporary Romance',null,null),
  nf(715,'Tao Te Ching','Lao Tzu (trans. Stephen Mitchell)','Philosophy'),
  nf(716,'Meditations','Marcus Aurelius','Philosophy'),
  nf(717,'The Psychology of Love','Sigmund Freud','Philosophy'),
  nf(718,'The Uncanny','Sigmund Freud','Philosophy'),
  nf(719,'The Undiscovered Self','C.G. Jung','Philosophy'),
  nf(720,'The Story of Philosophy','Will Durant','Philosophy'),
  nf(721,'The Cosmic Serpent','Jeremy Narby','Philosophy'),
  nf(722,'Cosmic Consciousness','Richard Maurice Bucke','Philosophy'),
  nf(723,'Greek Philosophy','Walter Kaufmann','Philosophy'),
  nf(724,'Existentialism: From Dostoevsky to Sartre','Walter Kaufmann','Philosophy'),
  nf(725,'The Essential Schopenhauer','Arthur Schopenhauer','Philosophy'),
  nf(726,'The Birth of Tragedy and The Genealogy of Morals','Friedrich Nietzsche','Philosophy'),
  nf(727,'Basic Writings of Nietzsche','Friedrich Nietzsche','Philosophy'),
  nf(728,'On Truth and Untruth','Friedrich Nietzsche','Philosophy'),
  nf(729,'Thus Spoke Zarathustra','Friedrich Nietzsche','Philosophy'),
  nf(730,'Works of Love','Søren Kierkegaard','Philosophy'),
  nf(731,'The Last Superstition','Edward Feser','Philosophy'),
  nf(732,'Capital Volume I','Karl Marx','Philosophy'),
  nf(733,'The Communist Manifesto','Karl Marx & Friedrich Engels','Philosophy'),
  nf(734,'Lenin in Zurich','Aleksandr Solzhenitsyn','Memoir'),
  nf(735,'Designing Your Life','Bill Burnett & Dave Evans','Self-Help'),
  nf(736,'When','Daniel H. Pink','Self-Help'),
  nf(737,'Purposeful Empathy','Anita Nowak','Self-Help'),
  nf(738,'To Sell Is Human','Daniel H. Pink','Self-Help'),
  nf(739,'Mycelium Running','Paul Stamets','Self-Help'),
  nf(740,'How to Change Your Mind','Michael Pollan','Self-Help'),
  nf(741,'The Subtle Art of Not Giving a F*ck','Mark Manson','Self-Help'),
  nf(742,'The Abolition of Man','C.S. Lewis','Philosophy'),
  nf(743,'Groundwork of the Metaphysics of Morals','Immanuel Kant','Philosophy'),
  nf(744,"It's Not Luck",'Eliyahu Goldratt','Self-Help'),
  nf(745,'Christianity for Modern Pagans','Peter Kreeft','Philosophy'),
  nf(746,'The Rationalists','Descartes, Spinoza & Leibniz','Philosophy'),
  nf(747,'The Art of Living','Epictetus','Philosophy'),
  nf(748,'Mythology','Edith Hamilton','Philosophy'),
  cl(749,'Purgatorio','Dante','Italian Lit'),
  cl(750,'Women','Charles Bukowski','American Lit'),
  cl(751,'Post Office','Charles Bukowski','American Lit'),
  cl(752,'Ham on Rye','Charles Bukowski','American Lit'),
  fa(753,'Her Radiant Curse','Elizabeth Lim','Historical Fantasy','Six Crimson Cranes',0),
  fa(754,"The Dragon's Promise",'Elizabeth Lim','Historical Fantasy','Six Crimson Cranes',2),
  fa(755,'Blood and Moonlight','Erin Beaty','YA Fantasy','Blood and Moonlight',1),
  fa(756,'Blood & Honey','Shelby Mahurin','Dark Fantasy','Serpent & Dove',2),
  fa(757,'Gods & Monsters','Shelby Mahurin','Dark Fantasy','Serpent & Dove',3),
  fa(758,'The Bone Season','Samantha Shannon','Dark Fantasy','The Bone Season',1),
  fa(759,'The Priory of the Orange Tree','Samantha Shannon','High Fantasy',null,null),
  fa(760,'A Day of Fallen Night','Samantha Shannon','High Fantasy',null,null),
  fa(761,'What Feasts at Night','T. Kingfisher','Dark Fantasy','Sworn Soldier',2),
  fa(762,'Sun of Blood and Ruin','Mariely Lares','Historical Fantasy','Sun of Blood and Ruin',1),
  fa(763,'Dawn of Fate and Fire','Mariely Lares','Historical Fantasy','Sun of Blood and Ruin',2),
  fa(764,'Foul Lady Fortune','Chloe Gong','Historical Fantasy','Foul Lady Fortune',1),
  fa(765,'Foul Heart Huntsman','Chloe Gong','Historical Fantasy','Foul Lady Fortune',2),
  fa(766,'The Hobbit','J.R.R. Tolkien','High Fantasy','Middle-earth',0),
  fa(767,'The Fellowship of the Ring','J.R.R. Tolkien','High Fantasy','The Lord of the Rings',1),
  fa(768,'The Two Towers','J.R.R. Tolkien','High Fantasy','The Lord of the Rings',2),
  fa(769,'The Return of the King','J.R.R. Tolkien','High Fantasy','The Lord of the Rings',3),
  m(773,'Five Survive','Holly Jackson','Thriller',null,null),
  fa(774,'Blood Scion','Deborah Falaye','YA Fantasy',null,null),
  fa(775,'Serpent & Dove','Shelby Mahurin','Dark Fantasy','Serpent & Dove',1),
  fa(776,'A Touch of Darkness','Scarlett St. Clair','Mythology Romance','Hades x Persephone',1),
  fa(777,'A Game of Fate','Scarlett St. Clair','Mythology Romance','Hades Saga',1),
  fa(778,'Six Crimson Cranes','Elizabeth Lim','Historical Fantasy','Six Crimson Cranes',1),
  fa(779,'Dark Fae','C.Peckham & S.Valenti','Paranormal Romance','Ruthless Boys of the Zodiac',1),
  fa(780,'Savage Fae','C.Peckham & S.Valenti','Paranormal Romance','Ruthless Boys of the Zodiac',2),
  fa(781,'Vicious Fae','C.Peckham & S.Valenti','Paranormal Romance','Ruthless Boys of the Zodiac',3),
  fa(782,'Broken Fae','C.Peckham & S.Valenti','Paranormal Romance','Ruthless Boys of the Zodiac',4),
  fa(783,'Warrior Fae','C.Peckham & S.Valenti','Paranormal Romance','Ruthless Boys of the Zodiac',5),
  fa(784,'Children of Fallen Gods','Carissa Broadbent','Dark Fantasy','War of Lost Hearts',2),
  fa(785,'The Library at Hellebore','Cassandra Khaw','Dark Fantasy',null,null),
  rt(786,'LightWielder','Rachel Schneider',null,2),
  rt(787,'Storm Breaker','Nisha J. Tuli',null,null),
  rt(788,'Fallen Gods','Rachel Van Dyken',null,null),
  fa(789,'The Dark is Descending','Chloe C. Peñaranda','Dark Fantasy',null,null),
  r(790,'Hideaway Heart','Melanie Harlow','Contemporary Romance',null,null),
  fa(791,'Heart of the Shadow King','Sylvia Mercedes','Dark Fantasy','Shadow King',1),
  fa(792,'Vow of the Shadow King','Sylvia Mercedes','Dark Fantasy','Shadow King',2),
  fa(793,'City of Mirth and Malice','Alexis L. Menard','Dark Fantasy',null,null),
  r(794,'Charming Devil','Rebecca Kenney','Dark Romance',null,null),
  co(795,'Yellowface','R.F. Kuang','Literary Fiction',null,null),
  r(796,'Just Ducky','C.A. King','Contemporary Romance',null,null),
  fa(797,'The Hollow Gods','Vrana','Dark Fantasy','The Chaos Cycle',1),
  fa(798,'The Echoed Realm','Vrana','Dark Fantasy','The Chaos Cycle',2),
  fa(799,'Stray Feathers','Vrana','Dark Fantasy',null,null),
  r(800,'Black Silk','Letizia Firmani','Dark Romance',null,null),
  fa(801,"The Crown's Soul Prophecy",'Letizia Firmani','Dark Fantasy',null,null),
  r(802,'Wreath of Love','Vanessa Stock','Dark Romance',null,null),
  r(803,'Black Heart Painted Gold','Elena Lawson','Dark Romance','Painted',1),
  r(804,'White Rose Painted Red','Blake & Elena Lawson','Dark Romance','Painted',2),
  r(805,'Venomous King','A.L. Maruga','Dark Romance',null,null),
  r(806,"The Queen's Serpent",'A.L. Maruga','Dark Romance',null,null),
  r(807,'Dark Dare','A.L. Maruga','Dark Romance',null,null),
  r(808,'Stalking Christmas','A.L. Maruga','Dark Romance',null,null),
  r(809,'Be My Salvation','A.L. Maruga','Dark Romance','Be My',1),
  r(810,'Be My Sacrifice','A.L. Maruga','Dark Romance','Be My',2),
  r(811,'Be My Sinner','A.L. Maruga','Dark Romance','Be My',3),
  fa(812,'Blood Oath','J.A. Carter','High Fantasy',null,null),
  r(813,'Burn for Me','Brooklyn Cross','Dark Romance','Burn',1),
  r(814,'Burn with Me','Brooklyn Cross','Dark Romance','Burn',2),
  r(815,'Burn Me Down','Brooklyn Cross','Dark Romance','Burn',3),
  r(816,'Bloody Quarter','Brooklyn Cross','Dark Romance',null,null),
  r(817,'Little Mouse','Emily Rose','Dark Romance',null,null),
  rt(818,'Taken by the Fae','Jessie Ellion',null,null),
  r(819,'Wicked Trials','Elena Lawson','Dark Romance','Wicked Games',1),
  r(820,'Twisted Games','Elena Lawson','Dark Romance','Wicked Games',2),
  r(821,'Warped Minds','Elena Lawson','Dark Romance','Wicked Games',3),
  fa(822,'Verity Guild','Mai Corland','High Fantasy',null,null),
  rt(823,'The Ballad of Falling Dragons','Sarah A. Parker','The Moonfall Series',2),
  fa(824,'Every Spiral of Fate','Tahereh Mafi','YA Fantasy',null,4),
  rt(825,'Fury Bound','Sable Sorensen',null,null),
  rt(826,'The Wolves of Ruin','Sable Sorensen',null,null),
  fa(827,'The Heir & The Spare','Harper L. Woods','Dark Fantasy',null,null),
  fa(828,'The Damned','Harper L. Woods','Dark Fantasy',null,null),
  fa(829,'One Dark Kiss','Rebecca Zanetti','Paranormal Romance',null,null),
  fa(830,'Den of Liars','Olson','Dark Fantasy',null,null),
  fa(831,'What Stalks the Deep','T. Kingfisher','Dark Fantasy',null,null),
  fa(832,'Eternal Ruin','Tigest Girma','Dark Fantasy','Immortal Dark',2),
  fa(833,'What Fury Brings','Tricia Levenseller','YA Fantasy',null,null),
  fa(834,'A Steeping of Blood','Hafsah Faizal','YA Fantasy','Blood and Tea',2),
  fa(835,'Release Me','Tahereh Mafi','YA Fantasy','Shatter Me: Series Two',2),
  fa(836,'Song of the Six Realms','Lin','Historical Fantasy',null,null),
  fa(837,'Oh, the Girl Who Fell Beneath the Sea','Unknown','YA Fantasy',null,null),
  fa(838,'Among the Burning Flowers','Samantha Shannon','High Fantasy',null,null),
  fa(839,'A Curse of Shadows and Ice','Catharina Maura','Dark Fantasy',null,null),
  rt(840,'Rites of the Starling','Devney Perry',null,null),
  fa(841,'I, Songbird of the Sorrows','Braidee Otto','Dark Fantasy',null,null),
  fa(842,'Deathbringer','Sonia Tagliareni','Dark Fantasy',null,null),
  fa(843,'Blackthorn','J.T. Geissinger','Dark Fantasy',null,null),
  fa(844,'The Last Wish of Bristol Keats','Mary E. Pearson','High Fantasy',null,null),
  fa(845,'Warrior Princess Assassin','Brigid Kemmerer','YA Fantasy',null,null),
  fa(846,'Crowntide','Unknown','YA Fantasy',null,null),
  fa(847,'Glorious Rivals','Jennifer Lynn Barnes','YA Fantasy',null,null),
  m(848,'The Cruel Dawn','Rachel Howzell Hall','Thriller',null,null),
  r(849,"He Knows When You're Awake",'Alta Hensley','Dark Romance',null,null),
  cl(850,'Great Short Works of Fyodor Dostoevsky','Fyodor Dostoevsky','Russian Lit'),
  r(851,'Chasing the Wild','Elliott Rose','Contemporary Romance',null,null),
  r(852,'Taming the Heart','Elliott Rose','Contemporary Romance',null,null),
  r(853,"He Sees You When You're Sleeping",'Alta Hensley','Dark Romance',null,null),
  co(854,'One Golden Summer','Carley Fortune','Contemporary Fiction',null,null),
  r(855,'Game On','Navessa Allen','Sports Romance',null,null),
  r(856,'Severed Heart','Kate Stewart','Dark Romance',null,null),
  r(857,'The Defender','Ana Huang','Sports Romance',null,null),
  r(858,'Scotch on the Rocks','Elliot Fletcher','Contemporary Romance',null,null),
  m(859,'Finlay Donovan Digs Her Own Grave','Elle Cosimano','Cozy Mystery','Finlay Donovan',5),
  fa(860,'House of Pounding Hearts','Olivia Wildenstein','Dark Fantasy',null,null),
  fa(861,'The Captive and the First Blood Game','K.A. Linde','Dark Fantasy',null,null),
];

const seen = new Set<number>();
const ALL_BOOKS: Book[] = [];
for (const b of SEED) {
  if (!seen.has(b.id)) {
    seen.add(b.id);
    ALL_BOOKS.push(b);
  }
}

// ── StarRating ────────────────────────────────────────────────────────────────
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

// ── Pill ──────────────────────────────────────────────────────────────────────
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

// ── GoalRing ──────────────────────────────────────────────────────────────────
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

// ── PaceGauge ──────────────────────────────────────────────────────────────────
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

// ── Bookshelf Render Calculations ─────────────────────────────────────────────
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
        const linesY = bookY + 14;
        const lineCount = Math.floor((s.h - 22) / 13);

        return (
          <g key={i} transform={s.tilt !== 0 ? `rotate(${s.tilt},${cx},${SHELF_H})` : undefined}>
            <rect x={x + 1} y={bookY + 2} width={s.w} height={s.h} fill="rgba(0,0,0,0.5)" rx={1} />
            <rect x={x} y={bookY} width={s.w} height={s.h} fill={s.color} opacity={s.read ? 0.88 : 0.34} rx={1} />
            <rect x={x} y={bookY} width={s.w} height={3} fill={s.read ? 'rgba(255,255,240,0.55)' : 'rgba(255,255,240,0.12)'} rx={1} />
            <rect x={x} y={bookY + 3} width={2} height={s.h - 5} fill={s.read ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.05)'} />
            <rect x={x + s.w - 1} y={bookY + 3} width={1} height={s.h - 5} fill="rgba(0,0,0,0.35)" />
            {Array.from({ length: lineCount }, (_, li) => (
              <line key={li} x1={x + 3} y1={linesY + li * 13} x2={x + s.w - 3} y2={linesY + li * 13} stroke={s.read ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)'} strokeWidth={0.9} />
            ))}
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
      <rect x={0} y={SHELF_H + PLANK_H - 2} width={vbW} height={3} fill="rgba(0,0,0,0.55)" />
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
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'white', fontWeight: 700 }}>
            {total} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>total</span>
          </span>
          <span style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 700 }}>
            {readCount} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>read</span>
          </span>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
            {total - readCount} unread
          </span>
        </div>
      </div>
    </>
  );
}

// ── Modals: Details & Forms ──────────────────────────────────────────────────
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
    return { yearly: 120, monthly: 15, readProgress: null, monthProgress: null };
  });
  const [user, setUser] = useState<User | null>(null);
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [search, setSearch] = useState('');
  const [fGenre, setFGenre] = useState('All');
  const [fSub, setFSub] = useState('All');
  const [fRead, setFRead] = useState('All');
  const [fSeries, setFSeries] = useState('All');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'dateAdded' | 'series'>('title');
  const [showFilters, setShowFilters] = useState(false);
  const [randomPick, setRandomPick] = useState<Book | null>(null);

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

  const deleteBook = (id: number) => {
    persist(books.filter((b) => b.id !== id));
    if (detailBook?.id === id) setDetailBook(null);
  };

  const handleReread = (id: number) => {
    const book = books.find((b) => b.id === id);
    if (!book) return;
    const rr = book.rereads || [];
    if (!rr.includes(THIS_YEAR)) update(id, { rereads: [...rr, THIS_YEAR] });
  };

  const tabBooks = useMemo(() => {
    if (tab === 'home') return [];
    if (tab === 'shelf') return books;
    return books.filter((b) => b.status === tab);
  }, [books, tab]);

  const allGenres = useMemo(() => Array.from(new Set(tabBooks.map((b) => b.genre))).sort(), [tabBooks]);
  const allSubs = useMemo(() => {
    const src = fGenre === 'All' ? tabBooks : tabBooks.filter((b) => b.genre === fGenre);
    return Array.from(new Set(src.map((b) => b.subgenre).filter(Boolean))).sort();
  }, [tabBooks, fGenre]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const baseList = tabBooks.filter((b) => {
      if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q) && !(b.series || '').toLowerCase().includes(q)) return false;
      if (fGenre !== 'All' && b.genre !== fGenre) return false;
      if (fSub !== 'All' && b.subgenre !== fSub) return false;
      if (tab === 'shelf' && fRead !== 'All' && (fRead === 'Read') !== b.read) return false;
      if (fSeries !== 'All' && b.series !== fSeries) return false;
      return true;
    });
    return [...baseList].sort((a, b) => {
      if (sortBy === 'author') return a.author.localeCompare(b.author);
      if (sortBy === 'dateAdded') return (b.readAt || b.id || 0) - (a.readAt || a.id || 0);
      if (sortBy === 'series') {
        const sa = a.series || '';
        const sb = b.series || '';
        if (sa !== sb) return sa.localeCompare(sb);
        return (a.sn || 999) - (b.sn || 999);
      }
      return a.title.localeCompare(b.title);
    });
  }, [tabBooks, search, fGenre, fSub, fRead, fSeries, tab, sortBy]);

  const counts = useMemo(
    () => ({
      shelf: books.length,
      tbr: books.filter((b) => b.status === 'tbr').length,
      reading: books.filter((b) => b.status === 'reading').length,
      read: books.filter((b) => b.read).length,
      wishlist: books.filter((b) => b.status === 'wishlist').length,
    }),
    [books]
  );

  const clearFilters = useCallback(() => {
    setFGenre('All');
    setFSub('All');
    setFRead('All');
    setFSeries('All');
  }, []);

  const switchTab = (t: string) => {
    setTab(t);
    clearFilters();
    setSearch('');
    setSortBy('title');
  };

  const pickRandomTbr = () => {
    const tbrs = books.filter((b) => b.status === 'tbr');
    if (!tbrs.length) return;
    setRandomPick(tbrs[Math.floor(Math.random() * tbrs.length)]);
  };

  if (loading)
    return (
      <div style={{ background: '#06040f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
        ✦ Loading library…
      </div>
    );

  const readCount = counts.read;
  const thisMonthReadCount = books.filter((b) => b.read && b.readAt && new Date(b.readAt).getMonth() === THIS_MONTH && new Date(b.readAt).getFullYear() === THIS_YEAR).length;
  const currentlyReading = books.filter((b) => b.status === 'reading');
  const recentlyRead = books.filter((b) => b.read).slice(-4).reverse();

  return (
    <div style={{ background: '#06040f', minHeight: '100vh', color: 'white', fontFamily: 'Georgia, serif', padding: '1rem', maxWidth: '980px', margin: '0 auto' }}>
      {detailBook && <BookDetailModal book={detailBook} onClose={() => setDetailBook(null)} onUpdate={update} onReread={handleReread} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', color: '#e8d9ff', fontWeight: 'bold', margin: 0 }}>✦ My Shelf</h1>
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', margin: '0.15rem 0 0 0' }}>
            {counts.shelf} books · {counts.read} read · {counts.tbr} TBR · {counts.reading} reading · {counts.wishlist} wishlist
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button onClick={() => exportCSV(books)} style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '0.5rem', padding: '0.35rem 0.7rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
            📤 CSV
          </button>
          {user ? (
            <button onClick={() => auth && signOut(auth)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.7rem', fontSize: '0.75rem', cursor: 'pointer' }}>
              Sign Out
            </button>
          ) : (
            <button onClick={() => auth && provider && signInWithPopup(auth, provider)} style={{ background: '#6d28d9', color: 'white', border: 'none', borderRadius: '0.35rem 0.7rem', fontSize: '0.75rem', cursor: 'pointer' }}>
              Sign In
            </button>
          )}
          <button onClick={() => setModal('add')} style={{ background: '#6d28d9', color: 'white', border: 'none', borderRadius: '0.65rem', padding: '0.4rem 0.85rem', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}>
            + Add
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
        {Object.entries(TAB_CFG).map(([k, cfg]) => (
          <button
            key={k}
            onClick={() => switchTab(k)}
            style={{
              flex: 1,
              padding: '0.5rem 0.2rem',
              borderRadius: '0.65rem',
              border: `1px solid ${tab === k ? cfg.color : 'rgba(255,255,255,0.1)'}`,
              background: tab === k ? cfg.color + '22' : 'rgba(255,255,255,0.02)',
              color: tab === k ? cfg.color : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: tab === k ? 700 : 400,
              boxShadow: tab === k ? `0 0 12px ${cfg.color}33` : 'none',
            }}
          >
            <div>{cfg.label}</div>
            <div style={{ fontSize: '0.6rem', opacity: 0.6, marginTop: '0.1rem' }}>
              ({k === 'home' ? counts.shelf : (counts as any)[k] ?? 0})
            </div>
          </button>
        ))}
      </div>

      {/* Home Dashboard */}
      {tab === 'home' && (
        <>
          {/* Hero Banner */}
          <div style={{ background: '#0e0b1e', borderRadius: '0.875rem', border: '1px solid rgba(167,139,250,0.18)', padding: '1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.2rem' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#e8d9ff', marginBottom: '0.35rem' }}>
                Good evening, {user?.displayName ? user.displayName.split(' ')[0] : 'Elle'} ✦
              </div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                <span style={{ color: '#fb7185', fontWeight: 600 }}>{thisMonthReadCount} books</span> read this month · <span style={{ color: '#a78bfa', fontWeight: 600 }}>{readCount} of {goals.yearly}</span> this year
              </div>
            </div>
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
              <path d="M32 16 C22 14 12 16 10 18 L10 50 C12 48 22 46 32 48Z" fill="rgba(167,139,250,0.15)" stroke="#a78bfa" strokeWidth="1" />
              <path d="M32 16 C42 14 52 16 54 18 L54 50 C52 48 42 46 32 48Z" fill="rgba(192,132,252,0.1)" stroke="#c084fc" strokeWidth="1" />
              <line x1="32" y1="16" x2="32" y2="48" stroke="#e8d9ff" strokeWidth="1.2" />
            </svg>
          </div>

          {/* 5 Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {[
              { label: 'Total', value: counts.shelf, color: '#a78bfa', bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.25)' },
              { label: 'Read', value: counts.read, color: '#34d399', bg: 'rgba(52,211,153,0.07)', border: 'rgba(52,211,153,0.25)' },
              { label: 'TBR', value: counts.tbr, color: '#fb923c', bg: 'rgba(251,146,60,0.07)', border: 'rgba(251,146,60,0.25)' },
              { label: 'Reading', value: counts.reading, color: '#60a5fa', bg: 'rgba(96,165,250,0.07)', border: 'rgba(96,165,250,0.25)' },
              { label: 'Wishlist', value: counts.wishlist, color: '#f472b6', bg: 'rgba(244,114,182,0.07)', border: 'rgba(244,114,182,0.25)' },
            ].map((s) => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderTop: `2px solid ${s.color}`, borderRadius: '0.75rem', padding: '0.75rem 0.4rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Bookshelf Visual */}
          <BookshelfVisual books={books} />

          {/* Currently Reading Card */}
          {currentlyReading.length > 0 && (
            <div style={{ background: '#0e0b1e', borderRadius: '0.875rem', border: '1px solid rgba(96,165,250,0.15)', padding: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'white', marginBottom: '0.65rem' }}>📖 Currently Reading</div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {currentlyReading.map((b) => {
                  const cfg = GENRE_CFG[b.genre] || GENRE_CFG['Fantasy'];
                  return (
                    <div key={b.id} onClick={() => setDetailBook(b)} style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${cfg.accent}`, borderRadius: '0.6rem', padding: '0.6rem 0.75rem', flex: 1, minWidth: '160px', cursor: 'pointer' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'white' }}>{b.title}</div>
                      <div style={{ fontSize: '0.7rem', color: cfg.accent, marginTop: '0.1rem' }}>{b.author}</div>
                      <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.2rem' }}>{b.genre}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Side by Side: Goals + Recently Read */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ background: '#0e0b1e', borderRadius: '0.875rem', border: '1px solid rgba(255,255,255,0.07)', padding: '1rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'white', marginBottom: '0.75rem' }}>Reading Goals</div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <GoalRing count={readCount} goal={goals.yearly} label={`${THIS_YEAR} Yearly`} emoji="📅" gradStart="#a78bfa" gradEnd="#7c3aed" gradId="yearGrad" />
                <GoalRing count={thisMonthReadCount} goal={goals.monthly} label="Monthly" emoji="🌸" gradStart="#fb7185" gradEnd="#be123c" gradId="monthGrad" />
              </div>
            </div>

            <div style={{ background: '#0e0b1e', borderRadius: '0.875rem', border: '1px solid rgba(255,255,255,0.07)', padding: '1rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'white', marginBottom: '0.65rem' }}>Recently Read</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {recentlyRead.map((b) => (
                  <div key={b.id} onClick={() => setDetailBook(b)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: GENRE_CFG[b.genre]?.accent || '#a78bfa' }} />
                    <div style={{ fontSize: '0.72rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{b.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <PaceGauge read={readCount} goal={goals.yearly} year={THIS_YEAR} />
        </>
      )}

      {/* Insights Tab */}
      {tab === 'insights' && (
        <div style={{ background: '#0e0b1e', padding: '1.25rem', borderRadius: '0.875rem', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'white', marginBottom: '0.75rem' }}>📊 Insights & Stats</h3>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            <div>Total collection: <strong>{books.length}</strong></div>
            <div>Read so far: <strong>{counts.read}</strong> ({books.length ? Math.round((counts.read / books.length) * 100) : 0}%)</div>
            <div>TBR Pile: <strong>{counts.tbr}</strong></div>
            <div>Wishlist: <strong>{counts.wishlist}</strong></div>
          </div>
        </div>
      )}

      {/* Library View Tabs */}
      {tab !== 'home' && tab !== 'insights' && (
        <>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search title, author, series…"
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.65rem', padding: '0.45rem 0.85rem', color: 'white', fontSize: '0.82rem', boxSizing: 'border-box' }}
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.65rem', padding: '0.45rem 0.5rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', cursor: 'pointer' }}>
              <option value="title">A–Z Title</option>
              <option value="author">Author</option>
              <option value="series">Series</option>
              <option value="dateAdded">Date Added</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button onClick={() => setShowFilters((p) => !p)} style={{ fontSize: '0.68rem', padding: '0.25rem 0.65rem', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
              {showFilters ? '▲ Hide Filters' : '▼ Filters'}
            </button>
            {tab === 'tbr' && (
              <button onClick={pickRandomTbr} style={{ fontSize: '0.68rem', padding: '0.25rem 0.65rem', borderRadius: '9999px', border: '1px solid rgba(251,146,60,0.4)', background: 'rgba(251,146,60,0.1)', color: '#fb923c', cursor: 'pointer' }}>
                🎲 Surprise me
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)' }}>{filtered.length} shown</span>
          </div>

          {showFilters && (
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '0.65rem', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {['All', ...allGenres].map((o) => (
                  <Pill key={o} label={o} active={fGenre === o} color={GENRE_CFG[o]?.accent || TAB_CFG[tab]?.color} onClick={() => { setFGenre(o); setFSub('All'); }} />
                ))}
              </div>
              {fGenre !== 'All' && allSubs.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
                  {['All', ...allSubs].map((o) => (
                    <Pill key={o} label={o} active={fSub === o} color={GENRE_CFG[fGenre]?.accent || TAB_CFG[tab]?.color} onClick={() => setFSub(o)} />
                  ))}
                </div>
              )}
              {tab === 'shelf' && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {['All', 'Read', 'Unread'].map((o) => (
                    <Pill key={o} label={o} active={fRead === o} color="#34d399" onClick={() => setFRead(o)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Book Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {filtered.map((b) => {
              const cfg = GENRE_CFG[b.genre] || GENRE_CFG['Fantasy'];
              const bst = b.status || 'shelf';
              const isWishlist = bst === 'wishlist';
              const moves = Object.entries(TAB_CFG).filter(([k]) => k !== 'home' && k !== bst);

              return (
                <div
                  key={b.id}
                  style={{
                    background: isWishlist ? 'rgba(244,114,182,0.07)' : cfg.dim + '66',
                    borderRadius: '1rem',
                    border: `1px solid ${isWishlist ? 'rgba(244,114,182,0.25)' : cfg.accent + '30'}`,
                    borderLeft: `3px solid ${isWishlist ? '#f472b6' : cfg.accent}`,
                    padding: '0.875rem',
                    paddingTop: '2.1rem',
                    position: 'relative',
                  }}
                >
                  {/* Status Badge */}
                  {tab === 'shelf' && bst !== 'shelf' && (
                    <div style={{ position: 'absolute', top: '0.45rem', left: '0.5rem', fontSize: '0.58rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', background: STATUS_COLORS[bst] + '22', border: `1px solid ${STATUS_COLORS[bst]}`, color: STATUS_COLORS[bst], fontWeight: 600 }}>
                      {bst === 'tbr' ? '🔖 TBR' : bst === 'reading' ? '📖 Reading' : '✨ Wishlist'}
                    </div>
                  )}

                  {/* Transfer Buttons */}
                  <div style={{ position: 'absolute', top: '0.45rem', left: '0.5rem', display: 'flex', gap: '0.25rem' }}>
                    {moves.slice(0, 3).map(([k, c2]) => (
                      <button key={k} onClick={() => update(b.id, { status: k as BookStatus })} style={{ fontSize: '0.55rem', padding: '0.15rem 0.35rem', borderRadius: '9999px', border: `1px solid ${c2.color}`, background: c2.color + '18', color: c2.color, cursor: 'pointer' }}>
                        →{k === 'shelf' ? 'Shelf' : k === 'tbr' ? 'TBR' : k === 'reading' ? 'Reading' : 'Wishlist'}
                      </button>
                    ))}
                  </div>

                  {/* Read Toggle Badge */}
                  <button
                    onClick={() => update(b.id, { read: !b.read, readYear: !b.read ? THIS_YEAR : null, readAt: !b.read ? Date.now() : null })}
                    style={{ position: 'absolute', top: '0.45rem', right: '0.5rem', fontSize: '0.62rem', padding: '0.2rem 0.45rem', borderRadius: '9999px', cursor: 'pointer', border: '1px solid', ...(b.read ? { background: '#05653044', borderColor: '#34d399', color: '#34d399' } : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.3)' }) }}
                  >
                    {b.read ? `✓ Read ${b.readYear || ''}`.trim() : 'Unread'}
                  </button>

                  <div onClick={() => setDetailBook(b)} style={{ fontWeight: 'bold', color: 'white', fontSize: '0.875rem', lineHeight: '1.3', paddingRight: '3.5rem', marginBottom: '0.2rem', cursor: 'pointer' }}>
                    {b.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: isWishlist ? '#f472b6bb' : cfg.accent + 'bb', marginBottom: '0.2rem' }}>{b.author}</div>
                  {b.series && <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.28)' }}>{b.series}{b.sn != null ? ` #${b.sn}` : ''}</div>}

                  {b.rating && <div style={{ marginTop: '0.3rem' }}><StarRating rating={b.rating} size="sm" /></div>}
                  {b.note && <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.3rem', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{b.note}"</div>}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', background: isWishlist ? 'rgba(244,114,182,0.15)' : cfg.dim, color: isWishlist ? '#f472b6' : cfg.accent }}>
                      {b.genre}
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => setDetailBook(b)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>📖</button>
                      <button onClick={() => setEditBook(b)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>✎</button>
                      <button onClick={() => deleteBook(b.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modals */}
      {randomPick && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: '1rem' }}>
          <div style={{ background: '#0e0b1a', border: '1px solid rgba(251,146,60,0.3)', borderRadius: '1rem', padding: '1.75rem', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎲</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.75rem' }}>Your next read should be…</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white', marginBottom: '0.3rem' }}>{randomPick.title}</div>
            <div style={{ fontSize: '0.85rem', color: GENRE_CFG[randomPick.genre]?.accent || '#a78bfa', marginBottom: '1rem' }}>{randomPick.author}</div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={pickRandomTbr} style={{ flex: 1, background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)', borderRadius: '0.75rem', padding: '0.6rem', cursor: 'pointer', fontWeight: 600 }}>Try again 🎲</button>
              <button onClick={() => setRandomPick(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '0.75rem', padding: '0.6rem', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {(modal === 'add' || editBook) && (
        <ModalForm
          book={editBook}
          tab={tab}
          allBooks={books}
          onSave={(nb) => {
            if (editBook) {
              persist(books.map((x) => (x.id === nb.id ? nb : x)));
              setEditBook(null);
            } else {
              persist([...books, nb]);
              setModal(null);
            }
          }}
          onClose={() => {
            setModal(null);
            setEditBook(null);
          }}
        />
      )}
    </div>
  );
}
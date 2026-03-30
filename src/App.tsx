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
    // Also save public snapshot for share page (read books + wishlist only)
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

const STORAGE_KEY = 'myshelf-v6';
const GOALS_KEY   = 'myshelf-goals-v1';

const TAB_CFG: Record<string, { label: string; color: string }> = {
  home:     { label: '✦ Home',       color: '#c084fc' },
  shelf:    { label: '📚 Shelf',     color: '#a78bfa' },
  tbr:      { label: '🔖 TBR',       color: '#fb923c' },
  reading:  { label: '📖 Reading',   color: '#34d399' },
  wishlist: { label: '✨ Wishlist',  color: '#f472b6' },
};

const STATUS_COLORS: Record<string, string> = {
  shelf: '#a78bfa', tbr: '#fb923c', reading: '#34d399', wishlist: '#f472b6',
};

const THIS_YEAR  = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth();

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Date.now() + Math.random();
const base = (extra: any) => ({ read: false, status: 'shelf', readAt: null, readYear: null, rating: null, note: '' , ...extra });
const fa  = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Fantasy',         subgenre: sg, series: sr, sn });
const rt  = (id: number, t: string, a: string, sr: string | null, sn: number | null)              => base({ id, title: t, author: a, category: 'Fiction', genre: 'Romantasy',        subgenre: 'Romantasy', series: sr, sn });
const r   = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Romance',          subgenre: sg, series: sr, sn });
const m   = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Mystery/Thriller', subgenre: sg, series: sr, sn });
const h   = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Horror',           subgenre: sg, series: sr, sn });
const co  = (id: number, t: string, a: string, sg: string, sr: string | null, sn: number | null) => base({ id, title: t, author: a, category: 'Fiction', genre: 'Contemporary',     subgenre: sg, series: sr, sn });
const cl  = (id: number, t: string, a: string, sg: string)                                        => base({ id, title: t, author: a, category: 'Fiction', genre: 'Classics',          subgenre: sg, series: null, sn: null });
const nf  = (id: number, t: string, a: string, sg: string)                                        => base({ id, title: t, author: a, category: 'Non-Fiction', genre: 'Non-Fiction',   subgenre: sg, series: null, sn: null });

const fileToBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onload  = () => res((reader.result as string).split(',')[1]);
  reader.onerror = rej;
  reader.readAsDataURL(file);
});

// ── Export CSV ────────────────────────────────────────────────────────────────
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
  fa(6,'Fated Throne','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',6),
  fa(7,'Heartless Sky','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',7),
  fa(8,'Sorrow and Starlight','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',8),
  fa(9,'Beyond the Veil','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',8.5),
  fa(10,'Restless Stars','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',9),
  fa(11,'The Big Ass Party','C.Peckham & S.Valenti','Paranormal Romance','Zodiac Academy',null),
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
  fa(640,'Blacksilver','Callie Hart','Dark Fantasy',null,null),
  fa(641,'Brimstone','Callie Hart','Dark Fantasy','Brimstone',null),
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
  fa(705,'King\'s Cage','Victoria Aveyard','YA Fantasy','Red Queen',3),
  fa(706,'War Storm','Victoria Aveyard','YA Fantasy','Red Queen',4),
  fa(707,'Broken Throne','Victoria Aveyard','YA Fantasy','Red Queen',4.5),
  m(708,"A Good Girl's Guide to Murder",'Holly Jackson','YA Mystery',"A Good Girl's Guide to Murder",1),
  m(709,'Good Girl, Bad Blood','Holly Jackson','YA Mystery',"A Good Girl's Guide to Murder",2),
  m(710,'As Good as Dead','Holly Jackson','YA Mystery',"A Good Girl's Guide to Murder",3),
  m(711,'The Housemaid','Freida McFadden','Thriller','The Housemaid',1),
  m(712,"The Housemaid's Secret",'Freida McFadden','Thriller','The Housemaid',2),
  m(713,"The Housemaid's Husband",'Freida McFadden','Thriller','The Housemaid',3),
];

const seen = new Set<number>();
const ALL_BOOKS: any[] = [];
for (const b of SEED) {
  if (!seen.has(b.id)) { seen.add(b.id); ALL_BOOKS.push(b); }
}

// ── StarRating ─────────────────────────────────────────────────────────────────
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

// ── Pill ──────────────────────────────────────────────────────────────────────
function Pill({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ whiteSpace:'nowrap',fontSize:'0.7rem',padding:'0.3rem 0.75rem',borderRadius:'9999px',border:active?`1px solid ${color}`:'1px solid rgba(255,255,255,0.1)',background:active?color+'25':'transparent',color:active?color:'rgba(255,255,255,0.35)',cursor:'pointer',fontWeight:active?600:400 }}>
      {label}
    </button>
  );
}

// ── GoalRing ──────────────────────────────────────────────────────────────────
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

// ── GoalSetModal ──────────────────────────────────────────────────────────────
function GoalSetModal({ goals, onSave, onClose }: { goals: any; onSave: (g: any) => void; onClose: () => void }) {
  const [y,setY] = useState(goals.yearly||'');
  const [mo,setMo] = useState(goals.monthly||'');
  const [readProgress,setReadProgress] = useState(goals.readProgress??'');
  const [monthProgress,setMonthProgress] = useState(goals.monthProgress??'');
  const inp: React.CSSProperties = { width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'0.6rem',padding:'0.55rem 0.75rem',color:'white',fontSize:'0.95rem',boxSizing:'border-box',textAlign:'center' };
  return (
    <div style={{ position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.8)',padding:'1rem' }}>
      <div style={{ background:'#0e0b1a',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'1rem',padding:'1.5rem',width:'100%',maxWidth:'360px',maxHeight:'90vh',overflowY:'auto' }}>
        <h3 style={{ color:'white',fontWeight:'bold',marginBottom:'1rem',fontSize:'1rem' }}>📖 Set Reading Goals</h3>
        <div style={{ marginBottom:'0.65rem' }}>
          <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.72rem',display:'block',marginBottom:'0.3rem' }}>Yearly goal (books)</label>
          <input type="number" value={y} onChange={e=>setY(e.target.value)} placeholder="e.g. 120" min={1} style={inp}/>
        </div>
        <div style={{ marginBottom:'0.65rem' }}>
          <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.72rem',display:'block',marginBottom:'0.3rem' }}>Books read so far this year <span style={{ color:'rgba(255,255,255,0.25)' }}>(manual override)</span></label>
          <input type="number" value={readProgress} onChange={e=>setReadProgress(e.target.value)} placeholder="leave blank to auto-count" min={0} style={inp}/>
        </div>
        <div style={{ marginBottom:'0.65rem' }}>
          <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.72rem',display:'block',marginBottom:'0.3rem' }}>Monthly goal (books)</label>
          <input type="number" value={mo} onChange={e=>setMo(e.target.value)} placeholder="e.g. 12" min={1} style={inp}/>
        </div>
        <div style={{ marginBottom:'1rem' }}>
          <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.72rem',display:'block',marginBottom:'0.3rem' }}>Books read this month <span style={{ color:'rgba(255,255,255,0.25)' }}>(override)</span></label>
          <input type="number" value={monthProgress} onChange={e=>setMonthProgress(e.target.value)} placeholder="auto-tracked if blank" min={0} style={inp}/>
        </div>
        <div style={{ display:'flex',gap:'0.75rem' }}>
          <button onClick={()=>onSave({ yearly:Number(y)||0, monthly:Number(mo)||0, readProgress:readProgress!==''?Number(readProgress):null, monthProgress:monthProgress!==''?Number(monthProgress):null })} style={{ flex:1,background:'#6d28d9',color:'white',border:'none',borderRadius:'0.75rem',padding:'0.6rem',fontWeight:'600',cursor:'pointer' }}>Save</button>
          <button onClick={onClose} style={{ flex:1,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.5)',border:'none',borderRadius:'0.75rem',padding:'0.6rem',cursor:'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── HomeTab ───────────────────────────────────────────────────────────────────
function HomeTab({ books, goals, onEditGoals, userName }: { books: any[]; goals: any; onEditGoals: () => void; userName: string }) {
  const now = new Date();
  const readAll = books.filter(b => b.read);
  const tbrCount = books.filter(b => b.status==='tbr').length;
  const readingCount = books.filter(b => b.status==='reading').length;
  const wishlistCount = books.filter(b => b.status==='wishlist').length;
  const thisYearAuto = readAll.filter(b => b.readYear===THIS_YEAR||(!b.readYear&&b.readAt&&new Date(b.readAt).getFullYear()===THIS_YEAR));
  const goalCount = goals.readProgress!=null ? goals.readProgress : thisYearAuto.length;
  const thisMonthAuto = readAll.filter(b => { if(!b.readAt) return false; const d=new Date(b.readAt); return d.getMonth()===THIS_MONTH&&d.getFullYear()===THIS_YEAR; });
  const monthGoalCount = goals.monthProgress!=null ? goals.monthProgress : thisMonthAuto.length;
  const readPct = books.length ? Math.round((readAll.length/books.length)*100) : 0;
  const unreadPct = 100-readPct;

  const genreData = useMemo(()=>{ const c: Record<string,number>={}; readAll.forEach(b=>{c[b.genre]=(c[b.genre]||0)+1;}); return Object.entries(c).map(([g,n])=>({genre:g,count:n,color:GENRE_CFG[g]?.accent||'#a78bfa'})).sort((a,b)=>b.count-a.count); },[readAll]);
  const authorData = useMemo(()=>{ const c: Record<string,number>={}; readAll.forEach(b=>{c[b.author]=(c[b.author]||0)+1;}); return Object.entries(c).map(([a,n])=>({author:a,count:n})).sort((a,b)=>b.count-a.count).slice(0,8); },[readAll]);

  // Year-by-year history
  const yearData = useMemo(()=>{
    const c: Record<number,number> = {};
    readAll.forEach(b => {
      const y = b.readYear || (b.readAt ? new Date(b.readAt).getFullYear() : null);
      if (y) c[y] = (c[y]||0)+1;
    });
    return Object.entries(c).map(([y,n])=>({year:Number(y),count:n})).sort((a,b)=>a.year-b.year);
  },[readAll]);

  // Series completion
  const seriesData = useMemo(()=>{
    const seriesMap: Record<string,{owned:number,read:number}> = {};
    books.forEach(b => {
      if (!b.series) return;
      if (!seriesMap[b.series]) seriesMap[b.series] = {owned:0,read:0};
      seriesMap[b.series].owned++;
      if (b.read) seriesMap[b.series].read++;
    });
    return Object.entries(seriesMap)
      .filter(([,v]) => v.owned > 1)
      .map(([name,v]) => ({name, ...v, pct: Math.round((v.read/v.owned)*100)}))
      .sort((a,b) => b.owned - a.owned)
      .slice(0,8);
  },[books]);

  // Author collection completeness
  const authorOwned = useMemo(()=>{
    const c: Record<string,{owned:number,read:number}> = {};
    books.forEach(b => {
      if (!c[b.author]) c[b.author] = {owned:0,read:0};
      c[b.author].owned++;
      if (b.read) c[b.author].read++;
    });
    return Object.entries(c)
      .filter(([,v]) => v.owned >= 3)
      .map(([author,v]) => ({author, ...v, pct: Math.round((v.read/v.owned)*100)}))
      .sort((a,b) => b.owned - a.owned)
      .slice(0,6);
  },[books]);

  const maxGenre = genreData[0]?.count||1;
  const maxAuthor = authorData[0]?.count||1;
  const maxYear = Math.max(...yearData.map(d=>d.count),1);
  const card: React.CSSProperties = { background:'#0e0b1e',borderRadius:'0.875rem',border:'1px solid rgba(255,255,255,0.07)',padding:'1rem',marginBottom:'0.75rem' };
  const currentlyReading = books.filter((b:any)=>b.status==='reading');
  const recentlyRead = [...readAll].sort((a:any,b:any)=>(b.readAt||0)-(a.readAt||0)).slice(0,5);
  const monthLeft = Math.max(0,(goals.monthly||0)-monthGoalCount);
  const greeting = now.getHours()<12?'Good morning':now.getHours()<18?'Good afternoon':'Good evening';

  return (
    <div style={{ padding:'1rem',maxWidth:'960px',margin:'0 auto' }}>
      {/* Hero */}
      <div style={{ ...card,display:'flex',justifyContent:'space-between',alignItems:'center',borderColor:'rgba(167,139,250,0.18)',marginBottom:'0.75rem' }}>
        <div>
          <div style={{ fontSize:'0.7rem',color:'rgba(255,255,255,0.3)',marginBottom:'0.15rem' }}>{now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
          <div style={{ fontSize:'1.25rem',fontWeight:'bold',color:'#e8d9ff',marginBottom:'0.3rem' }}>{greeting}{userName?`, ${userName}`:''} ✦</div>
          <div style={{ fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',lineHeight:1.7 }}>
            <span style={{ color:'#fb7185',fontWeight:600 }}>{monthGoalCount} {monthGoalCount===1?'book':'books'}</span> read this month
            {goals.monthly>0&&<span style={{ color:'rgba(255,255,255,0.25)' }}> · {monthLeft} left to goal</span>}
            <span style={{ margin:'0 0.35rem',color:'rgba(255,255,255,0.12)' }}>·</span>
            <span style={{ color:'#a78bfa',fontWeight:600 }}>{goalCount} of {goals.yearly||'?'}</span> this year
          </div>
        </div>
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none" style={{ flexShrink:0 }}>
          <path d="M32 16 C22 14 12 16 10 18 L10 50 C12 48 22 46 32 48Z" fill="rgba(167,139,250,0.15)" stroke="#a78bfa" strokeWidth="1"/>
          <path d="M32 16 C42 14 52 16 54 18 L54 50 C52 48 42 46 32 48Z" fill="rgba(192,132,252,0.1)" stroke="#c084fc" strokeWidth="1"/>
          <line x1="32" y1="16" x2="32" y2="48" stroke="#e8d9ff" strokeWidth="1.2"/>
          <line x1="16" y1="26" x2="28" y2="25" stroke="rgba(167,139,250,0.4)" strokeWidth="0.8"/>
          <line x1="16" y1="31" x2="28" y2="30" stroke="rgba(167,139,250,0.4)" strokeWidth="0.8"/>
          <line x1="16" y1="36" x2="28" y2="35" stroke="rgba(167,139,250,0.4)" strokeWidth="0.8"/>
          <line x1="36" y1="25" x2="48" y2="26" stroke="rgba(192,132,252,0.4)" strokeWidth="0.8"/>
          <line x1="36" y1="30" x2="48" y2="31" stroke="rgba(192,132,252,0.4)" strokeWidth="0.8"/>
          <line x1="36" y1="35" x2="48" y2="36" stroke="rgba(192,132,252,0.4)" strokeWidth="0.8"/>
          <circle cx="50" cy="14" r="1.5" fill="#c084fc" opacity="0.7"/>
          <circle cx="8" cy="44" r="1" fill="#a78bfa" opacity="0.5"/>
        </svg>
      </div>

      {/* Stat cards — 5 now including Wishlist */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'0.5rem',marginBottom:'0.75rem' }}>
        {[
          { label:'Total',    value:books.length,   color:'#a78bfa', bg:'rgba(167,139,250,0.07)', border:'rgba(167,139,250,0.25)' },
          { label:'Read',     value:readAll.length,  color:'#34d399', bg:'rgba(52,211,153,0.07)',  border:'rgba(52,211,153,0.25)' },
          { label:'TBR',      value:tbrCount,        color:'#fb923c', bg:'rgba(251,146,60,0.07)',  border:'rgba(251,146,60,0.25)' },
          { label:'Reading',  value:readingCount,    color:'#60a5fa', bg:'rgba(96,165,250,0.07)',  border:'rgba(96,165,250,0.25)' },
          { label:'Wishlist', value:wishlistCount,   color:'#f472b6', bg:'rgba(244,114,182,0.07)', border:'rgba(244,114,182,0.25)' },
        ].map(s=>(
          <div key={s.label} style={{ background:s.bg,border:`1px solid ${s.border}`,borderTop:`2px solid ${s.color}`,borderRadius:'0.75rem',padding:'0.75rem 0.4rem',textAlign:'center' }}>
            <div style={{ fontSize:'1.3rem',fontWeight:'bold',color:s.color,lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:'0.58rem',color:'rgba(255,255,255,0.35)',marginTop:'0.25rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Currently Reading */}
      {currentlyReading.length>0&&(
        <div style={{ ...card,borderColor:'rgba(96,165,250,0.15)' }}>
          <div style={{ fontSize:'0.78rem',fontWeight:'600',color:'white',marginBottom:'0.65rem' }}>📖 Currently Reading</div>
          <div style={{ display:'flex',gap:'0.6rem',flexWrap:'wrap' }}>
            {currentlyReading.map((b:any)=>{ const cfg=GENRE_CFG[b.genre]||GENRE_CFG['Fantasy']; return (
              <div key={b.id} style={{ background:'rgba(255,255,255,0.03)',border:`1px solid ${cfg.accent}25`,borderLeft:`3px solid ${cfg.accent}`,borderRadius:'0.6rem',padding:'0.6rem 0.75rem',flex:1,minWidth:'130px' }}>
                <div style={{ fontSize:'0.78rem',fontWeight:'bold',color:'white',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{b.title}</div>
                <div style={{ fontSize:'0.65rem',color:cfg.accent+'bb',marginTop:'0.1rem' }}>{b.author}</div>
                <div style={{ fontSize:'0.6rem',color:'rgba(255,255,255,0.25)',marginTop:'0.15rem' }}>{b.genre}</div>
              </div>
            ); })}
          </div>
        </div>
      )}

      {/* Goals + Recently Read */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem' }}>
        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem' }}>
            <span style={{ fontSize:'0.78rem',fontWeight:'600',color:'white' }}>Reading Goals</span>
            <button onClick={onEditGoals} style={{ background:'rgba(109,40,217,0.3)',border:'1px solid #6d28d9',color:'#a78bfa',borderRadius:'0.5rem',padding:'0.2rem 0.55rem',fontSize:'0.65rem',cursor:'pointer' }}>Edit</button>
          </div>
          <div style={{ display:'flex',gap:'0.75rem',justifyContent:'center' }}>
            <GoalRing count={goalCount} goal={goals.yearly||0} label={`${THIS_YEAR} Yearly`} emoji="📅" gradStart="#a78bfa" gradEnd="#7c3aed" gradId="yearGrad"/>
            <GoalRing count={monthGoalCount} goal={goals.monthly||0} label={now.toLocaleDateString('en-US',{month:'long'})} emoji="🌸" gradStart="#fb7185" gradEnd="#be123c" gradId="monthGrad"/>
          </div>
          {(goals.readProgress!=null||goals.monthProgress!=null)&&(
            <div style={{ textAlign:'center',marginTop:'0.6rem',fontSize:'0.6rem',color:'rgba(255,255,255,0.2)' }}>
              {goals.readProgress!=null?'📌 Yearly manually set':''}
              {goals.readProgress!=null&&goals.monthProgress!=null?' · ':''}
              {goals.monthProgress!=null?'📌 Monthly manually set':''}
            </div>
          )}
        </div>
        <div style={card}>
          <div style={{ fontSize:'0.78rem',fontWeight:'600',color:'white',marginBottom:'0.65rem' }}>Recently Read</div>
          {recentlyRead.length===0?(
            <div style={{ color:'rgba(255,255,255,0.2)',fontSize:'0.75rem',textAlign:'center',padding:'1rem 0' }}>No books read yet</div>
          ):(
            <div style={{ display:'flex',flexDirection:'column',gap:'0.45rem' }}>
              {recentlyRead.map((b:any)=>{ const color=GENRE_CFG[b.genre]?.accent||'#a78bfa'; const dateStr=b.readAt?new Date(b.readAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}):b.readYear||''; return (
                <div key={b.id} style={{ display:'flex',alignItems:'center',gap:'0.5rem' }}>
                  <div style={{ width:'6px',height:'6px',borderRadius:'50%',background:color,flexShrink:0 }}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:'0.72rem',color:'white',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{b.title}</div>
                    <div style={{ fontSize:'0.6rem',color:'rgba(255,255,255,0.3)',display:'flex',alignItems:'center',gap:'0.3rem' }}>
                      {b.author}
                      {b.rating && <StarRating rating={b.rating} size="sm"/>}
                    </div>
                  </div>
                  <div style={{ fontSize:'0.58rem',color:'rgba(255,255,255,0.2)',flexShrink:0 }}>{dateStr}</div>
                </div>
              ); })}
            </div>
          )}
        </div>
      </div>

      {/* Read vs Unread + Top Genres */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem' }}>
        <div style={card}>
          <div style={{ fontSize:'0.78rem',fontWeight:'600',color:'white',marginBottom:'0.6rem' }}>Read vs Unread</div>
          <div style={{ height:'10px',borderRadius:'9999px',background:'rgba(255,255,255,0.07)',overflow:'hidden',display:'flex',marginBottom:'0.5rem' }}>
            <div style={{ width:`${readPct}%`,background:'#34d399',borderRadius:'9999px 0 0 9999px',transition:'width 0.5s' }}/>
            <div style={{ width:`${unreadPct}%`,background:'rgba(255,255,255,0.04)',borderRadius:'0 9999px 9999px 0' }}/>
          </div>
          <div style={{ display:'flex',gap:'1rem',marginBottom:'0.6rem' }}>
            <span style={{ fontSize:'0.65rem',color:'#34d399' }}>● Read {readPct}%</span>
            <span style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.3)' }}>● Unread {unreadPct}%</span>
          </div>
          {goals.monthly>0&&(
            <div style={{ background:'rgba(167,139,250,0.08)',border:'1px solid rgba(167,139,250,0.15)',borderRadius:'0.5rem',padding:'0.45rem 0.6rem' }}>
              <div style={{ fontSize:'0.68rem',color:'#a78bfa' }}>
                {monthGoalCount>=(goals.monthly||0)?'✦ Monthly goal complete! Amazing work.':monthLeft===1?'✦ Just 1 book left to hit your monthly goal!':`✦ ${monthLeft} books left this month — you've got this!`}
              </div>
            </div>
          )}
        </div>
        {genreData.length>0?(
          <div style={card}>
            <div style={{ fontSize:'0.78rem',fontWeight:'600',color:'white',marginBottom:'0.6rem' }}>Top Genres</div>
            {genreData.slice(0,5).map(({genre,count,color})=>(
              <div key={genre} style={{ marginBottom:'0.45rem' }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'0.15rem' }}>
                  <span style={{ fontSize:'0.68rem',color }}>{genre}</span>
                  <span style={{ fontSize:'0.62rem',color:'rgba(255,255,255,0.3)' }}>{count}</span>
                </div>
                <div style={{ height:'5px',borderRadius:'9999px',background:'rgba(255,255,255,0.05)',overflow:'hidden' }}>
                  <div style={{ width:`${(count/maxGenre)*100}%`,height:'100%',background:color,borderRadius:'9999px',transition:'width 0.5s' }}/>
                </div>
              </div>
            ))}
          </div>
        ):(
          <div style={{ ...card,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'0.5rem' }}>
            <div style={{ fontSize:'1.5rem' }}>📊</div>
            <p style={{ fontSize:'0.78rem',color:'rgba(255,255,255,0.2)',textAlign:'center' }}>Mark books as read to see genre stats</p>
          </div>
        )}
      </div>

      {/* Year-by-year reading history */}
      {yearData.length > 0 && (
        <div style={{ ...card, marginBottom:'0.75rem' }}>
          <div style={{ fontSize:'0.78rem',fontWeight:'600',color:'white',marginBottom:'0.75rem' }}>📅 Reading History by Year</div>
          <div style={{ display:'flex',alignItems:'flex-end',gap:'0.5rem',height:'80px' }}>
            {yearData.map(({year,count})=>(
              <div key={year} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'0.3rem' }}>
                <span style={{ fontSize:'0.6rem',color:'#a78bfa',fontWeight:600 }}>{count}</span>
                <div style={{ width:'100%',background:'linear-gradient(to top,#7c3aed,#a78bfa)',borderRadius:'3px 3px 0 0',height:`${(count/maxYear)*60}px`,minHeight:'4px',transition:'height 0.5s' }}/>
                <span style={{ fontSize:'0.58rem',color:'rgba(255,255,255,0.3)' }}>{year}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Series Completion */}
      {seriesData.length > 0 && (
        <div style={{ ...card, marginBottom:'0.75rem' }}>
          <div style={{ fontSize:'0.78rem',fontWeight:'600',color:'white',marginBottom:'0.65rem' }}>📚 Series Progress</div>
          <div style={{ display:'flex',flexDirection:'column',gap:'0.5rem' }}>
            {seriesData.map(({name,owned,read,pct})=>(
              <div key={name}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'0.15rem' }}>
                  <span style={{ fontSize:'0.7rem',color:'rgba(255,255,255,0.7)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'70%' }}>{name}</span>
                  <span style={{ fontSize:'0.62rem',color:'rgba(255,255,255,0.3)',flexShrink:0 }}>{read}/{owned} · {pct}%</span>
                </div>
                <div style={{ height:'5px',borderRadius:'9999px',background:'rgba(255,255,255,0.06)',overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`,height:'100%',background:pct===100?'#34d399':'#a78bfa',borderRadius:'9999px',transition:'width 0.5s' }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Author Collection Completeness */}
      {authorOwned.length > 0 && (
        <div style={{ ...card, marginBottom:'0.75rem' }}>
          <div style={{ fontSize:'0.78rem',fontWeight:'600',color:'white',marginBottom:'0.65rem' }}>✍️ Author Collections</div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem' }}>
            {authorOwned.map(({author,owned,read,pct})=>(
              <div key={author} style={{ background:'rgba(255,255,255,0.03)',borderRadius:'0.6rem',padding:'0.5rem 0.65rem',border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:'0.7rem',color:'white',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:'0.2rem' }}>{author}</div>
                <div style={{ fontSize:'0.62rem',color:'rgba(255,255,255,0.35)',marginBottom:'0.3rem' }}>{read} of {owned} read</div>
                <div style={{ height:'4px',borderRadius:'9999px',background:'rgba(255,255,255,0.06)',overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`,height:'100%',background:pct===100?'#34d399':'#fb7185',borderRadius:'9999px',transition:'width 0.5s' }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Authors */}
      {authorData.length>0&&(
        <div style={card}>
          <div style={{ fontSize:'0.78rem',fontWeight:'600',color:'white',marginBottom:'0.6rem' }}>Top Authors</div>
          <div style={{ display:'flex',flexDirection:'column',gap:'0.45rem' }}>
            {authorData.map(({author,count})=>(
              <div key={author} style={{ marginBottom:'0.35rem' }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'0.15rem' }}>
                  <span style={{ fontSize:'0.7rem',color:'rgba(255,255,255,0.65)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'75%' }}>{author}</span>
                  <span style={{ fontSize:'0.62rem',color:'rgba(255,255,255,0.3)',flexShrink:0 }}>{count} {count===1?'book':'books'}</span>
                </div>
                <div style={{ height:'5px',borderRadius:'9999px',background:'rgba(255,255,255,0.05)',overflow:'hidden' }}>
                  <div style={{ width:`${(count/maxAuthor)*100}%`,height:'100%',background:'#a78bfa',borderRadius:'9999px',transition:'width 0.5s' }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SharePage ─────────────────────────────────────────────────────────────────
function SharePage({ uid }: { uid: string }) {
  const [books, setBooks] = useState<any[]|null>(null);
  const [err, setErr] = useState('');

  useEffect(()=>{
    (async()=>{
      try {
        await initFirebase();
        const snap = await _getDoc(_doc(_db, 'public', uid));
        if (snap.exists()) setBooks(snap.data().books || []);
        else setErr('This shelf is not public or does not exist.');
      } catch { setErr('Could not load shelf.'); }
    })();
  },[uid]);

  const readBooks = books?.filter(b=>b.read) ?? [];
  const wishlist = books?.filter(b=>b.status==='wishlist') ?? [];

  if (!books && !err) return (
    <div style={{ background:'#06040f',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'0.75rem' }}>
      <div style={{ fontSize:'2rem' }}>✦</div>
      <p style={{ color:'#a78bfa' }}>Loading shelf…</p>
    </div>
  );

  if (err) return (
    <div style={{ background:'#06040f',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center' }}>
      <p style={{ color:'rgba(255,255,255,0.4)' }}>{err}</p>
    </div>
  );

  const card: React.CSSProperties = { background:'#0e0b1e',borderRadius:'0.875rem',border:'1px solid rgba(255,255,255,0.07)',padding:'1rem',marginBottom:'0.75rem' };

  return (
    <div style={{ background:'#06040f',minHeight:'100vh',color:'white',fontFamily:'Georgia,serif' }}>
      <div style={{ background:'#0d0a1c',borderBottom:'1px solid rgba(255,255,255,0.07)',padding:'1rem',textAlign:'center' }}>
        <div style={{ color:'#e8d9ff',fontWeight:'bold',fontSize:'1.1rem' }}>✦ My Shelf — Public View</div>
        <div style={{ color:'rgba(255,255,255,0.3)',fontSize:'0.7rem',marginTop:'0.2rem' }}>{readBooks.length} books read · {wishlist.length} on wishlist</div>
      </div>
      <div style={{ maxWidth:'960px',margin:'0 auto',padding:'1rem' }}>
        {readBooks.length > 0 && (
          <div style={card}>
            <div style={{ fontSize:'0.85rem',fontWeight:'700',color:'white',marginBottom:'0.75rem' }}>📖 Books Read</div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'0.6rem' }}>
              {readBooks.map((b:any)=>{ const cfg=GENRE_CFG[b.genre]||GENRE_CFG['Fantasy']; return (
                <div key={b.id} style={{ background:cfg.dim+'55',borderRadius:'0.75rem',borderLeft:`3px solid ${cfg.accent}`,padding:'0.65rem 0.75rem' }}>
                  <div style={{ fontSize:'0.8rem',fontWeight:'bold',color:'white',marginBottom:'0.1rem' }}>{b.title}</div>
                  <div style={{ fontSize:'0.7rem',color:cfg.accent+'cc' }}>{b.author}</div>
                  {b.series && <div style={{ fontSize:'0.62rem',color:'rgba(255,255,255,0.25)',marginTop:'0.1rem' }}>{b.series}{b.sn!=null?` #${b.sn}`:''}</div>}
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'0.4rem' }}>
                    {b.rating ? <StarRating rating={b.rating} size="sm"/> : <span/>}
                    {b.readYear && <span style={{ fontSize:'0.6rem',color:'rgba(255,255,255,0.25)' }}>{b.readYear}</span>}
                  </div>
                  {b.note && <div style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.35)',marginTop:'0.3rem',fontStyle:'italic',borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:'0.3rem' }}>"{b.note}"</div>}
                </div>
              );})}
            </div>
          </div>
        )}
        {wishlist.length > 0 && (
          <div style={card}>
            <div style={{ fontSize:'0.85rem',fontWeight:'700',color:'white',marginBottom:'0.75rem' }}>✨ Wishlist</div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'0.6rem' }}>
              {wishlist.map((b:any)=>{ const cfg=GENRE_CFG[b.genre]||GENRE_CFG['Fantasy']; return (
                <div key={b.id} style={{ background:'rgba(244,114,182,0.05)',borderRadius:'0.75rem',borderLeft:`3px solid #f472b6`,padding:'0.65rem 0.75rem' }}>
                  <div style={{ fontSize:'0.8rem',fontWeight:'bold',color:'white',marginBottom:'0.1rem' }}>{b.title}</div>
                  <div style={{ fontSize:'0.7rem',color:'#f472b6cc' }}>{b.author}</div>
                  {b.series && <div style={{ fontSize:'0.62rem',color:'rgba(255,255,255,0.25)',marginTop:'0.1rem' }}>{b.series}{b.sn!=null?` #${b.sn}`:''}</div>}
                  <span style={{ fontSize:'0.6rem',color:cfg.accent,marginTop:'0.3rem',display:'block' }}>{b.genre}</span>
                </div>
              );})}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ModalForm ─────────────────────────────────────────────────────────────────
function ModalForm({ book, onSave, onSaveMany, onClose, tab, allSeries, allBooks }: {
  book: any; onSave: (b: any) => void; onSaveMany: (bs: any[]) => void; onClose: () => void; tab: string; allSeries: string[]; allBooks: any[];
}) {
  const [mode, setMode] = useState('single');
  const [shelfGenre, setShelfGenre] = useState('Romance');
  const [shelfStatus, setShelfStatus] = useState(tab==='home'?'shelf':tab);
  const [shelfRead, setShelfRead] = useState(false);
  const blank = { title:'',author:'',category:'Fiction',genre:'Fantasy',subgenre:'Romantasy',series:'',sn:'',read:false,status:tab==='home'?'shelf':tab,readAt:null,readYear:null,rating:null,note:'' };
  const [f, setF] = useState(book ? {...book,sn:book.sn??'',series:book.series??'',rating:book.rating??null,note:book.note??''} : blank);
  const [identifying, setId] = useState(false);
  const [idMsg, setIdMsg] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{top:number;left:number;width:number}|null>(null);
  const [dupWarning, setDupWarning] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const sugTimer = useRef<any>(null);

  const set = (k: string, v: any) => setF((p: any) => ({...p,[k]:v}));

  const updateDropdownPos = useCallback(() => {
    if (titleInputRef.current) {
      const r = titleInputRef.current.getBoundingClientRect();
      setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }, []);

  const searchGoogleBooks = async (query: string) => {
    if (query.length < 3) { setSuggestions([]); setShowSug(false); return; }
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&printType=books&orderBy=relevance&langRestrict=en`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = (data.items || [])
        .map((item: any) => {
          const v = item.volumeInfo;
          return { title: v.title||'', author: (v.authors||[]).join(', '), cover: v.imageLinks?.smallThumbnail||'' };
        })
        .filter((b: any) => b.title)
        .slice(0, 5);
      setSuggestions(items);
      if (items.length > 0) { updateDropdownPos(); setShowSug(true); } else setShowSug(false);
    } catch(e) { console.error('Books API error:', e); setSuggestions([]); setShowSug(false); }
  };

  const handleTitleChange = (val: string) => {
    set('title', val); setDupWarning('');
    clearTimeout(sugTimer.current);
    sugTimer.current = setTimeout(() => searchGoogleBooks(val), 400);
  };

  const pickSuggestion = (sug: any) => {
    setF((p: any) => ({...p, title:sug.title, author:sug.author||p.author}));
    setSuggestions([]); setShowSug(false);
  };

  useEffect(() => {
    const hide = () => setShowSug(false);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (titleInputRef.current && !titleInputRef.current.contains(e.target as Node)) setShowSug(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleCoverPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setId(true); setIdMsg('Identifying…');
    try {
      const b64 = await fileToBase64(file);
      const res = await fetch('/.netlify/functions/claude', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:200, messages:[{ role:'user', content:[
          { type:'image', source:{ type:'base64', media_type:file.type, data:b64 } },
          { type:'text', text:'Identify the book. Return ONLY JSON: {"title":"…","author":"…"}. Unknown: {"title":"","author":""}.' },
        ]}]}),
      });
      const data = await res.json();
      const p = JSON.parse((data.content?.[0]?.text||'').replace(/```json|```/g,'').trim());
      if (p.title) { set('title',p.title); setIdMsg('✓ Book identified!'); } else setIdMsg("Couldn't identify — fill in manually.");
      if (p.author) set('author',p.author);
    } catch { setIdMsg("Couldn't identify — fill in manually."); }
    setId(false); setTimeout(()=>setIdMsg(''),3000);
  };

  const submitSingle = () => {
    if (!f.title.trim()||!f.author.trim()) return;
    if (!book) {
      const titleLower = f.title.trim().toLowerCase();
      const isDup = allBooks.some((b: any) => b.title.toLowerCase()===titleLower);
      if (isDup) { setDupWarning(`"${f.title.trim()}" is already in your shelf!`); return; }
    }
    onSave({ ...f, sn:f.sn!==''?Number(f.sn):null, series:f.series||null, id:f.id||uid(),
      readAt: f.read&&!f.readAt ? Date.now() : f.readAt,
      readYear: f.read ? (f.readYear||THIS_YEAR) : null,
      rating: f.rating||null, note: f.note||'',
    });
  };

  const [bulkText,setBulkText] = useState('');
  const [bulkDone,setBulkDone] = useState(false);

  const bulkParsed = useMemo(()=>bulkText.split('\n').map(l=>l.trim()).filter(Boolean).map(line=>{
    const byM   = line.match(/^(.+?)\s+by\s+(.+)$/);
    const pipeM = line.match(/^(.+?)\s*\|\s*(.+)$/);
    const dashM = line.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if(byM)   return {title:byM[1].trim(),   author:byM[2].trim()};
    if(pipeM) return {title:pipeM[1].trim(),  author:pipeM[2].trim()};
    if(dashM) return {title:dashM[1].trim(),  author:dashM[2].trim()};
    return {title:line,author:''};
  }),[bulkText]);

  const submitBulk = () => {
    const valid=bulkParsed.filter(p=>p.title.trim()); if(!valid.length) return;
    onSaveMany(valid.map(p=>({id:uid(),title:p.title.trim(),author:p.author.trim(),category:'Fiction',genre:shelfGenre,subgenre:SUBGENRES[shelfGenre]?.[0]||'',series:null,sn:null,read:shelfRead,readAt:shelfRead?Date.now():null,readYear:shelfRead?THIS_YEAR:null,status:shelfStatus,rating:null,note:''})));
    setBulkDone(true); setTimeout(onClose,1200);
  };

  const shelfInputRef = useRef<HTMLInputElement>(null);
  const [shelfImg,setShelfImg] = useState<string|null>(null);
  const [shelfB64,setShelfB64] = useState('');
  const [shelfMime,setShelfMime] = useState('');
  const [scanning,setScanning] = useState(false);
  const [scanErr,setScanErr] = useState('');
  const [scanned,setScanned] = useState<{title:string;author:string;selected:boolean}[]>([]);
  const [scanDone,setScanDone] = useState(false);

  const handleShelfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if(!file) return;
    const b64=await fileToBase64(file); setShelfB64(b64); setShelfMime(file.type);
    setShelfImg(URL.createObjectURL(file)); setScanned([]); setScanErr(''); setScanDone(false);
  };

  const runScan = async () => {
    if(!shelfB64) return; setScanning(true); setScanErr(''); setScanned([]);
    try {
      const res=await fetch('/.netlify/functions/claude',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:3000,messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:shelfMime,data:shelfB64}},
          {type:'text',text:`Look at every single book spine visible in this bookshelf photo. Read each title and author carefully.\nReturn ONLY a raw JSON array:\n[{"title":"Exact Title","author":"Author Name"},...]\n- Include every spine you can read\n- Empty string for unknown author\n- Do not skip any books`},
        ]}]}),
      });
      const data=await res.json();
      const raw=(data.content?.[0]?.text||'').replace(/```json|```/g,'').trim();
      const list=JSON.parse(raw);
      if(!Array.isArray(list)) throw new Error();
      setScanned(list.map((b:any)=>({title:b.title||'',author:b.author||'',selected:true})));
    } catch { setScanErr("Couldn't read the shelf — try a clearer photo with good lighting."); }
    setScanning(false);
  };

  const toggleOne=(i:number)=>setScanned(p=>p.map((b,j)=>j===i?{...b,selected:!b.selected}:b));
  const toggleAll=(v:boolean)=>setScanned(p=>p.map(b=>({...b,selected:v})));
  const editOne=(i:number,k:string,val:string)=>setScanned(p=>p.map((b,j)=>j===i?{...b,[k]:val}:b));
  const selectedCount=scanned.filter(b=>b.selected).length;

  const submitScan=()=>{
    const chosen=scanned.filter(b=>b.selected&&b.title.trim()); if(!chosen.length) return;
    onSaveMany(chosen.map(b=>({id:uid(),title:b.title.trim(),author:b.author.trim(),category:'Fiction',genre:shelfGenre,subgenre:SUBGENRES[shelfGenre]?.[0]||'',series:null,sn:null,read:shelfRead,readAt:shelfRead?Date.now():null,readYear:shelfRead?THIS_YEAR:null,status:shelfStatus,rating:null,note:''})));
    setScanDone(true); setTimeout(onClose,1400);
  };

  const inp: React.CSSProperties = { width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.6rem',padding:'0.5rem 0.75rem',color:'white',fontSize:'0.85rem',boxSizing:'border-box' };

  const BatchSettings=()=>(
    <>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'0.6rem' }}>
        <div>
          <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>Genre for all</label>
          <select value={shelfGenre} onChange={e=>setShelfGenre(e.target.value)} style={{...inp,background:'#1a1035'}}>{Object.keys(SUBGENRES).map(g=><option key={g}>{g}</option>)}</select>
        </div>
        <div>
          <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>Add to</label>
          <select value={shelfStatus} onChange={e=>setShelfStatus(e.target.value)} style={{...inp,background:'#1a1035'}}>
            <option value="shelf">📚 Shelf</option>
            <option value="tbr">🔖 TBR</option>
            <option value="reading">📖 Reading</option>
            <option value="wishlist">✨ Wishlist</option>
          </select>
        </div>
      </div>
      {shelfStatus==='shelf'&&(
        <label style={{ display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',marginBottom:'0.75rem' }}>
          <input type="checkbox" checked={shelfRead} onChange={e=>setShelfRead(e.target.checked)} style={{ accentColor:'#7c3aed' }}/>
          <span style={{ color:'rgba(255,255,255,0.6)',fontSize:'0.85rem' }}>Mark all as read</span>
        </label>
      )}
    </>
  );

  return (
    <>
      {showSug && suggestions.length > 0 && dropdownPos && (
        <div style={{ position:'fixed',top:dropdownPos.top,left:dropdownPos.left,width:dropdownPos.width,zIndex:9999,background:'#1a1035',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'0.65rem',maxHeight:'220px',overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.7)' }}>
          {suggestions.map((sug,i)=>(
            <div key={i} onMouseDown={e=>{e.preventDefault();pickSuggestion(sug);}}
              style={{ display:'flex',alignItems:'center',gap:'0.6rem',padding:'0.5rem 0.75rem',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.06)' }}
              onMouseEnter={e=>(e.currentTarget.style.background='rgba(109,40,217,0.2)')}
              onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              {sug.cover&&<img src={sug.cover} alt="" style={{ width:'28px',height:'40px',objectFit:'cover',borderRadius:'3px',flexShrink:0 }}/>}
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:'0.78rem',color:'white',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{sug.title}</div>
                <div style={{ fontSize:'0.68rem',color:'rgba(255,255,255,0.4)' }}>{sug.author}</div>
              </div>
            </div>
          ))}
          <div onMouseDown={()=>setShowSug(false)} style={{ padding:'0.3rem 0.75rem',fontSize:'0.65rem',color:'rgba(255,255,255,0.2)',cursor:'pointer',textAlign:'center' }}>✕ Dismiss</div>
        </div>
      )}

      <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)',padding:'1rem' }}>
        <div style={{ background:'#0e0b1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'1rem',padding:'1.5rem',width:'100%',maxWidth:'480px',maxHeight:'93vh',overflowY:'auto' }}>
          <h2 style={{ color:'white',fontWeight:'bold',marginBottom:'0.85rem',fontSize:'1.05rem' }}>{book?'Edit Book':'Add Book'}</h2>

          {!book&&(
            <div style={{ display:'flex',gap:'0.3rem',marginBottom:'1rem',background:'rgba(255,255,255,0.04)',borderRadius:'0.65rem',padding:'0.25rem' }}>
              {[['single','Single'],['bulk','Bulk paste'],['photo','📸 Scan shelf']].map(([mv,lbl])=>(
                <button key={mv} onClick={()=>setMode(mv)} style={{ flex:1,padding:'0.35rem 0.2rem',borderRadius:'0.5rem',border:'none',background:mode===mv?'#6d28d9':'transparent',color:mode===mv?'white':'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:'0.72rem',fontWeight:mode===mv?600:400,transition:'background 0.15s' }}>{lbl}</button>
              ))}
            </div>
          )}

          {mode==='single'&&(
            <>
              {!book&&(
                <div style={{ marginBottom:'0.75rem' }}>
                  <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={handleCoverPhoto}/>
                  <button onClick={()=>photoRef.current?.click()} disabled={identifying} style={{ width:'100%',padding:'0.55rem',borderRadius:'0.6rem',border:'1px dashed rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.03)',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:'0.8rem' }}>
                    {identifying?'Identifying…':'📷 Scan cover to identify'}
                  </button>
                  {idMsg&&<div style={{ fontSize:'0.7rem',color:'#34d399',marginTop:'0.25rem',textAlign:'center' }}>{idMsg}</div>}
                </div>
              )}

              <div style={{ marginBottom:'0.65rem' }}>
                <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>Title</label>
                <input ref={titleInputRef} value={f.title} onChange={e=>handleTitleChange(e.target.value)}
                  onFocus={()=>{ if(suggestions.length>0){ updateDropdownPos(); setShowSug(true); } }}
                  placeholder="Book title" style={inp} autoComplete="off"/>
                {dupWarning&&<div style={{ fontSize:'0.7rem',color:'#f87171',marginTop:'0.2rem' }}>⚠ {dupWarning}</div>}
              </div>

              <div style={{ marginBottom:'0.65rem' }}>
                <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>Author</label>
                <input value={f.author} onChange={e=>set('author',e.target.value)} placeholder="Author name" style={inp}/>
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'0.65rem' }}>
                <div>
                  <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>Genre</label>
                  <select value={f.genre} onChange={e=>{set('genre',e.target.value);set('subgenre',SUBGENRES[e.target.value]?.[0]||'');}} style={{...inp,background:'#1a1035'}}>{Object.keys(SUBGENRES).map(g=><option key={g}>{g}</option>)}</select>
                </div>
                <div>
                  <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>Subgenre</label>
                  <select value={f.subgenre} onChange={e=>set('subgenre',e.target.value)} style={{...inp,background:'#1a1035'}}>{(SUBGENRES[f.genre]||[]).map((s:string)=><option key={s}>{s}</option>)}</select>
                </div>
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr',gap:'0.5rem',marginBottom:'0.65rem' }}>
                <div>
                  <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>Series</label>
                  <input value={f.series} onChange={e=>set('series',e.target.value)} placeholder="Series name" list="sl" style={inp}/>
                  <datalist id="sl">{allSeries.map(s=><option key={s} value={s}/>)}</datalist>
                </div>
                <div>
                  <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>#</label>
                  <input type="number" value={f.sn} onChange={e=>set('sn',e.target.value)} min={0} step={0.5} style={inp}/>
                </div>
              </div>

              <div style={{ marginBottom:'0.75rem' }}>
                <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.35rem' }}>Add to</label>
                <div style={{ display:'flex',gap:'0.4rem',flexWrap:'wrap' }}>
                  {Object.entries(TAB_CFG).filter(([k])=>k!=='home').map(([k,cfg])=>(
                    <button key={k} onClick={()=>set('status',k)} style={{ flex:1,minWidth:'70px',padding:'0.4rem 0.2rem',borderRadius:'0.6rem',border:`1px solid ${f.status===k?cfg.color:'rgba(255,255,255,0.1)'}`,background:f.status===k?cfg.color+'25':'transparent',color:f.status===k?cfg.color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:'0.62rem',fontWeight:f.status===k?700:400 }}>
                      {k==='shelf'?'📚':k==='tbr'?'🔖':k==='reading'?'📖':'✨'} {k.charAt(0).toUpperCase()+k.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {f.status==='shelf'&&(
                <label style={{ display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',marginBottom:'0.65rem' }}>
                  <input type="checkbox" checked={f.read||false} onChange={e=>set('read',e.target.checked)} style={{ accentColor:'#7c3aed' }}/>
                  <span style={{ color:'rgba(255,255,255,0.6)',fontSize:'0.85rem' }}>Mark as read</span>
                </label>
              )}
              {f.read&&(
                <div style={{ marginBottom:'0.65rem' }}>
                  <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>Year read</label>
                  <input type="number" value={f.readYear??''} onChange={e=>set('readYear',e.target.value?Number(e.target.value):null)} placeholder={String(THIS_YEAR)} style={inp}/>
                  <div style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.25)',marginTop:'0.2rem' }}>Change this for books read in previous years</div>
                </div>
              )}

              {/* Rating */}
              <div style={{ marginBottom:'0.65rem' }}>
                <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.35rem' }}>Rating</label>
                <div style={{ display:'flex',alignItems:'center',gap:'0.75rem' }}>
                  <StarRating rating={f.rating} onChange={r=>set('rating',r)} size="md"/>
                  {f.rating && <span style={{ fontSize:'0.7rem',color:'rgba(255,255,255,0.3)',cursor:'pointer' }} onClick={()=>set('rating',null)}>Clear</span>}
                </div>
              </div>

              {/* Note */}
              <div style={{ marginBottom:'1rem' }}>
                <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.2rem' }}>Note / Review <span style={{ color:'rgba(255,255,255,0.2)' }}>(optional)</span></label>
                <textarea value={f.note||''} onChange={e=>set('note',e.target.value)} placeholder="A short thought about this book…" rows={2} style={{...inp,resize:'vertical',lineHeight:'1.5',fontSize:'0.8rem'}}/>
              </div>

              <div style={{ display:'flex',gap:'0.75rem' }}>
                <button onClick={submitSingle} style={{ flex:1,background:'#6d28d9',color:'white',border:'none',borderRadius:'0.75rem',padding:'0.6rem',fontWeight:'600',cursor:'pointer' }}>{book?'Save':'Add'}</button>
                <button onClick={onClose} style={{ flex:1,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.5)',border:'none',borderRadius:'0.75rem',padding:'0.6rem',cursor:'pointer' }}>Cancel</button>
              </div>
            </>
          )}

          {mode==='bulk'&&(
            <>
              <div style={{ marginBottom:'0.6rem' }}>
                <label style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',display:'block',marginBottom:'0.3rem' }}>Paste your list — one book per line</label>
                <div style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.25)',marginBottom:'0.4rem' }}>
                  <span style={{ color:'rgba(255,255,255,0.4)' }}>Title by Author</span> · <span style={{ color:'rgba(255,255,255,0.4)' }}>Title - Author</span> · <span style={{ color:'rgba(255,255,255,0.4)' }}>Title | Author</span>
                </div>
                <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} placeholder={'Fourth Wing by Rebecca Yarros\nIron Flame - Rebecca Yarros'} rows={6} style={{...inp,resize:'vertical',lineHeight:'1.5',fontFamily:'monospace',fontSize:'0.8rem'}}/>
              </div>
              {bulkParsed.length>0&&(
                <div style={{ marginBottom:'0.75rem',maxHeight:'150px',overflowY:'auto',borderRadius:'0.6rem',border:'1px solid rgba(255,255,255,0.07)',background:'rgba(255,255,255,0.02)' }}>
                  {bulkParsed.map((p,i)=>(
                    <div key={i} style={{ padding:'0.35rem 0.65rem',borderBottom:'1px solid rgba(255,255,255,0.05)',display:'flex',gap:'0.5rem',alignItems:'center' }}>
                      <span style={{ fontSize:'0.7rem',flexShrink:0,color:p.author?'#34d399':'#fbbf24' }}>{p.author?'✓':'⚠'}</span>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:'0.75rem',color:'white',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.title}</div>
                        <div style={{ fontSize:'0.68rem',color:'rgba(255,255,255,0.35)' }}>{p.author||'No author detected'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <BatchSettings/>
              <div style={{ display:'flex',gap:'0.75rem' }}>
                <button onClick={submitBulk} disabled={bulkParsed.length===0||bulkDone} style={{ flex:1,background:bulkDone?'#059669':'#6d28d9',color:'white',border:'none',borderRadius:'0.75rem',padding:'0.6rem',fontWeight:'600',cursor:'pointer',transition:'background 0.2s' }}>
                  {bulkDone?`✓ Added ${bulkParsed.length} books!`:`Add ${bulkParsed.length||0} book${bulkParsed.length!==1?'s':''}`}
                </button>
                <button onClick={onClose} style={{ flex:1,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.5)',border:'none',borderRadius:'0.75rem',padding:'0.6rem',cursor:'pointer' }}>Cancel</button>
              </div>
            </>
          )}

          {mode==='photo'&&(
            <>
              <input ref={shelfInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleShelfFile}/>
              {!shelfImg?(
                <button onClick={()=>shelfInputRef.current?.click()} style={{ width:'100%',padding:'2.5rem 1rem',borderRadius:'0.75rem',border:'2px dashed rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.02)',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:'0.85rem',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem' }}>
                  <span style={{ fontSize:'2.5rem' }}>📸</span>
                  <span>Tap to upload a shelf photo</span>
                  <span style={{ fontSize:'0.7rem',color:'rgba(255,255,255,0.25)' }}>Works best with clear, well-lit spines</span>
                </button>
              ):(
                <div style={{ marginBottom:'0.75rem',position:'relative' }}>
                  <img src={shelfImg} alt="shelf" style={{ width:'100%',borderRadius:'0.65rem',maxHeight:'200px',objectFit:'cover' }}/>
                  <button onClick={()=>shelfInputRef.current?.click()} style={{ position:'absolute',bottom:'0.5rem',right:'0.5rem',background:'rgba(0,0,0,0.65)',color:'white',border:'none',borderRadius:'0.5rem',padding:'0.3rem 0.6rem',fontSize:'0.7rem',cursor:'pointer' }}>Change photo</button>
                </div>
              )}
              {shelfImg&&!scanning&&scanned.length===0&&!scanErr&&(
                <button onClick={runScan} style={{ width:'100%',marginBottom:'0.75rem',padding:'0.65rem',background:'linear-gradient(135deg,#6d28d9,#4f46e5)',color:'white',border:'none',borderRadius:'0.75rem',fontWeight:'700',cursor:'pointer',fontSize:'0.9rem' }}>✨ Scan for books</button>
              )}
              {scanning&&(
                <div style={{ textAlign:'center',padding:'1.5rem 0',marginBottom:'0.75rem' }}>
                  <div style={{ fontSize:'1.5rem',marginBottom:'0.4rem' }}>🔍</div>
                  <div style={{ color:'rgba(255,255,255,0.5)',fontSize:'0.8rem' }}>Scanning your shelf… this may take a moment</div>
                </div>
              )}
              {scanErr&&(
                <div style={{ background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'0.6rem',padding:'0.75rem',marginBottom:'0.75rem',color:'#fca5a5',fontSize:'0.8rem',textAlign:'center' }}>
                  {scanErr}
                  <button onClick={runScan} style={{ display:'block',margin:'0.5rem auto 0',background:'none',border:'1px solid #fca5a5',color:'#fca5a5',borderRadius:'0.5rem',padding:'0.25rem 0.75rem',cursor:'pointer',fontSize:'0.75rem' }}>Try again</button>
                </div>
              )}
              {scanned.length>0&&(
                <>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.4rem' }}>
                    <span style={{ color:'#4ade80',fontSize:'0.8rem',fontWeight:600 }}>✨ Found {scanned.length} books</span>
                    <div style={{ display:'flex',gap:'0.5rem' }}>
                      <button onClick={()=>toggleAll(true)}  style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.4)',background:'none',border:'none',cursor:'pointer' }}>All</button>
                      <button onClick={()=>toggleAll(false)} style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.4)',background:'none',border:'none',cursor:'pointer' }}>None</button>
                      <button onClick={runScan}              style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.4)',background:'none',border:'none',cursor:'pointer' }}>Rescan</button>
                    </div>
                  </div>
                  <div style={{ maxHeight:'260px',overflowY:'auto',borderRadius:'0.65rem',border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.02)',marginBottom:'0.75rem' }}>
                    {scanned.map((b,i)=>(
                      <div key={i} style={{ display:'flex',gap:'0.5rem',alignItems:'flex-start',padding:'0.45rem 0.65rem',borderBottom:'1px solid rgba(255,255,255,0.05)',background:b.selected?'rgba(109,40,217,0.08)':'transparent' }}>
                        <input type="checkbox" checked={b.selected} onChange={()=>toggleOne(i)} style={{ accentColor:'#7c3aed',marginTop:'0.25rem',flexShrink:0,cursor:'pointer' }}/>
                        <div style={{ flex:1,minWidth:0 }}>
                          <input value={b.title} onChange={e=>editOne(i,'title',e.target.value)} style={{...inp,padding:'0.25rem 0.4rem',fontSize:'0.78rem',fontWeight:600,marginBottom:'0.2rem',color:b.selected?'white':'rgba(255,255,255,0.35)'}}/>
                          <input value={b.author} onChange={e=>editOne(i,'author',e.target.value)} placeholder="Author name" style={{...inp,padding:'0.2rem 0.4rem',fontSize:'0.7rem',color:b.selected?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.2)'}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                  <BatchSettings/>
                  <div style={{ display:'flex',gap:'0.75rem' }}>
                    <button onClick={submitScan} disabled={selectedCount===0||scanDone} style={{ flex:1,background:scanDone?'#059669':'#6d28d9',color:'white',border:'none',borderRadius:'0.75rem',padding:'0.65rem',fontWeight:'700',cursor:'pointer',fontSize:'0.9rem',transition:'background 0.2s' }}>
                      {scanDone?`✓ Added ${selectedCount} books!`:`Add ${selectedCount} book${selectedCount!==1?'s':''}`}
                    </button>
                    <button onClick={onClose} style={{ flex:1,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.5)',border:'none',borderRadius:'0.75rem',padding:'0.65rem',cursor:'pointer' }}>Cancel</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  // Check for share page route
  const shareMatch = window.location.pathname.match(/^\/share\/(.+)$/);
  if (shareMatch) return <SharePage uid={shareMatch[1]}/>;

  const [books,       setBooks]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState('home');
  const [goals,       setGoals]       = useState<any>({ yearly:0, monthly:0, readProgress:null, monthProgress:null });
  const [user,        setUser]        = useState<any>(null);
  const [authReady,   setAuthReady]   = useState(false);
  const [syncing,     setSyncing]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [fGenre,      setFGenre]      = useState('All');
  const [fSub,        setFSub]        = useState('All');
  const [fRead,       setFRead]       = useState('All');
  const [fSeries,     setFSeries]     = useState('All');
  const [sortBy,      setSortBy]      = useState<'title'|'author'|'dateAdded'|'series'>('title');
  const [showFilters, setShowFilters] = useState(false);
  const [modal,       setModal]       = useState<string|null>(null);
  const [delId,       setDelId]       = useState<any>(null);
  const [editBook,    setEditBook]    = useState<any>(null);
  const [goalModal,   setGoalModal]   = useState(false);
  const [pendingRead, setPendingRead] = useState<{id:any;year:string}|null>(null);
  const [randomPick,  setRandomPick]  = useState<any>(null);
  const [shareToast,  setShareToast]  = useState('');

  useEffect(()=>{
    (async()=>{
      const fbOk=await initFirebase();
      if(fbOk){
        const unsub=_onAuthStateChanged(_auth,async(u:any)=>{
          setUser(u); setAuthReady(true);
          if(u){
            setSyncing(true);
            try{
              const snap=await _getDoc(_doc(_db,'users',u.uid));
              if(snap.exists()){
                const data=snap.data();
                const cloudBooks=(data.books||[]).map((b:any)=>({...b,status:b.status||'shelf',readAt:b.readAt||null,readYear:b.readYear||null,rating:b.rating??null,note:b.note??''}));
                const ids=new Set(cloudBooks.map((b:any)=>b.id));
                setBooks([...cloudBooks,...ALL_BOOKS.filter((b:any)=>!ids.has(b.id))]);
                if(data.goals) setGoals(data.goals);
              } else {
                let local=null;
                try{const raw=localStorage.getItem(STORAGE_KEY);if(raw) local=JSON.parse(raw);}catch{}
                const base=local?local.map((b:any)=>({...b,status:b.status||'shelf',readAt:b.readAt||null,readYear:b.readYear||null,rating:b.rating??null,note:b.note??''})):ALL_BOOKS;
                const ids=new Set(base.map((b:any)=>b.id));
                const merged=[...base,...ALL_BOOKS.filter((b:any)=>!ids.has(b.id))];
                setBooks(merged);
                let lg={yearly:0,monthly:0,readProgress:null,monthProgress:null};
                try{const g=localStorage.getItem(GOALS_KEY);if(g) lg=JSON.parse(g);}catch{}
                setGoals(lg);
                await saveToFirestore(u.uid,merged,lg);
              }
            }catch{setBooks(ALL_BOOKS);}
            setSyncing(false);
          } else {
            try{
              const raw=localStorage.getItem(STORAGE_KEY);
              if(raw){const s=JSON.parse(raw).map((b:any)=>({...b,status:b.status||'shelf',readAt:b.readAt||null,readYear:b.readYear||null,rating:b.rating??null,note:b.note??''}));const ids=new Set(s.map((b:any)=>b.id));setBooks([...s,...ALL_BOOKS.filter((b:any)=>!ids.has(b.id))]);}
              else setBooks(ALL_BOOKS);
            }catch{setBooks(ALL_BOOKS);}
            try{const g=localStorage.getItem(GOALS_KEY);if(g) setGoals(JSON.parse(g));}catch{}
          }
          setLoading(false);
        });
        return()=>unsub();
      } else {
        try{
          const keys=[STORAGE_KEY,'myshelf-v5','myshelf-v4','myshelf-v3','myshelf-v2','myshelf-v1'];
          let stored=null;
          for(const k of keys){try{const raw=localStorage.getItem(k);if(raw){stored=JSON.parse(raw);break;}}catch{}}
          if(stored){const migrated=stored.map((b:any)=>({...b,status:b.status||'shelf',readAt:b.readAt||null,readYear:b.readYear||null,rating:b.rating??null,note:b.note??''}));const ids=new Set(migrated.map((b:any)=>b.id));setBooks([...migrated,...ALL_BOOKS.filter((b:any)=>!ids.has(b.id))]);}
          else setBooks(ALL_BOOKS);
          try{const g=localStorage.getItem(GOALS_KEY);if(g) setGoals(JSON.parse(g));}catch{}
        }catch{setBooks(ALL_BOOKS);}
        setAuthReady(true); setLoading(false);
      }
    })();
  },[]);

  const persist=(nb:any[])=>{
    setBooks(nb);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(nb));}catch{}
    if(user) saveToFirestore(user.uid,nb,goals);
  };
  const persistGoals=(g:any)=>{
    setGoals(g);
    try{localStorage.setItem(GOALS_KEY,JSON.stringify(g));}catch{}
    if(user) saveToFirestore(user.uid,books,g);
  };

  const handleSignIn  = ()=>{ if(firebaseReady) _signInWithPopup(_auth,_provider).catch(()=>{}); };
  const handleSignOut = ()=>{ if(firebaseReady) _signOut(_auth); };

  const update=(id:any,patch:any)=>{
    const extra:any={};
    if(patch.read===true && patch.readYear==null){ extra.readAt=Date.now(); extra.readYear=THIS_YEAR; }
    if(patch.read===false){ extra.readAt=null; extra.readYear=null; }
    persist(books.map(b=>b.id===id?{...b,...patch,...extra}:b));
  };

  const tabBooks=useMemo(()=>{
    if(tab==='home') return [];
    if(tab==='shelf') return books;
    return books.filter(b=>b.status===tab);
  },[books,tab]);

  const allGenres=useMemo(()=>[...new Set(tabBooks.map((b:any)=>b.genre))].sort() as string[],[tabBooks]);
  const allSubs=useMemo(()=>{const src=fGenre==='All'?tabBooks:tabBooks.filter((b:any)=>b.genre===fGenre);return[...new Set(src.map((b:any)=>b.subgenre).filter(Boolean))].sort() as string[];},[tabBooks,fGenre]);
  const allSeries=useMemo(()=>[...new Set(books.map((b:any)=>b.series).filter(Boolean))].sort() as string[],[books]);

  const filtered=useMemo(()=>{
    const q=search.toLowerCase().trim();
    const qWords=q.split(/\s+/).filter(Boolean);
    const base = tabBooks.filter((b:any)=>{
      if(qWords.length>0){
        const haystack=`${b.title} ${b.author} ${b.series||''} ${b.subgenre||''}`.toLowerCase();
        if(!qWords.every(w=>haystack.includes(w))) return false;
      }
      if(fGenre!=='All'&&b.genre!==fGenre) return false;
      if(fSub!=='All'&&b.subgenre!==fSub) return false;
      if(tab==='shelf'&&fRead!=='All'&&(fRead==='Read')!==b.read) return false;
      if(fSeries!=='All'&&b.series!==fSeries) return false;
      return true;
    });
    return [...base].sort((a:any,b:any)=>{
      if(sortBy==='author') return a.author.localeCompare(b.author);
      if(sortBy==='dateAdded') return (b.readAt||b.id||0)-(a.readAt||a.id||0);
      if(sortBy==='series') {
        const sa=a.series||''; const sb=b.series||'';
        if(sa!==sb) return sa.localeCompare(sb);
        return (a.sn||999)-(b.sn||999);
      }
      return a.title.localeCompare(b.title);
    });
  },[tabBooks,search,fGenre,fSub,fRead,fSeries,tab,sortBy]);

  const counts=useMemo(()=>({
    shelf:books.length,
    tbr:books.filter((b:any)=>b.status==='tbr').length,
    reading:books.filter((b:any)=>b.status==='reading').length,
    read:books.filter((b:any)=>b.read).length,
    wishlist:books.filter((b:any)=>b.status==='wishlist').length,
  }),[books]);

  const hasFilter=fGenre!=='All'||fSub!=='All'||fRead!=='All'||fSeries!=='All';
  const clearFilters=()=>{setFGenre('All');setFSub('All');setFRead('All');setFSeries('All');};
  const tabColor=TAB_CFG[tab]?.color||'#a78bfa';
  const switchTab=(t:string)=>{setTab(t);clearFilters();setSearch('');setSortBy('title');};

  // Random TBR picker
  const pickRandom = () => {
    const tbrBooks = books.filter(b=>b.status==='tbr');
    if (!tbrBooks.length) return;
    setRandomPick(tbrBooks[Math.floor(Math.random()*tbrBooks.length)]);
  };

  // Share link
  const copyShareLink = () => {
    if (!user) return;
    const url = `${window.location.origin}/share/${user.uid}`;
    navigator.clipboard.writeText(url).then(()=>{
      setShareToast('Link copied!');
      setTimeout(()=>setShareToast(''),2500);
    });
  };

  if(!authReady||loading) return (
    <div style={{ background:'#06040f',minHeight:'100vh',width:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'0.75rem' }}>
      <div style={{ fontSize:'2rem' }}>✦</div>
      <p style={{ color:'#a78bfa' }}>Loading your library…</p>
    </div>
  );

  if(firebaseReady&&!user) return (
    <div style={{ background:'#06040f',minHeight:'100vh',width:'100%',display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem' }}>
      <div style={{ textAlign:'center',maxWidth:'340px' }}>
        <div style={{ fontSize:'3rem',marginBottom:'0.75rem' }}>✦</div>
        <h1 style={{ color:'#e8d9ff',fontWeight:'bold',fontSize:'1.5rem',marginBottom:'0.5rem' }}>My Shelf</h1>
        <p style={{ color:'rgba(255,255,255,0.35)',fontSize:'0.85rem',marginBottom:'2rem',lineHeight:'1.6' }}>Sign in with Google to sync your library across all your devices.</p>
        <button onClick={handleSignIn} style={{ display:'flex',alignItems:'center',gap:'0.75rem',margin:'0 auto',background:'white',color:'#1f1f1f',border:'none',borderRadius:'0.75rem',padding:'0.75rem 1.5rem',fontWeight:'700',fontSize:'0.95rem',cursor:'pointer',boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
        <p style={{ color:'rgba(255,255,255,0.2)',fontSize:'0.7rem',marginTop:'1.5rem' }}>Your data is private and only visible to you.</p>
      </div>
    </div>
  );

  return (
    <div style={{ background:'#06040f',minHeight:'100vh',width:'100vw',maxWidth:'100vw',color:'white',fontFamily:'Georgia,serif',overflowX:'hidden' }}>

      {/* Share toast */}
      {shareToast && (
        <div style={{ position:'fixed',bottom:'1.5rem',left:'50%',transform:'translateX(-50%)',background:'#059669',color:'white',padding:'0.5rem 1.25rem',borderRadius:'9999px',fontSize:'0.8rem',fontWeight:600,zIndex:100,boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
          🔗 {shareToast}
        </div>
      )}

      {/* STICKY HEADER */}
      <div style={{ background:'#0d0a1c',borderBottom:'1px solid rgba(255,255,255,0.07)',position:'sticky',top:0,zIndex:40,width:'100%' }}>
        <div style={{ maxWidth:'960px',margin:'0 auto',padding:'0.6rem 1rem 0' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.4rem' }}>
            <div>
              <div style={{ color:'#e8d9ff',fontWeight:'bold',fontSize:'1rem',letterSpacing:'0.04em' }}>
                ✦ My Shelf
                {syncing&&<span style={{ marginLeft:'0.5rem',fontSize:'0.6rem',color:'#a78bfa',opacity:0.7 }}>syncing…</span>}
              </div>
              <div style={{ color:'rgba(255,255,255,0.3)',fontSize:'0.65rem' }}>{counts.shelf} books · {counts.read} read · {counts.tbr} TBR · {counts.reading} reading · {counts.wishlist} wishlist</div>
            </div>
            <div style={{ display:'flex',alignItems:'center',gap:'0.4rem' }}>
              {user && (
                <button onClick={copyShareLink} title="Copy shareable link" style={{ background:'rgba(244,114,182,0.15)',color:'#f472b6',border:'1px solid rgba(244,114,182,0.3)',borderRadius:'0.65rem',padding:'0.4rem 0.7rem',fontSize:'0.72rem',cursor:'pointer',fontWeight:600 }}>🔗 Share</button>
              )}
              <button onClick={()=>exportCSV(books)} title="Export as CSV" style={{ background:'rgba(96,165,250,0.1)',color:'#60a5fa',border:'1px solid rgba(96,165,250,0.2)',borderRadius:'0.65rem',padding:'0.4rem 0.7rem',fontSize:'0.72rem',cursor:'pointer',fontWeight:600 }}>📤 CSV</button>
              <button onClick={()=>setModal('add')} style={{ background:'#6d28d9',color:'white',border:'none',borderRadius:'0.75rem',padding:'0.45rem 0.9rem',fontWeight:'600',cursor:'pointer',fontSize:'0.82rem' }}>+ Add</button>
              {user&&<img src={user.photoURL} alt="avatar" title={`Signed in as ${user.displayName}\nClick to sign out`} onClick={handleSignOut} style={{ width:'30px',height:'30px',borderRadius:'50%',cursor:'pointer',border:'2px solid rgba(167,139,250,0.4)' }}/>}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex',gap:'0.3rem',marginBottom:'0.4rem' }}>
            {Object.entries(TAB_CFG).map(([k,cfg])=>(
              <button key={k} onClick={()=>switchTab(k)} style={{ flex:1,padding:'0.4rem 0.1rem',borderRadius:'0.65rem',border:`1px solid ${tab===k?cfg.color:'rgba(255,255,255,0.08)'}`,background:tab===k?cfg.color+'22':'transparent',color:tab===k?cfg.color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:'0.6rem',fontWeight:tab===k?700:400 }}>
                {cfg.label}
                {k!=='home'&&<span style={{ opacity:0.6,fontSize:'0.55rem',display:'block' }}>({k==='shelf'?counts.shelf:k==='tbr'?counts.tbr:k==='reading'?counts.reading:counts.wishlist})</span>}
              </button>
            ))}
          </div>

          {tab!=='home'&&(
            <>
              <div style={{ display:'flex',gap:'0.4rem',marginBottom:'0.3rem' }}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search title, author, series…" style={{ flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.65rem',padding:'0.45rem 0.85rem',color:'white',fontSize:'0.82rem',boxSizing:'border-box' }}/>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} style={{ background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.65rem',padding:'0.45rem 0.5rem',color:'rgba(255,255,255,0.6)',fontSize:'0.72rem',cursor:'pointer' }}>
                  <option value="title">A–Z Title</option>
                  <option value="author">Author</option>
                  <option value="series">Series</option>
                  <option value="dateAdded">Date Added</option>
                </select>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:'0.5rem',paddingBottom:'0.45rem' }}>
                <button onClick={()=>setShowFilters(p=>!p)} style={{ fontSize:'0.68rem',padding:'0.25rem 0.65rem',borderRadius:'9999px',border:'1px solid rgba(255,255,255,0.12)',background:'transparent',color:'rgba(255,255,255,0.4)',cursor:'pointer' }}>
                  {showFilters?'▲ Hide':'▼ Filters'}{hasFilter?' ●':''}
                </button>
                {hasFilter&&<button onClick={clearFilters} style={{ fontSize:'0.68rem',color:tabColor,background:'none',border:'none',cursor:'pointer' }}>Clear</button>}
                {tab==='tbr'&&(
                  <button onClick={pickRandom} style={{ fontSize:'0.68rem',padding:'0.25rem 0.65rem',borderRadius:'9999px',border:'1px solid rgba(251,146,60,0.4)',background:'rgba(251,146,60,0.1)',color:'#fb923c',cursor:'pointer' }}>🎲 Surprise me</button>
                )}
                <span style={{ marginLeft:'auto',fontSize:'0.68rem',color:'rgba(255,255,255,0.25)' }}>{filtered.length} shown</span>
              </div>
              {showFilters&&(
                <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:'0.5rem',paddingBottom:'0.5rem' }}>
                  <div style={{ display:'flex',flexDirection:'column',gap:'0.4rem' }}>
                    <div style={{ display:'flex',gap:'0.4rem',flexWrap:'wrap' }}>
                      {['All',...allGenres].map(o=><Pill key={o} label={o} active={fGenre===o} color={GENRE_CFG[o]?.accent||tabColor} onClick={()=>{setFGenre(o);setFSub('All');}}/>)}
                    </div>
                    {fGenre!=='All'&&allSubs.length>0&&(
                      <div style={{ display:'flex',gap:'0.4rem',overflowX:'auto' }}>
                        {['All',...allSubs].map(o=><Pill key={o} label={o} active={fSub===o} color={GENRE_CFG[fGenre]?.accent||tabColor} onClick={()=>setFSub(o)}/>)}
                      </div>
                    )}
                    {tab==='shelf'&&(
                      <div style={{ display:'flex',gap:'0.4rem' }}>
                        {['All','Read','Unread'].map(o=><Pill key={o} label={o} active={fRead===o} color="#34d399" onClick={()=>setFRead(o)}/>)}
                      </div>
                    )}
                    <div style={{ display:'flex',gap:'0.4rem',overflowX:'auto',alignItems:'center' }}>
                      <span style={{ color:'rgba(255,255,255,0.25)',fontSize:'0.68rem',flexShrink:0 }}>Series:</span>
                      {['All',...allSeries].map(o=><Pill key={o} label={o} active={fSeries===o} color="#fbbf24" onClick={()=>setFSeries(o)}/>)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {tab==='home'&&<HomeTab books={books} goals={goals} onEditGoals={()=>setGoalModal(true)} userName="Elle"/>}

      {tab!=='home'&&(
        <div style={{ maxWidth:'960px',margin:'0 auto',padding:'1rem' }}>
          {filtered.length===0?(
            <div style={{ textAlign:'center',padding:'5rem 0',color:'rgba(255,255,255,0.2)' }}>
              <div style={{ fontSize:'3rem',marginBottom:'0.75rem' }}>{tab==='tbr'?'🔖':tab==='reading'?'📖':tab==='wishlist'?'✨':'📭'}</div>
              <p>{tab==='tbr'?'Your TBR pile is empty!':tab==='reading'?'Nothing currently reading.':tab==='wishlist'?'Your wishlist is empty!':'No books match your filters.'}</p>
              {(tab==='tbr'||tab==='reading'||tab==='wishlist')&&<p style={{ fontSize:'0.8rem',marginTop:'0.5rem',opacity:0.6 }}>Use the arrow buttons on any card to move books here.</p>}
            </div>
          ):(
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'0.75rem' }}>
              {filtered.map((b:any)=>{
                const cfg=GENRE_CFG[b.genre]||GENRE_CFG['Fantasy'];
                const bst=b.status||'shelf';
                const isWishlist = bst==='wishlist';
                const moves=Object.entries(TAB_CFG).filter(([k])=>k!=='home'&&k!==bst);
                return(
                  <div key={b.id} style={{ background:isWishlist?'rgba(244,114,182,0.07)':cfg.dim+'66',borderRadius:'1rem',border:`1px solid ${isWishlist?'rgba(244,114,182,0.25)':cfg.accent+'30'}`,borderLeft:`3px solid ${isWishlist?'#f472b6':cfg.accent}`,padding:'0.875rem',paddingTop:'2.1rem',position:'relative',transition:'transform 0.15s' }}
                    onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.01)')} onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}>

                    {/* Status badge on shelf tab */}
                    {tab==='shelf'&&bst!=='shelf'&&(
                      <div style={{ position:'absolute',top:'0.45rem',left:'0.5rem',fontSize:'0.58rem',padding:'0.15rem 0.5rem',borderRadius:'9999px',background:(STATUS_COLORS as any)[bst]+'22',border:`1px solid ${(STATUS_COLORS as any)[bst]}`,color:(STATUS_COLORS as any)[bst],fontWeight:600 }}>
                        {bst==='tbr'?'🔖 TBR':bst==='reading'?'📖 Reading':'✨ Wishlist'}
                      </div>
                    )}

                    {/* Move buttons */}
                    {tab!=='shelf'&&(
                      <div style={{ position:'absolute',top:'0.45rem',left:'0.5rem',display:'flex',gap:'0.25rem',flexWrap:'wrap' }}>
                        {moves.slice(0,3).map(([k,c2])=>(
                          <button key={k} onClick={()=>update(b.id,{status:k})} style={{ fontSize:'0.55rem',padding:'0.15rem 0.35rem',borderRadius:'9999px',border:`1px solid ${c2.color}`,background:c2.color+'18',color:c2.color,cursor:'pointer',whiteSpace:'nowrap' }}>
                            →{k==='shelf'?'Shelf':k==='tbr'?'TBR':k==='reading'?'Reading':'Wishlist'}
                          </button>
                        ))}
                      </div>
                    )}
                    {tab==='shelf'&&bst==='shelf'&&(
                      <div style={{ position:'absolute',top:'0.45rem',left:'0.5rem',display:'flex',gap:'0.25rem' }}>
                        {moves.filter(([k])=>k!=='wishlist').map(([k,c2])=>(
                          <button key={k} onClick={()=>update(b.id,{status:k})} style={{ fontSize:'0.55rem',padding:'0.15rem 0.35rem',borderRadius:'9999px',border:`1px solid ${c2.color}`,background:c2.color+'18',color:c2.color,cursor:'pointer',whiteSpace:'nowrap' }}>
                            →{k==='tbr'?'TBR':'Reading'}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Read toggle for shelf + reading */}
                    {(bst==='shelf'||bst==='reading')&&(
                      <>
                        {pendingRead?.id===b.id?(
                          <div style={{ position:'absolute',top:'0.4rem',right:'0.5rem',display:'flex',alignItems:'center',gap:'0.3rem' }}>
                            <input type="number" value={pendingRead.year} onChange={e=>setPendingRead({...pendingRead,year:e.target.value})} placeholder={String(THIS_YEAR)}
                              style={{ width:'62px',background:'rgba(255,255,255,0.08)',border:'1px solid #34d399',borderRadius:'0.4rem',padding:'0.15rem 0.35rem',color:'white',fontSize:'0.65rem',textAlign:'center' }} autoFocus/>
                            <button onClick={()=>{ const yr=Number(pendingRead.year)||THIS_YEAR; update(b.id,{status:'shelf',read:true,readAt:Date.now(),readYear:yr}); setPendingRead(null); }} style={{ fontSize:'0.62rem',padding:'0.2rem 0.4rem',borderRadius:'9999px',border:'1px solid #34d399',background:'#05653044',color:'#34d399',cursor:'pointer',fontWeight:700 }}>✓</button>
                            <button onClick={()=>setPendingRead(null)} style={{ fontSize:'0.62rem',padding:'0.2rem 0.35rem',borderRadius:'9999px',border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'rgba(255,255,255,0.35)',cursor:'pointer' }}>✕</button>
                          </div>
                        ):(
                          <button onClick={()=>{ if(bst==='shelf'&&b.read){update(b.id,{read:false});}else{setPendingRead({id:b.id,year:String(THIS_YEAR)});} }}
                            style={{ position:'absolute',top:'0.5rem',right:'0.5rem',fontSize:'0.62rem',padding:'0.2rem 0.45rem',borderRadius:'9999px',fontWeight:500,cursor:'pointer',border:'1px solid',...(b.read?{background:'#05653044',borderColor:'#34d399',color:'#34d399'}:{background:'rgba(255,255,255,0.04)',borderColor:'rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.3)'}) }}>
                            {b.read?`✓ Read ${b.readYear&&b.readYear!==THIS_YEAR?b.readYear:''}`.trim():bst==='reading'?'✓ Finished':'Unread'}
                          </button>
                        )}
                      </>
                    )}

                    <div style={{ fontWeight:'bold',color:'white',fontSize:'0.875rem',lineHeight:'1.3',paddingRight:'3.5rem',marginBottom:'0.2rem' }}>{b.title}</div>
                    <div style={{ fontSize:'0.75rem',color:isWishlist?'#f472b6bb':cfg.accent+'bb',marginBottom:'0.2rem' }}>{b.author}</div>
                    {b.series&&<div style={{ fontSize:'0.7rem',color:'rgba(255,255,255,0.28)' }}>{b.series}{b.sn!=null?` #${b.sn}`:''}</div>}

                    {/* Rating display */}
                    {b.rating && <div style={{ marginTop:'0.3rem' }}><StarRating rating={b.rating} size="sm"/></div>}

                    {/* Note snippet */}
                    {b.note && <div style={{ fontSize:'0.62rem',color:'rgba(255,255,255,0.3)',marginTop:'0.3rem',fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>"{b.note}"</div>}

                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'0.5rem' }}>
                      <div style={{ display:'flex',gap:'0.35rem',flexWrap:'wrap',alignItems:'center' }}>
                        <span style={{ fontSize:'0.65rem',padding:'0.15rem 0.5rem',borderRadius:'9999px',background:isWishlist?'rgba(244,114,182,0.15)':cfg.dim,color:isWishlist?'#f472b6':cfg.accent }}>{b.genre}</span>
                        {b.subgenre&&<span style={{ fontSize:'0.62rem',color:'rgba(255,255,255,0.22)' }}>{b.subgenre}</span>}
                      </div>
                      <div style={{ display:'flex',gap:'0.4rem' }}>
                        <button onClick={()=>setEditBook(b)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.25)',cursor:'pointer',fontSize:'0.9rem' }}>✎</button>
                        <button onClick={()=>setDelId(b.id)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.25)',cursor:'pointer',fontSize:'0.9rem' }}>✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modal==='add'&&<ModalForm book={null} tab={tab==='home'?'shelf':tab} allSeries={allSeries} allBooks={books} onSave={b=>{persist([...books,b]);setModal(null);}} onSaveMany={bs=>{persist([...books,...bs]);setModal(null);}} onClose={()=>setModal(null)}/>}
      {editBook&&<ModalForm book={editBook} tab={tab==='home'?'shelf':tab} allSeries={allSeries} allBooks={books} onSave={b=>{persist(books.map((x:any)=>x.id===b.id?b:x));setEditBook(null);}} onSaveMany={()=>{}} onClose={()=>setEditBook(null)}/>}
      {goalModal&&<GoalSetModal goals={goals} onSave={g=>{persistGoals(g);setGoalModal(false);}} onClose={()=>setGoalModal(false)}/>}

      {/* Random pick modal */}
      {randomPick&&(
        <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.8)',padding:'1rem' }}>
          <div style={{ background:'#0e0b1a',border:'1px solid rgba(251,146,60,0.3)',borderRadius:'1rem',padding:'1.75rem',width:'100%',maxWidth:'360px',textAlign:'center' }}>
            <div style={{ fontSize:'2rem',marginBottom:'0.5rem' }}>🎲</div>
            <div style={{ fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',marginBottom:'0.75rem' }}>Your next read should be…</div>
            <div style={{ fontSize:'1.1rem',fontWeight:'bold',color:'white',marginBottom:'0.3rem' }}>{randomPick.title}</div>
            <div style={{ fontSize:'0.85rem',color:GENRE_CFG[randomPick.genre]?.accent||'#a78bfa',marginBottom:'0.25rem' }}>{randomPick.author}</div>
            {randomPick.series&&<div style={{ fontSize:'0.75rem',color:'rgba(255,255,255,0.3)',marginBottom:'1rem' }}>{randomPick.series}{randomPick.sn!=null?` #${randomPick.sn}`:''}</div>}
            <div style={{ display:'flex',gap:'0.75rem',marginTop:'1rem' }}>
              <button onClick={pickRandom} style={{ flex:1,background:'rgba(251,146,60,0.15)',color:'#fb923c',border:'1px solid rgba(251,146,60,0.3)',borderRadius:'0.75rem',padding:'0.6rem',cursor:'pointer',fontWeight:600 }}>Try again 🎲</button>
              <button onClick={()=>setRandomPick(null)} style={{ flex:1,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.5)',border:'none',borderRadius:'0.75rem',padding:'0.6rem',cursor:'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {delId&&(
        <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.75)',padding:'1rem' }}>
          <div style={{ background:'#0e0b1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'1rem',padding:'1.5rem',width:'100%',maxWidth:'320px' }}>
            <h3 style={{ color:'white',fontWeight:'bold',marginBottom:'0.375rem' }}>Remove this book?</h3>
            <p style={{ color:'rgba(255,255,255,0.4)',fontSize:'0.85rem',marginBottom:'1.25rem' }}>This cannot be undone.</p>
            <div style={{ display:'flex',gap:'0.75rem' }}>
              <button onClick={()=>{persist(books.filter((b:any)=>b.id!==delId));setDelId(null);}} style={{ flex:1,background:'#dc2626',color:'white',border:'none',borderRadius:'0.75rem',padding:'0.625rem',fontWeight:'600',cursor:'pointer' }}>Remove</button>
              <button onClick={()=>setDelId(null)} style={{ flex:1,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.5)',border:'none',borderRadius:'0.75rem',padding:'0.625rem',cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

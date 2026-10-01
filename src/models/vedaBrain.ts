// Trilingual brain — replies in the SAME language the user spoke.
// Supports: English, Hindi (Devanagari), Gujarati (Gujarati script + roman).

export type Lang = "en" | "hi" | "gu";
export type BrainReply = { text: string; action?: string; timerSeconds?: number; lang: Lang; fun?: boolean };

const GU_KEYWORDS = ["tame", "tamaru", "tamaro", "tamari", "kem", "cho", "chho", "shu", "su ", " karo", "karo", "bhai", "majama", "kemcho", "kevo", "kevi", "samjyu", "avjo", "aabhar", "shukriya nahi", "vagya", "tarikh", "majak", "hassavu", "khol", "kholu", "gano", "vat", "vaat"];
const HI_KEYWORDS = ["aap", "tum", "kya", "hai", "hain", "kaise", "kaise ho", "kaun", "mera", "meri", "mera naam", "namaste", "shukriya", "dhanyavad", "kitne", "baje", "tarikh", "aaj", "maj ak", "majak", "kholo", "khol", "gaana", "samay", "batao", "bataiye", "suno"];

export function detectLang(text: string): Lang {
  const t = text.toLowerCase();
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu"; // Gujarati script
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Devanagari script
  const guHits = GU_KEYWORDS.filter((k) => t.includes(k)).length;
  const hiHits = HI_KEYWORDS.filter((k) => t.includes(k)).length;
  if (guHits > 0 && guHits >= hiHits) return "gu";
  if (hiHits > 0) return "hi";
  return "en";
}

const JOKES: Record<Lang, string[]> = {
  en: [
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "Why did the developer go broke? He used up all his cache.",
    "There are only ten kinds of people. Those who understand binary and those who do not.",
    "Why do Java developers wear glasses? Because they do not C sharp.",
  ],
  hi: [
    "Programmer dark mode kyun pasand karte hain? Kyunki light mein bugs aate hain.",
    "Developer kangal kyun ho gaya? Usne apna saara cache kharch kar diya.",
    "Duniya mein sirf das tarah ke log hote hain. Jo binary samajhte hain, aur jo nahi samajhte.",
    "Computer ne chhutti maangi, ab woh mujhe KitKat ke vigyapan bhejta rehta hai.",
  ],
  gu: [
    "Programmer dark mode kem pasand kare? Karan ke light ma bugs ave!",
    "Developer kangal kem thai gayo? Ene badho cache vapri nakhyo.",
    "Duniya ma fakt das prakar na loko che. Je binary samje, ane je na samje.",
    "Computer e raja mangi, have e mane KitKat ni jaherat mokle j kare che.",
  ],
};

const FACTS: Record<Lang, string[]> = {
  en: [
    "Honey never spoils. Three-thousand-year-old honey found in tombs is still edible.",
    "Octopuses have three hearts. Two stop beating when they swim.",
    "Bananas are berries, but strawberries are not.",
    "Sharks existed before trees, by about fifty million years.",
  ],
  hi: [
    "Shahad kabhi kharab nahi hota. Hazaaron saal purana shahad bhi khane layak milta hai.",
    "Octopus ke teen dil hote hain. Tairte samay do ruk jaate hain.",
    "Kela berry hai, lekin strawberry berry nahi hai.",
    "Shark pedon se lagbhag paanch crore saal pehle se hain.",
  ],
  gu: [
    "Madh kadhi bagde nahi. Hajaaro varsh junun madh pan khava layak male che.",
    "Octopus ne tran hraday hoy che. Tarti vakhte be ubha rahi jay che.",
    "Kela berry che, pan strawberry berry nathi.",
    "Shark zad thi lagbhag paanch crore varsh pela thi che.",
  ],
};

const T = {
  hello: {
    en: (n: string) => `Hello ${n}. All systems online. What would you like to know?`,
    hi: (n: string) => `Namaste ${n}. Saare system online hain. Aap kya jaanna chahte hain?`,
    gu: (n: string) => `Namaste ${n}. Badha system online che. Tame su janva mango cho?`,
  },
  howareyou: {
    en: (n: string) => `I am operating at full capacity, ${n}. How can I help you today?`,
    hi: (n: string) => `Main poori kshamta par kaam kar raha hoon, ${n}. Aaj main aapki kya madad kar sakta hoon?`,
    gu: (n: string) => `Hu puri kshamta par kam kari rahyo chu, ${n}. Aaje hu tamari su madad karu?`,
  },
  whoami: {
    en: () => `I am Veda, your personal voice assistant. Ask me anything, just like Siri.`,
    hi: () => `Main Veda hoon, aapka niji voice assistant. Siri ki tarah mujhse kuch bhi poochhiye.`,
    gu: () => `Hu Veda chu, tamaro niji voice assistant. Siri ni jem mane kai pan puchho.`,
  },
  thanks: {
    en: (n: string) => `Always at your service, ${n}.`,
    hi: (n: string) => `Hamesha aapki seva mein, ${n}.`,
    gu: (n: string) => `Hammesha tamari seva ma, ${n}.`,
  },
  bye: {
    en: (n: string) => `Goodbye, ${n}. I will be right here whenever you need me.`,
    hi: (n: string) => `Alvida, ${n}. Jab bhi zaroorat ho, main yahin rahunga.`,
    gu: (n: string) => `Avjo, ${n}. Jyare jarur hoy tyare hu ahin j malsu.`,
  },
  help: {
    en: (n: string) => `I am Veda, your AI agent, ${n}. Ask me anything: time, calculations, weather in any city, word meanings, jokes, facts, timers, websites, or knowledge questions like: who is Albert Einstein.`,
    hi: (n: string) => `Main Veda hoon, aapka AI agent, ${n}. Mujhse kuch bhi poochhiye: samay, hisaab, kisi bhi sheher ka mausam, shabd ka arth, chutkule, tathya, timer, website, ya gyaan ke sawaal.`,
    gu: (n: string) => `Hu Veda chu, tamaro AI agent, ${n}. Mane kai pan puchho: samay, hisab, koi pan shaher nu havaman, shabd no arth, joke, hakeekat, timer, website ke gnyan na saval.`,
  },
  time: {
    en: (n: string, v: string) => `The current time is ${v}, ${n}.`,
    hi: (n: string, v: string) => `Is samay ${v} baje hain, ${n}.`,
    gu: (n: string, v: string) => `Atyare ${v} vagya che, ${n}.`,
  },
  date: {
    en: (n: string, v: string) => `Today is ${v}, ${n}.`,
    hi: (n: string, v: string) => `Aaj ${v} hai, ${n}.`,
    gu: (n: string, v: string) => `Aaje ${v} che, ${n}.`,
  },
  timer: {
    en: (n: string, v: string) => `Timer set for ${v}, ${n}. I will notify you.`,
    hi: (n: string, v: string) => `${v} ka timer laga diya hai, ${n}. Samay poora hote hi bataunga.`,
    gu: (n: string, v: string) => `${v} no timer muki didho che, ${n}. Samay puro thata kahis.`,
  },
  timerDone: {
    en: `Your timer is done.`,
    hi: `Aapka timer poora ho gaya hai.`,
    gu: `Tamaro timer puro thai gayo che.`,
  },
  open: {
    en: (n: string, v: string) => `Opening ${v}, ${n}.`,
    hi: (n: string, v: string) => `${v} khol raha hoon, ${n}.`,
    gu: (n: string, v: string) => `${v} kholu chu, ${n}.`,
  },
  search: {
    en: (n: string, v: string) => `I searched the web for ${v}, ${n}. Opening the results for you.`,
    hi: (n: string, v: string) => `Maine ${v} ke liye web par khoja, ${n}. Parinaam khol raha hoon.`,
    gu: (n: string, v: string) => `Me ${v} mate web par shodhyu, ${n}. Parinam kholu chu.`,
  },
  math: {
    en: (n: string, v: number) => `That equals ${v}, ${n}.`,
    hi: (n: string, v: number) => `Iska uttar ${v} hai, ${n}.`,
    gu: (n: string, v: number) => `Eno jawab ${v} che, ${n}.`,
  },
  nameSaved: {
    en: (v: string) => `Nice to meet you, ${v}. I will remember your name from now on.`,
    hi: (v: string) => `Aapse milkar khushi hui, ${v}. Ab se main aapka naam yaad rakhunga.`,
    gu: (v: string) => `Tamne maline anand thayo, ${v}. Have thi hu tamaru naam yaad rakhis.`,
  },
  nameKnown: {
    en: (v: string) => `Your name is ${v}, of course. I never forget.`,
    hi: (v: string) => `Aapka naam ${v} hai, bilkul. Main kabhi nahi bhoolta.`,
    gu: (v: string) => `Tamaru naam ${v} che, chokkas. Hu kadhi bhulto nathi.`,
  },
  nameUnknown: {
    en: `You have not told me your name yet. Say: my name is, followed by your name.`,
    hi: `Aapne abhi tak apna naam nahi bataya. Kahiye: mera naam hai, aur phir apna naam.`,
    gu: `Tame mane hamna sudhi tamaru naam kidhu nathi. KahO: maru naam che, ane pachhi tamaru naam.`,
  },
  fallback: {
    en: (n: string) => `I did not catch that, ${n}. Please ask again.`,
    hi: (n: string) => `Main samajh nahi paya, ${n}. Kripya dobara kahiye.`,
    gu: (n: string) => `Hu samji shakyo nahi, ${n}. Krupaya fari kaho.`,
  },
  whereFrom: {
    en: (n: string) => `I live right here, inside this website, ${n}. Wherever you go, I come along.`,
    hi: (n: string) => `Main yahin rehta hoon, is website ke andar, ${n}. Aap jahan, main wahan.`,
    gu: (n: string) => `Hu ahin j rahu chu, aa website ni andar, ${n}. Tame jya, hu tya.`,
  },
  askName: {
    en: `Sorry, I didn't catch your name. Please tell me your name.`,
    hi: `Maaf kijiye, main aapka naam samajh nahi paya. Kripya apna naam batayiye.`,
    gu: `Maaf karsho, hu tamaru naam samji shakyo nahi. Krupaya tamaru naam kaho.`,
  },
};

// words that can never be a person's name
const NAME_BLOCK = new Set([
  "hello", "helo", "hallo", "hi", "hii", "hey", "yo", "yes", "no", "ok", "okay",
  "thanks", "thank", "please", "sorry", "bye", "good", "morning", "evening", "night",
  "namaste", "namaskar", "kem", "cho", "chho", "kemcho", "kaise", "kaiseho", "kya", "hai",
  "su", "shu", "tame", "tamaru", "aap", "tum", "my", "mera", "meri", "maru", "naam", "name",
  "sir", "time", "date", "joke", "timer", "open", "play", "tell", "what", "who",
]);

export function isBadName(v: string): boolean {
  const words = v.toLowerCase().replace(/[^a-z\u0900-\u097F\u0A80-\u0AFF ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return true;
  return words.every((x) => NAME_BLOCK.has(x));
}

function getName(): string {
  try { return localStorage.getItem("veda_name") || ""; } catch { return ""; }
}
function sirName(lang: Lang): string {
  const n = getName();
  if (n) return n;
  return lang === "en" ? "sir" : lang === "hi" ? "sir" : "sir";
}

function safeCalc(expr: string): number | null {
  if (!/^[\d\s+\-*/%().^]+$/.test(expr) || !/\d/.test(expr)) return null;
  try {
    const js = expr.replace(/\^/g, "**");
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${js})`)() as number;
    if (typeof val !== "number" || !isFinite(val)) return null;
    return Math.round(val * 1000000) / 1000000;
  } catch { return null; }
}

function wordsToMath(s: string): string | null {
  let x = ` ${s} `;
  // English
  x = x.replace(/multiplied by|multiply by|\btimes\b|\bx\b/g, "*");
  x = x.replace(/divided by|divide by|\bover\b/g, "/");
  x = x.replace(/\bplus\b|\badd\b/g, "+");
  x = x.replace(/\bminus\b|\bsubtract\b|\bless\b/g, "-");
  // Hindi
  x = x.replace(/guna|gunan|gune|jod| जमा |jama|plus karo/g, (m) => (m.includes("jod") || m.includes("jama") || m.includes("जोड़") ? "+" : "*"));
  x = x.replace(/जोड़|जमा|जोड़ो/g, "+").replace(/घटा|घटाओ|माइनस/g, "-").replace(/गुणा|गुना/g, "*").replace(/भाग|बटा|डिवाइड/g, "/");
  // Gujarati
  x = x.replace(/વત્તા|ઉમેરો|સરવાળો|plus karo/g, "+").replace(/બાદબાકી|ઓછા|માઇનસ/g, "-").replace(/ગુણ્યા|ગુણાકાર/g, "*").replace(/ભાગ્યા|ભાગાકાર/g, "/");
  x = x.replace(/what is|what's|calculate|compute|solve|please|kitna|kya hai|batao|શું|કેટલા|કેટલું/g, " ");
  x = x.replace(/percent of|% of|प्रतिशत|ટકા/g, "%*");
  x = x.replace(/power of|to the power of|\*\*|घात|ઘાત/g, "^");
  x = x.replace(/[^0-9+\-*/%().^ ]/g, " ").replace(/\s+/g, " ").trim();
  if (!x || !/\d/.test(x) || !/^[\d\s+\-*/%().^]+$/.test(x)) return null;
  return x;
}

async function fetchJson(url: string, ms = 6000): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function trimSpoken(s: string, max = 450): string {
  const cut = s.length > max ? s.slice(0, max) : s;
  const lastDot = cut.lastIndexOf(". ");
  const out = lastDot > 120 ? cut.slice(0, lastDot + 1) : cut;
  return out.length > 420 ? out.slice(0, 420) + "." : out;
}

// DuckDuckGo instant answers — direct facts, no key needed
async function ddgAbstract(topic: string): Promise<string | null> {
  const j = await fetchJson(`https://api.duckduckgo.com/?q=${encodeURIComponent(topic)}&format=json&no_html=1&skip_disambig=1`) as { AbstractText?: string } | null;
  const a = j?.AbstractText?.trim();
  if (a && a.length > 30) return trimSpoken(a);
  return null;
}

// English dictionary — meanings, no key needed
async function dictDefine(word: string): Promise<string | null> {
  const j = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`) as Array<{ meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string }> }> }> | null;
  const def = j?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
  const pos = j?.[0]?.meanings?.[0]?.partOfSpeech;
  if (def) return `${word} (${pos || "word"}): ${trimSpoken(def, 300)}`;
  return null;
}

// Live weather — open-meteo, no key needed
function wmoText(code: number, lang: Lang): string {
  if (code === 0) return lang === "hi" ? "saaf aasmaan" : lang === "gu" ? "chokhu aakash" : "clear sky";
  if (code <= 2) return lang === "hi" ? "halke baadal" : lang === "gu" ? "ochha vadad" : "partly cloudy";
  if (code === 3) return lang === "hi" ? "ghane baadal" : lang === "gu" ? "bhad vadad" : "overcast clouds";
  if (code === 45 || code === 48) return lang === "hi" ? "kohra" : lang === "gu" ? "dhummas" : "fog";
  if (code >= 51 && code <= 82) return lang === "hi" ? "barish" : lang === "gu" ? "varsad" : "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return lang === "hi" ? "barfbaari" : lang === "gu" ? "baraf" : "snow";
  if (code >= 95) return lang === "hi" ? "garaj ke saath barish" : lang === "gu" ? "gadgadat sathe varsad" : "thunderstorm";
  return lang === "hi" ? "badla hua mausam" : lang === "gu" ? "badlayelu havaman" : "changing weather";
}

async function weatherNow(cityRaw: string, lang: Lang): Promise<string | null> {
  const city = cityRaw.trim();
  if (!city) return null;
  const g = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`) as { results?: Array<{ latitude: number; longitude: number; name: string }> } | null;
  const loc = g?.results?.[0];
  if (!loc) return null;
  const f = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code`) as { current?: { temperature_2m: number; weather_code: number } } | null;
  if (f?.current == null) return null;
  const temp = Math.round(f.current.temperature_2m);
  const cond = wmoText(f.current.weather_code, lang);
  const name = loc.name;
  if (lang === "hi") return `${name} mein is samay ${temp} degree Celsius hai, ${cond}.`;
  if (lang === "gu") return `${name} ma atyare ${temp} degree Celsius che, ${cond}.`;
  return `It is ${temp} degrees Celsius with ${cond} in ${name}.`;
}

async function wikiSummary(topic: string, lang: Lang): Promise<string | null> {
  const subs = lang === "en" ? ["en"] : [lang, "en"];
  for (const sub of subs) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(`https://${sub}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      const j = await r.json();
      if (j?.extract) {
        const short = (j.extract as string).split(". ").slice(0, 2).join(". ");
        return short.length > 450 ? short.slice(0, 450) + "." : short;
      }
    } catch { /* try next */ }
  }
  return null;
}

const SITES: Record<string, string> = {
  youtube: "https://youtube.com", google: "https://google.com", gmail: "https://mail.google.com",
  maps: "https://maps.google.com", github: "https://github.com", instagram: "https://instagram.com",
  facebook: "https://facebook.com", twitter: "https://x.com", netflix: "https://netflix.com",
  spotify: "https://open.spotify.com", whatsapp: "https://web.whatsapp.com", amazon: "https://amazon.com",
};

// Fast offline actions — used first even in cloud mode (speed + reliability).
// Returns null when the request needs open knowledge/conversation (cloud or web).
export function tryLocalAction(input: string): BrainReply | null {
  const raw = input.trim();
  if (!raw) return null;
  const lang: Lang = detectLang(raw);
  const s = raw.toLowerCase();
  const n = sirName(lang);
  const locale = lang === "hi" ? "hi-IN" : lang === "gu" ? "gu-IN" : "en-US";

  const nameMatch = s.match(/(?:my name is|call me|i am called|mera naam(?: hai)?|meraa naam|maru naam(?: che)?|मेरा नाम(?: है)?|મારું નામ)\s+([a-z\u0900-\u097F\u0A80-\u0AFF]+)/);
  if (nameMatch) {
    if (isBadName(nameMatch[1])) return { text: T.askName[lang], lang };
    const v = nameMatch[1][0].toUpperCase() + nameMatch[1].slice(1);
    try { localStorage.setItem("veda_name", v); } catch {}
    return { text: T.nameSaved[lang](v), lang };
  }
  if (/(what is my name|what's my name|do you know my name|mera naam kya|मेरा नाम क्या|maru naam su|મારું નામ શું)/.test(s)) {
    const saved = getName();
    return { text: saved ? T.nameKnown[lang](saved) : T.nameUnknown[lang], lang };
  }
  if (/^(hi|hello|hey|namaste|नमस्ते|kem cho|kemcho|કેમ છો|कैसे हो|kaise ho)\b/.test(s) || s.includes("hello veda") || s === "hi")
    return { text: T.hello[lang](n), lang };
  if (/(how are you|how r u|kaise ho|kaisi ho|कैसे हो|kem cho|kem chho|કેમ છો|majama|मजे में)/.test(s))
    return { text: T.howareyou[lang](n), lang };
  if (/(who are you|your name|tum kaun|तुम कौन|tame kon|તમે કોણ)/.test(s))
    return { text: T.whoami[lang](), lang };
  if (/(thank|shukriya|dhanyavad|धन्यवाद|aabhar|આભાર)/.test(s))
    return { text: T.thanks[lang](n), lang };
  if (/(bye|good night|goodnight|see you|shutdown|alvida|अलविदा|avjo|આવજો)/.test(s))
    return { text: T.bye[lang](n), lang };
  if (/(help|what can you do|madad|मदद|madad karo|help karo)/.test(s))
    return { text: T.help[lang](n), lang };
  if (/(where are you from|tum kahan se|तुम कहाँ से|tame kya na|તમે ક્યાંના|where do you live)/.test(s))
    return { text: T.whereFrom[lang](n), lang };
  if (/(time|samay|समय|vagya|वाजे|સમય|ketla vagya|kitne baje)/.test(s) && !s.includes("timer"))
    return { text: T.time[lang](n, new Date().toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })), lang };
  if (/(date|today|tarikh|तारीख|aaj|आज|aaje|આજે)/.test(s))
    return { text: T.date[lang](n, new Date().toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })), lang };
  const timerMatch = s.match(/timer.*?(\d+)\s*(second|minute|hour|सेकंड|सेकेण्ड|मिनट|घंटा|second|sekand|મિનિટ|કલાક)/);
  if (s.includes("timer") && timerMatch) {
    const num = parseInt(timerMatch[1], 10);
    const unit = timerMatch[2];
    const secs = /hour|घंटा|કલાક/.test(unit) ? num * 3600 : /minute|मिनट|મિનિટ/.test(unit) ? num * 60 : num;
    if (secs > 0 && secs <= 7200) {
      const label = lang === "en" ? `${num} ${/hour/.test(unit) ? "hour" : /minute/.test(unit) ? "minute" : "second"}${num > 1 ? "s" : ""}` : `${num} ${unit}`;
      return { text: T.timer[lang](n, label), lang, timerSeconds: secs };
    }
  }
  if (/(joke|funny|make me laugh|chutkula|चुटकुला|hassavu|मजाक|majak|majaak|જોક|મજાક)/.test(s))
    return { text: JOKES[lang][Math.floor(Math.random() * JOKES[lang].length)], lang, fun: true };
  if (/(fact|interesting|rochak|रोचक|hakeekat|હકીકત|gyan|ज्ञान|જ્ઞાન)/.test(s))
    return { text: FACTS[lang][Math.floor(Math.random() * FACTS[lang].length)], lang };
  if (/(calculate|compute|solve|what is|what's|how much|plus|minus|times|multiplied|divided|percent|\+|-|\*|\/|hisab|hisaab|हिसाब|kitna|कितना|jod|जोड़|guna|गुणा|bhag|भाग|શું|કેટલા|gunya|ગુણ્યા|vadhare|વત્તા|badbaki|બાદ)/.test(s)) {
    const expr = wordsToMath(s);
    if (expr) {
      const val = safeCalc(expr);
      if (val !== null) return { text: T.math[lang](n, val), lang };
    }
  }
  for (const [k, url] of Object.entries(SITES)) {
    if (s.includes(`open ${k}`) || s === k || (s.includes(k) && /(open|khol|खोल|ખોલ)/.test(s)))
      return { text: T.open[lang](n, k), lang, action: url };
  }
  const openMatch = s.match(/open\s+([a-z0-9.-]+\.[a-z]{2,})/);
  if (openMatch) {
    const url = openMatch[1].startsWith("http") ? openMatch[1] : `https://${openMatch[1]}`;
    return { text: T.open[lang](n, openMatch[1]), lang, action: url };
  }
  if (/(play.*(music|song)|music.*play|gaana|गाना|gano|ગાનું|music vagad)/.test(s))
    return { text: T.open[lang](n, "music"), lang, action: "https://music.youtube.com" };
  return null;
}

export async function getVedaReply(input: string, forceLang?: Lang): Promise<BrainReply> {  const raw = input.trim();
  const lang: Lang = forceLang || detectLang(raw);
  const s = raw.toLowerCase();
  const n = sirName(lang);
  const locale = lang === "hi" ? "hi-IN" : lang === "gu" ? "gu-IN" : "en-US";

  // name remember (all 3 languages)
  const nameMatch = s.match(/(?:my name is|call me|i am called|mera naam(?: hai)?|meraa naam|maru naam(?: che)?|मेरा नाम(?: है)?|મારું નામ)\s+([a-z\u0900-\u097F\u0A80-\u0AFF]+)/);
  if (nameMatch) {
    if (isBadName(nameMatch[1])) return { text: T.askName[lang], lang };
    const v = nameMatch[1][0].toUpperCase() + nameMatch[1].slice(1);
    try { localStorage.setItem("veda_name", v); } catch {}
    return { text: T.nameSaved[lang](v), lang };
  }
  if (/(what is my name|what's my name|do you know my name|mera naam kya|मेरा नाम क्या|maru naam su|મારું નામ શું)/.test(s)) {
    const saved = getName();
    return { text: saved ? T.nameKnown[lang](saved) : T.nameUnknown[lang], lang };
  }

  // greetings
  if (/^(hi|hello|hey|namaste|नमस्ते|kem cho|kemcho|કેમ છો|कैसे हो|kaise ho)\b/.test(s) || s.includes("hello veda") || s === "hi")
    return { text: T.hello[lang](n), lang };

  if (/(how are you|how r u|kaise ho|kaisi ho|कैसे हो|kem cho|kem chho|કેમ છો|majama|मजे में)/.test(s))
    return { text: T.howareyou[lang](n), lang };

  if (/(who are you|your name|tum kaun|तुम कौन|tame kon|તમે કોણ)/.test(s))
    return { text: T.whoami[lang](), lang };

  if (/(thank|shukriya|dhanyavad|धन्यवाद|aabhar|આભાર)/.test(s))
    return { text: T.thanks[lang](n), lang };

  if (/(bye|good night|goodnight|see you|shutdown|alvida|अलविदा|avjo|આવજો)/.test(s))
    return { text: T.bye[lang](n), lang };

  if (/(help|what can you do|madad|मदद|madad karo|help karo)/.test(s))
    return { text: T.help[lang](n), lang };

  if (/(where are you from|tum kahan se|तुम कहाँ से|tame kya na|તમે ક્યાંના|where do you live)/.test(s))
    return { text: T.whereFrom[lang](n), lang };

  // time / date
  if (/(time|samay|समय|vagya|वाजे|સમય|ketla vagya|kitne baje)/.test(s) && !s.includes("timer"))
    return { text: T.time[lang](n, new Date().toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })), lang };
  if (/(date|today|tarikh|तारीख|aaj|आज|aaje|આજે)/.test(s))
    return { text: T.date[lang](n, new Date().toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })), lang };

  // timer
  const timerMatch = s.match(/timer.*?(\d+)\s*(second|minute|hour|सेकंड|सेकेण्ड|मिनट|घंटा|second|sekand|મિનિટ|કલાક)/);
  if (s.includes("timer") && timerMatch) {
    const num = parseInt(timerMatch[1], 10);
    const unit = timerMatch[2];
    const secs = /hour|घंटा|કલાક/.test(unit) ? num * 3600 : /minute|मिनट|મિનિટ/.test(unit) ? num * 60 : num;
    if (secs > 0 && secs <= 7200) {
      const label = lang === "en" ? `${num} ${/hour/.test(unit) ? "hour" : /minute/.test(unit) ? "minute" : "second"}${num > 1 ? "s" : ""}` : `${num} ${unit}`;
      return { text: T.timer[lang](n, label), lang, timerSeconds: secs };
    }
  }

  // jokes / facts
  if (/(joke|funny|make me laugh|chutkula|चुटकुला|hassavu|मजाक|majak|majaak|જોક|મજાક)/.test(s))
    return { text: JOKES[lang][Math.floor(Math.random() * JOKES[lang].length)], lang, fun: true };
  if (/(fact|interesting|rochak|रोचक|hakeekat|હકીકત|gyan|ज्ञान|જ્ઞાન)/.test(s))
    return { text: FACTS[lang][Math.floor(Math.random() * FACTS[lang].length)], lang };

  // math
  if (/(calculate|compute|solve|what is|what's|how much|plus|minus|times|multiplied|divided|percent|\+|-|\*|\/|hisab|hisaab|हिसाब|kitna|कितना|jod|जोड़|guna|गुणा|bhag|भाग|શું|કેટલા|gunya|ગુણ્યા|vadhare|વત્તા|badbaki|બાદ)/.test(s)) {
    const expr = wordsToMath(s);
    if (expr) {
      const val = safeCalc(expr);
      if (val !== null) return { text: T.math[lang](n, val), lang };
    }
  }

  // open sites
  for (const [k, url] of Object.entries(SITES)) {
    if (s.includes(`open ${k}`) || s === k || (s.includes(k) && /(open|khol|खोल|ખોલ)/.test(s)))
      return { text: T.open[lang](n, k), lang, action: url };
  }
  const openMatch = s.match(/open\s+([a-z0-9.-]+\.[a-z]{2,})/);
  if (openMatch) {
    const url = openMatch[1].startsWith("http") ? openMatch[1] : `https://${openMatch[1]}`;
    return { text: T.open[lang](n, openMatch[1]), lang, action: url };
  }
  if (/(play.*(music|song)|music.*play|gaana|गाना|gano|ગાનું|music vagad)/.test(s))
    return { text: T.open[lang](n, "music"), lang, action: "https://music.youtube.com" };

  // live weather — "weather in Ahmedabad"
  const wMatch = s.match(/(?:weather|mausam|मौसम|havaman|હવામાન)[^.?!]*?(?:in|mein|में|ma|मां|માં)\s+([a-z\u0900-\u097F\u0A80-\u0AFF ]+)/);
  if (wMatch) {
    const wres = await weatherNow(wMatch[1], lang);
    if (wres) return { text: wres, lang };
  }

  // dictionary — "meaning of serendipity"
  const dMatch = s.match(/(?:meaning of|define|definition of|what does)\s+([a-z]+)(?:\s+mean)?/) ||
    s.match(/([a-z]+)\s+(?:means|ka matlab|मतलब|no arth|નો અર્થ)/);
  if (dMatch && dMatch[1].length > 1) {
    const def = await dictDefine(dMatch[1]);
    if (def) return { text: def, lang };
  }

  // knowledge: wikipedia first, then instant answers
  const knowMatch = s.match(/(?:who is|who was|what is|what was|what are|tell me about|do you know about|explain|kaun|कौन|kon|કોણ|kya hai|क्या है|shu che|શું છે)\s+(.+)/);
  if (knowMatch) {
    const topic = knowMatch[1].replace(/[?.!]$/, "").trim();
    if (topic && topic.length > 1) {
      const summary = await wikiSummary(topic, lang);
      if (summary) return { text: summary, lang };
      const ddg = await ddgAbstract(topic);
      if (ddg) return { text: ddg, lang };
    }
  }

  // agent fallback: try to actually answer before opening search
  const topic = raw.replace(/[?.!]$/, "").trim();
  if (topic.length > 1) {
    const ddg = await ddgAbstract(topic);
    if (ddg) return { text: ddg, lang };
    return { text: T.search[lang](n, topic), lang, action: `https://www.google.com/search?q=${encodeURIComponent(topic)}` };
  }

  return { text: T.fallback[lang](n), lang };
}

export function timerDoneText(lang: Lang): string {
  return T.timerDone[lang];
}

// Illustrated scene library for tasks — hand-drawn SVG art in the site
// palette (גפן ותאנה). Every task intersperses these between texts and
// questions: teenagers need the visual breathers, and each scene is chosen
// to spark curiosity about the chapter's content (Rafael's standing rule).
// Scenes are pure inline SVG: instant load, palette-consistent, no external
// services. Add scenes here as new chapters need them.

const GRAPE = "#413055";
const INK = "#2e2438";
const COPPER = "#b96a3b";
const SAND = "#e9ddd2";
const CARD = "#fffdfa";
const GLOW = "#f0c26e";

const SCENES: Record<string, React.ReactNode> = {
  // ליל י"ד במדבר סיני — full moon, tents, a lone campfire.
  "desert-night": (
    <svg viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="dn-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#221a2e" />
          <stop offset="0.7" stopColor={GRAPE} />
          <stop offset="1" stopColor="#5a4570" />
        </linearGradient>
        <radialGradient id="dn-moon" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.75" stopColor="#fdf6e3" />
          <stop offset="1" stopColor="#f3e3b8" />
        </radialGradient>
        <radialGradient id="dn-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fdf6e3" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fdf6e3" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dn-fire" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW} stopOpacity="0.8" />
          <stop offset="1" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="300" fill="url(#dn-sky)" />
      {[
        [60, 40, 1.6], [130, 78, 1], [210, 30, 1.3], [305, 62, 1], [390, 25, 1.7],
        [470, 70, 1], [545, 38, 1.2], [640, 90, 1], [720, 34, 1.5], [764, 96, 1],
        [175, 120, 1], [420, 110, 1.1], [590, 128, 1], [90, 150, 1.2], [280, 142, 1],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fdf6e3" opacity={0.85} />
      ))}
      <circle cx="655" cy="78" r="86" fill="url(#dn-glow)" />
      <circle cx="655" cy="78" r="40" fill="url(#dn-moon)" />
      <circle cx="643" cy="66" r="6" fill="#e8d6a8" opacity="0.55" />
      <circle cx="668" cy="88" r="9" fill="#e8d6a8" opacity="0.4" />
      <path d="M0 216 Q 190 158 400 210 T 800 196 V300 H0 Z" fill="#332946" />
      <path d="M0 246 Q 230 196 480 244 T 800 238 V300 H0 Z" fill="#2a2139" />
      <path d="M0 274 Q 260 236 560 276 T 800 268 V300 H0 Z" fill={INK} />
      {/* tents */}
      <g fill="#1d1728">
        <path d="M118 262 L150 214 L182 262 Z" />
        <path d="M228 268 L254 230 L280 268 Z" />
        <path d="M560 272 L590 228 L620 272 Z" />
      </g>
      <path d="M150 214 L150 262 L166 262 Z" fill="#4a3660" opacity="0.9" />
      <path d="M590 228 L590 272 L603 272 Z" fill="#4a3660" opacity="0.9" />
      {/* campfire */}
      <circle cx="395" cy="268" r="34" fill="url(#dn-fire)" />
      <path d="M389 272 Q 395 252 399 262 Q 405 250 403 268 Q 409 262 405 274 Q 398 280 391 276 Z" fill={GLOW} />
      <path d="M392 273 Q 396 261 399 268 Q 402 263 400 273 Z" fill="#d97b3f" />
    </svg>
  ),

  // The chronological riddle — a scroll and the moon filling up month by month.
  "moon-phases": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="mp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f4e9dc" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#mp-bg)" />
      <path
        d="M60 168 Q 200 120 400 150 T 740 128"
        fill="none"
        stroke={COPPER}
        strokeWidth="2.5"
        strokeDasharray="2 9"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* moon phases along the path: crescent → full */}
      <g>
        <circle cx="95" cy="158" r="20" fill={SAND} />
        <path d="M95 138 a20 20 0 0 1 0 40 a15 20 0 0 0 0 -40 Z" fill={GRAPE} />
        <circle cx="255" cy="132" r="22" fill={SAND} />
        <path d="M255 110 a22 22 0 0 1 0 44 a10 22 0 0 0 0 -44 Z" fill={GRAPE} />
        <circle cx="420" cy="148" r="24" fill={SAND} />
        <path d="M420 124 a24 24 0 0 1 0 48 a4 24 0 0 0 0 -48 Z" fill={GRAPE} />
        <circle cx="580" cy="128" r="27" fill={GRAPE} opacity="0.15" />
        <circle cx="580" cy="128" r="26" fill="#efe0c3" />
        <circle cx="726" cy="120" r="30" fill={GLOW} opacity="0.25" />
        <circle cx="726" cy="120" r="28" fill="#f6ecd2" stroke={COPPER} strokeWidth="2" />
      </g>
      {/* rolled scroll in the corner */}
      <g transform="translate(52,38)">
        <rect x="14" y="6" width="120" height="64" rx="8" fill={CARD} stroke={SAND} strokeWidth="3" />
        <rect x="0" y="0" width="18" height="76" rx="9" fill={SAND} />
        <rect x="130" y="0" width="18" height="76" rx="9" fill={SAND} />
        {[20, 34, 48].map((y, i) => (
          <line key={i} x1="28" y1={y} x2="120" y2={y} stroke={GRAPE} strokeWidth="4" strokeLinecap="round" opacity={0.35 - i * 0.07} />
        ))}
      </g>
    </svg>
  ),

  // וַיִּקְרְבוּ לִפְנֵי מֹשֶׁה — dusk, the Mishkan with the cloud, two figures daring to approach.
  "approach": (
    <svg viewBox="0 0 800 280" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="ap-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GRAPE} />
          <stop offset="0.75" stopColor="#8a5a68" />
          <stop offset="1" stopColor={COPPER} />
        </linearGradient>
        <radialGradient id="ap-cloud" cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="280" fill="url(#ap-sky)" />
      <path d="M0 236 Q 240 208 470 234 T 800 226 V280 H0 Z" fill="#3a2c33" />
      <path d="M0 262 Q 300 240 800 258 V280 H0 Z" fill={INK} />
      {/* cloud pillar */}
      <ellipse cx="565" cy="96" rx="88" ry="46" fill="url(#ap-cloud)" />
      <ellipse cx="565" cy="70" rx="56" ry="30" fill="url(#ap-cloud)" />
      <ellipse cx="565" cy="126" rx="40" ry="52" fill="url(#ap-cloud)" opacity="0.7" />
      {/* the Mishkan */}
      <g>
        <rect x="470" y="168" width="190" height="66" rx="6" fill="#54406b" />
        <rect x="470" y="168" width="190" height="14" rx="6" fill={GLOW} opacity="0.85" />
        <rect x="484" y="190" width="162" height="36" rx="4" fill="#3d2f50" />
        {[500, 530, 560, 590, 620].map((x, i) => (
          <rect key={i} x={x} y="192" width="8" height="32" rx="3" fill={COPPER} opacity="0.75" />
        ))}
        <rect x="556" y="196" width="26" height="38" rx="3" fill={GLOW} opacity="0.9" />
      </g>
      {/* path + two approaching figures (from behind) */}
      <path d="M120 280 Q 320 250 560 236" fill="none" stroke="#c8a27a" strokeWidth="10" strokeLinecap="round" opacity="0.35" />
      <g fill={INK}>
        <g transform="translate(196,214)">
          <circle cx="0" cy="0" r="9" />
          <path d="M-10 8 Q 0 2 10 8 L 8 44 Q 0 48 -8 44 Z" />
        </g>
        <g transform="translate(246,206) scale(0.9)">
          <circle cx="0" cy="0" r="9" />
          <path d="M-10 8 Q 0 2 10 8 L 8 44 Q 0 48 -8 44 Z" />
        </g>
      </g>
    </svg>
  ),

  // הפרט מול הקהילה — one voice standing apart from the camp, a thread still connecting.
  "one-and-many": (
    <svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="om-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f1e6da" />
        </linearGradient>
      </defs>
      <rect width="800" height="200" fill="url(#om-bg)" />
      {/* the many — a warm cluster */}
      <g fill={GRAPE}>
        {[
          [520, 96, 15, 0.9], [560, 80, 13, 0.75], [598, 100, 16, 0.85], [545, 122, 12, 0.7],
          [636, 82, 12, 0.65], [668, 108, 14, 0.8], [610, 132, 11, 0.6], [700, 90, 11, 0.55],
          [648, 142, 10, 0.5], [702, 128, 12, 0.65], [582, 60, 10, 0.5], [734, 108, 10, 0.45],
        ].map(([x, y, r, o], i) => (
          <circle key={i} cx={x} cy={y} r={r} opacity={o} />
        ))}
      </g>
      {/* the one — apart, ringed in copper, same size as any of them */}
      <circle cx="150" cy="104" r="15" fill={GRAPE} />
      <circle cx="150" cy="104" r="24" fill="none" stroke={COPPER} strokeWidth="2.5" strokeDasharray="1 7" strokeLinecap="round" />
      {/* the thread that still connects */}
      <path
        d="M180 104 Q 330 62 500 96"
        fill="none"
        stroke={COPPER}
        strokeWidth="2.5"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      <path d="M492 88 L505 96 L490 102" fill="none" stroke={COPPER} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // פסח שני — a gate left open on the hill path, dawn of a second chance.
  "open-gate": (
    <svg viewBox="0 0 800 260" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="og-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={INK} />
          <stop offset="0.55" stopColor={GRAPE} />
          <stop offset="0.85" stopColor={COPPER} />
          <stop offset="1" stopColor={GLOW} />
        </linearGradient>
        <radialGradient id="og-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW} />
          <stop offset="1" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="260" fill="url(#og-sky)" />
      <circle cx="400" cy="212" r="120" fill="url(#og-sun)" />
      <circle cx="400" cy="216" r="34" fill="#f8e7bb" />
      <path d="M0 218 Q 200 186 400 208 T 800 200 V260 H0 Z" fill="#3a2c40" />
      <path d="M0 244 Q 300 222 800 240 V260 H0 Z" fill={INK} />
      {/* winding path to the gate */}
      <path d="M80 260 Q 260 236 396 224" fill="none" stroke="#caa27b" strokeWidth="9" strokeLinecap="round" opacity="0.4" />
      {/* the open gate */}
      <g>
        <rect x="362" y="150" width="13" height="76" rx="5" fill="#241c30" />
        <rect x="428" y="150" width="13" height="76" rx="5" fill="#241c30" />
        <path d="M356 156 Q 400 116 448 156" fill="none" stroke="#241c30" strokeWidth="13" strokeLinecap="round" />
        {/* door swung open */}
        <path d="M428 160 L466 176 L466 224 L428 220 Z" fill="#241c30" opacity="0.85" />
        {[184, 200].map((y, i) => (
          <line key={i} x1="434" y1={y - 6} x2="460" y2={y} stroke={COPPER} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        ))}
      </g>
      {[
        [120, 60, 1.4], [220, 36, 1], [320, 70, 1.2], [520, 44, 1.3], [640, 66, 1], [710, 30, 1.5],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fdf6e3" opacity="0.8" />
      ))}
    </svg>
  ),
  // ענן ביום, אש בלילה — the Mishkan under the double sign (lesson 2 hero).
  "cloud-fire": (
    <svg viewBox="0 0 800 280" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="cf-day" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f2e2c8" />
          <stop offset="0.45" stopColor="#e7cfae" />
          <stop offset="0.55" stopColor="#6b5480" />
          <stop offset="1" stopColor="#241c30" />
        </linearGradient>
        <radialGradient id="cf-cloud" cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cf-fire" cx="0.5" cy="0.7" r="0.6">
          <stop offset="0" stopColor={GLOW} stopOpacity="0.9" />
          <stop offset="1" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="280" fill="url(#cf-day)" />
      {/* night stars on the dark half */}
      {[
        [520, 40, 1.2], [580, 84, 1], [640, 30, 1.5], [700, 66, 1], [750, 110, 1.3], [610, 130, 1],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fdf6e3" opacity="0.85" />
      ))}
      <path d="M0 226 Q 220 200 440 224 T 800 214 V280 H0 Z" fill="#3a2c40" />
      <path d="M0 254 Q 300 234 800 250 V280 H0 Z" fill={INK} />
      {/* the Mishkan at center */}
      <g>
        <rect x="330" y="164" width="150" height="60" rx="6" fill="#54406b" />
        <rect x="330" y="164" width="150" height="12" rx="6" fill={GLOW} opacity="0.85" />
        {[348, 374, 400, 426, 452].map((x, i) => (
          <rect key={i} x={x} y="184" width="7" height="32" rx="3" fill={COPPER} opacity="0.75" />
        ))}
      </g>
      {/* cloud (day side) */}
      <ellipse cx="368" cy="112" rx="86" ry="42" fill="url(#cf-cloud)" />
      <ellipse cx="352" cy="88" rx="52" ry="26" fill="url(#cf-cloud)" />
      {/* fire (night side) */}
      <circle cx="452" cy="106" r="52" fill="url(#cf-fire)" />
      <path d="M444 122 Q 452 84 458 104 Q 468 88 464 116 Q 474 108 466 126 Q 454 136 444 128 Z" fill={GLOW} />
      <path d="M449 122 Q 453 102 457 112 Q 461 106 458 122 Z" fill="#d97b3f" />
    </svg>
  ),

  // שתי חצוצרות כסף — sound rings going out over the camp.
  "trumpets": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="tr-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f1e6da" />
        </linearGradient>
        <linearGradient id="tr-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8e4ea" />
          <stop offset="0.5" stopColor="#b9b2c4" />
          <stop offset="1" stopColor="#8d8499" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#tr-bg)" />
      {/* two crossed silver trumpets */}
      <g transform="translate(400,105)">
        <g transform="rotate(-14)">
          <rect x="-150" y="-7" width="200" height="14" rx="7" fill="url(#tr-metal)" />
          <path d="M50 -16 L104 -30 L104 30 L50 16 Z" fill="url(#tr-metal)" />
          <rect x="-96" y="-10" width="8" height="20" rx="4" fill={COPPER} opacity="0.8" />
          <rect x="-40" y="-10" width="8" height="20" rx="4" fill={COPPER} opacity="0.8" />
        </g>
        <g transform="rotate(14) scale(-1,1)">
          <rect x="-150" y="-7" width="200" height="14" rx="7" fill="url(#tr-metal)" />
          <path d="M50 -16 L104 -30 L104 30 L50 16 Z" fill="url(#tr-metal)" />
          <rect x="-96" y="-10" width="8" height="20" rx="4" fill={COPPER} opacity="0.8" />
          <rect x="-40" y="-10" width="8" height="20" rx="4" fill={COPPER} opacity="0.8" />
        </g>
      </g>
      {/* sound rings */}
      {[26, 44, 62].map((r, i) => (
        <path
          key={`r-${i}`}
          d={`M ${518 + r} 74 a ${r} ${r} 0 0 1 0 ${r * 0.9}`}
          fill="none"
          stroke={COPPER}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={0.7 - i * 0.18}
        />
      ))}
      {[26, 44, 62].map((r, i) => (
        <path
          key={`l-${i}`}
          d={`M ${282 - r} 74 a ${r} ${r} 0 0 0 0 ${r * 0.9}`}
          fill="none"
          stroke={COPPER}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={0.7 - i * 0.18}
        />
      ))}
      {/* tents hearing the call */}
      <g fill={GRAPE} opacity="0.5">
        <path d="M96 176 L118 146 L140 176 Z" />
        <path d="M156 182 L174 156 L192 182 Z" />
        <path d="M660 176 L682 146 L704 176 Z" />
        <path d="M610 182 L628 156 L646 182 Z" />
      </g>
    </svg>
  ),

  // הפניה לחובב — a fork in the desert road: homeward, or with the camp.
  "crossroads": (
    <svg viewBox="0 0 800 230" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="cr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe0cb" />
          <stop offset="1" stopColor="#e0c8a8" />
        </linearGradient>
      </defs>
      <rect width="800" height="230" fill="url(#cr-sky)" />
      <path d="M0 170 Q 200 146 430 168 T 800 158 V230 H0 Z" fill="#caa27b" />
      <path d="M0 196 Q 300 178 800 192 V230 H0 Z" fill="#b3885e" />
      {/* the fork: one path toward the tents (camp), one away to the hills */}
      <path d="M400 230 Q 396 200 380 182 Q 330 150 240 142" fill="none" stroke="#8a6844" strokeWidth="10" strokeLinecap="round" opacity="0.55" />
      <path d="M400 230 Q 408 198 428 182 Q 490 148 590 148" fill="none" stroke="#8a6844" strokeWidth="10" strokeLinecap="round" opacity="0.55" />
      {/* camp side (left target): tents + tiny cloud */}
      <g fill={GRAPE}>
        <path d="M176 148 L198 118 L220 148 Z" />
        <path d="M136 152 L152 130 L168 152 Z" />
      </g>
      <ellipse cx="196" cy="92" rx="34" ry="14" fill="#ffffff" opacity="0.85" />
      {/* homeland side (right target): distant hills */}
      <path d="M560 150 Q 600 116 648 150 Z" fill="#9d7c56" />
      <path d="M620 150 Q 664 108 716 150 Z" fill="#8a6844" />
      {/* the deliberating figure at the fork */}
      <g fill={INK} transform="translate(400,196)">
        <circle cx="0" cy="-34" r="9" />
        <path d="M-10 -26 Q 0 -32 10 -26 L 8 8 Q 0 12 -8 8 Z" />
      </g>
      {/* question mark hovering */}
      <text x="425" y="150" fontSize="34" fontWeight="bold" fill={COPPER} opacity="0.85">?</text>
    </svg>
  ),

  // וַיְהִי בִּנְסֹעַ הָאָרֹן — the ark going three days ahead of the camp.
  "ark-way": (
    <svg viewBox="0 0 800 240" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="aw-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GRAPE} />
          <stop offset="0.8" stopColor="#9d6a58" />
          <stop offset="1" stopColor={COPPER} />
        </linearGradient>
        <radialGradient id="aw-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW} stopOpacity="0.55" />
          <stop offset="1" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="240" fill="url(#aw-sky)" />
      <path d="M0 196 Q 240 172 480 194 T 800 186 V240 H0 Z" fill="#3a2c40" />
      <path d="M0 220 Q 300 204 800 216 V240 H0 Z" fill={INK} />
      {/* the way, stretching far ahead (left = forward in RTL) */}
      <path d="M720 240 Q 520 208 300 196 Q 220 192 150 186" fill="none" stroke="#caa27b" strokeWidth="9" strokeLinecap="round" opacity="0.35" strokeDasharray="1 16" />
      {/* the ark, glowing, ahead of everyone */}
      <circle cx="170" cy="160" r="64" fill="url(#aw-glow)" />
      <g transform="translate(140,142)">
        <rect x="0" y="10" width="60" height="34" rx="5" fill={GLOW} />
        <rect x="0" y="10" width="60" height="8" rx="4" fill="#d9a44c" />
        {/* poles */}
        <rect x="-16" y="38" width="92" height="5" rx="2.5" fill="#8a5a2c" />
        {/* two keruvim wings */}
        <path d="M14 10 Q 20 -6 30 8 Z" fill="#d9a44c" />
        <path d="M46 10 Q 40 -6 30 8 Z" fill="#d9a44c" />
      </g>
      {/* the camp far behind (right) */}
      <g fill="#241c30">
        <path d="M600 206 L622 176 L644 206 Z" />
        <path d="M654 210 L672 184 L690 210 Z" />
        <path d="M704 206 L724 178 L744 206 Z" />
      </g>
      {[
        [90, 44, 1.4], [200, 30, 1], [320, 56, 1.2], [470, 36, 1.4], [600, 60, 1], [710, 40, 1.3],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fdf6e3" opacity="0.75" />
      ))}
    </svg>
  ),
  // תבערה — fire at the edge of the camp, dusk (lesson 3 hero).
  "camp-fire-edge": (
    <svg viewBox="0 0 800 280" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="fe-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241c30" />
          <stop offset="0.65" stopColor={GRAPE} />
          <stop offset="1" stopColor="#7a4a48" />
        </linearGradient>
        <radialGradient id="fe-blaze" cx="0.5" cy="0.75" r="0.6">
          <stop offset="0" stopColor={GLOW} stopOpacity="0.85" />
          <stop offset="1" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="280" fill="url(#fe-sky)" />
      {[
        [80, 44, 1.3], [180, 70, 1], [300, 36, 1.4], [430, 60, 1], [540, 30, 1.2], [700, 52, 1],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fdf6e3" opacity="0.8" />
      ))}
      <path d="M0 216 Q 220 190 460 214 T 800 206 V280 H0 Z" fill="#3a2c40" />
      <path d="M0 246 Q 300 226 800 242 V280 H0 Z" fill={INK} />
      {/* the safe heart of the camp — many tents */}
      <g fill="#1d1728">
        <path d="M320 236 L346 198 L372 236 Z" />
        <path d="M394 240 L416 208 L438 240 Z" />
        <path d="M460 236 L484 202 L508 236 Z" />
        <path d="M250 242 L270 214 L290 242 Z" />
      </g>
      {/* the burning edge, far at the side */}
      <circle cx="86" cy="238" r="60" fill="url(#fe-blaze)" />
      <g>
        <path d="M70 246 Q 82 200 92 224 Q 104 202 100 236 Q 114 224 104 250 Q 86 260 72 252 Z" fill={GLOW} />
        <path d="M80 246 Q 88 222 93 234 Q 99 226 95 248 Z" fill="#d97b3f" />
      </g>
    </svg>
  ),

  // המן בטל — pearl-like manna under the night dew.
  "manna-dew": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="md-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2240" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
        <radialGradient id="md-pearl" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#efe6f2" />
          <stop offset="1" stopColor="#c8b8d4" />
        </radialGradient>
      </defs>
      <rect width="800" height="210" fill="url(#md-bg)" />
      <circle cx="700" cy="46" r="22" fill="#f3e8c8" opacity="0.9" />
      {/* dew drops falling */}
      {[
        [120, 60], [240, 40], [380, 66], [520, 46], [640, 70],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} q 3 8 0 12 q -3 -4 0 -12`} fill="#cfe3ef" opacity="0.8" />
      ))}
      <path d="M0 160 Q 240 140 480 158 T 800 152 V210 H0 Z" fill="#39304e" />
      {/* manna pearls scattered on the ground */}
      {[
        [90, 176, 9], [140, 186, 7], [210, 172, 10], [280, 184, 8], [350, 174, 9],
        [420, 188, 7], [490, 176, 10], [560, 186, 8], [630, 174, 9], [700, 184, 7], [755, 176, 8],
      ].map(([x, y, r], i) => (
        <circle key={`p-${i}`} cx={x} cy={y} r={r} fill="url(#md-pearl)" />
      ))}
    </svg>
  ),

  // הנר שממנו מדליקים — one flame lighting seventy, losing nothing (רש"י).
  "seventy-flames": (
    <svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="sf-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241c30" />
          <stop offset="1" stopColor="#3d2f50" />
        </linearGradient>
        <radialGradient id="sf-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW} stopOpacity="0.6" />
          <stop offset="1" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="220" fill="url(#sf-bg)" />
      {/* the central lamp — taller, on a stand */}
      <circle cx="400" cy="96" r="66" fill="url(#sf-glow)" />
      <rect x="392" y="110" width="16" height="60" rx="4" fill={COPPER} />
      <rect x="378" y="166" width="44" height="10" rx="5" fill={COPPER} />
      <path d="M392 108 Q 400 74 406 96 Q 414 82 410 104 Q 404 114 394 110 Z" fill={GLOW} />
      {/* rows of small candles catching the light */}
      {Array.from({ length: 11 }, (_, i) => 70 + i * 66).map((x, i) => (
        <g key={`a-${i}`} opacity={x > 330 && x < 470 ? 0 : 1}>
          <rect x={x - 4} y="150" width="8" height="26" rx="3" fill="#8d7ba0" />
          <path d={`M${x - 4} 148 Q ${x} 132 ${x + 3} 146 Q ${x} 152 ${x - 4} 148 Z`} fill={GLOW} opacity="0.9" />
        </g>
      ))}
      {Array.from({ length: 9 }, (_, i) => 110 + i * 72).map((x, i) => (
        <g key={`b-${i}`} opacity={x > 330 && x < 470 ? 0 : 0.7}>
          <rect x={x - 3.5} y="184" width="7" height="20" rx="3" fill="#8d7ba0" />
          <path d={`M${x - 3} 182 Q ${x} 168 ${x + 3} 181 Q ${x} 186 ${x - 3} 182 Z`} fill={GLOW} opacity="0.85" />
        </g>
      ))}
    </svg>
  ),

  // שליו מן הים — wind carrying birds over the camp.
  "quail-wind": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="qw-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9d9c2" />
          <stop offset="1" stopColor="#d3ba9a" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#qw-bg)" />
      {/* sea at the far right edge */}
      <path d="M690 210 Q 700 150 800 138 V210 Z" fill="#7d94a8" opacity="0.8" />
      {/* wind streaks from the sea */}
      {[54, 84, 114].map((y, i) => (
        <path
          key={i}
          d={`M760 ${y} Q 560 ${y - 14} 340 ${y + 6} T 60 ${y - 4}`}
          fill="none"
          stroke="#b39b7c"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="14 10"
          opacity={0.7 - i * 0.15}
        />
      ))}
      {/* quail silhouettes riding the wind */}
      {[
        [640, 66, 1], [560, 92, 0.9], [470, 58, 1.1], [380, 84, 0.85], [290, 64, 1], [200, 92, 0.8], [120, 70, 0.95],
      ].map(([x, y, s], i) => (
        <g key={`q-${i}`} transform={`translate(${x},${y}) scale(${s})`} fill={INK} opacity="0.8">
          <ellipse cx="0" cy="0" rx="12" ry="6" />
          <circle cx="-13" cy="-3" r="4" />
          <path d="M2 -3 Q 10 -16 18 -8 Q 10 -4 2 -3 Z" />
        </g>
      ))}
      {/* tents below */}
      <g fill={GRAPE} opacity="0.6">
        <path d="M150 186 L172 158 L194 186 Z" />
        <path d="M330 190 L350 164 L370 190 Z" />
        <path d="M540 186 L562 158 L584 186 Z" />
      </g>
    </svg>
  ),
  // עמוד ענן בפתח האוהל — the sudden summons (lesson 4 hero).
  "pillar-door": (
    <svg viewBox="0 0 800 270" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="pd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2240" />
          <stop offset="0.75" stopColor={GRAPE} />
          <stop offset="1" stopColor="#6b5480" />
        </linearGradient>
        <linearGradient id="pd-pillar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="800" height="270" fill="url(#pd-sky)" />
      <path d="M0 216 Q 240 194 480 214 T 800 206 V270 H0 Z" fill="#3a2c40" />
      <path d="M0 244 Q 300 226 800 240 V270 H0 Z" fill={INK} />
      {/* the Ohel Moed */}
      <rect x="300" y="158" width="200" height="66" rx="7" fill="#54406b" />
      <rect x="300" y="158" width="200" height="13" rx="6" fill={GLOW} opacity="0.85" />
      <rect x="382" y="182" width="36" height="42" rx="4" fill="#241c30" />
      {/* the pillar of cloud, landed at the door */}
      <ellipse cx="400" cy="70" rx="46" ry="26" fill="#ffffff" opacity="0.9" />
      <path d="M382 84 Q 400 60 418 84 L 412 158 Q 400 166 388 158 Z" fill="url(#pd-pillar)" />
      {/* three small figures called out */}
      <g fill={INK}>
        <g transform="translate(268,206)"><circle cy="-22" r="7" /><path d="M-8 -16 Q 0 -20 8 -16 L 6 10 Q 0 13 -6 10 Z" /></g>
        <g transform="translate(240,210) scale(0.9)"><circle cy="-22" r="7" /><path d="M-8 -16 Q 0 -20 8 -16 L 6 10 Q 0 13 -6 10 Z" /></g>
        <g transform="translate(214,206) scale(0.85)"><circle cy="-22" r="7" /><path d="M-8 -16 Q 0 -20 8 -16 L 6 10 Q 0 13 -6 10 Z" /></g>
      </g>
      {[
        [90, 40, 1.3], [190, 66, 1], [560, 44, 1.4], [660, 76, 1], [730, 34, 1.2],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fdf6e3" opacity="0.8" />
      ))}
    </svg>
  ),

  // מילים שמתפשטות — ripples of speech going farther than intended.
  "speech-ripples": (
    <svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="sr-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f1e6da" />
        </linearGradient>
      </defs>
      <rect width="800" height="200" fill="url(#sr-bg)" />
      {/* two close speakers at the right (start of the whisper) */}
      <g fill={GRAPE}>
        <g transform="translate(672,120)"><circle cy="-26" r="9" /><path d="M-10 -18 Q 0 -24 10 -18 L 8 16 Q 0 20 -8 16 Z" /></g>
        <g transform="translate(632,124) scale(0.95)"><circle cy="-26" r="9" /><path d="M-10 -18 Q 0 -24 10 -18 L 8 16 Q 0 20 -8 16 Z" /></g>
      </g>
      {/* ripples spreading leftward, growing */}
      {[
        [560, 100, 14], [500, 96, 22], [424, 100, 32], [330, 96, 44], [214, 100, 58],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={COPPER} strokeWidth="2.5" strokeDasharray="3 8" strokeLinecap="round" opacity={0.85 - i * 0.13} />
      ))}
      {/* the far ear that ends up hearing: וישמע ה' — an abstract listening arc high left */}
      <path d="M60 46 Q 96 26 132 46" fill="none" stroke={GRAPE} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="96" cy="52" r="4" fill={GRAPE} />
    </svg>
  ),

  // פה אל פה — a clear straight channel vs. dream-riddle clouds.
  "clear-channel": (
    <svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="cc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2240" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
      </defs>
      <rect width="800" height="200" fill="url(#cc-bg)" />
      {/* upper half: dreams — wavy, broken, riddling clouds */}
      <g opacity="0.75">
        {[
          [640, 52], [520, 40], [400, 56],
        ].map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y} rx="44" ry="18" fill="#8d7ba0" opacity="0.5" />
            <text x={x - 6} y={y + 7} fontSize="20" fontWeight="bold" fill="#e8e0f0" opacity="0.9">?</text>
          </g>
        ))}
        <path d="M700 52 Q 660 66 596 46 Q 560 60 470 44 Q 440 62 352 52" fill="none" stroke="#8d7ba0" strokeWidth="2" strokeDasharray="6 10" strokeLinecap="round" />
      </g>
      {/* lower half: one straight luminous line — פה אל פה */}
      <line x1="720" y1="146" x2="80" y2="146" stroke={GLOW} strokeWidth="4" strokeLinecap="round" />
      <circle cx="720" cy="146" r="10" fill={GLOW} />
      <circle cx="80" cy="146" r="10" fill="#fdf6e3" />
    </svg>
  ),

  // והעם לא נסע — the whole camp stays put, seven suns, for one person outside.
  "waiting-camp": (
    <svg viewBox="0 0 800 230" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="wc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe0cb" />
          <stop offset="1" stopColor="#ddc3a0" />
        </linearGradient>
      </defs>
      <rect width="800" height="230" fill="url(#wc-sky)" />
      {/* seven little suns arcing across — seven days */}
      {[
        [130, 66], [230, 44], [330, 32], [430, 28], [530, 32], [630, 44], [730, 66],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 3 ? 12 : 9} fill={GLOW} opacity={0.45 + (i === 3 ? 0.4 : 0)} stroke={COPPER} strokeWidth={i === 3 ? 2 : 0} />
      ))}
      <path d="M0 178 Q 240 158 480 176 T 800 170 V230 H0 Z" fill="#caa27b" />
      <path d="M0 206 Q 300 190 800 202 V230 H0 Z" fill="#a87e54" />
      {/* the waiting camp — tents standing in place */}
      <g fill={GRAPE}>
        <path d="M300 168 L326 132 L352 168 Z" />
        <path d="M376 172 L398 142 L420 172 Z" />
        <path d="M444 168 L468 136 L492 168 Z" />
        <path d="M240 174 L258 150 L276 174 Z" opacity="0.8" />
        <path d="M516 174 L534 150 L552 174 Z" opacity="0.8" />
      </g>
      {/* the one small tent outside the camp, and the space between */}
      <path d="M96 176 L114 152 L132 176 Z" fill={COPPER} />
      <path d="M150 168 Q 200 160 232 166" fill="none" stroke={COPPER} strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" opacity="0.6" />
    </svg>
  ),
};

export default function TaskArt({
  art,
  caption,
}: {
  art: string;
  caption?: string;
}) {
  const scene = SCENES[art];
  if (!scene) return null;
  return (
    <figure className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
      <div className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full">{scene}</div>
      {caption && (
        <figcaption className="px-4 py-2.5 text-center text-xs leading-5 text-[color:var(--primary)]/60">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

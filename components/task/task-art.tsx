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
  // אשכול הענבים על המוט — the iconic carried cluster (lesson 5 hero).
  "grape-cluster": (
    <svg viewBox="0 0 800 280" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="gc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe0cb" />
          <stop offset="1" stopColor="#dcc09b" />
        </linearGradient>
      </defs>
      <rect width="800" height="280" fill="url(#gc-sky)" />
      {/* distant green hills of the Land */}
      <path d="M0 168 Q 160 108 340 156 Q 470 100 640 148 Q 720 120 800 142 V280 H0 Z" fill="#6f8560" opacity="0.65" />
      <path d="M0 206 Q 240 168 520 200 T 800 190 V280 H0 Z" fill="#caa27b" />
      <path d="M0 236 Q 300 214 800 230 V280 H0 Z" fill="#a87e54" />
      {/* two bearers with the pole */}
      <g>
        <rect x="250" y="130" width="300" height="9" rx="4.5" fill="#7a5230" />
        <g fill={INK}>
          <g transform="translate(250,178)"><circle cy="-40" r="10" /><path d="M-11 -32 Q 0 -38 11 -32 L 9 16 Q 0 20 -9 16 Z" /></g>
          <g transform="translate(550,178)"><circle cy="-40" r="10" /><path d="M-11 -32 Q 0 -38 11 -32 L 9 16 Q 0 20 -9 16 Z" /></g>
        </g>
        {/* the huge cluster hanging from the pole */}
        <line x1="400" y1="139" x2="400" y2="156" stroke="#5a7a4a" strokeWidth="5" strokeLinecap="round" />
        <g fill={GRAPE}>
          {[
            [400, 172, 15], [378, 184, 14], [422, 184, 14], [388, 204, 14], [412, 204, 14],
            [368, 202, 12], [432, 202, 12], [400, 222, 13], [382, 236, 11], [418, 236, 11], [400, 250, 10],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} opacity={0.85 + (i % 3) * 0.05} />
          ))}
        </g>
        <path d="M396 158 Q 380 148 366 158 Q 382 164 396 158 Z" fill="#5a7a4a" />
        <path d="M404 158 Q 420 148 434 158 Q 418 164 404 158 Z" fill="#5a7a4a" />
      </g>
    </svg>
  ),

  // המילה הקטנה ״אפס״ — a tiny word tipping a whole scale of facts.
  "tipping-word": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="tw-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f1e6da" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#tw-bg)" />
      {/* a tilted balance: heavy pan of "facts", light pan with one small word — yet tilted its way */}
      <line x1="400" y1="52" x2="400" y2="80" stroke={GRAPE} strokeWidth="5" strokeLinecap="round" />
      <g transform="rotate(9 400 80)">
        <line x1="230" y1="80" x2="570" y2="80" stroke={GRAPE} strokeWidth="6" strokeLinecap="round" />
        {/* facts pan (right, RTL first) — full of solid blocks */}
        <line x1="270" y1="80" x2="248" y2="126" stroke={GRAPE} strokeWidth="3" />
        <line x1="270" y1="80" x2="292" y2="126" stroke={GRAPE} strokeWidth="3" />
        <path d="M232 126 H308 Q 306 152 270 152 Q 234 152 232 126 Z" fill={GRAPE} opacity="0.25" />
        {[248, 268, 288].map((x, i) => (
          <rect key={i} x={x - 9} y={112 - (i % 2) * 12} width="18" height="14" rx="3" fill={GRAPE} opacity="0.8" />
        ))}
        {/* the single-word pan (left) — one small copper dot, but the scale tips toward it */}
        <line x1="530" y1="80" x2="508" y2="126" stroke={GRAPE} strokeWidth="3" />
        <line x1="530" y1="80" x2="552" y2="126" stroke={GRAPE} strokeWidth="3" />
        <path d="M492 126 H568 Q 566 152 530 152 Q 494 152 492 126 Z" fill={COPPER} opacity="0.25" />
        <circle cx="530" cy="118" r="9" fill={COPPER} />
      </g>
      <circle cx="400" cy="48" r="7" fill={COPPER} />
    </svg>
  ),

  // כחגבים בעינינו — self-image: a small figure casting a giant fearful shadow.
  "grasshopper-eyes": (
    <svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="ge-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9d9c2" />
          <stop offset="1" stopColor="#d3ba9a" />
        </linearGradient>
      </defs>
      <rect width="800" height="220" fill="url(#ge-bg)" />
      <path d="M0 178 Q 300 160 800 172 V220 H0 Z" fill="#b3885e" />
      {/* the giant imagined shadow on the wall */}
      <path d="M180 178 L232 44 Q 250 24 268 44 L320 178 Z" fill={INK} opacity="0.18" />
      <circle cx="250" cy="38" r="26" fill={INK} opacity="0.18" />
      {/* the actual small person */}
      <g fill={GRAPE} transform="translate(480,150)">
        <circle cy="-26" r="9" />
        <path d="M-10 -18 Q 0 -24 10 -18 L 8 20 Q 0 24 -8 20 Z" />
      </g>
      {/* light source */}
      <circle cx="700" cy="52" r="20" fill={GLOW} opacity="0.85" />
      {[0, 1, 2].map((i) => (
        <line key={i} x1={700 - 34 - i * 4} y1={52 + i * 14 - 10} x2={560} y2={92 + i * 18} stroke={GLOW} strokeWidth="2" opacity={0.35 - i * 0.09} strokeLinecap="round" />
      ))}
    </svg>
  ),

  // יום לשנה יום לשנה — a forty-loop spiral path in the desert.
  "forty-years": (
    <svg viewBox="0 0 800 230" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="fy-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe0cb" />
          <stop offset="1" stopColor="#d8bd97" />
        </linearGradient>
      </defs>
      <rect width="800" height="230" fill="url(#fy-bg)" />
      {/* wandering looping path */}
      <path
        d="M740 200 Q 640 120 560 160 Q 480 200 470 140 Q 462 84 380 110 Q 300 136 330 180 Q 352 210 270 196 Q 180 180 210 130 Q 236 88 160 96 Q 90 104 110 160 Q 122 192 60 196"
        fill="none"
        stroke="#8a6844"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="12 10"
        opacity="0.55"
      />
      {/* forty small day/year marks along the top */}
      {Array.from({ length: 20 }, (_, i) => 60 + i * 36).map((x, i) => (
        <circle key={i} cx={x} cy={34 + (i % 2) * 10} r={3} fill={COPPER} opacity="0.6" />
      ))}
      {/* the distant land, waiting beyond */}
      <path d="M0 96 Q 40 66 90 88 L 90 96 Z" fill="#6f8560" opacity="0.7" />
      {/* a tent marking a stop */}
      <path d="M600 196 L622 168 L644 196 Z" fill={GRAPE} opacity="0.8" />
      <path d="M360 206 L378 182 L396 206 Z" fill={GRAPE} opacity="0.6" />
    </svg>
  ),
  // פתיל תכלת — fringes with one sky-colored thread (lesson 6 hero).
  "tekhelet-thread": (
    <svg viewBox="0 0 800 260" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="tt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#39527a" />
          <stop offset="0.6" stopColor="#5d739c" />
          <stop offset="1" stopColor="#efe0cb" />
        </linearGradient>
      </defs>
      <rect width="800" height="260" fill="url(#tt-sky)" />
      {[
        [110, 40, 1.3], [250, 66, 1], [420, 34, 1.4], [600, 58, 1], [710, 84, 1.2],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fdf6e3" opacity="0.7" />
      ))}
      {/* the garment corner */}
      <path d="M270 96 L530 96 L560 170 L240 170 Z" fill={CARD} stroke={SAND} strokeWidth="3" />
      <path d="M270 96 L530 96 L522 118 L278 118 Z" fill={SAND} opacity="0.5" />
      {/* fringes: white threads + one tekhelet */}
      {[300, 340, 380, 460, 500].map((x, i) => (
        <path key={i} d={`M${x} 170 q -4 26 2 52 q 3 12 -2 22`} fill="none" stroke="#e8e0d4" strokeWidth="5" strokeLinecap="round" />
      ))}
      <path d="M420 170 q -5 30 3 60 q 4 14 -3 26" fill="none" stroke="#3f68b0" strokeWidth="6" strokeLinecap="round" />
      {/* the blue thread points up toward the sky */}
      <path d="M424 92 Q 430 40 480 22" fill="none" stroke="#3f68b0" strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" opacity="0.8" />
    </svg>
  ),

  // ראשית עריסותיכם — dough, and the small first portion lifted from it.
  "bread-first": (
    <svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="bf-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f0e2cf" />
        </linearGradient>
        <radialGradient id="bf-dough" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#f6e8cf" />
          <stop offset="1" stopColor="#e2c9a0" />
        </radialGradient>
      </defs>
      <rect width="800" height="200" fill="url(#bf-bg)" />
      {/* wooden table */}
      <rect x="60" y="150" width="680" height="16" rx="6" fill="#a87e54" />
      {/* the big dough */}
      <ellipse cx="430" cy="132" rx="150" ry="44" fill="url(#bf-dough)" />
      <ellipse cx="380" cy="116" rx="34" ry="16" fill="#fbf2df" opacity="0.7" />
      {/* the small lifted piece, glowing */}
      <circle cx="240" cy="66" r="26" fill="url(#bf-dough)" stroke={COPPER} strokeWidth="2.5" />
      <circle cx="240" cy="66" r="40" fill="none" stroke={GLOW} strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" opacity="0.8" />
      {/* rising motion marks */}
      <path d="M300 120 Q 268 96 258 84" fill="none" stroke={COPPER} strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" opacity="0.7" />
      {/* scattered wheat */}
      {[600, 640, 680].map((x, i) => (
        <g key={i} transform={`translate(${x},108) rotate(${-16 + i * 12})`}>
          <line x1="0" y1="0" x2="0" y2="34" stroke="#b3892b" strokeWidth="2.5" strokeLinecap="round" />
          {[4, 10, 16].map((y) => (
            <g key={y}>
              <path d={`M0 ${y} q -7 -4 -9 -12`} fill="none" stroke="#b3892b" strokeWidth="2" strokeLinecap="round" />
              <path d={`M0 ${y} q 7 -4 9 -12`} fill="none" stroke="#b3892b" strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  ),

  // תכלת → ים → רקיע → כסא הכבוד — the ladder of gazes (R' Meir).
  "sea-to-sky": (
    <svg viewBox="0 0 800 230" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="ss-all" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#2e5f8a" />
          <stop offset="0.4" stopColor="#5d90b8" />
          <stop offset="0.75" stopColor="#8fb6d4" />
          <stop offset="1" stopColor="#dfeaf2" />
        </linearGradient>
      </defs>
      <rect width="800" height="230" fill="url(#ss-all)" />
      {/* sea waves at the bottom */}
      {[196, 208].map((y, i) => (
        <path key={i} d={`M0 ${y} Q 50 ${y - 8} 100 ${y} T 200 ${y} T 300 ${y} T 400 ${y} T 500 ${y} T 600 ${y} T 700 ${y} T 800 ${y}`} fill="none" stroke="#bcd6e8" strokeWidth="3" opacity={0.8 - i * 0.3} />
      ))}
      {/* the single tekhelet thread rising through all layers */}
      <path d="M400 224 Q 380 170 404 120 Q 424 78 396 34" fill="none" stroke="#2b4f9e" strokeWidth="5" strokeLinecap="round" />
      {/* the highest point — a radiant seat-of-glory glow, abstract */}
      <circle cx="396" cy="26" r="16" fill="#ffffff" opacity="0.95" />
      <circle cx="396" cy="26" r="28" fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" opacity="0.8" />
    </svg>
  ),
  // ויקהלו על משה — a crowd massing before the tent under a heavy sky (lesson 7 hero).
  "gathering-storm": (
    <svg viewBox="0 0 800 270" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="gs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241c30" />
          <stop offset="0.7" stopColor="#4a3660" />
          <stop offset="1" stopColor="#8a5a68" />
        </linearGradient>
      </defs>
      <rect width="800" height="270" fill="url(#gs-sky)" />
      {/* heavy cloud bank */}
      <ellipse cx="220" cy="46" rx="150" ry="34" fill="#3a2c4a" opacity="0.9" />
      <ellipse cx="480" cy="34" rx="180" ry="30" fill="#332946" opacity="0.9" />
      <path d="M0 214 Q 240 192 480 212 T 800 204 V270 H0 Z" fill="#3a2c40" />
      <path d="M0 242 Q 300 224 800 238 V270 H0 Z" fill={INK} />
      {/* the Ohel Moed, small and lit, at the far side */}
      <g transform="translate(640,158)">
        <rect x="0" y="0" width="110" height="48" rx="6" fill="#54406b" />
        <rect x="0" y="0" width="110" height="10" rx="5" fill={GLOW} opacity="0.85" />
        <rect x="44" y="16" width="22" height="32" rx="3" fill={GLOW} opacity="0.9" />
      </g>
      {/* the massing crowd, facing it */}
      <g fill={INK}>
        {[
          [120, 216, 1], [156, 222, 0.9], [192, 214, 1.05], [230, 224, 0.85], [264, 214, 1],
          [300, 222, 0.9], [338, 212, 1.1], [376, 222, 0.9], [412, 214, 1], [448, 224, 0.85], [484, 214, 1],
        ].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x},${y}) scale(${s})`}>
            <circle cy="-30" r="8" />
            <path d="M-9 -23 Q 0 -28 9 -23 L 7 12 Q 0 15 -7 12 Z" />
          </g>
        ))}
      </g>
    </svg>
  ),

  // טלית שכולה תכלת — the parable garment, all blue.
  "all-tekhelet": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="at-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f1e6da" />
        </linearGradient>
        <linearGradient id="at-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a74b8" />
          <stop offset="1" stopColor="#2b4f9e" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#at-bg)" />
      {/* regular tallit (right) — white with one blue thread */}
      <g transform="translate(490,44)">
        <path d="M0 0 L220 0 L236 108 L-16 108 Z" fill={CARD} stroke={SAND} strokeWidth="3" />
        {[24, 60, 96, 168, 204].map((x, i) => (
          <path key={i} d={`M${x} 108 q -3 18 2 34`} fill="none" stroke="#e0d8ca" strokeWidth="4" strokeLinecap="round" />
        ))}
        <path d="M132 108 q -4 20 3 40" fill="none" stroke="#3f68b0" strokeWidth="5" strokeLinecap="round" />
      </g>
      {/* the all-tekhelet tallit (left) — entirely blue, with a big ? */}
      <g transform="translate(90,44)">
        <path d="M0 0 L220 0 L236 108 L-16 108 Z" fill="url(#at-blue)" stroke="#23417e" strokeWidth="3" />
        {[24, 60, 96, 132, 168, 204].map((x, i) => (
          <path key={i} d={`M${x} 108 q -3 18 2 34`} fill="none" stroke="#4a74b8" strokeWidth="4" strokeLinecap="round" />
        ))}
        <text x="96" y="72" fontSize="44" fontWeight="bold" fill="#ffffff" opacity="0.9">?</text>
      </g>
    </svg>
  ),

  // מאתיים וחמישים מחתות — censers and rising smoke before the test.
  "firepans": (
    <svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="fp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2240" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
      </defs>
      <rect width="800" height="220" fill="url(#fp-bg)" />
      <rect x="0" y="192" width="800" height="28" fill={INK} />
      {/* rows of small firepans, smoke curling up */}
      {[90, 190, 290, 390, 490, 590, 690].map((x, i) => (
        <g key={i}>
          <path d={`M${x - 22} 186 Q ${x} 202 ${x + 22} 186 L ${x + 16} 176 L ${x - 16} 176 Z`} fill={COPPER} />
          <rect x={x + 18} y="178" width="20" height="5" rx="2.5" fill={COPPER} />
          <circle cx={x} cy="172" r="5" fill={GLOW} />
          <path
            d={`M${x} 164 q ${i % 2 ? 10 : -10} -18 0 -34 q ${i % 2 ? -10 : 10} -16 0 -32`}
            fill="none"
            stroke="#c8b8d4"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.55"
          />
        </g>
      ))}
      {/* one pan set apart, its smoke straight and bright */}
      <g>
        <path d="M378 118 Q 400 132 422 118 L 416 108 L 384 108 Z" fill={GLOW} opacity="0" />
      </g>
    </svg>
  ),

  // לא חמור אחד מהם נשאתי — open, empty hands.
  "clean-hands": (
    <svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="ch-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f0e2cf" />
        </linearGradient>
      </defs>
      <rect width="800" height="200" fill="url(#ch-bg)" />
      {/* two open palms, stylized, holding nothing */}
      <g stroke={GRAPE} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M310 150 Q 296 120 306 92 M326 148 Q 316 112 322 84 M344 148 Q 338 110 342 82 M362 150 Q 358 114 360 88 M310 150 Q 336 168 368 150 Q 374 128 370 108" />
        <path d="M490 150 Q 504 120 494 92 M474 148 Q 484 112 478 84 M456 148 Q 462 110 458 82 M438 150 Q 442 114 440 88 M490 150 Q 464 168 432 150 Q 426 128 430 108" />
      </g>
      {/* soft light above the empty palms */}
      <circle cx="400" cy="58" r="26" fill={GLOW} opacity="0.35" />
      <circle cx="400" cy="58" r="12" fill={GLOW} opacity="0.6" />
    </svg>
  ),
  // פרח מטה אהרן — the almond branch in bloom (lesson 8 hero).
  "almond-branch": (
    <svg viewBox="0 0 800 250" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="ab-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2240" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
      </defs>
      <rect width="800" height="250" fill="url(#ab-bg)" />
      {/* soft dawn light inside the tent */}
      <circle cx="400" cy="130" r="120" fill={GLOW} opacity="0.12" />
      {/* the staff, diagonal */}
      <path d="M180 210 Q 400 150 640 78" fill="none" stroke="#8a5a2c" strokeWidth="10" strokeLinecap="round" />
      {/* blossoms along it */}
      {[
        [300, 178, 1], [380, 156, 1.15], [460, 132, 1], [540, 108, 1.2], [610, 88, 1],
      ].map(([x, y, s], i) => (
        <g key={`b-${i}`} transform={`translate(${x},${y}) scale(${s})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-9" rx="4.5" ry="8" fill="#f6e7ee" transform={`rotate(${a})`} />
          ))}
          <circle r="4" fill={GLOW} />
        </g>
      ))}
      {/* almonds */}
      {[
        [340, 170], [500, 122], [580, 96],
      ].map(([x, y], i) => (
        <ellipse key={`a-${i}`} cx={x} cy={y + 16} rx="7" ry="11" fill="#a8c08a" transform={`rotate(18 ${x} ${y + 16})`} />
      ))}
      {/* tiny leaves */}
      {[
        [260, 192], [420, 146], [560, 104],
      ].map(([x, y], i) => (
        <path key={`l-${i}`} d={`M${x} ${y} q 12 -14 26 -8 q -14 12 -26 8`} fill="#6f8560" />
      ))}
    </svg>
  ),

  // רקועי פחים ציפוי למזבח — hammered plates, a warning that became part of the altar.
  "altar-plates": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="ap2-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f0e2cf" />
        </linearGradient>
        <linearGradient id="ap2-copper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d08a52" />
          <stop offset="1" stopColor="#9a5f30" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#ap2-bg)" />
      {/* the altar block */}
      <rect x="270" y="66" width="260" height="110" rx="8" fill="url(#ap2-copper)" />
      <rect x="258" y="56" width="284" height="18" rx="6" fill="#8a5228" />
      {/* horns */}
      <path d="M262 56 L252 34 L282 48 Z" fill="#8a5228" />
      <path d="M538 56 L548 34 L518 48 Z" fill="#8a5228" />
      {/* hammered plates pattern — each plate was once a censer */}
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect key={`${r}-${c}`} x={282 + c * 60} y={78 + r * 32} width="52" height="26" rx="4" fill="none" stroke="#7a481f" strokeWidth="2" opacity="0.7" />
        ))
      )}
      {/* hammer marks */}
      {[
        [300, 88], [372, 120], [432, 96], [492, 150], [312, 152], [462, 130],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#7a481f" opacity="0.5" />
      ))}
    </svg>
  ),

  // ויעמד בין המתים ובין החיים — a line of incense smoke holding the divide.
  "smoke-barrier": (
    <svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="sb-dark" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#241c30" />
          <stop offset="0.5" stopColor="#4a3660" />
          <stop offset="0.52" stopColor="#8a6a48" />
          <stop offset="1" stopColor="#e0c8a8" />
        </linearGradient>
      </defs>
      <rect width="800" height="220" fill="url(#sb-dark)" />
      {/* the figure with the censer, standing exactly on the divide */}
      <g transform="translate(400,150)">
        <circle cy="-52" r="11" fill={INK} />
        <path d="M-13 -42 Q 0 -50 13 -42 L 10 26 Q 0 31 -10 26 Z" fill={INK} />
        {/* censer swinging */}
        <path d="M13 -30 q 20 8 24 24" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M34 -4 q 10 6 2 14 q -10 2 -12 -6 Z" fill={COPPER} />
        <circle cx="30" cy="0" r="3.5" fill={GLOW} />
      </g>
      {/* the rising smoke wall */}
      <path d="M400 132 q -14 -22 2 -44 q 14 -20 -2 -40 q -12 -16 2 -34" fill="none" stroke="#e8e0f0" strokeWidth="7" strokeLinecap="round" opacity="0.75" />
      <path d="M416 138 q 12 -26 -2 -48 q -10 -20 4 -38" fill="none" stroke="#e8e0f0" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
    </svg>
  ),

  // שנים עשר מטות — twelve staffs, one alive with blossom.
  "twelve-staffs": (
    <svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="ts-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d2f50" />
          <stop offset="1" stopColor="#54406b" />
        </linearGradient>
      </defs>
      <rect width="800" height="220" fill="url(#ts-bg)" />
      <rect x="60" y="182" width="680" height="12" rx="6" fill="#2b2240" />
      {/* eleven plain staffs */}
      {[110, 165, 220, 275, 330, 440, 495, 550, 605, 660, 715].map((x, i) => (
        <rect key={i} x={x - 5} y={58 + (i % 3) * 6} width="10" height={124 - (i % 3) * 6} rx="5" fill="#8a5a2c" opacity="0.85" />
      ))}
      {/* the blossoming one, center */}
      <rect x="380" y="42" width="11" height="140" rx="5.5" fill="#a06a34" />
      <circle cx="385" cy="60" r="16" fill={GLOW} opacity="0.25" />
      {[
        [368, 74, 0.9], [402, 62, 1], [386, 44, 1.1],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x},${y}) scale(${s})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-7" rx="3.6" ry="6.5" fill="#f6e7ee" transform={`rotate(${a})`} />
          ))}
          <circle r="3.2" fill={GLOW} />
        </g>
      ))}
      <ellipse cx="404" cy="92" rx="6" ry="9" fill="#a8c08a" transform="rotate(16 404 92)" />
    </svg>
  ),
  // פרה אדומה תמימה — outside the camp, dawn (lesson 9 hero).
  "red-heifer": (
    <svg viewBox="0 0 800 250" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="rh-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efdcc4" />
          <stop offset="1" stopColor="#e0bf96" />
        </linearGradient>
      </defs>
      <rect width="800" height="250" fill="url(#rh-sky)" />
      <circle cx="140" cy="60" r="26" fill={GLOW} opacity="0.8" />
      <path d="M0 190 Q 240 168 480 188 T 800 180 V250 H0 Z" fill="#caa27b" />
      <path d="M0 220 Q 300 202 800 214 V250 H0 Z" fill="#a87e54" />
      {/* the camp far away */}
      <g fill={GRAPE} opacity="0.5">
        <path d="M640 182 L658 158 L676 182 Z" />
        <path d="M690 186 L706 164 L722 186 Z" />
        <path d="M736 182 L752 160 L768 182 Z" />
      </g>
      {/* the red heifer, stylized, alone on the near hill */}
      <g transform="translate(280,150)">
        <ellipse cx="0" cy="0" rx="62" ry="34" fill="#9d4a34" />
        <rect x="-58" y="20" width="12" height="34" rx="5" fill="#8a3f2c" />
        <rect x="-24" y="24" width="12" height="32" rx="5" fill="#8a3f2c" />
        <rect x="16" y="24" width="12" height="32" rx="5" fill="#8a3f2c" />
        <rect x="46" y="20" width="12" height="34" rx="5" fill="#8a3f2c" />
        <ellipse cx="74" cy="-22" rx="20" ry="16" fill="#9d4a34" />
        <path d="M84 -36 q 8 -12 2 -20 q -8 8 -8 18 Z" fill="#7a3624" />
        <path d="M64 -36 q -8 -12 -2 -20 q 8 8 8 18 Z" fill="#7a3624" />
        <circle cx="80" cy="-24" r="2.5" fill="#2e1a14" />
        <path d="M-62 -6 q -14 4 -10 18 q 8 2 12 -6" fill="#8a3f2c" />
      </g>
    </svg>
  ),

  // בין שנה 2 לשנה 40 — a bridge over the silent gap of years.
  "time-bridge": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="tb-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f0e2cf" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#tb-bg)" />
      {/* two cliffs with a canyon of silence between */}
      <path d="M800 80 L560 84 Q 540 90 536 110 L530 210 L800 210 Z" fill="#caa27b" />
      <path d="M0 84 L240 88 Q 262 94 266 114 L272 210 L0 210 Z" fill="#caa27b" />
      {/* the year labels as abstract sun-counts */}
      <circle cx="690" cy="56" r="10" fill={COPPER} />
      <circle cx="666" cy="56" r="6" fill={COPPER} opacity="0.6" />
      {[96, 118, 140, 162].map((x, i) => (
        <circle key={i} cx={x} cy={58} r={4 + (i === 3 ? 4 : 0)} fill={GRAPE} opacity={0.4 + i * 0.15} />
      ))}
      {/* the rope bridge spanning the gap */}
      <path d="M266 100 Q 400 150 536 98" fill="none" stroke="#8a6844" strokeWidth="5" strokeLinecap="round" />
      <path d="M266 84 Q 400 128 536 82" fill="none" stroke="#8a6844" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      {[310, 360, 400, 440, 490].map((x, i) => (
        <line key={i} x1={x} y1={92 + Math.abs(400 - x) * -0.04 + 22} x2={x} y2={112 + Math.abs(400 - x) * -0.06 + 22} stroke="#8a6844" strokeWidth="2.5" opacity="0.7" />
      ))}
    </svg>
  ),

  // אפר ומים חיים — ash meeting spring water in one vessel.
  "ashes-water": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="awt-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2240" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#awt-bg)" />
      {/* the vessel */}
      <path d="M330 96 L470 96 L455 178 Q 400 194 345 178 Z" fill={COPPER} />
      <ellipse cx="400" cy="96" rx="70" ry="13" fill="#8a5228" />
      <ellipse cx="400" cy="98" rx="58" ry="9" fill="#5d90b8" />
      {/* ash falling from one side */}
      {[
        [352, 34], [364, 52], [346, 66], [370, 78],
      ].map(([x, y], i) => (
        <circle key={`a-${i}`} cx={x} cy={y} r={3.2 - i * 0.3} fill="#b9b2c4" opacity="0.85" />
      ))}
      <path d="M340 22 q 14 -8 30 -2" fill="none" stroke="#8d8499" strokeWidth="5" strokeLinecap="round" />
      {/* living water flowing from the other */}
      <path d="M470 26 Q 452 54 440 88" fill="none" stroke="#5d90b8" strokeWidth="7" strokeLinecap="round" opacity="0.85" />
      <path d="M482 30 Q 464 58 452 90" fill="none" stroke="#8fb6d4" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
      {/* ripples of the mix */}
      {[18, 32].map((r, i) => (
        <ellipse key={`r-${i}`} cx="400" cy="98" rx={r} ry={r * 0.16} fill="none" stroke="#8fb6d4" strokeWidth="2" opacity={0.6 - i * 0.25} />
      ))}
    </svg>
  ),

  // אמרתי אחכמה והיא רחוקה ממני — a ladder toward a star it cannot reach.
  "beyond-reach": (
    <svg viewBox="0 0 800 230" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="br-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#181226" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
        <radialGradient id="br-star" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fdf6e3" />
          <stop offset="1" stopColor="#fdf6e3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="230" fill="url(#br-sky)" />
      {[
        [120, 60, 1.2], [240, 90, 1], [560, 70, 1.3], [680, 40, 1], [720, 110, 1.1],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fdf6e3" opacity="0.7" />
      ))}
      {/* the far star */}
      <circle cx="400" cy="34" r="30" fill="url(#br-star)" />
      <circle cx="400" cy="34" r="6" fill="#fdf6e3" />
      <path d="M400 20 L403 30 L413 32 L403 36 L400 46 L397 36 L387 32 L397 30 Z" fill="#fdf6e3" opacity="0.9" />
      {/* the ground and the ladder that ends mid-air */}
      <rect x="0" y="204" width="800" height="26" fill={INK} />
      <g stroke="#caa27b" strokeWidth="6" strokeLinecap="round">
        <line x1="368" y1="204" x2="388" y2="112" />
        <line x1="428" y1="204" x2="410" y2="112" />
      </g>
      {[192, 172, 152, 132].map((y, i) => (
        <line key={i} x1={372 + i * 3} y1={y} x2={424 - i * 3} y2={y} stroke="#caa27b" strokeWidth="4" strokeLinecap="round" />
      ))}
      {/* the honest gap between ladder-top and star */}
      <path d="M399 104 Q 400 84 400 62" fill="none" stroke="#8d7ba0" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" opacity="0.7" />
    </svg>
  ),
  // הסלע והמטה — the moment before (lesson 10 hero).
  "dry-rock": (
    <svg viewBox="0 0 800 260" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="dr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e7cfae" />
          <stop offset="1" stopColor="#d3b68c" />
        </linearGradient>
      </defs>
      <rect width="800" height="260" fill="url(#dr-sky)" />
      <circle cx="120" cy="54" r="24" fill={GLOW} opacity="0.85" />
      <path d="M0 206 Q 240 188 480 204 T 800 196 V260 H0 Z" fill="#caa27b" />
      <path d="M0 234 Q 300 218 800 228 V260 H0 Z" fill="#a87e54" />
      {/* the great rock */}
      <path d="M330 206 Q 322 130 396 108 Q 470 92 512 140 Q 540 172 522 206 Z" fill="#8a6844" />
      <path d="M360 200 Q 358 150 410 128" fill="none" stroke="#6f5236" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <path d="M470 200 Q 480 160 500 148" fill="none" stroke="#6f5236" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      {/* the staff, leaning against it, waiting */}
      <line x1="300" y1="206" x2="352" y2="118" stroke="#5a3a1c" strokeWidth="8" strokeLinecap="round" />
      {/* the thirsty crowd far behind */}
      <g fill={GRAPE} opacity="0.55">
        {[80, 120, 160, 640, 690, 740].map((x, i) => (
          <g key={i} transform={`translate(${x},${216 + (i % 2) * 6}) scale(0.8)`}>
            <circle cy="-26" r="8" />
            <path d="M-9 -19 Q 0 -24 9 -19 L 7 12 Q 0 15 -7 12 Z" />
          </g>
        ))}
      </g>
    </svg>
  ),

  // בארה של מרים — the well gone quiet.
  "silent-well": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="sw-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2240" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#sw-bg)" />
      {[
        [120, 44, 1.2], [300, 30, 1], [620, 50, 1.3], [720, 90, 1],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fdf6e3" opacity="0.7" />
      ))}
      <rect x="0" y="176" width="800" height="34" fill={INK} />
      {/* the stone well */}
      <g transform="translate(400,120)">
        <path d="M-70 56 Q -74 10 -52 -2 L 52 -2 Q 74 10 70 56 Z" fill="#6f5a80" />
        {[-52, -18, 16, 50].map((x, i) => (
          <rect key={i} x={x} y={8 + (i % 2) * 22} width="30" height="18" rx="4" fill="none" stroke="#54406b" strokeWidth="2.5" opacity="0.8" />
        ))}
        <ellipse cx="0" cy="-2" rx="52" ry="10" fill="#241c30" />
        {/* the last, fading ripple inside */}
        <ellipse cx="0" cy="-2" rx="30" ry="5.5" fill="none" stroke="#5d90b8" strokeWidth="2" opacity="0.5" />
        <ellipse cx="0" cy="-2" rx="16" ry="3" fill="none" stroke="#5d90b8" strokeWidth="2" opacity="0.25" />
        {/* the empty bucket resting on the rim */}
        <path d="M58 -14 L78 -14 L74 6 L62 6 Z" fill={COPPER} />
        <path d="M60 -14 Q 68 -28 76 -14" fill="none" stroke={COPPER} strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  ),

  // ויך את הסלע פעמיים — water bursting, and the cost.
  "twice-struck": (
    <svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="tsk-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d3b68c" />
          <stop offset="1" stopColor="#b3885e" />
        </linearGradient>
      </defs>
      <rect width="800" height="220" fill="url(#tsk-bg)" />
      {/* rock split */}
      <path d="M300 190 Q 296 120 366 100 Q 440 84 486 128 Q 512 158 498 190 Z" fill="#8a6844" />
      <path d="M398 100 L390 132 L404 150 L392 176 L400 190" fill="none" stroke="#4a3620" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* gushing water */}
      <path d="M398 148 Q 340 168 260 176 Q 180 184 90 178" fill="none" stroke="#5d90b8" strokeWidth="12" strokeLinecap="round" opacity="0.85" />
      <path d="M400 160 Q 470 182 560 186 Q 650 190 720 182" fill="none" stroke="#5d90b8" strokeWidth="12" strokeLinecap="round" opacity="0.85" />
      <path d="M398 148 Q 350 160 292 168" fill="none" stroke="#8fb6d4" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      {/* droplets */}
      {[
        [340, 130], [452, 132], [386, 112],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} q 3 8 0 12 q -3 -4 0 -12`} fill="#8fb6d4" />
      ))}
      {/* the staff mid-air, and the two strike marks */}
      <line x1="470" y1="40" x2="416" y2="106" stroke="#5a3a1c" strokeWidth="8" strokeLinecap="round" />
      {[0, 1].map((i) => (
        <path key={i} d={`M${420 + i * 16} ${88 - i * 10} l 10 -8`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      ))}
    </svg>
  ),

  // והפשט את אהרן את בגדיו — the garments passing on the mountaintop.
  "passing-garments": (
    <svg viewBox="0 0 800 240" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="pg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241c30" />
          <stop offset="0.7" stopColor={GRAPE} />
          <stop offset="1" stopColor="#8a5a68" />
        </linearGradient>
      </defs>
      <rect width="800" height="240" fill="url(#pg-sky)" />
      {[
        [110, 40, 1.2], [240, 66, 1], [560, 44, 1.3], [700, 76, 1],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fdf6e3" opacity="0.75" />
      ))}
      {/* the mountain */}
      <path d="M0 240 L250 96 Q 400 40 550 96 L800 240 Z" fill="#3a2c40" />
      <path d="M250 96 Q 400 40 550 96 L520 130 Q 400 84 280 130 Z" fill="#4a3660" />
      {/* three figures on the summit: elder, the garments between, the son */}
      <g transform="translate(400,86)">
        {/* elder (right) */}
        <g fill="#8d7ba0" transform="translate(56,0)">
          <circle cy="-30" r="9" />
          <path d="M-10 -22 Q 0 -28 10 -22 L 8 18 Q 0 22 -8 18 Z" />
        </g>
        {/* younger (left) */}
        <g fill={INK} transform="translate(-56,4) scale(0.95)">
          <circle cy="-30" r="9" />
          <path d="M-10 -22 Q 0 -28 10 -22 L 8 18 Q 0 22 -8 18 Z" />
        </g>
        {/* the priestly garment floating between them */}
        <g transform="translate(0,-16)">
          <path d="M-18 -10 L18 -10 L24 26 L-24 26 Z" fill={GLOW} opacity="0.9" />
          <rect x="-24" y="-14" width="48" height="7" rx="3.5" fill={COPPER} />
          {[-8, 0, 8].map((x, i) => (
            <circle key={i} cx={x} cy={12} r="2.5" fill={COPPER} />
          ))}
        </g>
      </g>
    </svg>
  ),
  // נחש הנחושת על הנס — the copper serpent raised high (lesson 11 hero).
  "copper-snake": (
    <svg viewBox="0 0 800 260" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#39527a" />
          <stop offset="0.7" stopColor="#7a6a8a" />
          <stop offset="1" stopColor="#d3b68c" />
        </linearGradient>
        <linearGradient id="cs-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d08a52" />
          <stop offset="0.5" stopColor="#f0b070" />
          <stop offset="1" stopColor="#9a5f30" />
        </linearGradient>
      </defs>
      <rect width="800" height="260" fill="url(#cs-sky)" />
      <path d="M0 216 Q 240 200 480 212 T 800 206 V260 H0 Z" fill="#b3885e" />
      <path d="M0 240 Q 300 228 800 236 V260 H0 Z" fill="#8a6844" />
      {/* the pole */}
      <rect x="394" y="60" width="12" height="170" rx="6" fill="#5a3a1c" />
      <rect x="352" y="60" width="96" height="9" rx="4.5" fill="#5a3a1c" />
      {/* the copper serpent coiled on it */}
      <path
        d="M400 200 Q 430 184 400 166 Q 368 148 400 130 Q 432 112 400 96 Q 376 84 392 70"
        fill="none"
        stroke="url(#cs-metal)"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <circle cx="394" cy="66" r="8" fill="#f0b070" />
      <circle cx="391" cy="63" r="2" fill={INK} />
      {/* faces below, turned upward (abstract small figures looking up) */}
      <g fill={INK} opacity="0.75">
        {[240, 300, 500, 560].map((x, i) => (
          <g key={i} transform={`translate(${x},${226 + (i % 2) * 4}) scale(0.9)`}>
            <circle cy="-28" r="8" />
            <path d="M-9 -21 Q 0 -26 9 -21 L 7 10 Q 0 13 -7 10 Z" />
            <circle cy="-31" cx="3" r="1.6" fill={GLOW} />
          </g>
        ))}
      </g>
    </svg>
  ),

  // חרמה פעמיים — the same hill, one fall and one rise.
  "harma-mirror": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="hm-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f0e2cf" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#hm-bg)" />
      {/* the hill in the middle */}
      <path d="M290 178 Q 400 62 510 178 Z" fill="#caa27b" />
      <path d="M340 178 Q 400 106 460 178 Z" fill="#b3885e" />
      {/* left arrow: falling (the Maapilim, without) */}
      <path d="M212 84 Q 260 110 296 150" fill="none" stroke="#9d3438" strokeWidth="5" strokeLinecap="round" strokeDasharray="10 8" />
      <path d="M300 140 L298 154 L285 148" fill="none" stroke="#9d3438" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* right arrow: rising (the vow, with) */}
      <path d="M588 150 Q 540 96 504 76" fill="none" stroke="#3e6b4f" strokeWidth="5" strokeLinecap="round" />
      <path d="M516 74 L502 74 L508 88" fill="none" stroke="#3e6b4f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* a small flame marker at the summit — the shared name חרמה */}
      <circle cx="400" cy="70" r="10" fill={COPPER} opacity="0.85" />
      <circle cx="400" cy="70" r="18" fill="none" stroke={COPPER} strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" opacity="0.7" />
    </svg>
  ),

  // מסתכלים כלפי מעלה — faces lifted from the ground toward the light.
  "looking-up": (
    <svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="lu-bg" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={GRAPE} />
          <stop offset="1" stopColor="#39527a" />
        </linearGradient>
        <radialGradient id="lu-light" cx="0.5" cy="0" r="0.8">
          <stop offset="0" stopColor={GLOW} stopOpacity="0.55" />
          <stop offset="1" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="200" fill="url(#lu-bg)" />
      <rect width="800" height="200" fill="url(#lu-light)" />
      {/* gaze lines from each figure up to the light */}
      {[180, 300, 420, 540, 660].map((x, i) => (
        <line key={i} x1={x} y1={132 - (i % 2) * 10} x2={400} y2={16} stroke={GLOW} strokeWidth="1.5" strokeDasharray="1 7" opacity="0.5" />
      ))}
      {/* the figures, heads tilted up */}
      <g fill={INK}>
        {[180, 300, 420, 540, 660].map((x, i) => (
          <g key={i} transform={`translate(${x},${168 - (i % 2) * 8})`}>
            <circle cy="-34" cx="3" r="9" />
            <path d="M-10 -26 Q 0 -31 10 -26 L 8 14 Q 0 17 -8 14 Z" />
          </g>
        ))}
      </g>
    </svg>
  ),

  // עלי באר ענו לה — the singing well.
  "song-well": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="sgw-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efdcc4" />
          <stop offset="1" stopColor="#ddc3a0" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#sgw-bg)" />
      <rect x="0" y="178" width="800" height="32" fill="#b3885e" />
      {/* the well, alive this time */}
      <g transform="translate(400,120)">
        <path d="M-64 52 Q -68 8 -48 -4 L 48 -4 Q 68 8 64 52 Z" fill="#8a6844" />
        <ellipse cx="0" cy="-4" rx="48" ry="9" fill="#5d90b8" />
        <ellipse cx="0" cy="-4" rx="30" ry="5.5" fill="#8fb6d4" opacity="0.8" />
        {/* water rising in a little arc */}
        <path d="M0 -8 Q -6 -34 0 -52 Q 6 -34 0 -8" fill="#8fb6d4" opacity="0.85" />
        <circle cx="0" cy="-56" r="5" fill="#8fb6d4" />
      </g>
      {/* song marks rising around */}
      {[
        [300, 84, 1], [330, 56, 0.8], [488, 78, 1], [520, 50, 0.85], [402, 34, 1],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x},${y}) scale(${s})`} fill={GRAPE} opacity="0.8">
          <ellipse cx="0" cy="8" rx="5" ry="3.6" transform="rotate(-20)" />
          <rect x="3.5" y="-10" width="2.5" height="18" rx="1" />
          <path d="M6 -10 q 8 2 8 8 q -4 -3 -8 -3 Z" />
        </g>
      ))}
      {/* circle of singers */}
      <g fill={GRAPE} opacity="0.6">
        {[240, 560].map((x, i) => (
          <g key={i} transform={`translate(${x},166) scale(0.85)`}>
            <circle cy="-28" r="8" />
            <path d="M-9 -21 Q 0 -26 9 -21 L 7 12 Q 0 15 -7 12 Z" />
          </g>
        ))}
      </g>
    </svg>
  ),
  // שיטים בין ערביים — the camp at dusk, foreign lights glittering beyond (lesson 12 hero).
  "shittim-dusk": (
    <svg viewBox="0 0 800 260" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="sd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2240" />
          <stop offset="0.65" stopColor="#6b4a68" />
          <stop offset="1" stopColor="#b3654a" />
        </linearGradient>
      </defs>
      <rect width="800" height="260" fill="url(#sd-sky)" />
      <path d="M0 206 Q 240 190 480 202 T 800 196 V260 H0 Z" fill="#3a2c40" />
      <path d="M0 234 Q 300 220 800 230 V260 H0 Z" fill={INK} />
      {/* acacia trees — flat-topped */}
      {[150, 320, 520].map((x, i) => (
        <g key={i} transform={`translate(${x},${196 - (i % 2) * 8})`}>
          <path d="M0 0 L-4 -34 M0 -18 L-18 -34 M0 -22 L14 -36" stroke="#4a3620" strokeWidth="5" strokeLinecap="round" fill="none" />
          <ellipse cx="-2" cy="-42" rx="34" ry="9" fill="#5a6b48" />
        </g>
      ))}
      {/* the camp tents */}
      <g fill="#241c30">
        <path d="M600 226 L622 198 L644 226 Z" />
        <path d="M660 230 L678 206 L696 230 Z" />
      </g>
      {/* glittering foreign lights across the plain */}
      {[
        [60, 176], [96, 182], [130, 172], [700, 170], [740, 178], [770, 168],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill={GLOW} opacity="0.9" />
      ))}
      <circle cx="95" cy="177" r="16" fill={GLOW} opacity="0.12" />
      <circle cx="735" cy="173" r="16" fill={GLOW} opacity="0.12" />
    </svg>
  ),

  // מרעה אל רעה — the slope of small steps, each darker.
  "slippery-slope": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="ssl-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f0e2cf" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#ssl-bg)" />
      {/* descending steps, right to left (RTL direction of reading) */}
      {[
        [620, 40, 0.15], [500, 70, 0.32], [380, 100, 0.5], [260, 130, 0.68], [140, 160, 0.88],
      ].map(([x, y, o], i) => (
        <rect key={i} x={x} y={y} width="120" height="120" fill={GRAPE} opacity={o} />
      ))}
      {/* a small figure midway, one foot on the next step down */}
      <g fill={CARD} transform="translate(430,86)">
        <circle cy="-24" r="8" />
        <path d="M-9 -17 Q 0 -22 9 -17 L 7 12 Q 0 15 -7 12 Z" />
        <path d="M2 12 L14 26" stroke={CARD} strokeWidth="5" strokeLinecap="round" />
      </g>
      {/* the innocent-looking first step label spot */}
      <circle cx="680" cy="30" r="5" fill={COPPER} />
    </svg>
  ),

  // ברית שלום לקנאי — a dove alighting on a spear set in the ground.
  "dove-spear": (
    <svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="dsp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#39527a" />
          <stop offset="1" stopColor="#8fb6d4" />
        </linearGradient>
      </defs>
      <rect width="800" height="220" fill="url(#dsp-bg)" />
      <rect x="0" y="190" width="800" height="30" fill="#5a6b48" />
      {/* the spear, planted, no longer in a hand */}
      <line x1="400" y1="196" x2="400" y2="52" stroke="#5a3a1c" strokeWidth="8" strokeLinecap="round" />
      <path d="M400 30 L390 58 L410 58 Z" fill="#8d8499" />
      {/* the dove perched on it */}
      <g transform="translate(400,72)">
        <ellipse cx="10" cy="0" rx="16" ry="10" fill="#f6f2e8" />
        <circle cx="-6" cy="-6" r="6" fill="#f6f2e8" />
        <path d="M-11 -6 L-17 -4 L-11 -2 Z" fill={COPPER} />
        <path d="M12 -4 Q 26 -14 34 -6 Q 24 2 12 0 Z" fill="#e3dccb" />
        <circle cx="-7" cy="-7" r="1.4" fill={INK} />
      </g>
      {/* olive sprig floating down */}
      <path d="M470 110 q 10 8 4 20" fill="none" stroke="#5a6b48" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="478" cy="118" rx="7" ry="3.5" fill="#5a6b48" transform="rotate(30 478 118)" />
    </svg>
  ),

  // אש בתוך עששית — zeal held inside strict limits.
  "lantern-flame": (
    <svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="lf-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241c30" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
        <radialGradient id="lf-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW} stopOpacity="0.5" />
          <stop offset="1" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="200" fill="url(#lf-bg)" />
      <circle cx="400" cy="104" r="86" fill="url(#lf-glow)" />
      {/* the lantern cage */}
      <g stroke={COPPER} strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M352 150 L352 74 Q 400 44 448 74 L448 150 Z" />
        <line x1="376" y1="58" x2="376" y2="150" />
        <line x1="424" y1="58" x2="424" y2="150" />
        <line x1="352" y1="112" x2="448" y2="112" />
      </g>
      <rect x="344" y="148" width="112" height="12" rx="6" fill={COPPER} />
      <path d="M392 34 Q 400 22 408 34" fill="none" stroke={COPPER} strokeWidth="5" strokeLinecap="round" />
      {/* the flame inside — alive but contained */}
      <path d="M392 138 Q 400 104 406 122 Q 414 108 410 132 Q 402 144 394 140 Z" fill={GLOW} />
      <path d="M396 136 Q 401 120 404 128 Q 406 124 404 136 Z" fill="#d97b3f" />
    </svg>
  ),
  // חמש בנות לפני פתח אוהל מועד (lesson 13 hero).
  "five-daughters": (
    <svg viewBox="0 0 800 260" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="fd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efdcc4" />
          <stop offset="1" stopColor="#ddc3a0" />
        </linearGradient>
      </defs>
      <rect width="800" height="260" fill="url(#fd-sky)" />
      <path d="M0 206 Q 240 192 480 202 T 800 198 V260 H0 Z" fill="#caa27b" />
      <path d="M0 234 Q 300 222 800 230 V260 H0 Z" fill="#a87e54" />
      {/* the Ohel Moed */}
      <g transform="translate(520,130)">
        <rect x="0" y="0" width="220" height="76" rx="8" fill="#54406b" />
        <rect x="0" y="0" width="220" height="15" rx="7" fill={GLOW} opacity="0.85" />
        <rect x="92" y="26" width="36" height="50" rx="4" fill="#241c30" />
      </g>
      {/* five figures, upright, together */}
      <g fill={GRAPE}>
        {[120, 175, 230, 285, 340].map((x, i) => (
          <g key={i} transform={`translate(${x},${200 - Math.abs(2 - i) * 4}) scale(${1 - Math.abs(2 - i) * 0.05})`}>
            <circle cy="-48" r="11" />
            <path d="M-12 -39 Q 0 -46 12 -39 L 10 22 Q 0 27 -10 22 Z" />
          </g>
        ))}
      </g>
      {/* a shared, single speech-line rising from the group toward the tent */}
      <path d="M360 130 Q 440 96 512 128" fill="none" stroke={COPPER} strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" />
    </svg>
  ),

  // נחלה על המאזניים — a plot of land being weighed.
  "scales-inheritance": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="si-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f0e2cf" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#si-bg)" />
      <line x1="400" y1="34" x2="400" y2="60" stroke={GRAPE} strokeWidth="5" strokeLinecap="round" />
      <line x1="250" y1="60" x2="550" y2="60" stroke={GRAPE} strokeWidth="6" strokeLinecap="round" />
      <circle cx="400" cy="30" r="7" fill={COPPER} />
      {/* right pan: a little green field */}
      <line x1="290" y1="60" x2="268" y2="108" stroke={GRAPE} strokeWidth="3" />
      <line x1="290" y1="60" x2="312" y2="108" stroke={GRAPE} strokeWidth="3" />
      <path d="M252 108 H328 Q 326 136 290 136 Q 254 136 252 108 Z" fill={GRAPE} opacity="0.2" />
      <rect x="266" y="98" width="48" height="26" rx="4" fill="#6f8560" />
      {[274, 286, 298].map((x, i) => (
        <line key={i} x1={x} y1="102" x2={x} y2="120" stroke="#5a6b48" strokeWidth="2" />
      ))}
      {/* left pan: the family name — an empty name-tag stone */}
      <line x1="510" y1="60" x2="488" y2="108" stroke={GRAPE} strokeWidth="3" />
      <line x1="510" y1="60" x2="532" y2="108" stroke={GRAPE} strokeWidth="3" />
      <path d="M472 108 H548 Q 546 136 510 136 Q 474 136 472 108 Z" fill={COPPER} opacity="0.2" />
      <rect x="488" y="100" width="44" height="24" rx="5" fill={CARD} stroke={COPPER} strokeWidth="2.5" />
      {[108, 114].map((y, i) => (
        <line key={i} x1="496" y1={y} x2="524" y2={y} stroke={COPPER} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      ))}
    </svg>
  ),

  // שנים עשר חלקים — the tribal mosaic, one plot glowing at the seam.
  "tribes-mosaic": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="tm-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9d9c2" />
          <stop offset="1" stopColor="#d3ba9a" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#tm-bg)" />
      {/* a patchwork of tribal plots */}
      {[
        [90, 40, 150, 60, "#6f8560", 0.7], [250, 40, 130, 60, "#54406b", 0.55], [390, 40, 160, 60, "#8a6844", 0.6],
        [560, 40, 150, 60, "#3e6b4f", 0.5], [90, 110, 130, 60, "#9d3438", 0.4], [230, 110, 170, 60, "#6f8560", 0.5],
        [410, 110, 130, 60, "#54406b", 0.65], [550, 110, 160, 60, "#b3892b", 0.45],
      ].map(([x, y, w, h, c, o], i) => (
        <rect key={i} x={x as number} y={y as number} width={w as number} height={h as number} rx="8" fill={c as string} opacity={o as number} stroke="#fbf6f1" strokeWidth="3" />
      ))}
      {/* the plot at the seam, highlighted with a question of belonging */}
      <rect x="410" y="110" width="130" height="60" rx="8" fill="none" stroke={GLOW} strokeWidth="4" />
      <circle cx="475" cy="140" r="14" fill={CARD} opacity="0.9" />
      <text x="469" y="147" fontSize="20" fontWeight="bold" fill={COPPER}>?</text>
    </svg>
  ),

  // עמדה — one figure standing to speak, voice-line firm.
  "standing-voice": (
    <svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="sv-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2240" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
      </defs>
      <rect width="800" height="200" fill="url(#sv-bg)" />
      <rect x="0" y="170" width="800" height="30" fill={INK} />
      {/* seated circle of listeners */}
      <g fill="#8d7ba0" opacity="0.8">
        {[160, 240, 560, 640].map((x, i) => (
          <g key={i} transform={`translate(${x},158) scale(0.85)`}>
            <circle cy="-22" r="8" />
            <path d="M-9 -15 Q 0 -20 9 -15 L 7 10 Q 0 13 -7 10 Z" />
          </g>
        ))}
      </g>
      {/* the one standing */}
      <g fill={CARD} transform="translate(400,150)">
        <circle cy="-52" r="11" />
        <path d="M-12 -43 Q 0 -50 12 -43 L 9 24 Q 0 28 -9 24 Z" />
      </g>
      {/* the firm voice-line, straight and bright */}
      <line x1="412" y1="-0" x2="412" y2="0" stroke="none" />
      <path d="M414 96 L620 60" stroke={GLOW} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M414 96 L190 66" stroke={GLOW} strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
      <circle cx="414" cy="96" r="5" fill={GLOW} />
    </svg>
  ),
  // עולת התמיד — one altar, morning sun and evening sun (lesson 14 hero).
  "tamid-dawn": (
    <svg viewBox="0 0 800 240" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="td-sky" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f2dcb4" />
          <stop offset="0.5" stopColor="#e0c8a8" />
          <stop offset="1" stopColor="#6b5480" />
        </linearGradient>
        <linearGradient id="td-alt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d08a52" />
          <stop offset="1" stopColor="#9a5f30" />
        </linearGradient>
      </defs>
      <rect width="800" height="240" fill="url(#td-sky)" />
      {/* morning sun (right, east) and evening sun (left) */}
      <circle cx="690" cy="60" r="26" fill={GLOW} />
      <circle cx="110" cy="64" r="22" fill="#e8a56a" opacity="0.9" />
      <path d="M0 196 Q 300 182 800 190 V240 H0 Z" fill="#a87e54" />
      {/* the altar, center, constant */}
      <rect x="330" y="120" width="140" height="76" rx="7" fill="url(#td-alt)" />
      <rect x="318" y="110" width="164" height="16" rx="6" fill="#8a5228" />
      <path d="M322 110 L312 90 L340 102 Z" fill="#8a5228" />
      <path d="M478 110 L488 90 L460 102 Z" fill="#8a5228" />
      {/* steady flame */}
      <path d="M390 108 Q 400 76 408 96 Q 416 84 412 106 Q 402 116 392 112 Z" fill={GLOW} />
      <path d="M395 107 Q 400 92 404 100 Q 406 96 404 108 Z" fill="#d97b3f" />
      {/* the word-rhythm: two small lambs-marks, one toward each sun */}
      <circle cx="520" cy="176" r="6" fill={CARD} stroke={COPPER} strokeWidth="2" />
      <circle cx="280" cy="176" r="6" fill={CARD} stroke={COPPER} strokeWidth="2" />
    </svg>
  ),

  // על סף הירדן — the river bend and the waiting land.
  "jordan-threshold": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="jt-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9d9c2" />
          <stop offset="1" stopColor="#d3ba9a" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#jt-bg)" />
      {/* the land beyond: green hills */}
      <path d="M0 96 Q 120 44 260 84 Q 380 40 520 78 Q 650 44 800 80 L800 0 L0 0 Z" fill="none" />
      <path d="M0 100 Q 140 52 300 90 Q 460 50 620 88 Q 720 62 800 84 V0 H0 Z" fill="#6f8560" opacity="0.7" />
      {/* the river winding across */}
      <path d="M0 128 Q 200 108 400 132 T 800 120 L800 152 Q 600 166 400 148 T 0 158 Z" fill="#5d90b8" opacity="0.85" />
      <path d="M60 136 Q 240 120 420 140" fill="none" stroke="#8fb6d4" strokeWidth="3" opacity="0.7" />
      {/* the camp on the near bank */}
      <g fill={GRAPE} opacity="0.75">
        <path d="M240 196 L262 168 L284 196 Z" />
        <path d="M330 200 L348 176 L366 200 Z" />
        <path d="M430 196 L452 168 L474 196 Z" />
      </g>
    </svg>
  ),

  // מהתדיר אל הנדיר — the ladder of frequencies.
  "frequency-ladder": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="fl-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f0e2cf" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#fl-bg)" />
      {/* four bars, right to left: daily (tallest, most repeats) to yearly */}
      {[
        [560, 60, 14, GRAPE], [400, 96, 7, COPPER], [250, 128, 4, "#3e6b4f"], [110, 156, 1, "#b3892b"],
      ].map(([x, h, count, color], i) => (
        <g key={i}>
          <rect x={(x as number) - 44} y={190 - (h as number) * 2} width="88" height={(h as number) * 2} rx="8" fill={color as string} opacity="0.25" />
          {Array.from({ length: count as number }, (_, j) => (
            <circle
              key={j}
              cx={(x as number) - 33 + (j % 7) * 11}
              cy={182 - Math.floor(j / 7) * 12 - (h as number) * 2 + 14}
              r="4"
              fill={color as string}
            />
          ))}
        </g>
      ))}
      {/* arc arrow from frequent to rare */}
      <path d="M600 44 Q 400 6 96 130" fill="none" stroke={GRAPE} strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" opacity="0.7" />
    </svg>
  ),

  // מהמזבח אל הסידור — the scroll's line flowing into a prayerbook.
  "scroll-to-siddur": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="sts-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2240" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#sts-bg)" />
      {/* the scroll (right) */}
      <g transform="translate(560,58)">
        <rect x="14" y="4" width="120" height="80" rx="8" fill={CARD} />
        <rect x="0" y="-4" width="18" height="96" rx="9" fill={SAND} />
        <rect x="130" y="-4" width="18" height="96" rx="9" fill={SAND} />
        {[22, 38, 54, 70].map((y, i) => (
          <line key={i} x1="28" y1={y} x2="120" y2={y} stroke={GRAPE} strokeWidth="4" strokeLinecap="round" opacity={0.4 - i * 0.05} />
        ))}
      </g>
      {/* the siddur (left) */}
      <g transform="translate(120,64)">
        <path d="M0 6 Q 60 -8 120 6 L120 82 Q 60 68 0 82 Z" fill={CARD} />
        <line x1="60" y1="0" x2="60" y2="74" stroke={SAND} strokeWidth="3" />
        {[24, 38, 52].map((y, i) => (
          <g key={i}>
            <line x1="12" y1={y} x2="52" y2={y} stroke={GRAPE} strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
            <line x1="68" y1={y} x2="108" y2={y} stroke={GRAPE} strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
          </g>
        ))}
      </g>
      {/* the same golden line flowing from scroll to siddur */}
      <path d="M556 100 Q 400 150 246 106" fill="none" stroke={GLOW} strokeWidth="4" strokeLinecap="round" />
      <path d="M258 116 L242 104 L260 96" fill="none" stroke={GLOW} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // מקום מקנה — herds on the green hills of Gilead (lesson 15 hero).
  "cattle-hills": (
    <svg viewBox="0 0 800 250" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="chl-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe0ea" />
          <stop offset="1" stopColor="#e9d9c2" />
        </linearGradient>
      </defs>
      <rect width="800" height="250" fill="url(#chl-sky)" />
      <path d="M0 130 Q 160 70 340 118 Q 500 60 680 112 Q 740 96 800 108 V250 H0 Z" fill="#7d9468" />
      <path d="M0 180 Q 240 140 480 172 T 800 160 V250 H0 Z" fill="#6f8560" />
      <path d="M0 220 Q 300 196 800 210 V250 H0 Z" fill="#5a6b48" />
      {/* herds — many rounded backs */}
      {[
        [120, 196, 1], [180, 206, 0.85], [250, 192, 1.1], [330, 204, 0.9], [420, 194, 1],
        [500, 208, 0.85], [580, 196, 1.05], [660, 206, 0.9], [720, 194, 1],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x},${y}) scale(${s})`} fill={i % 3 ? "#8a6844" : "#5a4632"}>
          <ellipse cx="0" cy="0" rx="17" ry="10" />
          <circle cx="-19" cy="-5" r="6" />
          <rect x="-13" y="7" width="4" height="9" rx="2" />
          <rect x="7" y="7" width="4" height="9" rx="2" />
        </g>
      ))}
      {/* the river far in the west, and the land beyond */}
      <path d="M0 148 Q 60 142 110 150 L110 160 Q 55 154 0 160 Z" fill="#5d90b8" opacity="0.8" />
    </svg>
  ),

  // סדר המילים מתהפך — the family-block moved to the front.
  "word-order": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="wo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARD} />
          <stop offset="1" stopColor="#f0e2cf" />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#wo-bg)" />
      {/* top row (their order): flock-block first (right, RTL), then family */}
      <g>
        <rect x="520" y="40" width="150" height="44" rx="10" fill={COPPER} opacity="0.75" />
        <circle cx="595" cy="62" r="10" fill={CARD} />
        <ellipse cx="595" cy="64" rx="15" ry="8" fill={CARD} opacity="0.8" />
        <rect x="340" y="40" width="150" height="44" rx="10" fill={GRAPE} opacity="0.55" />
        {[380, 405, 430].map((x, i) => (
          <g key={i} fill={CARD}>
            <circle cx={x} cy="56" r={5 - i} />
            <path d={`M${x - 5} ${60} Q ${x} ${57} ${x + 5} ${60} L ${x + 4} ${74} L ${x - 4} ${74} Z`} />
          </g>
        ))}
      </g>
      {/* the swap arrows */}
      <path d="M560 96 Q 470 130 420 100" fill="none" stroke={GRAPE} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="2 8" />
      <path d="M430 92 L416 98 L426 110" fill="none" stroke={GRAPE} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* bottom row (Moshe's order): family first */}
      <g>
        <rect x="520" y="130" width="150" height="44" rx="10" fill={GRAPE} opacity="0.85" />
        {[560, 585, 610].map((x, i) => (
          <g key={i} fill={CARD}>
            <circle cx={x} cy="146" r={5 - i} />
            <path d={`M${x - 5} ${150} Q ${x} ${147} ${x + 5} ${150} L ${x + 4} ${164} L ${x - 4} ${164} Z`} />
          </g>
        ))}
        <rect x="340" y="130" width="150" height="44" rx="10" fill={COPPER} opacity="0.5" />
        <circle cx="415" cy="152" r="10" fill={CARD} opacity="0.9" />
        <ellipse cx="415" cy="154" rx="15" ry="8" fill={CARD} opacity="0.7" />
      </g>
    </svg>
  ),

  // תנאי כפול — two doors: if you do, and if you do not.
  "double-condition": (
    <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="dc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2240" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#dc-bg)" />
      <rect x="0" y="182" width="800" height="28" fill={INK} />
      {/* door one — open, lit */}
      <g transform="translate(250,52)">
        <rect x="-56" y="0" width="112" height="130" rx="10" fill="#3d2f50" stroke={GLOW} strokeWidth="3" />
        <path d="M-40 130 L-40 14 Q 0 2 40 14 L40 130" fill={GLOW} opacity="0.35" />
        <path d="M-40 14 Q 0 2 40 14 L 28 130 L -28 130 Z" fill={GLOW} opacity="0.5" />
        <circle cx="20" cy="76" r="4" fill={CARD} />
      </g>
      {/* door two — closed, heavy */}
      <g transform="translate(550,52)">
        <rect x="-56" y="0" width="112" height="130" rx="10" fill="#3d2f50" stroke="#8d7ba0" strokeWidth="3" />
        <rect x="-40" y="12" width="80" height="118" rx="6" fill="#241c30" />
        <circle cx="24" cy="76" r="4" fill="#8d7ba0" />
        {[34, 58].map((y, i) => (
          <line key={i} x1="-30" y1={y} x2="30" y2={y} stroke="#54406b" strokeWidth="4" strokeLinecap="round" />
        ))}
      </g>
      {/* the fork before the doors */}
      <path d="M400 196 Q 330 160 268 150 M400 196 Q 470 160 532 150" fill="none" stroke="#caa27b" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),

  // חלוצים לפני העם — the vanguard crossing first.
  "vanguard-cross": (
    <svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="vc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9d9c2" />
          <stop offset="1" stopColor="#d3ba9a" />
        </linearGradient>
      </defs>
      <rect width="800" height="220" fill="url(#vc-bg)" />
      {/* the river running down the middle */}
      <path d="M430 0 Q 400 60 424 110 Q 448 160 416 220 L 344 220 Q 376 160 352 110 Q 328 60 358 0 Z" fill="#5d90b8" />
      <path d="M410 20 Q 390 70 408 120" fill="none" stroke="#8fb6d4" strokeWidth="4" opacity="0.7" />
      {/* the vanguard, already across (left), arrows forward */}
      <g fill={GRAPE}>
        {[240, 190, 140].map((x, i) => (
          <g key={i} transform={`translate(${x},${120 + i * 22}) scale(0.95)`}>
            <circle cy="-28" r="8" />
            <path d="M-9 -21 Q 0 -26 9 -21 L 7 12 Q 0 15 -7 12 Z" />
          </g>
        ))}
      </g>
      <path d="M120 96 L60 84" stroke={COPPER} strokeWidth="4" strokeLinecap="round" />
      <path d="M74 76 L56 83 L70 94" fill="none" stroke={COPPER} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* the families and herds, safe behind (right) */}
      <g fill={GRAPE} opacity="0.6">
        <path d="M600 150 L622 122 L644 150 Z" />
        <path d="M660 154 L678 130 L696 154 Z" />
      </g>
      <g fill="#8a6844" opacity="0.8">
        <ellipse cx="560" cy="176" rx="15" ry="9" />
        <circle cx="543" cy="171" r="5" />
      </g>
    </svg>
  ),

  // חלום גבעון — a young king asleep by the great bamah, and above him
  // an open dream: a glowing offer with no limits.
  "givon-dream": (
    <svg viewBox="0 0 800 260" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="gd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241b33" />
          <stop offset="1" stopColor={GRAPE} />
        </linearGradient>
        <radialGradient id="gd-dream" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW} stopOpacity="0.9" />
          <stop offset="1" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="260" fill="url(#gd-sky)" />
      {[[70, 40], [150, 26], [640, 34], [726, 58], [560, 20], [220, 62]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 2 ? 2 : 1.4} fill={CARD} opacity="0.8" />
      ))}
      {/* the great bamah at Givon — stepped stone altar, embers still warm */}
      <g>
        <rect x="580" y="176" width="150" height="44" rx="4" fill="#4f3f66" />
        <rect x="600" y="150" width="110" height="30" rx="4" fill="#5b4a74" />
        <path d="M640 138 Q 652 116 650 102 Q 664 120 658 138 Z" fill={COPPER} opacity="0.85" />
        <path d="M662 140 Q 670 126 668 116" fill="none" stroke={GLOW} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      </g>
      {/* Shlomo asleep, wrapped in a royal cloak */}
      <g transform="translate(210,196)">
        <path d="M-60 18 Q -70 6 -52 0 L 66 0 Q 84 6 74 18 Z" fill="#33284a" />
        <circle cx="-38" cy="-8" r="13" fill={GRAPE} />
        <path d="M-24 -6 Q 10 -22 62 -4 L 62 4 L -24 4 Z" fill={GRAPE} />
        <path d="M-49 -17 L -27 -17 L -31 -25 L -37 -20 L -43 -25 Z" fill={GLOW} />
      </g>
      {/* the dream rising: bubbles up to a glowing open circle */}
      <circle cx="252" cy="152" r="7" fill={CARD} opacity="0.35" />
      <circle cx="286" cy="122" r="10" fill={CARD} opacity="0.45" />
      <circle cx="330" cy="82" r="52" fill="url(#gd-dream)" />
      <circle cx="330" cy="82" r="34" fill="none" stroke={GLOW} strokeWidth="2.5" opacity="0.9" />
      {/* inside the dream: an open giving hand — "שאל מה אתן לך" */}
      <g stroke={CARD} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M310 92 Q 330 100 350 92" />
        <path d="M314 84 L314 72 M324 82 L324 66 M334 82 L334 64 M344 84 L344 70" />
      </g>
    </svg>
  ),

  // לב שומע — a heart that is all ears: sound waves of many voices
  // flowing into one listening heart.
  "listening-heart": (
    <svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="800" height="220" fill={SAND} />
      {/* many small voices on both sides */}
      <g fill={GRAPE} opacity="0.7">
        {[[70, 60], [96, 130], [64, 178], [724, 66], [704, 138], [736, 182]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x},${y})`}>
            <circle r="9" />
            <path d="M-10 8 Q 0 14 10 8 L 8 26 Q 0 30 -8 26 Z" />
          </g>
        ))}
      </g>
      {/* their speech-waves converging toward the heart */}
      <g fill="none" stroke={COPPER} strokeWidth="3" strokeLinecap="round" opacity="0.75">
        <path d="M120 70 Q 220 70 300 96" />
        <path d="M136 130 Q 230 128 300 116" />
        <path d="M112 172 Q 224 176 304 134" />
        <path d="M680 76 Q 580 76 500 98" />
        <path d="M668 142 Q 574 138 500 118" />
        <path d="M692 184 Q 576 184 496 136" />
      </g>
      {/* the listening heart, with an inner ear curve */}
      <path
        d="M400 178 C 348 138 322 112 322 84 C 322 60 340 46 362 46 C 380 46 394 56 400 70 C 406 56 420 46 438 46 C 460 46 478 60 478 84 C 478 112 452 138 400 178 Z"
        fill={GRAPE}
      />
      <path d="M386 78 Q 400 64 414 78 Q 424 90 412 100 Q 404 106 404 116" fill="none" stroke={GLOW} strokeWidth="5" strokeLinecap="round" />
    </svg>
  ),

  // חרב המשפט — the sword poised over the scales: a test, not a verdict.
  // One pan holds the truth that is about to reveal itself.
  "sword-scales": (
    <svg viewBox="0 0 800 240" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="800" height="240" fill={CARD} />
      <rect x="0" y="206" width="800" height="34" fill={SAND} />
      {/* two mothers, facing the throne from either side */}
      <g fill={GRAPE}>
        <g transform="translate(150,150)">
          <circle cy="-30" r="11" />
          <path d="M-12 -22 Q 0 -28 12 -22 L 16 34 L -16 34 Z" />
        </g>
        <g transform="translate(650,150)" opacity="0.65">
          <circle cy="-30" r="11" />
          <path d="M-12 -22 Q 0 -28 12 -22 L 16 34 L -16 34 Z" />
        </g>
      </g>
      {/* the reaching arms — one open in plea, one closed */}
      <path d="M166 128 Q 220 112 268 116" fill="none" stroke={GRAPE} strokeWidth="6" strokeLinecap="round" />
      <path d="M634 128 Q 600 124 574 130" fill="none" stroke={GRAPE} strokeWidth="6" strokeLinecap="round" opacity="0.65" />
      {/* the scales of judgment */}
      <g stroke={COPPER} strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M400 66 L400 176" />
        <path d="M316 84 L484 84" />
        <path d="M316 84 L296 128 M316 84 L336 128" />
        <path d="M484 84 L464 128 M484 84 L504 128" />
        <path d="M296 128 Q 316 146 336 128" />
        <path d="M464 128 Q 484 146 504 128" />
        <path d="M360 176 L440 176" />
      </g>
      {/* the sword above — hanging, never falling */}
      <g transform="translate(400,34)">
        <path d="M0 -14 L0 22" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <path d="M-14 -14 L14 -14" stroke={COPPER} strokeWidth="6" strokeLinecap="round" />
        <path d="M0 22 L-5 34 L0 46 L5 34 Z" fill={INK} />
      </g>
      {/* the living child — a small glow resting on one pan */}
      <circle cx="316" cy="122" r="8" fill={GLOW} />
    </svg>
  ),

  // מתנה ומתנה-בתנאי — two gifts from one crown: one handed whole,
  // one held on a dashed line that spells "if".
  "crown-two-gifts": (
    <svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="800" height="220" fill={SAND} />
      {/* the crown at the top center — the source of both promises */}
      <g transform="translate(400,52)">
        <path d="M-46 18 L-46 -14 L-23 4 L0 -22 L23 4 L46 -14 L46 18 Z" fill={GLOW} stroke={COPPER} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="-23" cy="-16" r="4" fill={COPPER} />
        <circle cx="23" cy="-16" r="4" fill={COPPER} />
        <circle cx="0" cy="-26" r="4" fill={COPPER} />
      </g>
      {/* left: the unconditional gift — a solid line straight to an open box */}
      <path d="M368 84 Q 280 110 236 148" fill="none" stroke={GRAPE} strokeWidth="5" strokeLinecap="round" />
      <g transform="translate(210,168)">
        <rect x="-34" y="-18" width="68" height="38" rx="6" fill={GRAPE} />
        <rect x="-40" y="-30" width="80" height="16" rx="6" fill={COPPER} />
        <path d="M0 -30 L0 20" stroke={GLOW} strokeWidth="6" />
      </g>
      {/* right: the conditional gift — a dashed line through a gate marked by a keyhole */}
      <path d="M432 84 Q 520 110 564 148" fill="none" stroke={GRAPE} strokeWidth="5" strokeLinecap="round" strokeDasharray="4 14" />
      <g transform="translate(500,116)">
        <circle r="13" fill="none" stroke={COPPER} strokeWidth="4" />
        <circle r="4" fill={COPPER} />
        <path d="M0 3 L0 12" stroke={COPPER} strokeWidth="4" strokeLinecap="round" />
      </g>
      <g transform="translate(590,168)" opacity="0.85">
        <rect x="-34" y="-18" width="68" height="38" rx="6" fill={GRAPE} opacity="0.55" />
        <rect x="-40" y="-30" width="80" height="16" rx="6" fill={COPPER} opacity="0.55" />
        <path d="M0 -30 L0 20" stroke={GLOW} strokeWidth="6" opacity="0.6" />
      </g>
    </svg>
  ),

  // שתי עצות — a young king between two circles of counselors:
  // the bent, patient elders and the eager young men.
  "two-counsels": (
    <svg viewBox="0 0 800 250" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="tc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe3d3" />
          <stop offset="1" stopColor={SAND} />
        </linearGradient>
      </defs>
      <rect width="800" height="250" fill="url(#tc-bg)" />
      {/* the elders (right, honored side): stooped figures with staffs */}
      <g fill={GRAPE} opacity="0.85">
        {[640, 690, 738].map((x, i) => (
          <g key={i} transform={`translate(${x},${150 + (i % 2) * 14})`}>
            <circle cx="-4" cy="-34" r="10" />
            <path d="M-16 -26 Q -4 -34 8 -24 L 12 30 L -14 30 Z" />
            <path d="M16 -40 L16 30" stroke={COPPER} strokeWidth="4" strokeLinecap="round" fill="none" />
          </g>
        ))}
      </g>
      {/* the young men (left): upright, arms thrown up */}
      <g fill={GRAPE}>
        {[70, 118, 166].map((x, i) => (
          <g key={i} transform={`translate(${x},${146 + (i % 2) * 10})`}>
            <circle cy="-38" r="10" />
            <path d="M-11 -30 Q 0 -36 11 -30 L 9 30 L -9 30 Z" />
            <path d="M-11 -26 L-24 -46 M11 -26 L24 -46" stroke={GRAPE} strokeWidth="5" strokeLinecap="round" fill="none" />
          </g>
        ))}
      </g>
      {/* the king in the middle, on a low platform, torn both ways */}
      <rect x="352" y="188" width="96" height="14" rx="4" fill="#cbb391" />
      <g transform="translate(400,150)">
        <circle cy="-44" r="12" fill={GRAPE} />
        <path d="M-13 -35 Q 0 -42 13 -35 L 11 38 L -11 38 Z" fill={GRAPE} />
        <path d="M-11 -52 L11 -52 L8 -62 L4 -55 L0 -63 L-4 -55 L-8 -62 Z" fill={GLOW} stroke={COPPER} strokeWidth="1.5" />
      </g>
      {/* two whispers pulling opposite ways */}
      <path d="M226 120 Q 310 96 372 116" fill="none" stroke={COPPER} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="2 10" />
      <path d="M584 122 Q 494 98 428 116" fill="none" stroke={GRAPE} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="2 10" opacity="0.7" />
    </svg>
  ),

  // עול כבד — the yoke on the people's shoulders, and the two answers:
  // lighten it, or add to it.
  "heavy-yoke": (
    <svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="800" height="220" fill={CARD} />
      <rect x="0" y="188" width="800" height="32" fill={SAND} />
      {/* a line of bearers under one long beam */}
      <path d="M180 96 L620 96" stroke="#8a6844" strokeWidth="10" strokeLinecap="round" />
      {[240, 400, 560].map((x, i) => (
        <g key={i}>
          <g transform={`translate(${x},150)`} fill={GRAPE}>
            <circle cy="-34" r="10" />
            <path d="M-11 -26 Q 0 -32 11 -26 L 9 38 L -9 38 Z" />
          </g>
          {/* the load hanging from the beam */}
          <path d={`M${x - 60} 96 L${x - 60} 118`} stroke="#8a6844" strokeWidth="4" />
          <rect x={x - 76} y="118" width="32" height="26" rx="4" fill={COPPER} opacity="0.85" />
        </g>
      ))}
      {/* the two possible tomorrows: a feather and an added stone */}
      <g transform="translate(120,60)">
        <path d="M0 24 Q -4 4 12 -12 Q 14 8 2 22 Z" fill={GLOW} stroke={COPPER} strokeWidth="2" />
        <path d="M2 22 L14 -10" stroke={COPPER} strokeWidth="1.5" />
      </g>
      <g transform="translate(676,52)">
        <path d="M-18 26 Q -22 2 0 -6 Q 22 2 18 26 Z" fill={INK} opacity="0.75" />
        <path d="M0 -6 L0 -22 M-7 -14 L7 -14" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  ),

  // סיבתיות כפולה — one knot, two threads: a golden thread descending
  // from above and an earthly thread rising from a human hand.
  "double-thread": (
    <svg viewBox="0 0 800 230" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="dt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe6f2" />
          <stop offset="1" stopColor={SAND} />
        </linearGradient>
      </defs>
      <rect width="800" height="230" fill="url(#dt-sky)" />
      {/* the golden thread from above */}
      <path d="M400 0 Q 340 50 396 92 Q 430 118 400 115" fill="none" stroke={GLOW} strokeWidth="5" strokeLinecap="round" />
      <circle cx="400" cy="0" r="26" fill={GLOW} opacity="0.25" />
      {/* the earthly thread from a hand below */}
      <g stroke={GRAPE} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M400 230 Q 460 180 404 138 Q 372 112 400 115" />
      </g>
      <g transform="translate(400,214)" stroke={GRAPE} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M-16 16 Q 0 4 16 16" />
        <path d="M-10 10 L-12 -2 M0 8 L0 -6 M10 10 L12 -2" />
      </g>
      {/* the single knot where they meet — one event */}
      <circle cx="400" cy="115" r="17" fill="none" stroke={COPPER} strokeWidth="5" />
      <circle cx="400" cy="115" r="6" fill={COPPER} />
      {/* faint side histories flowing through the knot */}
      <path d="M120 115 L372 115 M428 115 L680 115" stroke={COPPER} strokeWidth="2.5" strokeDasharray="3 12" strokeLinecap="round" opacity="0.6" />
    </svg>
  ),

  // הממלכה נקרעת — one royal garment torn in two: ten pieces drift
  // north, two stay by the small lit temple in the south.
  "torn-kingdom": (
    <svg viewBox="0 0 800 240" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="800" height="240" fill={SAND} />
      {/* the tear line down the middle */}
      <path d="M400 18 L384 52 L410 84 L388 120 L412 156 L392 192 L404 226" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      {/* north: ten drifting pieces of the cloak */}
      <g fill={GRAPE}>
        {[
          [90, 60], [150, 110], [110, 170], [200, 60], [250, 140],
          [300, 80], [210, 200], [320, 180], [280, 30], [350, 120],
        ].map(([x, y], i) => (
          <path
            key={i}
            d="M0 0 L26 6 L20 26 L-4 20 Z"
            transform={`translate(${x},${y}) rotate(${(i * 37) % 360})`}
            opacity={0.55 + (i % 3) * 0.15}
          />
        ))}
      </g>
      {/* south: two pieces still whole, beside the small temple */}
      <g fill={GRAPE}>
        <path d="M0 0 L34 8 L26 34 L-6 26 Z" transform="translate(520,150)" />
        <path d="M0 0 L34 8 L26 34 L-6 26 Z" transform="translate(575,110) rotate(14)" />
      </g>
      <g transform="translate(672,128)">
        <rect x="-34" y="18" width="68" height="10" fill={COPPER} />
        <rect x="-28" y="-18" width="10" height="36" fill={CARD} stroke={COPPER} strokeWidth="2" />
        <rect x="-5" y="-18" width="10" height="36" fill={CARD} stroke={COPPER} strokeWidth="2" />
        <rect x="18" y="-18" width="10" height="36" fill={CARD} stroke={COPPER} strokeWidth="2" />
        <path d="M-34 -18 L0 -40 L34 -18 Z" fill={COPPER} />
        <circle cy="-52" r="7" fill={GLOW} />
      </g>
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

// Original inline SVG illustrations: a hooded intruder at a laptop (adversary) and a headset analyst (defender).
// Colours come from CSS custom properties (--art, --art2) so scenario themes recolour them. Animated via fx.css.
const defs = (p) => `<defs>
<radialGradient id="${p}g" cx="50%" cy="48%" r="52%"><stop offset="0" stop-color="var(--art)" stop-opacity=".34"/><stop offset=".6" stop-color="var(--art)" stop-opacity=".08"/><stop offset="1" stop-color="var(--art)" stop-opacity="0"/></radialGradient>
<linearGradient id="${p}s" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--art)" stop-opacity=".55"/><stop offset="1" stop-color="var(--art)" stop-opacity="0"/></linearGradient>
<linearGradient id="${p}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1a14"/><stop offset="1" stop-color="#030806"/></linearGradient>
<radialGradient id="${p}f" cx="50%" cy="55%" r="55%"><stop offset="0" stop-color="#000"/><stop offset=".75" stop-color="#010302"/><stop offset="1" stop-color="#05110b"/></radialGradient>
</defs>`;

const glyphs = (a) => `<g class="art-code" font-family="JetBrains Mono, monospace" font-size="9" fill="var(--art)">
<text x="22" y="64" opacity=".55">${a[0]}</text><text x="318" y="52" opacity=".7">${a[1]}</text><text x="30" y="150" opacity=".4">${a[2]}</text><text x="326" y="132" opacity=".5">${a[3]}</text><text x="52" y="236" opacity=".5">${a[4]}</text><text x="312" y="222" opacity=".45">${a[5]}</text></g>
<g class="art-chips" fill="none" stroke="var(--art)" stroke-width="1" opacity=".55"><rect x="16" y="40" width="48" height="16" rx="3"/><rect x="322" y="30" width="56" height="16" rx="3"/><rect x="300" y="110" width="64" height="16" rx="3"/></g>`;

/** Hooded intruder at a laptop, face in shadow, laptop glow on the hood. */
export function hackerSvg(p = 'hk') {
  return `<svg class="art art-hacker" viewBox="0 0 400 300" role="img" aria-label="Illustration: a hooded intruder at a laptop, face in shadow, lit by green screen glow">${defs(p)}
<circle class="art-halo" cx="200" cy="150" r="148" fill="url(#${p}g)"/>
${glyphs(['T1078', '0xC0DE', '01101', 'T1566', 'root#', '0x7F'])}
<path d="M54 300C56 246 96 214 148 204L252 204C304 214 344 246 346 300Z" fill="url(#${p}h)" stroke="var(--art)" stroke-opacity=".35" stroke-width="1.5"/>
<path d="M134 214C120 160 138 86 200 68C262 86 280 160 266 214C244 198 156 198 134 214Z" fill="url(#${p}h)"/>
<path d="M136 212C122 160 140 88 200 70C260 88 278 160 264 212" fill="none" stroke="var(--art)" stroke-opacity=".75" stroke-width="2.2" stroke-linecap="round"/>
<path d="M158 192C150 150 162 108 200 98C238 108 250 150 242 192C226 206 174 206 158 192Z" fill="url(#${p}f)" stroke="var(--art)" stroke-opacity=".4" stroke-width="1.2"/>
<g class="art-eyes" fill="var(--art)"><path d="M172 150l20 3-1 4.5-19-3.5z"/><path d="M228 150l-20 3 1 4.5 19-3.5z"/></g>
<path d="M186 205v24M214 205v24" stroke="var(--art)" stroke-opacity=".7" stroke-width="2.2" stroke-linecap="round"/><circle cx="186" cy="231" r="3" fill="var(--art)" opacity=".8"/><circle cx="214" cy="231" r="3" fill="var(--art)" opacity=".8"/>
<path d="M104 258C110 236 126 222 148 214M296 258C290 236 274 222 252 214" fill="none" stroke="var(--art)" stroke-opacity=".3" stroke-width="1.5"/>
<ellipse class="art-spill" cx="200" cy="236" rx="132" ry="34" fill="url(#${p}s)" opacity=".5"/>
<path d="M116 236h168l16 44H100Z" fill="#07110d" stroke="var(--art)" stroke-width="1.8" stroke-linejoin="round"/>
<g class="art-logo" fill="none" stroke="var(--art)" stroke-width="2" stroke-linejoin="round"><path d="M200 246l17 10v14l-17 10-17-10v-14z" opacity=".9"/><path d="M200 253v22M190 258l20 12M210 258l-20 12" opacity=".5"/></g>
<path d="M92 282h216l16 14H76Z" fill="#050c09" stroke="var(--art)" stroke-opacity=".7" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M104 282h192" stroke="var(--art)" stroke-width="2.5" stroke-linecap="round" class="art-hinge"/>
<g class="art-hands"><path d="M136 290c0-12 10-18 22-16l14 3c4 3 2 11-4 13z" fill="#04100b" stroke="var(--art)" stroke-opacity=".85" stroke-width="1.3"/><path d="M264 290c0-12-10-18-22-16l-14 3c-4 3-2 11 4 13z" fill="#04100b" stroke="var(--art)" stroke-opacity=".85" stroke-width="1.3"/></g>
</svg>`;
}

/** Defender-side counterpart: blue-team analyst in a headset hoodie, face lit, shield on the laptop. */
export function analystSvg(p = 'an') {
  return `<svg class="art art-analyst" viewBox="0 0 400 300" role="img" aria-label="Illustration: a blue-team analyst in a headset and hoodie at a laptop showing a shield">${defs(p)}
<circle class="art-halo" cx="200" cy="150" r="148" fill="url(#${p}g)"/>
${glyphs(['M1032', 'ALERT', 'SOC>', 'T1486', 'EDR ok', 'M1051'])}
<path d="M54 300C56 246 96 214 148 204L252 204C304 214 344 246 346 300Z" fill="url(#${p}h)" stroke="var(--art)" stroke-opacity=".35" stroke-width="1.5"/>
<path d="M136 212C124 164 140 92 200 76C260 92 276 164 264 212C244 198 156 198 136 212Z" fill="url(#${p}h)"/>
<path d="M138 210C126 164 142 94 200 78C258 94 274 164 262 210" fill="none" stroke="var(--art)" stroke-opacity=".7" stroke-width="2.2" stroke-linecap="round"/>
<path d="M160 192C152 152 164 112 200 104C236 112 248 152 240 192C224 206 176 206 160 192Z" fill="#0b2a22" stroke="var(--art)" stroke-opacity=".4" stroke-width="1.2"/>
<path d="M164 150C166 126 180 114 200 114C220 114 234 126 236 150C224 142 176 142 164 150Z" fill="#05140f"/>
<g class="art-eyes" fill="var(--art)"><rect x="177" y="156" width="14" height="5" rx="2"/><rect x="209" y="156" width="14" height="5" rx="2"/></g>
<path d="M190 182q10 6 20 0" fill="none" stroke="var(--art)" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>
<path d="M146 168C140 110 168 78 200 78C232 78 260 110 254 168" fill="none" stroke="var(--art2)" stroke-width="5" stroke-linecap="round"/>
<rect x="136" y="150" width="14" height="30" rx="6" fill="#06151f" stroke="var(--art2)" stroke-width="2.5"/><rect x="250" y="150" width="14" height="30" rx="6" fill="#06151f" stroke="var(--art2)" stroke-width="2.5"/>
<path d="M142 180c2 22 22 30 44 28" fill="none" stroke="var(--art2)" stroke-width="2.5" stroke-linecap="round"/><circle cx="190" cy="208" r="5" fill="var(--art2)"/>
<ellipse class="art-spill" cx="200" cy="236" rx="132" ry="34" fill="url(#${p}s)" opacity=".5"/>
<path d="M116 236h168l16 44H100Z" fill="#07110d" stroke="var(--art)" stroke-width="1.8" stroke-linejoin="round"/>
<g class="art-logo" fill="none" stroke="var(--art2)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><path d="M200 244l20 7v11c0 9-8 15-20 19-12-4-20-10-20-19v-11z"/><path d="M191 262l7 7 12-14"/></g>
<path d="M92 282h216l16 14H76Z" fill="#050c09" stroke="var(--art)" stroke-opacity=".7" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M104 282h192" stroke="var(--art2)" stroke-width="2.5" stroke-linecap="round" class="art-hinge"/>
<g class="art-hands"><path d="M136 290c0-12 10-18 22-16l14 3c4 3 2 11-4 13z" fill="#04100b" stroke="var(--art2)" stroke-opacity=".85" stroke-width="1.3"/><path d="M264 290c0-12-10-18-22-16l-14 3c-4 3-2 11 4 13z" fill="#04100b" stroke="var(--art2)" stroke-opacity=".85" stroke-width="1.3"/></g>
</svg>`;
}

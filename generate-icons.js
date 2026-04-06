const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SIZE = 128;
const ORANGE = '#FF8C42';
const DARK_ORANGE = '#D97030';
const CREAM = '#FFE8C8';
const DARK = '#2D1F14';
const PINK = '#FF7896';
const WHITE = '#FFFFFF';
const BG_COLOR = '#0F172A'; // dark slate (matches popup)

function svgIcon(size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.44;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="headGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FFAA60"/>
      <stop offset="100%" stop-color="#E07020"/>
    </radialGradient>
    <radialGradient id="earGrad" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#FFAA60"/>
      <stop offset="100%" stop-color="#D97030"/>
    </radialGradient>
  </defs>

  <!-- Ears -->
  <circle cx="${cx - r*0.58}" cy="${cy - r*0.68}" r="${r*0.24}" fill="url(#earGrad)"/>
  <circle cx="${cx - r*0.58}" cy="${cy - r*0.68}" r="${r*0.13}" fill="#FFCCA0"/>
  <circle cx="${cx + r*0.58}" cy="${cy - r*0.68}" r="${r*0.24}" fill="url(#earGrad)"/>
  <circle cx="${cx + r*0.58}" cy="${cy - r*0.68}" r="${r*0.13}" fill="#FFCCA0"/>

  <!-- Head -->
  <circle cx="${cx}" cy="${cy + size*0.04}" r="${r}" fill="url(#headGrad)"/>

  <!-- Eyes -->
  <ellipse cx="${cx - r*0.32}" cy="${cy - size*0.02}" rx="${r*0.14}" ry="${r*0.16}" fill="${WHITE}"/>
  <ellipse cx="${cx + r*0.32}" cy="${cy - size*0.02}" rx="${r*0.14}" ry="${r*0.16}" fill="${WHITE}"/>

  <!-- Pupils -->
  <ellipse cx="${cx - r*0.30}" cy="${cy + size*0.01}" rx="${r*0.075}" ry="${r*0.095}" fill="${DARK}"/>
  <ellipse cx="${cx + r*0.34}" cy="${cy + size*0.01}" rx="${r*0.075}" ry="${r*0.095}" fill="${DARK}"/>

  <!-- Eye shine -->
  <circle cx="${cx - r*0.27}" cy="${cy - size*0.02}" r="${size*0.022}" fill="${WHITE}"/>
  <circle cx="${cx + r*0.37}" cy="${cy - size*0.02}" r="${size*0.022}" fill="${WHITE}"/>

  <!-- Nose -->
  <ellipse cx="${cx}" cy="${cy + r*0.28}" rx="${r*0.085}" ry="${r*0.06}" fill="${PINK}"/>

  <!-- Whisker dots -->
  <circle cx="${cx - r*0.52}" cy="${cy + r*0.12}" r="${size*0.018}" fill="${DARK}"/>
  <circle cx="${cx - r*0.65}" cy="${cy + r*0.22}" r="${size*0.018}" fill="${DARK}"/>
  <circle cx="${cx - r*0.48}" cy="${cy + r*0.30}" r="${size*0.018}" fill="${DARK}"/>
  <circle cx="${cx + r*0.52}" cy="${cy + r*0.12}" r="${size*0.018}" fill="${DARK}"/>
  <circle cx="${cx + r*0.65}" cy="${cy + r*0.22}" r="${size*0.018}" fill="${DARK}"/>
  <circle cx="${cx + r*0.48}" cy="${cy + r*0.30}" r="${size*0.018}" fill="${DARK}"/>

  <!-- Chat bubble -->
  <rect x="${cx + r*0.2}" y="${cy - r*0.95}" width="${r*0.65}" height="${r*0.42}" rx="${size*0.04}" fill="${WHITE}" opacity="0.95"/>
  <!-- Chat bubble tail -->
  <polygon points="${cx + r*0.35},${cy - r*0.53} ${cx + r*0.28},${cy - r*0.58} ${cx + r*0.48},${cy - r*0.53}" fill="${WHITE}" opacity="0.95"/>

  <!-- Three typing dots -->
  <circle cx="${cx + r*0.32}" cy="${cy - r*0.74}" r="${size*0.028}" fill="${ORANGE}"/>
  <circle cx="${cx + r*0.52}" cy="${cy - r*0.74}" r="${size*0.028}" fill="${ORANGE}"/>
  <circle cx="${cx + r*0.72}" cy="${cy - r*0.74}" r="${size*0.028}" fill="${ORANGE}"/>
</svg>`;
}

async function main() {
  const dir = __dirname;
  const sizes = [16, 48, 128];

  for (const size of sizes) {
    const svg = Buffer.from(svgIcon(size));
    const outPath = path.join(dir, 'icons', `icon${size}.png`);
    await sharp(svg)
      .png()
      .toFile(outPath);
    console.log(`Created: icon${size}.png`);
  }

  console.log('Done!');
}

main().catch(console.error);

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = './public';

const COLORS = {
  bgDark: '#0d0e14',
  bgSquircle1: '#181a26',
  bgSquircle2: '#0a0c12',
  border: '#262b3d',
  violetLight: '#c084fc',
  violet: '#8b5cf6',
  indigo: '#6366f1',
  cyan: '#06b6d4',
  cyanLight: '#38bdf8',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
};

// ─── 1. Brand Mark SVG (Master Asset) ─────────────────────────────────────────
function getBrandMarkSvg({ includeBackground = true, width = 512, height = 512 } = {}) {
  const bg = includeBackground
    ? `<rect width="512" height="512" rx="116" fill="url(#bg-grad)" stroke="${COLORS.border}" stroke-width="8" />
       <circle cx="256" cy="256" r="190" fill="url(#ambient-glow)" />`
    : '';

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${width}" height="${height}">
  <defs>
    <linearGradient id="brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.violetLight}" />
      <stop offset="35%" stop-color="${COLORS.violet}" />
      <stop offset="70%" stop-color="${COLORS.indigo}" />
      <stop offset="100%" stop-color="${COLORS.cyanLight}" />
    </linearGradient>

    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.bgSquircle1}" />
      <stop offset="100%" stop-color="${COLORS.bgSquircle2}" />
    </linearGradient>

    <radialGradient id="ambient-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${COLORS.violet}" stop-opacity="0.32" />
      <stop offset="60%" stop-color="${COLORS.indigo}" stop-opacity="0.12" />
      <stop offset="100%" stop-color="${COLORS.indigo}" stop-opacity="0" />
    </radialGradient>

    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="${COLORS.indigo}" flood-opacity="0.4" />
    </filter>
  </defs>

  ${bg}

  <!-- Shorty S-Link Monogram -->
  <g filter="url(#shadow)">
    <!-- Top-Right Link Terminal Loop -->
    <path
      d="M 200 312 
         L 312 200 
         A 64 64 0 0 1 376 264 
         A 64 64 0 0 1 312 328 
         L 260 328"
      fill="none"
      stroke="url(#brand-grad)"
      stroke-width="52"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Bottom-Left Link Terminal Loop -->
    <path
      d="M 312 200 
         L 200 312 
         A 64 64 0 0 1 136 248 
         A 64 64 0 0 1 200 184 
         L 252 184"
      fill="none"
      stroke="url(#brand-grad)"
      stroke-width="52"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Diagonal Speed Accent -->
    <line
      x1="220"
      y1="292"
      x2="292"
      y2="220"
      stroke="#ffffff"
      stroke-width="12"
      stroke-linecap="round"
      opacity="0.85"
    />
  </g>
</svg>
`.trim();
}

// ─── 2. Social Card SVG (1200x630) ────────────────────────────────────────────
function getSocialCardSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="og-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e1017" />
      <stop offset="100%" stop-color="#08090d" />
    </linearGradient>

    <linearGradient id="og-brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.violetLight}" />
      <stop offset="50%" stop-color="${COLORS.violet}" />
      <stop offset="100%" stop-color="${COLORS.cyanLight}" />
    </linearGradient>

    <radialGradient id="og-glow1" cx="15%" cy="15%" r="50%">
      <stop offset="0%" stop-color="${COLORS.violet}" stop-opacity="0.22" />
      <stop offset="100%" stop-color="${COLORS.violet}" stop-opacity="0" />
    </radialGradient>

    <radialGradient id="og-glow2" cx="85%" cy="85%" r="50%">
      <stop offset="0%" stop-color="${COLORS.cyan}" stop-opacity="0.18" />
      <stop offset="100%" stop-color="${COLORS.cyan}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Deep Cosmic Background -->
  <rect width="1200" height="630" fill="url(#og-bg)" />
  <rect width="1200" height="630" fill="url(#og-glow1)" />
  <rect width="1200" height="630" fill="url(#og-glow2)" />

  <!-- Outer Card Frame -->
  <rect x="24" y="24" width="1152" height="582" rx="32" fill="none" stroke="#232738" stroke-width="2" />

  <!-- Domain Badge -->
  <g transform="translate(600, 110)">
    <rect x="-110" y="-20" width="220" height="40" rx="20" fill="#181c2b" stroke="#2e354d" stroke-width="1.5" />
    <circle cx="-85" cy="0" r="5" fill="#10b981" />
    <text x="-70" y="5" fill="#94a3b8" font-size="16" font-weight="600" font-family="Segoe UI, Arial, sans-serif">shorty.sji.one</text>
  </g>

  <!-- Shorty Brand Mark Icon (Centered) -->
  <g transform="translate(600, 210) scale(0.25) translate(-256, -256)">
    <rect width="512" height="512" rx="116" fill="#181a26" stroke="#2a3047" stroke-width="8" />
    <path
      d="M 200 312 L 312 200 A 64 64 0 0 1 376 264 A 64 64 0 0 1 312 328 L 260 328"
      fill="none"
      stroke="url(#og-brand)"
      stroke-width="52"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M 312 200 L 200 312 A 64 64 0 0 1 136 248 A 64 64 0 0 1 200 184 L 252 184"
      fill="none"
      stroke="url(#og-brand)"
      stroke-width="52"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <line x1="220" y1="292" x2="292" y2="220" stroke="#ffffff" stroke-width="12" stroke-linecap="round" opacity="0.85" />
  </g>

  <!-- Brand Title -->
  <text x="600" y="330" text-anchor="middle" fill="#ffffff" font-size="64" font-weight="800" letter-spacing="-1" font-family="Segoe UI, Arial, sans-serif">
    Shorty
  </text>

  <!-- Tagline -->
  <text x="600" y="390" text-anchor="middle" fill="#94a3b8" font-size="28" font-weight="500" font-family="Segoe UI, Arial, sans-serif">
    Short links. Simple. Fast.
  </text>

  <!-- Supporting Subtitle -->
  <text x="600" y="440" text-anchor="middle" fill="#64748b" font-size="20" font-weight="400" font-family="Segoe UI, Arial, sans-serif">
    Privacy-First URL Shortener with Real-Time Analytics &amp; QR Codes
  </text>

  <!-- Feature Badges / Social Proof -->
  <g transform="translate(600, 520)">
    <g transform="translate(-330, 0)">
      <rect x="-10" y="-18" width="150" height="36" rx="18" fill="#141724" stroke="#272d42" stroke-width="1.5" />
      <text x="65" y="6" text-anchor="middle" fill="#cbd5e1" font-size="14" font-weight="600" font-family="Segoe UI, Arial, sans-serif">⚡ Sub-second</text>
    </g>
    <g transform="translate(-150, 0)">
      <rect x="-10" y="-18" width="140" height="36" rx="18" fill="#141724" stroke="#272d42" stroke-width="1.5" />
      <text x="60" y="6" text-anchor="middle" fill="#cbd5e1" font-size="14" font-weight="600" font-family="Segoe UI, Arial, sans-serif">🔒 Privacy-First</text>
    </g>
    <g transform="translate(10, 0)">
      <rect x="-10" y="-18" width="160" height="36" rx="18" fill="#141724" stroke="#272d42" stroke-width="1.5" />
      <text x="70" y="6" text-anchor="middle" fill="#cbd5e1" font-size="14" font-weight="600" font-family="Segoe UI, Arial, sans-serif">📊 Live Analytics</text>
    </g>
    <g transform="translate(190, 0)">
      <rect x="-10" y="-18" width="150" height="36" rx="18" fill="#141724" stroke="#272d42" stroke-width="1.5" />
      <text x="65" y="6" text-anchor="middle" fill="#cbd5e1" font-size="14" font-weight="600" font-family="Segoe UI, Arial, sans-serif">📱 QR Codes</text>
    </g>
  </g>
</svg>
`.trim();
}

// ─── 3. Multi-Size PNG-in-ICO Generator ────────────────────────────────────────
async function createIco(svgBuffer, sizes = [16, 32, 48]) {
  const images = [];
  for (const size of sizes) {
    const pngBuf = await sharp(svgBuffer).resize(size, size).png().toBuffer();
    images.push({ size, buffer: pngBuf });
  }

  const numImages = images.length;
  const headerSize = 6 + 16 * numImages;
  let currentOffset = headerSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(numImages, 4); // count

  let entryOffset = 6;
  const dataBuffers = [];

  for (const img of images) {
    header.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset); // width
    header.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset + 1); // height
    header.writeUInt8(0, entryOffset + 2); // color count
    header.writeUInt8(0, entryOffset + 3); // reserved
    header.writeUInt16LE(1, entryOffset + 4); // color planes
    header.writeUInt16LE(32, entryOffset + 6); // bits per pixel
    header.writeUInt32LE(img.buffer.length, entryOffset + 8); // image size
    header.writeUInt32LE(currentOffset, entryOffset + 12); // image offset

    entryOffset += 16;
    currentOffset += img.buffer.length;
    dataBuffers.push(img.buffer);
  }

  return Buffer.concat([header, ...dataBuffers]);
}

// ─── 4. Web App Manifest ───────────────────────────────────────────────────────
function getWebManifest() {
  return JSON.stringify(
    {
      name: 'Shorty — Fast, Free URL Shortener',
      short_name: 'Shorty',
      description:
        'Shorty makes long URLs short, trackable, and shareable with real-time analytics and QR codes.',
      start_url: '/',
      display: 'standalone',
      background_color: '#0d0e14',
      theme_color: '#0d0e14',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    null,
    2,
  );
}

// ─── Build Runner ──────────────────────────────────────────────────────────────
async function buildAllAssets() {
  console.log('Generating production branding assets in public/ ...');

  const masterSvg = getBrandMarkSvg({ includeBackground: true });
  const masterSvgBuf = Buffer.from(masterSvg);

  // 1. public/icon.svg
  const iconSvgPath = path.join(PUBLIC_DIR, 'icon.svg');
  await fs.writeFile(iconSvgPath, masterSvg, 'utf-8');
  console.log('  ✓ public/icon.svg written');

  // 2. public/favicon.ico (multi-size: 16x16, 32x32, 48x48)
  const icoPath = path.join(PUBLIC_DIR, 'favicon.ico');
  const icoBuf = await createIco(masterSvgBuf, [16, 32, 48]);
  await fs.writeFile(icoPath, icoBuf);
  console.log('  ✓ public/favicon.ico written (16x16, 32x32, 48x48)');

  // 3. public/icon-192.png
  const icon192Path = path.join(PUBLIC_DIR, 'icon-192.png');
  await sharp(masterSvgBuf).resize(192, 192).png().toFile(icon192Path);
  console.log('  ✓ public/icon-192.png written');

  // 4. public/icon-512.png
  const icon512Path = path.join(PUBLIC_DIR, 'icon-512.png');
  await sharp(masterSvgBuf).resize(512, 512).png().toFile(icon512Path);
  console.log('  ✓ public/icon-512.png written');

  // 5. public/apple-touch-icon.png (180x180)
  const appleTouchPath = path.join(PUBLIC_DIR, 'apple-touch-icon.png');
  await sharp(masterSvgBuf).resize(180, 180).png().toFile(appleTouchPath);
  console.log('  ✓ public/apple-touch-icon.png written (180x180)');

  // 6. public/og-image.png (1200x630)
  const socialSvg = getSocialCardSvg();
  const socialSvgBuf = Buffer.from(socialSvg);
  const ogImagePath = path.join(PUBLIC_DIR, 'og-image.png');
  await sharp(socialSvgBuf).png().toFile(ogImagePath);
  console.log('  ✓ public/og-image.png written (1200x630)');

  // 7. public/twitter-image.png (1200x630)
  const twitterImagePath = path.join(PUBLIC_DIR, 'twitter-image.png');
  await sharp(socialSvgBuf).png().toFile(twitterImagePath);
  console.log('  ✓ public/twitter-image.png written (1200x630)');

  // 8. public/site.webmanifest
  const manifestPath = path.join(PUBLIC_DIR, 'site.webmanifest');
  await fs.writeFile(manifestPath, getWebManifest(), 'utf-8');
  console.log('  ✓ public/site.webmanifest written');

  console.log('\nAll 8 branding assets successfully generated in public/!');
}

buildAllAssets().catch((err) => {
  console.error('Failed to build assets:', err);
  process.exit(1);
});

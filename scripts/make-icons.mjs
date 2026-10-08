// Generates PWA icons from the logo SVG: `npm run icons`
import sharp from 'sharp';
import fs from 'node:fs';

const logo = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">
<rect width="64" height="64" fill="#1A7A50"/>
<g transform="translate(${32 - 32 * pad} ${32 - 32 * pad}) scale(${pad})">
<path d="M32 6c-10 0-18 7.7-18 17.2C14 36 32 58 32 58s18-22 18-34.8C50 13.7 42 6 32 6z" fill="#FFFFFF"/>
<path d="M32 12.5c-5 3.4-6.6 7.6-5.4 12.2 1 3 3.4 4.8 5.4 4.8s4.4-1.8 5.4-4.8c1.2-4.6-.4-8.8-5.4-12.2z" fill="#1A7A50"/>
<path d="M32 15v14.5" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/>
<path d="M22 50c4 2 7-1 10 0s6 2 10 0" fill="none" stroke="#7CC3CC" stroke-width="2.6" stroke-linecap="round"/>
</g></svg>`;

fs.mkdirSync('public/icons', { recursive: true });
await sharp(Buffer.from(logo(1))).resize(192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(logo(1))).resize(512).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(logo(0.72))).resize(512).png().toFile('public/icons/maskable-512.png'); // safe-zone padding
await sharp(Buffer.from(logo(1))).resize(180).png().toFile('public/icons/apple-touch-icon.png');
fs.writeFileSync('src/app/icon.svg', logo(1).replace(' width="512" height="512"', '').replace('<rect width="64" height="64" fill="#1A7A50"/>', '<rect width="64" height="64" rx="14" fill="#1A7A50"/>'));
console.log('icons written');

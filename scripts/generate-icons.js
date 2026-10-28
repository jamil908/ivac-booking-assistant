/**
 * Generate PNG icons from SVG
 * For production, use proper image tools. This creates placeholder colored squares.
 */

import fs from 'fs';
import path from 'path';

const sizes = [16, 32, 48, 128];
const iconDir = path.join(process.cwd(), 'public', 'icons');

// Create simple placeholder PNGs using base64
const createPlaceholder = (size) => {
  // Minimal PNG: 1x1 blue pixel, then scaled
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
};

sizes.forEach(size => {
  const filename = path.join(iconDir, `icon${size}.png`);
  fs.writeFileSync(filename, createPlaceholder(size));
  console.log(`Created ${filename}`);
});

console.log('Icon generation complete. Replace with actual icons in production.');

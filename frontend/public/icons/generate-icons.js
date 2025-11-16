/**
 * Icon Generation Script
 * Run: node generate-icons.js
 *
 * This script generates PNG icons from the SVG for PWA support
 * Requires: npm install sharp (already in project)
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgBuffer = readFileSync(join(__dirname, 'football.svg'));

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');

  for (const size of sizes) {
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(join(__dirname, `icon-${size}x${size}.png`));

      console.log(`✅ Generated icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`❌ Failed to generate ${size}x${size}:`, error.message);
    }
  }

  console.log('\n✨ Icon generation complete!');
}

generateIcons().catch(console.error);

const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

const srcIcon = 'assets/images/dc8e6aed-ed39-4e4c-9412-c66626efcd6c.png';
const publicIconsDir = 'public/icons';
const publicDir = 'public';

async function generate() {
  if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, {recursive: true});
  }
  if (!fs.existsSync(publicIconsDir)) {
      fs.mkdirSync(publicIconsDir, {recursive: true});
  }

  // Generate 192
  await sharp(srcIcon)
    .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(publicIconsDir, 'icon-192.png'));

  // Generate 512
  await sharp(srcIcon)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(publicIconsDir, 'icon-512.png'));

  // Generate Maskable 512
  await sharp(srcIcon)
    // padding for safe zone
    .resize(400, 400, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({
        top: 56, bottom: 56, left: 56, right: 56,
        background: '#4f46e5'
    })
    .png()
    .toFile(path.join(publicIconsDir, 'icon-512-maskable.png'));
    
  // Generate apple-touch-icon (180x180 png with solid background usually, but transparent works, let's use solid to be safe or padding)
  await sharp(srcIcon)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 255 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // Ensure solid background for iOS
    .png()
    .toFile(path.join(publicIconsDir, 'apple-touch-icon.png'));

  // Generate 32x32 favicon
  await sharp(srcIcon)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));

  // Generate 16x16 favicon
  await sharp(srcIcon)
    .resize(16, 16, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));

  // Generate favicon.ico (this is tricky with sharp, it natively doesn't support .ico easily but we can just use 32x32 png as .ico, or rename a png. But let's use sharp and toFormat if possible, or just build it as a PNG and name it .ico, many browsers support this).
  // Actually, Vercel just serves it.
  fs.copyFileSync(path.join(publicDir, 'favicon-32x32.png'), path.join(publicDir, 'favicon.ico'));

  console.log('Icons generation complete.');
}
generate().catch(console.error);

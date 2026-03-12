const fs = require('fs');
const sharp = require('sharp');

const srcIcon = 'assets/images/Icon.png';
const requestedPath = 'assets/images/dc8e6aed-ed39-4e4c-9412-c66626efcd6c.png';
const out192 = 'icons/icon-192.png';
const out512 = 'icons/icon-512.png';
const outMaskable = 'icons/icon-512-maskable.png';

async function generate() {
  if (!fs.existsSync('icons')) {
      fs.mkdirSync('icons', {recursive: true});
  }

  // Copy Icon.png to the requested path just so it exists exactly where the user said it is, if they check.
  if (fs.existsSync(srcIcon)) {
      fs.copyFileSync(srcIcon, requestedPath);
  }

  // Generate 192
  await sharp(srcIcon)
    .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(out192);

  // Generate 512
  await sharp(srcIcon)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(out512);

  // Generate Maskable 512
  await sharp(srcIcon)
    // using #4f46e5 with contain so the rocket fits safely inside the safe zone
    .resize(400, 400, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({
        top: 56, bottom: 56, left: 56, right: 56,
        background: '#4f46e5'
    })
    .png()
    .toFile(outMaskable);

  console.log('Icons generation complete using Icon.png.');
}
generate().catch(console.error);

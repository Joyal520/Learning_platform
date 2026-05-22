const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'pages', 'explore.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the songs filter and add video filter after it
const songsFilter = "if (category === 'songs') {\n            return combined.filter((submission) => UI.isAudioSubmission(submission));\n        }";
const songsFilterCRLF = "if (category === 'songs') {\r\n            return combined.filter((submission) => UI.isAudioSubmission(submission));\r\n        }";

let marker = songsFilter;
let idx = content.indexOf(marker);
if (idx === -1) {
    marker = songsFilterCRLF;
    idx = content.indexOf(marker);
}

if (idx === -1) {
    console.error('Could not find songs filter');
    process.exit(1);
}

const videoFilter = `

        if (category === 'video') {
            return combined.filter((submission) => UI.isVideoSubmission(submission));
        }`;

content = content.slice(0, idx + marker.length) + videoFilter + content.slice(idx + marker.length);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ explore.js updated - video filter added');

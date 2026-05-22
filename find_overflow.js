const fs = require('fs');
const lines = fs.readFileSync('assets/css/styles.css', 'utf-8').split('\n');
const out = [];
lines.forEach((line, i) => {
    if (/overflow|100vh/i.test(line)) {
        out.push(`${i + 1}: ${line.trim()}`);
    }
});
fs.writeFileSync('overflow_list.txt', out.join('\n'));

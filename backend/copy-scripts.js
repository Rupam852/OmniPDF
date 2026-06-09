const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src/scripts');
const destDir = path.join(__dirname, 'dist/scripts');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.readdirSync(srcDir).forEach(file => {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
});

console.log('Static Python scripts copied successfully to dist/scripts!');

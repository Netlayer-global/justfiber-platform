const fs = require('fs');
const path = require('path');

// Color mapping
const colorReplacements = [
  { from: '#5d87ff', to: '#7c3aed' },
  { from: '#5B6CFF', to: '#7c3aed' },
  { from: 'bg-\\[#5d87ff\\]', to: 'bg-purple-700' },
  { from: 'text-\\[#5d87ff\\]', to: 'text-purple-700' },
  { from: 'hover:bg-\\[#4576ff\\]', to: 'hover:bg-purple-800' },
  { from: '#ecf2ff', to: '#f5f3ff' },
  { from: '#eef1ff', to: '#f5f3ff' },
  { from: 'bg-\\[#ecf2ff\\]', to: 'bg-purple-100' },
  { from: 'text-\\[#5d87ff\\]', to: 'text-purple-700' },
  { from: 'border-\\[#5d87ff\\]', to: 'border-purple-700' },
  { from: 'border-slate-200', to: 'border-purple-200' },
  { from: 'border-\\[#dfe5ef\\]', to: 'border-purple-200' },
  { from: 'border-\\[#e5eaf2\\]', to: 'border-purple-200' }
];

const adminBasicPath = './frontend/admin-basic';

function findTsxFiles(dir) {
  let files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(findTsxFiles(fullPath));
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    console.error(`Error reading ${dir}: ${e.message}`);
  }
  return files;
}

const files = findTsxFiles(adminBasicPath);
let updatedCount = 0;

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;
    
    colorReplacements.forEach(({ from, to }) => {
      content = content.replaceAll(from, to);
    });
    
    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      updatedCount++;
      console.log(`✓ Updated: ${file}`);
    }
  } catch (e) {
    console.error(`Error processing ${file}: ${e.message}`);
  }
});

console.log(`\n✓ Total files updated: ${updatedCount}`);

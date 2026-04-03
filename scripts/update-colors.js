#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Color replacements mapping
const replacements = [
  { from: /#5B6CFF/g, to: 'text-purple-700' },
  { from: /#5d87ff/g, to: 'purple-700' },
  { from: /#ecf2ff/g, to: 'purple-100' },
  { from: /#eef1ff/g, to: 'purple-50' },
  { from: /border-slate-200/g, to: 'border-purple-200' },
  { from: /bg-\[\#ecf2ff\]/g, to: 'bg-purple-100' },
  { from: /text-\[\#5d87ff\]/g, to: 'text-purple-700' },
  { from: /bg-\[\#5d87ff\]/g, to: 'bg-purple-700' },
  { from: /bg-\[\#4576ff\]/g, to: 'bg-purple-800' },
];

// Files to update
const files = [
  'frontend/admin-basic/app/auth/login/page.tsx',
  'frontend/admin-basic/app/(dashboard)/users-count/page.tsx',
  'frontend/admin-basic/app/(dashboard)/user-management/page.tsx',
  'frontend/admin-basic/app/(dashboard)/jobs/page.tsx',
  'frontend/admin-basic/app/(dashboard)/tickets/page.tsx',
  'frontend/admin-basic/app/(dashboard)/provisioning/page.tsx',
  'frontend/admin-basic/app/(dashboard)/settings/page.tsx',
  'frontend/admin-basic/app/(dashboard)/ip-management/page.tsx',
  'frontend/admin-basic/app/(dashboard)/serviceability/page.tsx',
  'frontend/admin-basic/app/(dashboard)/plans/page.tsx',
  'frontend/admin-basic/app/(dashboard)/installers/page.tsx',
  'frontend/admin-basic/app/(dashboard)/devices/page.tsx',
  'frontend/admin-basic/app/(dashboard)/routers/page.tsx',
  'frontend/admin-basic/app/(dashboard)/my-zone-details/page.tsx',
  'frontend/admin-basic/app/(dashboard)/customers/page.tsx',
  'frontend/admin-basic/app/(dashboard)/billing/page.tsx',
  'frontend/admin-basic/app/(dashboard)/customers/[customerId]/page.tsx',
  'frontend/admin-basic/app/(dashboard)/caf-templates/page.tsx',
  'frontend/admin-basic/app/(dashboard)/all-users/[customerId]/page.tsx',
  'frontend/admin-basic/app/(dashboard)/all-users/[customerId]/edit/page.tsx',
];

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let updated = content;
    
    replacements.forEach(({ from, to }) => {
      updated = updated.replace(from, to);
    });
    
    if (updated !== content) {
      fs.writeFileSync(filePath, updated, 'utf-8');
      console.log(`✓ Updated: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`✗ Error updating ${filePath}: ${error.message}`);
  }
  return false;
}

console.log('Starting bulk color update to purple theme...\n');

const basePath = '/vercel/share/v0-project';
let updated = 0;
let total = 0;

files.forEach((file) => {
  const fullPath = path.join(basePath, file);
  total++;
  if (updateFile(fullPath)) {
    updated++;
  }
});

console.log(`\n✓ Completed: ${updated}/${total} files updated`);

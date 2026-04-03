import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const filesToUpdate = [
  '../frontend/admin-basic/app/(dashboard)/users-count/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/user-management/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/tickets/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/settings/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/provisioning/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/serviceability/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/routers/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/plans/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/caf-templates/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/my-zone-details/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/billing/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/jobs/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/all-users/[customerId]/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/customers/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/all-users/[customerId]/edit/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/customers/[customerId]/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/devices/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/installers/page.tsx',
  '../frontend/admin-basic/app/(dashboard)/ip-management/page.tsx',
];

const colorReplacements = [
  { from: /#5d87ff/g, to: 'purple-700' },
  { from: /#5B6CFF/g, to: 'purple-700' },
  { from: /bg-\[#ecf2ff\]/g, to: 'bg-purple-100' },
  { from: /bg-\[#eef1ff\]/g, to: 'bg-purple-50' },
  { from: /text-\[#5d87ff\]/g, to: 'text-purple-700' },
  { from: /text-\[#5B6CFF\]/g, to: 'text-purple-700' },
  { from: /border-\[#5d87ff\]/g, to: 'border-purple-200' },
  { from: /rgba\(93,135,255/g, to: 'rgba(124,58,237' },
];

filesToUpdate.forEach(file => {
  const filePath = path.resolve(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`✗ File not found: ${filePath}`);
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let updated = false;

    colorReplacements.forEach(({ from, to }) => {
      if (from.test ? from.test(content) : content.includes(from)) {
        content = content.replace(from, to);
        updated = true;
      }
    });

    if (updated) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✓ Updated: ${filePath}`);
    } else {
      console.log(`- No changes needed: ${filePath}`);
    }
  } catch (err) {
    console.error(`✗ Error updating ${filePath}:`, err.message);
  }
});

console.log('\nColor update completed!');

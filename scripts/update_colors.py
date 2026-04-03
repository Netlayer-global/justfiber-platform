import os
import re

# Color mappings
color_mappings = {
    '#5d87ff': '#7c3aed',
    '#5B6CFF': '#7c3aed',
    '#4aa7ff': '#7c3aed',
    '#2d7dff': '#7c3aed',
    'text-[#5d87ff]': 'text-purple-700',
    'bg-[#5d87ff]': 'bg-purple-700',
    'border-[#5d87ff]': 'border-purple-700',
    'hover:bg-[#4576ff]': 'hover:bg-purple-800',
    '#ecf2ff': '#f5f3ff',
    '#eef1ff': '#f5f3ff',
    'bg-[#ecf2ff]': 'bg-purple-100',
    'border-[#ecf2ff]': 'border-purple-100',
}

files_to_update = [
    'frontend/admin-basic/app/(dashboard)/users-count/page.tsx',
    'frontend/admin-basic/app/(dashboard)/user-management/page.tsx',
    'frontend/admin-basic/app/(dashboard)/tickets/page.tsx',
    'frontend/admin-basic/app/(dashboard)/settings/page.tsx',
    'frontend/admin-basic/app/(dashboard)/serviceability/page.tsx',
    'frontend/admin-basic/app/(dashboard)/routers/page.tsx',
    'frontend/admin-basic/app/(dashboard)/provisioning/page.tsx',
    'frontend/admin-basic/app/(dashboard)/plans/page.tsx',
    'frontend/admin-basic/app/(dashboard)/my-zone-details/page.tsx',
    'frontend/admin-basic/app/(dashboard)/jobs/page.tsx',
    'frontend/admin-basic/app/(dashboard)/ip-management/page.tsx',
    'frontend/admin-basic/app/(dashboard)/installers/page.tsx',
    'frontend/admin-basic/app/(dashboard)/devices/page.tsx',
    'frontend/admin-basic/app/(dashboard)/customers/[customerId]/page.tsx',
    'frontend/admin-basic/app/(dashboard)/caf-templates/page.tsx',
    'frontend/admin-basic/app/(dashboard)/billing/page.tsx',
    'frontend/admin-basic/app/(dashboard)/all-users/[customerId]/page.tsx',
    'frontend/admin-basic/app/(dashboard)/all-users/[customerId]/edit/page.tsx',
]

updated_count = 0

for file_path in files_to_update:
    full_path = os.path.join('.', file_path)
    
    if not os.path.exists(full_path):
        print(f"✗ File not found: {file_path}")
        continue
    
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        for old, new in color_mappings.items():
            content = content.replace(old, new)
        
        if content != original_content:
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            updated_count += 1
            print(f"✓ Updated: {file_path}")
        
    except Exception as e:
        print(f"✗ Error processing {file_path}: {e}")

print(f"\n✓ Total files updated: {updated_count}")

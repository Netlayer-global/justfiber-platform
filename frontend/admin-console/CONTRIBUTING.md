# Contributing Guide

## Project Structure

```
frontend/admin-console/
├── app/                    # Next.js app directory (pages & layouts)
├── components/             # React components (organized by feature)
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, API client, types
├── public/                 # Static assets
├── styles/                 # Global CSS (dark theme)
└── tailwind.config.ts     # Tailwind CSS configuration
```

## Development Workflow

### 1. Setup Development Environment

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start dev server
npm run dev
```

### 2. Creating a New Module

Each module follows this structure:

```
app/(dashboard)/
├── new-module/
│   └── page.tsx          # Main page component
└── components/
    └── NewModuleXxx.tsx  # Feature-specific components
```

**Module Page Template:**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { toast } from 'sonner'

export default function ModulePage() {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const response = await apiGet('/api/v1/admin/module')
      if (response.data.success) {
        setData(response.data.data)
      }
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Module Title</h1>
        <p className="text-muted-foreground mt-1">Description</p>
      </div>

      {/* Content */}
      {/* Your module content here */}
    </div>
  )
}
```

### 3. Creating Components

Follow these conventions:

**Functional Components:**
```tsx
interface MyComponentProps {
  title: string
  isLoading?: boolean
  onAction?: () => void
}

export function MyComponent({
  title,
  isLoading = false,
  onAction,
}: MyComponentProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {/* Component content */}
    </div>
  )
}
```

**Styling Guidelines:**
- Use Tailwind CSS classes
- Follow dark theme color system
- Use semantic design tokens from `globals.css`
- Mobile-first responsive design
- Proper contrast and accessibility

### 4. API Integration

Always use utilities from `lib/api.ts`:

```tsx
import { apiGet, apiPost, apiPatch } from '@/lib/api'

// GET request with pagination
const response = await apiGet('/api/v1/admin/resource', {
  params: { page: 1, limit: 20 }
})

// POST request
const response = await apiPost('/api/v1/admin/resource', {
  field: 'value'
})

// Handle response
if (response.data.success) {
  const data = response.data.data
  // Process data
}
```

### 5. Error Handling

Use `sonner` for toast notifications:

```tsx
import { toast } from 'sonner'

try {
  // API call
} catch (error) {
  toast.error('Failed to perform action')
  console.error(error)
}

// Success messages
toast.success('Action completed')

// Info messages
toast.info('Processing...')

// Warning messages
toast.warning('This action cannot be undone')
```

### 6. Loading States

Always show loading feedback:

```tsx
const [isLoading, setIsLoading] = useState(true)

return (
  <DataTable 
    data={data} 
    isLoading={isLoading} 
  />
)
```

### 7. Type Safety

Define types in `lib/types.ts`:

```tsx
interface Customer {
  id: string
  email: string
  name: string
  status: 'active' | 'inactive' | 'suspended'
}

// Use strict types
const [customer, setCustomer] = useState<Customer | null>(null)
```

## Code Style

### TypeScript

- Always use TypeScript types
- Avoid `any` type (use `unknown` if necessary)
- Export interfaces from `lib/types.ts`
- Use strict mode in `tsconfig.json`

### Component Organization

```tsx
// 1. Imports
import { useState } from 'react'
import { Button } from '@/components/ui/button'

// 2. Types/Interfaces
interface MyComponentProps {
  title: string
}

// 3. Component
export function MyComponent({ title }: MyComponentProps) {
  // Logic here
  return (
    // JSX here
  )
}
```

### Naming Conventions

- Components: PascalCase (MyComponent.tsx)
- Functions: camelCase (loadData)
- Constants: UPPER_SNAKE_CASE (API_ENDPOINTS)
- Files: kebab-case (my-component.tsx)

## Testing

### Manual Testing Checklist

- [ ] Component renders without errors
- [ ] Loading states display correctly
- [ ] Error messages show properly
- [ ] API calls work with real/mock data
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Keyboard navigation works
- [ ] Dark theme looks good
- [ ] Forms validate correctly

### Running Tests

```bash
# Run linting
npm run lint

# Type checking
npm run type-check
```

## Performance

### Best Practices

- Use `next/Image` for images (auto-optimization)
- Lazy load components with `dynamic()`
- Implement pagination for large datasets
- Use `useCallback` for memoized functions
- Avoid unnecessary re-renders

### Optimization

```tsx
import dynamic from 'next/dynamic'

// Lazy load heavy component
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <div>Loading...</div>
})
```

## Accessibility

### Requirements

- Semantic HTML elements
- ARIA labels for interactive elements
- Sufficient color contrast
- Keyboard navigation support
- Alt text for images

### Example

```tsx
<button
  onClick={handleClick}
  aria-label="Delete customer"
  className="btn-destructive"
>
  <Trash className="w-4 h-4" />
</button>

<img
  src="/image.jpg"
  alt="Customer profile photo"
  className="w-full"
/>
```

## Commit Guidelines

### Format

```
type(scope): description

[optional body]
[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `style`: Style/formatting changes
- `docs`: Documentation updates
- `chore`: Build/dependencies
- `perf`: Performance improvements

### Examples

```
feat(customers): add bulk suspend action
fix(billing): correct invoice calculation
refactor(dashboard): extract stats into component
docs(api): update integration guide
```

## Pull Request Process

1. Create feature branch: `git checkout -b feat/feature-name`
2. Make changes and commit with proper messages
3. Push to remote: `git push origin feat/feature-name`
4. Create Pull Request with description
5. Address review feedback
6. Merge to main branch

### PR Template

```markdown
## Description
Brief description of changes

## Related Issues
Closes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change

## Testing
Describe testing performed

## Screenshots
If applicable, add screenshots

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No console errors/warnings
- [ ] Responsive design tested
```

## Debugging

### Browser DevTools

```tsx
// Debug renders
console.log("[v0] Component rendered", props)

// Trace API calls
console.log("[v0] API call:", method, url, data)

// Monitor state changes
console.log("[v0] State updated:", newState)
```

### Next.js Debug

```bash
# Enable verbose logging
NODE_DEBUG=* npm run dev

# Profile performance
npm run build --profile
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Documentation](https://react.dev)
- [TanStack Table](https://tanstack.com/table/v8/docs/guide/introduction)

## Need Help?

- Check existing issues/PRs
- Review similar implementations
- Ask in team discussions
- Consult documentation

Thank you for contributing!

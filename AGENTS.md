# Si Home - Agent Guidelines

This is a Chrome/Firefox browser extension for managing browser tabs and collections.

## Tech Stack
- **Framework**: React 19.0.0
- **Package Manager**: pnpm (required, do not use npm/yarn)
- **Styling**: Tailwind CSS 4.0.6
- **State Management**: Zustand with middleware
- **Build Tool**: Vite 6.1.0

## Build & Development Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Build for Chrome (tsc + vite build)
pnpm build:firefox          # Build for Firefox
pnpm preview                # Preview production build
pnpm lint                   # Run ESLint
```

**Note**: No test framework is currently configured.

## Code Style Guidelines

### Imports
- Order: React hooks → local components → third-party libraries
- Use named exports from local components, default from third-party
- Example:
  ```tsx
  import { useEffect, useState } from "react";
  import { Button } from "./components/Button";
  import { motion } from "motion/react";
  import dayjs from "dayjs";
  ```

### Component Structure
- Use functional components with default exports
- Define interfaces at module level for reuse
- No comments in code (keep code self-documenting)
- Export types used by other modules from App.tsx or store

Example:
```tsx
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
  buttonType?: "primary" | "secondary" | "outline" | "link" | "danger";
}

export function Button({ children, loading, ...props }: ButtonProps) {
  return <button {...props}>{loading ? "Loading..." : children}</button>;
}
```

### TypeScript
- Strict mode enabled
- Use interfaces for component props and data models
- Use `Omit<>` to extend types excluding certain fields
- Optional fields with `?` operator
- No `any` types

### State Management
- Zustand with `subscribeWithSelector` middleware
- Define action interfaces, implement in store
- Use `useAppState` hook to access state
- Example:
  ```tsx
  const groups = useAppState((state) => state.groups);
  const groupAdd = useAppState((state) => state.groupAdd);
  ```

### Styling
- Tailwind CSS for all styling
- Use `className` prop to extend component styles
- Common classes: `transition-all`, `cursor-pointer`, `rounded-lg`
- Animations: Framer Motion (`motion` from "motion/react")

### Error Handling
- Wrap async operations in try-catch
- Use `Message.show(error, { danger: true })` for user-facing errors
- Return early on invalid conditions:
  ```tsx
  if (!chrome.tabs) return;
  if (!data) return;
  ```

### Naming Conventions
- Components: PascalCase (`Button`, `Card`, `Modal`)
- Functions: camelCase (`cardAdd`, `groupUpdate`, `handleEditClick`)
- Interfaces: PascalCase (`ButtonProps`, `ModalProps`, `Groups`)
- Constants: SCREAMING_SNAKE_CASE for schemas (`CardSchema`, `GroupSchema`)
- File names: PascalCase for components (`Button.tsx`), kebab-case for utils (`storage.ts`)

### File Organization
```
src/
├── App.tsx              # Main app, types, schemas
├── main.tsx             # Entry point
├── store/
│   └── index.tsx        # Zustand store
├── components/          # Reusable components
│   └── DragAndDrop/    # Drag & drop module
└── utils/
    └── storage.ts       # Database utilities
```

### Drag & Drop
- Use `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`
- Collision detection: `closestCenter` (not `rectIntersection`)
- Use `SortableContext` with `verticalListSortingStrategy` for sortable lists
- For simple drag: `useDraggable` + `useDroppable`
- For sortable lists: `useSortable` + `SortableCard` component

### Browser APIs
- Chrome Extension APIs: `chrome.tabs.*`, `chrome.storage.local.*`
- Check API availability: `if (!chrome.tabs) return;`
- Use `webextension-polyfill` for cross-browser compatibility

### Zod Validation
- Define schemas with descriptive error messages
- Parse data before storage: `ConfigSchema.parse(groups)`
- Schemas exported from App.tsx for reuse

### Animation
- Use Framer Motion (`motion` from "motion/react")
- `layout` prop for list reordering animations
- `animate` prop for state transitions
- Keep animations short (0.15-0.2s)

### Linting
- Run `npm run lint` before committing
- Fix warnings: unused variables, missing dependencies, fast refresh issues
- Key rules: `react-hooks/rules-of-hooks`, `react-refresh/only-export-components`

### Common Patterns
- State selection in Zustand: `useAppState(state => state.groups)`
- Async data fetching in useEffect with early returns
- Form handling with `react-hook-form` + `zod`
- Modal portals with `createPortal`
- UUID generation: `cryptoRandomString({ length: 10 })`

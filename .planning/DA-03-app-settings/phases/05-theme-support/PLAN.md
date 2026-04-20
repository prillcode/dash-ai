# DA-03 Phase 05 — Theme Support Plan

## Objective
Implement full theme switching support: dark mode (current), light mode, and system preference detection. The theme choice is already stored in settings (`uiTheme`), but only dark mode CSS is currently implemented.

## Context
Phase 02 added the theme selector to Settings (dark/light/system), but:
- Only dark mode CSS exists currently
- No runtime theme switching logic
- No system preference detection
- Theme value is stored but not applied dynamically

## Current State
- Settings UI has theme dropdown (dark/light/system)
- `uiTheme` value persisted in database
- CSS uses static dark color values
- No ThemeProvider or theme context exists

## Scope

### In Scope
- CSS custom properties (variables) for theming
- ThemeProvider React context
- Runtime theme switching
- Light mode color palette
- System preference detection ("system" option)
- Persist and restore theme on app load

### Out of Scope
- Multiple accent color options
- High contrast mode
- Per-component theme overrides

## Tasks

### Task 1: Convert CSS to use theme variables
**File:** `packages/client/src/index.css` (or main CSS file)

Replace hardcoded dark colors with CSS custom properties:

**Current (example):**
```css
.bg-bg { background-color: #0a0a0a; }
.text-text { color: #fafafa; }
```

**New:**
```css
:root {
  --color-bg: #0a0a0a;
  --color-text: #fafafa;
  --color-muted: #a1a1aa;
  /* ... all other colors */
}

:root[data-theme="light"] {
  --color-bg: #ffffff;
  --color-text: #18181b;
  --color-muted: #71717a;
  /* ... light mode variants */
}

.bg-bg { background-color: var(--color-bg); }
.text-text { color: var(--color-text); }
```

**Color mappings to define:**
- Background (bg, sidebar, card, hover)
- Text (text, muted, subtle)
- Accents (accent, accent-hover, accent-bg)
- Borders (border)
- Status (danger, success, warning)

**Verification:**
- All existing dark styles still work
- No visual regressions in dark mode

### Task 2: Create ThemeProvider context
**File:** `packages/client/src/contexts/ThemeContext.tsx` (new)

Create a React context for theme management:

```typescript
interface ThemeContextType {
  theme: "dark" | "light" | "system"
  resolvedTheme: "dark" | "light"  // actual applied theme
  setTheme: (theme: "dark" | "light" | "system") => void
}
```

**Responsibilities:**
- Read initial theme from settings
- Apply theme to document root (`document.documentElement.setAttribute('data-theme', ...)`)
- Watch system preference changes (when theme is "system")
- Update settings when theme changes

**Verification:**
- Context provides correct values
- Theme changes apply immediately

### Task 3: Detect and apply system preference
**File:** `packages/client/src/contexts/ThemeContext.tsx`

Implement system preference detection:

```typescript
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

// Initial check
const systemTheme = mediaQuery.matches ? 'dark' : 'light'

// Watch for changes
mediaQuery.addEventListener('change', (e) => {
  const newTheme = e.matches ? 'dark' : 'light'
  // Apply if current setting is "system"
})
```

**Logic:**
- If `uiTheme` is "dark" → apply dark
- If `uiTheme` is "light" → apply light
- If `uiTheme` is "system" → detect and apply system preference
- When system preference changes, update if theme is "system"

**Verification:**
- Switching OS theme updates app (when set to "system")
- Manual override (dark/light) ignores system changes

### Task 4: Wrap app with ThemeProvider
**File:** `packages/client/src/App.tsx`

Add ThemeProvider around the app:

```typescript
import { ThemeProvider } from "./contexts/ThemeContext"

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {/* ... */}
      </QueryClientProvider>
    </ThemeProvider>
  )
}
```

**Verification:**
- App loads without errors
- Theme context available throughout component tree

### Task 5: Update Settings page to apply theme immediately
**File:** `packages/client/src/pages/SettingsPage.tsx`

When theme changes in settings:
1. Call `setTheme()` from context (immediate visual feedback)
2. Save to settings (persist for next session)

Current implementation saves to settings but doesn't apply immediately.

**Verification:**
- Changing theme in settings applies immediately
- No page refresh required

### Task 6: Design and implement light mode palette
**File:** `packages/client/src/index.css`

Define light mode color values that maintain good contrast and readability:

**Key considerations:**
- Background should be light but not stark white
- Text needs high contrast (WCAG AA minimum)
- Accent color should work on light backgrounds
- Borders should be subtle but visible

**Suggested light palette:**
```css
:root[data-theme="light"] {
  --color-bg: #fafafa;
  --color-sidebar: #ffffff;
  --color-card: #ffffff;
  --color-text: #18181b;
  --color-muted: #71717a;
  --color-subtle: #a1a1aa;
  --color-border: #e4e4e7;
  --color-hover: #f4f4f5;
  /* Keep accent colors similar but may need adjustments */
}
```

**Verification:**
- All UI elements visible in light mode
- Good contrast ratios
- No color clashes

### Task 7: Test theme switching edge cases
**Manual testing checklist:**

- [ ] Toggle between all 3 themes (dark/light/system)
- [ ] Change OS theme while app on "system" → app updates
- [ ] Change OS theme while app on "dark" → app stays dark
- [ ] Refresh page → theme persists
- [ ] Open app in new tab → theme correct
- [ ] All components render correctly in both themes

## Verification Steps

1. **CSS builds:**
   ```bash
   cd packages/client && pnpm build
   # No CSS errors
   ```

2. **Theme switching:**
   - Go to Settings
   - Change theme to light → immediate change
   - Change to system → matches OS
   - Change to dark → dark mode

3. **Persistence:**
   - Set theme to light
   - Refresh page → still light
   - Check database: `sqlite3 ~/.dash-ai/dashboard.db "SELECT value FROM settings WHERE key='uiTheme';"`

4. **System preference:**
   - Set theme to system
   - Change OS theme → app updates automatically

## Done Conditions

- [ ] CSS uses custom properties for all theme colors
- [ ] Light mode palette defined and applied
- [ ] ThemeProvider context created and working
- [ ] System preference detection implemented
- [ ] Theme changes apply immediately (no refresh)
- [ ] Theme persists across sessions
- [ ] Settings page uses ThemeContext
- [ ] App wrapped with ThemeProvider
- [ ] All builds pass
- [ ] Manual testing complete for all 3 themes

## Next Step

After this plan is complete, DA-03 is fully finished. Can proceed to DA-04 (Agent.md Generation) or other work.

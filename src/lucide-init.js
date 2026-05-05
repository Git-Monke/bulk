// ============================================
// LUCIDE ICONS — tree-shakeable, one source of truth
// ============================================
//
// All <i data-lucide="icon-name"> elements in the DOM are scanned and
// replaced with inline SVGs at startup and whenever modules call
// initIcons() after injecting new markup.
//
// To add an icon:
//   1. Import it by its PascalCase name from 'lucide'
//   2. Add it to the iconMap object
//   3. Use <i data-lucide="kebab-name"> in your HTML / JS strings

import {
  createIcons,
  Archive,
  Square,
  Send,
  SquarePen,
  X,
  Settings,
  Plus,
  Bot,
  ChevronDown,
  Wrench,
  ClipboardList,
  CalendarPlus,
} from 'lucide';

const iconMap = {
  Archive,
  Square,
  Send,
  SquarePen,
  X,
  Settings,
  Plus,
  Bot,
  ChevronDown,
  Wrench,
  ClipboardList,
  CalendarPlus,
};

/**
 * Scan the entire DOM for <i data-lucide="..."> elements and replace them
 * with the corresponding Lucide SVG. Safe to call multiple times — already
 * converted elements are skipped.
 */
export function initIcons() {
  createIcons({ icons: iconMap });
}

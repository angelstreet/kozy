import { Home, CalendarDays, MessageSquare, LineChart, Building2, Menu, ShoppingCart, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; icon: LucideIcon; label: string; desktopOnly?: boolean }

export const ownerNav: NavItem[] = [
  { to: '/dashboard', icon: Home, label: 'today' },
  { to: '/calendar', icon: CalendarDays, label: 'calendar' },
  { to: '/messages', icon: MessageSquare, label: 'messages' },
  { to: '/analytics', icon: LineChart, label: 'results' },
  { to: '/properties', icon: Building2, label: 'properties', desktopOnly: true },
  { to: '/more', icon: Menu, label: 'more' },
];

export const cleanerNav: NavItem[] = [
  { to: '/c/schedule', icon: CalendarDays, label: 'schedule' },
  { to: '/c/shopping', icon: ShoppingCart, label: 'shopping' },
];

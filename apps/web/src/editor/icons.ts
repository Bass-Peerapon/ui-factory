import { DEVICES, type Device } from "@ui-factory/catalog";
import {
  BarChart3, BookOpen, Box, CalendarDays, CheckSquare, ChevronsLeftRight, CircleHelp, Cloud, FileText, Filter, Images,
  Inbox, KeyRound, LayoutGrid, LayoutTemplate, Mail, Megaphone, MessageSquareQuote, Monitor, MousePointerClick, PanelBottom,
  PanelTop, Phone, Quote, Rocket, ShoppingBag, ShoppingCart, Smartphone, Square, Table, Tablet, Tag, TextCursorInput,
  Timer, UserRound, Users, Database, ListOrdered, Columns2, type LucideIcon,
} from "lucide-react";

/** Icon per catalog component, shared by Layers and Blocks. */
export const componentIcon: Record<string, LucideIcon> = {
  Page: FileText, Navbar: PanelTop, Hero: LayoutTemplate, FeatureGrid: LayoutGrid, Stats: BarChart3, Pricing: Tag,
  Testimonials: MessageSquareQuote, FAQ: CircleHelp, CTA: MousePointerClick, ContactForm: Inbox, Footer: PanelBottom,
  Banner: Megaphone, LogoCloud: Cloud, ImageText: Columns2, Steps: ListOrdered, ProductGrid: ShoppingBag, Gallery: Images,
  Team: Users, Timeline: ChevronsLeftRight, ComparisonTable: Table, BlogList: BookOpen, Quote, Newsletter: Mail,
  ContactInfo: Phone, AuthForm: UserRound, KPIGrid: BarChart3, DataTable: Table, EmptyState: Square,
  Button: Box, Input: TextCursorInput, Textarea: FileText, Checkbox: CheckSquare, Badge: Tag,
};

export const iconFor = (type: string) => componentIcon[type] ?? Box;

export const deviceIcon: Record<Device, LucideIcon> = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };
export const deviceLabel = (d: Device) => `${DEVICES[d].label} · ${DEVICES[d].width}px`;

/** Icon per flow pattern id. */
export const patternIcon: Record<string, LucideIcon> = {
  auth: KeyRound, "marketing-funnel": Filter, ecommerce: ShoppingCart, "saas-onboarding": Rocket,
  "dashboard-crud": Database, booking: CalendarDays, waitlist: Timer, content: BookOpen,
};

// UX flow patterns: reusable sets of connected screens. The planner picks one (or plans a custom flow),
// the API builds every page and wires each page's primary Button to the next screen.

export interface PatternPage {
  key: string;
  name: string;
  /** Composition brief for the page; the user's request is appended as context. */
  brief: string;
}

export interface FlowPattern {
  id: string;
  name: string;
  description: string;
  pages: PatternPage[];
  /** [from, to] page keys; the first Button of `from` navigates to `to`. */
  links: [string, string][];
}

export const flowPatterns: FlowPattern[] = [
  {
    id: "auth",
    name: "Sign-in / Sign-up",
    description: "Account access flow: sign in, create an account, then a welcome screen.",
    pages: [
      { key: "signin", name: "เข้าสู่ระบบ", brief: "Sign-in screen: AuthForm in login mode with email and password Inputs, a remember-me Checkbox and a sign-in Button. No Navbar, no Footer, no marketing sections." },
      { key: "signup", name: "สมัครสมาชิก", brief: "Sign-up screen: AuthForm in signup mode with name, email and password Inputs, accept-terms Checkbox and a create-account Button. No Navbar, no Footer." },
      { key: "welcome", name: "ยินดีต้อนรับ", brief: "Welcome screen after sign-up: EmptyState with a start Button, then Steps for getting started. No Navbar, no Footer." },
    ],
    links: [["signin", "welcome"], ["signup", "welcome"]],
  },
  {
    id: "marketing-funnel",
    name: "Marketing funnel",
    description: "Landing page that leads to pricing, sign-up and a thank-you page.",
    pages: [
      { key: "landing", name: "หน้าแรก", brief: "Landing page with Navbar, a Hero with a primary Button, proof and benefits sections, and a Footer." },
      { key: "pricing", name: "ราคา", brief: "Pricing page: Navbar, Pricing, ComparisonTable, FAQ, Footer." },
      { key: "signup", name: "สมัคร", brief: "Sign-up screen: AuthForm in signup mode with Inputs and a create-account Button. No Navbar, no Footer." },
      { key: "thanks", name: "ขอบคุณ", brief: "Thank-you screen: EmptyState confirming the sign-up with one Button back to the product. No Footer." },
    ],
    links: [["landing", "pricing"], ["pricing", "signup"], ["signup", "thanks"]],
  },
  {
    id: "ecommerce",
    name: "E-commerce checkout",
    description: "Shop listing, product detail, checkout form and order confirmation.",
    pages: [
      { key: "shop", name: "ร้านค้า", brief: "Shop page: Navbar, Banner with a promotion, ProductGrid, Footer." },
      { key: "product", name: "สินค้า", brief: "Product detail page: Navbar, ImageText showing the product with an add-to-cart Button, Testimonials, Footer." },
      { key: "checkout", name: "ชำระเงิน", brief: "Checkout page: ContactForm with shipping Inputs and a pay Button, plus a DataTable order summary." },
      { key: "done", name: "สั่งซื้อสำเร็จ", brief: "Order confirmation: EmptyState with a continue-shopping Button and Steps for delivery." },
    ],
    links: [["shop", "product"], ["product", "checkout"], ["checkout", "done"]],
  },
  {
    id: "saas-onboarding",
    name: "SaaS onboarding",
    description: "Create an account, set up a workspace, land on the dashboard.",
    pages: [
      { key: "signup", name: "สร้างบัญชี", brief: "Sign-up screen: AuthForm in signup mode with Inputs and a continue Button. No Navbar, no Footer." },
      { key: "setup", name: "ตั้งค่าพื้นที่ทำงาน", brief: "Workspace setup: Steps showing progress, then ContactForm with workspace name and team-size Inputs and a continue Button." },
      { key: "dashboard", name: "Dashboard", brief: "App dashboard: Navbar, KPIGrid, DataTable. No marketing sections and no Footer." },
    ],
    links: [["signup", "setup"], ["setup", "dashboard"]],
  },
  {
    id: "dashboard-crud",
    name: "Admin CRUD",
    description: "Back-office dashboard, record list, create form and empty state.",
    pages: [
      { key: "overview", name: "ภาพรวม", brief: "Admin overview: Navbar, KPIGrid, DataTable of recent records. No Footer." },
      { key: "list", name: "รายการ", brief: "Records list: Navbar, DataTable with many rows, EmptyState hint is not needed. No Footer." },
      { key: "create", name: "เพิ่มรายการ", brief: "Create form: Navbar, ContactForm with the record fields as Inputs and Textarea and a save Button." },
      { key: "empty", name: "ยังไม่มีข้อมูล", brief: "Empty state for a new account: Navbar, EmptyState with a create Button." },
    ],
    links: [["overview", "list"], ["list", "create"], ["empty", "create"]],
  },
  {
    id: "booking",
    name: "Booking",
    description: "Browse services, book a slot with a form, see the confirmation.",
    pages: [
      { key: "services", name: "บริการ", brief: "Services page: Navbar, Hero, FeatureGrid of services, Testimonials, Footer." },
      { key: "book", name: "จองคิว", brief: "Booking form: ContactForm with name, phone, date Inputs and a book Button, plus ContactInfo." },
      { key: "confirmed", name: "ยืนยันการจอง", brief: "Booking confirmation: EmptyState with the booking summary and a Button, then Steps on what happens next." },
    ],
    links: [["services", "book"], ["book", "confirmed"]],
  },
  {
    id: "waitlist",
    name: "Waitlist",
    description: "Launch page with an email sign-up and a thank-you screen.",
    pages: [
      { key: "landing", name: "Waitlist", brief: "Waitlist launch page: Navbar, editorial Hero, Newsletter with an email Input and join Button, Footer." },
      { key: "thanks", name: "อยู่ในคิวแล้ว", brief: "Thank-you screen: EmptyState confirming the waitlist spot with a share Button." },
    ],
    links: [["landing", "thanks"]],
  },
  {
    id: "content",
    name: "Content / blog",
    description: "Blog home, article page and a subscribe screen.",
    pages: [
      { key: "home", name: "บทความ", brief: "Blog home: Navbar, BlogList, Newsletter, Footer." },
      { key: "article", name: "อ่านบทความ", brief: "Article page: Navbar, ImageText as the article header, Quote, Newsletter, Footer." },
      { key: "subscribe", name: "สมัครรับข่าวสาร", brief: "Subscribe screen: AuthForm in signup mode for the newsletter with an email Input and Button." },
    ],
    links: [["home", "article"], ["article", "subscribe"]],
  },
];

export const flowPatternById = Object.fromEntries(flowPatterns.map((p) => [p.id, p]));

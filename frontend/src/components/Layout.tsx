// ─── Types ────────────────────────────────────────────────────────────────────

const MAX_WIDTH_MAP = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-xl',
  '2xl':'max-w-2xl',
  '4xl':'max-w-4xl',
  '6xl':'max-w-6xl',
  full: 'max-w-full',
} as const;

type ContentWidth = keyof typeof MAX_WIDTH_MAP;

export interface LayoutProps {
  /**
   * Content rendered on the left side of the sticky header
   * (typically a logo + app name).
   */
  headerLeft?: React.ReactNode;
  /**
   * Content rendered on the right side of the sticky header
   * (typically user info and a logout button).
   */
  headerRight?: React.ReactNode;
  /** Page body. */
  children: React.ReactNode;
  /** Optional content rendered in the footer bar. */
  footer?: React.ReactNode;
  /**
   * Max-width of the content container and header inner area.
   * Defaults to `'4xl'`.
   */
  maxWidth?: ContentWidth;
  /** Additional Tailwind classes applied to the `<main>` element. */
  contentClass?: string;
  /** Background colour of the page canvas. Defaults to `bg-gray-50`. */
  pageClass?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Shared page layout with a sticky header, scrollable main area, and an
 * optional footer. Both `headerLeft` and `headerRight` are render-props so
 * any page can inject its own navigation or user controls.
 *
 * @example
 * <Layout
 *   headerLeft={<AppLogo />}
 *   headerRight={<UserMenu />}
 *   maxWidth="4xl"
 * >
 *   <YourPageContent />
 * </Layout>
 */
export function Layout({
  headerLeft,
  headerRight,
  children,
  footer,
  maxWidth     = '4xl',
  contentClass = '',
  pageClass    = 'bg-gray-50',
}: LayoutProps) {
  const containerCls = `${MAX_WIDTH_MAP[maxWidth]} mx-auto px-4 sm:px-6`;

  return (
    <div className={`min-h-screen flex flex-col ${pageClass}`}>

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      {(headerLeft || headerRight) && (
        <header
          className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm"
          role="banner"
        >
          <div className={`${containerCls} h-16 flex items-center justify-between gap-4`}>
            {/* Left slot */}
            <div className="flex items-center gap-2.5 min-w-0">
              {headerLeft}
            </div>

            {/* Right slot */}
            {headerRight && (
              <div className="flex items-center gap-3 shrink-0">
                {headerRight}
              </div>
            )}
          </div>
        </header>
      )}

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main
        className={`flex-1 ${containerCls} py-8 ${contentClass}`}
        role="main"
      >
        {children}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      {footer && (
        <footer
          className="border-t border-gray-200 bg-white"
          role="contentinfo"
        >
          <div className={`${containerCls} py-4`}>
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
}

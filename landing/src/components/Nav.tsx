import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Github } from 'lucide-react';
import { NAV_LINKS, REPO_URL } from '../site';

const pillBase = 'rounded-full font-medium transition-colors';

export default function Nav({ animated = false }: { animated?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const animClass = (_delay: number) =>
    animated ? 'animate-blur-fade-up' : '';
  const animStyle = (delay: number) =>
    animated ? { animationDelay: `${delay}ms` } : undefined;

  return (
    <>
      <nav className="relative z-50 flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 md:py-6">
        <Link
          to="/"
          className={`text-xl md:text-2xl font-semibold tracking-[0.2em] ${animClass(0)}`}
          style={animStyle(0)}
        >
          AGENTX
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((link, i) => (
            <NavLink
              key={link.label}
              link={link}
              className={`text-sm hover:text-gray-300 transition-colors ${animClass(100 + i * 50)}`}
              style={animStyle(100 + i * 50)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`hidden sm:inline-flex liquid-glass ${pillBase} items-center gap-2 px-4 md:px-6 py-2 text-sm ${animClass(350)}`}
            style={animStyle(350)}
          >
            <Github size={16} />
            <span>GitHub</span>
          </a>

          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className={`lg:hidden liquid-glass w-10 h-10 rounded-full flex items-center justify-center ${animClass(350)} relative`}
            style={animStyle(350)}
            aria-label="Toggle menu"
          >
            <span
              className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out"
              style={{ opacity: menuOpen ? 0 : 1, transform: menuOpen ? 'rotate(180deg) scale(0.5)' : 'rotate(0) scale(1)' }}
            >
              <Menu size={18} />
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out"
              style={{ opacity: menuOpen ? 1 : 0, transform: menuOpen ? 'rotate(0) scale(1)' : 'rotate(-180deg) scale(0.5)' }}
            >
              <X size={18} />
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={`lg:hidden absolute left-0 right-0 top-[72px] z-40 bg-gray-900/95 backdrop-blur-lg border-t border-b border-gray-800 shadow-2xl transition-all duration-500 ease-out
          ${menuOpen ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}
      >
        <div className="px-4 py-4 flex flex-col">
          {NAV_LINKS.map((link, i) => (
            <NavLink
              key={link.label}
              link={link}
              onClick={() => setMenuOpen(false)}
              className="py-3 px-3 rounded-lg hover:bg-gray-800/50 transition-all duration-500 ease-out text-sm"
              style={{
                transform: menuOpen ? 'translateX(0)' : 'translateX(-12px)',
                opacity:   menuOpen ? 1 : 0,
                transitionDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// Renders an internal Link or external <a> as appropriate
function NavLink({
  link, className, style, onClick,
}: {
  link: { label: string; href: string; external?: boolean };
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
        onClick={onClick}
      >
        {link.label}
      </a>
    );
  }
  // Anchor links (with #) on the landing should use a normal anchor so the browser handles scroll
  if (link.href.includes('#')) {
    return (
      <a href={link.href} className={className} style={style} onClick={onClick}>
        {link.label}
      </a>
    );
  }
  return (
    <Link to={link.href} className={className} style={style} onClick={onClick}>
      {link.label}
    </Link>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faXmark,
  faLock,
  faChevronDown,
  faRightFromBracket,
  faWallet,
} from '@fortawesome/free-solid-svg-icons';
import { TaskPayMark } from '@/components/brand/TaskPayMark';
import { focusRing } from '@/components/brand/constants';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';
import { useAuthGate } from '@/components/dashboard/AuthContext';
import { AccountMenu } from '@/components/dashboard/AccountMenu';

const NAV_LINKS: { href: string; label: string; exact: boolean; locked?: boolean }[] = [
  { href: '/app', label: 'Overview', exact: true },
  { href: '/app/quests', label: 'Quests', exact: false },
  { href: '/app/create', label: 'Create', exact: false, locked: true },
  { href: '/app/leaderboard', label: 'Leaderboard', exact: false },
  { href: '/app/profile', label: 'Profile', exact: false, locked: true },
];

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname();
  const { siweVerified } = useBrowserAuth();
  const { openAuthGate } = useAuthGate();
  const [navOpen, setNavOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const handleNavClick = (link: (typeof NAV_LINKS)[number], e: React.MouseEvent) => {
    if (link.locked && !siweVerified) {
      e.preventDefault();
      openAuthGate();
    }
  };

  return (
    <nav className="sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
        <div
          className={`flex items-center justify-between gap-3 bg-white/70 backdrop-blur-2xl border border-gray-200/60 rounded-2xl px-4 sm:px-5 py-3 shadow-lg transition-shadow duration-300 ${
            navScrolled ? 'shadow-xl shadow-black/[0.06] border-gray-200' : 'shadow-black/[0.03]'
          }`}
        >
          <Link href="/app" className={`flex items-center gap-2 sm:gap-3 min-w-0 ${focusRing} rounded-xl`}>
            <TaskPayMark size="md" priority />
            <span className="font-black text-lg tracking-tight hidden sm:inline">TaskPay</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href, link.exact);
              const locked = link.locked && !siweVerified;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(link, e)}
                  className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${focusRing} ${
                    active
                      ? 'text-black bg-gray-100'
                      : locked
                        ? 'text-gray-400 hover:text-gray-600'
                        : 'text-gray-500 hover:text-black hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                  {locked && (
                    <FontAwesomeIcon icon={faLock} className="ml-1.5 text-[10px] text-gray-400" />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <AccountMenu />
            <button
              type="button"
              aria-expanded={navOpen}
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setNavOpen((o) => !o)}
              className={`md:hidden p-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors ${focusRing}`}
            >
              <FontAwesomeIcon icon={navOpen ? faXmark : faBars} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {navOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-[60] bg-black/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNavOpen(false)}
            />
            <motion.div
              ref={mobileMenuRef}
              role="dialog"
              aria-modal="true"
              className="fixed top-0 right-0 bottom-0 z-[70] w-full max-w-sm bg-white shadow-2xl md:hidden flex flex-col border-l border-gray-200"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <span className="text-lg font-black tracking-tight">Menu</span>
                <button
                  type="button"
                  onClick={() => setNavOpen(false)}
                  className={`p-2 rounded-xl text-gray-500 hover:bg-gray-100 ${focusRing}`}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
              <nav className="flex flex-col p-4 gap-1">
                {NAV_LINKS.map((link) => {
                  const active = isActive(pathname, link.href, link.exact);
                  const locked = link.locked && !siweVerified;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={(e) => {
                        handleNavClick(link, e);
                        if (!locked) setNavOpen(false);
                      }}
                      className={`px-4 py-3.5 rounded-xl text-base font-semibold transition-colors ${focusRing} ${
                        active ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {link.label}
                      {locked && <FontAwesomeIcon icon={faLock} className="ml-2 text-xs text-gray-400" />}
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}

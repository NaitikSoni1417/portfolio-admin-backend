import { useEffect, useRef, useState } from "react";
import OverlayMenu from "./OverlayMenu";
import Logo from "../assets/Logo.png";
import { FiMenu } from "react-icons/fi";

export default function Navbar() {

  const [menuOpen, setMenuOpen] = useState(false);
  const [visible, setVisible] = useState(true);

  const lastScrollY = useRef(0);
  const timerId = useRef(null);

  useEffect(() => {

    const handleScroll = () => {

      const homeSection = document.querySelector("#home");

      // ===== HOME SECTION CHECK =====
      if (homeSection) {

        const rect = homeSection.getBoundingClientRect();

        // JO HOME SECTION SCREEN MA HOY
        const isInsideHome =
          rect.top <= 0 &&
          rect.bottom > 0;

        if (isInsideHome) {

          // HOME MA ALWAYS VISIBLE
          setVisible(true);

          // TIMER CLEAR
          if (timerId.current) {
            clearTimeout(timerId.current);
          }

          lastScrollY.current = window.scrollY;

          return;
        }
      }

      const currentScrollY = window.scrollY;

      // ===== SCROLL DOWN =====
      if (currentScrollY > lastScrollY.current) {

        setVisible(false);

      } else {

        // ===== SCROLL UP =====
        setVisible(true);

        // OLD TIMER CLEAR
        if (timerId.current) {
          clearTimeout(timerId.current);
        }

        // 3 SECOND PACHI HIDE
        timerId.current = setTimeout(() => {
          setVisible(false);
        }, 5000);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    // PAGE LOAD PAR CHECK
    handleScroll();

    return () => {

      window.removeEventListener("scroll", handleScroll);

      if (timerId.current) {
        clearTimeout(timerId.current);
      }

    };

  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 w-full flex items-center justify-between px-6 py-4 z-50 transition-transform duration-300 ${
          visible
            ? "translate-y-0"
            : "-translate-y-full"
        }`}
      >

        {/* LEFT SIDE */}
        <div className="flex items-center space-x-2">

          <img
            src={Logo}
            alt="Logo"
            className="w-11 h-11"
          />

          <div className="text-2xl font-bold text-white hidden sm:block">
            Naitik
          </div>

        </div>

        {/* MENU BUTTON */}
        <div
          className="
            absolute right-6
            lg:left-1/2 lg:right-auto
            lg:transform lg:-translate-x-1/2
          "
        >

          <button
            onClick={() => setMenuOpen(true)}
            className="text-3xl focus:outline-none text-white"
            aria-label="Open Menu"
          >
            <FiMenu />
          </button>

        </div>

        {/* REACH OUT BUTTON */}
        <div className="hidden lg:block">

          <a
            href="#contact"
            className="bg-linear-to-r from-pink-500 to-blue-500 text-white px-5 py-2 rounded-full font-medium shadow-lg hover:opacity-90 transition-opacity duration-300"
          >
            Reach Out
          </a>

        </div>

      </nav>

      <OverlayMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}
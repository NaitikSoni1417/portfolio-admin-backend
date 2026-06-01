import {
  FaGithub,
  FaLinkedin,
  FaWhatsapp,
  FaInstagram,
} from "react-icons/fa";

import { MdEmail } from "react-icons/md";

export default function Footer() {
  return (
    <footer
      className="
        relative
        min-h-[620px]
        bg-black
        overflow-hidden
        flex
        items-center
        justify-center
        text-white
        select-none
      "
    >

      {/* BACKGROUND GLOW EFFECTS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        {/* GREEN GLOW */}
        <div
          className="
            absolute
            bottom-[-180px]
            left-[-120px]
            w-[700px]
            h-[500px]
            rounded-full
            bg-[#00ff99]
            opacity-20
            blur-[170px]
          "
        />

        {/* BLUE GLOW */}
        <div
          className="
            absolute
            top-[20px]
            right-[120px]
            w-[600px]
            h-[420px]
            rounded-full
            bg-[#0047ff]
            opacity-20
            blur-[170px]
          "
        />

        {/* PURPLE GLOW */}
        <div
          className="
            absolute
            top-[60px]
            left-[22%]
            w-[380px]
            h-[300px]
            rounded-full
            bg-[#302b63]
            opacity-25
            blur-[140px]
          "
        />

      </div>

      {/* CONTENT */}
      <div className="relative z-10 text-center px-6">

        {/* NAME */}
        <h1
          className="
            text-6xl
            md:text-8xl
            xl:text-[120px]
            font-black
            tracking-tight
            leading-none
            text-white
            pointer-events-none
            drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]
          "
          style={{
            fontFamily:
              "'Orbitron', 'Space Grotesk', sans-serif",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
          draggable="false"
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        >
          NAITIK SONI
        </h1>

        {/* GRADIENT LINE */}
        <div
          className="
            mx-auto
            mt-8
            h-[4px]
            w-52
            rounded-full
            bg-gradient-to-r
            from-[#0f7cff]
            via-[#1cd8d2]
            to-[#00ff99]
          "
        />

        {/* SOCIAL ICONS */}
        <div
          className="
            mt-10
            flex
            justify-center
            gap-8
            text-4xl
            text-gray-300
          "
        >

          <a
            href="https://github.com/NaitikSoni1417"
            target="_blank"
            rel="noreferrer"
            className="
              hover:text-[#1cd8d2]
              hover:scale-125
              transition-all
              duration-300
            "
          >
            <FaGithub />
          </a>

          <a
            href="https://www.linkedin.com/in/naitiksoni1417"
            target="_blank"
            rel="noreferrer"
            className="
              hover:text-[#1cd8d2]
              hover:scale-125
              transition-all
              duration-300
            "
          >
            <FaLinkedin />
          </a>

          <a
            href="mailto:naitik.infosec@gmail.com"
            className="
              hover:text-[#1cd8d2]
              hover:scale-125
              transition-all
              duration-300
            "
          >
            <MdEmail />
          </a>

          <a
            href="https://whatsapp.com/channel/0029Vb6pxgWAjPXVeX5PCf2a"
            target="_blank"
            rel="noreferrer"
            className="
              hover:text-[#1cd8d2]
              hover:scale-125
              transition-all
              duration-300
            "
          >
            <FaWhatsapp />
          </a>

          <a
            href="https://instagram.com/naitiksoni1417"
            target="_blank"
            rel="noreferrer"
            className="
              hover:text-[#1cd8d2]
              hover:scale-125
              transition-all
              duration-300
            "
          >
            <FaInstagram />
          </a>

        </div>

        {/* TAGLINE */}
        <p
          className="
            mt-12
            text-xl
            italic
            text-gray-300
          "
        >
          “Stay ethical, stay legal, stay secure.”
        </p>

        {/* COPYRIGHT */}
        <p
          className="
            mt-10
            text-sm
            md:text-base
            text-gray-500
          "
        >
          © 2026 Naitik Soni. All rights reserved.
        </p>

      </div>
    </footer>
  );
}
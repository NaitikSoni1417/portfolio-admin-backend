import { motion } from "framer-motion";
import { FaGithub, FaLinkedin, FaWhatsapp } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import ParticlesBackground from "../components/ParticlesBackground";

export default function Footer() {
  const socials = [
    {
      Icon: FaGithub,
      href: "https://github.com/NaitikSoni1417",
      label: "GitHub",
    },
    {
      Icon: FaLinkedin,
      href: "https://www.linkedin.com/in/naitiksoni1417",
      label: "LinkedIn",
    },
    {
      Icon: MdEmail,
      href: "mailto:naitik.infosec@gmail.com",
      label: "Email",
    },
    {
      Icon: FaWhatsapp,
      href: "https://whatsapp.com/channel/0029Vb6pxgWAjPXVeX5PCf2a",
      label: "WhatsApp",
    },
  ];

  return (
    <footer className="relative bg-black text-white overflow-hidden py-20 md:py-24 select-none">
      <ParticlesBackground />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-[-160px] left-[-120px] w-[520px] h-[360px] rounded-full bg-[#00ff99]/15 blur-[150px] animate-pulse" />
        <div className="absolute top-[-80px] right-[-80px] w-[520px] h-[340px] rounded-full bg-[#0047ff]/15 blur-[150px] animate-pulse" />
        <div
          className="absolute left-[40%] bottom-[5%] w-[300px] h-[220px] rounded-full bg-[#1cd8d2]/15 blur-[120px] animate-pulse"
          style={{ animationDuration: "7s" }}
        />

        <div className="absolute inset-0 opacity-[0.035] bg-[linear-gradient(rgba(28,216,210,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(28,216,210,.7)_1px,transparent_1px)] bg-[size:42px_42px]" />

        <motion.div
          animate={{
            x: ["-120%", "220%"],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute top-0 h-full w-40 bg-gradient-to-r from-transparent via-[#1cd8d2]/10 to-transparent blur-xl"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        <motion.h1
          animate={{
            textShadow: [
              "0 0 18px rgba(28,216,210,.16)",
              "0 0 48px rgba(28,216,210,.42)",
              "0 0 18px rgba(28,216,210,.16)",
            ],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-none text-white"
          style={{
            fontFamily: "'Orbitron', 'Space Grotesk', sans-serif",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
          draggable="false"
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        >
          NAITIK SONI
        </motion.h1>

        <motion.div
          animate={{
            width: ["120px", "190px", "120px"],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="mx-auto mt-6 h-[3px] rounded-full bg-gradient-to-r from-[#0f7cff] via-[#1cd8d2] to-[#00ff99]"
        />

        <div className="mt-8 flex justify-center gap-5 text-2xl md:text-3xl text-gray-300">
          {socials.map(({ Icon, href, label }) => (
            <motion.a
              key={label}
              href={href}
              target={href.startsWith("mailto:") ? "_self" : "_blank"}
              rel="noreferrer"
              aria-label={label}
              whileHover={{ y: -6, scale: 1.15 }}
              whileTap={{ scale: 0.92 }}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] hover:border-[#1cd8d2]/50 hover:bg-[#1cd8d2]/10 hover:text-[#1cd8d2] transition-all duration-300"
            >
              <Icon />
            </motion.a>
          ))}
        </div>

        <motion.p
          animate={{
            opacity: [0.75, 1, 0.75],
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="mt-8 text-base md:text-lg italic text-gray-300"
        >
          “Stay ethical, stay legal, stay secure.”
        </motion.p>

        <p className="mt-6 text-sm text-gray-500">
          © 2026 Naitik Soni. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
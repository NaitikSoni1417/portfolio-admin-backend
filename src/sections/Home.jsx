import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import ParticlesBackground from "../components/ParticlesBackground";

import { FaGithub, FaLinkedin, FaWhatsapp } from "react-icons/fa";
import { MdEmail } from "react-icons/md";

import avator from "../assets/avator.png";

const RESUME_URL = "/certificates/Naitik_Soni_Resume.pdf";

const socials = [
  {
    Icon: FaLinkedin,
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/naitiksoni1417",
  },
  {
    Icon: FaGithub,
    label: "GitHub",
    href: "https://github.com/NaitikSoni1417",
  },
  {
    Icon: MdEmail,
    label: "Email",
    href: "mailto:naitik.infosec@gmail.com",
  },
  {
    Icon: FaWhatsapp,
    label: "WhatsApp Channel",
    href: "https://whatsapp.com/channel/0029Vb6pxgWAjPXVeX5PCf2a",
  },
];

const glowVariants = {
  initial: {
    scale: 1,
    y: 0,
    filter: "drop-shadow(0 0 0 rgba(0,0,0,0))",
  },
  hover: {
    scale: 1.2,
    y: -3,
    filter:
      "drop-shadow(0 0 8px rgba(13,88,204,0.9)) drop-shadow(0 0 18px rgba(16,185,129,0.8))",
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 15,
    },
  },
  tap: {
    scale: 0.9,
    y: 0,
    transition: {
      duration: 0.08,
    },
  },
};

export default function Home() {
  const roles = useMemo(
    () => [
      "Cyber Security Engineer",
      "Ethical Hacker",
      "Penetration Tester",
      "Bug Bounty Hunter",
      "Full Stack Web Developer",
      "Founder of NS Indian Cyber Army's",
    ],
    []
  );

  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const currentRole = roles[index];

    if (!deleting && subIndex === currentRole.length) {
      const timeout = setTimeout(() => setDeleting(true), 1200);
      return () => clearTimeout(timeout);
    }

    if (deleting && subIndex === 0) {
      const timeout = setTimeout(() => {
        setDeleting(false);
        setIndex((prev) => (prev + 1) % roles.length);
      }, 100);

      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (deleting ? -1 : 1));
    }, deleting ? 40 : 100);

    return () => clearTimeout(timeout);
  }, [subIndex, index, deleting, roles]);

  const downloadResume = async () => {
    try {
      const response = await fetch(RESUME_URL, { cache: "no-store" });

      if (!response.ok) {
        window.open(RESUME_URL, "_blank", "noopener,noreferrer");
        return;
      }

      const blob = await response.blob();
      const pdfBlob = new Blob([blob], { type: "application/pdf" });
      const url = window.URL.createObjectURL(pdfBlob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "Naitik_Soni_Cybersecurity_Resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Resume download failed:", err);
      window.open(RESUME_URL, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <section
      id="home"
      className="w-full min-h-screen relative bg-black overflow-hidden"
    >
      <ParticlesBackground />

      <div className="absolute inset-0 pointer-events-none">
        <div
          className="
            absolute -top-32 -left-32
            w-[70vw] sm:w-[50vw] md:w-[40vw]
            h-[70vw] sm:h-[50vw] md:h-[40vw]
            max-w-125 max-h-125
            rounded-full
            bg-linear-to-r
            from-[#302b63]
            via-[#00bf8f]
            to-[#1cd8d2]
            opacity-30 sm:opacity-20 md:opacity-10
            blur-[100px] sm:blur-[130px] md:blur-[150px]
            animate-pulse
          "
        />

        <div
          className="
            absolute bottom-0 right-0
            w-[70vw] sm:w-[50vw] md:w-[40vw]
            h-[70vw] sm:h-[50vw] md:h-[40vw]
            max-w-125 max-h-125
            rounded-full
            bg-linear-to-r
            from-[#302b63]
            via-[#00bf8f]
            to-[#1cd8d2]
            opacity-30 sm:opacity-20 md:opacity-10
            blur-[100px] sm:blur-[130px] md:blur-[150px]
            animate-pulse delay-500
          "
        />
      </div>

      <div className="relative z-10 min-h-screen w-full max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2">
        <div className="flex flex-col justify-center h-full text-center lg:text-left relative py-20">
          <div className="w-full lg:pr-24 mx-auto max-w-3xl">
            <motion.div
              className="mb-3 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-white tracking-wide min-h-[1.6em]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span>{roles[index].substring(0, subIndex)}</span>
              <span className="inline-block w-0.5 ml-1 bg-white h-7 sm:h-9 align-middle animate-pulse" />
            </motion.div>

            <motion.h1
              className="
                text-4xl sm:text-5xl md:text-6xl lg:text-7xl
                font-bold text-transparent
                bg-clip-text
                bg-linear-to-r
                from-[hsl(178,77%,48%)]
                via-[#00bf8f]
                to-[#302b63]
                drop-shadow-lg
              "
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
            >
              Hello, I'm
              <br />
              <span className="text-white font-bold text-5xl sm:text-6xl md:text-7xl lg:text-8xl lg:whitespace-nowrap">
                Naitik Soni
              </span>
            </motion.h1>

            <motion.p
              className="mt-6 text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <span className="font-semibold text-white">
                Cybersecurity Engineer
              </span>{" "}
              (
              <span className="font-semibold text-[#1cd8d2]">
                NScyber1417
              </span>
              ), Founder of{" "}
              <span className="font-semibold text-[#1cd8d2]">
                NS Indian Cyber Army
              </span>
              , and{" "}
              <span className="font-semibold text-white">
                Full Stack Web Developer
              </span>{" "}
              focused on{" "}
              <span className="font-semibold text-[#1cd8d2]">
                secure web development
              </span>{" "}
              and{" "}
              <span className="font-semibold text-white">
                real-world cybersecurity
              </span>
              . Currently studying at{" "}
              <span className="font-semibold text-white">
                Gujarat Technological University (GTU)
              </span>{" "}
              affiliated with{" "}
              <span className="font-semibold text-[#1cd8d2]">
                SVIT Vasad
              </span>
              .
            </motion.p>

            <motion.div
              className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <a
                href="#projects"
                className="
                  px-6 py-3 rounded-full
                  font-medium text-lg text-white
                  bg-linear-to-r
                  from-[hsl(178,77%,48%)]
                  via-[#00bf8f]
                  to-[#302b63]
                  shadow-lg
                  hover:scale-105
                  transition-all
                "
              >
                View My Work
              </a>

              <button
                type="button"
                onClick={downloadResume}
                className="
                  px-6 py-3 rounded-full
                  text-lg font-medium
                  text-black bg-white
                  hover:bg-gray-200
                  shadow-lg hover:scale-105
                  transition-all
                "
              >
                My Resume
              </button>
            </motion.div>

            <motion.div
              className="mt-10 flex gap-5 text-2xl md:text-3xl justify-center lg:justify-start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
            >
              {socials.map(({ Icon, label, href }) => (
                <motion.a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  variants={glowVariants}
                  initial="initial"
                  whileHover="hover"
                  whileTap="tap"
                  className="text-gray-300"
                >
                  <Icon />
                </motion.a>
              ))}
            </motion.div>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-center relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 100 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1 }}
            whileHover={{ scale: 1.05 }}
            className="relative"
          >
            <div
              className="
                absolute inset-0
                rounded-full
                bg-linear-to-r
                from-cyan-400/30
                via-emerald-400/20
                to-blue-500/30
                blur-3xl
                scale-110
              "
            />

            <img
              src={avator}
              alt="Naitik Soni"
              className="
                relative z-10
                w-[320px]
                md:w-105
                lg:w-125
                object-contain
                drop-shadow-[0_0_40px_rgba(0,255,200,0.35)]
              "
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
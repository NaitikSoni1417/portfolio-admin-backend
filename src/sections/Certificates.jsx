import { useEffect, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  FiExternalLink,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiDownload,
  FiMaximize2,
} from "react-icons/fi";
import { FaGraduationCap, FaAward } from "react-icons/fa";
import { BsCalendar2DateFill } from "react-icons/bs";

const certificates = [
  {
    title: "Bugcrowd Acknowledgement",
    issuer: "Bugcrowd",
    date: "2026",
    link: "/certificates/bugcrowd-p5.png",
  },
  {
    title: "Cybersecurity Internship",
    issuer: "Cyber Leelawat",
    date: "Feb 2026",
    link: "/certificates/cyber-leelawat-certificate.png",
  },
  {
    title: "Cyber Security Badge",
    issuer: "Cyber Leelawat",
    date: "2026",
    link: "/certificates/cyber-leelawat-badge.png",
  },
  {
    title: "Red Team vs Blue Team",
    issuer: "DevTown",
    date: "Feb 2026",
    link: "/certificates/devtown-red-team-blue-team.png",
  },
  {
    title: "NS Indian Cyber Army",
    issuer: "Community Founder",
    date: "2025",
    link: "/certificates/ns-indian-cyber-army.png",
  },
  {
    title: "Ethical Hacking & Bug Bounty",
    issuer: "EverHack",
    date: "Jan 2026",
    link: "/certificates/everhack-ethical-hacking.png",
  },
  {
    title: "Dark Web & Cryptocurrency",
    issuer: "Codered",
    date: "Jan 2026",
    link: "/certificates/codered-dark-web.png",
  },
  {
    title: "Advanced Cyber Security",
    issuer: "GUVI | HCL",
    date: "Dec 2025",
    link: "/certificates/guvi-advanced-cybersecurity.png",
  },
  {
    title: "Ethical Hacking 101",
    issuer: "Simplilearn",
    date: "Nov 2025",
    link: "/certificates/simplilearn-ethical-hacking.png",
  },
  {
    title: "Kali Linux Basics",
    issuer: "Simplilearn",
    date: "Nov 2025",
    link: "/certificates/simplilearn-kali-linux.png",
  },
];

function playSound(path, volume = 0.35) {
  try {
    const audio = new Audio(path);
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {}
}

function getAnalysisTitle(cert) {
  const titles = {
    "Bugcrowd Acknowledgement": "About this Acknowledgement",
    "Cybersecurity Internship": "About this Internship",
    "Cyber Security Badge": "About this Badge",
    "NS Indian Cyber Army": "About this Community",
  };

  return titles[cert.title] || "About this Certificate";
}

function getAnalysisText(cert) {
  const data = {
    "Bugcrowd Acknowledgement": `This acknowledgement represents my experience with responsible security research and professional vulnerability disclosure.

Through Bugcrowd, I learned how real-world bug bounty platforms review reports, evaluate impact, and classify findings using professional security standards.

What I learned:

• Responsible Vulnerability Disclosure

• Bug Bounty Report Writing

• Security Impact Analysis

• VRT Classification Understanding

• Professional Communication With Security Teams

This acknowledgement strengthened my understanding of real-world bug bounty programs and professional security reporting workflows.`,

    "Cybersecurity Internship": `This internship certificate represents my professional cybersecurity internship experience at Cyber Leelawat.

During this internship, I gained practical exposure to cybersecurity workflows, reconnaissance techniques, vulnerability understanding, and professional security reporting.

Key Learning Areas:

• Reconnaissance & Information Gathering

• Web Application Security

• Security Assessment Techniques

• Vulnerability Identification

• Security Reporting Process

• Ethical Hacking Fundamentals

This internship helped transform my theoretical cybersecurity knowledge into practical industry-level skills and experience.`,

    "Cyber Security Badge": `This badge was awarded to me during my Cyber Leelawat Cybersecurity Internship.

I successfully achieved an A+ Grade and secured 100/100 marks during the internship evaluation process.

Achievement Highlights:

• A+ Internship Performance

• 100/100 Evaluation Score

• Outstanding Learning Progress

• Practical Cybersecurity Understanding

• Professional Work Ethic

• Consistent Performance Throughout Internship

This badge represents my dedication, consistency, and excellence during the cybersecurity internship program.`,

    "Red Team vs Blue Team": `This certificate helped me understand both offensive and defensive cybersecurity roles.

It introduced how Red Teams simulate attacks and how Blue Teams defend, monitor, and respond to threats.

What I learned:

• Red Team Concepts

• Blue Team Defense

• Security Monitoring

• Threat Understanding

• Defensive Thinking

This improved my understanding of attacker mindset and defender strategy.`,

    "NS Indian Cyber Army": `NS Indian Cyber Army is a cybersecurity learning community founded by Naitik Soni.

This community focuses on ethical hacking education, cyber awareness, responsible security learning, and skill development for beginners and learners.

What I built:

• Cybersecurity Learning Community

• Ethical Hacking Awareness Platform

• Knowledge-Sharing Environment

• Student-Friendly Cyber Learning Space

• Responsible Security Mindset

This community helped me improve leadership, communication, mentoring, and cybersecurity awareness-building skills.`,

    "Ethical Hacking & Bug Bounty": `This certificate represents my learning in ethical hacking and bug bounty methodology.

It helped me understand how security testing should be performed legally, responsibly, and professionally.

What I learned:

• Ethical Hacking Methodology

• Bug Bounty Workflow

• Vulnerability Identification

• Responsible Testing

• Security Mindset

This improved my confidence in offensive security with an ethical and legal approach.`,

    "Dark Web & Cryptocurrency": `This certificate helped me understand cybercrime awareness, dark web risks, and cryptocurrency-related security concerns.

It improved my knowledge of digital threats, anonymous platforms, crypto ecosystems, and investigation concepts.

What I learned:

• Dark Web Awareness

• Cryptocurrency Security Risks

• Cybercrime Trends

• Digital Investigation Concepts

• Online Safety Awareness

This strengthened my understanding of modern cyber threat environments.`,

    "Advanced Cyber Security": `This certificate represents advanced cybersecurity learning through GUVI and HCL.

It helped me understand security concepts, protection strategies, digital defense, and modern cybersecurity practices.

What I learned:

• Advanced Security Concepts

• Cyber Defense

• Risk Awareness

• Protection Strategies

• Professional Cybersecurity Mindset

This helped me move from basic cybersecurity knowledge toward advanced security understanding.`,

    "Ethical Hacking 101": `This certificate represents my foundation in ethical hacking.

It introduced core concepts of security testing, vulnerability assessment, networking basics, and legal hacking practices.

What I learned:

• Ethical Hacking Basics

• Vulnerability Assessment

• Network Security Awareness

• Attack Surface Understanding

• Legal Security Testing

This helped me build a strong starting point for ethical hacking and penetration testing.`,

    "Kali Linux Basics": `This certificate represents my learning of Kali Linux basics for cybersecurity practice.

It helped me understand the Kali Linux environment, command-line usage, security tools, and practical lab workflows.

What I learned:

• Kali Linux Environment

• Linux Commands

• Security Tool Awareness

• Lab Practice

• Cybersecurity Workflow

This improved my comfort with Linux-based cybersecurity tools and practical security learning.`,
  };

  return (
    data[cert.title] ||
    "This certificate represents professional cybersecurity learning and practical skill development."
  );
}

function TypewriterAnalysis({ cert }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!cert) return;

    const fullText = getAnalysisText(cert);
    let i = 0;
    setText("");

    const timer = setInterval(() => {
      setText(fullText.slice(0, i + 1));
      i++;

      if (i >= fullText.length) clearInterval(timer);
    }, 12);

    return () => clearInterval(timer);
  }, [cert]);

  return (
    <div className="rounded-[28px] border border-teal-300/20 bg-white/[0.045] p-5 sm:p-6 shadow-[0_0_55px_rgba(20,184,166,0.12)]">
      <p className="text-teal-300 tracking-[0.18em] text-xs font-black uppercase mb-3">
        AI Certificate Insight
      </p>

      <h4 className="text-2xl sm:text-3xl font-black text-white mb-5">
        {getAnalysisTitle(cert)}
      </h4>

      <div className="min-h-[360px] rounded-2xl bg-black/35 border border-white/10 p-5 font-mono text-sm sm:text-[15px] leading-7 text-slate-300 whitespace-pre-wrap">
        {text}
        <span className="text-teal-300 animate-pulse"> █</span>
      </div>
    </div>
  );
}

function CertificateCard({ cert, index, setIsPaused, onView }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-120, 120], [8, -8]);
  const rotateY = useTransform(x, [-120, 120], [-8, 8]);

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - rect.left - rect.width / 2);
    y.set(e.clientY - rect.top - rect.height / 2);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
    setIsPaused(false);
  };

  return (
    <motion.div
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, y: 35, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      onMouseMove={handleMove}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={reset}
      className="group relative h-[430px] w-full"
    >
      <div className="absolute left-[10%] right-[10%] top-[55px] h-[215px] rounded-t-2xl bg-[#f7f2e7] shadow-xl transition-all duration-700 group-hover:-translate-y-20 group-hover:-rotate-2 overflow-hidden">
        <div className="absolute inset-3 rounded-xl border border-[#d6c69b]" />

        <div className="absolute top-4 left-0 right-0 flex items-center justify-center gap-3">
          <span className="h-[2px] w-12 bg-[#bba97d]" />
          <span className="text-[#bba97d] text-lg">❧</span>
          <span className="h-[2px] w-12 bg-[#bba97d]" />
        </div>

        <div className="text-center mt-16 px-3">
          <h3 className="text-[#24324a] text-[22px] sm:text-[24px] font-serif tracking-[0.08em] leading-none whitespace-nowrap">
            CERTIFICATE
          </h3>

          <p className="text-[#6d6047] text-[8px] tracking-[3px] mt-3 uppercase whitespace-nowrap">
            OF ACHIEVEMENT
          </p>

          <div className="w-14 h-[2px] bg-[#c7b38a] mx-auto mt-4 rounded-full" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[310px] rounded-[28px] overflow-hidden bg-gradient-to-br from-[#20e0d0] via-[#0d8f8c] to-[#07111f] border border-teal-300/30 shadow-[0_25px_90px_rgba(20,184,166,0.32)]">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="absolute -top-5 left-0 right-0 h-[125px] rounded-b-[55%] bg-gradient-to-r from-[#55f2e5] via-[#18c8c4] to-[#0692a8]" />

        <div className="relative z-10 h-full flex flex-col items-center text-center px-6 pt-[105px]">
          <h3 className="text-[23px] leading-tight font-black text-white max-w-[260px] min-h-[58px] flex items-center justify-center">
            {cert.title}
          </h3>

          <div className="min-h-[44px] flex flex-wrap justify-center items-center gap-3 text-sm text-white/85 mt-5">
            <FaGraduationCap />
            <span>{cert.issuer}</span>
            <span className="text-white/40">•</span>
            <BsCalendar2DateFill />
            <span>{cert.date}</span>
          </div>

          <button
            onClick={() => {
              playSound("/sounds/paper-open.mp3", 0.35);
              onView(cert);
            }}
            className="mt-6 mb-7 px-9 py-3 rounded-xl bg-white/10 border border-white/25 backdrop-blur-md font-bold hover:bg-white hover:text-black hover:scale-105 transition-all duration-300 flex items-center gap-2"
          >
            View <FiExternalLink />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ParticleBurst() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 22 }).map((_, i) => (
        <motion.span
          key={i}
          initial={{
            opacity: 1,
            x: "50%",
            y: "50%",
            scale: 0,
          }}
          animate={{
            opacity: 0,
            x: `${50 + (Math.random() - 0.5) * 95}%`,
            y: `${50 + (Math.random() - 0.5) * 95}%`,
            scale: Math.random() * 1.5 + 0.6,
          }}
          transition={{ duration: 1.1, delay: i * 0.015 }}
          className="absolute h-2 w-2 rounded-full bg-teal-300 shadow-[0_0_18px_rgba(45,212,191,0.8)]"
        />
      ))}
    </div>
  );
}

function CertificateModal({ selectedCert, onClose, onNext, onPrev }) {
  const handleClose = () => {
    playSound("/sounds/close.mp3", 0.3);
    onClose();
  };

  const enterFullScreen = () => {
    const el = document.getElementById("certificate-preview-box");
    if (el?.requestFullscreen) el.requestFullscreen();
  };

  if (!selectedCert) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center px-3 sm:px-5 py-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          onClick={handleClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-xl"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.72, y: 80, rotateX: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, scale: 0.72, y: 80, rotateX: 18 }}
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
          className="relative w-full max-w-6xl max-h-[94vh] overflow-y-auto rounded-[30px] border border-teal-300/25 bg-[#020617]/95 shadow-[0_0_120px_rgba(20,184,166,0.35)] custom-scrollbar"
        >
          <ParticleBurst />

          <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/10 px-4 sm:px-7 py-4 bg-[#020617]/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-teal-300/10 border border-teal-300/25 flex items-center justify-center text-teal-300 text-2xl">
                <FaAward />
              </div>

              <div>
                <h3 className="text-base sm:text-2xl font-black text-white">
                  {selectedCert.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-400">
                  {selectedCert.issuer} • {selectedCert.date}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={enterFullScreen}
                className="h-10 w-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:bg-teal-300 hover:text-black transition"
                title="Fullscreen"
              >
                <FiMaximize2 />
              </button>

              <button
                onClick={handleClose}
                className="h-10 w-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:bg-red-500 transition"
                title="Close"
              >
                <FiX />
              </button>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.45fr_.75fr] gap-5 p-4 sm:p-7">
            <div>
              <motion.div
                id="certificate-preview-box"
                initial={{ y: 110, opacity: 0, rotate: -1.5 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{
                  duration: 0.75,
                  delay: 0.12,
                  type: "spring",
                  stiffness: 90,
                  damping: 14,
                }}
                className="relative mx-auto flex items-center justify-center rounded-[24px] overflow-hidden bg-white border border-white/15 shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
              >
                <img
                  src={selectedCert.link}
                  alt={selectedCert.title}
                  className="w-full max-h-[85vh] object-contain bg-white mx-auto"
                />
              </motion.div>

              <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={onPrev}
                  className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white hover:text-black transition"
                >
                  ← Previous
                </button>

                <a
                  href={selectedCert.link}
                  download
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-300 to-cyan-400 text-black font-black flex items-center justify-center gap-2 hover:scale-105 transition"
                >
                  <FiDownload /> Download
                </a>

                <button
                  onClick={onNext}
                  className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white hover:text-black transition"
                >
                  Next →
                </button>
              </div>
            </div>

            <TypewriterAnalysis cert={selectedCert} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Certificates() {
  const [page, setPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();

    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const perPage = isMobile ? 1 : 4;
  const totalPages = Math.ceil(certificates.length / perPage);

  const visibleCertificates = certificates.slice(
    page * perPage,
    page * perPage + perPage
  );

  const nextPage = () => setPage((p) => (p + 1) % totalPages);
  const prevPage = () => setPage((p) => (p === 0 ? totalPages - 1 : p - 1));

  const selectedIndex = selectedCert
    ? certificates.findIndex((c) => c.title === selectedCert.title)
    : -1;

  const nextCertificate = () => {
    if (selectedIndex === -1) return;

    playSound("/sounds/paper-open.mp3", 0.25);
    setSelectedCert(certificates[(selectedIndex + 1) % certificates.length]);
  };

  const prevCertificate = () => {
    if (selectedIndex === -1) return;

    playSound("/sounds/paper-open.mp3", 0.25);
    setSelectedCert(
      certificates[
        selectedIndex === 0 ? certificates.length - 1 : selectedIndex - 1
      ]
    );
  };

  useEffect(() => {
    if (isPaused || selectedCert) return;

    const timer = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, 5000);

    return () => clearInterval(timer);
  }, [isPaused, selectedCert, totalPages]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedCert && e.key === "Escape") {
        playSound("/sounds/close.mp3", 0.3);
        setSelectedCert(null);
      }

      if (selectedCert && e.key === "ArrowRight") nextCertificate();
      if (selectedCert && e.key === "ArrowLeft") prevCertificate();

      if (!selectedCert && e.key === "ArrowRight") nextPage();
      if (!selectedCert && e.key === "ArrowLeft") prevPage();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCert, selectedIndex, totalPages]);

  return (
    <section
      id="certificates"
      className="relative bg-black text-white py-24 md:py-28 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,rgba(20,184,166,0.22),transparent_34%),radial-gradient(circle_at_82%_15%,rgba(34,211,238,0.13),transparent_30%)]" />

      <div className="relative z-10 max-w-[1500px] mx-auto px-5">
        <div className="text-center mb-16">
          <p className="text-teal-300 tracking-[0.28em] uppercase text-xs sm:text-sm font-bold mb-4">
            Credentials & Achievements
          </p>

          <h2 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight">
            Premium{" "}
            <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
              Certificates
            </span>
          </h2>

          <p className="text-slate-400 mt-5 text-sm sm:text-base md:text-lg">
            Premium certificate gallery with interactive preview and AI insight.
          </p>

          <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-teal-300 to-transparent mx-auto mt-6" />
        </div>

        <div className="relative px-14 md:px-20">
          <button
            onClick={prevPage}
            className="absolute left-2 md:left-5 top-[52%] -translate-y-1/2 z-50 w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#0f172a]/80 border border-white/10 backdrop-blur-xl flex items-center justify-center text-white text-2xl hover:bg-teal-400 hover:text-black transition-all duration-300 shadow-2xl"
          >
            <FiChevronLeft />
          </button>

          <button
            onClick={nextPage}
            className="absolute right-2 md:right-5 top-[52%] -translate-y-1/2 z-50 w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#0f172a]/80 border border-white/10 backdrop-blur-xl flex items-center justify-center text-white text-2xl hover:bg-teal-400 hover:text-black transition-all duration-300 shadow-2xl"
          >
            <FiChevronRight />
          </button>

          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, x: 70 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -70 }}
              transition={{ duration: 0.4 }}
              className={`grid gap-10 ${
                isMobile
                  ? "grid-cols-1 max-w-[340px] mx-auto"
                  : "grid-cols-2 lg:grid-cols-4"
              }`}
            >
              {visibleCertificates.map((cert, index) => (
                <CertificateCard
                  key={`${page}-${index}`}
                  cert={cert}
                  index={index}
                  setIsPaused={setIsPaused}
                  onView={setSelectedCert}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center gap-3 mt-10">
            {Array.from({ length: totalPages }).map((_, index) => (
              <button
                key={index}
                onClick={() => setPage(index)}
                className={`h-2 rounded-full transition-all ${
                  page === index
                    ? "w-14 bg-gradient-to-r from-teal-300 to-cyan-400"
                    : "w-2 bg-white/30"
                }`}
              />
            ))}
          </div>

          <p className="text-center text-slate-400 text-sm mt-5">
            {page + 1} / {totalPages}
          </p>
        </div>
      </div>

      <CertificateModal
        selectedCert={selectedCert}
        onClose={() => setSelectedCert(null)}
        onNext={nextCertificate}
        onPrev={prevCertificate}
      />
    </section>
  );
}
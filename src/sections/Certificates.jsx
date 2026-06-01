import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiExternalLink, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { FaGraduationCap } from "react-icons/fa";
import { BsCalendar2DateFill } from "react-icons/bs";

const certificates = [
  { title: "Bugcrowd Acknowledgement", issuer: "Bugcrowd", date: "2026", link: "/certificates/bugcrowd-p5.png" },
  { title: "Cybersecurity Internship", issuer: "Cyber Leelawat", date: "Feb 2026", link: "/certificates/cyber-leelawat-certificate.png" },
  { title: "Cyber Security Badge", issuer: "Cyber Leelawat", date: "2026", link: "/certificates/cyber-leelawat-badge.png" },
  { title: "Red Team vs Blue Team", issuer: "DevTown", date: "Feb 2026", link: "/certificates/devtown-red-team-blue-team.png" },
  { title: "NS Indian Cyber Army", issuer: "Community Founder", date: "2025", link: "/certificates/ns-indian-cyber-army.png" },
  { title: "Ethical Hacking & Bug Bounty", issuer: "EverHack", date: "Jan 2026", link: "/certificates/everhack-ethical-hacking.png" },
  { title: "Dark Web & Cryptocurrency", issuer: "Codered", date: "Jan 2026", link: "/certificates/codered-dark-web.png" },
  { title: "Advanced Cyber Security", issuer: "GUVI | HCL", date: "Dec 2025", link: "/certificates/guvi-advanced-cybersecurity.png" },
  { title: "Ethical Hacking 101", issuer: "Simplilearn", date: "Nov 2025", link: "/certificates/simplilearn-ethical-hacking.png" },
  { title: "Kali Linux Basics", issuer: "Simplilearn", date: "Nov 2025", link: "/certificates/simplilearn-kali-linux.png" },
];

function CertificateCard({ cert, index, setIsPaused }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 35 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
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

        <div className="absolute -top-5 left-0 right-0 h-[125px] rounded-b-[55%] bg-gradient-to-r from-[#55f2e5] via-[#18c8c4] to-[#0692a8] shadow-[0_18px_40px_rgba(0,0,0,0.25)]" />

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
            onClick={() => window.open(cert.link, "_blank")}
            className="mt-6 mb-7 px-9 py-3 rounded-xl bg-white/10 border border-white/25 backdrop-blur-md font-bold hover:bg-white hover:text-black hover:scale-105 transition-all duration-300 flex items-center gap-2"
          >
            View <FiExternalLink />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Certificates() {
  const [page, setPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

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

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, 5000);

    return () => clearInterval(timer);
  }, [isPaused, totalPages]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight") nextPage();
      if (e.key === "ArrowLeft") prevPage();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalPages]);

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
            Each certificate presented in an elegant envelope design — hover to reveal.
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
    </section>
  );
}
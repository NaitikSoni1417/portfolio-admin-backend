import {
  FaBug,
  FaUserSecret,
  FaShieldAlt,
  FaNetworkWired,
  FaLinux,
  FaPython,
  FaPhp,
  FaHtml5,
  FaCss3Alt,
  FaJs,
  FaGitAlt,
} from "react-icons/fa";

import {
  SiGooglecloud,
  SiMysql,
  SiFirebase,
  SiMongodb,
} from "react-icons/si";

import {
  MdSecurity,
  MdTravelExplore,
  MdManageSearch,
  MdDeviceHub,
} from "react-icons/md";

import { motion, useMotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export default function Skills() {
  const skills = [
    { icon: <FaUserSecret />, name: "Ethical Hacking" },
    { icon: <MdSecurity />, name: "Cyber Security" },
    { icon: <FaBug />, name: "Bug Bounty" },
    { icon: <FaShieldAlt />, name: "Pen Testing" },
    { icon: <MdManageSearch />, name: "Investigation" },
    { icon: <MdTravelExplore />, name: "Recon" },
    { icon: <MdDeviceHub />, name: "IoT Security" },
    { icon: <FaLinux />, name: "Linux" },
  { icon: <MdTravelExplore />, name: "Web Recon" },
    { icon: <FaNetworkWired />, name: "Network Security" },
    { icon: <SiGooglecloud />, name: "Google Cloud" },
    { icon: <FaUserSecret />, name: "OSINT" },
    { icon: <SiMysql />, name: "MySQL" },
    { icon: <SiFirebase />, name: "Firebase" },
    { icon: <FaGitAlt />, name: "Git" },
    { icon: <FaPython />, name: "Python" },
    { icon: <FaPhp />, name: "PHP" },
    { icon: <SiMongodb />, name: "MongoDB" },
    { icon: <FaHtml5 />, name: "HTML5" },
    { icon: <FaCss3Alt />, name: "CSS3" },
    { icon: <FaJs />, name: "JavaScript" },
  ];

  const repeated = [...skills, ...skills];

  const [dir, setDir] = useState(-1);
  const [active, setActive] = useState(false);

  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const touchY = useRef(null);

  const x = useMotionValue(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        setActive(entry.isIntersecting && entry.intersectionRatio > 0.1);
      },
      { threshold: [0.1] }
    );

    io.observe(el);

    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;

    const onWheel = (e) => {
      setDir(e.deltaY > 0 ? -1 : 1);
    };

    const onTouchStart = (e) => {
      touchY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (touchY.current === null) return;

      const delta = e.touches[0].clientY - touchY.current;
      setDir(delta > 0 ? 1 : -1);
      touchY.current = e.touches[0].clientY;
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [active]);

  useEffect(() => {
    let id;
    let last = performance.now();
    const SPEED = 70;

    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      let next = x.get() + SPEED * dir * dt;
      const loop = trackRef.current?.scrollWidth / 2 || 0;

      if (loop) {
        if (next <= -loop) next += loop;
        if (next >= 0) next -= loop;
      }

      x.set(next);
      id = requestAnimationFrame(tick);
    };

    id = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(id);
  }, [dir, x]);

  return (
    <section
      id="skills"
      ref={sectionRef}
      className="relative w-full py-28 flex flex-col items-center justify-center bg-black text-white overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-[-120px] w-[520px] h-[420px] rounded-full bg-[#00bf8f] opacity-20 blur-[160px]" />
        <div className="absolute bottom-[-120px] right-[-100px] w-[560px] h-[420px] rounded-full bg-[#0047ff] opacity-20 blur-[170px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(28,216,210,0.05),transparent)]" />
      </div>

      <motion.h2
        className="text-5xl sm:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#1cd8d2] via-[#00bf8f] to-[#302b63] z-10"
        initial={{ opacity: 0, y: -30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        My Skills
      </motion.h2>

      <motion.p
        className="mt-4 mb-14 text-white/90 text-base sm:text-xl z-10 text-center px-4"
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        Cyber Security | Ethical Hacking | Full Stack Development
      </motion.p>

      <div className="relative w-full overflow-hidden z-10 py-10">

        <motion.div
          ref={trackRef}
          className="flex gap-6 text-[#1cd8d2]"
          style={{
            x,
            whiteSpace: "nowrap",
            willChange: "transform",
          }}
        >
          {repeated.map((s, i) => (
            <motion.div
              key={i}
              whileHover={{
                y: -12,
                scale: 1.08,
              }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 18,
              }}
              className="group min-w-[145px] h-[135px] rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl flex flex-col items-center justify-center gap-4 shadow-[0_0_30px_rgba(28,216,210,0.06)] hover:border-[#1cd8d2]/50 hover:bg-[#1cd8d2]/10 hover:shadow-[0_0_35px_rgba(28,216,210,0.25)] transition-all duration-300"
              aria-label={s.name}
              title={s.name}
            >
              <span className="text-4xl drop-shadow-[0_0_10px_rgba(28,216,210,0.35)] group-hover:drop-shadow-[0_0_26px_rgba(28,216,210,0.9)] transition-all duration-300">
                {s.icon}
              </span>

              <p className="text-sm text-center font-bold text-[#1cd8d2] whitespace-nowrap">
                {s.name}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
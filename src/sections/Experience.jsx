import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

const experiences = [
  {
    role: "Started Cybersecurity Journey",
    company: "Self Learning & Practical Labs",
    duration: "2024",
    description:
      "Started learning cybersecurity fundamentals, ethical hacking, Linux, networking, web security, reconnaissance, OSINT, and practical security testing through hands-on labs and real-world practice.",
  },
  {
    role: "Community Founder",
    company: "NS Indian Cyber Army",
    duration: "2025",
    description:
      "Built NS Indian Cyber Army, a professional cybersecurity learning community focused on ethical hacking, cyber awareness, skill development, and responsible security practices.",
  },
  {
    role: "Cybersecurity Internship",
    company: "Cyber Leelawat",
    duration: "2026",
    description:
      "Worked as a cybersecurity intern with exposure to security analysis, reconnaissance, vulnerability understanding, reporting, and practical cyber investigation workflows in a professional environment.",
  },
];

function ExperienceItem({ exp, idx, start, end, scrollYProgress, layout }) {
  const scale = useTransform(scrollYProgress, [start, start + 0.08, 1], [0, 1, 1], {
    clamp: true,
  });

  const opacity = useTransform(scrollYProgress, [start, start + 0.08, 1], [0, 1, 1], {
    clamp: true,
  });

  const y = useTransform(scrollYProgress, [start, end], [idx % 2 === 0 ? 30 : -30, 0]);
  const x = useTransform(scrollYProgress, [start, end], [-24, 0]);

  if (layout === "desktop") {
    return (
      <div className="relative flex flex-1 justify-center items-center min-w-0">
        <motion.div
          className="z-10 w-7 h-7 rounded-full bg-white border-[6px] border-slate-950 shadow-[0_0_0_8px_rgba(255,255,255,0.08)]"
          style={{ scale, opacity }}
        />

        <motion.div
          className={`absolute ${
            idx % 2 === 0 ? "-top-8" : "-bottom-8"
          } w-[3px] bg-white/20`}
          style={{ height: 40, opacity }}
        />

        <motion.article
          className={`absolute ${
          idx % 2 === 0 ? "bottom-12" : "top-12"
           } overflow-hidden bg-gradient-to-br from-[#111111]/90 to-[#0b0b0b]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-7 w-[340px] shadow-[0_10px_60px_rgba(0,0,0,0.45)] hover:border-white/20 hover:-translate-y-2 transition-all duration-500 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:pointer-events-none`}
          style={{ opacity, y, maxWidth: "90vw" }}
          transition={{ duration: 0.4, delay: idx * 0.15 }}
        >
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-semibold text-slate-300 bg-white/10 border border-white/10 px-3 py-1 rounded-full">
              {exp.duration}
            </span>
            <span className="text-xs text-slate-500">0{idx + 1}</span>
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight">
            {exp.role}
          </h3>

          <p className="text-sm text-slate-400 mt-2 mb-4 font-medium">
            {exp.company}
          </p>

          <p className="text-[15px] text-slate-300 leading-relaxed break-words">
            {exp.description}
          </p>
        </motion.article>
      </div>
    );
  }

  return (
    <div className="relative flex items-start">
      <motion.div
        className="absolute -left-[14px] top-3 z-10 w-7 h-7 rounded-full bg-white border-[6px] border-slate-950 shadow-[0_0_0_8px_rgba(255,255,255,0.08)]"
        style={{ scale, opacity }}
      />

      <motion.article
        className="bg-white/[0.06] backdrop-blur-2xl border border-white/10 rounded-3xl p-5 w-[calc(100vw-5rem)] max-w-sm ml-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        style={{ opacity, x }}
        transition={{ duration: 0.4, delay: idx * 0.15 }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-slate-300 bg-white/10 border border-white/10 px-3 py-1 rounded-full">
            {exp.duration}
          </span>
          <span className="text-xs text-slate-500">0{idx + 1}</span>
        </div>

        <h3 className="text-lg font-bold break-words text-white">
          {exp.role}
        </h3>

        <p className="text-sm text-slate-400 mb-3 mt-2 break-words font-medium">
          {exp.company}
        </p>

        <p className="text-sm text-slate-300 leading-relaxed break-words">
          {exp.description}
        </p>
      </motion.article>
    </div>
  );
}

export default function Experience() {
  const sceneRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();

    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

 const SCENE_HEIGHT_VH = isMobile
  ? 160 * experiences.length
  : 140 * experiences.length;

  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start start", "end end"],
  });

  const thresholds = useMemo(
    () => experiences.map((_, i) => (i + 1) / experiences.length),
    []
  );

  const lineSize = useTransform(scrollYProgress, (v) => `${v * 100}%`);

  return (
    <section id="experience" className="relative bg-black text-white pb-32">
      <div
        ref={sceneRef}
        style={{
          height: isMobile ? "auto" : `${SCENE_HEIGHT_VH}vh`,
          minHeight: isMobile ? "auto" : "120vh",
        }}
        className="relative"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)] pointer-events-none" />

        <div className={`${isMobile ? "relative py-16" : "sticky top-0 min-h-screen h-screen"} flex flex-col`}>
          <div className="text-center mt-8 mb-8 px-4">
            <p className="text-sm tracking-[0.28em] text-slate-400 font-semibold uppercase mb-3">
              Career Timeline
            </p>

            <h2 className="text-5xl sm:text-6xl font-black tracking-tight">
              Experience
            </h2>
          <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-white/60 to-transparent mx-auto mt-5" />
            <p className="text-slate-400 mt-4 max-w-xl mx-auto text-sm sm:text-base">
              Building secure systems & cyber experiences.
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 pb-10">
            {!isMobile && (
              <div className="relative w-full max-w-7xl">
                <div className="relative h-[4px] bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                  className="absolute left-0 top-0 h-[4px] bg-gradient-to-r from-white via-slate-300 to-white rounded-full origin-left"
                    style={{ width: lineSize }}
                  />
                </div>

                <div className="relative flex justify-between mt-0">
                  {experiences.map((exp, idx) => (
                    <ExperienceItem
                      key={idx}
                      exp={exp}
                      idx={idx}
                      start={idx === 0 ? 0 : thresholds[idx - 1]}
                      end={thresholds[idx]}
                      scrollYProgress={scrollYProgress}
                      layout="desktop"
                    />
                  ))}
                </div>
              </div>
            )}

            {isMobile && (
              <div className="relative w-full max-w-md">
                <div className="absolute left-0 top-0 h-[calc(100%-7rem)] w-[6px] bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute top-0 left-0 w-[6px] bg-gradient-to-b from-white via-slate-300 to-white rounded-full origin-top"
                    style={{ height: lineSize }}
                  />
                </div>

                <div className="relative flex flex-col gap-10 ml-10 mt-6 pb-28">
                  {experiences.map((exp, idx) => (
                    <ExperienceItem
                      key={idx}
                      exp={exp}
                      idx={idx}
                      start={idx === 0 ? 0 : thresholds[idx - 1]}
                      end={thresholds[idx]}
                      scrollYProgress={scrollYProgress}
                      layout="mobile"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
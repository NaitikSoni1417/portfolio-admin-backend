import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import welcomeSound from "../assets/welcome.mp3";

export default function IntroAnimation({ onFinish }) {

  const greetings = useMemo(
    () => [
      "WELCOME TO",
      "NAITIK SONI",
      "PORTFOLIO WEBSITE",
    ],
    []
  );

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const audioRef = useRef(null);

  // SOUND
  useEffect(() => {

    const playSound = () => {

      if (audioRef.current) {

        audioRef.current.currentTime = 0;
        audioRef.current.volume = 1;

        audioRef.current.play()
          .then(() => {
            console.log("Sound Playing");
          })
          .catch(() => {
            console.log("Autoplay Blocked");
          });
      }

      window.removeEventListener("click", playSound);
      window.removeEventListener("touchstart", playSound);
    };

    // MOBILE + DESKTOP
    window.addEventListener("click", playSound);
    window.addEventListener("touchstart", playSound);

    return () => {
      window.removeEventListener("click", playSound);
      window.removeEventListener("touchstart", playSound);
    };

  }, []);

  // TEXT ANIMATION
  useEffect(() => {

    if (index < greetings.length - 1) {

      const timer = setTimeout(() => {

        setIndex((prev) => prev + 1);

      }, 650);

      return () => clearTimeout(timer);

    } else {

      const exitTimer = setTimeout(() => {

        setVisible(false);

      }, 1800);

      return () => clearTimeout(exitTimer);
    }

  }, [index, greetings.length]);

  return (
    <>
      {/* AUDIO */}
      <audio
        ref={audioRef}
        src={welcomeSound}
        preload="auto"
      />

      <AnimatePresence onExitComplete={onFinish}>

        {visible && (

          <motion.div
            className="
              fixed inset-0 z-[9999]
              flex flex-col items-center justify-center
              bg-black overflow-hidden
              px-5
            "
            initial={{ opacity: 1 }}
            exit={{
              y: "-100%",
              transition: {
                duration: 1,
                ease: [0.76, 0, 0.24, 1],
              },
            }}
          >

            {/* BACKGROUND GLOW */}
            <div
              className="
                absolute
                w-[260px] h-[260px]
                sm:w-[420px] sm:h-[420px]
                md:w-[650px] md:h-[650px]
                rounded-full
                bg-cyan-400/20
                blur-[120px]
                animate-pulse
              "
            />

            {/* SECOND GLOW */}
            <div
              className="
                absolute
                w-[180px] h-[180px]
                sm:w-[280px] sm:h-[280px]
                rounded-full
                bg-emerald-400/10
                blur-[90px]
              "
            />

            {/* MAIN TEXT */}
            <motion.h1
              key={index}
              className="
                relative z-10
                text-center
                uppercase
                font-black
                leading-[1.2]

                max-w-[95vw]

                text-[26px]
                xs:text-[32px]
                sm:text-[48px]
                md:text-[72px]
                lg:text-[88px]

                tracking-[3px]
                sm:tracking-[8px]
                md:tracking-[12px]

                break-words

                text-transparent
                bg-clip-text
                bg-gradient-to-r
                from-cyan-400
                via-white
                to-emerald-400

                drop-shadow-[0_0_35px_rgba(0,255,200,0.35)]
              "
              initial={{
                opacity: 0,
                scale: 0.92,
                y: 25,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -40,
              }}
              transition={{
                duration: 0.35,
              }}
            >

              {greetings[index]
                .split("")
                .map((char, i) => (

                  <motion.span
                    key={i}
                    initial={{
                      opacity: 0,
                      y: 18,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      delay: i * 0.018,
                      duration: 0.12,
                    }}
                    className="inline-block"
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>

                ))}

            </motion.h1>

            {/* LOADING BAR */}
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: window.innerWidth < 500
                  ? "170px"
                  : "260px",
              }}
              transition={{
                duration: 2,
                ease: "easeInOut",
              }}
              className="
                mt-8
                h-[3px]
                rounded-full

                bg-gradient-to-r
                from-cyan-400
                via-white
                to-emerald-400

                shadow-[0_0_20px_rgba(0,255,200,0.5)]
              "
            />

            {/* SUB TEXT */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.75 }}
              transition={{ delay: 0.6 }}
              className="
                mt-5
                text-center
                uppercase

                text-[9px]
                sm:text-sm
                md:text-base

                tracking-[3px]
                sm:tracking-[6px]

                text-gray-400

                max-w-[90vw]
              "
            >
              PROFESSIONAL PORTFOLIO EXPERIENCE
            </motion.p>

          </motion.div>

        )}

      </AnimatePresence>
    </>
  );
}
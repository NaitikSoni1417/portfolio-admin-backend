import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CustomCursor() {
  const [isDesktop, setIsDesktop] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Motion values for direct, lag-free tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // useSpring for buttery smooth lag-free following
  const springConfig = { damping: 25, stiffness: 400, mass: 0.5 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  useEffect(() => {
    // Check if it's a touch device
    const checkIsTouch = () => {
      setIsDesktop(!window.matchMedia("(pointer: coarse)").matches);
    };
    checkIsTouch();
    window.addEventListener("resize", checkIsTouch);

    const moveHandler = (e) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    if (isDesktop) {
      window.addEventListener("mousemove", moveHandler);
      // Hide default cursor globally when CustomCursor is active
      document.body.style.cursor = "none";
    } else {
      document.body.style.cursor = "auto";
    }

    return () => {
      window.removeEventListener("mousemove", moveHandler);
      window.removeEventListener("resize", checkIsTouch);
      document.body.style.cursor = "auto";
    };
  }, [isDesktop, mouseX, mouseY]);

  useEffect(() => {
    if (!isDesktop) return;

    // Add hover effect to interactive elements
    const handleMouseOver = (e) => {
      const target = e.target;
      const isInteractive =
        target.tagName.toLowerCase() === "a" ||
        target.tagName.toLowerCase() === "button" ||
        target.closest("a") ||
        target.closest("button") ||
        target.classList.contains("interactive") ||
        window.getComputedStyle(target).cursor === "pointer";

      if (isInteractive) {
        setIsHovered(true);
      }
    };

    const handleMouseOut = (e) => {
      const target = e.target;
      const isInteractive =
        target.tagName.toLowerCase() === "a" ||
        target.tagName.toLowerCase() === "button" ||
        target.closest("a") ||
        target.closest("button") ||
        target.classList.contains("interactive") ||
        window.getComputedStyle(target).cursor === "pointer";

      if (isInteractive) {
        setIsHovered(false);
      }
    };

    window.addEventListener("mouseover", handleMouseOver);
    window.addEventListener("mouseout", handleMouseOut);

    return () => {
      window.removeEventListener("mouseover", handleMouseOver);
      window.removeEventListener("mouseout", handleMouseOut);
    };
  }, [isDesktop]);

  if (!isDesktop) return null;

  return (
    <>
      {/* Outer Glow / Trail */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-9999 flex items-center justify-center mix-blend-screen"
        style={{
          x: smoothX,
          y: smoothY,
          translateX: "-50%",
          translateY: "-50%",
        }}
      >
        <motion.div
          animate={{
            scale: isHovered ? 1.5 : 1,
            opacity: isHovered ? 0.8 : 0.5,
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-16 h-16 rounded-full bg-linear-to-r from-pink-500 to-blue-500 blur-xl"
        />
      </motion.div>

      {/* Inner Dot */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-10000 flex items-center justify-center mix-blend-difference"
        style={{
          x: mouseX,
          y: mouseY,
          translateX: "-50%",
          translateY: "-50%",
        }}
      >
        <motion.div
          animate={{
            scale: isHovered ? 0 : 1,
            opacity: isHovered ? 0 : 1,
          }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
        />
      </motion.div>
    </>
  );
}
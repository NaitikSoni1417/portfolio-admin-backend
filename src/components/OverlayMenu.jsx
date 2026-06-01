import { motion, AnimatePresence } from "framer-motion";

import {
  FiX,
  FiHome,
  FiUser,
  FiCode,
  FiBriefcase,
  FiAward,
  FiMail,
} from "react-icons/fi";

import { FaGithub, FaLinkedin } from "react-icons/fa";

export default function OverlayMenu({ isOpen, onClose }) {
  const menuItems = [
    {
      name: "Home",
      href: "#home",
      icon: <FiHome />,
    },
    {
      name: "About",
      href: "#about",
      icon: <FiUser />,
    },
    {
      name: "Skills",
      href: "#skills",
      icon: <FiCode />,
    },
    {
      name: "Projects",
      href: "#projects",
      icon: <FiBriefcase />,
    },
    {
      name: "Experience",
      href: "#experience",
      icon: <FiAward />,
    },
    {
      name: "Certificates",
      href: "#certificates",
      icon: <FiAward />,
    },
    {
      name: "Contact",
      href: "#contact",
      icon: <FiMail />,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-2xl overflow-hidden flex items-center justify-center"
        >
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full bg-cyan-500/20 blur-3xl"
            animate={{
              x: [0, 100, -100, 0],
              y: [0, -50, 50, 0],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          <motion.div
            className="absolute w-[350px] h-[350px] rounded-full bg-emerald-500/20 blur-3xl"
            animate={{
              x: [0, -80, 80, 0],
              y: [0, 60, -60, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          <motion.button
            onClick={onClose}
            aria-label="Close Menu"
            className="absolute top-6 right-6 text-white text-5xl z-20"
            whileHover={{ rotate: 180, scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.4 }}
          >
            <FiX />
          </motion.button>

          <motion.ul
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.08,
                },
              },
            }}
            className="relative z-10 flex flex-col items-center gap-5"
          >
            {menuItems.map((item, index) => (
              <motion.li
                key={index}
                variants={{
                  hidden: {
                    opacity: 0,
                    y: 40,
                    scale: 0.8,
                  },
                  visible: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  },
                }}
                transition={{ duration: 0.4 }}
              >
                <motion.a
                  href={item.href}
                  onClick={onClose}
                  className="group flex items-center gap-4 text-white text-3xl md:text-6xl font-bold tracking-wide"
                  whileHover={{ scale: 1.08, x: 10 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-cyan-400 group-hover:text-emerald-400 transition-colors duration-300">
                    {item.icon}
                  </span>

                  <span className="group-hover:text-cyan-400 transition-colors duration-300">
                    {item.name}
                  </span>
                </motion.a>
              </motion.li>
            ))}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="flex flex-col items-center mt-8"
            >
              <p className="text-gray-400 tracking-[6px] text-sm">
                NAITIK SONI PORTFOLIO
              </p>

              <div className="flex items-center gap-6 mt-6 text-3xl">
                <motion.a
                  href="https://github.com/NaitikSoni1417"
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ scale: 1.3, rotate: 10 }}
                  className="text-white hover:text-cyan-400 transition-colors duration-300"
                >
                  <FaGithub />
                </motion.a>

                <motion.a
                  href="https://www.linkedin.com/in/naitiksoni1417"
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ scale: 1.3, rotate: -10 }}
                  className="text-white hover:text-cyan-400 transition-colors duration-300"
                >
                  <FaLinkedin />
                </motion.a>

                <motion.a
                  href="mailto:naitik.infosec@gmail.com"
                  whileHover={{ scale: 1.3, y: -5 }}
                  className="text-white hover:text-emerald-400 transition-colors duration-300"
                >
                  <FiMail />
                </motion.a>
              </div>
            </motion.div>
          </motion.ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
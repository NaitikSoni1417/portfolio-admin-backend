import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaRobot,
  FaPaperPlane,
  FaTimes,
  FaBolt,
  FaShieldAlt,
  FaCode,
  FaAward,
  FaUser,
} from "react-icons/fa";

const smartReply = (msg) => {
  const q = msg.toLowerCase();

  if (
    q.includes("project") ||
    q.includes("nsphotox") ||
    q.includes("webinfox")
  ) {
    return "Naitik has built NSphotoX for image OSINT/metadata forensics and WebinfoX for cyber reconnaissance, WHOIS, DNS, SSL, and OSINT workflows.";
  }

  if (q.includes("certificate") || q.includes("certification")) {
    return "Naitik has certificates in ethical hacking, Kali Linux, advanced cybersecurity, Red Team vs Blue Team, dark web awareness, and Cyber Leelawat internship achievements.";
  }

  if (q.includes("contact") || q.includes("email")) {
    return "You can contact Naitik through the contact form or email: naitik.infosec@gmail.com.";
  }

  if (q.includes("skill") || q.includes("cyber")) {
    return "Naitik works with cybersecurity, OSINT, recon, ethical hacking, Linux, Python, React, Node.js, secure web development, and reporting.";
  }

  if (q.includes("who") || q.includes("about") || q.includes("naitik")) {
    return "Naitik Soni is a cybersecurity engineer, ethical hacker, full-stack developer, and founder of NS Indian Cyber Army.";
  }

  return "I’m NS.ai, Naitik Soni’s portfolio assistant. Ask me about projects, skills, certificates, cybersecurity journey, or contact.";
};

export default function NSAIButton() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hello! I'm NS.ai, developed by Naitik Soni. Ask me about his skills, projects, certificates, or contact.",
    },
  ]);

  const sendMessage = async (customText) => {
    const userText = (customText || input).trim();
    if (!userText) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_NS_AI_API_URL || `${import.meta.env.VITE_API_URL || "https://portfolio-admin-backend-vsud.onrender.com"}/api/ns-ai`;
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userText }),
      });

      if (!response.ok) {
        throw new Error("Backend request failed");
      }

      const data = await response.json();
      if (data && data.success && data.reply) {
        setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
      } else {
        throw new Error("Invalid backend response");
      }
    } catch (error) {
      console.warn("NS.ai backend error, falling back to smart replies:", error);
      const fallbackReply = smartReply(userText);
      setMessages((prev) => [...prev, { role: "ai", text: fallbackReply }]);
    } finally {
      setLoading(false);
    }
  };

  const chips = [
    { icon: <FaUser />, text: "Skills" },
    { icon: <FaAward />, text: "Awards" },
    { icon: <FaCode />, text: "Projects" },
    { icon: <FaShieldAlt />, text: "Hire Me" },
  ];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 35, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 35, scale: 0.88 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
            className="
              fixed right-4 bottom-6 z-[9999]
              w-[92vw] max-w-[345px]
              h-[440px] max-h-[70vh]
              rounded-[28px]
              border border-[#1cd8d2]/25
              bg-black/55
              backdrop-blur-2xl
              shadow-[0_0_70px_rgba(28,216,210,0.24)]
              overflow-hidden
            "
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[#1cd8d2]/18 blur-[80px]" />
              <div className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-[#00bf8f]/12 blur-[90px]" />
              <div className="absolute inset-0 opacity-[0.035] bg-[linear-gradient(rgba(28,216,210,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(28,216,210,.7)_1px,transparent_1px)] bg-[size:30px_30px]" />
            </div>

            <div className="relative flex items-center gap-3 px-4 py-4 border-b border-white/10 bg-white/[0.045]">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1cd8d2] to-[#00ff99] text-black flex items-center justify-center text-lg shadow-[0_0_25px_rgba(28,216,210,0.35)]">
                <FaRobot />
              </div>

              <div>
                <h3 className="text-white font-black text-lg leading-none">
                  NS.ai
                </h3>
                <p className="mt-1 text-[11px] text-[#1cd8d2] font-bold">
                  Dev by Naitik Soni
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="
                  ml-auto
                  h-9 w-9
                  rounded-xl
                  border border-white/10
                  bg-white/[0.06]
                  text-zinc-300
                  flex items-center justify-center
                  hover:bg-[#1cd8d2]/15
                  hover:text-[#1cd8d2]
                  hover:border-[#1cd8d2]/40
                  hover:rotate-90
                  transition-all duration-300
                  shadow-[0_0_18px_rgba(28,216,210,0.08)]
                "
                aria-label="Close NS.ai Assistant"
              >
                <FaTimes />
              </button>
            </div>

            <div className="relative h-[285px] overflow-y-auto custom-scrollbar px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[86%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-gradient-to-r from-[#1cd8d2] to-[#00ff99] text-black font-bold"
                        : "bg-white/[0.06] border border-white/10 text-zinc-200"
                    }`}
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-[#1cd8d2] text-xs">
                  <FaBolt className="animate-pulse" />
                  NS.ai is thinking...
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {chips.map((chip) => (
                  <button
                    key={chip.text}
                    onClick={() => sendMessage(chip.text)}
                    className="rounded-full border border-[#1cd8d2]/40 bg-white/[0.04] px-3 py-2 text-xs text-zinc-300 hover:bg-[#1cd8d2]/10 hover:text-[#1cd8d2] transition flex items-center gap-2"
                  >
                    <span className="text-[#1cd8d2]">{chip.icon}</span>
                    {chip.text}
                  </button>
                ))}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10 bg-black/45 backdrop-blur-xl">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Ask something..."
                  className="
                    flex-1 rounded-full
                    border border-white/10
                    bg-black/35
                    px-4 py-3
                    text-white text-sm
                    placeholder:text-zinc-500
                    outline-none
                    focus:border-[#1cd8d2]
                  "
                />

                <button
                  onClick={() => sendMessage()}
                  className="
                    h-12 w-12 rounded-full
                    bg-gradient-to-r from-[#1cd8d2] to-[#00ff99]
                    text-black
                    flex items-center justify-center
                    hover:scale-105 transition
                    shadow-[0_0_25px_rgba(28,216,210,0.30)]
                  "
                  aria-label="Send message"
                >
                  <FaPaperPlane />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          initial={{ opacity: 0, scale: 0.7, x: 30 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.7, x: 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          whileHover={{ scale: 1.12, y: -5 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setOpen(true)}
          className="
            fixed right-5 bottom-5 z-[9999]
            md:right-8 md:bottom-8
            h-16 w-16 md:h-20 md:w-20
            rounded-full
            bg-gradient-to-br from-[#1cd8d2] via-[#00bf8f] to-[#0047ff]
            text-black text-2xl md:text-3xl
            flex items-center justify-center
            shadow-[0_0_45px_rgba(28,216,210,0.6)]
            border border-white/20
            backdrop-blur-xl
          "
          aria-label="Open NS.ai Assistant"
        >
          <FaRobot className="relative z-10" />
          <span className="absolute inset-0 rounded-full animate-ping bg-[#1cd8d2]/20" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-400 border-2 border-black animate-pulse" />
        </motion.button>
      )}
    </>
  );
}
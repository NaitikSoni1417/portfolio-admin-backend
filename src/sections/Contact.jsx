import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import emailjs from "@emailjs/browser";
import {
  FaGithub,
  FaLinkedin,
  FaEnvelope,
  FaPenFancy,
  FaCopy,
  FaCheckCircle,
  FaShieldAlt,
} from "react-icons/fa";

import Astra from "../assets/Astra.png";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const maxChars = 1200;
  const myEmail = "naitik.infosec@gmail.com";

  const socials = [
    {
      icon: <FaGithub />,
      label: "GitHub",
      link: "https://github.com/NaitikSoni1417",
    },
    {
      icon: <FaLinkedin />,
      label: "LinkedIn",
      link: "https://www.linkedin.com/in/naitiksoni1417",
    },
    {
      icon: <FaEnvelope />,
      label: "Email",
      link: `mailto:${myEmail}`,
    },
  ];

  const speakSuccess = () => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const voice = new SpeechSynthesisUtterance(
      "Message sent successfully. Naitik Soni will connect with you as soon as possible."
    );

    voice.rate = 0.95;
    voice.pitch = 1;
    voice.volume = 1;

    window.speechSynthesis.speak(voice);
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const saveMessageToAdmin = async () => {
    let publicIp = "";

    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      publicIp = ipData.ip || "";
    } catch {}

    try {
      await fetch(
        `${import.meta.env.VITE_API_URL || "https://portfolio-admin-backend-vsud.onrender.com"}/api/contact`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            message: formData.message,
            page: window.location.pathname,
            publicIp,
          }),
        }
      );
    } catch (err) {
      console.error("Admin save failed:", err);
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(myEmail);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setStatus("⚠️ Could not copy email. Please copy it manually.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "message" && value.length > maxChars) return;

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const typeProfessionalMessage = () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      setStatus("⚠️ First enter your name and email address.");
      return;
    }

    if (!validateEmail(formData.email)) {
      setStatus("⚠️ Please enter a valid email address first.");
      return;
    }

    setStatus("");

    const userName = formData.name.trim();

    const text = `Subject: Professional Collaboration Inquiry

Dear Naitik Soni,

I hope you are doing well.

I recently explored your portfolio and was genuinely impressed by your work in cybersecurity, ethical hacking, OSINT intelligence, and secure full-stack development. Your projects demonstrate a strong combination of technical expertise, modern design, and practical security knowledge.

I would like to connect with you regarding a potential professional collaboration, cybersecurity-related opportunity, or technical discussion. I believe your experience and innovative approach could bring significant value to future projects.

Please let me know a convenient time to connect and discuss this further. I look forward to hearing from you.

Thank you for your time and consideration.

Best regards,
${userName}`;

    let i = 0;

    setFormData((prev) => ({
      ...prev,
      message: "",
    }));

    const interval = setInterval(() => {
      setFormData((prev) => ({
        ...prev,
        message: text.slice(0, i),
      }));

      i++;

      if (i > text.length) {
        clearInterval(interval);
      }
    }, 10);
  };

  const sendEmail = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setStatus("⚠️ Please enter your name.");
      return;
    }

    if (!validateEmail(formData.email)) {
      setStatus("⚠️ Please enter a valid email address.");
      return;
    }

    if (!formData.message.trim()) {
      setStatus("⚠️ Please write your message.");
      return;
    }

    setLoading(true);
    setStatus("");

    const templateParams = {
      from_name: formData.name,
      from_email: formData.email,
      message: formData.message,

      browser_info: navigator.userAgent,
      platform: navigator.platform,
      screen_size: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      online_status: navigator.onLine ? "Online" : "Offline",
      page_url: window.location.href,
      submitted_at: new Date().toLocaleString(),
    };

    try {
      await emailjs.send(
        "service_wlsw9bq",
        "template_z72771t",
        templateParams,
        "z1i-8sob92WwBOt78"
      );

      await emailjs.send(
        "service_wlsw9bq",
        "template_itm22fl",
        templateParams,
        "z1i-8sob92WwBOt78"
      );
       
      await saveMessageToAdmin();
      
      setStatus("Message sent successfully ✅");
      setShowToast(true);
      speakSuccess();

      setTimeout(() => {
        setShowToast(false);
      }, 4500);

      setFormData({
        name: "",
        email: "",
        message: "",
      });
    } catch (error) {
      console.error(error);
      setStatus("Failed to send message ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="contact"
      className="relative min-h-screen bg-black text-white overflow-hidden py-20 px-6"
    >
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md rounded-2xl border border-[#1cd8d2]/30 bg-black/80 backdrop-blur-xl px-5 py-4 shadow-[0_0_45px_rgba(28,216,210,0.25)]"
          >
            <div className="flex items-center gap-4">
              <FaCheckCircle className="text-[#1cd8d2] text-3xl" />

              <div>
                <p className="font-black text-white">
                  Message Sent Successfully
                </p>
                <p className="text-sm text-zinc-400">
                  Naitik Soni will connect with you as soon as possible.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[-160px] bottom-[-160px] w-[650px] h-[480px] bg-[#00bf8f]/20 blur-[170px] rounded-full" />
        <div className="absolute right-[-160px] top-[80px] w-[650px] h-[480px] bg-[#0047ff]/20 blur-[180px] rounded-full" />
        <div className="absolute left-[40%] top-[8%] w-[380px] h-[300px] bg-[#302b63]/25 blur-[150px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(28,216,210,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(28,216,210,.7)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, x: -45 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="relative hidden lg:flex justify-center items-center"
        >
          <motion.div
            className="absolute w-[520px] h-[520px] rounded-full bg-[#1cd8d2]/10 blur-[90px]"
            animate={{
              scale: [1, 1.12, 1],
              opacity: [0.35, 0.75, 0.35],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="absolute w-[390px] h-[390px] rounded-full border border-[#1cd8d2]/20"
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          <motion.div
            className="absolute w-[470px] h-[470px] rounded-full border border-[#00bf8f]/10"
            animate={{
              rotate: -360,
            }}
            transition={{
              duration: 24,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          <motion.img
            src={Astra}
            alt="Astronaut"
            animate={{
              y: [0, -26, 0],
              x: [0, 10, 0],
              rotate: [0, 2.5, -1.5, 0],
            }}
            transition={{
              duration: 5.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            whileHover={{
              scale: 1.08,
              rotate: 5,
            }}
            className="relative z-10 w-[520px] xl:w-[610px] drop-shadow-[0_0_75px_rgba(28,216,210,0.22)] hover:drop-shadow-[0_0_115px_rgba(28,216,210,0.45)] transition-all duration-500"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 45 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="relative w-full rounded-[34px] border border-white/10 bg-white/[0.045] backdrop-blur-2xl p-7 md:p-10 shadow-[0_0_90px_rgba(28,216,210,0.13)] overflow-hidden"
        >
          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition duration-700 bg-gradient-to-br from-[#1cd8d2]/10 via-transparent to-[#00bf8f]/10" />

          <p className="relative text-[#1cd8d2] tracking-[0.26em] text-xs md:text-sm font-bold mb-4">
            SECURE CONTACT
          </p>

          <h2 className="relative text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#1cd8d2] via-[#00bf8f] to-[#302b63]">
            Let’s Work Together
          </h2>

          <p className="relative mt-4 text-zinc-400 leading-relaxed">
            Send me a direct message for cybersecurity, secure development,
            collaborations, or project discussions.
          </p>

          <div className="relative mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-center gap-3">
              <FaShieldAlt className="text-[#1cd8d2]" />
              <p className="text-sm text-zinc-400">
                Basic browser context may be included for security/debugging.
              </p>
            </div>
          </div>

          <div className="relative mt-7 flex flex-wrap gap-4">
            {socials.map((s) => (
              <motion.a
                key={s.label}
                href={s.link}
                target="_blank"
                rel="noreferrer"
                whileHover={{ y: -6, scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="group flex items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm hover:border-[#1cd8d2]/50 hover:bg-[#1cd8d2]/10 transition"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1cd8d2]/10 text-[#1cd8d2] text-lg group-hover:bg-[#1cd8d2] group-hover:text-black transition">
                  {s.icon}
                </span>

                <span className="font-semibold">{s.label}</span>
              </motion.a>
            ))}

            <motion.button
              type="button"
              onClick={copyEmail}
              whileHover={{ y: -6, scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className="group flex items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm hover:border-[#1cd8d2]/50 hover:bg-[#1cd8d2]/10 transition"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1cd8d2]/10 text-[#1cd8d2] text-lg group-hover:bg-[#1cd8d2] group-hover:text-black transition">
                {copied ? <FaCheckCircle /> : <FaCopy />}
              </span>
              <span className="font-semibold">
                {copied ? "Copied" : "Copy Email"}
              </span>
            </motion.button>
          </div>

          <form onSubmit={sendEmail} className="relative mt-8 space-y-5">
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="First name / Full name"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-white placeholder:text-zinc-500 outline-none focus:border-[#1cd8d2] focus:bg-white/[0.08] focus:shadow-[0_0_28px_rgba(28,216,210,0.16)] transition"
            />

            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="Your Email"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-white placeholder:text-zinc-500 outline-none focus:border-[#1cd8d2] focus:bg-white/[0.08] focus:shadow-[0_0_28px_rgba(28,216,210,0.16)] transition"
            />

            <div className="relative">
              <textarea
  name="message"
  required
  rows="8"
  value={formData.message}
  onChange={handleChange}
  placeholder="Write your message..."
  className="custom-scrollbar w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 pr-16 text-white placeholder:text-zinc-500 outline-none focus:border-[#1cd8d2] focus:bg-white/[0.08] focus:shadow-[0_0_28px_rgba(28,216,210,0.16)] transition"
/>

              <motion.button
                type="button"
                onClick={typeProfessionalMessage}
                whileHover={{ scale: 1.12, rotate: 10 }}
                whileTap={{ scale: 0.9 }}
                title="Auto-write professional message"
                className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-[#1cd8d2]/30 bg-[#1cd8d2]/10 text-[#1cd8d2] hover:bg-[#1cd8d2] hover:text-black transition shadow-[0_0_20px_rgba(28,216,210,0.12)]"
              >
                <FaPenFancy />
              </motion.button>

              <p className="mt-2 text-right text-xs text-zinc-500">
                {formData.message.length} / {maxChars}
              </p>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.025 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-2xl py-4 font-black bg-gradient-to-r from-[#0047ff] via-[#1cd8d2] to-[#00ff99] text-black transition disabled:opacity-60 shadow-[0_0_35px_rgba(28,216,210,0.22)]"
            >
              {loading ? "Sending..." : "Send Secure Message"}
            </motion.button>

            {status && (
              <p
                className={`text-center font-semibold ${
                  status.includes("⚠️") || status.includes("Failed")
                    ? "text-red-400"
                    : "text-[#1cd8d2]"
                }`}
              >
                {status}
              </p>
            )}
          </form>
        </motion.div>
      </div>
    </section>
  );
}
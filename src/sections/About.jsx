import {
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  FaGithub,
  FaLinkedin,
  FaEnvelope,
  FaWhatsapp,
} from "react-icons/fa";

import p from "../assets/p.jpg";

export default function About() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-200, 200], [10, -10]);
  const rotateY = useTransform(mouseX, [-200, 200], [-10, 10]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();

    mouseX.set(
      e.clientX - rect.left - rect.width / 2
    );

    mouseY.set(
      e.clientY - rect.top - rect.height / 2
    );
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const stats = [
    { label: "Global Rank (THM)", value: "20%" },
    { label: "Success Rate", value: "100%" },
    { label: "Companies Secured", value: "10+" },
    { label: "CPI", value: "6.9" },
  ];

  const skills = [
    "Ethical hacking",
    "Web Security",
    "Penetration Testing",
    "Bug Bounty Hunting",
    "Reconnaissance",
    "OSINT",
    "Malware Analysis",
    "IOT Security",
    "Python Automation",
    "React",
    "Node.js",
    "MongoDB",
    "Tailwind CSS",
  ];

  const socialLinks = [
    {
      icon: <FaGithub />,
      label: "GitHub",
      href: "https://github.com/NaitikSoni1417",
    },
    {
      icon: <FaLinkedin />,
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/naitiksoni1417",
    },
    {
      icon: <FaEnvelope />,
      label: "Email",
      href: "mailto:naitik.infosec@gmail.com",
    },
    {
      icon: <FaWhatsapp />,
      label: "WhatsApp Channel",
      href: "https://whatsapp.com/channel/0029Vb6pxgWAjPXVeX5PCf2a",
    },
  ];

  const glows = [
    "-top-10 -left-10 w-[360px] h-[360px] opacity-20 blur-[120px]",
    "bottom-0 right-10 w-[420px] h-[420px] opacity-15 blur-[140px]",
    "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] opacity-10 blur-[100px]",
  ];

  return (
    <section
      id="about"
      className="min-h-screen w-full flex items-center justify-center relative bg-black text-white overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute inset-0 pointer-events-none">
        {glows.map((c, i) => (
          <div
            key={i}
            className={`absolute rounded-full bg-gradient-to-r from-[#302b63] via-[#00bf8f] to-[#1cd8d2] animate-pulse ${c}`}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-7xl w-full mx-auto px-6 md:px-10 lg:px-12 py-20 flex flex-col gap-14">
        {/* TOP SECTION */}
        <motion.div
          className="flex flex-col md:flex-row items-center md:items-stretch gap-10"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
        >
          {/* IMAGE */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative w-[220px] h-[260px] sm:w-[260px] sm:h-[320px] md:w-[320px] md:h-[400px] rounded-[32px] overflow-hidden border border-[#1cd8d2]/20 shadow-[0_0_50px_rgba(28,216,210,0.12)] bg-gradient-to-br from-[#1cd8d2]/10 to-[#302b63]/20 shrink-0"
          >
            <img
              src={p}
              alt="profile"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </motion.div>

          {/* TEXT */}
          <div className="flex-1 flex flex-col justify-center text-center md:text-left">
            <h2 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#1cd8d2] via-[#00bf8f] to-[#1cd8d2]">
              Naitik Soni
            </h2>

            <p className="mt-3 text-lg sm:text-xl text-white/90 font-semibold">
              Cybersecurity Engineer
            </p>
<p className="mt-5 text-zinc-400 leading-relaxed text-base sm:text-lg max-w-2xl">
I am{" "}
<span className="font-bold text-white">
Naitik Soni
</span>
{" "}(
<span className="font-bold text-[#1cd8d2]">
NScyber1417
</span>
), a{" "}
<span className="font-semibold text-white">
Cybersecurity Engineer
</span>
{" "}&{" "}
<span className="font-semibold text-[#1cd8d2]">
Full Stack Developer
</span>
{" "}focused on{" "}
<span className="text-white font-semibold">
Web Security
</span>
,{" "}
<span className="text-[#1cd8d2] font-semibold">
Penetration Testing
</span>
,{" "}
<span className="text-white font-semibold">
Bug Bounty Hunting
</span>
, and{" "}
<span className="text-[#1cd8d2] font-semibold">
Secure Web Development
</span>
. Passionate about{" "}
<span className="font-semibold text-white">
Offensive Security
</span>
,{" "}
<span className="font-semibold text-[#1cd8d2]">
Vulnerability Research
</span>
, and building modern digital experiences with a strong foundation in{" "}
<span className="text-white font-semibold">
Security-First Engineering
</span>
{" "}and real-world{" "}
<span className="text-[#1cd8d2] font-semibold">
Attack Surface Analysis
</span>
.
</p>

            {/* STATS */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{
                    scale: 1.04,
                    y: -4,
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-4 text-center hover:border-[#1cd8d2]/40 transition"
                >
                  <h3 className="text-2xl font-bold text-[#1cd8d2]">
                    {item.value}
                  </h3>

                  <p className="mt-1 text-sm text-zinc-400">
                    {item.label}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* BUTTONS */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <motion.a
                href="#projects"
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center justify-center rounded-xl bg-white text-black px-6 py-3 font-semibold hover:bg-zinc-200 transition"
              >
                View Projects
              </motion.a>

              <motion.a
                href="#contact"
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 backdrop-blur-xl text-white px-6 py-3 hover:bg-white/10 transition"
              >
                Contact Me
              </motion.a>
            </div>
          </div>
        </motion.div>

        {/* ABOUT CARD */}
        <motion.div
          className="hidden lg:block w-full rounded-[36px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-10 xl:p-14 shadow-[0_0_60px_rgba(28,216,210,0.10)] hover:border-[#1cd8d2]/50 hover:shadow-[0_0_90px_rgba(28,216,210,0.18)] transition-all duration-300"
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-4xl font-extrabold text-white">
                About Me 
              </h3>

              <div className="mt-3 h-[4px] w-28 rounded-full bg-gradient-to-r from-[#1cd8d2] via-[#00bf8f] to-transparent" />
            </div>
          </div>

          <div className="space-y-6">
            <p className="text-gray-300 leading-relaxed text-[17px] xl:text-[18px]">
  I am{" "}
  <span className="font-semibold text-white">
    Naitik Soni
  </span>{" "}
  (
  <span className="font-semibold text-[#1cd8d2]">
    NScyber1417
  </span>
  ), a{" "}
  <span className="font-semibold text-white">
    Cybersecurity Engineer
  </span>
  ,{" "}
  <span className="font-semibold text-[#1cd8d2]">
    Ethical Hacker
  </span>
  , and{" "}
  <span className="font-semibold text-white">
    Full Stack Developer
  </span>{" "}
  focused on building{" "}
  <span className="font-semibold text-[#1cd8d2]">
    secure, scalable, and high-performance
  </span>{" "}
  digital systems. Currently studying at{" "}
  <span className="font-semibold text-white">
    Gujarat Technological University (GTU)
  </span>{" "}
  via{" "}
  <span className="font-semibold text-[#1cd8d2]">
    SVIT Vasad
  </span>
  . Passionate about{" "}
  <span className="font-semibold text-white">
    ethical hacking
  </span>
  ,{" "}
  <span className="font-semibold text-[#1cd8d2]">
    building secure systems
  </span>
  , and solving{" "}
  <span className="font-semibold text-white">
    real-world security challenges
  </span>
  .
</p>

            <p className="text-gray-400 leading-relaxed text-[17px] xl:text-[18px]">
              With a{" "}
              <span className="font-semibold text-white">
                Global Rank of 20% on TryHackMe
              </span>
              , I specialize in{" "}
              <span className="font-semibold text-[#1cd8d2]">
                practical cybersecurity
              </span>
              ,{" "}
              <span className="font-semibold text-white">
                offensive security research
              </span>
              ,{" "}
              <span className="font-semibold text-[#1cd8d2]">
                penetration testing
              </span>
              , and{" "}
              <span className="font-semibold text-white">
                vulnerability analysis
              </span>
              .
            </p>

            <p className="text-gray-400 leading-relaxed text-[17px] xl:text-[18px]">
              I developed{" "}
              <span className="font-semibold text-white">
                WebinfoX
              </span>
              , a{" "}
              <span className="font-semibold text-[#1cd8d2]">
                Python-based reconnaissance automation toolkit
              </span>{" "}
              focused on domain intelligence gathering, infrastructure discovery,
              DNS analysis, and attack surface mapping.
            </p>

            <p className="text-gray-400 leading-relaxed text-[17px] xl:text-[18px]">
              I also built{" "}
              <span className="font-semibold text-white">
                NSphotoX
              </span>
              , an{" "}
              <span className="font-semibold text-[#1cd8d2]">
                advanced image OSINT & metadata forensics platform
              </span>{" "}
              designed for ethical cybersecurity investigations. It includes
              EXIF metadata analysis, GPS intelligence, OCR extraction,
              AI-powered risk analysis, reverse image search integration,
              HTML/PDF forensic reporting, and cyberpunk-style investigation
              dashboards.
            </p>

            <p className="text-gray-400 leading-relaxed text-[17px] xl:text-[18px]">
              I am also the{" "}
              <span className="font-semibold text-[#1cd8d2]">
                Founder of NS Indian Cyber Army's
              </span>
              , a growing cybersecurity community with{" "}
              <span className="font-semibold text-white">
                500+ active members
              </span>{" "}
              from{" "}
              <span className="font-semibold text-[#1cd8d2]">
                33+ different countries
              </span>
              . I actively mentor juniors in{" "}
              <span className="font-semibold text-white">
                Penetration Testing
              </span>
              ,{" "}
              <span className="font-semibold text-[#1cd8d2]">
                Malware Analysis
              </span>
              , and{" "}
              <span className="font-semibold text-white">
                IOT Security
              </span>
              while promoting ethical hacking and cybersecurity awareness.
            </p>

            <p className="text-gray-400 leading-relaxed text-[17px] xl:text-[18px]">
              Alongside cybersecurity, I work with{" "}
              <span className="font-semibold text-[#1cd8d2]">
                React
              </span>
              ,{" "}
              <span className="font-semibold text-white">
                Tailwind CSS
              </span>
              ,{" "}
              <span className="font-semibold text-[#1cd8d2]">
                Node.js
              </span>
              ,{" "}
              <span className="font-semibold text-white">
                Python/Flask
              </span>
              ,{" "}
              <span className="font-semibold text-[#1cd8d2]">
                MySQL
              </span>
              , and{" "}
              <span className="font-semibold text-white">
                MongoDB
              </span>
              .
            </p>

            <p className="text-gray-400 leading-relaxed text-[17px] xl:text-[18px]">
  Beyond technical development, I am also the{" "}
  <span className="font-semibold text-[#1cd8d2]">
    Founder of NS Indian Cyber Army's
  </span>
  , a rapidly growing cybersecurity community with{" "}
  <span className="font-semibold text-white">
    500+ active members
  </span>{" "}
  across{" "}
  <span className="font-semibold text-[#1cd8d2]">
    33+ different countries
  </span>
  . Through this initiative, I actively mentor juniors in{" "}
  <span className="font-semibold text-white">
    Penetration Testing
  </span>
  ,{" "}
  <span className="font-semibold text-[#1cd8d2]">
    Malware Analysis
  </span>
  , and{" "}
  <span className="font-semibold text-white">
    IOT Security
  </span>
  while promoting ethical hacking, responsible disclosure, and practical
  cybersecurity learning within the community.
</p>

          </div>

          {/* SKILLS */}
          <div className="mt-10 flex flex-wrap gap-3">
            {skills.map((skill, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.06 }}
                className="px-4 py-2 rounded-full border border-[#1cd8d2]/20 bg-[#1cd8d2]/10 text-sm text-[#1cd8d2] backdrop-blur-md"
              >
                {skill}
              </motion.div>
            ))}
          </div>

          {/* SOCIAL */}
          <div className="mt-10 flex flex-wrap gap-4">
            {socialLinks.map((link, i) => (
              <motion.a
                key={i}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                whileHover={{
                  scale: 1.06,
                  y: -2,
                }}
                className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white hover:border-[#1cd8d2]/40 hover:bg-[#1cd8d2]/10 transition"
              >
                <span className="text-[#1cd8d2] text-lg">
                  {link.icon}
                </span>

                {link.label}
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
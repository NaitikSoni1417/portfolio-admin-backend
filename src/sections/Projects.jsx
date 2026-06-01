import webinfox from "../assets/webinfox.png";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import {
  FaGithub,
  FaExternalLinkAlt,
  FaShieldAlt,
  FaMusic,
  FaCamera,
  FaStar,
  FaEye,
  FaCodeBranch,
} from "react-icons/fa";

import nsphotox from "../assets/nsphotox.png";
import ParticlesBackground from "../components/ParticlesBackground";

const projects = [
  {
    title: "NSphotoX",
    category: "OSINT • Forensics",
    status: "LIVE",
    featured: true,
    image: nsphotox,
    icon: <FaCamera />,
    description:
      "Advanced image OSINT and metadata forensics toolkit with EXIF analysis, GPS intelligence, OCR, risk analysis, forensic reports, and investigation dashboard.",
    terminal: [
      "> Initializing Image Intelligence...",
      "> Extracting Metadata... [OK]",
      "> Analyzing GPS Data... [OK]",
      "> Building Cyber Report... [OK]",
    ],
    tech: ["Python", "Flask", "OSINT", "EXIF", "OCR", "Forensics"],
    github: "https://github.com/NaitikSoni1417/NSphotoX.git",
    live: "#",
    repo: "NaitikSoni1417/NSphotoX",
    gradient: "from-lime-400 via-green-500 to-emerald-600",
  },
  {
    title: "WebinfoX",
    category: "Cyber Recon Framework",
    status: "LIVE",
    featured: true,
    image: webinfox,
    icon: <FaShieldAlt />,
    description:
      "Advanced cyber reconnaissance and OSINT intelligence framework for domain analysis, subdomain enumeration, DNS intelligence, port scanning, WHOIS lookup, SSL analysis, and investigation workflows.",
    terminal: [
      "> Starting Recon Engine...",
      "> DNS Records Found... [OK]",
      "> Subdomains Enumerated... [OK]",
      "> Attack Surface Ready... [OK]",
    ],
    tech: ["Python", "OSINT", "Recon", "Cyber Security", "WHOIS", "DNS"],
    github: "https://github.com/NaitikSoni1417/WebinfoX.git",
    live: "#",
    repo: "NaitikSoni1417/WebinfoX",
    gradient: "from-cyan-400 via-blue-500 to-red-500",
  },
  {
    title: "NSMusic Air",
    category: "Music • Full Stack",
    status: "IN DEVELOPMENT",
    featured: false,
    image: null,
    icon: <FaMusic />,
    description:
      "Ad-free music streaming web app with rooms, synced playback, playlists, queue system, search, and modern futuristic audio experience.",
    terminal: [
      "> Building Music Engine...",
      "> Room Sync Active... [DEV]",
      "> Queue System Loading... [DEV]",
      "> Deployment Pending...",
    ],
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "Tailwind"],
    github: "#",
    live: "#",
    repo: null,
    gradient: "from-[#1cd8d2] via-[#00bf8f] to-[#302b63]",
  },
];

function ProjectCard({ project, index }) {
  const cardRef = useRef(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-160, 160], [8, -8]);
  const rotateY = useTransform(mouseX, [-160, 160], [-8, 8]);

  const [stats, setStats] = useState({
    stars: 0,
    watchers: 0,
    forks: 0,
  });

  useEffect(() => {
    if (!project.repo) return;

    fetch(`https://api.github.com/repos/${project.repo}`)
      .then((res) => res.json())
      .then((data) => {
        setStats({
          stars: data.stargazers_count || 0,
          watchers: data.watchers_count || 0,
          forks: data.forks_count || 0,
        });
      })
      .catch(() => {});
  }, [project.repo]);

  const handleMouseMove = (e) => {
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 70 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.15 }}
      viewport={{ once: true }}
      className="group relative rounded-[34px] border border-white/10 bg-white/[0.035] backdrop-blur-2xl overflow-hidden shadow-[0_0_60px_rgba(28,216,210,0.08)] hover:shadow-[0_0_90px_rgba(28,216,210,0.22)] transition-all duration-500"
    >
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-25 bg-gradient-to-br ${project.gradient} transition duration-700`}
      />

      <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(28,216,210,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(28,216,210,.4)_1px,transparent_1px)] bg-[size:34px_34px] animate-pulse" />

      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,transparent,rgba(28,216,210,.10),transparent)] translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-1000" />

      {project.status === "IN DEVELOPMENT" && (
        <div className="absolute top-5 right-[-46px] z-20 rotate-45 bg-[#1cd8d2] text-black font-black text-xs px-12 py-2">
          BUILDING
        </div>
      )}

      <div className="relative h-56 overflow-hidden">
        {project.image ? (
          <img
            src={project.image}
            alt={project.title}
            className="w-full h-full object-cover opacity-80 group-hover:scale-110 group-hover:opacity-100 transition-all duration-700"
          />
        ) : (
          <div className="h-full w-full bg-black p-6 font-mono text-sm text-[#1cd8d2]">
            <div className="flex gap-2 mb-5">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="w-3 h-3 rounded-full bg-green-500" />
            </div>

            {project.terminal.map((line, i) => (
              <p key={i} className="mb-2">
                {line}
              </p>
            ))}
          </div>
        )}

        <div className="absolute top-5 left-5 flex gap-3">
          <span
            className={`px-4 py-2 rounded-full text-xs font-bold bg-gradient-to-r ${project.gradient} text-black`}
          >
            {project.status}
          </span>

          {project.featured && (
            <span className="px-4 py-2 rounded-full text-xs font-bold bg-white/10 border border-white/15 text-white">
              FEATURED
            </span>
          )}
        </div>
      </div>

      <div className="relative p-7">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br ${project.gradient} text-black`}
          >
            {project.icon}
          </div>

          <div>
            <h3 className="text-3xl font-black text-white">
              {project.title}
            </h3>

            <p className="text-[#1cd8d2] text-sm font-semibold">
              {project.category}
            </p>
          </div>
        </div>

        <p className="mt-5 text-zinc-400 leading-relaxed">
          {project.description}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-center gap-2">
            <FaStar className="text-[#1cd8d2]" /> {stats.stars}
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-center gap-2">
            <FaEye className="text-[#1cd8d2]" /> {stats.watchers}
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-center gap-2">
            <FaCodeBranch className="text-[#1cd8d2]" /> {stats.forks}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {project.tech.map((tech) => (
            <span
              key={tech}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-[#1cd8d2]/10 border border-[#1cd8d2]/20 text-[#1cd8d2]"
            >
              {tech}
            </span>
          ))}
        </div>

        <div className="mt-8 flex gap-4">
          <a
            href={project.github}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 hover:bg-white/10 transition"
          >
            <FaGithub /> GitHub
          </a>

          <a
            href={project.live}
            target="_blank"
            rel="noreferrer"
            className={`flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${project.gradient} text-black font-black px-5 py-4 hover:scale-105 transition`}
          >
            <FaExternalLinkAlt /> Live
          </a>
        </div>
      </div>
    </motion.div>
  );
}

export default function Projects() {
  return (
    <section
      id="projects"
      className="relative min-h-screen bg-black text-white overflow-hidden py-28 px-6"
    >
      <ParticlesBackground />

      <div className="absolute inset-0 pointer-events-none z-[1]">
        <div className="absolute top-[-120px] left-[-120px] w-[520px] h-[520px] rounded-full bg-[#1cd8d2]/20 blur-[170px]" />
        <div className="absolute bottom-[-120px] right-[-120px] w-[600px] h-[600px] rounded-full bg-[#302b63]/35 blur-[180px]" />
        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(28,216,210,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(28,216,210,.7)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -35 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="text-center mb-18"
        >
          <p className="text-[#1cd8d2] tracking-[0.35em] text-sm font-bold mb-4">
            CYBER LAB • FULL STACK • OSINT
          </p>

          <h2 className="text-5xl md:text-7xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#1cd8d2] via-[#00bf8f] to-[#302b63]">
            Featured Projects
          </h2>

          <p className="mt-6 text-zinc-400 text-lg max-w-3xl mx-auto">
            Real-world cybersecurity, OSINT, forensics, and full-stack products
            built with performance, security, and futuristic UI experience.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.title}
              project={project}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
import React, { useMemo, useRef, useEffect, useState } from "react";
import Globe from "react-globe.gl";
import { FiMapPin, FiMonitor, FiX, FiWifi, FiClock } from "react-icons/fi";

export default function EarthView({ visitors = [] }) {
  const globeRef = useRef();
  const [selected, setSelected] = useState(null);

  const points = useMemo(() => {
    return visitors.map((v) => ({
      ...v,
      lat: Number(v.lat) || 22.3072,
      lng: Number(v.lng) || 73.1812,
      size: selected?._id === v._id ? 0.7 : 0.42,
      color: selected?._id === v._id ? "#f59e0b" : "#22d3ee",
    }));
  }, [visitors, selected]);

  const arcs = useMemo(() => {
    return points.map((p) => ({
      startLat: 22.3072,
      startLng: 73.1812,
      endLat: p.lat,
      endLng: p.lng,
      color: ["#22d3ee", "#14b8a6"],
    }));
  }, [points]);

  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.controls().autoRotate = true;
    globeRef.current.controls().autoRotateSpeed = 0.45;
    globeRef.current.pointOfView({ lat: 22, lng: 73, altitude: 2.45 }, 1000);
  }, []);

  const handlePointClick = (point) => {
    setSelected(point);
    globeRef.current?.pointOfView(
      { lat: point.lat, lng: point.lng, altitude: 1.55 },
      900
    );
  };

  return (
    <div className="relative h-[680px] overflow-hidden rounded-[2rem] border border-slate-200 bg-[#020617] shadow-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0ea5e933,transparent_45%)]" />

      <div className="absolute left-6 top-6 z-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-200">
          <FiWifi /> Live Visitor Network
        </div>
        <h2 className="mt-4 text-3xl font-black text-white">Earth View</h2>
        <p className="text-sm text-slate-400">Real IP location, browser, OS and page activity</p>
      </div>

      <div className="absolute right-6 top-6 z-10 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-4 text-xs font-bold text-white">
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-400" /> Visitor</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400" /> Selected</span>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <Globe
          ref={globeRef}
          width={1050}
          height={680}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="rgba(0,0,0,0)"
          pointsData={points}
          pointAltitude={0.055}
          pointRadius="size"
          pointColor="color"
          pointLabel={(p) => `${p.ip} • ${p.city}, ${p.country}`}
          onPointClick={handlePointClick}
          ringsData={selected ? [selected] : points}
          ringLat="lat"
          ringLng="lng"
          ringColor={(p) => p._id === selected?._id ? "#f59e0b" : "#22d3ee"}
          ringMaxRadius={5}
          ringPropagationSpeed={1.7}
          ringRepeatPeriod={850}
          arcsData={arcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcDashLength={0.45}
          arcDashGap={2}
          arcDashAnimateTime={2500}
          arcStroke={0.6}
        />
      </div>

      <div className="absolute bottom-6 left-6 z-10 w-[360px] rounded-3xl bg-white/95 p-5 shadow-2xl backdrop-blur-xl">
        {selected ? (
          <>
            <button onClick={() => setSelected(null)} className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
              <FiX />
            </button>

            <h3 className="pr-8 text-2xl font-black text-slate-950">
              {selected.ip || "Unknown IP"}
            </h3>

            <p className="mt-2 flex items-center gap-2 text-base font-bold text-slate-700">
              <FiMapPin className="text-cyan-500" />
              {selected.city || "Unknown"}, {selected.country || "Unknown"}
            </p>

            <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600">
              <FiMonitor className="mr-2 inline" />
              {selected.os || "Unknown"} • {selected.browser || "Unknown"}
            </div>

            <p className="mt-4 text-xs font-semibold text-slate-500">
              Page: <span className="text-slate-900">{selected.page || "/"}</span>
            </p>

            <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <FiClock />
              Last seen: {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "Unknown"}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-slate-500">Live Locations</p>
            <h3 className="text-4xl font-black text-slate-950">{points.length}</h3>
            <p className="mt-1 text-xs text-slate-500">Click a glowing dot to view visitor details</p>
          </>
        )}
      </div>
    </div>
  );
}

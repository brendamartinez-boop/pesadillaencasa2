'use client';
import React, { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotSpeed: number;
}

export default function Confetti() {
  const [particles, setParticles] = useState<Particle[]>(() => {
    const colors = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#1e3a8a', '#38bdf8', '#0284c7'];
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage of viewport width
      y: -10 - Math.random() * 20, // start above the screen
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 6,
      speedX: Math.random() * 3 - 1.5,
      speedY: Math.random() * 4 + 3,
      rotation: Math.random() * 360,
      rotSpeed: Math.random() * 10 - 5,
    }));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            y: p.y + p.speedY,
            x: p.x + p.speedX,
            rotation: p.rotation + p.rotSpeed,
          }))
          .filter((p) => p.y < 110) // keep on screen
      );
    }, 30);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}

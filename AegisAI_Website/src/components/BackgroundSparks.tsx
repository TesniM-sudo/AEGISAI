import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const BackgroundSparks = () => {
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; dx: number; dy: number; size: number; delay: number }[]>([]);

  useEffect(() => {
    const newSparks = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      dx: (Math.random() - 0.5) * 300,
      dy: (Math.random() - 0.5) * 300,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 5,
    }));
    setSparks(newSparks);
  }, []);

  return (
    <div className="spark-container">
      {sparks.map((s) => (
        <div
          key={s.id}
          className="spark"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            "--dx": `${s.dx}px`,
            "--dy": `${s.dy}px`,
            animationDelay: `${s.delay}s`,
          } as any}
        />
      ))}
    </div>
  );
};

export default BackgroundSparks;

import React, { useEffect, useRef } from 'react';

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  swaySpeed: number;
  swayOffset: number;
  opacity: number;
}

export const SnowEffect: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 65 snowflakes for graceful atmospheric snow without visual clutter or CPU load
    const flakeCount = 65;
    const flakes: Snowflake[] = [];

    const createFlake = (initialY?: number): Snowflake => ({
      x: Math.random() * width,
      y: initialY !== undefined ? initialY : Math.random() * height,
      radius: Math.random() * 2.2 + 0.8, // 0.8px to 3.0px
      speedY: Math.random() * 1.4 + 0.6, // dynamic vertical speed: 0.6 to 2.0 px/frame
      speedX: (Math.random() - 0.5) * 0.4, // gentle horizontal drift
      swaySpeed: Math.random() * 0.02 + 0.01,
      swayOffset: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.55 + 0.35, // 0.35 to 0.9
    });

    for (let i = 0; i < flakeCount; i++) {
      flakes.push(createFlake());
    }

    let isVisible = !document.hidden;
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < flakes.length; i++) {
        const flake = flakes[i];

        flake.swayOffset += flake.swaySpeed;
        flake.y += flake.speedY;
        flake.x += flake.speedX + Math.sin(flake.swayOffset) * 0.5;

        // Wrap around bottom
        if (flake.y > height + 5) {
          flakes[i] = createFlake(-10);
        } else if (flake.x > width + 5) {
          flake.x = -5;
        } else if (flake.x < -5) {
          flake.x = width + 5;
        }

        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        ctx.shadowBlur = flake.radius > 2 ? 4 : 2;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        width: '100vw',
        height: '100vh',
      }}
      aria-hidden="true"
    />
  );
};

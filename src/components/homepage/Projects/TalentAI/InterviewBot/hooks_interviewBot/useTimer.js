import { useState, useEffect } from "react";

export function useTimer(active, initial = 1800) {
  const [timeLeft, setTimeLeft] = useState(initial);

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      setTimeLeft(t => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [active]);

  return timeLeft;
}

"use client";

import { useEffect } from "react";

export default function CinematicError({
  error,
  retry,
}: Readonly<{ error: Error & { digest?: string }; retry: () => void }>) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error("Cinematic runtime failed.", error);
  }, [error]);

  return (
    <main className="fatal-recovery" role="alert">
      <h1>Не удалось продолжить фильм</h1>
      <p>Можно безопасно повторить запуск. Сохранённый ответ не будет удалён.</p>
      <div>
        <button type="button" onClick={retry}>Повторить</button>
        <button type="button" onClick={() => window.location.reload()}>Перезапустить</button>
      </div>
    </main>
  );
}

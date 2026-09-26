"use client";

export default function GlobalError({ retry }: Readonly<{ error: Error & { digest?: string }; retry: () => void }>) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, background: "#000", color: "#eee" }}>
        <main className="fatal-recovery" role="alert">
          <h1>SOULBOUND временно остановлен</h1>
          <button type="button" onClick={retry}>Повторить</button>
        </main>
      </body>
    </html>
  );
}

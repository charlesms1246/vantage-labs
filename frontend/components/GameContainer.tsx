export function GameContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-[40px] overflow-hidden border-[5px] border-foreground h-full w-auto max-w-full"
      style={{ aspectRatio: '2444 / 1620', boxShadow: "0 25px 50px -12px var(--canvas-shadow)" }}
    >
      {children}
    </div>
  );
}

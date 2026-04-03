import Image from "next/image";

export function Logo() {
  return (
    <div className="flex justify-center py-0">
      <Image
        src="/vantage_logo_transparent.png"
        alt="Vantage Labs"
        width={1024}
        height={421}
        priority
        style={{ height: '100px', width: 'auto' }}
      />
    </div>
  );
}

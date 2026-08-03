import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = "", priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/brand/edtechra-wordmark.png"
      width={1540}
      height={483}
      priority={priority}
      className={className}
      alt="Edtechra — Learn, Create, and Inspire"
      sizes="(max-width: 640px) 150px, 178px"
    />
  );
}

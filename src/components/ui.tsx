import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-black hover:brightness-110 active:brightness-95 shadow-[0_0_0_1px_rgba(74,222,155,0.25),0_8px_24px_-12px_rgba(74,222,155,0.5)]",
        secondary:
          "border border-line-strong bg-surface text-foreground hover:bg-surface-2 hover:border-accent-dim",
        ghost: "text-muted hover:text-foreground hover:bg-surface-2",
        outline:
          "border border-line-strong text-foreground hover:border-accent hover:text-accent",
        danger: "bg-danger/10 text-danger ring-1 ring-danger/30 hover:bg-danger/20",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function ButtonLink({
  href,
  className,
  variant,
  size,
  external,
  children,
}: {
  href: string;
  className?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
    >
      {children}
    </Link>
  );
}

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-muted ring-line-strong",
        accent: "bg-accent/10 text-accent ring-accent/30",
        sky: "bg-sky/10 text-sky ring-sky/30",
        warn: "bg-warn/10 text-warn ring-warn/30",
        danger: "bg-danger/10 text-danger ring-danger/30",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  children,
}: {
  className?: string;
  tone?: VariantProps<typeof badgeVariants>["tone"];
  children: React.ReactNode;
}) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          {eyebrow}
        </div>
      )}
      <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted">
          {description}
        </p>
      )}
    </div>
  );
}

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel panel-hover p-6", className)} {...props}>
      {children}
    </div>
  );
}

/** A label/value row used across the product and marketing surfaces. */
export function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={cn("text-sm", mono && "font-mono tnum")}>{value}</span>
    </div>
  );
}

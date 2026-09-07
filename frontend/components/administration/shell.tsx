import Link from "next/link";

/* Every tool page wears the same frame: the way back to the hub, the
   name, and one line saying what the tool does before anybody presses
   anything. */
export function Tool({
  name,
  lede,
  children,
}: {
  name: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <p className="mb-3.5 text-[13px] font-semibold text-muted">
        <Link href="/administration" className="text-inherit no-underline hover:text-ink">
          Administration
        </Link>{" "}
        / {name}
      </p>
      <h1 className="font-display text-headline font-semibold">{name}</h1>
      <p className="mt-3 max-w-[60ch] text-[17px] text-muted">{lede}</p>
      {children}
    </main>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] font-semibold">{label}</span>
      {children}
    </label>
  );
}

export const INPUT =
  "w-full rounded-[10px] border border-line-strong bg-card2 px-3.5 py-2.5 text-[15px] text-ink";

export function Box({ children }: { children: React.ReactNode }) {
  return <section className="mt-4.5 rounded-card border border-line bg-card p-4.5">{children}</section>;
}

export function BoxFoot({ note, children }: { note: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
      <span className="text-[13px] text-muted">{note}</span>
      {children}
    </div>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-1.5 font-display text-[23px] font-semibold tracking-[-0.02em]">{children}</h2>;
}

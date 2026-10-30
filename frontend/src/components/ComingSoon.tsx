import type { Icon } from "@phosphor-icons/react";

/** Placeholder for a tab that a later stage builds. */
export function ComingSoon({ icon: PageIcon, title, children }: { icon: Icon; title: string; children: string }) {
  return (
    <section className="mt-16 flex flex-col items-center px-6 text-center">
      <PageIcon size={48} weight="fill" className="text-red-600" aria-hidden />
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-stone-500">{children}</p>
    </section>
  );
}

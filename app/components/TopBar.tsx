/** White top bar: global search, user identity, sign-out. Server component. */
export function TopBar({
  name,
  role,
  logoutAction,
}: {
  name: string;
  role: string;
  logoutAction: () => Promise<void>;
}) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#dde5e8] bg-white px-3 py-2 sm:gap-x-4 sm:px-4">
      <form
        action="/search"
        method="get"
        className="order-last min-w-0 basis-full sm:order-none sm:max-w-xl sm:flex-1 sm:basis-0"
      >
        <input
          type="search"
          name="q"
          placeholder="Search members, products and more…"
          className="w-full rounded-full border border-[#c2d0d6] bg-[#eef3f5] px-4 py-2 text-sm transition-colors focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-600 sm:py-1.5"
        />
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden text-right md:block">
          <p className="text-xs font-semibold leading-tight text-[#14202b]">{name}</p>
          <p className="text-[11px] capitalize leading-tight text-[#607785]">{role}</p>
        </div>
        <span
          title={`${name} (${role})`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white"
        >
          {initials}
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="whitespace-nowrap rounded-[9px] border border-[#c2d0d6] bg-white px-3 py-1 text-xs text-[#3c4f5e] transition duration-150 hover:bg-[#eef3f5] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

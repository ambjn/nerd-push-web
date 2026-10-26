import ComposeForm from "./compose-form";

const nav = ["Compose", "Sent", "Templates", "Contacts"];

const stats = [
  { label: "Sent", value: "—" },
  { label: "Delivered", value: "—" },
  { label: "Opened", value: "—" },
  { label: "Bounced", value: "—" },
];

type Send = { to: string; subject: string; status: string; at: string };
const recent: Send[] = [];

const statusColor: Record<string, string> = {
  Delivered: "text-emerald-600 dark:text-emerald-400",
  Opened: "text-sky-600 dark:text-sky-400",
  Bounced: "text-red-600 dark:text-red-400",
  Queued: "text-zinc-500",
};

const card =
  "rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";

export default function Home() {
  return (
    <div className="flex flex-1 bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 sm:flex">
        <h1 className="mb-8 text-lg font-semibold tracking-tight">Nerd Push</h1>
        <nav className="flex flex-col gap-1 text-sm">
          {nav.map((item, i) => (
            <a
              key={item}
              href="#"
              aria-current={i === 0 ? "page" : undefined}
              className={`rounded-md px-3 py-2 ${
                i === 0
                  ? "bg-zinc-100 font-medium dark:bg-zinc-800"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <main className="flex flex-1 flex-col gap-6 p-6 sm:p-10">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Emails</h2>
          <p className="text-sm text-zinc-500">Compose and track outgoing mail.</p>
        </header>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className={card}>
              <p className="text-sm text-zinc-500">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          ))}
        </section>

        <section className={card}>
          <h3 className="mb-4 font-medium">Compose</h3>
          <ComposeForm />
        </section>

        <section className={card}>
          <h3 className="mb-4 font-medium">Recent sends</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-2 font-normal">To</th>
                <th className="pb-2 font-normal">Subject</th>
                <th className="pb-2 font-normal">Status</th>
                <th className="pb-2 text-right font-normal">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-zinc-500">
                    No emails sent yet.
                  </td>
                </tr>
              )}
              {recent.map((r) => (
                <tr key={r.to + r.subject}>
                  <td className="py-2 font-mono text-xs">{r.to}</td>
                  <td className="py-2">{r.subject}</td>
                  <td className={`py-2 ${statusColor[r.status]}`}>{r.status}</td>
                  <td className="py-2 text-right text-zinc-500">{r.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

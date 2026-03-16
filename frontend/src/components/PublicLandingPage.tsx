export default function PublicLandingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_38%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-5 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center">
        <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur md:p-10">
          <div className="max-w-3xl">
            <div className="text-xs font-bold uppercase tracking-[0.26em] text-slate-500">Monte Carlo Azure</div>
            <h1 className="mt-4 text-4xl font-black leading-tight text-slate-950 md:text-6xl">
              Décidez plus vite si votre date tient, si votre périmètre passe, et où agir en priorité.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
              Pour directeurs de projet, PMO et responsables delivery qui doivent sécuriser une trajectoire sans
              parcourir des tableaux techniques.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-extrabold text-slate-900">Sécuriser une date</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Visualisez les percentiles d’atterrissage pour distinguer un engagement défendable d’un pari fragile.
              </p>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-extrabold text-slate-900">Arbitrer un périmètre</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Testez un backlog ou un horizon fixe pour voir ce qu’il faut réduire, protéger ou renégocier.
              </p>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-extrabold text-slate-900">Piloter un portefeuille</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Comparez plusieurs équipes, estimez le risque global et préparez un support exploitable en COPIL.
              </p>
            </section>
          </div>

          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <a
              href="?demo=true"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-base font-bold text-white transition hover:bg-slate-800"
            >
              Voir la démo
            </a>
            <a href="?connect=true" className="text-sm font-semibold text-slate-700 underline decoration-slate-400 underline-offset-4">
              Connecter votre Azure DevOps
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

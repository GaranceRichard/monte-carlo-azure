export default function PublicConnectNotice() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-50">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center">
        <section className="w-full rounded-[2rem] border border-slate-800 bg-slate-900/80 p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <div className="text-xs font-bold uppercase tracking-[0.26em] text-sky-300">Instance publique GitHub Pages</div>
          <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">
            La connexion à un environnement Azure DevOps réel n’est pas disponible sur cette instance.
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-300">
            Cette version publique est dédiée à la démonstration. Utilisez la démo intégrée pour explorer les
            simulations, les percentiles, le portefeuille et l’export PDF sans configuration.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <a
              href="?demo=true"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-sky-300 px-6 py-3 text-base font-bold text-slate-950 transition hover:bg-sky-200"
            >
              Voir la démo
            </a>
            <a
              href="?"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Retour à l’accueil
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

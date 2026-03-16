import{r as j,a as H,b as I,d as V}from"./simulationPdfDownload-CbIa1BPx.js";import{c as Y}from"./simulationPdfDownload-CbIa1BPx.js";import{a as G,c as Q}from"./index-DhS_-2uO.js";import"./vendor-react-CVIqNm3N.js";function e(i){return i.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function n(i){return Number(i??0).toFixed(2).replace(".",",")}function W(i){return i?i.samples_count<6?"Historique trop court pour projeter avec confiance.":i.slope_norm<=-.15?"Throughput en forte baisse sur les dernieres semaines.":i.slope_norm<=-.05?"Throughput en baisse sur les dernieres semaines.":i.slope_norm>=.1?"Throughput en forte hausse sur les dernieres semaines.":i.slope_norm>=.05?"Throughput en hausse sur les dernieres semaines.":i.cv>=1||i.iqr_ratio>=1?"Dispersion elevee du throughput historique.":i.samples_count<8?"Volume historique encore limite.":"Historique globalement stable.":"Non disponible"}function O({selectedTeam:i,startDate:g,endDate:h,simulationMode:c,includeZeroWeeks:v,types:u,doneStates:m,backlogSize:x,targetWeeks:k,nSims:w,resultKind:$,displayPercentiles:r,throughputReliability:S,throughputPoints:b,distributionPoints:y,probabilityPoints:_}){const o=window.open("about:blank","_blank");if(!o)return;const P=j(b),z=H(y),C=I(_),E=c==="backlog_to_weeks"?`Backlog vers semaines - backlog: ${String(x)} items`:`Semaines vers items - cible: ${String(k)} semaines`,F=u.length?u.join(", "):"Aucun",L=m.length?m.join(", "):"Aucun",N=v?"Semaines 0 incluses":"Semaines 0 exclues",l=$==="items"?"items":"semaines (au plus)",d=G(c,r),a=S??Q(b.map(t=>Number(t.throughput??0)))??void 0,T=d<=.2?"fiable":d<=.5?"incertain":d<=.8?"fragile":"eleve",A=n(d),D=a?.label??"Non disponible",R=a?`${n(a.cv)} (${D})`:"Non disponible",q=W(a),B=`
      <!doctype html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Export Simulation Monte Carlo</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 12px; font-family: Arial, sans-serif; color: #111827; }
          .header { margin-bottom: 8px; }
          .title { margin: 0; font-size: 20px; }
          .summary-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.9fr); gap: 8px; margin-top: 6px; }
          .meta { padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 11px; line-height: 1.35; }
          .diagnostic-card { padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 11px; line-height: 1.35; }
          .diagnostic-title { margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #374151; }
          .meta-row { margin-bottom: 2px; }
          .kpis { display: flex; gap: 6px; margin-top: 8px; margin-bottom: 8px; }
          .kpis + .kpis { margin-top: 0; }
          .kpi { border: 1px solid #d1d5db; border-radius: 8px; padding: 6px 8px; min-width: 140px; background: #f9fafb; }
          .kpi-label { display: block; font-size: 11px; color: #374151; font-weight: 700; }
          .kpi-value { display: block; margin-top: 2px; font-size: 16px; font-weight: 800; }
          .section { margin-top: 8px; page-break-inside: avoid; }
          .section h2 { margin: 0 0 4px 0; font-size: 14px; }
          .chart-wrap { width: 100%; overflow: hidden; border: 1px solid #d1d5db; border-radius: 8px; padding: 4px; background: #fff; }
          .chart-wrap svg { width: 100%; height: auto; display: block; }
          .print-action {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 20;
            border: 1px solid #d1d5db;
            background: #111827;
            color: #ffffff;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }
          @media print {
            body { padding: 7mm; }
            .print-action { display: none; }
          }
          @media (max-width: 720px) {
            .summary-grid { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <button type="button" id="download-pdf" class="print-action">Telecharger PDF</button>
        <header class="header">
          <h1 class="title">Simulation Monte Carlo - ${e(i)}</h1>
          <div class="summary-grid">
            <div class="meta">
              <div class="meta-row"><b>Periode:</b> ${e(g)} au ${e(h)}</div>
              <div class="meta-row"><b>Mode:</b> ${e(E)}</div>
              <div class="meta-row"><b>Tickets:</b> ${e(F)}</div>
              <div class="meta-row"><b>Etats:</b> ${e(L)}</div>
              <div class="meta-row"><b>Echantillon:</b> ${e(N)}</div>
              <div class="meta-row"><b>Simulations:</b> ${e(String(w))}</div>
            </div>
            <aside class="diagnostic-card">
              <h2 class="diagnostic-title">Diagnostic</h2>
              <div class="meta-row"><b>Lecture:</b> ${e(q)}</div>
              <div class="meta-row"><b>CV:</b> ${e(n(a?.cv??0))}</div>
              <div class="meta-row"><b>IQR ratio:</b> ${e(n(a?.iqr_ratio??0))}</div>
              <div class="meta-row"><b>Pente normalisee:</b> ${e(n(a?.slope_norm??0))}</div>
              <div class="meta-row"><b>Semaines utilisees:</b> ${e(String(a?.samples_count??0))}</div>
            </aside>
          </div>
        </header>

        <section class="kpis">
          <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">${Number(r?.P50??0).toFixed(0)} ${e(l)}</span></div>
          <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">${Number(r?.P70??0).toFixed(0)} ${e(l)}</span></div>
          <div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">${Number(r?.P90??0).toFixed(0)} ${e(l)}</span></div>
        </section>
        <section class="kpis">
          <div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">${e(A)} (${e(T)})</span></div>
          <div class="kpi"><span class="kpi-label">Fiabilite</span><span class="kpi-value">${e(R)}</span></div>
        </section>
        <section class="section">
          <h2>Throughput hebdomadaire</h2>
          <div class="chart-wrap">${P}</div>
        </section>

        <section class="section">
          <h2>Distribution Monte Carlo</h2>
          <div class="chart-wrap">${z}</div>
        </section>

        <section class="section">
          <h2>Courbe de probabilite</h2>
          <div class="chart-wrap">${C}</div>
        </section>
      </body>
      </html>
    `;o.document.open(),o.document.write(B),o.document.close();const f=o;f.__downloadPdf=()=>{const t=o.document.getElementById("download-pdf");t&&(t.disabled=!0,t.textContent="Generation..."),V(o.document,i).catch(s=>{console.error(s);const M=s instanceof Error?s.message:String(s);typeof o.alert=="function"&&o.alert(`Echec generation PDF: ${M}`)}).finally(()=>{t&&(t.disabled=!1,t.textContent="Telecharger PDF")})};const p=()=>{const s=o.document.getElementById("download-pdf");!s||s.__downloadBound||(s.__downloadBound=!0,s.addEventListener("click",()=>{f.__downloadPdf?.()}))};p(),typeof o.addEventListener=="function"?o.addEventListener("load",p,{once:!0}):o.onload=p}export{Y as buildSimulationPdfFileName,V as downloadSimulationPdf,O as exportSimulationPrintReport};

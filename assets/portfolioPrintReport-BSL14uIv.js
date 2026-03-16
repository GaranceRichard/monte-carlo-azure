import{d as A,a as W,u as E,g as B}from"./index-DhS_-2uO.js";import{e as re,f as oe,r as ne,a as le,b as de}from"./simulationPdfDownload-CbIa1BPx.js";import"./vendor-react-CVIqNm3N.js";function i(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function F(e){return e.startsWith("Arrime")?e.replace("Arrime","Arrimé"):e}const ce=[e=>e==="Optimiste",e=>e.startsWith("Arrime"),e=>e.startsWith("Friction")];function z(e){const a=ce.findIndex(r=>r(e));return a>=0?a:3}function ue(e){if(!e.length)return[];const a=[1,2,3,2,1],r=2;return e.map((p,u)=>{let d=0,l=0;for(let f=-r;f<=r;f+=1){const n=u+f;if(n<0||n>=e.length)continue;const m=a[f+r];d+=e[n].count*m,l+=m}return l>0?d/l:e[u].count})}function D(e){return{fiable:"#15803d",incertain:"#d97706",fragile:"#dc2626"}[e]??"#111827"}function R(e,a){const r=W(e,a),p=B(r);return{score:r,label:p,valueLabel:r.toFixed(2).replace(".",",")}}function H(e){const a=Number.isFinite(e)?Math.max(0,e):0,r=B(a);return{score:a,label:r,valueLabel:a.toFixed(2).replace(".",",")}}function q(e){return Number(e??0).toFixed(2).replace(".",",")}function M(e){return e?`${q(e.cv)} (${e.label})`:"Non disponible"}function pe(e){return e?[{matches:e.samples_count<6,text:"Historique trop court pour projeter avec confiance."},{matches:e.slope_norm<=-.15,text:"Throughput en forte baisse sur les dernieres semaines."},{matches:e.slope_norm<=-.05,text:"Throughput en baisse sur les dernieres semaines."},{matches:e.slope_norm>=.1,text:"Throughput en forte hausse sur les dernieres semaines."},{matches:e.slope_norm>=.05,text:"Throughput en hausse sur les dernieres semaines."},{matches:e.cv>=1||e.iqr_ratio>=1,text:"Dispersion elevee du throughput historique."},{matches:e.samples_count<8,text:"Volume historique encore limite."}].find(r=>r.matches)?.text??"Historique globalement stable.":"Non disponible"}function me(e){return e.kind==="reading-rule"?`<p class="hypothesis reading-rule"><strong>${i(e.lead)}</strong><br />${i(e.body)}</p>`:e.lead?`<p class="hypothesis">${e.emphasizedLead?`<strong>${i(e.lead)}</strong>`:i(e.lead)}${i(e.body)}</p>`:`<p class="hypothesis">${i(e.body)}</p>`}function be({simulationMode:e,resultKind:a,displayPercentiles:r,distribution:p,riskScore:u}){const d=a==="items"?A(p,[50,70,90]):r;return a==="items"?R(e,d):typeof u=="number"&&Number.isFinite(u)?H(u):R(e,d)}function T({title:e,subtitle:a,selectedProject:r,startDate:p,endDate:u,simulationMode:d,includeZeroWeeks:l,backlogSize:f,targetWeeks:n,nSims:m,types:x=[],doneStates:w=[],resultKind:y,distribution:P,weeklyThroughput:S,displayPercentiles:o,riskScore:b,throughputReliability:t,note:s,pageBreak:v}){const h=(l?S:S.filter(c=>c.throughput>0)).map((c,$,ee)=>{const te=Math.max(0,$-4+1),C=ee.slice(te,$+1),ie=C.reduce((se,ae)=>se+ae.throughput,0)/C.length;return{week:String(c.week).slice(0,10),throughput:c.throughput,movingAverage:Number(ie.toFixed(2))}}),k=[...P].map(c=>({x:Number(c.x),count:Number(c.count)})).filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.count)&&c.count>0).sort((c,$)=>c.x-$.x),j=ue(k),I=k.map((c,$)=>({x:c.x,count:c.count,gauss:j[$]})),O=E(k,y),_=y==="items"?A(k,[50,70,90]):o,Q=ne(h).replaceAll("Throughput hebdomadaire","Courbes de probabilités comparées"),V=le(I),Z=de(O),G=d==="backlog_to_weeks"?`Backlog vers semaines - backlog: ${String(f)} items`:`Semaines vers items - cible: ${String(n)} semaines`,K=x.length?x.join(", "):"Agrégé portefeuille",U=w.length?w.join(", "):"Agrégé portefeuille",N=y==="items"?"items (au moins)":"semaines (au plus)",J=l?"Semaines 0 incluses":"Semaines 0 exclues",L=be({simulationMode:d,resultKind:y,displayPercentiles:_,distribution:k,riskScore:b}),X=pe(t),Y=M(t);return`
    <section class="page ${v?"page-break":""}">
      <header class="header">
        <h1 class="title">${i(e)}</h1>
        ${a?`<div class="subtitle"><i>${i(a)}</i></div>`:""}
        <div class="summary-grid">
          <div class="meta">
          <div class="meta-row"><b>Projet:</b> ${i(r)}</div>
          <div class="meta-row"><b>Période:</b> ${i(p)} au ${i(u)}</div>
          <div class="meta-row"><b>Mode:</b> ${i(G)}</div>
          <div class="meta-row"><b>Tickets:</b> ${i(K)}</div>
          <div class="meta-row"><b>Etats:</b> ${i(U)}</div>
          <div class="meta-row"><b>Échantillon:</b> ${i(J)}</div>
          <div class="meta-row"><b>Simulations:</b> ${i(String(m))}</div>
          </div>
          <aside class="diagnostic-card">
            <h2 class="diagnostic-title">Diagnostic</h2>
            <div class="meta-row"><b>Lecture:</b> ${i(X)}</div>
            <div class="meta-row"><b>CV:</b> ${i(q(t?.cv??0))}</div>
            <div class="meta-row"><b>IQR ratio:</b> ${i(q(t?.iqr_ratio??0))}</div>
            <div class="meta-row"><b>Pente normalisee:</b> ${i(q(t?.slope_norm??0))}</div>
            <div class="meta-row"><b>Semaines utilisees:</b> ${i(String(t?.samples_count??0))}</div>
          </aside>
        </div>
      </header>

      <section class="kpis">
        <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">${Number(_?.P50??0).toFixed(0)} ${i(N)}</span></div>
        <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">${Number(_?.P70??0).toFixed(0)} ${i(N)}</span></div>
        <div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">${Number(_?.P90??0).toFixed(0)} ${i(N)}</span></div>
      </section>
      <section class="kpis">
        <div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">${i(L.valueLabel)} <span style="color:${D(L.label)}">(${i(L.label)})</span></span></div>
        <div class="kpi"><span class="kpi-label">Fiabilite</span><span class="kpi-value">${i(Y)}</span></div>
      </section>

      <section class="section">
        <h2>Courbes de probabilités comparées</h2>
        <div class="chart-wrap">${Q}</div>
        ${s?`<div class="note">${i(s)}</div>`:""}
      </section>

      <section class="section">
        <h2>Distribution Monte Carlo</h2>
        <div class="chart-wrap">${V}</div>
      </section>

      <section class="section">
        <h2>Courbe de probabilité</h2>
        <div class="chart-wrap">${Z}</div>
      </section>
    </section>
  `}function he({selectedProject:e,startDate:a,endDate:r,includedTeams:p,alignmentRate:u,simulationMode:d,backlogSize:l,targetWeeks:f,scenarios:n}){const m=[...n].sort((o,b)=>z(o.label)-z(b.label)),x=m.find(o=>o.label.startsWith("Friction"))?.label??`Friction (${Math.round((Math.max(0,Math.min(100,u))/100)**p.length*100)}%)`,w=m.map(o=>{const b=d==="weeks_to_items"?"items":"weeks",t=[...o.distribution].map(h=>({x:Number(h.x),count:Number(h.count)})).filter(h=>Number.isFinite(h.x)&&Number.isFinite(h.count)&&h.count>0).sort((h,k)=>h.x-k.x),s=b==="items"?A(t,[50,70,90]):o.percentiles,v=b==="items"?R(d,s):H(Number(o.riskScore??W(d,s))),g=M(o.throughputReliability);return`
        <tr>
          <td>${i(F(o.label))}</td>
          <td>${Number(s.P50??0).toFixed(0)}</td>
          <td>${Number(s.P70??0).toFixed(0)}</td>
          <td>${Number(s.P90??0).toFixed(0)}</td>
          <td><span class="risk-chip" style="color:${D(v.label)}">${i(v.valueLabel)} (${i(v.label)})</span></td>
          <td>${i(g)}</td>
        </tr>
      `}).join(""),y=m.map(o=>{const b=d==="weeks_to_items"?"items":"weeks",t=[...o.distribution].map(g=>({x:Number(g.x),count:Number(g.count)})).filter(g=>Number.isFinite(g.x)&&Number.isFinite(g.count)&&g.count>0).sort((g,h)=>g.x-h.x),s=E(t,b),v=o.label==="Optimiste"?"#15803d":o.label.startsWith("Arrime")?"#2563eb":o.label.startsWith("Friction")?"#d97706":"#dc2626";return{label:F(o.label),color:v,points:s}}),P=oe(y),S=[{kind:"paragraph",lead:"Optimiste :",emphasizedLead:!0,body:" Somme des débits de toutes les équipes. Hypothèse : livraison indépendante, aucun coût de synchronisation inter-équipes. En présence de dépendances fortes entre équipes, préférer les scénarios Arrimé ou Friction."},{kind:"paragraph",lead:"Arrimé :",emphasizedLead:!0,body:` ${String(u)}% de la capacité combinée. Hypothèse : coûts de synchronisation (cérémonies, dépendances, alignement) absorbés sur le débit global.`},{kind:"paragraph",lead:`${F(x)} :`,emphasizedLead:!0,body:` ${x.replace("Friction ","")} de la capacité combinée. Hypothèse : chaque équipe supplémentaire absorbe un coût d'alignement identique.`},{kind:"paragraph",body:"Conservateur : Débit médian des équipes x nb équipes. Hypothèse : le portefeuille est contraint par l'équipe médiane, pas par la pire."},{kind:"paragraph",lead:"Risk Score :",emphasizedLead:!0,body:" (P90 - P50) / P50. Plus le score est faible, plus la prévision est stable. Le Risk Score mesure la dispersion du résultat simulé - il ne qualifie pas la fiabilité des données sources."},{kind:"paragraph",lead:"Fiabilité de l'historique :",emphasizedLead:!0,body:" combinaison de trois signaux - dispersion globale du throughput (coefficient de variation), dispersion hors valeurs extrêmes (IQR ratio), et tendance récente (régression linéaire sur la période retenue). Quatre niveaux : fiable - historique stable, pas de tendance marquée / incertain - dispersion modérée ou historique court / fragile - forte volatilité ou tendance descendante / non fiable - historique trop court ou effondrement du throughput. À lire avant le Risk Score : un historique fragile limite la portée décisionnelle de l'ensemble de la simulation."},{kind:"reading-rule",lead:"Règle de lecture :",body:"Commencer par la fiabilité de l'historique, puis le Risk Score, puis les percentiles. Un P85 sur un historique fiable et un Risk Score faible constitue un engagement défendable. Le même P85 sur un historique fragile reste un chiffre calculable - mais son usage en comité nécessite de mentionner explicitement les limites de l'historique source."}];return`
    <section class="page page-break">
      <header class="header">
        <h1 class="title">Synthèse - Simulation Portefeuille</h1>
        <div class="meta">
          <div class="meta-row"><b>Projet:</b> ${i(e)}</div>
          <div class="meta-row"><b>Période:</b> ${i(a)} au ${i(r)}</div>
          <div class="meta-row"><b>Mode:</b> ${i(d==="backlog_to_weeks"?`Backlog vers semaines - backlog: ${String(l)} items`:`Semaines vers items - cible: ${String(f)} semaines`)}</div>
          <div class="meta-row"><b>Équipes incluses:</b> ${i(p.join(", ")||"Aucune")}</div>
          <div class="meta-row"><b>Taux d'arrimage:</b> ${i(String(u))}%</div>
        </div>
      </header>

      <section class="section">
        <h2>Synthèse décisionnelle</h2>
        <table class="summary-table summary-table--compact">
          <colgroup>
            <col class="summary-col summary-col--scenario" />
            <col class="summary-col summary-col--percentile" />
            <col class="summary-col summary-col--percentile" />
            <col class="summary-col summary-col--percentile" />
            <col class="summary-col summary-col--risk" />
            <col class="summary-col summary-col--reliability" />
          </colgroup>
          <thead>
            <tr><th>Scénario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th><th>Fiabilité</th></tr>
          </thead>
          <tbody>
            ${w}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Courbes de probabilités comparées</h2>
        <div class="chart-wrap">${P}</div>
      </section>

      <section class="section section--hypotheses">
        <h2>Hypothèses</h2>
        ${S.map(o=>me(o)).join("")}
      </section>
    </section>
  `}function ye({isDemo:e=!1,selectedProject:a,startDate:r,endDate:p,alignmentRate:u,includedTeams:d,sections:l,scenarios:f}){const n=window.open("about:blank","_blank");if(!n)return;const m=l[0]?.simulationMode??"backlog_to_weeks",x=[...f].sort((t,s)=>z(t.label)-z(s.label)),w=he({selectedProject:a,startDate:r,endDate:p,includedTeams:d,alignmentRate:u,simulationMode:m,backlogSize:l[0]?.backlogSize??0,targetWeeks:l[0]?.targetWeeks??0,scenarios:x}),y=x.map((t,s)=>T({title:`Scénario - ${F(t.label)}`,subtitle:t.hypothesis,selectedProject:a,startDate:r,endDate:p,simulationMode:m,includeZeroWeeks:!0,backlogSize:l[0]?.backlogSize??0,targetWeeks:l[0]?.targetWeeks??0,nSims:l[0]?.nSims??0,types:[],doneStates:[],resultKind:m==="weeks_to_items"?"items":"weeks",distribution:t.distribution,weeklyThroughput:t.weeklyData,displayPercentiles:t.percentiles,riskScore:t.riskScore,throughputReliability:t.throughputReliability,note:"Débit reconstruit par simulation bootstrap - non issu de l'historique réel.",pageBreak:s<x.length-1||l.length>0})).join(""),P=l.map((t,s)=>T({title:`Simulation Portefeuille - ${t.selectedTeam}`,selectedProject:a,startDate:r,endDate:p,simulationMode:t.simulationMode,includeZeroWeeks:t.includeZeroWeeks,backlogSize:t.backlogSize,targetWeeks:t.targetWeeks,nSims:t.nSims,types:t.types??[],doneStates:t.doneStates??[],resultKind:t.resultKind,distribution:t.distribution,weeklyThroughput:t.weeklyThroughput,displayPercentiles:t.displayPercentiles,riskScore:t.riskScore,throughputReliability:t.throughputReliability,pageBreak:s<l.length-1})).join(""),S=`
    <!doctype html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <title>Export Portefeuille Monte Carlo</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 12px; font-family: Arial, sans-serif; color: #111827; }
        .header { margin-bottom: 8px; }
        .title { margin: 0; font-size: 20px; }
        .subtitle { margin-top: 4px; font-size: 12px; color: #4b5563; }
        .summary-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.9fr); gap: 8px; margin-top: 6px; }
        .meta { margin-top: 6px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 11px; line-height: 1.35; }
        .diagnostic-card { margin-top: 6px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 11px; line-height: 1.35; }
        .diagnostic-title { margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #374151; }
        .meta-row { margin-bottom: 2px; }
        .kpis { display: flex; gap: 6px; margin-top: 8px; margin-bottom: 8px; }
        .kpi { border: 1px solid #d1d5db; border-radius: 8px; padding: 6px 8px; min-width: 140px; background: #f9fafb; }
        .kpi-label { display: block; font-size: 11px; color: #374151; font-weight: 700; }
        .kpi-value { display: block; margin-top: 2px; font-size: 16px; font-weight: 800; }
        .section { margin-top: 8px; page-break-inside: avoid; }
        .section--hypotheses { margin-top: 24px; }
        .section h2 { margin: 0 0 4px 0; font-size: 14px; }
        .note { margin-top: 4px; font-size: 11px; color: #4b5563; }
        .chart-wrap { width: 100%; overflow: hidden; border: 1px solid #d1d5db; border-radius: 8px; padding: 4px; background: #fff; }
        .chart-wrap svg { width: 100%; height: auto; display: block; }
        .summary-table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
        .summary-table--compact .summary-col--scenario { width: 24%; }
        .summary-table--compact .summary-col--percentile { width: 10%; }
        .summary-table--compact .summary-col--risk { width: 20%; }
        .summary-table--compact .summary-col--reliability { width: 26%; }
        .summary-table th, .summary-table td { border: 1px solid #d1d5db; padding: 4px; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
        .summary-table th { background: #f3f4f6; }
        .risk-chip { font-weight: 700; }
        .hypothesis { margin: 4px 0; font-size: 12px; }
        .hypothesis strong { font-weight: 700; }
        .reading-rule { margin-top: 10px; font-size: 13px; line-height: 1.4; }
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
        .page-break { page-break-after: always; }
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
      ${w}
      ${y}
      ${P}
    </body>
    </html>
  `;n.document.open(),n.document.write(S),n.document.close();const o=n;o.__downloadPdf=()=>{const t=n.document.getElementById("download-pdf");t&&(t.disabled=!0,t.textContent="Generation..."),re(n.document,a,e).catch(s=>{console.error(s);const v=s instanceof Error?s.message:String(s);typeof n.alert=="function"&&n.alert(`Echec generation PDF: ${v}`)}).finally(()=>{t&&(t.disabled=!1,t.textContent="Telecharger PDF")})};const b=()=>{const s=n.document.getElementById("download-pdf");!s||s.__downloadBound||(s.__downloadBound=!0,s.addEventListener("click",()=>{o.__downloadPdf?.()}))};b(),typeof n.addEventListener=="function"?n.addEventListener("load",b,{once:!0}):n.onload=b}export{ye as exportPortfolioPrintReport};

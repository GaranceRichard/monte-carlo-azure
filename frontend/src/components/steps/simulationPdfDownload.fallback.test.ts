import { expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({
  instances: [] as Array<{
    addPage: ReturnType<typeof vi.fn>;
    rect: ReturnType<typeof vi.fn>;
    text: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("jspdf", () => ({
  jsPDF: vi.fn(function MockJsPdfCtor() {
    const chain = () => vi.fn().mockReturnThis();
    const instance = {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      setFont: chain(), setFontSize: chain(), setTextColor: chain(), setDrawColor: chain(),
      setLineWidth: chain(), setFillColor: chain(), roundedRect: chain(), rect: chain(),
      splitTextToSize: vi.fn((text: string) => text === "Oversized evidence"
        ? Array.from({ length: 80 }, (_, index) => `Oversized line ${index + 1}`)
        : [text]),
      text: chain(), addPage: chain(), svg: vi.fn(async () => undefined), save: vi.fn(),
    };
    pdfMocks.instances.push(instance);
    return instance;
  }),
}));

import { downloadPortfolioPdf } from "./simulationPdfDownload";

it("renders a fitting scenario card after its oversized row companion falls back", async () => {
  const reportDoc = document.implementation.createHTMLDocument("portfolio");
  reportDoc.body.innerHTML = `
    <section class="page comparison-page"><h1>Comparaison des hypothèses</h1><section>
      <h2>Lecture comparative</h2><div class="comparison-hypotheses">
        <article class="comparison-hypothesis"><h3>Carte surdimensionnée</h3><p class="comparison-evidence-type">Preuve longue</p><p>Oversized evidence</p><h4>Limites</h4><ul><li>Limite longue.</li></ul></article>
        <article class="comparison-hypothesis"><h3>Carte compacte</h3><p class="comparison-evidence-type">Preuve courte</p><p>Explication courte.</p><h4>Limites</h4><ul><li>Limite courte.</li></ul></article>
      </div></section>
    </section>`;
  await downloadPortfolioPdf(reportDoc, "Projet A");
  const pdf = pdfMocks.instances.at(-1)!;
  expect(pdf.addPage).toHaveBeenCalled();
  expect(pdf.rect).toHaveBeenCalledTimes(1);
  expect(pdf.rect).toHaveBeenCalledWith(8, expect.any(Number), 194, expect.any(Number), "S");
  expect(pdf.text).toHaveBeenCalledWith(["Carte compacte"], 11, expect.any(Number));
});

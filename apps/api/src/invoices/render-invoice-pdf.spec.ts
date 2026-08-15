import { renderInvoicePdf } from './render-invoice-pdf';

// Increment 0 of F-PAY: prove pdfkit actually produces a valid PDF buffer
// under this repo's plain Node test runner *before* any Payment/Invoice
// schema or endpoint exists. This runner is the same unmodified Node
// runtime Render's free-tier buildpack uses (no native compilation step,
// no headless browser) -- green here is the signal the plan calls for.
describe('renderInvoicePdf', () => {
  const fixture = {
    invoiceNumber: 'LN-FAC-2026-000001',
    issuedAt: new Date('2026-08-15T10:00:00Z'),
    issuerName: 'LaveNet',
    issuerAddress: 'Cocody, Abidjan',
    issuerContact: 'contact@lavenet.ci',
    vatRateBps: 0,
    orderReference: 'LN-2026-000142',
    items: [
      { name: 'Lavage chemise', quantity: 3, unitPriceXof: 1000, lineTotalXof: 3000 },
      { name: 'Nettoyage tapis', quantity: 1, unitPriceXof: 5000, lineTotalXof: 5000 },
    ],
    subtotalXof: 8000,
    discountXof: 0,
    deliveryFeeXof: 1000,
    vatAmountXof: 0,
    totalXof: 9000,
  };

  it('produces a real PDF buffer', async () => {
    const buffer = await renderInvoicePdf(fixture);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // A near-empty document is still a few hundred bytes; this rules out a
    // truncated/broken stream rather than asserting an exact size.
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('is deterministic in content length for the same input', async () => {
    const a = await renderInvoicePdf(fixture);
    const b = await renderInvoicePdf(fixture);
    // CreationDate/ModDate are pinned to issuedAt (not wall-clock) in
    // render-invoice-pdf.ts specifically so this holds -- a download today
    // and one next month of the same invoice must be byte-identical.
    expect(a.equals(b)).toBe(true);
  });
});

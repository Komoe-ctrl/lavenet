import PDFDocument from 'pdfkit';
import { formatXof } from '@lavenet/shared-domain';

// F-PAY-05. Pure rendering: takes a fully-frozen snapshot (issuer identity +
// order totals as they were at issuance, never re-read from live config or
// re-derived) and returns a Buffer -- no DB access, no file storage. The
// download endpoint (increment 2) calls this on every request instead of
// persisting a file: deterministic input in, identical bytes out, so
// "regenerated" and "stored" are indistinguishable to the client.
//
// pdfkit chosen over a Puppeteer/Playwright-style HTML-to-PDF renderer
// specifically because it's pure JS (pdfkit -> fontkit/linebreak, no native
// compilation, no bundled Chromium) -- the only thing Render's free-tier
// Node buildpack (render.yaml, no Dockerfile) needs to run this is `pnpm
// install`, identical to every other dependency in this repo.
export interface InvoicePdfItem {
  name: string;
  quantity: number;
  unitPriceXof: number;
  lineTotalXof: number;
}

export interface InvoicePdfInput {
  invoiceNumber: string;
  issuedAt: Date;
  issuerName: string;
  issuerAddress: string;
  issuerContact: string;
  vatRateBps: number;
  orderReference: string;
  items: readonly InvoicePdfItem[];
  subtotalXof: number;
  discountXof: number;
  deliveryFeeXof: number;
  vatAmountXof: number;
  totalXof: number;
}

export function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // pdfkit stamps CreationDate/ModDate with the real wall clock by
    // default -- overridden to `issuedAt` so two downloads of the same
    // invoice, weeks apart, produce byte-identical PDFs. A legal document
    // should carry the issuance instant, not whenever it was last fetched.
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Facture ${input.invoiceNumber}`,
        Author: input.issuerName,
        Creator: input.issuerName,
        Producer: input.issuerName,
        CreationDate: input.issuedAt,
        ModDate: input.issuedAt,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(input.issuerName, { continued: false });
    doc.fontSize(10).text(input.issuerAddress);
    doc.text(input.issuerContact);
    doc.moveDown();

    doc.fontSize(14).text(`Facture ${input.invoiceNumber}`);
    doc
      .fontSize(10)
      .text(`Émise le ${input.issuedAt.toLocaleDateString('fr-FR')}`)
      .text(`Commande ${input.orderReference}`);
    doc.moveDown();

    for (const item of input.items) {
      doc
        .fontSize(10)
        .text(
          `${item.name}  x${item.quantity}  ${formatXof(item.unitPriceXof)}  ${formatXof(item.lineTotalXof)}`,
        );
    }
    doc.moveDown();

    doc.fontSize(10).text(`Sous-total : ${formatXof(input.subtotalXof)}`);
    if (input.discountXof > 0) {
      doc.text(`Remise : -${formatXof(input.discountXof)}`);
    }
    doc.text(`Livraison : ${formatXof(input.deliveryFeeXof)}`);
    doc.text(`TVA (${input.vatRateBps / 100}%) : ${formatXof(input.vatAmountXof)}`);
    doc.fontSize(12).text(`Total : ${formatXof(input.totalXof)}`);

    doc.end();
  });
}

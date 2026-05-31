/** Render SWP HTML to a read-only PDF buffer (requires Puppeteer / Chromium). */
export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  let launch: (opts?: { headless?: boolean; args?: string[] }) => Promise<{
    newPage: () => Promise<{
      setContent: (html: string, opts: { waitUntil: string; timeout: number }) => Promise<void>;
      pdf: (opts: object) => Promise<Uint8Array>;
    }>;
    close: () => Promise<void>;
  }>;
  try {
    const mod = await import("puppeteer");
    launch = mod.default.launch.bind(mod.default) as typeof launch;
  } catch {
    throw new Error(
      "PDF export requires Puppeteer. Run: npm install puppeteer — or use HTML export and Print to PDF from the browser.",
    );
  }

  const browser = await launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.4in", right: "0.4in", bottom: "0.4in", left: "0.4in" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

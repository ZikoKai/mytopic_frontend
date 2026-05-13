import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import PptxGenJS from "pptxgenjs";

import type { Presentation, EditorScene } from "@/services/api";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function sanitizeFilename(name: string): string {
  return (
    (name || "presentation")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .trim()
      .replace(/\s+/g, "_") || "presentation"
  );
}

/* ------------------------------------------------------------------ */
/*  oklch → rgb resolution                                             */
/*  html2canvas 1.4.x cannot parse oklch() (Tailwind CSS 4).          */
/*  We bake every computed colour into the inline style so the clone   */
/*  is self-contained, then render it inside a blank <iframe> that     */
/*  has NO stylesheets → html2canvas never sees oklch.                 */
/* ------------------------------------------------------------------ */

const COLOR_PROPS = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
] as const;

// Text layout properties that must be baked so the iframe renders identically
// even without the page's stylesheets.
const TEXT_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "wordSpacing",
  "lineHeight",
  "textAlign",
  "textTransform",
  "textDecoration",
  "whiteSpace",
  "wordBreak",
] as const;

// Cache shared across all slides in one export run.
const _colorCache = new Map<string, string>();

/**
 * Convert any CSS color string to rgb/rgba using the Canvas 2D API.
 * Canvas is the only browser primitive guaranteed to return sRGB values
 * even when the input is oklch/lab/lch – so html2canvas never sees them.
 */
function resolveColorToRgb(raw: string): string {
  if (!raw) return raw;
  const lower = raw.toLowerCase().trim();
  if (
    lower === "none" ||
    lower === "transparent" ||
    lower === "currentcolor" ||
    lower === "inherit" ||
    lower === "initial"
  )
    return raw;
  // Already plain rgb/rgba/hex – no conversion needed.
  if (lower.startsWith("rgb(") || lower.startsWith("rgba(") || lower.startsWith("#"))
    return raw;

  const cached = _colorCache.get(raw);
  if (cached !== undefined) return cached;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = raw;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const resolved =
      a < 255
        ? `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`
        : `rgb(${r},${g},${b})`;
    _colorCache.set(raw, resolved);
    return resolved;
  } catch {
    _colorCache.set(raw, raw);
    return raw;
  }
}

/**
 * Scan a CSS value string for oklch(...) tokens and replace each one
 * with its canvas-resolved rgb() equivalent.  Used for gradients and shadows.
 */
function resolveOklchInString(value: string): string {
  if (!value.includes("oklch")) return value;
  return value.replace(/oklch\([^)]+\)/gi, (match) => resolveColorToRgb(match));
}

/**
 * Bake all computed colours AND text layout properties into inline styles.
 * The clone will then render identically inside the font-less iframe.
 */
function bakeComputedStyles(root: HTMLElement): void {
  const all = [root, ...root.querySelectorAll<HTMLElement>("*")];
  for (const el of all) {
    const cs = window.getComputedStyle(el);

    // Colours → force sRGB via canvas
    for (const p of COLOR_PROPS) {
      const raw = cs[p];
      if (raw) el.style[p] = resolveColorToRgb(raw);
    }

    // background-image gradients may carry oklch tokens
    const bgi = cs.backgroundImage;
    if (bgi && bgi !== "none") {
      el.style.backgroundImage = resolveOklchInString(bgi);
    }

    // box-shadow colour stops may carry oklch tokens
    const bs = cs.boxShadow;
    if (bs && bs !== "none") {
      el.style.boxShadow = resolveOklchInString(bs);
    }

    // Text layout properties – baked as absolute computed values so the
    // iframe renders spacing/sizing identically regardless of which font loads.
    for (const p of TEXT_PROPS) {
      const raw = cs[p];
      if (raw) el.style[p as keyof CSSStyleDeclaration] = raw as never;
    }
  }
}

/**
 * Collect every @font-face rule from the main document's stylesheets.
 * These are injected verbatim into the iframe so the browser can load
 * the same font files from the same origin.
 */
function collectFontFaceRules(): string {
  const rules: string[] = [];
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSFontFaceRule) {
            rules.push(rule.cssText);
          }
        }
      } catch {
        // CORS-blocked stylesheet – skip
      }
    }
  } catch {
    // ignore
  }
  return rules.join("\n");
}

/**
 * Render an element via html2canvas inside a clean <iframe>.
 * The iframe has no Tailwind/oklch stylesheets but does have all @font-face
 * declarations and the already-loaded FontFace objects transferred from the
 * main document, so fonts render identically to the editor.
 */
async function renderInIframe(
  source: HTMLElement,
  width: number,
  height: number,
  bgColor: string,
): Promise<HTMLCanvasElement> {
  const fontFaceCss = collectFontFaceRules();

  // 1. Create a hidden iframe with only the font declarations – no Tailwind
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-30000px;top:0;border:none;opacity:0;pointer-events:none;";
  iframe.width = String(width);
  iframe.height = String(height);
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument!;
  iframeDoc.open();
  iframeDoc.write(
    `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box;}${fontFaceCss}</style></head><body></body></html>`,
  );
  iframeDoc.close();

  // 2. Transfer already-loaded FontFace objects so the iframe doesn't need
  //    to re-download the font files (they are already in memory).
  for (const fontFace of document.fonts) {
    try {
      iframeDoc.fonts.add(fontFace);
    } catch {
      // Some browsers reject cross-document font transfer – @font-face CSS is
      // the fallback for those cases.
    }
  }

  // 3. Clone the source into the iframe body
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.position = "relative";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  iframeDoc.body.appendChild(clone);

  // 4. Wait for fonts and images to be ready
  try {
    await iframeDoc.fonts.ready;
  } catch {
    // fonts API unavailable – continue
  }

  const imgs = clone.querySelectorAll("img");
  if (imgs.length > 0) {
    await Promise.all(
      Array.from(imgs).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
      ),
    );
  }
  await new Promise((r) => setTimeout(r, 120));

  // 5. Capture – html2canvas reads ownerDocument (the iframe), never sees oklch
  try {
    const canvas = await html2canvas(clone, {
      width,
      height,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: bgColor,
      logging: false,
    });
    return canvas;
  } finally {
    document.body.removeChild(iframe);
  }
}

/* ------------------------------------------------------------------ */
/*  Capture a slide                                                    */
/* ------------------------------------------------------------------ */

function findSceneRoot(): HTMLDivElement | null {
  return document.querySelector<HTMLDivElement>('[data-slide-scene="true"]');
}

function resolveBackground(bg: string): string {
  if (!bg || bg === "transparent") return "#ffffff";
  if (bg.startsWith("#") || bg.startsWith("rgb")) return bg;
  // Resolve oklch / exotic colours
  const tmp = document.createElement("div");
  tmp.style.cssText = `color:${bg};position:fixed;left:-99999px;`;
  document.body.appendChild(tmp);
  const resolved = window.getComputedStyle(tmp).color;
  document.body.removeChild(tmp);
  return resolved;
}

async function captureCurrentSlide(
  scene: EditorScene,
): Promise<HTMLCanvasElement> {
  const W = scene.width > 0 ? scene.width : 1600;
  const H = scene.height > 0 ? scene.height : 900;
  const bgColor = resolveBackground(scene.background);

  const sceneRoot = findSceneRoot();
  if (!sceneRoot) {
    throw new Error("Scene root not found in DOM.");
  }

  // Clone the live scene
  const clone = sceneRoot.cloneNode(true) as HTMLDivElement;

  // Reset transform (the live scene is scaled to fit viewport)
  clone.style.transform = "none";
  clone.style.width = `${W}px`;
  clone.style.height = `${H}px`;
  clone.style.overflow = "hidden";
  clone.style.background = bgColor;
  clone.removeAttribute("data-slide-scene");

  // Remove selection outlines
  clone.querySelectorAll("[data-element-wrapper]").forEach((el) => {
    (el as HTMLElement).style.outline = "none";
    (el as HTMLElement).style.outlineOffset = "";
  });

  // Remove non-element children (guides, spacing markers)
  Array.from(clone.children).forEach((child) => {
    if (!child.hasAttribute("data-element-wrapper")) {
      child.remove();
    }
  });

  // Remove selection handles inside wrappers (children after content)
  clone.querySelectorAll("[data-element-wrapper]").forEach((wrapper) => {
    const children = Array.from(wrapper.children);
    for (let i = 1; i < children.length; i++) {
      children[i].remove();
    }
  });

  // Mount the clone temporarily to the main document so
  // getComputedStyle can resolve all colours including oklch → rgb
  clone.style.position = "fixed";
  clone.style.left = "-30000px";
  clone.style.top = "0";
  clone.style.zIndex = "-9999";
  document.body.appendChild(clone);

  // Bake every computed colour into inline rgb styles
  bakeComputedStyles(clone);

  // Detach from main document
  document.body.removeChild(clone);

  // Render inside a clean iframe (no oklch stylesheets)
  return renderInIframe(clone, W, H, bgColor);
}

/* ------------------------------------------------------------------ */
/*  Export to PDF                                                       */
/* ------------------------------------------------------------------ */

export async function exportToPdf(
  presentation: Presentation,
  setSlide: (index: number) => void,
): Promise<void> {
  _colorCache.clear();
  const slides = presentation.slides;
  if (!slides || slides.length === 0)
    throw new Error("Aucune slide a exporter.");

  const pageW = 338.67; // 16:9 in mm
  const pageH = 190.5;

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [pageW, pageH],
  });

  for (let i = 0; i < slides.length; i++) {
    // Navigate to the slide so the live DOM renders it
    setSlide(i);
    await new Promise((r) => setTimeout(r, 400));

    if (i > 0) pdf.addPage([pageW, pageH], "landscape");

    const canvas = await captureCurrentSlide(slides[i].editor_scene);
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH);
  }

  const filename = sanitizeFilename(presentation.presentation_title);
  pdf.save(`${filename}.pdf`);
}

/* ------------------------------------------------------------------ */
/*  Export to PowerPoint                                                */
/* ------------------------------------------------------------------ */

export async function exportToPptx(
  presentation: Presentation,
  setSlide: (index: number) => void,
): Promise<void> {
  _colorCache.clear();
  const slides = presentation.slides;
  if (!slides || slides.length === 0)
    throw new Error("Aucune slide a exporter.");

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "MyTopic";
  pptx.title = presentation.presentation_title || "Presentation";
  pptx.subject = presentation.presentation_title || "Presentation";

  for (let i = 0; i < slides.length; i++) {
    setSlide(i);
    await new Promise((r) => setTimeout(r, 400));

    const canvas = await captureCurrentSlide(slides[i].editor_scene);
    const imgData = canvas.toDataURL("image/png");

    const page = pptx.addSlide();
    page.addImage({
      data: imgData,
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
    });

    if (slides[i].speaker_notes) {
      page.addNotes(slides[i].speaker_notes);
    }
  }

  const filename = sanitizeFilename(presentation.presentation_title);
  await pptx.writeFile({ fileName: `${filename}.pptx` });
}

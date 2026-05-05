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

/** Bake every computed colour into inline styles (rgb only). */
function bakeComputedStyles(root: HTMLElement): void {
  const all = [root, ...root.querySelectorAll<HTMLElement>("*")];
  for (const el of all) {
    const cs = window.getComputedStyle(el);

    for (const p of COLOR_PROPS) {
      el.style[p] = cs[p];
    }

    // background-image (gradients)
    const bgi = cs.backgroundImage;
    if (bgi && bgi !== "none") {
      el.style.backgroundImage = bgi;
    }

    // box-shadow
    const bs = cs.boxShadow;
    if (bs && bs !== "none") {
      el.style.boxShadow = bs;
    }
  }
}

/**
 * Render an element via html2canvas inside a clean <iframe>
 * so html2canvas never encounters the page's oklch stylesheets.
 */
async function renderInIframe(
  source: HTMLElement,
  width: number,
  height: number,
  bgColor: string,
): Promise<HTMLCanvasElement> {
  // 1. Create a hidden iframe with no stylesheets
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-30000px;top:0;border:none;opacity:0;pointer-events:none;";
  iframe.width = String(width);
  iframe.height = String(height);
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument!;
  iframeDoc.open();
  iframeDoc.write(
    "<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box;}</style></head><body></body></html>",
  );
  iframeDoc.close();

  // 2. Clone the source into the iframe body (deep clone)
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.position = "relative";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  iframeDoc.body.appendChild(clone);

  // 3. Wait for images inside the clone
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
  await new Promise((r) => setTimeout(r, 100));

  // 4. Call html2canvas on the clone INSIDE the iframe
  //    html2canvas uses element.ownerDocument → it reads the iframe's
  //    empty stylesheet list, never seeing oklch.
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

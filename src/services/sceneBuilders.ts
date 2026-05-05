import type { Slide, EditorScene, SlideElement } from "@/services/api";

import {
  DEFAULT_SCENE_VERSION,
  DEFAULT_SCENE_WIDTH,
  DEFAULT_SCENE_HEIGHT,
  createTextElement,
  createShapeElement,
  createListElement,
  createTableElement,
  createMediaElement,
  createColumnsElement,
  createBackgroundElement,
} from "@/services/api";

import { resolveSemanticType } from "@/presentation/content";
import {
  getAgendaItems,
  getParagraphs,
  getDefinitionItems,
  getComparisonItems,
  getCardItems,
  getMetricItems,
  stripBulletPrefix,
  parseTableContent,
  splitLeadAndSupporting,
} from "@/presentation/content";

import type { SlideSemanticType } from "@/presentation/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function cleanText(text: string): string {
  return text.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1").trim();
}

function scene(elements: SlideElement[], background = "#ffffff"): EditorScene {
  return {
    version: DEFAULT_SCENE_VERSION,
    width: DEFAULT_SCENE_WIDTH,
    height: DEFAULT_SCENE_HEIGHT,
    background,
    elements,
  };
}

function ct(slide: Slide): Slide {
  return {
    ...slide,
    title: cleanText(slide.title),
    purpose: cleanText(slide.purpose),
    main_content: slide.main_content.map(cleanText),
  };
}

type BuilderFn = (slide: Slide, index: number) => EditorScene;

/* ------------------------------------------------------------------ */
/*  Builder: Cover                                                     */
/* ------------------------------------------------------------------ */

function buildCoverScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];

  els.push(
    createBackgroundElement(`bg-${index}`, 0, {
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
      fill: "#ffffff",
      accent: "#0f766e",
      pattern: "dots",
    }),
  );

  els.push(
    createShapeElement(`bar-${index}`, 1, {
      x: 0,
      y: 0,
      width: 1600,
      height: 6,
      shape: "rect",
      fill: "#0f766e",
      cornerRadius: 0,
      stroke: "transparent",
      strokeWidth: 0,
    }),
  );

  els.push(
    createTextElement(`title-${index}`, slide.title, 2, {
      x: 200,
      y: 260,
      width: 1200,
      height: 140,
      fontSize: 58,
      fontWeight: 800,
      align: "center",
      color: "#0f172a",
    }),
  );

  const subtitle = slide.purpose || "";
  if (subtitle) {
    els.push(
      createTextElement(`subtitle-${index}`, subtitle, 3, {
        x: 280,
        y: 420,
        width: 1040,
        height: 80,
        fontSize: 26,
        fontWeight: 500,
        align: "center",
        color: "#475569",
      }),
    );
  }

  if (slide.main_content.length > 0) {
    const meta = slide.main_content.slice(0, 3).join("  |  ");
    els.push(
      createTextElement(`meta-${index}`, meta, 4, {
        x: 300,
        y: 530,
        width: 1000,
        height: 50,
        fontSize: 18,
        fontWeight: 400,
        align: "center",
        color: "#94a3b8",
      }),
    );
  }

  els.push(
    createShapeElement(`deco-${index}`, 5, {
      x: 1320,
      y: -50,
      width: 280,
      height: 280,
      shape: "ellipse",
      fill: "rgba(15,118,110,0.06)",
      stroke: "transparent",
      strokeWidth: 0,
      opacity: 0.6,
    }),
  );

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Agenda                                                    */
/* ------------------------------------------------------------------ */

function buildAgendaScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];

  els.push(
    createTextElement(`eyebrow-${index}`, "STRUCTURE", 0, {
      x: 100,
      y: 36,
      width: 200,
      height: 30,
      fontSize: 13,
      fontWeight: 600,
      color: "#94a3b8",
    }),
  );

  els.push(
    createTextElement(`title-${index}`, slide.title, 1, {
      x: 100,
      y: 60,
      width: 800,
      height: 80,
      fontSize: 44,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  const items = getAgendaItems(slide);
  els.push(
    createListElement(`list-${index}`, 2, {
      x: 100,
      y: 160,
      width: 1400,
      height: 700,
      ordered: true,
      items,
      fontSize: 26,
      fontWeight: 600,
      color: "#1e293b",
      lineHeight: 1.6,
    }),
  );

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Section Transition                                        */
/* ------------------------------------------------------------------ */

function buildSectionScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];

  els.push(
    createBackgroundElement(`bg-${index}`, 0, {
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
      fill: "#ffffff",
      accent: "#0f766e",
      pattern: "none",
    }),
  );

  els.push(
    createShapeElement(`band-${index}`, 1, {
      x: 0,
      y: 340,
      width: 1600,
      height: 220,
      shape: "rect",
      fill: "#0f766e",
      cornerRadius: 0,
      stroke: "transparent",
      strokeWidth: 0,
    }),
  );

  els.push(
    createTextElement(`title-${index}`, slide.title, 2, {
      x: 160,
      y: 375,
      width: 1280,
      height: 100,
      fontSize: 48,
      fontWeight: 800,
      align: "center",
      color: "#0f172a",
    }),
  );

  if (slide.purpose) {
    els.push(
      createTextElement(`purpose-${index}`, slide.purpose, 3, {
        x: 240,
        y: 485,
        width: 1120,
        height: 60,
        fontSize: 22,
        fontWeight: 400,
        align: "center",
        color: "#475569",
      }),
    );
  }

  return scene(els, "#ffffff");
}

/* ------------------------------------------------------------------ */
/*  Builder: Paragraph (default fallback)                              */
/* ------------------------------------------------------------------ */

function buildParagraphScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];

  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 100,
      y: 60,
      width: 1200,
      height: 90,
      fontSize: 44,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  els.push(
    createShapeElement(`accent-${index}`, 1, {
      x: 100,
      y: 155,
      width: 60,
      height: 5,
      shape: "rect",
      fill: "#0f766e",
      cornerRadius: 2,
      stroke: "transparent",
      strokeWidth: 0,
    }),
  );

  const paragraphs = getParagraphs(slide).slice(0, 4);
  paragraphs.forEach((p, i) => {
    els.push(
      createTextElement(`para-${index}-${i}`, p, 2 + i, {
        x: 100,
        y: 190 + i * 160,
        width: 1400,
        height: 130,
        fontSize: 26,
        fontWeight: 400,
        color: "#334155",
        lineHeight: 1.5,
      }),
    );
  });

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Definition                                                */
/* ------------------------------------------------------------------ */

function buildDefinitionScene(slide: Slide, index: number): EditorScene {
  const defs = getDefinitionItems(slide);
  if (defs.length === 0) return buildParagraphScene(slide, index);

  const els: SlideElement[] = [];
  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 100,
      y: 60,
      width: 1200,
      height: 80,
      fontSize: 42,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  const items = defs.slice(0, 5);
  items.forEach((def, i) => {
    els.push(
      createShapeElement(`term-${index}-${i}`, 1 + i * 2, {
        x: 100,
        y: 170 + i * 130,
        width: 340,
        height: 100,
        shape: "rect",
        fill: "#f1f5f9",
        cornerRadius: 16,
        stroke: "#e2e8f0",
        strokeWidth: 1,
        label: def.term,
        textColor: "#0f172a",
        fontSize: 18,
        fontWeight: 700,
      }),
    );
    els.push(
      createTextElement(`expl-${index}-${i}`, def.explanation, 2 + i * 2, {
        x: 470,
        y: 185 + i * 130,
        width: 1030,
        height: 80,
        fontSize: 22,
        fontWeight: 400,
        color: "#475569",
      }),
    );
  });

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Quote                                                     */
/* ------------------------------------------------------------------ */

function buildQuoteScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];
  const { lead, supporting } = splitLeadAndSupporting(slide);

  els.push(
    createBackgroundElement(`bg-${index}`, 0, {
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
      fill: "#ffffff",
      accent: "#e7e5e4",
      pattern: "none",
    }),
  );

  els.push(
    createShapeElement(`deco-${index}`, 1, {
      x: 120,
      y: 160,
      width: 100,
      height: 100,
      shape: "ellipse",
      fill: "rgba(15,118,110,0.08)",
      stroke: "transparent",
      strokeWidth: 0,
    }),
  );

  els.push(
    createTextElement(`quote-${index}`, lead, 2, {
      x: 160,
      y: 260,
      width: 1280,
      height: 220,
      fontSize: 36,
      fontWeight: 700,
      fontStyle: "italic",
      align: "center",
      color: "#0f172a",
      lineHeight: 1.4,
    }),
  );

  const attribution = supporting[0] || slide.purpose || "";
  if (attribution) {
    els.push(
      createTextElement(`attr-${index}`, attribution, 3, {
        x: 400,
        y: 520,
        width: 800,
        height: 60,
        fontSize: 20,
        fontWeight: 500,
        align: "center",
        color: "#64748b",
      }),
    );
  }

  if (supporting.length > 1) {
    els.push(
      createTextElement(`support-${index}`, supporting.slice(1).join(" "), 4, {
        x: 200,
        y: 610,
        width: 1200,
        height: 80,
        fontSize: 20,
        fontWeight: 400,
        align: "center",
        color: "#94a3b8",
      }),
    );
  }

  return scene(els, "#ffffff");
}

/* ------------------------------------------------------------------ */
/*  Builder: Bullet / Numbered List                                    */
/* ------------------------------------------------------------------ */

function buildBulletListScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];
  const semantic = resolveSemanticType(slide);
  const ordered = semantic === "list.numbered";

  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 100,
      y: 60,
      width: 1200,
      height: 80,
      fontSize: 42,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  const items = slide.main_content.slice(0, 10).map(stripBulletPrefix);
  els.push(
    createListElement(`list-${index}`, 1, {
      x: 100,
      y: 170,
      width: 1400,
      height: 690,
      ordered,
      items,
      fontSize: 26,
      fontWeight: 500,
      color: "#1e293b",
      lineHeight: 1.5,
    }),
  );

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Comparison / Pros-Cons                                    */
/* ------------------------------------------------------------------ */

function buildComparisonScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];

  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 100,
      y: 60,
      width: 1200,
      height: 80,
      fontSize: 42,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  const items = getComparisonItems(slide).slice(0, 4);
  const columns = items.map((item) => [item.title, item.description]);

  els.push(
    createColumnsElement(`cols-${index}`, 1, {
      x: 100,
      y: 170,
      width: 1400,
      height: 680,
      columns,
      gap: 32,
      titleColor: "#0f172a",
      textColor: "#475569",
    }),
  );

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Table                                                     */
/* ------------------------------------------------------------------ */

function buildTableScene(slide: Slide, index: number): EditorScene {
  const rows = parseTableContent(slide.main_content);
  if (!rows || rows.length < 2) return buildCardsScene(slide, index);

  const els: SlideElement[] = [];

  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 100,
      y: 60,
      width: 1200,
      height: 80,
      fontSize: 42,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  els.push(
    createTableElement(`table-${index}`, 1, {
      x: 100,
      y: 170,
      width: 1400,
      height: 680,
      headers: rows[0],
      rows: rows.slice(1),
      headerFill: "#e2e8f0",
      borderColor: "#cbd5e1",
      textColor: "#1e293b",
      fontSize: 20,
    }),
  );

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: KPI / Metrics                                             */
/* ------------------------------------------------------------------ */

function buildKpiScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];

  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 100,
      y: 50,
      width: 1200,
      height: 70,
      fontSize: 40,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  const metrics = getMetricItems(slide).slice(0, 4);
  const cols = metrics.length <= 2 ? 2 : 2;
  const cardW = 680;
  const cardH = metrics.length <= 2 ? 380 : 270;
  const gapX =
    1400 - cols * cardW > 0 ? (1400 - cols * cardW) / (cols - 1 || 1) : 40;

  metrics.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = 100 + col * (cardW + gapX);
    const cy = 150 + row * (cardH + 30);

    els.push(
      createShapeElement(`card-${index}-${i}`, 1 + i, {
        x: cx,
        y: cy,
        width: cardW,
        height: cardH,
        shape: "rect",
        fill: "#ffffff",
        stroke: "#e2e8f0",
        strokeWidth: 1,
        cornerRadius: 20,
        label: m.value || "--",
        textColor: "#0f766e",
        fontSize: 42,
        fontWeight: 800,
      }),
    );

    els.push(
      createTextElement(`label-${index}-${i}`, m.label, 5 + i, {
        x: cx + 24,
        y: cy + cardH - 100,
        width: cardW - 48,
        height: 40,
        fontSize: 18,
        fontWeight: 600,
        color: "#1e293b",
      }),
    );

    if (m.note) {
      els.push(
        createTextElement(`note-${index}-${i}`, m.note, 9 + i, {
          x: cx + 24,
          y: cy + cardH - 55,
          width: cardW - 48,
          height: 45,
          fontSize: 15,
          fontWeight: 400,
          color: "#64748b",
        }),
      );
    }
  });

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Cards                                                     */
/* ------------------------------------------------------------------ */

function buildCardsScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];

  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 100,
      y: 60,
      width: 1200,
      height: 80,
      fontSize: 42,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  const cards = getCardItems(slide).slice(0, 6);
  const cols = cards.length <= 2 ? cards.length : 2;
  const cardW = cols === 1 ? 1400 : 680;
  const cardH = 200;
  const gapX = cols > 1 ? 40 : 0;
  const gapY = 20;

  cards.forEach((card, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = 100 + col * (cardW + gapX);
    const cy = 170 + row * (cardH + gapY);

    els.push(
      createShapeElement(`card-${index}-${i}`, 1 + i, {
        x: cx,
        y: cy,
        width: cardW,
        height: cardH,
        shape: "rect",
        fill: "#ffffff",
        stroke: "#e2e8f0",
        strokeWidth: 1,
        cornerRadius: 16,
        label: `${card.title}\n${card.description}`,
        textColor: "#1e293b",
        fontSize: 18,
        fontWeight: 500,
        textAlign: "left",
      }),
    );
  });

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Visual Split (text + image)                               */
/* ------------------------------------------------------------------ */

function buildVisualSplitScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];

  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 60,
      y: 50,
      width: 720,
      height: 70,
      fontSize: 36,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  const paragraphs = getParagraphs(slide).slice(0, 3);
  paragraphs.forEach((p, i) => {
    els.push(
      createTextElement(`para-${index}-${i}`, p, 1 + i, {
        x: 60,
        y: 150 + i * 140,
        width: 700,
        height: 120,
        fontSize: 22,
        fontWeight: 400,
        color: "#475569",
        lineHeight: 1.5,
      }),
    );
  });

  els.push(
    createMediaElement(`media-${index}`, 4, {
      x: 820,
      y: 50,
      width: 720,
      height: 800,
      mediaKind: "image",
      fit: "cover",
      borderRadius: 24,
      src: "",
      alt: slide.suggested_visual || "Visual",
      background: "#e2e8f0",
    }),
  );

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Timeline                                                  */
/* ------------------------------------------------------------------ */

function buildTimelineScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];

  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 100,
      y: 50,
      width: 1200,
      height: 70,
      fontSize: 40,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  const steps = slide.main_content.slice(0, 6).map(stripBulletPrefix);

  els.push(
    createShapeElement(`line-${index}`, 1, {
      x: 145,
      y: 160,
      width: 4,
      height: Math.min(steps.length * 130, 700),
      shape: "rect",
      fill: "#cbd5e1",
      cornerRadius: 2,
      stroke: "transparent",
      strokeWidth: 0,
    }),
  );

  steps.forEach((step, i) => {
    els.push(
      createShapeElement(`dot-${index}-${i}`, 2 + i * 2, {
        x: 122,
        y: 155 + i * 130,
        width: 50,
        height: 50,
        shape: "ellipse",
        fill: "#0f766e",
        stroke: "transparent",
        strokeWidth: 0,
        label: `${i + 1}`,
        textColor: "#ffffff",
        fontSize: 20,
        fontWeight: 700,
      }),
    );
    els.push(
      createTextElement(`step-${index}-${i}`, step, 3 + i * 2, {
        x: 200,
        y: 158 + i * 130,
        width: 1300,
        height: 50,
        fontSize: 24,
        fontWeight: 500,
        color: "#1e293b",
      }),
    );
  });

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Process / Workflow                                        */
/* ------------------------------------------------------------------ */

function buildProcessScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];

  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 100,
      y: 50,
      width: 1200,
      height: 70,
      fontSize: 40,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  const steps = slide.main_content.slice(0, 5).map(stripBulletPrefix);
  const count = steps.length || 1;
  const totalW = 1400;
  const gap = 16;
  const stepW = (totalW - gap * (count - 1)) / count;

  steps.forEach((step, i) => {
    const sx = 100 + i * (stepW + gap);

    els.push(
      createShapeElement(`step-${index}-${i}`, 1 + i * 2, {
        x: sx,
        y: 180,
        width: stepW,
        height: 360,
        shape: "rect",
        fill: "#f8fafc",
        stroke: "#e2e8f0",
        strokeWidth: 1,
        cornerRadius: 20,
        label: `${i + 1}. ${step}`,
        textColor: "#1e293b",
        fontSize: 17,
        fontWeight: 600,
        textAlign: "left",
      }),
    );

    if (i < steps.length - 1) {
      els.push(
        createShapeElement(`arrow-${index}-${i}`, 2 + i * 2, {
          x: sx + stepW - 2,
          y: 345,
          width: gap + 4,
          height: 28,
          shape: "rect",
          fill: "#0f766e",
          cornerRadius: 14,
          stroke: "transparent",
          strokeWidth: 0,
          label: "\u203A",
          textColor: "#ffffff",
          fontSize: 18,
          fontWeight: 700,
        }),
      );
    }
  });

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Problem / Solution                                        */
/* ------------------------------------------------------------------ */

function buildProblemSolutionScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];

  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 100,
      y: 50,
      width: 1200,
      height: 70,
      fontSize: 40,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  const items = slide.main_content.map(cleanText);
  const mid = Math.ceil(items.length / 2);
  const problemText = items.slice(0, mid).join("\n");
  const solutionText = items.slice(mid).join("\n");

  els.push(
    createShapeElement(`prob-bg-${index}`, 1, {
      x: 60,
      y: 150,
      width: 720,
      height: 700,
      shape: "rect",
      fill: "#fef2f2",
      stroke: "#fca5a5",
      strokeWidth: 1,
      cornerRadius: 20,
    }),
  );

  els.push(
    createTextElement(`prob-label-${index}`, "Probleme", 2, {
      x: 90,
      y: 170,
      width: 300,
      height: 40,
      fontSize: 20,
      fontWeight: 700,
      color: "#dc2626",
    }),
  );

  els.push(
    createTextElement(`prob-text-${index}`, problemText, 3, {
      x: 90,
      y: 225,
      width: 660,
      height: 590,
      fontSize: 22,
      fontWeight: 400,
      color: "#7f1d1d",
      lineHeight: 1.5,
    }),
  );

  els.push(
    createShapeElement(`sol-bg-${index}`, 4, {
      x: 820,
      y: 150,
      width: 720,
      height: 700,
      shape: "rect",
      fill: "#f0fdf4",
      stroke: "#86efac",
      strokeWidth: 1,
      cornerRadius: 20,
    }),
  );

  els.push(
    createTextElement(`sol-label-${index}`, "Solution", 5, {
      x: 850,
      y: 170,
      width: 300,
      height: 40,
      fontSize: 20,
      fontWeight: 700,
      color: "#16a34a",
    }),
  );

  els.push(
    createTextElement(`sol-text-${index}`, solutionText, 6, {
      x: 850,
      y: 225,
      width: 660,
      height: 590,
      fontSize: 22,
      fontWeight: 400,
      color: "#14532d",
      lineHeight: 1.5,
    }),
  );

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Q&A                                                       */
/* ------------------------------------------------------------------ */

function buildQAScene(slide: Slide, index: number): EditorScene {
  const defs = getDefinitionItems(slide);
  if (defs.length === 0) return buildParagraphScene(slide, index);

  const els: SlideElement[] = [];

  els.push(
    createTextElement(`title-${index}`, slide.title, 0, {
      x: 100,
      y: 50,
      width: 1200,
      height: 70,
      fontSize: 40,
      fontWeight: 800,
      color: "#0f172a",
    }),
  );

  const pairs = defs.slice(0, 4);
  pairs.forEach((pair, i) => {
    els.push(
      createTextElement(`q-${index}-${i}`, `Q: ${pair.term}`, 1 + i * 2, {
        x: 100,
        y: 150 + i * 170,
        width: 1400,
        height: 45,
        fontSize: 22,
        fontWeight: 700,
        color: "#0f766e",
      }),
    );
    els.push(
      createTextElement(`a-${index}-${i}`, pair.explanation, 2 + i * 2, {
        x: 100,
        y: 200 + i * 170,
        width: 1400,
        height: 90,
        fontSize: 20,
        fontWeight: 400,
        color: "#475569",
        lineHeight: 1.4,
      }),
    );
  });

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Builder: Closing                                                   */
/* ------------------------------------------------------------------ */

function buildClosingScene(slide: Slide, index: number): EditorScene {
  const els: SlideElement[] = [];
  const semantic = resolveSemanticType(slide);

  els.push(
    createBackgroundElement(`bg-${index}`, 0, {
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
      fill: "#ffffff",
      accent: "#e2e8f0",
      pattern: "none",
    }),
  );

  if (semantic === "closure.thank_you") {
    els.push(
      createTextElement(`eyebrow-${index}`, "MERCI", 1, {
        x: 500,
        y: 220,
        width: 600,
        height: 30,
        fontSize: 13,
        fontWeight: 600,
        align: "center",
        color: "#94a3b8",
      }),
    );
  }

  els.push(
    createTextElement(`title-${index}`, slide.title, 2, {
      x: 200,
      y: 280,
      width: 1200,
      height: 100,
      fontSize: 44,
      fontWeight: 800,
      align: "center",
      color: "#0f172a",
    }),
  );

  const paragraphs = getParagraphs(slide).slice(0, 3);
  paragraphs.forEach((p, i) => {
    els.push(
      createTextElement(`content-${index}-${i}`, p, 3 + i, {
        x: 200,
        y: 410 + i * 80,
        width: 1200,
        height: 70,
        fontSize: 22,
        fontWeight: 400,
        align: "center",
        color: "#475569",
      }),
    );
  });

  return scene(els);
}

/* ------------------------------------------------------------------ */
/*  Dispatcher: semantic_type -> builder                               */
/* ------------------------------------------------------------------ */

const BUILDER_MAP: Record<string, BuilderFn> = {
  "cover.title": buildCoverScene,

  "section.agenda": buildAgendaScene,
  "section.transition": buildSectionScene,

  "content.paragraph": buildParagraphScene,
  "content.multi_paragraph": buildParagraphScene,
  "content.info_box": buildParagraphScene,
  "content.definition": buildDefinitionScene,
  "content.definition_list": buildDefinitionScene,
  "content.quote": buildQuoteScene,

  "list.bullets": buildBulletListScene,
  "list.numbered": buildBulletListScene,
  "list.takeaways": buildBulletListScene,
  "list.pros_cons": buildComparisonScene,

  "comparison.two_column": buildComparisonScene,
  "comparison.before_after": buildComparisonScene,
  "comparison.concepts": buildComparisonScene,
  "comparison.solutions": buildComparisonScene,

  "data.table": buildTableScene,
  "data.comparative_table": buildTableScene,
  "data.matrix": buildTableScene,
  "data.kpi": buildKpiScene,
  "data.cards": buildCardsScene,

  "visual.image_text": buildVisualSplitScene,
  "visual.overlay": buildVisualSplitScene,
  "visual.illustration": buildVisualSplitScene,
  "visual.gallery": buildVisualSplitScene,

  "diagram.timeline": buildTimelineScene,
  "diagram.process": buildProcessScene,
  "diagram.workflow": buildProcessScene,
  "diagram.orgchart": buildProcessScene,
  "diagram.cause_effect": buildProcessScene,

  "business.problem_solution": buildProblemSolutionScene,
  "business.objectives_results": buildComparisonScene,
  "business.use_case": buildCardsScene,
  "business.roadmap": buildTimelineScene,
  "business.architecture": buildProcessScene,
  "business.product_feature": buildVisualSplitScene,

  "academic.definition": buildDefinitionScene,
  "academic.explanation": buildParagraphScene,
  "academic.case_study": buildCardsScene,
  "academic.summary": buildBulletListScene,
  "academic.qa": buildQAScene,

  "closure.conclusion": buildClosingScene,
  "closure.thank_you": buildClosingScene,
};

export function buildEditorSceneForSlide(
  slide: Slide,
  index: number,
): EditorScene {
  const cleaned = ct(slide);
  const semantic: SlideSemanticType = resolveSemanticType(cleaned);
  const builder = BUILDER_MAP[semantic] ?? buildParagraphScene;
  return builder(cleaned, index);
}

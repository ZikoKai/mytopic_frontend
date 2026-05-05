import { create } from "zustand";
import axios from "axios";
import type {
  ChartSlideElement,
  ColumnsSlideElement,
  GroupSlideElement,
  IconSlideElement,
  ListSlideElement,
  MediaSlideElement,
  PersistedPresentationSummary,
  Presentation,
  ShapeSlideElement,
  Slide,
  SlideElement,
  SlideElementBase,
  TableSlideElement,
  TextSlideElement,
} from "@/services/api";
import type { EditorTemplateType } from "@/editor/slideTemplates";
import { createSceneFromTemplate } from "@/editor/slideTemplates";
import {
  createMediaElement,
  createEditorSceneFromSlide,
  ensureFixedBackgroundShape,
  FIXED_BG_ELEMENT_ID,
  createSavedPresentation,
  generateImageFromPrompt,
  generatePresentation,
  getSavedPresentation,
  listSavedPresentations,
  updateSavedPresentation,
} from "@/services/api";

interface ElementPatch {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
}

interface PresentationState {
  presentationId: string | null;
  presentation: Presentation | null;
  presentations: PersistedPresentationSummary[];
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;
  generateAndCreate: (
    topic: string,
    language?: string,
  ) => Promise<string | null>;
  refreshUserPresentations: () => Promise<void>;
  loadPresentationById: (id: string) => Promise<void>;
  saveCurrentPresentation: () => Promise<void>;
  importPresentationFromJson: (json: string) => boolean;
  addSlideAfter: (slideIndex: number) => void;
  removeSlide: (slideIndex: number) => void;
  updateSpeakerNotes: (slideIndex: number, nextNotes: string) => void;
  addTextElementToSlide: (slideIndex: number, text?: string) => void;
  addShapeElementToSlide: (
    slideIndex: number,
    shape?: "rect" | "ellipse",
  ) => void;
  addElementToSlide: (
    slideIndex: number,
    type: "list" | "table" | "media" | "icon" | "chart" | "columns" | "group",
  ) => void;
  addGeneratedImageToSlide: (
    slideIndex: number,
    src: string,
    alt?: string,
  ) => string | null;
  applyTemplateToSlide: (
    slideIndex: number,
    template: EditorTemplateType,
  ) => void;
  updateElementGeometry: (
    slideIndex: number,
    elementId: string,
    patch: ElementPatch,
  ) => void;
  updateElementStyle: (
    slideIndex: number,
    elementId: string,
    patch: Record<string, unknown>,
  ) => void;
  alignElementsOnSlide: (
    slideIndex: number,
    elementIds: string[],
    mode: "left" | "center" | "right" | "top" | "middle" | "bottom",
  ) => void;
  distributeElementsOnSlide: (
    slideIndex: number,
    elementIds: string[],
    axis: "horizontal" | "vertical",
  ) => void;
  updateSceneBackground: (slideIndex: number, background: string) => void;
  updateTextElementContent: (
    slideIndex: number,
    elementId: string,
    text: string,
  ) => void;
  updateTextElementStyle: (
    slideIndex: number,
    elementId: string,
    patch: Partial<
      Pick<
        TextSlideElement,
        "fontSize" | "fontWeight" | "fontStyle" | "align" | "color"
      >
    >,
  ) => void;
  updateShapeElementStyle: (
    slideIndex: number,
    elementId: string,
    patch: Partial<
      Pick<
        ShapeSlideElement,
        "fill" | "stroke" | "strokeWidth" | "cornerRadius" | "opacity"
      >
    >,
  ) => void;
  removeElementFromSlide: (slideIndex: number, elementId: string) => void;
  duplicateElementOnSlide: (slideIndex: number, elementId: string) => void;
  pasteElementsOnSlide: (
    slideIndex: number,
    elements: SlideElement[],
  ) => string[];
  reorderElementLayer: (
    slideIndex: number,
    elementId: string,
    direction: "up" | "down",
  ) => void;
  reset: () => void;
}

function nextId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function toSlidesWithStableNumbers(slides: Slide[]): Slide[] {
  return slides.map((item, index) => ({
    ...item,
    slide_number: index + 1,
  }));
}

function withUpdatedSlide(
  presentation: Presentation,
  slideIndex: number,
  updater: (slide: Slide) => Slide,
): Presentation {
  const slides = [...presentation.slides];
  const slide = slides[slideIndex];
  if (!slide) {
    return presentation;
  }

  slides[slideIndex] = updater(slide);
  return {
    ...presentation,
    slides,
  };
}

function normalizeSceneElements<T extends SlideElementBase>(
  elements: T[],
): T[] {
  return elements.map((item, index) => ({ ...item, zIndex: index }));
}

function buildNewElement(type: string, zIndex: number): SlideElement {
  if (type === "list") {
    const element: ListSlideElement = {
      id: nextId("list"),
      type: "list",
      x: 180,
      y: 260,
      width: 980,
      height: 260,
      rotation: 0,
      zIndex,
      locked: false,
      visible: true,
      opacity: 1,
      ordered: false,
      items: ["Premier point", "Deuxieme point", "Troisieme point"],
      color: "#1e293b",
      fontSize: 30,
      fontFamily: "Geist Variable, sans-serif",
      fontWeight: 500,
      lineHeight: 1.3,
    };
    return element;
  }

  if (type === "table") {
    const element: TableSlideElement = {
      id: nextId("table"),
      type: "table",
      x: 160,
      y: 240,
      width: 1180,
      height: 420,
      rotation: 0,
      zIndex,
      locked: false,
      visible: true,
      opacity: 1,
      headers: ["Colonne A", "Colonne B", "Colonne C"],
      rows: [
        ["Ligne 1", "Valeur", "Notes"],
        ["Ligne 2", "Valeur", "Notes"],
      ],
      headerFill: "#e2e8f0",
      borderColor: "#94a3b8",
      textColor: "#0f172a",
      fontSize: 22,
    };
    return element;
  }

  if (type === "media") {
    const element: MediaSlideElement = {
      id: nextId("media"),
      type: "media",
      x: 220,
      y: 220,
      width: 680,
      height: 380,
      rotation: 0,
      zIndex,
      locked: false,
      visible: true,
      opacity: 1,
      mediaKind: "image",
      src: "",
      alt: "Image",
      fit: "cover",
      borderRadius: 24,
      background: "#cbd5e1",
    };
    return element;
  }

  if (type === "icon") {
    const element: IconSlideElement = {
      id: nextId("icon"),
      type: "icon",
      x: 260,
      y: 220,
      width: 96,
      height: 96,
      rotation: 0,
      zIndex,
      locked: false,
      visible: true,
      opacity: 1,
      iconName: "sparkles",
      color: "#0f172a",
      background: "#f1f5f9",
      fontSize: 44,
    };
    return element;
  }

  if (type === "chart") {
    const element: ChartSlideElement = {
      id: nextId("chart"),
      type: "chart",
      x: 170,
      y: 250,
      width: 1000,
      height: 400,
      rotation: 0,
      zIndex,
      locked: false,
      visible: true,
      opacity: 1,
      chartKind: "bar",
      labels: ["Q1", "Q2", "Q3", "Q4"],
      values: [32, 46, 59, 72],
      palette: ["#0f766e", "#0ea5e9", "#f59e0b", "#f97316"],
      strokeColor: "#0f172a",
    };
    return element;
  }

  if (type === "columns") {
    const element: ColumnsSlideElement = {
      id: nextId("columns"),
      type: "columns",
      x: 140,
      y: 260,
      width: 1220,
      height: 340,
      rotation: 0,
      zIndex,
      locked: false,
      visible: true,
      opacity: 1,
      columns: [
        ["Colonne 1", "Point A", "Point B"],
        ["Colonne 2", "Point A", "Point B"],
      ],
      gap: 24,
      titleColor: "#0f172a",
      textColor: "#334155",
    };
    return element;
  }

  const element: GroupSlideElement = {
    id: nextId("group"),
    type: "group",
    x: 150,
    y: 180,
    width: 820,
    height: 420,
    rotation: 0,
    zIndex,
    locked: false,
    visible: true,
    opacity: 1,
    label: "Groupe",
    borderColor: "#94a3b8",
    fill: "rgba(248,250,252,0.72)",
  };
  return element;
}

export const usePresentationStore = create<PresentationState>((set, get) => ({
  presentationId: null,
  presentation: null,
  presentations: [],
  loading: false,
  saving: false,
  dirty: false,
  error: null,

  generateAndCreate: async (topic: string, language?: string) => {
    set({ loading: true, error: null, presentation: null });
    try {
      const data = await generatePresentation(topic, language);
      const enriched: Presentation = {
        ...data,
        slides: data.slides.map((slide) => ({
          ...slide,
          editor_scene: {
            ...slide.editor_scene,
            elements: [...slide.editor_scene.elements],
          },
        })),
      };

      const visualTargets = enriched.slides
        .map((slide, index) => ({
          index,
          prompt: (slide.suggested_visual ?? "").trim(),
        }))
        .filter((target) => target.prompt.length > 0)
        .slice(0, 3);

      if (visualTargets.length > 0) {
        const imageResults = await Promise.allSettled(
          visualTargets.map((target) =>
            generateImageFromPrompt(
              `Professional presentation visual, high quality, realistic: ${target.prompt}`,
              "1536x1024",
            ),
          ),
        );

        imageResults.forEach((result, resultIndex) => {
          if (result.status !== "fulfilled") return;
          const target = visualTargets[resultIndex];
          const slide = enriched.slides[target.index];
          if (!slide) return;

          let mediaElement = slide.editor_scene.elements.find(
            (element) => element.type === "media",
          );

          if (!mediaElement) {
            mediaElement = createMediaElement(
              `media-auto-${target.index}`,
              slide.editor_scene.elements.length,
              {
                x: 820,
                y: 120,
                width: 680,
                height: 420,
                mediaKind: "image",
                src: "",
                alt: target.prompt,
                fit: "cover",
                borderRadius: 20,
                background: "#e2e8f0",
              },
            );
            slide.editor_scene.elements.push(mediaElement);
          }

          if (mediaElement.type !== "media") return;
          mediaElement.src = result.value.image_data_url;
          mediaElement.alt = target.prompt;
        });
      }

      const title = enriched.presentation_title || topic;
      const created = await createSavedPresentation(title, enriched);
      const presentations = await listSavedPresentations();
      set({
        presentation: created.presentation,
        presentationId: created.id,
        presentations,
        loading: false,
        dirty: false,
      });
      return created.id;
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.detail as string | undefined) ||
          err.message ||
          "La generation a echoue."
        : err instanceof Error
          ? err.message
          : "La generation a echoue.";
      set({ error: message, loading: false });
      return null;
    }
  },

  refreshUserPresentations: async () => {
    try {
      const presentations = await listSavedPresentations();
      set({ presentations });
    } catch {
      // L'UI reste stable meme si la synchronisation echoue.
    }
  },

  loadPresentationById: async (id) => {
    set({ loading: true, error: null });
    try {
      const loaded = await getSavedPresentation(id);
      set({
        presentationId: loaded.id,
        presentation: loaded.presentation,
        loading: false,
        dirty: false,
      });
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.detail as string | undefined) ||
          err.message ||
          "Chargement impossible."
        : err instanceof Error
          ? err.message
          : "Chargement impossible.";
      set({ error: message, loading: false });
    }
  },

  saveCurrentPresentation: async () => {
    const state = get();
    if (!state.presentation) return;

    set({ saving: true, error: null });
    try {
      const title = state.presentation.presentation_title || "Presentation";
      if (!state.presentationId) {
        const created = await createSavedPresentation(
          title,
          state.presentation,
        );
        const presentations = await listSavedPresentations();
        set({
          presentationId: created.id,
          presentation: created.presentation,
          presentations,
          saving: false,
          dirty: false,
        });
        return;
      }

      const updated = await updateSavedPresentation(
        state.presentationId,
        title,
        state.presentation,
      );
      const presentations = await listSavedPresentations();
      set({
        presentation: updated.presentation,
        presentations,
        saving: false,
        dirty: false,
      });
    } catch {
      set({
        saving: false,
        error:
          "Sauvegarde impossible pour le moment. Reconnexion ou nouvel essai automatique en attente.",
      });
    }
  },

  importPresentationFromJson: (json) => {
    try {
      const parsed = JSON.parse(json) as Presentation;
      if (!parsed || !Array.isArray(parsed.slides)) {
        return false;
      }

      const sanitizedSlides = parsed.slides.map((slide, index) => {
        const title = String(slide.title ?? `Slide ${index + 1}`);
        const purpose = String(slide.purpose ?? "");
        const mainContent = Array.isArray(slide.main_content)
          ? slide.main_content.map((item) => String(item ?? ""))
          : [];

        return {
          ...slide,
          slide_number: index + 1,
          title,
          purpose,
          main_content: mainContent,
          speaker_notes: String(slide.speaker_notes ?? ""),
          editor_scene: ensureFixedBackgroundShape(
            slide.editor_scene ??
              createEditorSceneFromSlide(
                {
                  slide_number: index + 1,
                  slide_type: slide.slide_type ?? "content",
                  semantic_type: slide.semantic_type ?? "content.paragraph",
                  layout_variant: slide.layout_variant ?? "text-left-accent",
                  density: slide.density ?? "balanced",
                  title,
                  purpose,
                  content_format: slide.content_format ?? "paragraph",
                  main_content: mainContent,
                  speaker_notes: String(slide.speaker_notes ?? ""),
                  suggested_visual: slide.suggested_visual ?? null,
                  transition_to_next: String(slide.transition_to_next ?? ""),
                  editor_scene: {
                    version: "1.0",
                    width: 1600,
                    height: 900,
                    background: "#ffffff",
                    elements: [],
                  },
                },
                index,
              ),
          ),
        };
      });

      set((state) => ({
        ...state,
        dirty: true,
        presentation: {
          ...parsed,
          slides: sanitizedSlides,
        },
      }));
      return true;
    } catch {
      return false;
    }
  },

  addSlideAfter: (slideIndex) => {
    set((state) => {
      if (!state.presentation) return state;
      const presentation = state.presentation;
      const slides = [...presentation.slides];

      const base = slides[slideIndex] ?? slides[0];
      if (!base) return state;

      const nextIndex = slideIndex + 1;
      const newTitle = `Nouvelle slide ${slides.length + 1}`;
      const draftSlide: Slide = {
        ...base,
        title: newTitle,
        purpose: "Ajoutez votre contenu",
        main_content: ["Nouveau point"],
        speaker_notes: "",
        semantic_type: "content.paragraph",
        layout_variant: "text-left-accent",
        content_format: "paragraph",
      };
      const newSlide: Slide = {
        ...draftSlide,
        editor_scene: createEditorSceneFromSlide(draftSlide, nextIndex),
      };

      slides.splice(slideIndex + 1, 0, newSlide);

      return {
        ...state,
        dirty: true,
        presentation: {
          ...presentation,
          slides: toSlidesWithStableNumbers(slides),
        },
      };
    });
  },

  removeSlide: (slideIndex) => {
    set((state) => {
      if (!state.presentation) return state;
      const presentation = state.presentation;
      if (presentation.slides.length <= 1) return state;

      const slides = presentation.slides.filter(
        (_, index) => index !== slideIndex,
      );

      return {
        ...state,
        dirty: true,
        presentation: {
          ...presentation,
          slides: toSlidesWithStableNumbers(slides),
        },
      };
    });
  },

  updateSpeakerNotes: (slideIndex, nextNotes) => {
    set((state) => {
      if (!state.presentation) return state;
      const presentation = state.presentation;
      const slides = [...presentation.slides];
      const slide = slides[slideIndex];
      if (!slide) return state;
      slides[slideIndex] = {
        ...slide,
        speaker_notes: nextNotes,
      };
      return {
        ...state,
        dirty: true,
        presentation: {
          ...presentation,
          slides,
        },
      };
    });
  },

  addTextElementToSlide: (slideIndex, text) => {
    set((state) => {
      if (!state.presentation) return state;
      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const rawText = (text ?? "Nouveau texte").trim() || "Nouveau texte";
          const estimatedWidth = Math.min(
            980,
            Math.max(220, Math.round(rawText.length * 22 + 80)),
          );
          const newElement: TextSlideElement = {
            id: nextId("text"),
            type: "text",
            x: 180,
            y: 180,
            width: estimatedWidth,
            height: 80,
            rotation: 0,
            zIndex: scene.elements.length,
            locked: false,
            visible: true,
            opacity: 1,
            text: rawText,
            color: "#0f172a",
            fontSize: 34,
            fontFamily: "Geist Variable, sans-serif",
            fontWeight: 600,
            fontStyle: "normal",
            align: "left",
            lineHeight: 1.25,
          };

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements: normalizeSceneElements([...scene.elements, newElement]),
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  addShapeElementToSlide: (slideIndex, shape = "rect") => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const newElement: ShapeSlideElement = {
            id: nextId("shape"),
            type: "shape",
            shape,
            x: 240,
            y: 220,
            width: 320,
            height: 200,
            rotation: 0,
            zIndex: scene.elements.length,
            locked: false,
            visible: true,
            opacity: 1,
            fill: "#ffffff",
            stroke: "#94a3b8",
            strokeWidth: 1.5,
            cornerRadius: shape === "rect" ? 18 : 0,
            label: "",
            textColor: "#0f172a",
            fontSize: 28,
            fontWeight: 600,
            textAlign: "center",
          };

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements: normalizeSceneElements([...scene.elements, newElement]),
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  addElementToSlide: (slideIndex, type) => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const newElement = buildNewElement(type, scene.elements.length);

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements: normalizeSceneElements([...scene.elements, newElement]),
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  addGeneratedImageToSlide: (slideIndex, src, alt) => {
    let insertedId: string | null = null;

    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const baseElement = buildNewElement("media", scene.elements.length);
          if (baseElement.type !== "media") {
            return slide;
          }

          insertedId = nextId("media");
          const mediaElement: MediaSlideElement = {
            ...baseElement,
            id: insertedId,
            mediaKind: "image",
            src,
            alt: alt?.trim() || "Image generee",
          };

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements: normalizeSceneElements([
                ...scene.elements,
                mediaElement,
              ]),
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });

    return insertedId;
  },

  applyTemplateToSlide: (slideIndex, template) => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => ({
          ...slide,
          editor_scene: ensureFixedBackgroundShape(
            createSceneFromTemplate(template),
          ),
        }),
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  updateElementGeometry: (slideIndex, elementId, patch) => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const elements = scene.elements.map((element) => {
            if (element.id !== elementId || element.locked) {
              return element;
            }

            return {
              ...element,
              x: patch.x ?? element.x,
              y: patch.y ?? element.y,
              width: Math.max(16, patch.width ?? element.width),
              height: Math.max(16, patch.height ?? element.height),
              rotation: patch.rotation ?? element.rotation,
              opacity: patch.opacity ?? element.opacity,
            };
          });

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements,
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  updateElementStyle: (slideIndex, elementId, patch) => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const elements = scene.elements.map((element) => {
            if (element.id !== elementId) {
              return element;
            }

            const isFixedBackground =
              element.type === "shape" && element.id === FIXED_BG_ELEMENT_ID;
            if (element.locked && !isFixedBackground) {
              return element;
            }

            if (isFixedBackground) {
              const next: SlideElement = {
                ...element,
                fill:
                  typeof patch.fill === "string" ? patch.fill : element.fill,
                opacity:
                  typeof patch.opacity === "number"
                    ? patch.opacity
                    : element.opacity,
              };
              return next;
            }

            return {
              ...element,
              ...patch,
            } as SlideElement;
          });

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements,
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  alignElementsOnSlide: (slideIndex, elementIds, mode) => {
    set((state) => {
      if (!state.presentation || elementIds.length < 2) return state;

      const ids = new Set(elementIds);
      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const selected = scene.elements.filter(
            (element) => ids.has(element.id) && !element.locked,
          );
          if (selected.length < 2) return slide;

          const minX = Math.min(...selected.map((element) => element.x));
          const maxX = Math.max(
            ...selected.map((element) => element.x + element.width),
          );
          const minY = Math.min(...selected.map((element) => element.y));
          const maxY = Math.max(
            ...selected.map((element) => element.y + element.height),
          );
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          const elements = scene.elements.map((element) => {
            if (!ids.has(element.id) || element.locked) return element;

            if (mode === "left") return { ...element, x: minX };
            if (mode === "center") {
              return { ...element, x: Math.round(centerX - element.width / 2) };
            }
            if (mode === "right") {
              return { ...element, x: Math.round(maxX - element.width) };
            }
            if (mode === "top") return { ...element, y: minY };
            if (mode === "middle") {
              return {
                ...element,
                y: Math.round(centerY - element.height / 2),
              };
            }
            return { ...element, y: Math.round(maxY - element.height) };
          });

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements,
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  distributeElementsOnSlide: (slideIndex, elementIds, axis) => {
    set((state) => {
      if (!state.presentation || elementIds.length < 3) return state;

      const ids = new Set(elementIds);
      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const selected = scene.elements
            .filter((element) => ids.has(element.id) && !element.locked)
            .sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y));
          if (selected.length < 3) return slide;

          const first = selected[0];
          const last = selected[selected.length - 1];
          const totalSize = selected.reduce(
            (sum, element) =>
              sum + (axis === "horizontal" ? element.width : element.height),
            0,
          );
          const span =
            axis === "horizontal"
              ? last.x + last.width - first.x
              : last.y + last.height - first.y;
          const gap = (span - totalSize) / (selected.length - 1);

          let cursor = axis === "horizontal" ? first.x : first.y;
          const nextPositions = new Map<string, { x?: number; y?: number }>();

          selected.forEach((element, index) => {
            if (index === 0) {
              cursor +=
                (axis === "horizontal" ? element.width : element.height) + gap;
              return;
            }
            if (axis === "horizontal") {
              nextPositions.set(element.id, { x: Math.round(cursor) });
              cursor += element.width + gap;
            } else {
              nextPositions.set(element.id, { y: Math.round(cursor) });
              cursor += element.height + gap;
            }
          });

          const elements = scene.elements.map((element) => {
            const patch = nextPositions.get(element.id);
            if (!patch) return element;
            return {
              ...element,
              ...patch,
            };
          });

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements,
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  updateSceneBackground: (slideIndex, background) => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => ({
          ...slide,
          editor_scene: {
            ...slide.editor_scene,
            background,
          },
        }),
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  updateTextElementContent: (slideIndex, elementId, text) => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const elements = scene.elements.map((element) => {
            if (element.id !== elementId) {
              return element;
            }

            if (element.type === "text") {
              return {
                ...element,
                text,
              };
            }

            if (element.type === "shape") {
              return {
                ...element,
                label: text,
              };
            }

            return {
              ...element,
            };
          });

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements,
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  updateTextElementStyle: (slideIndex, elementId, patch) => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const elements = scene.elements.map((element) => {
            if (element.id !== elementId || element.type !== "text") {
              return element;
            }
            return {
              ...element,
              ...patch,
            };
          });

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements,
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  updateShapeElementStyle: (slideIndex, elementId, patch) => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const elements = scene.elements.map((element) => {
            if (element.id !== elementId || element.type !== "shape") {
              return element;
            }
            return {
              ...element,
              ...patch,
            };
          });

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements,
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  removeElementFromSlide: (slideIndex, elementId) => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const target = scene.elements.find(
            (element) => element.id === elementId,
          );
          if (!target || target.locked) {
            return slide;
          }
          const elements = normalizeSceneElements(
            scene.elements.filter((element) => element.id !== elementId),
          );

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements,
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  duplicateElementOnSlide: (slideIndex, elementId) => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const source = scene.elements.find(
            (element) => element.id === elementId,
          );
          if (!source || source.locked) {
            return slide;
          }

          const duplicate = {
            ...source,
            id: nextId(source.type),
            x: source.x + 24,
            y: source.y + 24,
            zIndex: scene.elements.length,
          } as SlideElement;

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements: normalizeSceneElements([...scene.elements, duplicate]),
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  pasteElementsOnSlide: (slideIndex, elementsToPaste) => {
    let insertedIds: string[] = [];

    set((state) => {
      if (!state.presentation || elementsToPaste.length === 0) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const allowedElements = elementsToPaste.filter(
            (element) => !element.locked,
          );
          if (allowedElements.length === 0) {
            return slide;
          }
          const startZIndex = scene.elements.length;

          const pastedElements = allowedElements.map((element, index) => {
            const clone = JSON.parse(JSON.stringify(element)) as SlideElement;
            const id = nextId(clone.type);
            insertedIds.push(id);

            return {
              ...clone,
              id,
              x: clone.x + 24,
              y: clone.y + 24,
              zIndex: startZIndex + index,
            } as SlideElement;
          });

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements: normalizeSceneElements([
                ...scene.elements,
                ...pastedElements,
              ]),
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });

    return insertedIds;
  },

  reorderElementLayer: (slideIndex, elementId, direction) => {
    set((state) => {
      if (!state.presentation) return state;

      const presentation = withUpdatedSlide(
        state.presentation,
        slideIndex,
        (slide) => {
          const scene = slide.editor_scene;
          const ordered = [...scene.elements].sort(
            (a, b) => a.zIndex - b.zIndex,
          );
          const index = ordered.findIndex(
            (element) => element.id === elementId,
          );
          if (index < 0) {
            return slide;
          }

          const targetIndex =
            direction === "up"
              ? Math.min(ordered.length - 1, index + 1)
              : Math.max(0, index - 1);
          if (targetIndex === index) {
            return slide;
          }

          const [item] = ordered.splice(index, 1);
          ordered.splice(targetIndex, 0, item);

          return {
            ...slide,
            editor_scene: {
              ...scene,
              elements: normalizeSceneElements(ordered),
            },
          };
        },
      );

      return {
        ...state,
        dirty: true,
        presentation,
      };
    });
  },

  reset: () =>
    set({
      presentationId: null,
      presentation: null,
      presentations: [],
      loading: false,
      saving: false,
      dirty: false,
      error: null,
    }),
}));

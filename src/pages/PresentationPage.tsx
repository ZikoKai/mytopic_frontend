import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { parseAsInteger, useQueryState } from "nuqs";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUpDown,
  BarChart3,
  Bold,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Ellipsis,
  Italic,
  Download,
  Layers,
  Link2,
  Loader2,
  Minus,
  PanelsLeftRight,
  Palette,
  Plus,
  Share2,
  Square,
  Table,
  StickyNote,
  Trash2,
  Type,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { exportToPdf, exportToPptx } from "@/services/exportPresentation";

import { Button } from "@/components/ui/button";
import { UserProfileMenu } from "@/components/auth/UserProfileMenu";
import {
  TEMPLATE_OPTIONS,
  type EditorTemplateType,
} from "@/editor/slideTemplates";
import { ZoomControls } from "@/editor/ZoomControls";
import { SLIDE_ASPECT_RATIO } from "@/presentation/primitives";
import { cn } from "@/lib/utils";
import {
  deleteFavoriteImageAsset,
  generateImageFromPrompt,
  listFavoriteImageAssets,
  saveFavoriteImageAsset,
  type FavoriteImageAsset,
} from "@/services/api";
import { usePresentationStore } from "@/store/presentationStore";
import type { SlideElement } from "@/services/api";

const SlideEditorCanvas = lazy(() =>
  import("@/editor/SlideEditorCanvas").then((mod) => ({
    default: mod.SlideEditorCanvas,
  })),
);

const THUMB_ITEM_SIZE = 124;
type SidebarMode = "templates" | "elements" | "uploads";

export default function PresentationPage() {
  const LAST_PRESENTATION_KEY = "mytopic_last_presentation_id";
  const navigate = useNavigate();
  const { presentationId: routePresentationId = "" } = useParams<{
    presentationId?: string;
  }>();

  const {
    presentationId,
    presentation,
    presentations,
    loading,
    saving,
    dirty,
    error,
    refreshUserPresentations,
    loadPresentationById,
    saveCurrentPresentation,
    addSlideAfter,
    removeSlide,
    updateSpeakerNotes,
    addTextElementToSlide,
    addShapeElementToSlide,
    addElementToSlide,
    addGeneratedImageToSlide,
    applyTemplateToSlide,
    updateElementGeometry,
    updateElementStyle,
    updateTextElementContent,
    removeElementFromSlide,
    pasteElementsOnSlide,
  } = usePresentationStore();

  const [slideParam, setSlideParam] = useQueryState(
    "slide",
    parseAsInteger.withDefault(0),
  );
  const [menuParam, setMenuParam] = useQueryState("menu");
  const [showNotes, setShowNotes] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "pptx" | null>(null);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageSize, setImageSize] = useState<
    "1024x1024" | "1024x1536" | "1536x1024"
  >("1024x1024");
  const [imageGenerating, setImageGenerating] = useState(false);
  const [lastGeneratedImage, setLastGeneratedImage] = useState<{
    dataUrl: string;
    prompt: string;
    mimeType: string;
  } | null>(null);
  const [uploads, setUploads] = useState<FavoriteImageAsset[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [workspaceZoom, setWorkspaceZoom] = useState(1);
  const [openSlideMenuIndex, setOpenSlideMenuIndex] = useState<number | null>(
    null,
  );
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<EditorTemplateType>("title-content");
  const [thumbViewport, setThumbViewport] = useState({
    scrollLeft: 0,
    width: 0,
  });
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({
    common: false,
    text: false,
    shape: false,
  });

  const activeSidebarMode: SidebarMode | null =
    menuParam === "templates" ||
    menuParam === "elements" ||
    menuParam === "uploads"
      ? menuParam
      : null;

  const pendingRouteLoadRef = useRef<string | null>(null);
  const clipboardElementsRef = useRef<SlideElement[]>([]);
  const thumbnailsScrollRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const slides = presentation?.slides ?? [];
  const safeCurrentSlide = Math.min(
    Math.max(slideParam, 0),
    Math.max(slides.length - 1, 0),
  );
  const slide = slides[safeCurrentSlide];
  const scene = slide?.editor_scene;

  const selectedElementId =
    selectedElementIds[selectedElementIds.length - 1] ?? null;

  const selectedElement = useMemo<SlideElement | null>(() => {
    if (!scene || !selectedElementId) return null;
    return (
      scene.elements.find((element) => element.id === selectedElementId) ?? null
    );
  }, [scene, selectedElementId]);

  const selectedTextElement = useMemo(
    () =>
      selectedElement &&
      (selectedElement.type === "text" || selectedElement.type === "list")
        ? selectedElement
        : null,
    [selectedElement],
  );

  const selectedShapeElement = useMemo(
    () =>
      selectedElement && selectedElement.type === "shape"
        ? selectedElement
        : null,
    [selectedElement],
  );

  const selectedMediaElement = useMemo(
    () =>
      selectedElement && selectedElement.type === "media"
        ? selectedElement
        : null,
    [selectedElement],
  );

  const adjustSelectedStyle = (patch: Record<string, unknown>) => {
    if (!selectedElementId) return;
    updateElementStyle(safeCurrentSlide, selectedElementId, patch);
  };

  const toggleToolbarGroup = (groupKey: "common" | "text" | "shape") => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  };

  const adjustFontSize = (delta: number) => {
    if (!selectedTextElement) return;
    adjustSelectedStyle({
      fontSize: Math.max(
        8,
        Math.min(220, selectedTextElement.fontSize + delta),
      ),
    });
  };

  const adjustLineHeight = (delta: number) => {
    if (!selectedTextElement) return;
    adjustSelectedStyle({
      lineHeight: Math.max(
        1,
        Math.min(
          2.6,
          Number((selectedTextElement.lineHeight + delta).toFixed(2)),
        ),
      ),
    });
  };

  const copySelectedElements = () => {
    if (!scene || selectedElementIds.length === 0) return false;

    const selectedSet = new Set(selectedElementIds);
    const copied = scene.elements
      .filter((element) => selectedSet.has(element.id))
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((element) => JSON.parse(JSON.stringify(element)) as SlideElement);

    if (copied.length === 0) return false;
    clipboardElementsRef.current = copied;
    return true;
  };

  const pasteCopiedElements = () => {
    if (!scene || clipboardElementsRef.current.length === 0) return false;
    const insertedIds = pasteElementsOnSlide(
      safeCurrentSlide,
      clipboardElementsRef.current,
    );
    if (insertedIds.length === 0) return false;
    setSelectedElementIds(insertedIds);
    return true;
  };

  const deleteSelectedElements = () => {
    if (selectedElementIds.length === 0) return;
    selectedElementIds.forEach((id) => {
      removeElementFromSlide(safeCurrentSlide, id);
    });
    setSelectedElementIds([]);
  };

  const applyTemplateFromMenu = (template: EditorTemplateType) => {
    setSelectedTemplate(template);
    applyTemplateToSlide(safeCurrentSlide, template);
    setSelectedElementIds([]);
  };

  const handleGenerateImage = async () => {
    const prompt = imagePrompt.trim();
    if (!prompt || imageGenerating) return;

    setImageGenerating(true);
    try {
      const generated = await generateImageFromPrompt(prompt, imageSize);
      setLastGeneratedImage({
        dataUrl: generated.image_data_url,
        prompt,
        mimeType: generated.mime_type,
      });

      if (selectedMediaElement) {
        updateElementStyle(safeCurrentSlide, selectedMediaElement.id, {
          mediaKind: "image",
          src: generated.image_data_url,
          alt: prompt,
        });
        setSelectedElementIds([selectedMediaElement.id]);
      } else {
        const insertedId = addGeneratedImageToSlide(
          safeCurrentSlide,
          generated.image_data_url,
          prompt,
        );
        if (insertedId) {
          setSelectedElementIds([insertedId]);
        }
      }

      toast.success("Image generee et ajoutee a la slide.");
      setShowImageMenu(false);
    } catch (cause) {
      const message =
        cause instanceof Error && cause.message
          ? cause.message
          : "Echec de generation de l'image.";
      toast.error(message);
    } finally {
      setImageGenerating(false);
    }
  };

  const loadUploads = async () => {
    setLoadingUploads(true);
    try {
      const data = await listFavoriteImageAssets();
      setUploads(data);
    } catch {
      toast.error("Impossible de charger les favoris image.");
    } finally {
      setLoadingUploads(false);
    }
  };

  const saveCurrentGeneratedToFavorites = async () => {
    if (!lastGeneratedImage || savingFavorite) return;
    setSavingFavorite(true);
    try {
      const asset = await saveFavoriteImageAsset({
        title: lastGeneratedImage.prompt.slice(0, 80),
        prompt: lastGeneratedImage.prompt,
        image_data_url: lastGeneratedImage.dataUrl,
        mime_type: lastGeneratedImage.mimeType,
      });
      setUploads((prev) => [asset, ...prev]);
      toast.success("Image ajoutee aux favoris.");
    } catch {
      toast.error("Impossible de sauvegarder l'image en favoris.");
    } finally {
      setSavingFavorite(false);
    }
  };

  const insertFavoriteImageInSlide = (asset: FavoriteImageAsset) => {
    if (selectedMediaElement) {
      updateElementStyle(safeCurrentSlide, selectedMediaElement.id, {
        mediaKind: "image",
        src: asset.image_data_url,
        alt: asset.prompt || asset.title,
      });
      setSelectedElementIds([selectedMediaElement.id]);
      return;
    }

    const insertedId = addGeneratedImageToSlide(
      safeCurrentSlide,
      asset.image_data_url,
      asset.prompt || asset.title,
    );
    if (insertedId) {
      setSelectedElementIds([insertedId]);
    }
  };

  const removeFavorite = async (assetId: string) => {
    try {
      await deleteFavoriteImageAsset(assetId);
      setUploads((prev) => prev.filter((item) => item.id !== assetId));
      toast.success("Image favorite supprimee.");
    } catch {
      toast.error("Suppression impossible.");
    }
  };

  const buildShareUrl = () => {
    if (typeof window === "undefined") return "";
    const baseId = presentationId || routePresentationId;
    if (!baseId) return window.location.href;
    return `${window.location.origin}/presentation/${baseId}`;
  };

  const [linkCopied, setLinkCopied] = useState(false);
  const [exportDone, setExportDone] = useState<"pdf" | "pptx" | null>(null);

  const handleCopyPublicLink = async () => {
    try {
      const url = buildShareUrl();
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!presentation || presentation.slides.length === 0) {
      toast.error("Aucune slide a exporter.");
      return;
    }
    const originalSlide = safeCurrentSlide;
    setExporting("pdf");
    setExportDone(null);
    setSelectedElementIds([]);
    try {
      await exportToPdf(
        presentation,
        (i) => void setSlideParam(i),
      );
      setExportDone("pdf");
      setTimeout(() => setExportDone(null), 3000);
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Echec de generation du fichier PDF.");
    } finally {
      setExporting(null);
      void setSlideParam(originalSlide);
    }
  };

  const handleDownloadPowerPoint = async () => {
    if (!presentation || presentation.slides.length === 0) {
      toast.error("Aucune slide a exporter.");
      return;
    }
    const originalSlide = safeCurrentSlide;
    setExporting("pptx");
    setExportDone(null);
    setSelectedElementIds([]);
    try {
      await exportToPptx(
        presentation,
        (i) => void setSlideParam(i),
      );
      setExportDone("pptx");
      setTimeout(() => setExportDone(null), 3000);
    } catch (err) {
      console.error("PPTX export error:", err);
      toast.error("Echec de generation du fichier PowerPoint.");
    } finally {
      setExporting(null);
      void setSlideParam(originalSlide);
    }
  };

  const toggleSidebarMode = (mode: SidebarMode) => {
    void setMenuParam(activeSidebarMode === mode ? null : mode);
  };

  const elementShortcuts: Array<{
    key: string;
    label: string;
    icon: typeof Type;
    onClick: () => void;
  }> = [
    {
      key: "text",
      label: "Texte",
      icon: Type,
      onClick: () => addTextElementToSlide(safeCurrentSlide, "Nouveau texte"),
    },
    {
      key: "rect",
      label: "Rectangle",
      icon: Square,
      onClick: () => addShapeElementToSlide(safeCurrentSlide, "rect"),
    },
    {
      key: "circle",
      label: "Cercle",
      icon: Circle,
      onClick: () => addShapeElementToSlide(safeCurrentSlide, "ellipse"),
    },
    {
      key: "list",
      label: "Liste",
      icon: AlignLeft,
      onClick: () => addElementToSlide(safeCurrentSlide, "list"),
    },
    {
      key: "table",
      label: "Tableau",
      icon: Table,
      onClick: () => addElementToSlide(safeCurrentSlide, "table"),
    },
    {
      key: "media",
      label: "Media",
      icon: ImageIcon,
      onClick: () => addElementToSlide(safeCurrentSlide, "media"),
    },
    {
      key: "chart",
      label: "Graphique",
      icon: BarChart3,
      onClick: () => addElementToSlide(safeCurrentSlide, "chart"),
    },
    {
      key: "columns",
      label: "Colonnes",
      icon: PanelsLeftRight,
      onClick: () => addElementToSlide(safeCurrentSlide, "columns"),
    },
  ];

  const virtualWindow = useMemo(() => {
    const total = slides.length;
    if (total === 0) {
      return {
        start: 0,
        end: 0,
        prefix: 0,
        suffix: 0,
      };
    }

    const viewportWidth = thumbViewport.width || 760;
    const visibleCount = Math.max(
      1,
      Math.ceil(viewportWidth / THUMB_ITEM_SIZE),
    );
    let start = Math.max(
      0,
      Math.floor(thumbViewport.scrollLeft / THUMB_ITEM_SIZE) - 6,
    );
    let end = Math.min(total, start + visibleCount + 12);

    start = Math.max(0, Math.min(start, Math.max(0, safeCurrentSlide - 3)));
    end = Math.min(total, Math.max(end, safeCurrentSlide + 4));

    return {
      start,
      end,
      prefix: start * THUMB_ITEM_SIZE,
      suffix: Math.max(0, (total - end) * THUMB_ITEM_SIZE),
    };
  }, [
    safeCurrentSlide,
    slides.length,
    thumbViewport.scrollLeft,
    thumbViewport.width,
  ]);

  // Close menus on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (showExportMenu && !target.closest('[data-export-menu="true"]')) {
        setShowExportMenu(false);
      }
      if (showImageMenu && !target.closest('[data-image-menu="true"]')) {
        setShowImageMenu(false);
      }
      if (
        openSlideMenuIndex !== null &&
        !target.closest('[data-slide-menu="true"]')
      ) {
        setOpenSlideMenuIndex(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu, showImageMenu, openSlideMenuIndex]);

  useEffect(() => {
    void refreshUserPresentations();
  }, [refreshUserPresentations]);

  useEffect(() => {
    if (activeSidebarMode === "uploads") {
      void loadUploads();
    }
  }, [activeSidebarMode]);

  useEffect(() => {
    if (presentationId) {
      localStorage.setItem(LAST_PRESENTATION_KEY, presentationId);
    }
  }, [presentationId]);

  useEffect(() => {
    if (routePresentationId) return;
    const last = localStorage.getItem(LAST_PRESENTATION_KEY);
    if (!last) return;
    navigate(`/presentation/${last}?slide=0`, { replace: true });
    void setSlideParam(0);
  }, [navigate, routePresentationId, setSlideParam]);

  useEffect(() => {
    if (!routePresentationId) return;
    if (presentationId === routePresentationId && presentation) {
      pendingRouteLoadRef.current = null;
      return;
    }
    if (pendingRouteLoadRef.current === routePresentationId) return;

    pendingRouteLoadRef.current = routePresentationId;
    void loadPresentationById(routePresentationId).finally(() => {
      if (pendingRouteLoadRef.current === routePresentationId) {
        pendingRouteLoadRef.current = null;
      }
    });
  }, [loadPresentationById, presentation, presentationId, routePresentationId]);

  useEffect(() => {
    if (!presentation || !dirty || loading || saving) return;
    const timeout = window.setTimeout(() => {
      void saveCurrentPresentation();
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [dirty, loading, presentation, saveCurrentPresentation, saving]);

  useEffect(() => {
    const flushIfDirty = () => {
      const state = usePresentationStore.getState();
      if (state.dirty && !state.saving) {
        void state.saveCurrentPresentation();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushIfDirty();
      }
    };

    const onBeforeUnload = () => {
      flushIfDirty();
    };

    const onOnline = () => {
      const state = usePresentationStore.getState();
      if (state.dirty && !state.saving) {
        void state.saveCurrentPresentation();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!presentation) return;
      const target = event.target as HTMLElement | null;
      const isTypingContext =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (isTypingContext) return;

      if (event.key === "Home") {
        void setSlideParam(0);
      }
      if (event.key === "End") {
        void setSlideParam(Math.max(0, presentation.slides.length - 1));
      }
      if (event.key === "ArrowRight") {
        void setSlideParam(
          Math.min(presentation.slides.length - 1, safeCurrentSlide + 1),
        );
      }
      if (event.key === "ArrowLeft") {
        void setSlideParam(Math.max(0, safeCurrentSlide - 1));
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        if (copySelectedElements()) {
          event.preventDefault();
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        if (pasteCopiedElements()) {
          event.preventDefault();
        }
        return;
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedElementIds.length > 0
      ) {
        event.preventDefault();
        deleteSelectedElements();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    presentation,
    pasteElementsOnSlide,
    removeElementFromSlide,
    safeCurrentSlide,
    scene,
    selectedElementIds,
    setSlideParam,
  ]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  useEffect(() => {
    setSelectedElementIds((current) => {
      if (!scene) return [];
      const ids = new Set(scene.elements.map((element) => element.id));
      return current.filter((id) => ids.has(id));
    });
  }, [scene]);

  useEffect(() => {
    const container = thumbnailsScrollRef.current;
    if (!container) return;

    const updateViewport = () => {
      setThumbViewport({
        scrollLeft: container.scrollLeft,
        width: container.clientWidth,
      });
    };

    updateViewport();
    container.addEventListener("scroll", updateViewport, { passive: true });
    window.addEventListener("resize", updateViewport);

    return () => {
      container.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, [slides.length]);

  useEffect(() => {
    const container = thumbnailsScrollRef.current;
    const activeThumb = thumbnailRefs.current[safeCurrentSlide];
    if (!container) return;

    if (!activeThumb) {
      const targetLeft = Math.max(
        0,
        safeCurrentSlide * THUMB_ITEM_SIZE - container.clientWidth / 2,
      );
      container.scrollTo({ left: targetLeft, behavior: "auto" });
      return;
    }

    const edgePadding = 12;
    const itemLeft = activeThumb.offsetLeft;
    const itemRight = itemLeft + activeThumb.offsetWidth;
    const visibleLeft = container.scrollLeft + edgePadding;
    const visibleRight =
      container.scrollLeft + container.clientWidth - edgePadding;

    let desiredLeft: number | null = null;
    if (itemLeft < visibleLeft) {
      desiredLeft = itemLeft - edgePadding;
    } else if (itemRight > visibleRight) {
      desiredLeft = itemRight - container.clientWidth + edgePadding;
    }

    if (desiredLeft === null) return;

    const maxScrollLeft = Math.max(
      0,
      container.scrollWidth - container.clientWidth,
    );
    const targetLeft = Math.max(0, Math.min(maxScrollLeft, desiredLeft));

    if (Math.abs(container.scrollLeft - targetLeft) < 1) return;

    container.scrollTo({ left: targetLeft, behavior: "auto" });
  }, [safeCurrentSlide, virtualWindow.end, virtualWindow.start]);

  if (!presentation) {
    if (loading && routePresentationId) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">
            Chargement de la presentation...
          </p>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Layers className="size-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Aucune presentation
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Generez une presentation pour la visualiser ici.
            </p>
          </div>
          <Button
            onClick={() => navigate("/generate")}
            className="px-6 py-5 rounded-xl font-semibold text-sm shadow-lg shadow-primary/15 cursor-pointer"
          >
            Generer une presentation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-200/60 flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between px-5 md:px-8 h-14 border-b border-border/40 bg-background z-10">
        <div className="flex items-center gap-6">
          <div
            className="flex items-center gap-2.5 cursor-pointer px-1 py-1"
            onClick={() => navigate("/")}
          >
            <div className="size-9 rounded-lg bg-primary flex items-center justify-center">
              <Layers className="size-3.5 text-primary-foreground" />
            </div>
            <span className="text-base font-semibold italic tracking-tight">
              MyTopic
            </span>
          </div>

          <div className="h-5 w-px bg-border/50 hidden md:block" />

          <select
            value={presentationId ?? ""}
            onChange={(event) => {
              const id = event.target.value;
              if (!id) return;
              navigate(`/presentation/${id}?slide=0`);
              void setSlideParam(0);
            }}
            className="hidden md:block h-9 min-w-70 rounded-lg border border-border/60 bg-background px-3 text-sm font-medium text-foreground"
          >
            <option value="">Selectionner une presentation</option>
            {presentations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" data-image-menu="true">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-lg cursor-pointer text-sm px-3 py-2 h-auto"
              onClick={() => setShowImageMenu((value) => !value)}
            >
              <ImageIcon className="size-4" />
              <span className="hidden md:inline">Image IA</span>
            </Button>

            {showImageMenu && (
              <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-border/50 bg-background shadow-sm p-2.5 space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  Generer une image depuis un prompt
                </p>
                <textarea
                  value={imagePrompt}
                  onChange={(event) => setImagePrompt(event.target.value)}
                  rows={3}
                  placeholder="Ex: Illustration moderne sur l'energie solaire"
                  className="w-full resize-none rounded-lg border border-border/70 bg-background px-2.5 py-2 text-xs text-foreground outline-none focus-visible:border-ring"
                />

                <div className="flex items-center gap-2">
                  <select
                    value={imageSize}
                    onChange={(event) =>
                      setImageSize(
                        event.target.value as
                          | "1024x1024"
                          | "1024x1536"
                          | "1536x1024",
                      )
                    }
                    className="h-8 rounded-md border border-border/70 bg-background px-2 text-xs text-foreground"
                  >
                    <option value="1024x1024">Carre 1024</option>
                    <option value="1536x1024">Paysage 1536x1024</option>
                    <option value="1024x1536">Portrait 1024x1536</option>
                  </select>

                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs font-semibold"
                    onClick={() => void handleGenerateImage()}
                    disabled={
                      imageGenerating || imagePrompt.trim().length === 0
                    }
                  >
                    {imageGenerating ? "Generation..." : "Generer"}
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Si un element media est selectionne, il sera remplace. Sinon,
                  un nouvel element image est ajoute automatiquement.
                </p>

                {lastGeneratedImage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs font-semibold"
                    onClick={() => void saveCurrentGeneratedToFavorites()}
                    disabled={savingFavorite}
                  >
                    {savingFavorite
                      ? "Sauvegarde..."
                      : "Enregistrer dans favoris"}
                  </Button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowNotes((v) => !v)}
            className={cn(
              "hidden md:flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
              showNotes
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <StickyNote className="size-4" />
            Notes
          </button>

          <div className="relative" data-export-menu="true">
            <Button
              variant="default"
              size="sm"
              className="gap-2 rounded-lg cursor-pointer font-semibold text-sm px-4 py-2 h-auto bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/20"
              onClick={() => setShowExportMenu((value) => !value)}
            >
              <Share2 className="size-4" />
              <span className="inline">Partager</span>
            </Button>

            {showExportMenu && (
              <div className="absolute right-0 top-10 z-50 w-72 rounded-lg border border-border/50 bg-background shadow-sm p-2.5">
                <div className="mb-2">
                  <p className="text-sm font-semibold text-foreground">
                    Partager la presentation
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Lien public ou telechargement.
                  </p>
                </div>

                <button
                  onClick={() => void handleCopyPublicLink()}
                  className="flex w-full items-center gap-2.5 rounded-md border border-primary/20 bg-primary/8 px-2.5 py-2 text-left transition-colors hover:bg-primary/15"
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Link2 className="size-3.5" />
                  </span>
                  <span className="flex flex-col flex-1">
                    <span className="text-[13px] font-semibold text-foreground">
                      Copier le lien public
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Partager avec votre audience.
                    </span>
                  </span>
                  {linkCopied ? (
                    <Check className="ml-auto size-4 text-green-600" />
                  ) : (
                    <Copy className="ml-auto size-3.5 text-muted-foreground" />
                  )}
                </button>

                <div className="my-2 h-px bg-border/50" />

                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Telechargements
                </p>

                <div className="space-y-1">
                  <button
                    onClick={() => void handleDownloadPdf()}
                    disabled={exporting !== null}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <span className="flex size-8 items-center justify-center rounded-md bg-red-50">
                      <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 2h14l8 8v18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#E53E3E"/>
                        <path d="M20 2v8h8" fill="#C53030"/>
                        <path d="M20 2l8 8h-8V2z" fill="#FC8181" fillOpacity="0.4"/>
                        <text x="16" y="23" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="9" fill="#fff">PDF</text>
                      </svg>
                    </span>
                    <span className="flex flex-col flex-1">
                      <span className="text-[13px] font-semibold text-foreground">
                        Telecharger en PDF
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Lecture et partage universel.
                      </span>
                    </span>
                    {exporting === "pdf" ? (
                      <Loader2 className="ml-auto size-4 text-muted-foreground animate-spin" />
                    ) : exportDone === "pdf" ? (
                      <Check className="ml-auto size-4 text-green-600" />
                    ) : (
                      <Download className="ml-auto size-3.5 text-muted-foreground" />
                    )}
                  </button>

                  <button
                    onClick={() => void handleDownloadPowerPoint()}
                    disabled={exporting !== null}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <span className="flex size-8 items-center justify-center rounded-md bg-orange-50">
                      <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 2h14l8 8v18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#D97706"/>
                        <path d="M20 2v8h8" fill="#B45309"/>
                        <path d="M20 2l8 8h-8V2z" fill="#FCD34D" fillOpacity="0.4"/>
                        <text x="16" y="23" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="7.5" fill="#fff">PPTX</text>
                      </svg>
                    </span>
                    <span className="flex flex-col flex-1">
                      <span className="text-[13px] font-semibold text-foreground">
                        Telecharger en PowerPoint
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Presentation editable .pptx.
                      </span>
                    </span>
                    {exporting === "pptx" ? (
                      <Loader2 className="ml-auto size-4 text-muted-foreground animate-spin" />
                    ) : exportDone === "pptx" ? (
                      <Check className="ml-auto size-4 text-green-600" />
                    ) : (
                      <Download className="ml-auto size-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
          <UserProfileMenu avatarOnly />
        </div>
      </header>

      <div className="flex-1 min-h-0 flex relative">
        <aside
          className={cn(
            "hidden md:flex shrink-0 border-r border-slate-200 bg-white transition-[width] duration-100",
            activeSidebarMode ? "w-80" : "w-20",
          )}
        >
          <div className="flex h-full w-full">
            <div
              className={cn(
                "flex w-20 shrink-0 flex-col items-center gap-2 bg-white px-2 py-4",
                activeSidebarMode && "border-r border-slate-200",
              )}
            >
              <button
                onClick={() => toggleSidebarMode("templates")}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
                  activeSidebarMode === "templates"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                )}
              >
                <Layers className="size-5" />
                <span className="text-[11px] font-semibold">Templates</span>
              </button>
              <button
                onClick={() => toggleSidebarMode("elements")}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
                  activeSidebarMode === "elements"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                )}
              >
                <Plus className="size-5" />
                <span className="text-[11px] font-semibold">Elements</span>
              </button>
              <button
                onClick={() => toggleSidebarMode("uploads")}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
                  activeSidebarMode === "uploads"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                )}
              >
                <ImageIcon className="size-5" />
                <span className="text-[11px] font-semibold">Uploads</span>
              </button>
            </div>

            {activeSidebarMode && (
              <div className="presentation-sidebar-scrollbar flex-1 overflow-y-auto px-3 py-4">
                {activeSidebarMode === "templates" ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Choisir un template
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {TEMPLATE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => applyTemplateFromMenu(option.value)}
                          className={cn(
                            "rounded-xl border bg-white p-2 text-left transition-all",
                            selectedTemplate === option.value
                              ? "border-primary ring-1 ring-primary/30"
                              : "border-slate-200 hover:border-slate-300",
                          )}
                        >
                          <div className="mb-2 h-14 rounded-md border border-slate-200 bg-slate-50 p-1.5">
                            <div className="h-1.5 w-3/5 rounded bg-slate-400" />
                            <div className="mt-1.5 h-1.5 w-2/5 rounded bg-slate-200" />
                            <div className="mt-2 grid h-7 grid-cols-2 gap-1">
                              <div className="rounded bg-slate-200" />
                              <div className="rounded bg-slate-300" />
                            </div>
                          </div>
                          <p className="truncate text-[11px] font-semibold text-slate-700">
                            {option.label}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : activeSidebarMode === "elements" ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ajouter des elements
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {elementShortcuts.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            onClick={item.onClick}
                            className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-2 py-2 transition-colors hover:bg-slate-50"
                          >
                            <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                              <Icon className="size-5" />
                            </div>
                            <span className="text-[10px] font-medium text-slate-700">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Uploads / Favoris
                    </p>

                    {loadingUploads ? (
                      <p className="text-xs text-slate-500">Chargement...</p>
                    ) : uploads.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Aucune image favorite pour le moment.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {uploads.map((asset) => (
                          <div
                            key={asset.id}
                            className="rounded-xl border border-slate-200 bg-white p-2"
                          >
                            <button
                              onClick={() => insertFavoriteImageInSlide(asset)}
                              className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                            >
                              <img
                                src={asset.image_data_url}
                                alt={asset.title || "favorite"}
                                className="h-22 w-full object-cover"
                              />
                            </button>
                            <div className="mt-1 flex items-center justify-between gap-1">
                              <p className="truncate text-[10px] font-medium text-slate-600">
                                {asset.title || asset.prompt || "Image"}
                              </p>
                              <button
                                onClick={() => void removeFavorite(asset.id)}
                                className="flex size-5 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-red-600"
                                aria-label="Supprimer favori"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col bg-[#F7F7F7]">
          {error && (
            <div className="mx-auto mt-3 w-full max-w-225 rounded-lg border border-blue-300/60 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              {error}
            </div>
          )}

          <div className="min-h-0 relative flex-1 px-2 md:px-4 lg:px-6 pt-16 pb-4">
            <TransformWrapper
              minScale={0.25}
              maxScale={3}
              initialScale={1}
              wheel={{ step: 0.12 }}
              panning={{ disabled: true }}
              doubleClick={{ disabled: true }}
              onTransform={(_, state) => setWorkspaceZoom(state.scale)}
            >
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                }}
              >
                <div
                  className="relative w-full max-w-none"
                  style={{
                    width: "min(100%, calc((100vh - 260px) * 16 / 9))",
                  }}
                >
                  <div
                    className="w-full overflow-hidden box-border bg-white"
                    style={{ aspectRatio: SLIDE_ASPECT_RATIO }}
                  >
                    {scene && (
                      <Suspense
                        fallback={
                          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                            Chargement de l'editeur...
                          </div>
                        }
                      >
                        <SlideEditorCanvas
                          scene={scene}
                          selectedIds={selectedElementIds}
                          viewportZoom={workspaceZoom}
                          onSelectionChange={setSelectedElementIds}
                          onChangeElementStyle={(elementId, patch) =>
                            updateElementStyle(
                              safeCurrentSlide,
                              elementId,
                              patch,
                            )
                          }
                          onUpdateTextContent={(elementId, newText) =>
                            updateTextElementContent(
                              safeCurrentSlide,
                              elementId,
                              newText,
                            )
                          }
                          onChangeElementGeometry={(elementId, patch) =>
                            updateElementGeometry(
                              safeCurrentSlide,
                              elementId,
                              patch,
                            )
                          }
                        />
                      </Suspense>
                    )}
                  </div>

                  <div
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 -top-14 z-20 hidden max-w-[calc(100%-12px)] items-center gap-1 rounded-xl border border-border/70 bg-background/95 backdrop-blur-md px-1.5 py-1.5 md:max-h-24 md:flex-wrap md:overflow-x-auto",
                      selectedElement && "md:flex",
                    )}
                  >
                    <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background px-1 py-0.5">
                      <button
                        onClick={() => toggleToolbarGroup("common")}
                        className="rounded-md px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                      >
                        Opacite {collapsedGroups.common ? "+" : "-"}
                      </button>
                      {!collapsedGroups.common && selectedElement && (
                        <>
                          <button
                            onClick={() =>
                              adjustSelectedStyle({
                                opacity: Math.max(
                                  0.05,
                                  Number(
                                    (selectedElement.opacity - 0.05).toFixed(2),
                                  ),
                                ),
                              })
                            }
                            className="flex size-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
                          >
                            <Minus className="size-4" />
                          </button>
                          <span className="min-w-9 text-center text-xs font-semibold text-foreground tabular-nums">
                            {Math.round(selectedElement.opacity * 100)}%
                          </span>
                          <button
                            onClick={() =>
                              adjustSelectedStyle({
                                opacity: Math.min(
                                  1,
                                  Number(
                                    (selectedElement.opacity + 0.05).toFixed(2),
                                  ),
                                ),
                              })
                            }
                            className="flex size-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
                          >
                            <Plus className="size-4" />
                          </button>
                        </>
                      )}
                    </div>

                    {selectedTextElement && (
                      <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background px-1 py-0.5">
                        <button
                          onClick={() => toggleToolbarGroup("text")}
                          className="rounded-md px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                        >
                          Texte {collapsedGroups.text ? "+" : "-"}
                        </button>
                        {!collapsedGroups.text && (
                          <>
                            <button
                              onClick={() => adjustFontSize(-1)}
                              className="flex size-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
                            >
                              <Minus className="size-4" />
                            </button>
                            <span className="min-w-8 text-center text-xs font-semibold text-foreground tabular-nums">
                              {Math.round(selectedTextElement.fontSize)}
                            </span>
                            <button
                              onClick={() => adjustFontSize(1)}
                              className="flex size-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
                            >
                              <Plus className="size-4" />
                            </button>

                            {selectedTextElement.type === "text" && (
                              <>
                                <button
                                  onClick={() =>
                                    adjustSelectedStyle({
                                      fontWeight:
                                        selectedTextElement.fontWeight >= 600
                                          ? 500
                                          : 700,
                                    })
                                  }
                                  className={cn(
                                    "flex size-8 items-center justify-center rounded-md hover:bg-muted",
                                    selectedTextElement.fontWeight >= 600
                                      ? "bg-primary/10 text-primary"
                                      : "text-foreground",
                                  )}
                                >
                                  <Bold className="size-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    adjustSelectedStyle({
                                      fontStyle:
                                        selectedTextElement.fontStyle ===
                                        "italic"
                                          ? "normal"
                                          : "italic",
                                    })
                                  }
                                  className={cn(
                                    "flex size-8 items-center justify-center rounded-md hover:bg-muted",
                                    selectedTextElement.fontStyle === "italic"
                                      ? "bg-primary/10 text-primary"
                                      : "text-foreground",
                                  )}
                                >
                                  <Italic className="size-4" />
                                </button>
                              </>
                            )}

                            <label className="relative flex size-8 cursor-pointer items-center justify-center rounded-md border border-border/70 hover:bg-muted">
                              <Palette className="size-4 text-foreground" />
                              <input
                                type="color"
                                value={selectedTextElement.color}
                                onChange={(event) =>
                                  adjustSelectedStyle({
                                    color: event.target.value,
                                  })
                                }
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                            </label>

                            <button
                              onClick={() => adjustLineHeight(-0.05)}
                              className="flex size-8 items-center justify-center rounded-md border border-border/70 text-foreground hover:bg-muted"
                            >
                              <ArrowUpDown className="size-4" />
                            </button>
                            <button
                              onClick={() => adjustLineHeight(0.05)}
                              className="flex size-8 items-center justify-center rounded-md border border-border/70 text-foreground hover:bg-muted"
                            >
                              <ArrowUpDown className="size-4 rotate-180" />
                            </button>

                            {selectedTextElement.type === "text" && (
                              <>
                                <button
                                  onClick={() =>
                                    adjustSelectedStyle({ align: "left" })
                                  }
                                  className="flex size-8 items-center justify-center rounded-md border border-border/70 text-foreground hover:bg-muted"
                                >
                                  <AlignLeft className="size-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    adjustSelectedStyle({ align: "center" })
                                  }
                                  className="flex size-8 items-center justify-center rounded-md border border-border/70 text-foreground hover:bg-muted"
                                >
                                  <AlignCenter className="size-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    adjustSelectedStyle({ align: "right" })
                                  }
                                  className="flex size-8 items-center justify-center rounded-md border border-border/70 text-foreground hover:bg-muted"
                                >
                                  <AlignRight className="size-4" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {selectedShapeElement && (
                      <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background px-1 py-0.5">
                        <button
                          onClick={() => toggleToolbarGroup("shape")}
                          className="rounded-md px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                        >
                          Forme {collapsedGroups.shape ? "+" : "-"}
                        </button>
                        {!collapsedGroups.shape && (
                          <>
                            <button
                              onClick={() =>
                                adjustSelectedStyle({
                                  shape: "rect",
                                  cornerRadius: Math.max(
                                    12,
                                    selectedShapeElement.cornerRadius,
                                  ),
                                })
                              }
                              className={cn(
                                "rounded-md px-2 py-1 text-[11px] font-semibold",
                                selectedShapeElement.shape === "rect"
                                  ? "bg-primary/10 text-primary"
                                  : "text-foreground hover:bg-muted",
                              )}
                            >
                              Rect
                            </button>
                            <button
                              onClick={() =>
                                adjustSelectedStyle({
                                  shape: "ellipse",
                                  cornerRadius: 0,
                                })
                              }
                              className={cn(
                                "rounded-md px-2 py-1 text-[11px] font-semibold",
                                selectedShapeElement.shape === "ellipse"
                                  ? "bg-primary/10 text-primary"
                                  : "text-foreground hover:bg-muted",
                              )}
                            >
                              Cercle
                            </button>

                            <input
                              type="text"
                              value={selectedShapeElement.label}
                              onChange={(event) =>
                                updateTextElementContent(
                                  safeCurrentSlide,
                                  selectedShapeElement.id,
                                  event.target.value,
                                )
                              }
                              placeholder="Texte de forme"
                              className="h-8 w-34 rounded-md border border-border/70 bg-background px-2 text-xs outline-none focus-visible:border-ring"
                            />

                            <button
                              onClick={() =>
                                adjustSelectedStyle({ textAlign: "left" })
                              }
                              className="flex size-8 items-center justify-center rounded-md border border-border/70 text-foreground hover:bg-muted"
                            >
                              <AlignLeft className="size-4" />
                            </button>
                            <button
                              onClick={() =>
                                adjustSelectedStyle({ textAlign: "center" })
                              }
                              className="flex size-8 items-center justify-center rounded-md border border-border/70 text-foreground hover:bg-muted"
                            >
                              <AlignCenter className="size-4" />
                            </button>
                            <button
                              onClick={() =>
                                adjustSelectedStyle({ textAlign: "right" })
                              }
                              className="flex size-8 items-center justify-center rounded-md border border-border/70 text-foreground hover:bg-muted"
                            >
                              <AlignRight className="size-4" />
                            </button>

                            <label className="relative flex size-8 cursor-pointer items-center justify-center rounded-md border border-border/70 hover:bg-muted">
                              <Palette className="size-4 text-foreground" />
                              <input
                                type="color"
                                value={selectedShapeElement.fill}
                                onChange={(event) =>
                                  adjustSelectedStyle({
                                    fill: event.target.value,
                                  })
                                }
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                            </label>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </TransformComponent>
              <ZoomControls zoom={workspaceZoom} />
            </TransformWrapper>
          </div>

          <div className="shrink-0 px-4 md:px-5 pt-3 pb-5">
            <div className="mx-auto flex w-full max-w-260 items-center gap-3">
              <button
                onClick={() => {
                  if (safeCurrentSlide <= 0) return;
                  void setSlideParam(safeCurrentSlide - 1);
                }}
                className="shrink-0 flex size-10 items-center justify-center rounded-full border border-border/60 bg-background text-foreground hover:bg-muted disabled:opacity-35"
                disabled={safeCurrentSlide <= 0}
                aria-label="Slide precedente"
              >
                <ChevronLeft className="size-4" />
              </button>

              <div
                ref={thumbnailsScrollRef}
                className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-visible px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none" }}
              >
                {virtualWindow.prefix > 0 && (
                  <div
                    style={{
                      width: virtualWindow.prefix,
                      height: 1,
                      flexShrink: 0,
                    }}
                  />
                )}

                {slides
                  .slice(virtualWindow.start, virtualWindow.end)
                  .map((item, offset) => {
                    const index = virtualWindow.start + offset;
                    return (
                      <div
                        key={`${item.slide_number}-${item.title}-${index}`}
                        className="relative shrink-0"
                        data-slide-menu="true"
                      >
                        <button
                          ref={(node) => {
                            thumbnailRefs.current[index] = node;
                          }}
                          onClick={() => {
                            setOpenSlideMenuIndex(null);
                            setSelectedElementIds([]);
                            void setSlideParam(index);
                          }}
                          aria-label={`Aller a la slide ${index + 1}`}
                          className={cn(
                            "relative rounded-lg p-0.5 transition-all duration-150 cursor-pointer text-left outline-none scroll-mx-2",
                            index === safeCurrentSlide
                              ? "ring-2 ring-primary ring-offset-1 ring-offset-slate-200"
                              : "opacity-85 hover:opacity-100 hover:ring-1 hover:ring-border/70 hover:ring-offset-1 hover:ring-offset-slate-200",
                          )}
                        >
                          <div
                            className="w-28 rounded-md border border-border/40 bg-white overflow-hidden"
                            style={{ aspectRatio: SLIDE_ASPECT_RATIO }}
                          >
                            <div className="h-full flex flex-col justify-between p-2.5">
                              <div className="space-y-0.5">
                                <div className="h-0.5 w-8 rounded-full bg-slate-700/70" />
                                <div className="h-0.5 w-12 rounded-full bg-slate-300/80" />
                              </div>
                              <div className="space-y-0.5">
                                <span className="block text-[8px] font-semibold text-slate-700 leading-none">
                                  {index + 1}
                                </span>
                                <span className="block text-[8px] leading-none text-slate-500 truncate max-w-24">
                                  {item.title}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>

                        {index === safeCurrentSlide && (
                          <>
                            <button
                              onClick={() =>
                                setOpenSlideMenuIndex((value) =>
                                  value === index ? null : index,
                                )
                              }
                              className="absolute -right-2 -top-2 z-20 flex size-6 items-center justify-center rounded-full border border-border/70 bg-background hover:bg-muted transition-colors cursor-pointer"
                              aria-label="Options slide"
                            >
                              <Ellipsis className="size-3" />
                            </button>

                            {openSlideMenuIndex === index && (
                              <div className="absolute right-0 top-8 z-30 min-w-32 rounded-lg border border-border/60 bg-background p-1.5">
                                <button
                                  onClick={() => {
                                    setOpenSlideMenuIndex(null);
                                    if (slides.length <= 1) return;
                                    removeSlide(index);
                                    void setSlideParam(Math.max(0, index - 1));
                                  }}
                                  disabled={slides.length <= 1}
                                  className="w-full rounded-md px-2.5 py-2 text-left text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  Supprimer
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                {virtualWindow.suffix > 0 && (
                  <div
                    style={{
                      width: virtualWindow.suffix,
                      height: 1,
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>

              <div className="shrink-0 flex items-center gap-1 rounded-xl border border-border/60 bg-slate-100/80 px-2 py-1.5">
                <button
                  onClick={() => {
                    addSlideAfter(safeCurrentSlide);
                    void setSlideParam(safeCurrentSlide + 1);
                  }}
                  aria-label="Ajouter une slide"
                  className="flex size-10 items-center justify-center rounded-lg text-foreground hover:bg-background transition-colors"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  onClick={() => {
                    if (safeCurrentSlide >= slides.length - 1) return;
                    void setSlideParam(safeCurrentSlide + 1);
                  }}
                  disabled={safeCurrentSlide >= slides.length - 1}
                  aria-label="Slide suivante"
                  className="flex size-10 items-center justify-center rounded-lg text-foreground hover:bg-background transition-colors disabled:opacity-35"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </main>

        {showNotes && slide && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-30 hidden md:block">
            <div className="pointer-events-auto w-84 rounded-xl border border-border/70 bg-background">
              <div className="px-3 py-2 border-b border-border/60">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes du presentateur
                </h3>
              </div>
              <div className="p-3">
                <textarea
                  value={slide.speaker_notes}
                  onChange={(event) =>
                    updateSpeakerNotes(safeCurrentSlide, event.target.value)
                  }
                  placeholder="Ajouter des notes presenter..."
                  className="min-h-36 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed text-foreground/85 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

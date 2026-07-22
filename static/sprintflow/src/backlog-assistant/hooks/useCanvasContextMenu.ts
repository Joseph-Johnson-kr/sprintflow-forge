import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  CANVAS_MENU_WIDTH,
  drawCanvasMenu,
  hitTestCanvasMenu,
  type CanvasMenuState,
  type ContextMenuItem,
} from '../utils/canvasContextMenu';

// Standalone canvas-drawn context menu for plain DOM containers (no vis-network canvas to piggyback on).
// Overlays `containerRef` with an absolutely-positioned <canvas> sized via a static Tailwind class
// (inset-0), never inline style, since Jira's CSP silently drops style={{...}}.
export function useCanvasContextMenu(containerRef: RefObject<HTMLElement | null>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const menuRef = useRef<CanvasMenuState | null>(null);
  const [open, setOpen] = useState(false);

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCanvasMenu(ctx, menuRef.current);
  };

  const closeMenu = () => {
    if (!menuRef.current) return;
    menuRef.current = null;
    setOpen(false);
    redraw();
  };

  const openMenu = (x: number, y: number, items: ContextMenuItem[]) => {
    menuRef.current = { x, y, items, rects: [] };
    setOpen(true);
    redraw();
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx?.scale(dpr, dpr);
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const onClick = (e: MouseEvent) => {
      const menu = menuRef.current;
      if (!menu) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = hitTestCanvasMenu(menu, mx, my);
      closeMenu();
      hit?.action?.();
    };
    canvas.addEventListener('click', onClick);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      ro.disconnect();
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current]);

  const menuCanvasClassName = `absolute inset-0 z-50 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`;

  return { canvasRef, menuCanvasClassName, openMenu, isMenuOpen: open, menuWidth: CANVAS_MENU_WIDTH };
}

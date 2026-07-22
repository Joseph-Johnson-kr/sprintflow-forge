export interface ContextMenuItem {
  label?: string;
  sep?: boolean;
  danger?: boolean;
  action?: () => void;
}

export interface CanvasMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  rects: Array<{ y0: number; y1: number; item: ContextMenuItem }>;
}

export const CANVAS_MENU_WIDTH = 200;
export const CANVAS_MENU_ROW_H = 24;
export const CANVAS_MENU_SEP_H = 9;
export const CANVAS_MENU_PAD_Y = 6;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Canvas pixels aren't governed by style-src at all, so drawing the menu here sidesteps
// the CSP block on React's style={{left,top}} entirely.
export function drawCanvasMenu(ctx: CanvasRenderingContext2D, menu: CanvasMenuState | null) {
  if (!menu) return;

  const rects: Array<{ y0: number; y1: number; item: ContextMenuItem }> = [];
  let totalH = CANVAS_MENU_PAD_Y * 2;
  for (const item of menu.items) totalH += item.sep ? CANVAS_MENU_SEP_H : CANVAS_MENU_ROW_H;

  ctx.beginPath();
  roundRect(ctx, menu.x, menu.y, CANVAS_MENU_WIDTH, totalH, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '12px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  let cursorY = menu.y + CANVAS_MENU_PAD_Y;
  for (const item of menu.items) {
    if (item.sep) {
      ctx.strokeStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(menu.x + 8, cursorY + CANVAS_MENU_SEP_H / 2);
      ctx.lineTo(menu.x + CANVAS_MENU_WIDTH - 8, cursorY + CANVAS_MENU_SEP_H / 2);
      ctx.stroke();
      cursorY += CANVAS_MENU_SEP_H;
      continue;
    }
    const y0 = cursorY;
    const y1 = cursorY + CANVAS_MENU_ROW_H;
    rects.push({ y0, y1, item });
    ctx.fillStyle = item.danger ? '#dc2626' : '#334155';
    ctx.fillText(item.label ?? '', menu.x + 12, (y0 + y1) / 2);
    cursorY = y1;
  }

  menu.rects = rects;
}

export function hitTestCanvasMenu(menu: CanvasMenuState, mx: number, my: number): ContextMenuItem | null {
  const hit = menu.rects.find(
    (r) => mx >= menu.x && mx <= menu.x + CANVAS_MENU_WIDTH && my >= r.y0 && my <= r.y1,
  );
  return hit ? hit.item : null;
}

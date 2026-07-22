import { useEffect, useRef } from 'react';
import { DataSet, Network } from 'vis-network/standalone/esm/vis-network.js';
import { useBacklogAssistantStore } from '../stores/backlogAssistantStore';
import {
  getDependencyChain,
  isDoneStatus,
  makeDimmedEdge,
  makeDimmedNode,
  makeExternalVisNode,
  makeVisEdge,
  makeVisNode,
  visibleGroupMembers,
} from '../utils/graph';
import type { BAEdge } from '../types';
import { drawCanvasMenu, hitTestCanvasMenu, type CanvasMenuState, type ContextMenuItem } from '../utils/canvasContextMenu';

interface Props {
  initialPositions: Record<string, { x: number; y: number }>;
}

const NODE_W = 230;
const CHILD_COLS = 2;
const COL_W = 250;
const ROW_H = 88;
const GROUP_GAP = 140;
const CHILD_Y0 = 140;

export default function GraphCanvas({ initialPositions }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const objBtnsRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<any>(null);
  const visNodesRef = useRef<any>(null);
  const visEdgesRef = useRef<any>(null);
  const carryPositionsRef = useRef<Record<string, { x: number; y: number }> | null>(null);
  const hoveredNodeRef = useRef<string | null>(null);
  const dragHoverObjectiveRef = useRef<string | null>(null);
  const objDragRef = useRef<{ primaryId: string; children: string[]; startPositions: Record<string, { x: number; y: number }> } | null>(null);
  const panRef = useRef<{ startClientX: number; startClientY: number; startView: { x: number; y: number }; scale: number } | null>(null);
  const canvasMenuRef = useRef<CanvasMenuState | null>(null);

  const issues = useBacklogAssistantStore((s) => s.issues);
  const addingEdge = useBacklogAssistantStore((s) => s.addingEdge);

  // Rebuild the whole graph whenever a new CSV is loaded (issues identity changes).
  useEffect(() => {
    const issueKeys = Object.keys(issues);
    if (issueKeys.length === 0) return;

    const getState = useBacklogAssistantStore.getState;

    let carryPositions: Record<string, { x: number; y: number }> | null = null;
    if (networkRef.current && visNodesRef.current) {
      const allIds: string[] = visNodesRef.current.getIds();
      visNodesRef.current.update(allIds.map((id) => ({ id, hidden: false })));
      const positions = networkRef.current.getPositions();
      const filtered: Record<string, { x: number; y: number }> = {};
      for (const k of issueKeys) {
        if (positions[k]) filtered[k] = positions[k];
      }
      carryPositions = Object.keys(filtered).length ? filtered : null;
      networkRef.current.destroy();
      networkRef.current = null;
    }
    carryPositionsRef.current = carryPositions;

    const state = getState();
    const visNodes = new DataSet<any>([
      ...Object.values(state.issues).map((issue) => {
        const node = makeVisNode(issue, state.rankOverrides, state.newIssueKeys);
        const collapsedParent = Object.entries(state.objectiveGroups).find(
          ([objKey, children]) => state.collapsedObjectives.has(objKey) && children.includes(issue.key),
        );
        return { ...node, hidden: !!collapsedParent || isDoneStatus(issue.status) };
      }),
      // Ghost nodes for issues outside this project/team that a dependency edge points to —
      // vis-network silently drops an edge unless both endpoints exist as DataSet nodes.
      ...Object.values(state.externalIssues).map((candidate) => makeExternalVisNode(candidate)),
    ]);

    const isKnownEndpoint = (key: string) => !!state.issues[key] || !!state.externalIssues[key];
    const visibleEdges = state.edges.filter(
      (e: BAEdge) => e.type === 'blocks' && isKnownEndpoint(e.from) && isKnownEndpoint(e.to),
    );
    const visEdges = new DataSet<any>(visibleEdges.map((e: BAEdge) => makeVisEdge(e)));

    visNodesRef.current = visNodes;
    visEdgesRef.current = visEdges;

    if (!containerRef.current) return;

    const network = new Network(
      containerRef.current,
      { nodes: visNodes, edges: visEdges },
      {
        nodes: { shape: 'box' },
        edges: { smooth: { enabled: true, type: 'continuous' } as any },
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: -80,
            centralGravity: 0.003,
            springLength: 180,
            springConstant: 0.06,
            damping: 0.5,
          },
          stabilization: { iterations: 300, updateInterval: 30 },
        },
        interaction: {
          hover: true,
          tooltipDelay: 300,
          multiselect: true,
          zoomView: false,
          dragView: false,
        },
        manipulation: {
          enabled: true,
          addNode: false,
          editEdge: false,
          deleteNode: false,
          deleteEdge: false,
          addEdge: (edgeData: any, callback: (data: any) => void) => {
            const { from, to } = edgeData;
            if (!from || !to || from === to) return;
            const s = getState();
            if (!s.issues[from] || !s.issues[to]) return;
            if (s.issues[from].type === 'Objective' || s.issues[to].type === 'Objective') return;
            const created = s.addUserEdge(from, to);
            if (!created) return;
            callback(makeVisEdge(created));
            if (getState().addingEdge) {
              network.addEdgeMode();
            }
          },
        },
      } as any,
    );
    networkRef.current = network;

    const rebuildHiddenFlags = () => {
      const s = getState();
      const updates = Object.keys(s.issues).map((key) => {
        const parent = Object.entries(s.objectiveGroups).find(
          ([objKey, children]) => s.collapsedObjectives.has(objKey) && children.includes(key),
        );
        return { id: key, hidden: !!parent || isDoneStatus(s.issues[key].status) };
      });
      visNodes.update(updates);
    };

    const applyHoverDim = (hoveredId: string) => {
      const s = getState();
      const isExternalHover = !s.issues[hoveredId] && !!s.externalIssues[hoveredId];
      const chain = isExternalHover
        ? new Set<string>([
            hoveredId,
            ...s.edges
              .filter((e) => e.type === 'blocks' && (e.from === hoveredId || e.to === hoveredId))
              .map((e) => (e.from === hoveredId ? e.to : e.from)),
          ])
        : getDependencyChain(hoveredId, s.issues, s.edges, s.objectiveGroups);
      const nodeUpdates = visNodes.getIds().map((rawId) => {
        const id = String(rawId);
        if (!chain.has(id)) return makeDimmedNode(id);
        if (s.issues[id]) return makeVisNode(s.issues[id], s.rankOverrides, s.newIssueKeys);
        if (s.externalIssues[id]) return makeExternalVisNode(s.externalIssues[id]);
        return makeDimmedNode(id);
      });
      visNodes.update(nodeUpdates);
      const edgeUpdates = visEdges.get().map((e: any) =>
        chain.has(e.from) && chain.has(e.to)
          ? makeVisEdge({ id: e.id, from: e.from, to: e.to, type: 'blocks' })
          : makeDimmedEdge(e.id),
      );
      visEdges.update(edgeUpdates);
    };

    const clearHoverDim = () => {
      const s = getState();
      visNodes.update([
        ...Object.values(s.issues).map((issue) => makeVisNode(issue, s.rankOverrides, s.newIssueKeys)),
        ...Object.values(s.externalIssues).map((candidate) => makeExternalVisNode(candidate)),
      ]);
      const isKnownEndpoint = (key: string) => !!s.issues[key] || !!s.externalIssues[key];
      const active = s.edges.filter((e) => e.type === 'blocks' && isKnownEndpoint(e.from) && isKnownEndpoint(e.to));
      visEdges.update(active.map((e) => makeVisEdge(e)));
      rebuildHiddenFlags();
    };

    network.on('click', (params: any) => {
      const menu = canvasMenuRef.current;
      if (menu) {
        const { x: mx, y: my } = params.pointer.DOM;
        const hit = hitTestCanvasMenu(menu, mx, my);
        canvasMenuRef.current = null;
        network.redraw();
        hit?.action?.();
        return;
      }
      if (params.nodes.length > 0) {
        getState().setSelectedNode(params.nodes[0]);
      }
    });

    network.on('hoverNode', (params: any) => {
      hoveredNodeRef.current = params.node;
      if (!getState().addingEdge) applyHoverDim(params.node);
    });
    network.on('blurNode', () => {
      hoveredNodeRef.current = null;
      if (!getState().addingEdge) clearHoverDim();
    });

    network.on('dragStart', (params: any) => {
      if (params.nodes.length !== 1) return;
      const id = params.nodes[0];
      const s = getState();
      const issue = s.issues[id];
      if (issue && issue.type === 'Objective') {
        const children = (s.objectiveGroups[id] || []).filter((c) => !params.nodes.includes(c));
        const positions = network.getPositions([id, ...children]);
        objDragRef.current = { primaryId: id, children, startPositions: positions };
      }
    });

    network.on('dragging', (params: any) => {
      const drag = objDragRef.current;
      if (drag && params.nodes.includes(drag.primaryId)) {
        const newPos = network.getPositions([drag.primaryId])[drag.primaryId];
        const start = drag.startPositions[drag.primaryId];
        const dx = newPos.x - start.x;
        const dy = newPos.y - start.y;
        const updates = drag.children.map((childId) => ({
          id: childId,
          x: drag.startPositions[childId].x + dx,
          y: drag.startPositions[childId].y + dy,
        }));
        if (updates.length) visNodes.update(updates);
        return;
      }

      if (params.nodes.length === 1) {
        const id = params.nodes[0];
        const s = getState();
        const issue = s.issues[id];
        const isGrouped = Object.values(s.objectiveGroups).some((children) => children.includes(id));
        if (issue && issue.type !== 'Objective' && !isGrouped) {
          const pos = network.getPositions([id])[id];
          const found = findObjectiveForPosition(network, s, pos, id);
          if (found !== dragHoverObjectiveRef.current) {
            dragHoverObjectiveRef.current = found;
            network.redraw();
          }
        }
      }
    });

    network.on('dragEnd', (params: any) => {
      objDragRef.current = null;
      if (params.nodes.length === 1 && dragHoverObjectiveRef.current) {
        const id = params.nodes[0];
        const s = getState();
        const issue = s.issues[id];
        const isGrouped = Object.values(s.objectiveGroups).some((children) => children.includes(id));
        if (issue && issue.type !== 'Objective' && !isGrouped) {
          getState().addToObjective(id, dragHoverObjectiveRef.current);
          rebuildHiddenFlags();
        }
      }
      dragHoverObjectiveRef.current = null;
      network.redraw();
    });

    network.on('beforeDrawing', (ctx: CanvasRenderingContext2D) => {
      drawObjectiveAreas(network, getState(), ctx, hoveredNodeRef.current, dragHoverObjectiveRef.current);
    });

    network.on('afterDrawing', (ctx: CanvasRenderingContext2D) => {
      if (!canvasMenuRef.current) return;
      // Reset vis-network's pan/zoom transform so the menu draws in fixed screen space, matching
      // the screen coords used for hit-testing (params.pointer.DOM) — canvas pixels aren't
      // governed by style-src at all, sidestepping the CSP block on inline style={{left,top}}.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawCanvasMenu(ctx, canvasMenuRef.current);
      ctx.restore();
    });

    network.on('oncontext', (params: any) => {
      params.event.preventDefault();
      const pointer = params.pointer.DOM;
      const nodeIdRaw = network.getNodeAt(params.pointer.DOM);
      const edgeIdRaw = !nodeIdRaw ? network.getEdgeAt(params.pointer.DOM) : null;
      const nodeId = nodeIdRaw == null ? null : String(nodeIdRaw);
      const edgeId = edgeIdRaw == null ? null : String(edgeIdRaw);
      const s = getState();
      const showMenu = (items: ContextMenuItem[]) => {
        canvasMenuRef.current = { x: pointer.x, y: pointer.y, items, rects: [] };
        network.redraw();
      };

      if (edgeId) {
        const items: ContextMenuItem[] = [
          { label: 'Reverse direction', action: () => getState().graphApi?.reverseEdge(edgeId) },
          { label: 'Remove dependency', danger: true, action: () => getState().graphApi?.removeEdge(edgeId) },
        ];
        showMenu(items);
        return;
      }

      if (nodeId) {
        const issue = s.issues[nodeId];
        if (!issue) return;
        const items: ContextMenuItem[] = [];
        if (issue.type !== 'Objective') {
          items.push({
            label: '+ Add dependency…',
            action: () => {
              getState().setAddingEdge(true);
              network.addEdgeMode();
            },
          });
          items.push({ sep: true });
          const override = s.rankOverrides[nodeId];
          if (override) {
            items.push({ label: 'Remove rank override', action: () => getState().removeRankOverride(nodeId) });
          } else {
            items.push({ label: 'Override rank…', action: () => getState().setRankOverrideTarget(nodeId) });
          }
          const blocksEdges = s.edges.filter((e) => e.type === 'blocks');
          for (const e of blocksEdges) {
            if (e.from === nodeId || e.to === nodeId) {
              const other = e.from === nodeId ? e.to : e.from;
              items.push({ sep: true });
              items.push({ label: `Reverse: ${other}`, action: () => getState().graphApi?.reverseEdge(e.id) });
              items.push({ label: `Remove: ${other}`, danger: true, action: () => getState().graphApi?.removeEdge(e.id) });
            }
          }
          const parentObj = Object.entries(s.objectiveGroups).find(([, children]) => children.includes(nodeId));
          if (parentObj) {
            items.push({ sep: true });
            items.push({ label: `Un-relate from ${parentObj[0]}`, action: () => getState().removeFromObjective(nodeId, parentObj[0]) });
          }
        }
        if (items.length) showMenu(items);
      }
    });

    network.once('stabilizationIterationsDone', () => {
      network.setOptions({ physics: { enabled: false } });
      layoutIsolatedNodes(visNodes, getState());

      if (carryPositionsRef.current) {
        visNodes.update(
          Object.entries(carryPositionsRef.current).map(([id, pos]) => ({ id, x: pos.x, y: pos.y })),
        );
        carryPositionsRef.current = null;
        getState().touchAutosave();
      } else if (Object.keys(initialPositions).length) {
        visNodes.update(
          Object.entries(initialPositions)
            .filter(([id]) => getState().issues[id])
            .map(([id, pos]) => ({ id, x: pos.x, y: pos.y })),
        );
      }
      setTimeout(() => network.fit(), 50);
    });

    const graphApi = {
      removeEdge: (id: string) => {
        const edge = getState().removeEdge(id);
        if (edge && edge.type === 'blocks') visEdges.remove(id);
        return edge;
      },
      reverseEdge: (id: string) => {
        const reversed = getState().reverseEdge(id);
        if (reversed && reversed.type === 'blocks') {
          visEdges.remove(id);
          visEdges.add(makeVisEdge(reversed));
        }
        return reversed;
      },
      undoRemoveEdge: (edge: BAEdge) => {
        getState().undoRemoveEdge(edge);
        if (edge.type === 'blocks') visEdges.update(makeVisEdge(edge));
      },
      addToObjective: (childKey: string, objKey: string) => {
        getState().addToObjective(childKey, objKey);
        rebuildHiddenFlags();
      },
      removeFromObjective: (childKey: string, objKey: string) => {
        getState().removeFromObjective(childKey, objKey);
        rebuildHiddenFlags();
      },
      setAddingEdge: (on: boolean) => {
        getState().setAddingEdge(on);
        if (on) network.addEdgeMode();
        else network.disableEditMode();
      },
      collapseObjective: (objKey: string) => {
        getState().collapseObjective(objKey);
        rebuildHiddenFlags();
      },
      expandObjective: (objKey: string) => {
        getState().expandObjective(objKey);
        rebuildHiddenFlags();
      },
      toggleObjective: (objKey: string) => {
        getState().toggleObjective(objKey);
        rebuildHiddenFlags();
      },
      collapseAll: () => {
        getState().collapseAllObjectives();
        rebuildHiddenFlags();
      },
      expandAll: () => {
        getState().expandAllObjectives();
        rebuildHiddenFlags();
      },
      fit: () => network.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } as any }),
      zoomIn: () => {
        const scale = Math.min(network.getScale() * 1.3, 5);
        network.moveTo({ scale, animation: { duration: 200 } as any });
      },
      zoomOut: () => {
        const scale = Math.max(network.getScale() / 1.3, 0.05);
        network.moveTo({ scale, animation: { duration: 200 } as any });
      },
      focusNode: (key: string) => {
        getState().setSelectedNode(key);
        network.focus(key, { scale: 1.3, animation: { duration: 600, easingFunction: 'easeInOutQuad' } as any });
      },
      applyRankOverride: (key: string, reason: string) => {
        getState().setRankOverride(key, reason);
        const issue = getState().issues[key];
        if (issue) visNodes.update(makeVisNode(issue, getState().rankOverrides, getState().newIssueKeys));
      },
      removeRankOverride: (key: string) => {
        getState().removeRankOverride(key);
        const issue = getState().issues[key];
        if (issue) visNodes.update(makeVisNode(issue, getState().rankOverrides, getState().newIssueKeys));
      },
      getPositions: () => network.getPositions(),
      applySessionPositions: (positions: Record<string, { x: number; y: number }>) => {
        visNodes.update(Object.entries(positions).map(([id, pos]) => ({ id, x: pos.x, y: pos.y })));
      },
      setHoverNode: (key: string | null) => {
        if (key) applyHoverDim(key);
        else clearHoverDim();
      },
    };
    getState().setGraphApi(graphApi);

    // Custom pan (dragView is disabled to avoid vis-network's sticky-drag bug on this container).
    const el = containerRef.current;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (network.getNodeAt({ x: e.offsetX, y: e.offsetY })) return;
      panRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startView: network.getViewPosition(),
        scale: network.getScale(),
      };
      el.style.cursor = 'grabbing';
    };
    const onMouseMove = (e: MouseEvent) => {
      const pan = panRef.current;
      if (!pan) return;
      const dx = (e.clientX - pan.startClientX) / pan.scale;
      const dy = (e.clientY - pan.startClientY) / pan.scale;
      network.moveTo({
        position: { x: pan.startView.x - dx, y: pan.startView.y - dy },
        animation: false as any,
      });
    };
    const onMouseUp = () => {
      panRef.current = null;
      el.style.cursor = '';
    };
    el.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    const closeCanvasMenu = () => {
      if (!canvasMenuRef.current) return;
      canvasMenuRef.current = null;
      network.redraw();
    };
    const onDocClickForCanvasMenu = (e: MouseEvent) => {
      if (canvasMenuRef.current && !el.contains(e.target as Node)) closeCanvasMenu();
    };
    const onKeyDownForCanvasMenu = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCanvasMenu();
    };
    document.addEventListener('click', onDocClickForCanvasMenu);
    document.addEventListener('keydown', onKeyDownForCanvasMenu);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('click', onDocClickForCanvasMenu);
      document.removeEventListener('keydown', onKeyDownForCanvasMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues]);

  useEffect(() => {
    const network = networkRef.current;
    if (!network) return;
    if (addingEdge) network.addEdgeMode();
    else network.disableEditMode();
  }, [addingEdge]);

  useEffect(() => {
    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative flex-1 min-w-0 h-full bg-white">
      <div ref={containerRef} className="absolute inset-0" />
      <div ref={objBtnsRef} className="pointer-events-none absolute inset-0" />
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          type="button"
          className="h-8 w-8 rounded border border-slate-300 bg-white text-lg leading-none shadow-sm hover:bg-slate-50"
          onClick={() => useBacklogAssistantStore.getState().graphApi?.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          className="h-8 w-8 rounded border border-slate-300 bg-white text-lg leading-none shadow-sm hover:bg-slate-50"
          onClick={() => useBacklogAssistantStore.getState().graphApi?.zoomOut()}
        >
          −
        </button>
      </div>
    </div>
  );
}

function findObjectiveForPosition(network: any, s: ReturnType<typeof useBacklogAssistantStore.getState>, pos: { x: number; y: number }, excludeId: string): string | null {
  for (const objKey of Object.keys(s.objectiveGroups)) {
    const members = visibleGroupMembers(objKey, s.objectiveGroups, s.collapsedObjectives).filter((id) => id !== excludeId);
    if (!members.length) continue;
    const box = computeGroupBoundingBox(network, members);
    if (!box) continue;
    if (pos.x >= box.left && pos.x <= box.right && pos.y >= box.top && pos.y <= box.bottom) {
      return objKey;
    }
  }
  return null;
}

function computeGroupBoundingBox(network: any, nodeIds: string[]): { left: number; right: number; top: number; bottom: number } | null {
  const positions = network.getPositions(nodeIds);
  const pad = 28;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  let found = false;
  for (const id of nodeIds) {
    try {
      const box = network.getBoundingBox(id);
      left = Math.min(left, box.left - pad);
      right = Math.max(right, box.right + pad);
      top = Math.min(top, box.top - pad);
      bottom = Math.max(bottom, box.bottom + pad);
      found = true;
    } catch {
      const pos = positions[id];
      if (pos) {
        left = Math.min(left, pos.x - 110);
        right = Math.max(right, pos.x + 110);
        top = Math.min(top, pos.y - 24);
        bottom = Math.max(bottom, pos.y + 24);
        found = true;
      }
    }
  }
  return found ? { left, right, top, bottom } : null;
}

function drawObjectiveAreas(
  network: any,
  s: ReturnType<typeof useBacklogAssistantStore.getState>,
  ctx: CanvasRenderingContext2D,
  hoveredNode: string | null,
  dragHoverObjective: string | null,
) {
  const hoveredIsObjective = hoveredNode ? s.issues[hoveredNode]?.type === 'Objective' : false;

  for (const objKey of Object.keys(s.objectiveGroups)) {
    const members = visibleGroupMembers(objKey, s.objectiveGroups, s.collapsedObjectives);
    const box = computeGroupBoundingBox(network, members);
    if (!box) continue;
    const isDragHover = dragHoverObjective === objKey;
    const isDimmed = hoveredIsObjective && hoveredNode !== objKey;

    let fill = 'rgba(202,138,4,0.08)';
    let stroke = 'rgba(202,138,4,0.35)';
    if (isDragHover) {
      fill = 'rgba(202,138,4,0.18)';
      stroke = 'rgba(202,138,4,0.6)';
    } else if (isDimmed) {
      fill = 'rgba(202,138,4,0.03)';
      stroke = 'rgba(202,138,4,0.12)';
    }

    ctx.save();
    ctx.beginPath();
    roundRect(ctx, box.left, box.top, box.right - box.left, box.bottom - box.top, 16);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    if (!isDragHover) ctx.setLineDash([8, 5]);
    ctx.stroke();
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function layoutIsolatedNodes(visNodes: any, s: ReturnType<typeof useBacklogAssistantStore.getState>) {
  const objectiveKeys = Object.keys(s.objectiveGroups).sort();
  const assigned = new Set<string>();
  for (const objKey of objectiveKeys) {
    for (const c of s.objectiveGroups[objKey]) assigned.add(c);
    assigned.add(objKey);
  }

  const updates: Array<{ id: string; x: number; y: number }> = [];
  let cursorX = 0;
  for (const objKey of objectiveKeys) {
    const children = s.objectiveGroups[objKey];
    const cols = Math.max(1, Math.min(CHILD_COLS, children.length));
    const groupWidth = Math.max(NODE_W, cols * COL_W);
    updates.push({ id: objKey, x: cursorX + groupWidth / 2, y: 0 });
    children.forEach((childKey, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      updates.push({
        id: childKey,
        x: cursorX + col * COL_W + COL_W / 2,
        y: CHILD_Y0 + row * ROW_H,
      });
    });
    cursorX += groupWidth + GROUP_GAP;
  }

  const ungrouped = Object.keys(s.issues).filter((k) => !assigned.has(k));
  if (ungrouped.length) {
    const layoutW = Math.max(cursorX, NODE_W * 3);
    const uCols = Math.max(3, Math.floor(layoutW / NODE_W));
    const maxChildRows = objectiveKeys.length
      ? Math.max(...objectiveKeys.map((k) => Math.ceil((s.objectiveGroups[k].length || 0) / CHILD_COLS)))
      : 0;
    const startY = CHILD_Y0 + maxChildRows * ROW_H + GROUP_GAP;
    ungrouped.forEach((key, i) => {
      const col = i % uCols;
      const row = Math.floor(i / uCols);
      updates.push({ id: key, x: col * COL_W, y: startY + row * ROW_H });
    });
  }

  if (updates.length) visNodes.update(updates);
}

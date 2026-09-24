import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
} from "react";
import eyeIcon from "../../SVG/MdiEye.svg";
import eyeClosedIcon from "../../SVG/MdiEyeClosed.svg";
import crossIcon from "../../SVG/Cross.svg";
import inventoryIcon from "../../SVG/inventory.svg";
import parametersIcon from "../../SVG/MdiPipeWrench.svg";

type ItemParameters = {
  xMm: number;
  yMm: number;
  rotationDeg: number;
  scalePercent: number;
};

type LayerItem = {
  id: string;
  name: string;
  visible: boolean;
  parameters: ItemParameters;
};

type LayerGroup = {
  id: string;
  name: string;
  visible: boolean;
  expanded: boolean;
  items: LayerItem[];
};

type DraggedEntry =
  | { type: "group"; groupId: string }
  | { type: "item"; groupId: string; itemId: string }
  | null;

type ClipboardEntry =
  | { type: "group"; group: LayerGroup }
  | { type: "item"; item: LayerItem; sourceGroupId: string };

type LayerClipboard = {
  mode: "copy" | "cut";
  entries: ClipboardEntry[];
};

type ContextMenuState = {
  x: number;
  y: number;
  targetKey: string | null;
};

type WorkspaceDrawerProps = {
  isOpen: boolean;
  onToggle: () => void;
};

const INITIAL_GROUPS: LayerGroup[] = [
  {
    id: "layout-group",
    name: "Layout",
    visible: true,
    expanded: true,
    items: [
      {
        id: "base-layout",
        name: "Base layout",
        visible: true,
        parameters: { xMm: 0, yMm: 0, rotationDeg: 0, scalePercent: 100 },
      },
    ],
  },
];

function readStoredSize(key: string, fallback: number) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function createLayerId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createCopyName(name: string, existingNames: Set<string>) {
  let copyName = `${name} copy`;
  let copyNumber = 2;
  while (existingNames.has(copyName.toLocaleLowerCase())) {
    copyName = `${name} copy ${copyNumber++}`;
  }
  existingNames.add(copyName.toLocaleLowerCase());
  return copyName;
}

export function WorkspaceDrawer({ isOpen, onToggle }: WorkspaceDrawerProps) {
  const [drawerWidth, setDrawerWidth] = useState(() =>
    readStoredSize("trackscape.workspaceDrawerWidth", 300),
  );
  const [layersHeight, setLayersHeight] = useState(() =>
    readStoredSize("trackscape.layersPanelHeight", 330),
  );
  const [groups, setGroups] = useState<LayerGroup[]>(INITIAL_GROUPS);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(["item:base-layout"]);
  const [lastSelectedKey, setLastSelectedKey] = useState("item:base-layout");
  const [draggedEntry, setDraggedEntry] = useState<DraggedEntry>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [layerClipboard, setLayerClipboard] = useState<LayerClipboard | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [lowerPanel, setLowerPanel] = useState<"inventory" | "parameters">("inventory");
  const drawerRef = useRef<HTMLElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const cancelRename = useRef(false);

  useEffect(() => {
    try {
      window.localStorage.setItem("trackscape.workspaceDrawerWidth", String(drawerWidth));
      window.localStorage.setItem("trackscape.layersPanelHeight", String(layersHeight));
    } catch {
      // Resizing still works for this session when storage is unavailable.
    }
  }, [drawerWidth, layersHeight]);

  useEffect(() => {
    if (!renamingKey) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renamingKey]);

  useEffect(() => {
    if (!contextMenu) return;
    contextMenuRef.current?.focus();
    const closeMenuFromOutside = (event: globalThis.PointerEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) return;
      setContextMenu(null);
    };
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("pointerdown", closeMenuFromOutside);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", closeMenuFromOutside);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, [contextMenu]);

  useEffect(() => {
    const canvasWorkspace = drawerRef.current?.parentElement?.querySelector(".canvas-workspace");
    if (!canvasWorkspace) return;
    const openCanvasMenu = (event: Event) => {
      const pointerEvent = event as globalThis.MouseEvent;
      pointerEvent.preventDefault();
      setContextMenu({
        x: Math.min(pointerEvent.clientX, window.innerWidth - 184),
        y: Math.min(pointerEvent.clientY, window.innerHeight - 174),
        targetKey: null,
      });
    };
    canvasWorkspace.addEventListener("contextmenu", openCanvasMenu);
    return () => canvasWorkspace.removeEventListener("contextmenu", openCanvasMenu);
  }, []);

  const resizeDrawer = (clientX: number) => {
    const workspaceBounds = drawerRef.current?.parentElement?.getBoundingClientRect();
    if (!workspaceBounds) return;
    setDrawerWidth(Math.round(clamp(workspaceBounds.right - clientX, 0, workspaceBounds.width)));
  };

  const resizePanels = (clientY: number) => {
    const drawerBounds = drawerRef.current?.getBoundingClientRect();
    if (!drawerBounds) return;
    setLayersHeight(Math.round(clamp(clientY - drawerBounds.top, 0, drawerBounds.height)));
  };

  const handleWidthPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeDrawer(event.clientX);
  };

  const handleSplitPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) resizePanels(event.clientY);
  };

  const handleWidthKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const workspaceWidth = drawerRef.current?.parentElement?.getBoundingClientRect().width ?? window.innerWidth;
    setDrawerWidth((width) =>
      clamp(width + (event.key === "ArrowLeft" ? 16 : -16), 0, workspaceWidth),
    );
  };

  const handleSplitKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const drawerHeight = drawerRef.current?.getBoundingClientRect().height ?? 700;
    setLayersHeight((height) =>
      clamp(height + (event.key === "ArrowDown" ? 16 : -16), 0, drawerHeight),
    );
  };

  const addGroup = () => {
    const usedNumbers = new Set(
      groups
        .map((group) => group.name.match(/^Group (\d+)$/i)?.[1])
        .filter((number): number is string => Boolean(number))
        .map(Number),
    );
    let groupNumber = 2;
    while (usedNumbers.has(groupNumber)) groupNumber += 1;
    const groupId = `group-${Date.now()}-${groupNumber}`;
    setGroups((currentGroups) => [
      ...currentGroups,
      {
        id: groupId,
        name: `Group ${groupNumber}`,
        visible: true,
        expanded: true,
        items: [],
      },
    ]);
    setSelectedKeys([`group:${groupId}`]);
    setLastSelectedKey(`group:${groupId}`);
  };

  const beginRename = (key: string, name: string) => {
    cancelRename.current = false;
    setRenamingKey(key);
    setRenameValue(name);
  };

  const commitRename = (key: string, value: string) => {
    if (cancelRename.current) {
      cancelRename.current = false;
      return;
    }
    const name = value.trim();
    if (name) {
      if (key.startsWith("group:")) {
        const groupId = key.slice("group:".length);
        setGroups((currentGroups) =>
          currentGroups.map((group) => (group.id === groupId ? { ...group, name } : group)),
        );
      } else {
        const itemId = key.slice("item:".length);
        setGroups((currentGroups) =>
          currentGroups.map((group) => ({
            ...group,
            items: group.items.map((item) => (item.id === itemId ? { ...item, name } : item)),
          })),
        );
      }
    }
    setRenamingKey(null);
    setRenameValue("");
  };

  const getVisibleLayerKeys = () =>
    groups.flatMap((group) => [
      `group:${group.id}`,
      ...(group.expanded ? group.items.map((item) => `item:${item.id}`) : []),
    ]);

  const selectEntry = (key: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey && lastSelectedKey) {
      const visibleKeys = getVisibleLayerKeys();
      const start = visibleKeys.indexOf(lastSelectedKey);
      const end = visibleKeys.indexOf(key);
      if (start !== -1 && end !== -1) {
        const range = visibleKeys.slice(Math.min(start, end), Math.max(start, end) + 1);
        setSelectedKeys((currentKeys) => [...new Set([...currentKeys, ...range])]);
      } else {
        setSelectedKeys([key]);
      }
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedKeys((currentKeys) =>
        currentKeys.includes(key)
          ? currentKeys.filter((currentKey) => currentKey !== key)
          : [...currentKeys, key],
      );
    } else {
      setSelectedKeys([key]);
    }
    setLastSelectedKey(key);
  };

  const toggleGroupExpanded = (groupId: string) => {
    setGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.id === groupId ? { ...group, expanded: !group.expanded } : group,
      ),
    );
  };

  const toggleGroupVisibility = (groupId: string) => {
    setGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.id === groupId ? { ...group, visible: !group.visible } : group,
      ),
    );
  };

  const toggleItemVisibility = (groupId: string, itemId: string) => {
    setGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              items: group.items.map((item) =>
                item.id === itemId ? { ...item, visible: !item.visible } : item,
              ),
            }
          : group,
      ),
    );
  };

  const deleteGroup = (groupId: string) => {
    setGroups((currentGroups) => currentGroups.filter((group) => group.id !== groupId));
    const group = groups.find((candidate) => candidate.id === groupId);
    const removedKeys = new Set([
      `group:${groupId}`,
      ...(group?.items.map((item) => `item:${item.id}`) ?? []),
    ]);
    setSelectedKeys((currentKeys) => currentKeys.filter((key) => !removedKeys.has(key)));
  };

  const deleteItem = (groupId: string, itemId: string) => {
    setGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.id === groupId
          ? { ...group, items: group.items.filter((item) => item.id !== itemId) }
          : group,
      ),
    );
    setSelectedKeys((currentKeys) => currentKeys.filter((key) => key !== `item:${itemId}`));
  };

  const updateItemParameter = (itemId: string, parameter: keyof ItemParameters, value: number) => {
    if (!Number.isFinite(value)) return;
    setGroups((currentGroups) =>
      currentGroups.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.id === itemId
            ? { ...item, parameters: { ...item.parameters, [parameter]: value } }
            : item,
        ),
      })),
    );
  };

  const getContextActionKeys = () => {
    if (contextMenu?.targetKey && !selectedKeys.includes(contextMenu.targetKey)) {
      return [contextMenu.targetKey];
    }
    return selectedKeys;
  };

  const createClipboardEntries = (keys: string[]) => {
    const selectedGroupIds = new Set(
      keys.filter((key) => key.startsWith("group:")).map((key) => key.slice("group:".length)),
    );
    const selectedItemIds = new Set(
      keys.filter((key) => key.startsWith("item:")).map((key) => key.slice("item:".length)),
    );
    const entries: ClipboardEntry[] = [];
    groups.forEach((group) => {
      if (selectedGroupIds.has(group.id)) {
        entries.push({
          type: "group",
          group: { ...group, items: group.items.map((item) => ({ ...item })) },
        });
        return;
      }
      group.items.forEach((item) => {
        if (selectedItemIds.has(item.id)) {
          entries.push({ type: "item", item: { ...item }, sourceGroupId: group.id });
        }
      });
    });
    return entries;
  };

  const removeEntries = (entries: ClipboardEntry[]) => {
    const groupIds = new Set(
      entries.filter((entry) => entry.type === "group").map((entry) => entry.group.id),
    );
    const itemIds = new Set(
      entries.filter((entry) => entry.type === "item").map((entry) => entry.item.id),
    );
    setGroups((currentGroups) =>
      currentGroups
        .filter((group) => !groupIds.has(group.id))
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !itemIds.has(item.id)),
        })),
    );
    setSelectedKeys([]);
  };

  const copyEntries = (mode: "copy" | "cut") => {
    const entries = createClipboardEntries(getContextActionKeys());
    if (!entries.length) return;
    setLayerClipboard({ mode, entries });
    if (mode === "cut") removeEntries(entries);
    setContextMenu(null);
  };

  const insertEntries = (
    entries: ClipboardEntry[],
    mode: "copy" | "cut",
    targetKey: string | null,
  ) => {
    const insertedKeys: string[] = [];
    const nextGroups = groups.map((group) => ({ ...group, items: [...group.items] }));
    let targetGroupId: string | undefined;
    if (targetKey?.startsWith("group:")) targetGroupId = targetKey.slice("group:".length);
    if (targetKey?.startsWith("item:")) {
      const targetItemId = targetKey.slice("item:".length);
      targetGroupId = nextGroups.find((group) =>
        group.items.some((item) => item.id === targetItemId),
      )?.id;
    }

    const groupNames = new Set(nextGroups.map((group) => group.name.toLocaleLowerCase()));
    entries
      .filter((entry): entry is Extract<ClipboardEntry, { type: "group" }> => entry.type === "group")
      .forEach((entry) => {
        const groupId = createLayerId("group");
        const groupName =
          mode === "copy" ? createCopyName(entry.group.name, groupNames) : entry.group.name;
        nextGroups.push({
          ...entry.group,
          id: groupId,
          name: groupName,
          items: entry.group.items.map((item) => ({ ...item, id: createLayerId("item") })),
        });
        insertedKeys.push(`group:${groupId}`);
      });

    const itemEntries = entries.filter(
      (entry): entry is Extract<ClipboardEntry, { type: "item" }> => entry.type === "item",
    );
    if (itemEntries.length && !nextGroups.length) {
      nextGroups.push({
        id: createLayerId("group"),
        name: "Pasted items",
        visible: true,
        expanded: true,
        items: [],
      });
    }
    itemEntries.forEach((entry) => {
      const targetGroup =
        nextGroups.find((group) => group.id === targetGroupId) ??
        nextGroups.find((group) => group.id === entry.sourceGroupId) ??
        nextGroups[0];
      if (!targetGroup) return;
      const itemNames = new Set(targetGroup.items.map((item) => item.name.toLocaleLowerCase()));
      const itemId = createLayerId("item");
      targetGroup.items.push({
        ...entry.item,
        id: itemId,
        name: mode === "copy" ? createCopyName(entry.item.name, itemNames) : entry.item.name,
      });
      targetGroup.expanded = true;
      insertedKeys.push(`item:${itemId}`);
    });
    setGroups(nextGroups);
    setSelectedKeys(insertedKeys);
    setLastSelectedKey(insertedKeys.at(-1) ?? "");
  };

  const pasteEntries = () => {
    if (!layerClipboard?.entries.length) return;
    insertEntries(layerClipboard.entries, layerClipboard.mode, contextMenu?.targetKey ?? null);
    if (layerClipboard.mode === "cut") setLayerClipboard(null);
    setContextMenu(null);
  };

  const duplicateEntries = () => {
    const entries = createClipboardEntries(getContextActionKeys());
    if (!entries.length) return;
    insertEntries(entries, "copy", contextMenu?.targetKey ?? null);
    setContextMenu(null);
  };

  const openContextMenu = (event: ReactMouseEvent<HTMLElement>, targetKey: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    if (targetKey && !selectedKeys.includes(targetKey)) {
      setSelectedKeys([targetKey]);
      setLastSelectedKey(targetKey);
    }
    setContextMenu({
      x: Math.max(4, Math.min(event.clientX, window.innerWidth - 184)),
      y: Math.max(4, Math.min(event.clientY, window.innerHeight - 174)),
      targetKey,
    });
  };

  const startDragging = (event: ReactDragEvent<HTMLDivElement>, entry: Exclude<DraggedEntry, null>) => {
    setDraggedEntry(entry);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "text/plain",
      entry.type === "group" ? `group:${entry.groupId}` : `item:${entry.itemId}`,
    );
  };

  const moveGroup = (sourceGroupId: string, targetGroupId: string) => {
    if (sourceGroupId === targetGroupId) return;
    setGroups((currentGroups) => {
      const reorderedGroups = [...currentGroups];
      const sourceIndex = reorderedGroups.findIndex((group) => group.id === sourceGroupId);
      if (sourceIndex === -1) return currentGroups;
      const [movedGroup] = reorderedGroups.splice(sourceIndex, 1);
      const targetIndex = reorderedGroups.findIndex((group) => group.id === targetGroupId);
      if (targetIndex === -1) return currentGroups;
      reorderedGroups.splice(targetIndex, 0, movedGroup);
      return reorderedGroups;
    });
  };

  const moveItem = (sourceGroupId: string, itemId: string, targetGroupId: string, targetItemId?: string) => {
    if (itemId === targetItemId) return;
    setGroups((currentGroups) => {
      const nextGroups = currentGroups.map((group) => ({ ...group, items: [...group.items] }));
      const sourceGroup = nextGroups.find((group) => group.id === sourceGroupId);
      const sourceIndex = sourceGroup?.items.findIndex((item) => item.id === itemId) ?? -1;
      if (!sourceGroup || sourceIndex === -1) return currentGroups;
      const [movedItem] = sourceGroup.items.splice(sourceIndex, 1);
      const targetGroup = nextGroups.find((group) => group.id === targetGroupId);
      if (!targetGroup) return currentGroups;
      const targetIndex = targetItemId
        ? targetGroup.items.findIndex((item) => item.id === targetItemId)
        : targetGroup.items.length;
      targetGroup.items.splice(targetIndex === -1 ? targetGroup.items.length : targetIndex, 0, movedItem);
      targetGroup.expanded = true;
      return nextGroups;
    });
  };

  const handleDrop = (targetGroupId: string, targetItemId?: string) => {
    if (draggedEntry?.type === "group" && !targetItemId) {
      moveGroup(draggedEntry.groupId, targetGroupId);
    }
    if (draggedEntry?.type === "item") {
      moveItem(draggedEntry.groupId, draggedEntry.itemId, targetGroupId, targetItemId);
    }
    setDraggedEntry(null);
    setDropTargetKey(null);
  };

  const itemCount = groups.reduce((count, group) => count + group.items.length, 0);
  const selectedItems = groups.flatMap((group) =>
    group.items.filter((item) => selectedKeys.includes(`item:${item.id}`)),
  );
  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : null;
  const workspaceWidth = Math.round(
    drawerRef.current?.parentElement?.getBoundingClientRect().width ?? window.innerWidth,
  );
  const drawerHeight = Math.round(drawerRef.current?.getBoundingClientRect().height ?? window.innerHeight);
  const drawerStyle = {
    "--workspace-drawer-width": `${drawerWidth}px`,
    "--layers-panel-height": `${layersHeight}px`,
  } as CSSProperties;

  return (
    <>
      <button
        className={`workspace-drawer-tab${isResizingWidth ? " is-resizing" : ""}`}
        style={drawerStyle}
        type="button"
        aria-label={isOpen ? "Close workspace panel" : "Open workspace panel"}
        aria-controls="workspace-drawer"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span aria-hidden="true" />
      </button>

      <div
        className="drawer-width-resizer"
        style={drawerStyle}
        role="separator"
        aria-label="Resize workspace panel"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={workspaceWidth}
        aria-valuenow={drawerWidth}
        tabIndex={isOpen ? 0 : -1}
        onKeyDown={handleWidthKey}
        onPointerDown={(event) => {
          event.preventDefault();
          setIsResizingWidth(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          resizeDrawer(event.clientX);
        }}
        onPointerMove={handleWidthPointer}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          setIsResizingWidth(false);
        }}
        onPointerCancel={() => setIsResizingWidth(false)}
      />

      <aside
        className={`workspace-drawer${isResizingWidth ? " is-resizing" : ""}`}
        id="workspace-drawer"
        ref={drawerRef}
        style={drawerStyle}
        aria-label="Workspace panel"
        aria-hidden={!isOpen}
      >
        <section className="workspace-drawer-section layers-section" aria-labelledby="layers-title">
          <header className="workspace-drawer-heading">
            <div>
              <h2 id="layers-title">Layers</h2>
              <span>
                {groups.length} {groups.length === 1 ? "group" : "groups"} · {itemCount}{" "}
                {itemCount === 1 ? "item" : "items"}
              </span>
            </div>
            <button
              className="new-group-button"
              type="button"
              aria-label="New group"
              title="New group"
              onClick={addGroup}
            >
              <span className="plus-icon" aria-hidden="true" />
            </button>
          </header>

          <div
            className="layers-list"
            role="tree"
            aria-label="Layout layers"
            onContextMenu={(event) => {
              if (event.target === event.currentTarget) openContextMenu(event, null);
            }}
          >
            {groups.map((group) => {
              const groupKey = `group:${group.id}`;
              const groupSelected = selectedKeys.includes(groupKey);
              return (
                <div className="layer-group" key={group.id} role="treeitem" aria-expanded={group.expanded}>
                  <div
                    className={`layer-entry group-entry${groupSelected ? " is-active" : ""}${
                      dropTargetKey === groupKey ? " is-drop-target" : ""
                    }`}
                    draggable
                    onContextMenu={(event) => openContextMenu(event, groupKey)}
                    onDragStart={(event) =>
                      startDragging(event, { type: "group", groupId: group.id })
                    }
                    onDragEnd={() => {
                      setDraggedEntry(null);
                      setDropTargetKey(null);
                    }}
                    onDragOver={(event) => {
                      if (!draggedEntry || (draggedEntry.type === "group" && draggedEntry.groupId === group.id)) {
                        return;
                      }
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropTargetKey(groupKey);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDrop(group.id);
                    }}
                  >
                    <span className="layer-drag-handle" aria-hidden="true" />
                    <button
                      className={`layer-expand-button${group.expanded ? " is-expanded" : ""}`}
                      type="button"
                      aria-label={`${group.expanded ? "Collapse" : "Expand"} ${group.name}`}
                      onClick={() => toggleGroupExpanded(group.id)}
                    >
                      <span aria-hidden="true" />
                    </button>
                    <button
                      className="layer-visibility-button"
                      type="button"
                      aria-label={`${group.visible ? "Hide" : "Show"} group ${group.name}`}
                      aria-pressed={group.visible}
                      onClick={() => toggleGroupVisibility(group.id)}
                    >
                      <img src={group.visible ? eyeIcon : eyeClosedIcon} alt="" aria-hidden="true" />
                    </button>
                    {renamingKey === groupKey ? (
                      <div className="layer-select-button is-renaming">
                        <span className="group-marker" aria-hidden="true" />
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          aria-label={`Rename group ${group.name}`}
                          draggable={false}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onBlur={(event) => commitRename(groupKey, event.currentTarget.value)}
                          onPointerDown={(event) => event.stopPropagation()}
                          onDragStart={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              event.stopPropagation();
                              cancelRename.current = true;
                              setRenamingKey(null);
                              setRenameValue("");
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        className="layer-select-button"
                        type="button"
                        title="Double-click to rename"
                        aria-pressed={groupSelected}
                        onClick={(event) => selectEntry(groupKey, event)}
                        onDoubleClick={() => beginRename(groupKey, group.name)}
                        onKeyDown={(event) => {
                          if (event.key === "F2") beginRename(groupKey, group.name);
                        }}
                      >
                        <span className="group-marker" aria-hidden="true" />
                        <span>{group.name}</span>
                      </button>
                    )}
                    <button
                      className="layer-delete-button"
                      type="button"
                      aria-label={`Delete group ${group.name}`}
                      onClick={() => deleteGroup(group.id)}
                    >
                      <img src={crossIcon} alt="" aria-hidden="true" />
                    </button>
                  </div>

                  {group.expanded && (
                    <div className="group-items" role="group">
                      {group.items.map((item) => {
                        const itemKey = `item:${item.id}`;
                        const itemSelected = selectedKeys.includes(itemKey);
                        return (
                          <div
                            className={`layer-entry item-entry${itemSelected ? " is-active" : ""}${
                              group.visible ? "" : " is-parent-hidden"
                            }${dropTargetKey === itemKey ? " is-drop-target" : ""}`}
                            key={item.id}
                            role="treeitem"
                            draggable
                            onContextMenu={(event) => openContextMenu(event, itemKey)}
                            onDragStart={(event) =>
                              startDragging(event, {
                                type: "item",
                                groupId: group.id,
                                itemId: item.id,
                              })
                            }
                            onDragEnd={() => {
                              setDraggedEntry(null);
                              setDropTargetKey(null);
                            }}
                            onDragOver={(event) => {
                              if (draggedEntry?.type !== "item" || draggedEntry.itemId === item.id) {
                                return;
                              }
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                              setDropTargetKey(itemKey);
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              handleDrop(group.id, item.id);
                            }}
                          >
                            <span className="layer-drag-handle" aria-hidden="true" />
                            <span className="item-branch" aria-hidden="true" />
                            <button
                              className="layer-visibility-button"
                              type="button"
                              aria-label={`${item.visible ? "Hide" : "Show"} item ${item.name}`}
                              aria-pressed={item.visible}
                              onClick={() => toggleItemVisibility(group.id, item.id)}
                            >
                              <img src={item.visible ? eyeIcon : eyeClosedIcon} alt="" aria-hidden="true" />
                            </button>
                            {renamingKey === itemKey ? (
                              <div className="layer-select-button is-renaming">
                                <span className="item-marker" aria-hidden="true" />
                                <input
                                  ref={renameInputRef}
                                  value={renameValue}
                                  aria-label={`Rename item ${item.name}`}
                                  draggable={false}
                                  onChange={(event) => setRenameValue(event.target.value)}
                                  onBlur={(event) => commitRename(itemKey, event.currentTarget.value)}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onDragStart={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      cancelRename.current = true;
                                      setRenamingKey(null);
                                      setRenameValue("");
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <button
                                className="layer-select-button"
                                type="button"
                                title="Double-click to rename"
                                aria-pressed={itemSelected}
                                onClick={(event) => selectEntry(itemKey, event)}
                                onDoubleClick={() => beginRename(itemKey, item.name)}
                                onKeyDown={(event) => {
                                  if (event.key === "F2") beginRename(itemKey, item.name);
                                }}
                              >
                                <span className="item-marker" aria-hidden="true" />
                                <span>{item.name}</span>
                              </button>
                            )}
                            <button
                              className="layer-delete-button"
                              type="button"
                              aria-label={`Delete item ${item.name}`}
                              onClick={() => deleteItem(group.id, item.id)}
                            >
                              <img src={crossIcon} alt="" aria-hidden="true" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div
          className="panel-split-resizer"
          role="separator"
          aria-label="Resize Layers and Inventory panels"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={drawerHeight}
          aria-valuenow={layersHeight}
          tabIndex={0}
          onKeyDown={handleSplitKey}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            resizePanels(event.clientY);
          }}
          onPointerMove={handleSplitPointer}
        >
          <span aria-hidden="true" />
        </div>

        <section
          className="workspace-drawer-section inventory-section"
          aria-labelledby="lower-panel-title"
        >
          <header className="workspace-drawer-heading lower-panel-heading">
            <div className="lower-panel-tabs" role="tablist" aria-label="Workspace details">
              <button
                className={lowerPanel === "inventory" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-label="Inventory"
                aria-selected={lowerPanel === "inventory"}
                aria-controls="inventory-panel"
                title="Inventory"
                onClick={() => setLowerPanel("inventory")}
              >
                <img src={inventoryIcon} alt="" aria-hidden="true" />
              </button>
              <button
                className={lowerPanel === "parameters" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-label="Parameters"
                aria-selected={lowerPanel === "parameters"}
                aria-controls="parameters-panel"
                title="Parameters"
                onClick={() => setLowerPanel("parameters")}
              >
                <img src={parametersIcon} alt="" aria-hidden="true" />
              </button>
            </div>
            <h2 id="lower-panel-title">{lowerPanel === "inventory" ? "Inventory" : "Parameters"}</h2>
          </header>
          {lowerPanel === "inventory" ? (
            <div
              className="inventory-body lower-panel-body"
              id="inventory-panel"
              role="tabpanel"
              aria-label="Inventory items"
            />
          ) : (
            <div
              className="parameters-body lower-panel-body"
              id="parameters-panel"
              role="tabpanel"
              aria-label="Object parameters"
            >
              {selectedItem ? (
                <>
                  <div className="parameters-object-heading">
                    <span>Selected object</span>
                    <strong>{selectedItem.name}</strong>
                  </div>
                  <fieldset className="parameter-section">
                    <legend>Transform</legend>
                    <label>
                      <span>X position</span>
                      <span className="parameter-input">
                        <input
                          type="number"
                          step="1"
                          value={selectedItem.parameters.xMm}
                          onChange={(event) =>
                            updateItemParameter(selectedItem.id, "xMm", event.currentTarget.valueAsNumber)
                          }
                        />
                        <small>mm</small>
                      </span>
                    </label>
                    <label>
                      <span>Y position</span>
                      <span className="parameter-input">
                        <input
                          type="number"
                          step="1"
                          value={selectedItem.parameters.yMm}
                          onChange={(event) =>
                            updateItemParameter(selectedItem.id, "yMm", event.currentTarget.valueAsNumber)
                          }
                        />
                        <small>mm</small>
                      </span>
                    </label>
                    <label>
                      <span>Rotation</span>
                      <span className="parameter-input">
                        <input
                          type="number"
                          step="1"
                          value={selectedItem.parameters.rotationDeg}
                          onChange={(event) =>
                            updateItemParameter(
                              selectedItem.id,
                              "rotationDeg",
                              event.currentTarget.valueAsNumber,
                            )
                          }
                        />
                        <small>deg</small>
                      </span>
                    </label>
                    <label>
                      <span>Scale</span>
                      <span className="parameter-input">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={selectedItem.parameters.scalePercent}
                          onChange={(event) =>
                            updateItemParameter(
                              selectedItem.id,
                              "scalePercent",
                              event.currentTarget.valueAsNumber,
                            )
                          }
                        />
                        <small>%</small>
                      </span>
                    </label>
                  </fieldset>
                </>
              ) : (
                <div className="parameters-empty">
                  <strong>{selectedItems.length > 1 ? `${selectedItems.length} objects selected` : "No object selected"}</strong>
                  <span>
                    {selectedItems.length > 1
                      ? "Select one object to adjust its parameters."
                      : "Select an item in Layers to view its parameters."}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </aside>

      {contextMenu && (
        <div
          className="workspace-context-menu"
          ref={contextMenuRef}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label="Workspace actions"
          tabIndex={-1}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setContextMenu(null);
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={!getContextActionKeys().length}
            onClick={() => copyEntries("copy")}
          >
            <span>Copy</span>
            <kbd>Ctrl+C</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!getContextActionKeys().length}
            onClick={() => copyEntries("cut")}
          >
            <span>Cut</span>
            <kbd>Ctrl+X</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!layerClipboard?.entries.length}
            onClick={pasteEntries}
          >
            <span>Paste</span>
            <kbd>Ctrl+V</kbd>
          </button>
          <button
            className="context-menu-duplicate"
            type="button"
            role="menuitem"
            disabled={!getContextActionKeys().length}
            onClick={duplicateEntries}
          >
            <span>Duplicate</span>
            <kbd>Ctrl+D</kbd>
          </button>
        </div>
      )}
    </>
  );
}

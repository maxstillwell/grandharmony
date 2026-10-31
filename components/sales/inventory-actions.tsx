"use client";
import { useId, useRef, useState } from "react";
import type { Data, Unit } from "./types";
import { nextUnitStatuses } from "@/lib/sales/domain";
import styles from "./inventory.module.css";
export type ResidenceView =
  | "details"
  | "edit"
  | "status"
  | "pricing"
  | "activity"
  | "crm";
export function InventoryActions({
  unit,
  permissions,
  onAction,
}: {
  unit: Unit;
  permissions: Data["permissions"];
  onAction: (view: ResidenceView) => void;
}) {
  const id = useId(),
    menu = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const items: Array<readonly [ResidenceView, string]> = [
    ["details", "View Residence"],
    ...(permissions["inventory.edit"]
      ? [["edit", "Edit Residence"] as const]
      : []),
    ...(permissions["status.edit"] && nextUnitStatuses(unit.status).length
      ? [["status", "Change Sales Status"] as const]
      : []),
    ...(permissions["prices.view"] || permissions["publicPrices.edit"]
      ? [["pricing", "Manage Pricing"] as const]
      : []),
    ...(permissions["audit.view"]
      ? [["activity", "View Activity"] as const]
      : []),
    ...(permissions["crm.view"] ? [["crm", "View CRM Leads"] as const] : []),
  ];
  function open() {
    const el = menu.current,
      rect = trigger.current?.getBoundingClientRect();
    if (!el || !rect) return;
    el.style.left = `${Math.max(8, Math.min(innerWidth - 240, rect.right - 228))}px`;
    el.style.top = `${Math.max(8, Math.min(innerHeight - items.length * 42 - 24, rect.bottom + 5))}px`;
    el.showPopover();
    el.querySelector<HTMLButtonElement>("button")?.focus();
  }
  return (
    <>
      <button
        ref={trigger}
        aria-label={`Actions residence ${unit.number}`}
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => (expanded ? menu.current?.hidePopover() : open())}
      >
        Actions ▾
      </button>
      <div
        id={id}
        ref={menu}
        popover="auto"
        role="menu"
        aria-label={`Residence ${unit.number} actions`}
        className={styles.menu}
        onToggle={(e) => setExpanded(e.newState === "open")}
        onKeyDown={(e) => {
          const buttons = [...e.currentTarget.querySelectorAll("button")];
          const current = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            const index =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? buttons.length - 1
                  : (current +
                      (e.key === "ArrowUp" ? -1 : 1) +
                      buttons.length) %
                    buttons.length;
            buttons[index]?.focus();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            menu.current?.hidePopover();
            trigger.current?.focus();
          }
        }}
      >
        {items.map(([view, title]) => (
          <button
            key={view}
            role="menuitem"
            onClick={() => {
              menu.current?.hidePopover();
              trigger.current?.focus();
              onAction(view);
            }}
          >
            {title}
          </button>
        ))}
      </div>
    </>
  );
}

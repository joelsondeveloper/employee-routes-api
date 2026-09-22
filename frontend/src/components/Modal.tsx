import {useEffect, useRef, type ReactNode} from "react";

interface ModalProps {
  titleId: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  role?: "dialog" | "alertdialog";
}

export function Modal({titleId, children, onClose, busy = false, role = "dialog"}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => { dialog.close(); previousFocus?.focus(); };
  }, []);
  return <dialog
    ref={ref}
    className="modal"
    role={role}
    aria-labelledby={titleId}
    aria-modal="true"
    aria-busy={busy}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
  >{children}</dialog>;
}

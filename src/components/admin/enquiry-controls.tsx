"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import {
  changeInspectionStatusAction,
  deleteInspectionAction,
  deleteMessageAction,
  type Result,
  saveInspectionNotesAction,
  setMessageArchivedAction,
  setMessageReadAction,
} from "@/features/enquiries/admin-actions";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function useResult() {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>) => startTransition(async () => setResult(await fn()));
  const notice = result && <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice>;
  return { pending, run, notice };
}

export function InspectionStatusForm({ id, status }: { id: string; status: string }) {
  const [next, setNext] = useState(status);
  const [note, setNote] = useState("");
  const { pending, run, notice } = useResult();
  return (
    <div className="flex flex-col gap-4">
      {notice}
      <FormField id="status" label="Status">
        <Select id="status" value={next} onChange={(e) => setNext(e.target.value)} options={STATUS_OPTIONS} />
      </FormField>
      <FormField id="status-note" label="Note for the history" optionalLabel hint="e.g. Confirmed for Saturday 10am.">
        <Textarea id="status-note" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      </FormField>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        loading={pending}
        disabled={next === status}
        onClick={() =>
          run(async () => {
            const result = await changeInspectionStatusAction(id, next, note);
            if (result.ok) setNote("");
            return result;
          })
        }
      >
        Update status
      </Button>
    </div>
  );
}

export function InspectionNotesForm({ id, notes }: { id: string; notes: string }) {
  const [value, setValue] = useState(notes);
  const { pending, run, notice } = useResult();
  return (
    <div className="flex flex-col gap-4">
      {notice}
      <FormField id="admin-notes" label="Staff notes" hint="Only visible in the dashboard.">
        <Textarea id="admin-notes" rows={4} value={value} maxLength={5000} onChange={(e) => setValue(e.target.value)} />
      </FormField>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        loading={pending}
        disabled={value === notes}
        onClick={() => run(() => saveInspectionNotesAction(id, value))}
      >
        Save notes
      </Button>
    </div>
  );
}

function DeleteButton({
  label,
  confirmText,
  onDelete,
}: {
  label: string;
  confirmText: string;
  onDelete: () => Promise<Result>;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run, notice } = useResult();
  return (
    <>
      {notice}
      <Button size="sm" variant="quiet" className="self-start text-danger" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${label}?`}>
        <div className="flex flex-col gap-6">
          <p className="text-small text-ink">{confirmText}</p>
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                run(async () => {
                  const result = await onDelete();
                  setOpen(false);
                  return result;
                })
              }
            >
              Delete permanently
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function DeleteInspection({ id }: { id: string }) {
  return (
    <DeleteButton
      label="Delete request"
      confirmText="The request and its history are deleted permanently. Use Cancelled to keep a record instead."
      onDelete={() => deleteInspectionAction(id)}
    />
  );
}

export function MessageControls({
  id,
  isRead,
  archived,
  canEdit,
  canDelete,
}: {
  id: string;
  isRead: boolean;
  archived: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { pending, run, notice } = useResult();
  return (
    <div className="flex flex-col gap-3">
      {notice}
      <div className="flex flex-wrap gap-3">
        {canEdit && (
          <>
            <Button
              size="sm"
              variant="secondary"
              loading={pending}
              onClick={() => run(() => setMessageArchivedAction(id, !archived))}
            >
              {archived ? "Move to inbox" : "Archive"}
            </Button>
            {isRead && !archived && (
              <Button
                size="sm"
                variant="quiet"
                loading={pending}
                onClick={() => run(() => setMessageReadAction(id, false))}
              >
                Mark as unread
              </Button>
            )}
          </>
        )}
        {canDelete && (
          <DeleteButton
            label="Delete message"
            confirmText="The message is deleted permanently."
            onDelete={() => deleteMessageAction(id)}
          />
        )}
      </div>
    </div>
  );
}

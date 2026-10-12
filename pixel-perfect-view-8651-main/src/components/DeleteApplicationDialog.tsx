import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteApplication } from "@/lib/queries";
import type { Application } from "@/lib/types";

export function DeleteApplicationDialog({
  application, onOpenChange, onDeleted,
}: { application: Application | null; onOpenChange: (o: boolean) => void; onDeleted?: () => void }) {
  const del = useDeleteApplication();
  return (
    <AlertDialog open={!!application} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this application?</AlertDialogTitle>
          <AlertDialogDescription>
            {application && <>{application.role} at {application.company} will be removed, including its notes and timeline.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={del.isPending}
            onClick={async (e) => {
              e.preventDefault();
              if (!application) return;
              try {
                await del.mutateAsync(application.id);
                toast.success("Application deleted");
                onOpenChange(false);
                onDeleted?.();
              } catch {
                toast.error("Couldn't delete the application. Try again.");
              }
            }}
          >
            {del.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

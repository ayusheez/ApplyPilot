import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { ApplicationInput, ImportSaveRequest } from "./types";

export const useApplications = () => useQuery({ queryKey: ["applications"], queryFn: api.listApplications });
export const useApplication = (id: string) =>
  useQuery({ queryKey: ["applications", id], queryFn: () => api.getApplication(id) });

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["applications"] });
}

export function useCreateApplication() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (i: ApplicationInput) => api.createApplication(i), onSuccess: inv });
}
export function useUpdateApplication() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ApplicationInput> }) => api.updateApplication(id, patch),
    onSuccess: inv,
  });
}
export function useDeleteApplication() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.deleteApplication(id), onSuccess: inv });
}
export function useSaveImport() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (r: ImportSaveRequest) => api.saveImport(r), onSuccess: inv });
}

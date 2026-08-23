import { api } from "./api";

/**
 * Downloads a CSV export from the CRM backend respecting the active filters.
 *
 * @param endpoint - Backend endpoint (e.g. "/opportunities/export")
 * @param params - Current filter/search parameters (e.g. { search: "acme", stageId: "..." })
 * @param fallbackFilename - Name of the downloaded file
 */
export async function downloadCsvExport(
  endpoint: string,
  params: Record<string, any> = {},
  fallbackFilename = "export.csv"
): Promise<void> {
  const cleanParams: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      cleanParams[k] = v;
    }
  }

  const response = await api.get(endpoint, {
    params: cleanParams,
    responseType: "blob",
  });

  // Extract filename from Content-Disposition header if present
  let filename = fallbackFilename;
  const disposition = response.headers["content-disposition"];
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match?.[1]) filename = match[1];
  }

  const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

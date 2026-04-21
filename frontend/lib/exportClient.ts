/**
 * Export client for downloading resources as PDF
 */

import { parseBackendError, formatErrorForDisplay } from './errorHandler';
import { signRequest } from './sigv4Signer';

/**
 * Export resources for a session as PDF
 * @param sessionId - The session ID to export resources for
 * @returns Blob containing the PDF file
 * @throws Error if export fails or no resources found
 */
export async function exportResourcesPDF(sessionId: string): Promise<Blob> {
  // Use API Gateway endpoint
  const apiUrl = process.env.NEXT_PUBLIC_EXPORT_RESOURCES_URL;

  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_EXPORT_RESOURCES_URL not configured');
  }

  // Sign the GET request
  const { url, headers } = await signRequest(
    `${apiUrl}/export-resources/${sessionId}`,
    'GET',
    undefined,
    { 'Accept': 'application/pdf' }
  );

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    // Handle 404 - no resources found (special case with custom message)
    if (response.status === 404) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'No resources found. Please search for resources first.');
      } catch (parseError) {
        throw new Error('No resources found. Please search for resources first.');
      }
    }

    // Parse backend error and throw with user-friendly message
    const userError = await parseBackendError(response);
    const errorMessage = formatErrorForDisplay(userError);
    throw new Error(errorMessage);
  }

  return await response.blob();
}

/**
 * Download a blob as a file
 * @param blob - The blob to download
 * @param filename - The filename to save as
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export and download resources as PDF
 * @param sessionId - The session ID to export resources for
 * @returns Promise that resolves when download starts
 */
export async function exportAndDownloadResources(sessionId: string): Promise<void> {
  const pdfBlob = await exportResourcesPDF(sessionId);
  const timestamp = Date.now();
  const filename = `resources-${timestamp}.pdf`;
  downloadBlob(pdfBlob, filename);
}

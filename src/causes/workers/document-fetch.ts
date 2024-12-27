export interface FetchResponse {
  code: number;
  buffer: number[];
  error?: string;
}

const DEFAULT_BASE_DOC_URL = "https://oficinajudicialvirtual.pjud.cl/";

export async function fetchDocument(
  docURL: string,
  baseURL: string = DEFAULT_BASE_DOC_URL
): Promise<FetchResponse> {
  try {
    const fullURL = new URL(docURL, baseURL).toString();

    const response = await fetch(fullURL, { method: "GET" });

    if (!response.ok) {
      return {
        code: response.status,
        buffer: [],
        error: `Error fetching document: ${response.statusText}`,
      };
    }

    const buffer = await response.arrayBuffer();
    return {
      code: 200,
      buffer: Array.from(new Uint8Array(buffer)),
    };
  } catch (error) {
    let errorMessage = "Unknown error occurred";

    // Manejo específico de errores
    if (error instanceof TypeError) {
      errorMessage = `Network or URL error: ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      code: 500,
      buffer: [],
      error: errorMessage,
    };
  }
}

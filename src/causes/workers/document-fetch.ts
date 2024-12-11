export interface FetchResponse {
  code: number;
  buffer: number[];
}

const BASE_DOC_URL = "https://oficinajudicialvirtual.pjud.cl/";

export async function fetchDocument(docURL: string): Promise<FetchResponse> {
  try {
    const response = await fetch(BASE_DOC_URL + docURL, {
      method: "GET",
    });

    if (!response.ok) {
      return { code: response.status, buffer: [] };
    }

    const buffer = await response.arrayBuffer();
    return { code: 200, buffer: Array.from(new Uint8Array(buffer)) };
  } catch (error) {
    return { code: 500, buffer: [] };
  }
}

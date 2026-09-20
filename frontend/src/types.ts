/**
 * Data structures and types for Automate Payload Extractor
 */

export interface AutomateSession {
  id: string;
  name?: string;
  createdAt?: string | number;
}

export interface AutomatePayloadItem {
  raw?: string;
  value?: string;
}

export interface AutomateEntry {
  id: string;
  sequenceId?: number;
  payloads?: (string | AutomatePayloadItem)[];
  payload?: string;
  raw?: string;
  statusCode?: number;
  response?: {
    statusCode?: number;
    code?: number;
    length?: number;
  };
}

export interface FilterOptions {
  statusCategory: "all" | "200" | "2xx" | "3xx" | "4xx" | "5xx";
  searchQuery?: string;
  deduplicate?: boolean;
}

export interface ExtractedPayload {
  payload: string;
  statusCode: number;
}

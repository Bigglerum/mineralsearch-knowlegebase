export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie' | 'body';
  description?: string;
  required?: boolean;
  schema?: Schema;
  example?: any;
}

export interface Schema {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  default?: any;
  items?: Schema;
  enum?: any[];
  properties?: Record<string, Schema>;
  required?: string[];
}

export interface APICategory {
  id: number;
  name: string;
  description?: string;
  endpoints: APIEndpoint[];
}

export interface APIEndpoint {
  id: number;
  path: string;
  method: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  responses?: Record<string, any>;
  categoryId?: number;
}

export interface SavedRequest {
  id: number;
  name: string;
  endpointId: number;
  endpoint?: APIEndpoint;
  parameters: Record<string, any>;
  userId: number;
  createdAt: string;
}

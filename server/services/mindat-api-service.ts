interface MindatAuthConfig {
  username?: string;
  password?: string;
  apiKey?: string;
}

interface MindatSearchParams {
  page?: number;
  page_size?: number;
  fields?: string;
  name?: string;
  elements?: string;
  ima_formula?: string;
  crystal_system?: string;
  ordering?: string;
}

export class MindatAPIService {
  private static instance: MindatAPIService;
  private baseUrl = 'https://api.mindat.org';
  private authConfig: MindatAuthConfig;

  private constructor() {
    this.authConfig = {
      username: process.env.MINDAT_USERNAME,
      password: process.env.MINDAT_PASS,
      apiKey: process.env.MINDAT_API_KEY,
    };
  }

  static getInstance(): MindatAPIService {
    if (!MindatAPIService.instance) {
      MindatAPIService.instance = new MindatAPIService();
    }
    return MindatAPIService.instance;
  }

  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authConfig.apiKey) {
      headers['Authorization'] = `Token ${this.authConfig.apiKey}`;
    } else if (this.authConfig.username && this.authConfig.password) {
      const base64Auth = Buffer.from(
        `${this.authConfig.username}:${this.authConfig.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${base64Auth}`;
    }

    return headers;
  }

  async searchMinerals(params: MindatSearchParams = {}): Promise<any> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params.fields) queryParams.append('fields', params.fields);
    if (params.name) queryParams.append('name', params.name);
    if (params.elements) queryParams.append('elements', params.elements);
    if (params.ima_formula) queryParams.append('ima_formula', params.ima_formula);
    if (params.crystal_system) queryParams.append('crystal_system', params.crystal_system);
    if (params.ordering) queryParams.append('ordering', params.ordering);

    const url = `${this.baseUrl}/minerals/?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Mindat API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching minerals from Mindat:', error);
      throw error;
    }
  }

  async getMineralById(id: number): Promise<any> {
    const url = `${this.baseUrl}/minerals/${id}/`;

    try {
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Mindat API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching mineral ${id} from Mindat:`, error);
      throw error;
    }
  }

  async searchLocalities(params: { name?: string; page?: number; page_size?: number } = {}): Promise<any> {
    const queryParams = new URLSearchParams();
    
    if (params.name) queryParams.append('name', params.name);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.page_size) queryParams.append('page_size', params.page_size.toString());

    const url = `${this.baseUrl}/localities/?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Mindat API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching localities from Mindat:', error);
      throw error;
    }
  }

  async getLocalityById(id: number): Promise<any> {
    const url = `${this.baseUrl}/localities/${id}/`;

    try {
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Mindat API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching locality ${id} from Mindat:`, error);
      throw error;
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await this.searchMinerals({ page_size: 1 });
      return !!response;
    } catch (error) {
      return false;
    }
  }
}

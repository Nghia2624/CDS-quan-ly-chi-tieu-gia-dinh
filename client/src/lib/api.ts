import { authService } from './auth';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(endpoint, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  }

  // Expense APIs
  async createExpense(expense: {
    description: string;
    amount: number;
    category?: string;
  }) {
    return this.request('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  }

  async getExpenses(limit?: number) {
    const url = limit ? `/api/expenses?limit=${limit}` : '/api/expenses';
    return this.request<{ expenses: any[] }>(url);
  }

  // Chat APIs
  async sendChatMessage(message: string) {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getChatHistory(limit?: number) {
    const url = limit ? `/api/chat/history?limit=${limit}` : '/api/chat/history';
    return this.request<{ messages: any[] }>(url);
  }

  // Stats APIs
  async getStats() {
    return this.request('/api/stats');
  }
}

export const apiService = new ApiService();
import { authService } from './auth';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  // Public request method for direct API calls
  async request(
    method: string,
    endpoint: string, 
    data?: any
  ): Promise<Response> {
    const baseUrl = process.env.VITE_API_URL || 'http://localhost:5000';
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    return fetch(fullUrl, config);
  }

  private async requestJson<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const baseUrl = process.env.VITE_API_URL || 'http://localhost:5000';
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(fullUrl, config);
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
    return this.requestJson('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  }

  async getExpenses(limit?: number) {
    const url = limit ? `/api/expenses?limit=${limit}` : '/api/expenses';
    const response = await this.requestJson<{ 
      expenses: any[];
      familyId: string;
      totalCount: number;
      lastSync: string;
    }>(url);
    
    // Store sync information in localStorage for data consistency
    if (response.lastSync) {
      localStorage.setItem('lastExpenseSync', response.lastSync);
      localStorage.setItem('familyId', response.familyId);
    }
    
    return response;
  }

  // Chat APIs
  async createChatSession(title?: string) {
    return this.requestJson('/api/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async getChatSessions() {
    return this.requestJson<{ sessions: any[] }>('/api/chat/sessions');
  }

  async sendChatMessage(sessionId: string, message: string) {
    return this.requestJson(`/api/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getChatHistory(sessionId: string) {
    return this.requestJson<{ messages: any[] }>(`/api/chat/sessions/${sessionId}/messages`);
  }

  // Legacy method for backward compatibility
  async getChatHistoryLegacy(limit?: number) {
    // Try to get the first session or create one
    try {
      const sessions = await this.getChatSessions();
      if (sessions.sessions && sessions.sessions.length > 0) {
        return this.getChatHistory(sessions.sessions[0].id);
      } else {
        // Create a new session
        const newSession = await this.createChatSession() as any;
        return this.getChatHistory(newSession.session.id);
      }
    } catch (error) {
      console.error('Error getting chat history:', error);
      return { messages: [] };
    }
  }

  // Stats APIs
  async getStats() {
    const response = await this.requestJson<{
      totalAmount: number;
      categoryStats: any[];
      insights: string;
      familyId: string;
      lastSync: string;
      dataVersion: number;
      syncStatus: string;
    }>('/api/stats');
    
    // Store sync information
    if (response.lastSync) {
      localStorage.setItem('lastStatsSync', response.lastSync);
    }
    
    return response;
  }

  // Family APIs
  async getFamilyMembers() {
    const response = await this.requestJson<{
      members: any[];
      familyId: string;
      totalCount: number;
      lastSync: string;
    }>('/api/family/members');
    
    // Store sync information
    if (response.lastSync) {
      localStorage.setItem('lastFamilySync', response.lastSync);
    }
    
    return response;
  }

  async inviteFamilyMember(memberData: {
    email: string;
    fullName: string;
    role: string;
  }) {
    return this.requestJson('/api/family/invite', {
      method: 'POST',
      body: JSON.stringify(memberData),
    });
  }


  // AI categorization
  async categorizeExpense(data: { description: string; amount: number }) {
    return this.requestJson('/api/expenses/categorize', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Force refresh all data
  async refreshAllData() {
    const promises = [
      this.getExpenses(1000),
      this.getStats(),
      this.getFamilyMembers()
    ];

    try {
      await Promise.all(promises);
      return { success: true, message: 'Dữ liệu đã được đồng bộ' };
    } catch (error) {
      return { success: false, message: 'Lỗi đồng bộ dữ liệu' };
    }
  }

  // Sync API methods
  async getSyncStatus() {
    return this.requestJson('/api/sync/status');
  }

  async getSyncChanges(since?: string) {
    const url = since ? `/api/sync/changes?since=${since}` : '/api/sync/changes';
    return this.requestJson(url);
  }

  async forceSync() {
    return this.requestJson('/api/sync/force', {
      method: 'POST',
    });
  }

  async getSyncStats() {
    return this.requestJson('/api/sync/stats');
  }

  // Family management API methods
  async updateFamilyMember(id: string, data: { email: string; fullName: string; role: string }) {
    return this.requestJson(`/api/family/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFamilyMember(id: string) {
    return this.requestJson(`/api/family/members/${id}`, {
      method: 'DELETE',
    });
  }

  async updateUser(data: { fullName: string; email: string; monthlyBudget: number }) {
    return this.requestJson('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const apiService = new ApiService();
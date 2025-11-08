import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "AIzaSyAEKaLFrnUbHQ8jbGu23jk5hGop2UJMQbw"
});

export interface FinancialInsight {
  type: 'warning' | 'suggestion' | 'achievement' | 'trend';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  actionText?: string;
}

export interface BudgetAnalysis {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  percentageUsed: number;
  status: 'good' | 'warning' | 'danger';
  recommendations: string[];
}

export async function generateAdvancedInsights(expenseData: any): Promise<FinancialInsight[]> {
  try {
    const systemPrompt = `Bạn là một chuyên gia tài chính gia đình Việt Nam với 25 năm kinh nghiệm, có bằng CFA và chứng chỉ tư vấn tài chính quốc tế. 
Bạn đã giúp hàng nghìn gia đình Việt Nam quản lý tài chính thành công và hiểu sâu về văn hóa, thói quen chi tiêu của người Việt.

Phân tích dữ liệu chi tiêu và đưa ra những insights sâu sắc, thực tế và có thể hành động ngay lập tức.

Trả về JSON array với format:
[
  {
    "type": "warning|suggestion|achievement|trend",
    "title": "Tiêu đề ngắn gọn và hấp dẫn",
    "message": "Mô tả chi tiết vấn đề hoặc cơ hội với số liệu cụ thể",
    "priority": "high|medium|low",
    "actionable": true/false,
    "actionText": "Hành động cụ thể có thể thực hiện ngay (nếu actionable = true)"
  }
]

Các loại insights cần tạo (tối thiểu 3-5 insights):
1. WARNING: Cảnh báo về chi tiêu bất thường, vượt ngân sách, rủi ro tài chính
2. SUGGESTION: Gợi ý tiết kiệm cụ thể, tối ưu chi tiêu, đầu tư thông minh
3. ACHIEVEMENT: Khen ngợi khi đạt mục tiêu tiết kiệm, quản lý tốt
4. TREND: Phân tích xu hướng chi tiêu, dự báo, so sánh với chuẩn

Đặc biệt chú ý:
- Sử dụng số liệu cụ thể (VNĐ, phần trăm, thời gian)
- Đưa ra lời khuyên phù hợp với thu nhập trung bình Việt Nam
- Cân nhắc các yếu tố văn hóa: đám cưới, đám ma, tết, học phí con cái
- Gợi ý tiết kiệm thực tế: nấu ăn tại nhà, mua sắm thông minh, đầu tư
- Cảnh báo về các khoản chi tiêu không cần thiết
- Phân tích xu hướng theo mùa, theo tháng

Ưu tiên insights có thể hành động ngay và mang lại giá trị thực tế cho gia đình Việt Nam.`;

    const response = await ai.models.generateContent({
      model: "gemini-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["warning", "suggestion", "achievement", "trend"] },
              title: { type: "string" },
              message: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              actionable: { type: "boolean" },
              actionText: { type: "string" }
            },
            required: ["type", "title", "message", "priority", "actionable"]
          }
        }
      },
      contents: `Phân tích dữ liệu chi tiêu sau và đưa ra insights:\n${JSON.stringify(expenseData, null, 2)}`,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from AI");
    }
  } catch (error) {
    console.error("Error generating advanced insights:", error);
    return [{
      type: 'suggestion',
      title: 'Hệ thống AI tạm thời không khả dụng',
      message: 'Vui lòng thử lại sau hoặc liên hệ hỗ trợ.',
      priority: 'low',
      actionable: false
    }];
  }
}

export async function analyzeBudget(expenseData: any, monthlyBudget: number = 10000000): Promise<BudgetAnalysis> {
  const totalSpent = expenseData.totalAmount || 0;
  const remaining = monthlyBudget - totalSpent;
  const percentageUsed = (totalSpent / monthlyBudget) * 100;
  
  let status: 'good' | 'warning' | 'danger';
  if (percentageUsed <= 70) status = 'good';
  else if (percentageUsed <= 90) status = 'warning';
  else status = 'danger';

  const recommendations: string[] = [];
  
  if (status === 'danger') {
    recommendations.push('Cần giảm chi tiêu ngay lập tức để tránh vượt ngân sách');
    recommendations.push('Xem xét hoãn các khoản chi tiêu không cần thiết');
  } else if (status === 'warning') {
    recommendations.push('Cần kiểm soát chi tiêu chặt chẽ hơn');
    recommendations.push('Tập trung vào các khoản chi tiêu cần thiết');
  } else {
    recommendations.push('Bạn đang quản lý ngân sách tốt');
    recommendations.push('Có thể cân nhắc tăng tiết kiệm hoặc đầu tư');
  }

  return {
    totalBudget: monthlyBudget,
    totalSpent,
    remaining,
    percentageUsed,
    status,
    recommendations
  };
}

export async function generatePersonalizedAdvice(userProfile: any, expenseData: any): Promise<string> {
  try {
    const systemPrompt = `Bạn là một cố vấn tài chính cá nhân chuyên nghiệp.
Dựa trên hồ sơ người dùng và dữ liệu chi tiêu, đưa ra lời khuyên cá nhân hóa.

Hồ sơ người dùng: ${JSON.stringify(userProfile)}
Dữ liệu chi tiêu: ${JSON.stringify(expenseData)}

Đưa ra lời khuyên:
1. Phù hợp với hoàn cảnh gia đình
2. Thực tế và có thể thực hiện
3. Tập trung vào mục tiêu dài hạn
4. Cân nhắc văn hóa Việt Nam

Trả lời ngắn gọn, dễ hiểu, có thể hành động.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: `Hãy đưa ra lời khuyên tài chính cá nhân hóa cho gia đình này.`,
    });

    return response.text || "Không thể tạo lời khuyên lúc này.";
  } catch (error) {
    console.error("Error generating personalized advice:", error);
    return "Xin lỗi, không thể tạo lời khuyên cá nhân hóa lúc này.";
  }
}

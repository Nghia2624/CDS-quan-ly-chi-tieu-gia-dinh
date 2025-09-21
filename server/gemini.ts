import * as fs from "fs";
import { GoogleGenAI, Modality } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExpenseCategorization {
  category: string;
  confidence: number;
  reasoning: string;
}

export async function categorizeExpense(description: string): Promise<ExpenseCategorization> {
  try {
    const systemPrompt = `Bạn là một chuyên gia phân loại chi tiêu gia đình Việt Nam. 
Phân tích mô tả chi tiêu và xác định danh mục phù hợp nhất.

Các danh mục phổ biến:
- Ăn uống: đi ăn, mua thực phẩm, đồ uống
- Đám cưới: đi đám cưới, mừng cưới, quà cưới
- Đám ma: đi đám ma, viếng tang, phúng điếu
- Học tập: học phí, sách vở, khóa học
- Y tế: khám bệnh, thuốc men, bảo hiểm y tế
- Giải trí: xem phim, du lịch, vui chơi
- Giao thông: xăng xe, vé xe buýt, taxi
- Quần áo: mua áo quần, giày dép
- Gia dụng: đồ dùng nhà bếp, nội thất
- Khác: những chi tiêu không thuộc danh mục trên

Trả về JSON với format:
{
  "category": "tên danh mục",
  "confidence": số từ 0-1,
  "reasoning": "lý do phân loại"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            category: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["category", "confidence", "reasoning"],
        },
      },
      contents: `Phân loại chi tiêu này: "${description}"`,
    });

    const rawJson = response.text;
    if (rawJson) {
      const data: ExpenseCategorization = JSON.parse(rawJson);
      return data;
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error("Error categorizing expense:", error);
    return {
      category: "Khác",
      confidence: 0.1,
      reasoning: "Không thể phân tích do lỗi hệ thống"
    };
  }
}

export async function generateChatResponse(message: string, expenseContext: string): Promise<string> {
  try {
    const systemPrompt = `Bạn là một trợ lý AI tư vấn quản lý chi tiêu gia đình thông minh và thân thiện.
Bạn có quyền truy cập vào dữ liệu chi tiêu của gia đình và có thể:
- Trả lời câu hỏi về chi tiêu
- Đưa ra lời khuyên tiết kiệm
- Phân tích xu hướng chi tiêu
- Gợi ý ngân sách hợp lý

Luôn trả lời bằng tiếng Việt, thân thiện và hữu ích.
Khi đưa ra số liệu, sử dụng định dạng tiền tệ VNĐ.`;

    const userInput = `${message}

Dữ liệu chi tiêu hiện tại của gia đình:
${expenseContext}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: userInput,
    });

    return response.text || "Xin lỗi, tôi không thể trả lời câu hỏi này lúc này.";
  } catch (error) {
    console.error("Error generating chat response:", error);
    return "Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi của bạn. Vui lòng thử lại sau.";
  }
}

export async function generateFinancialInsights(expenseData: any): Promise<string> {
  try {
    const systemPrompt = `Bạn là một chuyên gia tư vấn tài chính gia đình.
Phân tích dữ liệu chi tiêu và đưa ra những nhận xét, lời khuyên có giá trị.
Tập trung vào:
- Xu hướng chi tiêu
- Cơ hội tiết kiệm
- Cảnh báo chi tiêu bất thường
- Gợi ý cân bằng ngân sách

Trả lời ngắn gọn, dễ hiểu bằng tiếng Việt.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: `Phân tích dữ liệu chi tiêu sau và đưa ra lời khuyên:\n${JSON.stringify(expenseData, null, 2)}`,
    });

    return response.text || "Không thể tạo phân tích lúc này.";
  } catch (error) {
    console.error("Error generating financial insights:", error);
    return "Có lỗi xảy ra khi phân tích dữ liệu tài chính.";
  }
}
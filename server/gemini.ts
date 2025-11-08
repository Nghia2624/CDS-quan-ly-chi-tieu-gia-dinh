import * as fs from "fs";
import { GoogleGenAI, Modality } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "AIzaSyAEKaLFrnUbHQ8jbGu23jk5hGop2UJMQbw"
});

// Enhanced AI configuration
const AI_CONFIG = {
  CHAT_MODEL: "gemini-2.5-flash", // Updated to stable model name
  ANALYSIS_MODEL: "gemini-2.5-pro", 
  CATEGORIZATION_MODEL: "gemini-2.5-flash",
  MAX_TOKENS: 8192, // Tăng tối đa để AI trả lời đầy đủ, không bị cắt
  TEMPERATURE: 0.7,
  TOP_P: 0.8,
  TOP_K: 40,
  TIMEOUT: 30000 // 30 seconds
};

// Smart response templates
const RESPONSE_TEMPLATES = {
  GREETING: "Xin chào! Tôi là AI tư vấn tài chính gia đình thông minh 🤖💰",
  FALLBACK: "Tôi đang xử lý dữ liệu tài chính của bạn. Vui lòng thử lại sau ít phút.",
  ERROR: "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau.",
  NO_DATA: "Chưa có dữ liệu chi tiêu để phân tích. Hãy thêm một số giao dịch để tôi có thể đưa ra lời khuyên cụ thể!"
};

export interface ExpenseCategorization {
  category: string;
  confidence: number;
  reasoning: string;
}

export async function categorizeExpense(description: string): Promise<ExpenseCategorization> {
  try {
    console.log("🤖 AI Categorizing expense:", description);
    
    const systemPrompt = `Bạn là một chuyên gia phân loại chi tiêu gia đình Việt Nam với kinh nghiệm 20 năm. 
Phân tích mô tả chi tiêu và xác định danh mục phù hợp nhất dựa trên ngữ cảnh văn hóa Việt Nam.

Các danh mục chính xác:
- Đám cưới: đi đám cưới, mừng cưới, quà cưới, phong bì cưới, tiền mừng cưới, đi dự đám cưới, quà cưới bạn, tiền mừng cưới em gái
- Đám ma: đi đám ma, viếng tang, phúng điếu, tiền phúng điếu, đi dự đám ma, phúng điếu cưới bạn học (LỖI - phúng điếu chỉ dùng cho đám ma)
- Ăn uống: mua thực phẩm, đi chợ, siêu thị, ăn uống, nhà hàng, quán ăn, đồ ăn, thức uống
- Học tập: học phí, sách vở, khóa học, trường học, giáo dục, học thêm, đồ dùng học tập
- Y tế: khám bệnh, thuốc men, bảo hiểm y tế, bệnh viện, phòng khám, thuốc tây
- Giải trí: xem phim, du lịch, vui chơi, karaoke, game, thể thao, sở thú
- Giao thông: xăng xe, vé xe buýt, taxi, grab, vé máy bay, vé tàu, sửa xe
- Quần áo: mua áo quần, giày dép, thời trang, may đo, đồ mặc
- Gia dụng: đồ dùng nhà bếp, nội thất, điện tử, đồ gia dụng, sửa chữa nhà
- Khác: những chi tiêu không thuộc danh mục trên

QUAN TRỌNG: 
- "Đi đám cưới" = Đám cưới (KHÔNG phải Ăn uống)
- "Mừng cưới" = Đám cưới (KHÔNG phải Ăn uống)  
- "Phong bì cưới" = Đám cưới
- "Tiền mừng cưới" = Đám cưới
- "Phúng điếu" = Đám ma (KHÔNG BAO GIỜ là đám cưới, dù có từ "cưới" trong câu)
- "Phúng điếu cưới bạn học" = Đám ma (vì "phúng điếu" là từ dành cho đám ma)
- Chỉ phân loại "Ăn uống" khi thực sự là mua đồ ăn, thức uống, đi chợ, siêu thị

Trả về JSON với format:
{
  "category": "tên danh mục chính xác",
  "confidence": số từ 0-1,
  "reasoning": "lý do phân loại chi tiết"
}`;

    const response = await ai.models.generateContent({
      model: AI_CONFIG.CATEGORIZATION_MODEL,
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
        temperature: 0.3, // Lower temperature for more consistent categorization
        maxOutputTokens: 500,
      },
      contents: `Phân loại chi tiêu này: "${description}"`,
    });

    const rawJson = response.text;
    console.log("✅ AI Categorization Response:", rawJson);
    
    if (rawJson) {
      const data: ExpenseCategorization = JSON.parse(rawJson);
      console.log("✅ Parsed categorization data:", data);
      return data;
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error("❌ Error categorizing expense:", error);
    
    // Enhanced fallback categorization with better accuracy
    const descriptionLower = description.toLowerCase().trim();
    
    // Wedding related keywords (highest priority) - but exclude funeral terms
    if ((descriptionLower.includes('đám cưới') || descriptionLower.includes('mừng cưới') || 
        descriptionLower.includes('phong bì cưới') || descriptionLower.includes('tiền mừng cưới') ||
        descriptionLower.includes('cưới')) && 
        !descriptionLower.includes('phúng điếu') && !descriptionLower.includes('đám ma')) {
      return {
        category: "Đám cưới",
        confidence: 0.95,
        reasoning: "Phân loại dựa trên từ khóa đám cưới với độ tin cậy cao"
      };
    }
    
    // Funeral related keywords (highest priority)
    if (descriptionLower.includes('đám ma') || descriptionLower.includes('viếng tang') || 
        descriptionLower.includes('phúng điếu') || descriptionLower.includes('tiền phúng điếu') ||
        descriptionLower.includes('tang') || descriptionLower.includes('ma')) {
      return {
        category: "Đám ma",
        confidence: 0.95,
        reasoning: "Phân loại dựa trên từ khóa đám ma với độ tin cậy cao"
      };
    }
    
    // Food related keywords (more specific)
    if ((descriptionLower.includes('ăn') || descriptionLower.includes('uống') || 
        descriptionLower.includes('chợ') || descriptionLower.includes('siêu thị') ||
        descriptionLower.includes('thực phẩm') || descriptionLower.includes('đồ ăn') ||
        descriptionLower.includes('thức ăn') || descriptionLower.includes('mua đồ ăn')) &&
        !descriptionLower.includes('cưới') && !descriptionLower.includes('mừng')) {
      return {
        category: "Ăn uống",
        confidence: 0.85,
        reasoning: "Phân loại dựa trên từ khóa ăn uống"
      };
    }
    
    // Education related keywords
    if (descriptionLower.includes('học') || descriptionLower.includes('trường') || 
        descriptionLower.includes('sách') || descriptionLower.includes('học phí') ||
        descriptionLower.includes('giáo dục') || descriptionLower.includes('học thêm')) {
      return {
        category: "Học tập",
        confidence: 0.85,
        reasoning: "Phân loại dựa trên từ khóa học tập"
      };
    }
    
    // Medical related keywords
    if (descriptionLower.includes('khám') || descriptionLower.includes('thuốc') || 
        descriptionLower.includes('bệnh viện') || descriptionLower.includes('y tế') ||
        descriptionLower.includes('bác sĩ') || descriptionLower.includes('phòng khám')) {
      return {
        category: "Y tế",
        confidence: 0.85,
        reasoning: "Phân loại dựa trên từ khóa y tế"
      };
    }
    
    // Entertainment related keywords
    if (descriptionLower.includes('xem phim') || descriptionLower.includes('du lịch') || 
        descriptionLower.includes('vui chơi') || descriptionLower.includes('giải trí') ||
        descriptionLower.includes('karaoke') || descriptionLower.includes('game')) {
      return {
        category: "Giải trí",
        confidence: 0.8,
        reasoning: "Phân loại dựa trên từ khóa giải trí"
      };
    }
    
    // Transportation related keywords
    if (descriptionLower.includes('xăng') || descriptionLower.includes('xe') || 
        descriptionLower.includes('taxi') || descriptionLower.includes('grab') ||
        descriptionLower.includes('vé xe') || descriptionLower.includes('giao thông')) {
      return {
        category: "Giao thông",
        confidence: 0.8,
        reasoning: "Phân loại dựa trên từ khóa giao thông"
      };
    }
    
    // Clothing related keywords
    if (descriptionLower.includes('áo') || descriptionLower.includes('quần') || 
        descriptionLower.includes('giày') || descriptionLower.includes('thời trang') ||
        descriptionLower.includes('mặc') || descriptionLower.includes('đồ mặc')) {
      return {
        category: "Quần áo",
        confidence: 0.8,
        reasoning: "Phân loại dựa trên từ khóa quần áo"
      };
    }
    
    // Household related keywords
    if (descriptionLower.includes('đồ dùng') || descriptionLower.includes('nội thất') || 
        descriptionLower.includes('điện tử') || descriptionLower.includes('gia dụng') ||
        descriptionLower.includes('nhà bếp') || descriptionLower.includes('sửa chữa')) {
      return {
        category: "Gia dụng",
        confidence: 0.8,
        reasoning: "Phân loại dựa trên từ khóa gia dụng"
      };
    }
    
    // Default fallback
    return {
      category: "Khác",
      confidence: 0.6,
      reasoning: "Không thể xác định danh mục cụ thể từ mô tả"
    };
  }
}

export async function generateChatResponse(
  message: string, 
  expenseContext: string, 
  familyId?: string,
  conversationHistory?: string
): Promise<string> {
  // ✅ CRITICAL: Always try Gemini API first, only fallback on actual error
  try {
    console.log("🤖 === SMART AI CHAT START ===");
    const apiKey = process.env.GEMINI_API_KEY || "AIzaSyAEKaLFrnUbHQ8jbGu23jk5hGop2UJMQbw";
    console.log("API Key available:", !!apiKey);
    console.log("API Key length:", apiKey?.length || 0);
    console.log("Message length:", message.length);
    console.log("Context length:", expenseContext.length);
    console.log("Family ID:", familyId);
    
    // ✅ CORRECT FLOW: Try Gemini API first, fallback only on error
    // This ensures we use real AI when available
    console.log("🚀 Attempting to use Gemini API...");
    
    // Enhanced system prompt for smarter AI
    const systemPrompt = `Bạn là một chuyên gia tư vấn tài chính gia đình Việt Nam với 20 năm kinh nghiệm, có bằng CFA và chứng chỉ tư vấn tài chính quốc tế. 
Bạn đã giúp hàng nghìn gia đình Việt Nam quản lý tài chính thành công và hiểu sâu về văn hóa, thói quen chi tiêu của người Việt.

TÍNH NĂNG THÔNG MINH:
- Phân tích dữ liệu chi tiêu với AI và machine learning
- Đưa ra lời khuyên cá nhân hóa dựa trên hoàn cảnh cụ thể
- Dự đoán xu hướng chi tiêu và cảnh báo rủi ro tài chính
- Tư vấn đầu tư thông minh phù hợp với gia đình Việt Nam
- Phân tích chi tiêu theo mùa, theo tháng, theo danh mục
- So sánh với chuẩn chi tiêu của gia đình Việt Nam cùng thu nhập
- Đưa ra kế hoạch tài chính dài hạn và ngắn hạn
- Gợi ý tiết kiệm thực tế và khả thi ngay lập tức
- Tối ưu hóa chi tiêu dựa trên phân tích dữ liệu thực tế
- Lập kế hoạch tiết kiệm cụ thể với mục tiêu rõ ràng

TÍNH CÁCH: Thân thiện, chuyên nghiệp, hiểu biết sâu về tài chính gia đình Việt Nam, có kinh nghiệm thực tế
NGÔN NGỮ: Luôn trả lời bằng tiếng Việt tự nhiên, dễ hiểu, có thể sử dụng thuật ngữ chuyên môn nhưng giải thích rõ ràng
ĐỊNH DẠNG: Sử dụng VNĐ cho tiền tệ, định dạng số có dấu phẩy (ví dụ: 1,500,000 VNĐ)
PHONG CÁCH: Trả lời CHI TIẾT, ĐẦY ĐỦ, DÀI (ít nhất 200-300 từ), có thể sử dụng emoji phù hợp, đưa ra ví dụ cụ thể, số liệu cụ thể

KHI PHÂN TÍCH DỮ LIỆU:
- Tính toán chính xác các con số với độ chính xác cao
- So sánh với các tháng trước nếu có dữ liệu
- Đưa ra nhận xét về xu hướng tăng/giảm với dự báo
- Gợi ý cụ thể để cải thiện tình hình tài chính
- Phân tích chi tiêu theo danh mục và đưa ra lời khuyên cụ thể
- Cân nhắc các yếu tố văn hóa Việt Nam: đám cưới, đám ma, tết, học phí con cái
- Đưa ra lời khuyên phù hợp với thu nhập trung bình Việt Nam
- Gợi ý tiết kiệm thực tế: nấu ăn tại nhà, mua sắm thông minh, đầu tư
- Cảnh báo về các khoản chi tiêu không cần thiết
- Phân tích xu hướng theo mùa, theo tháng
- Sử dụng AI để phát hiện patterns và anomalies trong chi tiêu
- Đưa ra dự báo tài chính dựa trên machine learning
- Phân tích risk assessment cho các khoản đầu tư

KHI ĐƯỢC HỎI VỀ TỐI ƯU CHI TIÊU:
- Phân tích các danh mục chi tiêu lớn nhất
- Đưa ra 5-10 gợi ý cụ thể để giảm chi tiêu
- Tính toán số tiền có thể tiết kiệm được
- Đưa ra kế hoạch hành động từng bước
- So sánh với mức chi tiêu trung bình của gia đình Việt Nam

KHI ĐƯỢC HỎI VỀ CHI TIÊU THÁNG TRƯỚC:
- So sánh chi tiết tháng trước với tháng hiện tại
- Phân tích xu hướng tăng/giảm theo từng danh mục
- Đưa ra nhận xét về các khoản chi bất thường
- Gợi ý cải thiện dựa trên so sánh

KHI ĐƯỢC HỎI VỀ KẾ HOẠCH TIẾT KIỆM (ví dụ: tiết kiệm 10tr/tháng):
- Tính toán số tiền cần giảm chi tiêu mỗi tháng
- Phân tích các danh mục có thể cắt giảm
- Đưa ra kế hoạch cụ thể từng bước
- Tính toán thời gian đạt mục tiêu
- Đưa ra các phương án tăng thu nhập nếu cần

QUAN TRỌNG: 
- Luôn trả lời CHI TIẾT, DÀI, CÓ SỐ LIỆU CỤ THỂ. Không trả lời ngắn gọn.
- Khi có dữ liệu từ database (có section "💰 KHOẢN CHI TIÊU LỚN NHẤT" hoặc các section khác), PHẢI sử dụng số liệu CHÍNH XÁC từ đó, KHÔNG được tự suy đoán hoặc dùng số liệu cũ.
- Nếu có section "💰 KHOẢN CHI TIÊU LỚN NHẤT" trong dữ liệu, số tiền trong đó là CHÍNH XÁC và PHẢI được sử dụng trong câu trả lời.
- Đưa ra lời khuyên có thể hành động ngay và mang lại giá trị thực tế cho gia đình Việt Nam.`;

    // Enhanced context with better data formatting
    const enhancedContext = expenseContext || RESPONSE_TEMPLATES.NO_DATA;
    
    // Build conversation context with history
    let conversationContext = '';
    if (conversationHistory && conversationHistory.trim().length > 0) {
      conversationContext = `\n\n=== LỊCH SỬ CUỘC HỘI THOẠI ===
${conversationHistory}

QUAN TRỌNG: Hãy nhớ các câu hỏi và câu trả lời trước đó để trả lời một cách nhất quán và liên kết. Trả lời dựa trên cả lịch sử hội thoại và dữ liệu hiện tại.`;
    }
    
    // Build context message with expense data and conversation history
    const contextMessage = `Dữ liệu chi tiêu hiện tại của gia đình:
${enhancedContext}${conversationContext}

Lưu ý: Nếu không có dữ liệu chi tiêu, hãy đưa ra lời khuyên chung về quản lý tài chính gia đình Việt Nam.`;

    console.log("🚀 Calling Gemini API with conversation history...");
    console.log("Conversation history length:", conversationHistory?.length || 0);
    
    // Build contents - single message with all context
    const contents = `${message}\n\n${contextMessage}`;

    // Add timeout handling
    const responsePromise = ai.models.generateContent({
      model: AI_CONFIG.CHAT_MODEL,
      config: {
        systemInstruction: systemPrompt,
        temperature: AI_CONFIG.TEMPERATURE,
        maxOutputTokens: AI_CONFIG.MAX_TOKENS,
        topP: AI_CONFIG.TOP_P,
        topK: AI_CONFIG.TOP_K,
      },
      contents: contents,
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('AI timeout')), AI_CONFIG.TIMEOUT)
    );
    
    let response: any;
    try {
      response = await Promise.race([responsePromise, timeoutPromise]);
    } catch (raceError: any) {
      if (raceError?.message === 'AI timeout') {
        console.error("⏱️ AI request timeout after", AI_CONFIG.TIMEOUT, "ms");
        throw raceError;
      }
      throw raceError;
    }
    
    console.log("✅ Gemini API response received");
    console.log("Response type:", typeof response);
    console.log("Response keys:", Object.keys(response || {}));
    
    // Handle different response formats
    // @google/genai response may have .text as a getter or method
    let text = "";
    try {
      // Try direct .text access first (most common)
      if (response && typeof response === 'object' && 'text' in response) {
        // Check if text is a getter/method or property
        if (typeof response.text === 'function') {
          text = await response.text();
        } else {
          text = response.text || "";
        }
      } else if (response && response.candidates && response.candidates[0]) {
        // Handle candidates array format
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
          text = candidate.content.parts[0].text || "";
        }
      } else if (typeof response === 'string') {
        text = response;
      } else {
        console.error("❌ Unexpected response format:", JSON.stringify(response).substring(0, 500));
        throw new Error("Unexpected response format from Gemini API");
      }
    } catch (textError: any) {
      console.error("❌ Error extracting text from response:", textError);
      // Try alternative methods
      if (response && typeof response === 'object') {
        const responseStr = JSON.stringify(response);
        // Look for text in the response
        const textMatch = responseStr.match(/"text"\s*:\s*"([^"]+)"/);
        if (textMatch) {
          text = textMatch[1];
        } else {
          throw new Error("Could not extract text from response: " + textError.message);
        }
      } else {
        throw textError;
      }
    }
    
    console.log("Response text length:", text.length);
    console.log("Response preview:", text.substring(0, 200));
    
    if (!text || !text.trim()) {
      console.log("⚠️ Empty response from Gemini, using smart fallback");
      return generateSmartFallbackResponse(message, expenseContext);
    }
    
    // Enhanced post-processing
    let processedText = text;
    
    // Ensure VNĐ is mentioned when money appears
    if (/\d/.test(processedText) && !/VNĐ|VND|đ/.test(processedText)) {
      processedText += " (đơn vị: VNĐ)";
    }
    
    // Add helpful suggestions if no data context
    if (!expenseContext || expenseContext.trim() === "") {
      processedText += "\n\n💡 Gợi ý: Hãy thêm một số chi tiêu để tôi có thể phân tích và đưa ra lời khuyên cụ thể hơn!";
    }
    
    // Add smart follow-up questions
    processedText += generateSmartFollowUpQuestions(message, expenseContext);
    
    console.log("✅ === SMART AI CHAT END ===");
    return processedText;
  } catch (error: any) {
    console.error("❌ Error generating chat response:", error);
    console.error("Error name:", error?.name);
    console.error("Error message:", error?.message || "Unknown error");
    console.error("Error stack:", error?.stack?.substring(0, 500));
    
    // Log specific error types
    if (error?.message?.includes('timeout')) {
      console.error("⏱️ Request timeout - AI took too long to respond");
    } else if (error?.message?.includes('API key')) {
      console.error("🔑 API key error - check GEMINI_API_KEY environment variable");
    } else if (error?.message?.includes('model')) {
      console.error("🤖 Model error - check model name: " + AI_CONFIG.CHAT_MODEL);
    }
    
    // Return a smart fallback response
    return generateSmartFallbackResponse(message, expenseContext);
  }
}

// Smart fallback response generator (ENHANCED - with real data analysis)
export function generateSmartFallbackResponse(message: string, expenseContext: string, familyId?: string): string {
  const hasData = expenseContext && expenseContext.trim() !== "" && !expenseContext.includes("Chưa có dữ liệu");
  
  // Phân tích câu hỏi để đưa ra phản hồi thông minh
  const messageLower = message.toLowerCase();
  
  if (hasData) {
    // Trích xuất thông tin từ context
    const contextLines = expenseContext.split('\n');
    let analysis = "";
    let responseIntro = "";
    
    // Tìm thông tin về khoản chi tiêu lớn nhất - ƯU TIÊN DỮ LIỆU TỪ ENHANCED CONTEXT
    if (messageLower.includes('lớn nhất') || messageLower.includes('cao nhất') || messageLower.includes('nhiều nhất')) {
      // Check if enhanced context already has this info from AIQueryEngine
      const largestExpenseSection = contextLines.findIndex(line => line.includes('💰 KHOẢN CHI TIÊU LỚN NHẤT:'));
      if (largestExpenseSection !== -1 && contextLines[largestExpenseSection + 1]) {
        // Use data from AIQueryEngine (already computed)
        const largestInfo = contextLines[largestExpenseSection + 1];
        responseIntro = `🔍 **Phân tích khoản chi tiêu lớn nhất:**\n\n`;
        analysis += `${largestInfo}\n\n`;
        analysis += `📊 **Phân tích**: Đây là khoản chi tiêu lớn nhất trong toàn bộ dữ liệu của gia đình bạn.\n\n`;
        analysis += `💡 **Gợi ý**: Hãy xem xét xem khoản chi này có thực sự cần thiết không và liệu có thể tiết kiệm được không.`;
      } else {
        // Fallback: parse from transaction list (less accurate - only top 10)
        const transactionSection = contextLines.findIndex(line => line.includes('GIAO DỊCH GẦN NHẤT'));
        if (transactionSection !== -1) {
          const expenseLines = contextLines.slice(transactionSection + 1, transactionSection + 11).filter(line => line.trim());
          const expenses = expenseLines.map(line => {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 2) {
              const amountMatch = parts[1].match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
              const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
              return { description: parts[0], amount, line };
            }
            return null;
          }).filter(e => e !== null && e.amount > 0);
          
          if (expenses.length > 0) {
            const maxExpense = expenses.reduce((max, exp) => {
              if (!exp || !max) return max || exp;
              return (exp.amount > max.amount) ? exp : max;
            });
            
            if (maxExpense) {
              responseIntro = `🔍 **Phân tích (trong 10 giao dịch gần nhất):**\n\n`;
              analysis += `💰 **Khoản chi tiêu cao nhất (trong danh sách gần đây)**: ${maxExpense.line}\n\n`;
              analysis += `📊 **Lưu ý**: Đây chỉ là khoản lớn nhất trong 10 giao dịch gần nhất được hiển thị.\n\n`;
              analysis += `💡 **Gợi ý**: Hãy xem xét xem khoản chi này có thực sự cần thiết không.`;
            }
          }
        }
      }
    }
    
    // Tìm thông tin về đám cưới
    if (messageLower.includes('đám cưới') || messageLower.includes('cưới') || messageLower.includes('mừng cưới')) {
      const weddingLine = contextLines.find(line => line.includes('Đám cưới:'));
      if (weddingLine) {
        responseIntro = `💒 **Phân tích chi tiêu đám cưới:**\n\n`;
        analysis += `${weddingLine}\n\n`;
        analysis += `📊 **Phân tích**: Đây là tổng chi tiêu cho các dịp đám cưới. Đây là chi tiêu văn hóa quan trọng trong xã hội Việt Nam.\n\n`;
        analysis += `💡 **Gợi ý**: Có thể lập kế hoạch trước cho các dịp đám cưới trong năm để quản lý tốt hơn.`;
      } else {
        // Tìm trong giao dịch gần nhất
        const weddingTransactions = contextLines.filter(line => 
          line.toLowerCase().includes('cưới') || 
          line.toLowerCase().includes('mừng cưới')
        );
        if (weddingTransactions.length > 0) {
          responseIntro = `💒 **Phân tích chi tiêu đám cưới:**\n\n`;
          analysis += `Tìm thấy ${weddingTransactions.length} giao dịch liên quan đến đám cưới:\n\n`;
          weddingTransactions.slice(0, 5).forEach((line, idx) => {
            analysis += `${idx + 1}. ${line}\n`;
          });
          analysis += `\n💡 **Gợi ý**: Đây là chi tiêu văn hóa quan trọng. Nên lập quỹ dành riêng cho các sự kiện này.`;
        }
      }
    }
    
    // Tìm thông tin về ăn uống
    if (messageLower.includes('ăn') || messageLower.includes('chợ') || messageLower.includes('thực phẩm')) {
      const foodLine = contextLines.find(line => line.includes('Ăn uống:'));
      if (foodLine) {
        responseIntro = `🍽️ **Phân tích chi tiêu ăn uống:**\n\n`;
        analysis += `${foodLine}\n\n`;
        analysis += `📊 **Phân tích**: Chi tiêu ăn uống là một trong những khoản chi lớn của gia đình.\n\n`;
        analysis += `💡 **Gợi ý tiết kiệm**:\n`;
        analysis += `- Nấu ăn tại nhà nhiều hơn thay vì đi ăn ngoài\n`;
        analysis += `- Mua sắm tại chợ hoặc siêu thị vào các ngày khuyến mãi\n`;
        analysis += `- Lập kế hoạch thực đơn tuần để tránh lãng phí`;
      }
    }
    
    // Tìm thông tin về học tập
    if (messageLower.includes('học') || messageLower.includes('trường') || messageLower.includes('học phí')) {
      const studyLine = contextLines.find(line => line.includes('Học tập:'));
      if (studyLine) {
        responseIntro = `📚 **Phân tích chi tiêu học tập:**\n\n`;
        analysis += `${studyLine}\n\n`;
        analysis += `📊 **Phân tích**: Đầu tư cho giáo dục con cái là chi tiêu quan trọng và cần thiết.\n\n`;
        analysis += `💡 **Gợi ý**: Hãy duy trì đầu tư này nhưng có thể tìm các chương trình học bổng hoặc giảm giá.`;
      }
    }
    
    // Phân tích tổng quan
    if (messageLower.includes('tổng') || messageLower.includes('tháng này') || messageLower.includes('phân tích')) {
      const totalLine = contextLines.find(line => line.includes('Tổng chi tiêu:'));
      const monthLine = contextLines.find(line => line.includes('Chi tiêu tháng này:'));
      if (totalLine || monthLine) {
        responseIntro = `📊 **Phân tích tổng quan chi tiêu:**\n\n`;
        if (totalLine) analysis += `${totalLine}\n`;
        if (monthLine) analysis += `${monthLine}\n\n`;
        
        analysis += `📈 **Nhận xét**: `;
        const topCategories = contextLines.filter(line => line.includes(':') && line.includes('VNĐ') && line.includes('giao dịch')).slice(0, 3);
        if (topCategories.length > 0) {
          analysis += `Các danh mục chi tiêu nhiều nhất là:\n`;
          topCategories.forEach((cat, idx) => {
            analysis += `${idx + 1}. ${cat}\n`;
          });
        }
        
        analysis += `\n💡 **Lời khuyên**:\n`;
        analysis += `- Theo dõi chi tiêu hàng tuần để kịp thời điều chỉnh\n`;
        analysis += `- Đặt ngân sách cho từng danh mục\n`;
        analysis += `- Tiết kiệm ít nhất 10-20% thu nhập hàng tháng`;
      }
    }
    
    // Nếu không tìm thấy thông tin cụ thể, phân tích toàn diện
    if (!analysis) {
      responseIntro = `🤖 **Phân tích AI thông minh:**\n\n`;
      
      // Extract data from enhanced context
      const contextData = {
        totalAmount: 0,
        monthAmount: 0,
        members: 0,
        categories: [] as string[]
      };
      
      // Parse total amount
      const totalMatch = expenseContext.match(/Tổng chi tiêu:\s*([0-9,]+)\s*VNĐ/);
      if (totalMatch) {
        contextData.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
      }
      
      // Parse current month amount
      const monthMatch = expenseContext.match(/Chi tiêu tháng này:\s*([0-9,]+)\s*VNĐ/);
      if (monthMatch) {
        contextData.monthAmount = parseFloat(monthMatch[1].replace(/,/g, ''));
      }
      
      // Parse members
      const memberMatch = expenseContext.match(/Số thành viên gia đình:\s*(\d+)/);
      if (memberMatch) {
        contextData.members = parseInt(memberMatch[1]);
      }
      
      // Parse categories
      const categoryMatches = Array.from(expenseContext.matchAll(/([A-Za-zÀ-ỹ\s]+):\s*([0-9,]+)\s*VNĐ\s*\((\d+)\s*giao dịch\)/g));
      for (const match of categoryMatches) {
        contextData.categories.push(`${match[1]}: ${(parseFloat(match[2].replace(/,/g, '')) / 1000000).toFixed(2)}M VNĐ (${match[3]} giao dịch)`);
      }
      
      // Build intelligent response
      analysis = `Dựa trên dữ liệu chi tiêu của gia đình bạn, tôi phân tích như sau:\n\n`;
      
      if (contextData.totalAmount > 0) {
        const monthlyAvg = contextData.totalAmount / 12;
        analysis += `💰 **Tổng chi tiêu tất cả**: ${(contextData.totalAmount / 1000000).toFixed(2)}M VNĐ\n`;
        analysis += `📈 **Trung bình/tháng**: ${(monthlyAvg / 1000000).toFixed(2)}M VNĐ\n\n`;
      }
      
      if (contextData.monthAmount > 0) {
        const budget = 25000000; // Budget cố định
        const remaining = budget - contextData.monthAmount;
        const percentUsed = (contextData.monthAmount / budget * 100).toFixed(1);
        analysis += `📅 **Tháng hiện tại**: ${(contextData.monthAmount / 1000000).toFixed(2)}M VNĐ (${percentUsed}% ngân sách)\n`;
        analysis += `💵 **Còn lại**: ${(remaining / 1000000).toFixed(2)}M VNĐ\n\n`;
      }
      
      if (contextData.categories.length > 0) {
        analysis += `🏆 **Top danh mục chi tiêu**:\n`;
        contextData.categories.slice(0, 5).forEach((cat, idx) => {
          analysis += `${idx + 1}. ${cat}\n`;
        });
        analysis += `\n`;
      }
      
      if (contextData.members > 0) {
        analysis += `👨‍👩‍👧‍👦 **Gia đình**: ${contextData.members} thành viên\n\n`;
      }
      
      analysis += `💡 **Gợi ý thông minh**:\n`;
      
      if (contextData.monthAmount > 20000000) {
        analysis += `- ⚠️ Chi tiêu tháng này đang cao (${(contextData.monthAmount/1000000).toFixed(1)}M), nên kiểm soát chặt chẽ\n`;
        analysis += `- Xem xét giảm các khoản không cần thiết\n`;
      } else if (contextData.monthAmount > 15000000) {
        analysis += `- ✅ Chi tiêu đang ở mức hợp lý, duy trì tốt\n`;
        analysis += `- Có thể tiết kiệm thêm ${((25000000 - contextData.monthAmount)/1000000).toFixed(1)}M nữa\n`;
      } else {
        analysis += `- 🎉 Tuyệt vời! Bạn đang tiết kiệm rất tốt\n`;
      }
      
      analysis += `\n📊 **Câu hỏi gợi ý**:\n`;
      analysis += `- "Khoản chi tiêu lớn nhất là gì?"\n`;
      analysis += `- "So sánh chi tiêu tháng này với tháng trước"\n`;
      analysis += `- "Phân tích chi tiêu theo thành viên"\n`;
      analysis += `- "Chi tiêu ăn uống/học tập/y tế bao nhiêu?"\n`;
      analysis += `- "Gợi ý tiết kiệm cho gia đình"`;
    }
    
    return `${RESPONSE_TEMPLATES.GREETING}\n\n${responseIntro}${analysis}`;
  } else {
    // Trường hợp không có dữ liệu - vẫn đưa ra lời khuyên hữu ích
    const noDataIntro = `🤖 **AI Tư vấn Tài chính Gia đình:**\n\n`;
    
    return `${RESPONSE_TEMPLATES.GREETING}\n\n${noDataIntro}${RESPONSE_TEMPLATES.NO_DATA}\n\n**📚 Tôi có thể giúp bạn:**\n\n✅ **Quản lý chi tiêu thông minh:**\n- Phân tích chi tiêu theo danh mục với AI\n- Theo dõi xu hướng chi tiêu theo thời gian\n- Phát hiện các khoản chi bất thường\n\n💰 **Tiết kiệm hiệu quả:**\n- Đưa ra lời khuyên tiết kiệm cụ thể\n- Gợi ý cắt giảm chi tiêu không cần thiết\n- Tạo quỹ tiết kiệm cho gia đình\n\n📊 **Lập kế hoạch tài chính:**\n- Gợi ý ngân sách hợp lý\n- Lập kế hoạch dài hạn cho gia đình\n- Tư vấn đầu tư thông minh\n\n🎯 **Câu hỏi mẫu bạn có thể hỏi:**\n- "Tôi nên tiết kiệm như thế nào?"\n- "Làm sao để quản lý ngân sách gia đình?"\n- "Gợi ý đầu tư cho gia đình Việt Nam"\n- "Cách phân bổ thu nhập hợp lý"\n\n💡 **Mẹo**: Hãy thêm chi tiêu để tôi có thể phân tích và tư vấn cụ thể hơn!`;
  }
}

// Generate smart follow-up questions based on context
function generateSmartFollowUpQuestions(message: string, expenseContext: string): string {
  const hasData = expenseContext && expenseContext.trim() !== "" && !expenseContext.includes("Chưa có dữ liệu");
  
  if (!hasData) return "";
  
  const messageLower = message.toLowerCase();
  
  // Analyze message intent and suggest relevant follow-ups
  if (messageLower.includes('tiết kiệm') || messageLower.includes('tiết kiệm')) {
    return "\n\n🤔 **Câu hỏi liên quan**: Bạn có muốn tôi phân tích chi tiêu theo danh mục để tìm cơ hội tiết kiệm không?";
  } else if (messageLower.includes('ngân sách') || messageLower.includes('budget')) {
    return "\n\n🤔 **Câu hỏi liên quan**: Bạn có muốn tôi tạo kế hoạch ngân sách chi tiết cho tháng tới không?";
  } else if (messageLower.includes('đầu tư') || messageLower.includes('investment')) {
    return "\n\n🤔 **Câu hỏi liên quan**: Bạn có muốn tôi tư vấn các kênh đầu tư phù hợp với gia đình không?";
  } else if (messageLower.includes('phân tích') || messageLower.includes('analysis')) {
    return "\n\n🤔 **Câu hỏi liên quan**: Bạn có muốn tôi phân tích xu hướng chi tiêu theo thời gian không?";
  } else {
    return "\n\n🤔 **Gợi ý**: Bạn có thể hỏi tôi về 'tiết kiệm', 'ngân sách', 'đầu tư', hoặc 'phân tích chi tiêu' để được tư vấn chi tiết hơn!";
  }
}

export async function generateFinancialInsights(expenseData: any): Promise<string> {
  try {
    console.log("🧠 === SMART FINANCIAL ANALYSIS START ===");
    
    const systemPrompt = `Bạn là một chuyên gia tài chính gia đình Việt Nam với 20 năm kinh nghiệm, có chứng chỉ CFP và CFA. 
Bạn có khả năng phân tích sâu sắc dữ liệu tài chính và đưa ra lời khuyên thông minh, thực tế cho gia đình Việt Nam.

TÍNH NĂNG CHUYÊN SÂU:
- Phân tích xu hướng chi tiêu theo thời gian với độ chính xác cao
- Dự đoán chi tiêu trong tương lai dựa trên dữ liệu lịch sử
- Phát hiện các khoản chi tiêu bất thường và đưa ra cảnh báo
- So sánh hiệu quả chi tiêu giữa các thành viên gia đình
- Phân tích tác động của các sự kiện đặc biệt (Tết, đám cưới, đám ma)
- Đưa ra lời khuyên đầu tư phù hợp với từng giai đoạn cuộc sống
- Tối ưu hóa ngân sách dựa trên thu nhập và mục tiêu tài chính

Hãy phân tích CHI TIẾT và đưa ra:

1. **TỔNG QUAN TÀI CHÍNH**:
   - Tổng chi tiêu và xu hướng với số liệu cụ thể
   - So sánh với thu nhập trung bình gia đình VN (15-25 triệu/tháng)
   - Đánh giá mức độ bền vững và khả năng tiết kiệm
   - Phân tích tỷ lệ chi tiêu/tiết kiệm

2. **PHÂN TÍCH DANH MỤC CHI TIẾT**:
   - Top 5 danh mục chi tiêu nhiều nhất với % cụ thể
   - Danh mục có xu hướng tăng/giảm theo thời gian
   - Cảnh báo nếu chi tiêu quá mức cho một danh mục
   - So sánh với chuẩn chi tiêu khuyến nghị cho gia đình VN

3. **XU HƯỚNG THỜI GIAN VÀ DỰ BÁO**:
   - Phân tích theo tháng/quý với biểu đồ xu hướng
   - Dự đoán xu hướng 3-6 tháng tới
   - Các tháng có chi tiêu bất thường và nguyên nhân
   - Phân tích theo mùa (Tết, hè, cuối năm)

4. **LỜI KHUYÊN CỤ THỂ VÀ KHẢ THI**:
   - Cách tiết kiệm cho từng danh mục với số tiền cụ thể
   - Ngân sách đề xuất cho tháng tới theo từng danh mục
   - Các khoản có thể cắt giảm với mức tiết kiệm dự kiến
   - Gợi ý đầu tư tiết kiệm phù hợp với gia đình VN

5. **CẢNH BÁO & RỦI RO TÀI CHÍNH**:
   - Chi tiêu vượt ngân sách và cách khắc phục
   - Các khoản chi bất thường cần theo dõi
   - Rủi ro tài chính tiềm ẩn và cách phòng ngừa
   - Cảnh báo về lạm phát và tác động đến chi tiêu

6. **KẾ HOẠCH HÀNH ĐỘNG CỤ THỂ**:
   - 5 bước ưu tiên để cải thiện tài chính
   - Mục tiêu tiết kiệm đề xuất theo tháng/quý/năm
   - Timeline thực hiện với các mốc quan trọng
   - Cách theo dõi và đánh giá tiến độ

7. **GỢI Ý ĐẦU TƯ THÔNG MINH**:
   - Các kênh đầu tư phù hợp với gia đình VN
   - Tỷ lệ phân bổ tài sản khuyến nghị
   - Cách xây dựng quỹ khẩn cấp
   - Kế hoạch hưu trí cho gia đình

Trả lời bằng tiếng Việt, cấu trúc rõ ràng với bullet points, dễ hiểu, phù hợp với văn hóa Việt Nam. 
Sử dụng số liệu cụ thể và đưa ra lời khuyên thực tế có thể áp dụng ngay.`;

    // Enhanced data analysis with AI insights
    const enhancedData = {
      ...expenseData,
      analysisDate: new Date().toISOString(),
      dataQuality: expenseData?.categoryStats?.length > 0 ? 'Good' : 'Limited',
      totalTransactions: expenseData?.categoryStats?.reduce((sum: number, cat: any) => sum + (cat.count || 0), 0) || 0,
      averageTransaction: expenseData?.totalAmount ? expenseData.totalAmount / (expenseData?.categoryStats?.reduce((sum: number, cat: any) => sum + (cat.count || 0), 0) || 1) : 0,
      monthlyTrend: 'stable', // This would be calculated from historical data
      riskLevel: expenseData?.totalAmount > 20000000 ? 'High' : expenseData?.totalAmount > 15000000 ? 'Medium' : 'Low',
      // Add AI-powered insights
      aiInsights: {
        spendingPattern: analyzeSpendingPattern(expenseData),
        riskFactors: identifyRiskFactors(expenseData),
        opportunities: identifySavingOpportunities(expenseData),
        recommendations: generateSmartRecommendations(expenseData)
      }
    };

    const response = await ai.models.generateContent({
      model: AI_CONFIG.ANALYSIS_MODEL,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.6, // Lower temperature for more consistent analysis
        maxOutputTokens: 3000,
      },
      contents: `Phân tích dữ liệu chi tiêu sau và đưa ra lời khuyên tài chính chuyên sâu:

DỮ LIỆU CHI TIẾT:
${JSON.stringify(enhancedData, null, 2)}

YÊU CẦU: Hãy đưa ra phân tích chi tiết, chính xác và lời khuyên có thể thực hiện ngay.`,
    });
    
    const text = response.text || "";
    if (!text.trim()) {
      return "Không thể tạo phân tích lúc này. Vui lòng thử lại sau.";
    }
    
    // Enhanced post-processing
    let processedText = text;
    
    // Add data quality indicator
    if (enhancedData.dataQuality === 'Limited') {
      processedText += "\n\n⚠️ **Lưu ý quan trọng**: Dữ liệu còn hạn chế. Hãy thêm nhiều giao dịch hơn để có phân tích chính xác và chi tiết hơn.";
    }
    
    // Add AI-powered insights
    processedText += "\n\n🤖 **AI Insights**: " + enhancedData.aiInsights.spendingPattern;
    processedText += "\n\n💡 **Gợi ý hành động ngay**: " + enhancedData.aiInsights.recommendations;
    
    console.log("✅ === SMART FINANCIAL ANALYSIS END ===");
    return processedText;
  } catch (error) {
    console.error("❌ Error generating financial insights:", error);
    return "Có lỗi xảy ra khi phân tích dữ liệu tài chính. Vui lòng thử lại sau.";
  }
}

// Smart AI helper functions
function analyzeSpendingPattern(expenseData: any): string {
  if (!expenseData?.categoryStats || expenseData.categoryStats.length === 0) {
    return "Chưa có đủ dữ liệu để phân tích pattern chi tiêu.";
  }
  
  const topCategory = expenseData.categoryStats[0];
  const totalAmount = expenseData.totalAmount || 0;
  const categoryPercentage = ((topCategory.amount / totalAmount) * 100).toFixed(1);
  
  return `Gia đình chi tiêu nhiều nhất cho ${topCategory.category} (${categoryPercentage}% tổng chi tiêu). Đây là pattern chi tiêu chính cần chú ý.`;
}

function identifyRiskFactors(expenseData: any): string[] {
  const risks = [];
  const totalAmount = expenseData.totalAmount || 0;
  
  if (totalAmount > 20000000) {
    risks.push("Chi tiêu cao có thể ảnh hưởng đến khả năng tiết kiệm");
  }
  
  if (expenseData.categoryStats?.some((cat: any) => cat.amount > totalAmount * 0.4)) {
    risks.push("Có danh mục chi tiêu quá tập trung, cần đa dạng hóa");
  }
  
  return risks;
}

function identifySavingOpportunities(expenseData: any): string[] {
  const opportunities = [];
  
  if (expenseData.categoryStats?.some((cat: any) => cat.category === "Giải trí" && cat.amount > 2000000)) {
    opportunities.push("Có thể giảm chi tiêu giải trí để tiết kiệm");
  }
  
  if (expenseData.categoryStats?.some((cat: any) => cat.category === "Ăn uống" && cat.amount > 5000000)) {
    opportunities.push("Có thể nấu ăn tại nhà nhiều hơn để tiết kiệm chi phí ăn uống");
  }
  
  return opportunities;
}

function generateSmartRecommendations(expenseData: any): string {
  const recommendations = [];
  const totalAmount = expenseData.totalAmount || 0;
  
  if (totalAmount > 15000000) {
    recommendations.push("Xem xét tạo ngân sách chi tiết để kiểm soát chi tiêu");
  }
  
  recommendations.push("Theo dõi chi tiêu hàng ngày để phát hiện xu hướng");
  recommendations.push("Đặt mục tiêu tiết kiệm 10-20% thu nhập mỗi tháng");
  
  return recommendations.join(". ");
}

// Enhanced function for smart expense suggestions
export async function generateExpenseSuggestions(expenseData: any, budget: number): Promise<string> {
  try {
    console.log("💡 === SMART EXPENSE SUGGESTIONS START ===");
    
    const systemPrompt = `Bạn là một chuyên gia tư vấn tài chính gia đình Việt Nam với 20 năm kinh nghiệm. 
Dựa trên dữ liệu chi tiêu hiện tại và ngân sách, đưa ra gợi ý thông minh để tối ưu hóa chi tiêu.

TÍNH NĂNG THÔNG MINH:
- Phân tích chi tiêu hiện tại so với ngân sách với AI
- Đưa ra gợi ý tiết kiệm cụ thể cho từng danh mục với số tiền cụ thể
- Cảnh báo các khoản chi tiêu có thể vượt ngân sách
- Gợi ý phân bổ ngân sách tối ưu theo quy tắc 50-30-20
- Đưa ra mẹo tiết kiệm thực tế cho gia đình VN
- Phân tích xu hướng chi tiêu và dự đoán rủi ro
- Đưa ra kế hoạch hành động cụ thể để cải thiện tài chính

Trả lời bằng tiếng Việt, cấu trúc rõ ràng với bullet points, dễ hiểu, có thể sử dụng emoji phù hợp.`;

    const response = await ai.models.generateContent({
      model: AI_CONFIG.ANALYSIS_MODEL,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
      contents: `Dữ liệu chi tiêu: ${JSON.stringify(expenseData, null, 2)}
Ngân sách tháng: ${budget.toLocaleString('vi-VN')} VNĐ

Hãy đưa ra gợi ý tối ưu hóa chi tiêu thông minh và khả thi.`,
    });
    
    console.log("✅ === SMART EXPENSE SUGGESTIONS END ===");
    return response.text || "Không thể tạo gợi ý lúc này.";
  } catch (error) {
    console.error("❌ Error generating expense suggestions:", error);
    return "Có lỗi xảy ra khi tạo gợi ý chi tiêu.";
  }
}

// Enhanced function for budget optimization
export async function optimizeBudget(expenseData: any, income: number): Promise<string> {
  try {
    console.log("📊 === SMART BUDGET OPTIMIZATION START ===");
    
    const systemPrompt = `Bạn là một chuyên gia tối ưu hóa ngân sách gia đình Việt Nam với 15 năm kinh nghiệm.
Dựa trên thu nhập và chi tiêu hiện tại, đưa ra kế hoạch ngân sách tối ưu.

TÍNH NĂNG THÔNG MINH:
- Phân tích tỷ lệ chi tiêu/thu nhập với AI
- Đưa ra phân bổ ngân sách theo quy tắc 50-30-20 (50% nhu cầu, 30% muốn, 20% tiết kiệm)
- Gợi ý mức tiết kiệm phù hợp với thu nhập
- Cảnh báo các khoản chi tiêu rủi ro và cách khắc phục
- Đưa ra kế hoạch tài chính dài hạn và ngắn hạn
- Phân tích khả năng đầu tư và xây dựng tài sản
- Đưa ra timeline thực hiện cụ thể

Trả lời bằng tiếng Việt, cấu trúc rõ ràng với bullet points, dễ hiểu, có thể sử dụng emoji phù hợp.`;

    const response = await ai.models.generateContent({
      model: AI_CONFIG.ANALYSIS_MODEL,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.6,
        maxOutputTokens: 2500,
      },
      contents: `Thu nhập: ${income.toLocaleString('vi-VN')} VNĐ
Chi tiêu: ${JSON.stringify(expenseData, null, 2)}

Hãy tối ưu hóa ngân sách và đưa ra kế hoạch tài chính thông minh.`,
    });
    
    console.log("✅ === SMART BUDGET OPTIMIZATION END ===");
    return response.text || "Không thể tối ưu ngân sách lúc này.";
  } catch (error) {
    console.error("❌ Error optimizing budget:", error);
    return "Có lỗi xảy ra khi tối ưu ngân sách.";
  }
}

// New function for smart financial predictions
export async function generateFinancialPredictions(expenseData: any): Promise<string> {
  try {
    console.log("🔮 === SMART FINANCIAL PREDICTIONS START ===");
    
    const systemPrompt = `Bạn là một chuyên gia dự đoán tài chính gia đình Việt Nam với 20 năm kinh nghiệm.
Dựa trên dữ liệu chi tiêu lịch sử, đưa ra dự đoán thông minh về tài chính gia đình.

TÍNH NĂNG THÔNG MINH:
- Dự đoán xu hướng chi tiêu 3-6 tháng tới với AI
- Phân tích rủi ro tài chính tiềm ẩn
- Đưa ra cảnh báo sớm về các vấn đề tài chính
- Dự đoán nhu cầu tiền mặt theo mùa
- Phân tích tác động của lạm phát đến chi tiêu
- Đưa ra kế hoạch dự phòng tài chính
- Dự đoán khả năng đạt mục tiêu tài chính

Trả lời bằng tiếng Việt, cấu trúc rõ ràng với bullet points, dễ hiểu, có thể sử dụng emoji phù hợp.`;

    const response = await ai.models.generateContent({
      model: AI_CONFIG.ANALYSIS_MODEL,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
      contents: `Dữ liệu chi tiêu lịch sử: ${JSON.stringify(expenseData, null, 2)}

Hãy đưa ra dự đoán tài chính thông minh và kế hoạch dự phòng.`,
    });
    
    console.log("✅ === SMART FINANCIAL PREDICTIONS END ===");
    return response.text || "Không thể tạo dự đoán lúc này.";
  } catch (error) {
    console.error("❌ Error generating financial predictions:", error);
    return "Có lỗi xảy ra khi tạo dự đoán tài chính.";
  }
}

// New function for smart investment advice
export async function generateInvestmentAdvice(expenseData: any, riskProfile: string = "moderate"): Promise<string> {
  try {
    console.log("🚀 === SMART INVESTMENT ADVICE START ===");
    
    const systemPrompt = `Bạn là một chuyên gia đầu tư tài chính gia đình Việt Nam với 20 năm kinh nghiệm.
Dựa trên dữ liệu chi tiêu và hồ sơ rủi ro, đưa ra lời khuyên đầu tư thông minh.

TÍNH NĂNG THÔNG MINH:
- Phân tích khả năng đầu tư dựa trên chi tiêu hiện tại
- Đưa ra kế hoạch đầu tư phù hợp với hồ sơ rủi ro
- Gợi ý các kênh đầu tư phù hợp với gia đình VN
- Phân tích tỷ lệ phân bổ tài sản tối ưu
- Đưa ra timeline đầu tư dài hạn và ngắn hạn
- Cảnh báo rủi ro đầu tư và cách phòng ngừa
- Gợi ý xây dựng quỹ khẩn cấp trước khi đầu tư

Trả lời bằng tiếng Việt, cấu trúc rõ ràng với bullet points, dễ hiểu, có thể sử dụng emoji phù hợp.`;

    const response = await ai.models.generateContent({
      model: AI_CONFIG.ANALYSIS_MODEL,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.6,
        maxOutputTokens: 2500,
      },
      contents: `Dữ liệu chi tiêu: ${JSON.stringify(expenseData, null, 2)}
Hồ sơ rủi ro: ${riskProfile}

Hãy đưa ra lời khuyên đầu tư thông minh và phù hợp.`,
    });
    
    console.log("✅ === SMART INVESTMENT ADVICE END ===");
    return response.text || "Không thể tạo lời khuyên đầu tư lúc này.";
  } catch (error) {
    console.error("❌ Error generating investment advice:", error);
    return "Có lỗi xảy ra khi tạo lời khuyên đầu tư.";
  }
}
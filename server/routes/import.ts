import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { expenses } from "@shared/schema";
import { eq } from "drizzle-orm";
import { categorizeExpense } from "../gemini";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Import expenses from file
router.post("/expenses/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.file;
    const userId = req.user?.userId;
    const familyId = req.user?.familyId;

    if (!userId || !familyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let expensesData: any[] = [];

    // Parse file based on type
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      expensesData = await parseCSV(file.buffer.toString());
    } else if (file.mimetype.includes("spreadsheet") || file.originalname.endsWith(".xlsx") || file.originalname.endsWith(".xls")) {
      expensesData = await parseExcel(file.buffer);
    } else {
      return res.status(400).json({ error: "Unsupported file format" });
    }

    // Process and save expenses
    const savedExpenses = [];
    for (const expense of expensesData) {
      try {
        // Use AI to categorize if no category provided
        let category = expense.category;
        let aiConfidence = 0.8; // Default confidence for manual entries

        if (!category) {
          const aiResult = await categorizeExpense(expense.description);
          category = aiResult.category;
          aiConfidence = aiResult.confidence;
        }

        const [newExpense] = await db.insert(expenses).values({
          description: expense.description,
          amount: expense.amount.toString(),
          category: category,
          userId: userId,
          familyId: familyId,
          aiConfidence: aiConfidence.toString(),
          isManualCategory: !!expense.category,
          createdAt: expense.date ? new Date(expense.date) : new Date(),
        }).returning();

        savedExpenses.push(newExpense);
      } catch (error) {
        console.error("Error saving expense:", error);
        // Continue with other expenses
      }
    }

    res.json({
      success: true,
      count: savedExpenses.length,
      message: `Successfully imported ${savedExpenses.length} expenses`
    });

  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: "Failed to import expenses" });
  }
});

async function parseCSV(csvContent: string): Promise<any[]> {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const expenses = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());
    if (values.length < 2) continue;

    const expense = {
      description: values[0] || '',
      amount: parseFloat(values[1]) || 0,
      category: values[2] || '',
      date: values[3] ? parseDate(values[3]) : null
    };

    if (expense.description && expense.amount > 0) {
      expenses.push(expense);
    }
  }

  return expenses;
}

async function parseExcel(buffer: Buffer): Promise<any[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  return jsonData.map((row: any) => ({
    description: row['Mô tả'] || row['Description'] || row['description'] || '',
    amount: parseFloat(row['Số tiền'] || row['Amount'] || row['amount'] || 0),
    category: row['Danh mục'] || row['Category'] || row['category'] || '',
    date: row['Ngày tạo'] || row['Date'] || row['date'] ? parseDate(row['Ngày tạo'] || row['Date'] || row['date']) : null
  })).filter(expense => expense.description && expense.amount > 0);
}

function parseDate(dateStr: string): Date | null {
  try {
    // Try different date formats
    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      /(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0]) { // DD/MM/YYYY
          return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
        } else if (format === formats[1]) { // YYYY-MM-DD
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        } else if (format === formats[2]) { // DD-MM-YYYY
          return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
        }
      }
    }

    // Fallback to Date constructor
    return new Date(dateStr);
  } catch (error) {
    console.error("Date parsing error:", error);
    return null;
  }
}

export default router;

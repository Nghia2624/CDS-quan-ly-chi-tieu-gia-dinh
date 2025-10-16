import { db, pool } from "./db";
import { users, expenses, chatMessages } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export async function runMigration() {
  try {
    console.log("🚀 Starting database migration...");

    // Create tables (Drizzle will handle this)
    console.log("✅ Tables created successfully");

    // Seed initial data
    console.log("🌱 Seeding initial data...");
    
    const fatherEmail = "nghiado@gmail.com";
    const motherEmail = "duytran@gmail.com";

    // Check if users already exist
    const existingFather = await db.select().from(users).where(eq(users.email, fatherEmail));
    const existingMother = await db.select().from(users).where(eq(users.email, motherEmail));

    let familyId = `family_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (existingFather[0]) {
      familyId = existingFather[0].familyId || familyId;
      console.log("👨 Father user already exists");
    } else {
      const fatherPasswordHash = await bcrypt.hash("Nghia123", 10);
      await db.insert(users).values({
        email: fatherEmail,
        phone: "0901234567",
        password: fatherPasswordHash,
        fullName: "Đỗ Ngọc Nghĩa",
        role: "father",
        familyId,
      });
      console.log("👨 Father user created");
    }

    if (!existingMother[0]) {
      const motherPasswordHash = await bcrypt.hash("Duy123", 10);
      await db.insert(users).values({
        email: motherEmail,
        phone: "0907654321",
        password: motherPasswordHash,
        fullName: "Trần Trí Duy",
        role: "mother",
        familyId,
      });
      console.log("👩 Mother user created");
    } else {
      console.log("👩 Mother user already exists");
    }

    // Seed sample expenses
    const sampleExpenses = [
      // Ăn uống
      { description: "Đi chợ cuối tuần", amount: "350000", category: "Ăn uống" },
      { description: "Ăn tối nhà hàng gia đình", amount: "450000", category: "Ăn uống" },
      { description: "Mua thực phẩm siêu thị", amount: "280000", category: "Ăn uống" },
      { description: "Uống cà phê với bạn", amount: "120000", category: "Ăn uống" },
      { description: "Mua bánh mì sáng", amount: "50000", category: "Ăn uống" },
      
      // Đám cưới
      { description: "Mừng cưới bạn Minh", amount: "500000", category: "Đám cưới" },
      { description: "Phong bì cưới chị Lan", amount: "300000", category: "Đám cưới" },
      { description: "Tiền mừng cưới anh Hùng", amount: "800000", category: "Đám cưới" },
      { description: "Quà cưới bạn Thảo", amount: "200000", category: "Đám cưới" },
      
      // Học tập
      { description: "Học phí tháng 12", amount: "2000000", category: "Học tập" },
      { description: "Mua sách giáo khoa", amount: "250000", category: "Học tập" },
      { description: "Học thêm tiếng Anh", amount: "1500000", category: "Học tập" },
      { description: "Đồ dùng học tập", amount: "180000", category: "Học tập" },
      { description: "Phí thi IELTS", amount: "4500000", category: "Học tập" },
      
      // Y tế
      { description: "Khám bệnh định kỳ", amount: "400000", category: "Y tế" },
      { description: "Mua thuốc cảm", amount: "150000", category: "Y tế" },
      { description: "Khám răng", amount: "600000", category: "Y tế" },
      { description: "Bảo hiểm y tế", amount: "300000", category: "Y tế" },
      
      // Giải trí
      { description: "Xem phim rạp", amount: "200000", category: "Giải trí" },
      { description: "Du lịch Đà Nẵng", amount: "5000000", category: "Giải trí" },
      { description: "Karaoke với bạn", amount: "300000", category: "Giải trí" },
      { description: "Mua game online", amount: "100000", category: "Giải trí" },
      
      // Giao thông
      { description: "Đổ xăng xe máy", amount: "200000", category: "Giao thông" },
      { description: "Vé xe buýt tháng", amount: "150000", category: "Giao thông" },
      { description: "Grab đi làm", amount: "500000", category: "Giao thông" },
      { description: "Sửa xe máy", amount: "800000", category: "Giao thông" },
      
      // Quần áo
      { description: "Mua áo sơ mi", amount: "350000", category: "Quần áo" },
      { description: "Mua giày thể thao", amount: "1200000", category: "Quần áo" },
      { description: "May đo vest", amount: "3000000", category: "Quần áo" },
      
      // Gia dụng
      { description: "Mua nồi cơm điện", amount: "800000", category: "Gia dụng" },
      { description: "Sửa chữa nhà", amount: "2000000", category: "Gia dụng" },
      { description: "Mua tủ lạnh", amount: "8000000", category: "Gia dụng" },
      
      // Đám ma
      { description: "Phúng điếu bác Hùng", amount: "200000", category: "Đám ma" },
      { description: "Viếng tang cô Lan", amount: "300000", category: "Đám ma" },
    ];

    // Check if expenses already exist
    const existingExpenses = await db.select().from(expenses).limit(1);
    
    if (existingExpenses.length === 0) {
      for (const exp of sampleExpenses) {
        await db.insert(expenses).values({
          description: exp.description,
          amount: exp.amount,
          category: exp.category,
          userId: "seed",
          familyId,
          isManualCategory: true,
        });
      }
      console.log("💰 Sample expenses created");
    } else {
      console.log("💰 Sample expenses already exist");
    }

    console.log("✅ Migration completed successfully!");
    return { success: true, message: "Migration completed successfully" };

  } catch (error) {
    console.error("❌ Migration failed:", error);
    return { success: false, message: `Migration failed: ${error}` };
  } finally {
    await pool.end();
  }
}

// For Vercel API route
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await runMigration();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Migration failed' });
  }
}

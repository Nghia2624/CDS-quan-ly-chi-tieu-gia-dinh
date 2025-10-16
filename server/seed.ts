import { db, pool } from "./db";
import { users, expenses } from "@shared/schema";
import bcrypt from "bcrypt";
import { sql, eq } from "drizzle-orm";

async function main() {
  const fatherEmail = "nghiado@gmail.com";
  const motherEmail = "duytran@gmail.com";
  const child1Email = "tuando@gmail.com";
  const child2Email = "chido@gmail.com";

  const fatherPasswordHash = await bcrypt.hash("Nghia123", 10);
  const motherPasswordHash = await bcrypt.hash("Duy123", 10);
  const child1PasswordHash = await bcrypt.hash("Tuan123", 10);
  const child2PasswordHash = await bcrypt.hash("Chi123", 10);

  // Clear existing sample users if any
  await db.delete(users).where(eq(users.email, "bo@expalm.com"));
  await db.delete(users).where(eq(users.email, "me@explam.com"));
  
  const existingFather = await db.select().from(users).where(eq(users.email, fatherEmail));
  const existingMother = await db.select().from(users).where(eq(users.email, motherEmail));

  // Use consistent family ID for all users
  const familyId = "family_nghia_2025";

  // Clear existing data first
  await db.delete(expenses);
  await db.delete(users);

  // Create father first
  const [father] = await db.insert(users).values({
    email: fatherEmail,
    phone: "0901234567",
    password: fatherPasswordHash,
    fullName: "Đỗ Ngọc Nghĩa",
    role: "father",
    familyId,
  }).returning();

  // Create mother
  const [mother] = await db.insert(users).values({
    email: motherEmail,
    phone: "0907654321",
    password: motherPasswordHash,
    fullName: "Trần Trí Duy",
    role: "mother",
    familyId,
  }).returning();

  // Create children
  const [child1] = await db.insert(users).values({
    email: child1Email,
    phone: "0901111111",
    password: child1PasswordHash,
    fullName: "Đỗ Minh Tuấn",
    role: "child",
    familyId,
  }).returning();

  const [child2] = await db.insert(users).values({
    email: child2Email,
    phone: "0902222222",
    password: child2PasswordHash,
    fullName: "Đỗ Linh Chi",
    role: "child",
    familyId,
  }).returning();

  // Generate realistic expenses distributed across 12 months
  // Budget: 25M/month, Normal spending: 15-17M, High spending: 20-23M (1-2 months)
  const generateExpensesForMonth = (month: number, year: number, isHighSpendingMonth: boolean = false) => {
    const expenses = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Target total for this month - ROUND NUMBERS ONLY
    const targetTotal = isHighSpendingMonth 
      ? Math.floor(Math.random() * 3000000) + 20000000 // 20-23M for high months
      : Math.floor(Math.random() * 2000000) + 15000000; // 15-17M for normal months
    
    // Add seasonal variations
    const seasonalMultiplier = (() => {
      if (month === 1) return 1.3; // Tết - chi tiêu cao
      if (month === 7) return 1.2; // Nghỉ hè - du lịch
      if (month === 11) return 1.1; // Cuối năm - mua sắm
      if (month === 4) return 1.1; // Lễ 30/4 - 1/5
      return 1.0; // Tháng bình thường
    })();
    
    const adjustedTarget = Math.floor(targetTotal * seasonalMultiplier);
    
    // Ăn uống - 12-18 expenses per month (most frequent)
    const foodCount = Math.floor(Math.random() * 7) + 12;
    const foodDescriptions = [
      "Đi chợ Bến Thành mua thực phẩm tuần này",
      "Mua thịt heo, thịt bò cho gia đình",
      "Mua cá tươi, tôm cua ở chợ",
      "Mua rau củ quả tươi theo mùa",
      "Mua gạo ST25 và gia vị nấu ăn",
      "Đi siêu thị Co.opmart mua đồ ăn",
      "Mua sữa Vinamilk cho con",
      "Mua bánh mì và đồ ăn sáng",
      "Mua nước suối, nước ngọt",
      "Mua trái cây: xoài, dưa hấu, cam",
      "Mua đồ ăn vặt cho con: kẹo, bánh",
      "Mua thực phẩm đóng hộp: cá hộp, thịt hộp",
      "Mua đồ ăn cho bữa tối gia đình",
      "Mua đồ ăn cho bữa trưa văn phòng",
      "Mua đồ ăn cho bữa sáng",
      "Mua đồ ăn cho cuối tuần",
      "Mua đồ ăn cho Tết",
      "Mua đồ ăn cho đám cưới"
    ];
    for (let i = 0; i < foodCount; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      
      // Adjust amounts based on day of week (weekends more expensive)
      const baseAmounts = ["20000", "30000", "50000", "80000", "100000", "150000", "200000", "250000", "300000", "350000", "400000"];
      const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 1.0;
      const amounts = baseAmounts.map(amt => Math.floor(parseFloat(amt) * weekendMultiplier).toString());
      
      expenses.push({
        description: foodDescriptions[Math.floor(Math.random() * foodDescriptions.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        category: "Ăn uống",
        createdAt: date
      });
    }
    
    // Đám cưới - 1-3 per month
    const weddingCount = Math.floor(Math.random() * 3) + 1;
    const weddingDescriptions = [
      "Mừng cưới bạn Minh - phong bì",
      "Phong bì cưới chị Lan - tiền mừng",
      "Tiền mừng cưới anh Hùng",
      "Quà cưới bạn Thảo",
      "Đi đám cưới đồng nghiệp - phong bì",
      "Tiền mừng cưới em gái",
      "Phúng điếu cưới bạn học",
      "Đi đám cưới con bạn - phong bì",
      "Mừng cưới cháu - tiền mừng"
    ];
    for (let i = 0; i < weddingCount; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      const date = new Date(year, month - 1, day);
      
      // Weddings more likely on weekends
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const dayAdjustment = isWeekend ? 1.0 : 0.7;
      
      // Realistic wedding gift amounts: 500K-2M - ROUND NUMBERS ONLY
      const baseAmounts = ["500000", "800000", "1000000", "1200000", "1500000", "2000000"];
      const amounts = baseAmounts.map(amt => Math.floor(parseFloat(amt) * dayAdjustment).toString());
      
      expenses.push({
        description: weddingDescriptions[Math.floor(Math.random() * weddingDescriptions.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        category: "Đám cưới",
        createdAt: date
      });
    }
    
    // Học tập - 3-5 per month
    const studyCount = Math.floor(Math.random() * 3) + 3;
    const studyDescriptions = [
      "Học phí tháng này của con",
      "Mua sách giáo khoa mới cho con",
      "Học thêm tiếng Anh tại trung tâm",
      "Mua đồ dùng học tập: bút, vở, thước",
      "Mua vở và bút cho con đi học",
      "Đóng tiền khóa học online cho con",
      "Mua sách tham khảo toán, lý, hóa",
      "Học phí lớp nhạc piano cho con",
      "Mua máy tính cho con học online",
      "Học phí lớp vẽ cho con",
      "Mua đồng phục học sinh",
      "Đóng tiền bán trú cho con"
    ];
    for (let i = 0; i < studyCount; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      const date = new Date(year, month - 1, day);
      
      // School expenses more likely at beginning of month
      const isBeginningOfMonth = day <= 10;
      const timeAdjustment = isBeginningOfMonth ? 1.2 : 0.8;
      
      // Realistic study amounts: 30K-2M (học phí, sách, đồ dùng) - ROUND NUMBERS ONLY
      const baseAmounts = ["30000", "50000", "100000", "200000", "300000", "500000", "800000", "1000000", "1500000", "2000000"];
      const amounts = baseAmounts.map(amt => Math.floor(parseFloat(amt) * timeAdjustment).toString());
      
      expenses.push({
        description: studyDescriptions[Math.floor(Math.random() * studyDescriptions.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        category: "Học tập",
        createdAt: date
      });
    }
    
    // Y tế - 2-4 per month
    const healthCount = Math.floor(Math.random() * 3) + 2;
    const healthDescriptions = [
      "Khám bệnh định kỳ tại bệnh viện",
      "Mua thuốc cảm cúm cho gia đình",
      "Khám răng cho con tại nha khoa",
      "Đóng bảo hiểm y tế gia đình",
      "Mua thuốc bổ cho con",
      "Khám mắt cho con tại bệnh viện mắt",
      "Mua vitamin tổng hợp",
      "Khám sức khỏe tổng quát",
      "Mua thuốc đau đầu",
      "Khám phụ khoa định kỳ"
    ];
    for (let i = 0; i < healthCount; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      // Realistic health amounts: 100K-800K - ROUND NUMBERS ONLY
      const amounts = ["100000", "200000", "300000", "400000", "500000", "600000", "800000"];
      expenses.push({
        description: healthDescriptions[Math.floor(Math.random() * healthDescriptions.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        category: "Y tế",
        createdAt: new Date(year, month - 1, day)
      });
    }
    
    // Giải trí - 4-7 per month
    const entertainmentCount = Math.floor(Math.random() * 4) + 4;
    const entertainmentDescriptions = [
      "Xem phim rạp CGV cuối tuần",
      "Du lịch Đà Lạt 2 ngày 1 đêm",
      "Karaoke với bạn bè",
      "Mua game và nạp thẻ cho con",
      "Đi cà phê Highlands thư giãn",
      "Xem ca nhạc live tại sân khấu",
      "Chơi thể thao bowling",
      "Đi công viên Suối Tiên",
      "Mua vé xem bóng đá V-League",
      "Đi spa thư giãn",
      "Xem phim Netflix tại nhà",
      "Đi chơi khu vui chơi cho con"
    ];
    for (let i = 0; i < entertainmentCount; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      
      // Entertainment more likely on weekends
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const weekendMultiplier = isWeekend ? 1.3 : 0.8;
      
      // Realistic entertainment amounts: 50K-800K - ROUND NUMBERS ONLY
      const baseAmounts = ["50000", "80000", "100000", "150000", "200000", "300000", "400000", "500000", "600000", "800000"];
      const amounts = baseAmounts.map(amt => Math.floor(parseFloat(amt) * weekendMultiplier).toString());
      
      expenses.push({
        description: entertainmentDescriptions[Math.floor(Math.random() * entertainmentDescriptions.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        category: "Giải trí",
        createdAt: date
      });
    }
    
    // Giao thông - 6-12 per month (frequent)
    const transportCount = Math.floor(Math.random() * 7) + 6;
    const transportDescriptions = [
      "Đổ xăng xe máy Honda",
      "Vé xe buýt tháng cho con đi học",
      "Grab đi làm về",
      "Sửa xe máy định kỳ tại garage",
      "Đi taxi về nhà",
      "Đổ xăng ô tô Toyota",
      "Rửa xe cuối tuần",
      "Gửi xe tháng tại văn phòng",
      "Bảo dưỡng xe định kỳ",
      "Đi Grab về muộn",
      "Đổ xăng xe máy lần 2",
      "Vé xe buýt cho vợ đi làm",
      "Grab đi chợ",
      "Sửa lốp xe máy"
    ];
    for (let i = 0; i < transportCount; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      
      // Transport expenses more frequent on weekdays
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      const frequencyAdjustment = isWeekday ? 1.0 : 0.6;
      
      // Realistic transport amounts: 20K-400K - ROUND NUMBERS ONLY
      const baseAmounts = ["20000", "30000", "50000", "80000", "100000", "150000", "200000", "250000", "300000", "400000"];
      const amounts = baseAmounts.map(amt => Math.floor(parseFloat(amt) * frequencyAdjustment).toString());
      
      expenses.push({
        description: transportDescriptions[Math.floor(Math.random() * transportDescriptions.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        category: "Giao thông",
        createdAt: date
      });
    }
    
    // Quần áo - 2-4 per month
    const clothingCount = Math.floor(Math.random() * 3) + 2;
    const clothingDescriptions = [
      "Mua áo sơ mi mới cho chồng đi làm",
      "Mua giày thể thao Nike cho con",
      "Mua quần jean cho vợ",
      "Mua áo khoác mùa đông cho gia đình",
      "Mua đồ lót cho cả nhà",
      "Mua túi xách cho vợ",
      "Mua dép đi trong nhà cho gia đình",
      "Mua áo thun cho con đi học",
      "Mua quần short cho con trai",
      "Mua váy cho con gái",
      "Mua đồng phục học sinh cho con",
      "Mua áo dài cho vợ đi đám cưới"
    ];
    for (let i = 0; i < clothingCount; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      // Realistic clothing amounts: 150K-2M - ROUND NUMBERS ONLY
      const amounts = ["150000", "200000", "300000", "400000", "500000", "600000", "800000", "1000000", "1200000", "1500000", "2000000"];
      expenses.push({
        description: clothingDescriptions[Math.floor(Math.random() * clothingDescriptions.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        category: "Quần áo",
        createdAt: new Date(year, month - 1, day)
      });
    }
    
    // Gia dụng - 1-3 per month (bigger expenses, not every month)
    const householdCount = isHighSpendingMonth ? 3 : Math.floor(Math.random() * 3) + 1;
    const householdDescriptions = [
      "Mua nồi cơm điện Toshiba mới",
      "Sửa chữa nhà cửa",
      "Mua quạt điện cho phòng ngủ",
      "Mua bàn ghế phòng khách IKEA",
      "Sửa điện nước trong nhà",
      "Mua đồ dùng nhà bếp: nồi, chảo",
      "Mua đèn trang trí phòng khách",
      "Mua máy giặt Samsung",
      "Sửa tủ lạnh Panasonic",
      "Mua chăn ga gối đệm cho gia đình",
      "Mua rèm cửa cho phòng ngủ",
      "Thay ống nước trong nhà",
      "Mua bếp gas mới",
      "Sửa cửa sổ phòng khách"
    ];
    for (let i = 0; i < householdCount; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      // Realistic household amounts: 300K-5M (đồ gia dụng lớn) - ROUND NUMBERS ONLY
      const amounts = ["300000", "500000", "800000", "1000000", "1500000", "2000000", "2500000", "3000000", "4000000", "5000000"];
      expenses.push({
        description: householdDescriptions[Math.floor(Math.random() * householdDescriptions.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        category: "Gia dụng",
        createdAt: new Date(year, month - 1, day)
      });
    }
    
    // Đám ma - 0-2 per month
    const funeralCount = Math.floor(Math.random() * 3);
    const funeralDescriptions = [
      "Viếng tang cô Lan - phúng điếu 1 triệu",
      "Phúng điếu bác Hùng",
      "Đi đám tang chú Minh",
      "Hoa viếng tang bà ngoại",
      "Tiền phúng điếu cô dì",
      "Đi viếng tang bác ruột",
      "Phúng điếu chú họ",
      "Hoa viếng tang ông nội"
    ];
    for (let i = 0; i < funeralCount; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      // Realistic funeral amounts: 500K-2M - ROUND NUMBERS ONLY
      const amounts = ["500000", "800000", "1000000", "1200000", "1500000", "2000000"];
      expenses.push({
        description: funeralDescriptions[Math.floor(Math.random() * funeralDescriptions.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        category: "Đám ma",
        createdAt: new Date(year, month - 1, day)
      });
    }
    
    // Khác - 1-3 per month
    const otherCount = Math.floor(Math.random() * 3) + 1;
    const otherDescriptions = [
      "Mua quà sinh nhật cho con",
      "Đóng tiền điện thoại tháng",
      "Mua quà tặng bạn bè",
      "Đóng tiền internet tháng",
      "Mua quà cho mẹ",
      "Đóng tiền bảo hiểm xe",
      "Mua quà cho vợ",
      "Đóng tiền điện nước tháng",
      "Mua quà cho chồng",
      "Đóng tiền thuê nhà",
      "Mua quà cho con",
      "Đóng tiền bảo hiểm nhân thọ"
    ];
    for (let i = 0; i < otherCount; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      // Realistic other amounts: 100K-5M - ROUND NUMBERS ONLY
      const amounts = ["100000", "150000", "200000", "250000", "300000", "400000", "500000", "800000", "1000000", "2000000", "5000000"];
      expenses.push({
        description: otherDescriptions[Math.floor(Math.random() * otherDescriptions.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        category: "Khác",
        createdAt: new Date(year, month - 1, day)
      });
    }
    
    // Calculate total and scale to target
    const currentTotal = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const scaleFactor = adjustedTarget / currentTotal;
    
    // Scale all amounts to match target - ROUND TO NEAREST 10000 for cleaner numbers
    expenses.forEach(expense => {
      const scaledAmount = Math.round(parseFloat(expense.amount) * scaleFactor);
      // Round to nearest 10000 to ensure clean numbers (ending in 0000)
      const roundedAmount = Math.round(scaledAmount / 10000) * 10000;
      expense.amount = roundedAmount.toString();
    });
    
    return expenses;
  };

  // Generate expenses for the last 12 months with realistic patterns
  const currentDate = new Date();
  const sampleExpenses = [];
  
  // Define spending patterns for different months
  const spendingPatterns = [
    { month: 0, pattern: 'normal', reason: 'Tháng bình thường' },
    { month: 1, pattern: 'high', reason: 'Tết Nguyên Đán - chi tiêu cao' },
    { month: 2, pattern: 'normal', reason: 'Sau Tết - chi tiêu bình thường' },
    { month: 3, pattern: 'normal', reason: 'Tháng bình thường' },
    { month: 4, pattern: 'high', reason: 'Lễ 30/4 - 1/5 - chi tiêu cao' },
    { month: 5, pattern: 'normal', reason: 'Tháng bình thường' },
    { month: 6, pattern: 'normal', reason: 'Tháng bình thường' },
    { month: 7, pattern: 'high', reason: 'Nghỉ hè - du lịch - chi tiêu cao' },
    { month: 8, pattern: 'normal', reason: 'Tháng bình thường' },
    { month: 9, pattern: 'normal', reason: 'Tháng bình thường' },
    { month: 10, pattern: 'normal', reason: 'Tháng bình thường' },
    { month: 11, pattern: 'high', reason: 'Cuối năm - mua sắm - chi tiêu cao' }
  ];
  
  for (let i = 11; i >= 0; i--) {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const pattern = spendingPatterns[i];
    const isHighSpending = pattern.pattern === 'high';
    
    console.log(`Generating expenses for ${targetDate.toLocaleDateString('vi-VN')} - ${pattern.reason}`);
    
    const monthExpenses = generateExpensesForMonth(
      targetDate.getMonth() + 1, 
      targetDate.getFullYear(),
      isHighSpending
    );
    
    sampleExpenses.push(...monthExpenses);
  }

  // Clear existing expenses
  await db.delete(expenses);

  // Insert sample expenses
  for (const expense of sampleExpenses) {
    // Randomly assign to father or mother
    const randomUser = Math.random() > 0.5 ? father : mother;
    await db.insert(expenses).values({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      familyId,
      userId: randomUser.id,
      createdAt: expense.createdAt,
    });
  }

  console.log("Seeded sample users and expenses.");
  await pool.end();
}

main().catch(console.error);
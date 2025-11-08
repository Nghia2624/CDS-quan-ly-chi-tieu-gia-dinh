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
  // NGÂN SÁCH: 25 triệu/tháng (cố định)
  // Tháng chi tiêu CAO: 20-22 triệu (gần hết ngân sách)
  // Tháng chi tiêu THẤP: 18-20 triệu (tiết kiệm được)
  const generateExpensesForMonth = (month: number, year: number, spendingLevel: 'high' | 'normal' = 'normal', maxDay?: number) => {
    const expenses = [];
    const daysInMonth = maxDay || new Date(year, month, 0).getDate(); // Sử dụng maxDay nếu có
    
    // Target total cho tháng này - CHÍNH XÁC theo yêu cầu
    // Nếu tháng 11/2025 chỉ tạo đến ngày 8, target khoảng 10M cho 8 ngày đầu
    let targetTotal;
    if (year === 2025 && month === 11 && maxDay && maxDay === 8) {
      // Tháng 11/2025 chỉ đến ngày 8: target khoảng 10M cho 8 ngày đầu tháng
      targetTotal = 9500000 + Math.floor(Math.random() * 1000000); // 9.5-10.5M
    } else if (spendingLevel === 'high') {
      // Tháng chi tiêu cao: 20-22 triệu
      targetTotal = 20000000 + Math.floor(Math.random() * 2000000); // 20-22M
    } else {
      // Tháng chi tiêu thấp: 18-20 triệu
      targetTotal = 18000000 + Math.floor(Math.random() * 2000000); // 18-20M
    }
    
    console.log(`   Month ${month}/${year}: Target ${(targetTotal / 1000000).toFixed(1)}M VNĐ (${spendingLevel}${maxDay && maxDay < 30 ? `, ${maxDay} days only` : ''})`);
    
    // Ăn uống - 12-18 expenses per month (most frequent)
    // Nếu tháng 11/2025 chỉ đến ngày 8, giảm số lượng expenses theo tỷ lệ
    let foodCount;
    if (year === 2025 && month === 11 && maxDay && maxDay === 8) {
      // 8 ngày đầu tháng: khoảng 1/4 số expenses của tháng đầy đủ
      foodCount = Math.floor(Math.random() * 3) + 3; // 3-5 expenses cho 8 ngày
    } else {
      foodCount = Math.floor(Math.random() * 7) + 12; // 12-18 expenses cho tháng đầy đủ
    }
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
    
    // Đám cưới - 1-3 per month (giảm nếu chỉ đến ngày 8)
    let weddingCount;
    if (year === 2025 && month === 11 && maxDay && maxDay === 8) {
      weddingCount = Math.floor(Math.random() * 2); // 0-1 cho 8 ngày đầu
    } else {
      weddingCount = Math.floor(Math.random() * 3) + 1; // 1-3 cho tháng đầy đủ
    }
    const weddingDescriptions = [
      "Mừng cưới bạn Minh - phong bì",
      "Phong bì cưới chị Lan - tiền mừng",
      "Tiền mừng cưới anh Hùng",
      "Quà cưới bạn Thảo",
      "Đi đám cưới đồng nghiệp - phong bì",
      "Tiền mừng cưới em gái",
      "Đi đám cưới bạn học - phong bì",
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
    
    // Học tập - 3-5 per month (giảm nếu chỉ đến ngày 8)
    let studyCount;
    if (year === 2025 && month === 11 && maxDay && maxDay === 8) {
      studyCount = Math.floor(Math.random() * 2) + 1; // 1-2 cho 8 ngày đầu
    } else {
      studyCount = Math.floor(Math.random() * 3) + 3; // 3-5 cho tháng đầy đủ
    }
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
    
    // Y tế - 2-4 per month (giảm nếu chỉ đến ngày 8)
    let healthCount;
    if (year === 2025 && month === 11 && maxDay && maxDay === 8) {
      healthCount = Math.floor(Math.random() * 2); // 0-1 cho 8 ngày đầu
    } else {
      healthCount = Math.floor(Math.random() * 3) + 2; // 2-4 cho tháng đầy đủ
    }
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
    
    // Giải trí - 4-7 per month (giảm nếu chỉ đến ngày 8)
    let entertainmentCount;
    if (year === 2025 && month === 11 && maxDay && maxDay === 8) {
      entertainmentCount = Math.floor(Math.random() * 2) + 1; // 1-2 cho 8 ngày đầu
    } else {
      entertainmentCount = Math.floor(Math.random() * 4) + 4; // 4-7 cho tháng đầy đủ
    }
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
    
    // Giao thông - 6-12 per month (frequent) (giảm nếu chỉ đến ngày 8)
    let transportCount;
    if (year === 2025 && month === 11 && maxDay && maxDay === 8) {
      transportCount = Math.floor(Math.random() * 3) + 2; // 2-4 cho 8 ngày đầu
    } else {
      transportCount = Math.floor(Math.random() * 7) + 6; // 6-12 cho tháng đầy đủ
    }
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
    
    // Quần áo - 2-4 per month (giảm nếu chỉ đến ngày 8)
    let clothingCount;
    if (year === 2025 && month === 11 && maxDay && maxDay === 8) {
      clothingCount = Math.floor(Math.random() * 2); // 0-1 cho 8 ngày đầu
    } else {
      clothingCount = Math.floor(Math.random() * 3) + 2; // 2-4 cho tháng đầy đủ
    }
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
    
    // Gia dụng - 1-3 per month (bigger expenses, more in high spending months) (giảm nếu chỉ đến ngày 8)
    let householdCount;
    if (year === 2025 && month === 11 && maxDay && maxDay === 8) {
      householdCount = Math.floor(Math.random() * 2); // 0-1 cho 8 ngày đầu
    } else {
      householdCount = spendingLevel === 'high' ? 3 : Math.floor(Math.random() * 3) + 1;
    }
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
    
    // Đám ma - 0-2 per month (giảm nếu chỉ đến ngày 8)
    let funeralCount;
    if (year === 2025 && month === 11 && maxDay && maxDay === 8) {
      funeralCount = 0; // Không có đám ma trong 8 ngày đầu
    } else {
      funeralCount = Math.floor(Math.random() * 3); // 0-2 cho tháng đầy đủ
    }
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
    
    // Khác - 1-3 per month (giảm nếu chỉ đến ngày 8)
    let otherCount;
    if (year === 2025 && month === 11 && maxDay && maxDay === 8) {
      otherCount = Math.floor(Math.random() * 2); // 0-1 cho 8 ngày đầu
    } else {
      otherCount = Math.floor(Math.random() * 3) + 1; // 1-3 cho tháng đầy đủ
    }
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
    
    // Calculate total and scale to EXACTLY match target
    const currentTotal = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const scaleFactor = targetTotal / currentTotal;
    
    // Scale all amounts to match target - ROUND TO NEAREST 1000 for precise numbers
    expenses.forEach((expense, index) => {
      const scaledAmount = parseFloat(expense.amount) * scaleFactor;
      // Round to nearest 1000 for cleaner numbers
      const roundedAmount = Math.round(scaledAmount / 1000) * 1000;
      expense.amount = roundedAmount.toString();
    });
    
    // Final adjustment to match target exactly
    const finalTotal = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const difference = targetTotal - finalTotal;
    
    // Add difference to largest expense to hit target exactly
    if (Math.abs(difference) > 0 && expenses.length > 0) {
      const largestExpenseIndex = expenses.reduce((maxIdx, exp, idx, arr) => 
        parseFloat(exp.amount) > parseFloat(arr[maxIdx].amount) ? idx : maxIdx, 0);
      const newAmount = parseFloat(expenses[largestExpenseIndex].amount) + difference;
      expenses[largestExpenseIndex].amount = Math.max(0, newAmount).toString();
    }
    
    return expenses;
  };

  // ==================== FAMILY EXPENSES ====================
  // Generate expenses for the last 12 months with balanced patterns
  // Ngân sách: 25 triệu/tháng cố định
  // Chi tiêu cao (4 tháng): 20-22 triệu
  // Chi tiêu thấp (8 tháng): 18-20 triệu
  // Tạo dữ liệu từ 1/1/2024 đến 8/11/2025 (hôm nay)
  const startDate = new Date(2024, 0, 1); // 1/1/2024
  const endDate = new Date(2025, 10, 8); // 8/11/2025
  const sampleExpenses = [];
  
  console.log(`\n💰 BUDGET: 25,000,000 VNĐ/month (fixed)`);
  console.log(`📊 High spending months: 20-22M VNĐ (4 months)`);
  console.log(`📉 Normal spending months: 18-20M VNĐ (8 months)`);
  console.log(`\n📅 Generating family expenses from ${startDate.toLocaleDateString('vi-VN')} to ${endDate.toLocaleDateString('vi-VN')}...\n`);
  
  // Tạo danh sách các tháng từ 1/1/2024 đến 8/11/2025
  const monthsToGenerate: Array<{ year: number; month: number; level: 'high' | 'normal'; reason: string; maxDay?: number }> = [];
  
  // 2024: 12 tháng
  for (let month = 1; month <= 12; month++) {
    let level: 'high' | 'normal' = 'normal';
    let reason = 'Tháng thường';
    
    if (month === 1) { level = 'high'; reason = 'Tết Nguyên Đán'; }
    else if (month === 2) { level = 'normal'; reason = 'Sau Tết'; }
    else if (month === 5) { level = 'high'; reason = 'Lễ 30/4-1/5'; }
    else if (month === 8) { level = 'high'; reason = 'Nghỉ hè'; }
    else if (month === 12) { level = 'high'; reason = 'Cuối năm'; }
    
    monthsToGenerate.push({ year: 2024, month, level, reason });
  }
  
  // 2025: 10 tháng đầy đủ (1-10) + tháng 11 chỉ đến ngày 8
  for (let month = 1; month <= 10; month++) {
    let level: 'high' | 'normal' = 'normal';
    let reason = 'Tháng thường';
    
    if (month === 1) { level = 'high'; reason = 'Tết Nguyên Đán'; }
    else if (month === 2) { level = 'normal'; reason = 'Sau Tết'; }
    else if (month === 5) { level = 'high'; reason = 'Lễ 30/4-1/5'; }
    else if (month === 8) { level = 'high'; reason = 'Nghỉ hè'; }
    
    monthsToGenerate.push({ year: 2025, month, level, reason });
  }
  
  // Tháng 11/2025 chỉ đến ngày 8
  monthsToGenerate.push({ year: 2025, month: 11, level: 'normal', reason: 'Tháng thường', maxDay: 8 });
  
  for (const monthInfo of monthsToGenerate) {
    const monthExpenses = generateExpensesForMonth(
      monthInfo.month,
      monthInfo.year,
      monthInfo.level,
      monthInfo.maxDay // Chỉ tạo đến ngày này nếu có
    );
    
    const monthTotal = monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    console.log(`   ✓ ${monthInfo.year}-${String(monthInfo.month).padStart(2, '0')}: ${monthExpenses.length} expenses = ${(monthTotal/1000000).toFixed(2)}M VNĐ (${monthInfo.reason})`);
    
    sampleExpenses.push(...monthExpenses);
  }

  // Clear existing expenses
  await db.delete(expenses);

  // Insert sample expenses - assigned to parents (father/mother)
  for (const expense of sampleExpenses) {
    // Randomly assign to father or mother (parents manage all expenses)
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

  // ==================== CHILD EXPENSES ====================
  // Generate realistic child expenses from 1/1/2024 to 8/11/2025
  // Each child: 6-8 expenses per month
  const child1Expenses = [];
  const child2Expenses = [];
  
  console.log(`\n📊 Generating child expenses from ${startDate.toLocaleDateString('vi-VN')} to ${endDate.toLocaleDateString('vi-VN')}...`);
  
  // Generate for each month from 1/1/2024 to 8/11/2025
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    // Nếu là tháng 11/2025 (month === 10 vì Date.getMonth() là 0-based), chỉ tạo đến ngày 8
    const maxDay = (year === 2025 && month === 10) ? 8 : new Date(year, month + 1, 0).getDate();
    const daysInMonth = maxDay;
    
    // Giảm số lượng expenses cho child nếu chỉ đến ngày 8
    const isShortMonth = (year === 2025 && month === 10 && maxDay === 8);
    
    // CHILD 1 (Boy) - 6-8 expenses per month (giảm nếu chỉ đến ngày 8)
    const child1CountPerMonth = isShortMonth 
      ? Math.floor(Math.random() * 2) + 2  // 2-3 cho 8 ngày đầu
      : Math.floor(Math.random() * 3) + 6; // 6-8 cho tháng đầy đủ
    for (let i = 0; i < child1CountPerMonth; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      const expDate = new Date(year, month, day);
      
      const rand = Math.random();
      let description, amount, category;
      
      if (rand < 0.30) { // 30% - Học tập
        const studyDescs = [
          "Học phí lớp toán cho Đỗ Minh Tuấn",
          "Mua sách giáo khoa cho Tuấn",
          "Học phí lớp tiếng Anh cho Tuấn", 
          "Mua vở bút cho Tuấn đi học",
          "Học phí lớp bóng đá cho Tuấn",
          "Mua đồ dùng học tập cho Tuấn",
          "Đóng tiền bán trú cho Tuấn"
        ];
        description = studyDescs[Math.floor(Math.random() * studyDescs.length)];
        amount = ["100000", "150000", "200000", "300000", "500000", "800000"][Math.floor(Math.random() * 6)];
        category = "Học tập";
      } else if (rand < 0.55) { // 25% - Ăn uống
        const foodDescs = [
          "Tiền ăn trưa tuần này của Tuấn",
          "Mua đồ ăn vặt cho Tuấn",
          "Tiền ăn sáng trường của Tuấn",
          "Mua sữa TH True Milk cho Tuấn"
        ];
        description = foodDescs[Math.floor(Math.random() * foodDescs.length)];
        amount = ["30000", "50000", "80000", "100000", "150000"][Math.floor(Math.random() * 5)];
        category = "Ăn uống";
      } else if (rand < 0.70) { // 15% - Quần áo
        const clothingDescs = [
          "Mua quần áo thể thao cho Tuấn",
          "Mua giày Nike cho Tuấn",
          "Mua đồng phục học sinh cho Tuấn",
          "Mua áo khoác cho Tuấn"
        ];
        description = clothingDescs[Math.floor(Math.random() * clothingDescs.length)];
        amount = ["200000", "300000", "400000", "500000", "800000"][Math.floor(Math.random() * 5)];
        category = "Quần áo";
      } else if (rand < 0.82) { // 12% - Giao thông
        const transportDescs = [
          "Vé xe buýt tháng cho Tuấn đi học",
          "Tiền Grab đưa Tuấn đi học",
          "Tiền xe ôm cho Tuấn"
        ];
        description = transportDescs[Math.floor(Math.random() * transportDescs.length)];
        amount = ["50000", "80000", "100000", "150000"][Math.floor(Math.random() * 4)];
        category = "Giao thông";
      } else if (rand < 0.90) { // 8% - Giải trí
        const entertainDescs = [
          "Đi xem bóng đá với Tuấn",
          "Mua đồ chơi robot cho Tuấn",
          "Xem phim cuối tuần với Tuấn",
          "Chơi game online cùng Tuấn"
        ];
        description = entertainDescs[Math.floor(Math.random() * entertainDescs.length)];
        amount = ["100000", "150000", "200000", "300000"][Math.floor(Math.random() * 4)];
        category = "Giải trí";
      } else if (rand < 0.95) { // 5% - Y tế
        const healthDescs = [
          "Khám răng định kỳ cho Tuấn",
          "Khám mắt cho Tuấn",
          "Mua vitamin cho Tuấn"
        ];
        description = healthDescs[Math.floor(Math.random() * healthDescs.length)];
        amount = ["200000", "300000", "400000"][Math.floor(Math.random() * 3)];
        category = "Y tế";
      } else { // 5% - Khác
        const otherDescs = [
          "Mua quà sinh nhật bạn Tuấn",
          "Tiền tiêu vặt tuần của Tuấn",
          "Mua quà cho Tuấn"
        ];
        description = otherDescs[Math.floor(Math.random() * otherDescs.length)];
        amount = ["50000", "100000", "150000", "200000"][Math.floor(Math.random() * 4)];
        category = "Khác";
      }
      
      child1Expenses.push({
        description,
        amount,
        category,
        createdAt: expDate
      });
    }
    
    // CHILD 2 (Girl) - 6-8 expenses per month (giảm nếu chỉ đến ngày 8)
    const child2CountPerMonth = isShortMonth 
      ? Math.floor(Math.random() * 2) + 2  // 2-3 cho 8 ngày đầu
      : Math.floor(Math.random() * 3) + 6; // 6-8 cho tháng đầy đủ
    for (let i = 0; i < child2CountPerMonth; i++) {
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      const expDate = new Date(year, month, day);
      
      const rand = Math.random();
      let description, amount, category;
      
      if (rand < 0.30) { // 30% - Học tập
        const studyDescs = [
          "Học phí lớp toán cho Đỗ Linh Chi",
          "Mua sách giáo khoa cho Chi",
          "Học phí lớp piano cho Chi",
          "Mua vở bút cho Chi đi học",
          "Học phí lớp vẽ cho Chi",
          "Mua đồ dùng học tập cho Chi",
          "Đóng tiền bán trú cho Chi"
        ];
        description = studyDescs[Math.floor(Math.random() * studyDescs.length)];
        amount = ["100000", "150000", "200000", "300000", "500000", "800000"][Math.floor(Math.random() * 6)];
        category = "Học tập";
      } else if (rand < 0.55) { // 25% - Ăn uống
        const foodDescs = [
          "Tiền ăn trưa tuần này của Chi",
          "Mua đồ ăn vặt cho Chi",
          "Tiền ăn sáng trường của Chi",
          "Mua sữa và bánh cho Chi"
        ];
        description = foodDescs[Math.floor(Math.random() * foodDescs.length)];
        amount = ["30000", "50000", "80000", "100000", "150000"][Math.floor(Math.random() * 5)];
        category = "Ăn uống";
      } else if (rand < 0.70) { // 15% - Quần áo
        const clothingDescs = [
          "Mua váy đẹp cho Chi",
          "Mua giày dép cho Chi",
          "Mua đồng phục học sinh cho Chi",
          "Mua áo khoác cho Chi",
          "Mua đầm dự tiệc cho Chi"
        ];
        description = clothingDescs[Math.floor(Math.random() * clothingDescs.length)];
        amount = ["200000", "300000", "400000", "500000", "800000"][Math.floor(Math.random() * 5)];
        category = "Quần áo";
      } else if (rand < 0.82) { // 12% - Giao thông
        const transportDescs = [
          "Vé xe buýt tháng cho Chi đi học",
          "Tiền Grab đưa Chi đi học",
          "Tiền xe ôm cho Chi"
        ];
        description = transportDescs[Math.floor(Math.random() * transportDescs.length)];
        amount = ["50000", "80000", "100000", "150000"][Math.floor(Math.random() * 4)];
        category = "Giao thông";
      } else if (rand < 0.90) { // 8% - Giải trí
        const entertainDescs = [
          "Đi công viên với Chi",
          "Mua búp bê cho Chi",
          "Xem phim cuối tuần với Chi",
          "Đi vẽ tranh cùng Chi"
        ];
        description = entertainDescs[Math.floor(Math.random() * entertainDescs.length)];
        amount = ["100000", "150000", "200000", "300000"][Math.floor(Math.random() * 4)];
        category = "Giải trí";
      } else if (rand < 0.95) { // 5% - Y tế
        const healthDescs = [
          "Khám răng định kỳ cho Chi",
          "Khám mắt cho Chi",
          "Mua vitamin cho Chi"
        ];
        description = healthDescs[Math.floor(Math.random() * healthDescs.length)];
        amount = ["200000", "300000", "400000"][Math.floor(Math.random() * 3)];
        category = "Y tế";
      } else { // 5% - Khác
        const otherDescs = [
          "Mua quà sinh nhật bạn Chi",
          "Tiền tiêu vặt tuần của Chi",
          "Mua quà cho Chi"
        ];
        description = otherDescs[Math.floor(Math.random() * otherDescs.length)];
        amount = ["50000", "100000", "150000", "200000"][Math.floor(Math.random() * 4)];
        category = "Khác";
      }
      
      child2Expenses.push({
        description,
        amount,
        category,
        createdAt: expDate
      });
    }
    
    // Tăng tháng để tiếp tục loop
    currentDate.setMonth(currentDate.getMonth() + 1);
    if (currentDate > endDate) break;
  }

  console.log(`   - Đỗ Minh Tuấn (Child 1): ${child1Expenses.length} expenses generated`);
  console.log(`   - Đỗ Linh Chi (Child 2): ${child2Expenses.length} expenses generated`);

  // Insert child expenses - all managed by parents (father or mother)
  // childId is set to mark these expenses as belonging to the child
  for (const expense of child1Expenses) {
    const randomParent = Math.random() > 0.5 ? father : mother;
    await db.insert(expenses).values({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      familyId,
      userId: randomParent.id, // Parent creates/manages child expenses
      childId: child1.id, // But expense belongs to child
      createdAt: expense.createdAt,
    });
  }

  for (const expense of child2Expenses) {
    const randomParent = Math.random() > 0.5 ? father : mother;
    await db.insert(expenses).values({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      familyId,
      userId: randomParent.id, // Parent creates/manages child expenses
      childId: child2.id, // But expense belongs to child
      createdAt: expense.createdAt,
    });
  }

  // Verify all users were created
  const allUsers = await db.select().from(users).where(eq(users.familyId, familyId));
  const allExpenses = await db.select().from(expenses).where(eq(expenses.familyId, familyId));
  
  // Calculate totals
  const totalChild1Amount = child1Expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
  const totalChild2Amount = child2Expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
  const totalParentsAmount = sampleExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
  const grandTotal = totalParentsAmount + totalChild1Amount + totalChild2Amount;
  
  console.log("\n✅ === SEED COMPLETE ===");
  console.log(`✅ Created ${allUsers.length} users:`);
  allUsers.forEach(user => {
    console.log(`   - ${user.fullName} (${user.email}) - Role: ${user.role}`);
  });
  console.log(`\n✅ Created ${allExpenses.length} TOTAL expenses across 12 months:`);
  console.log(`   - Parents (Family) expenses: ${sampleExpenses.length} (${(totalParentsAmount/1000000).toFixed(2)}M VNĐ)`);
  console.log(`   - ${child1.fullName} expenses: ${child1Expenses.length} (${(totalChild1Amount/1000000).toFixed(2)}M VNĐ)`);
  console.log(`   - ${child2.fullName} expenses: ${child2Expenses.length} (${(totalChild2Amount/1000000).toFixed(2)}M VNĐ)`);
  console.log(`   - GRAND TOTAL 12 MONTHS: ${(grandTotal/1000000).toFixed(2)}M VNĐ`);
  console.log(`   - AVERAGE PER MONTH: ${(grandTotal/12/1000000).toFixed(2)}M VNĐ`);
  
  // Show monthly breakdown
  const currentMonth = new Date().getMonth();
  const currentMonthExpenses = allExpenses.filter(exp => {
    if (!exp.createdAt) return false;
    const expDate = new Date(exp.createdAt);
    return expDate.getMonth() === currentMonth && expDate.getFullYear() === new Date().getFullYear();
  });
  const currentMonthTotal = currentMonthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || '0'), 0);
  
  console.log(`\n📅 Current month (${new Date().toLocaleString('vi-VN', { month: 'long' })} ${new Date().getFullYear()}) expenses:`);
  console.log(`   - Transactions: ${currentMonthExpenses.length}`);
  console.log(`   - Total: ${(currentMonthTotal/1000000).toFixed(2)}M VNĐ`);
  
  // Verify child accounts exist
  const childAccounts = allUsers.filter(u => u.role === 'child');
  console.log(`\n✅ Child accounts verified: ${childAccounts.length} accounts`);
  childAccounts.forEach(child => {
    const childExp = allExpenses.filter(exp => exp.childId === child.id);
    const childTotal = childExp.reduce((sum, exp) => sum + parseFloat(exp.amount || '0'), 0);
    const avgPerMonth = childTotal / 12;
    console.log(`   - ${child.fullName}: ${childExp.length} expenses, ${(childTotal/1000000).toFixed(2)}M VNĐ total (${(avgPerMonth/1000000).toFixed(2)}M/month)`);
  });
  
  await pool.end();
}

main().catch(console.error);
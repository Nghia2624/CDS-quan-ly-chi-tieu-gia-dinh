import { ExpenseCard } from '../ExpenseCard';

export default function ExpenseCardExample() {
  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <ExpenseCard
        description="Đi đám cưới bạn Minh"
        amount={500000}
        category="Đám cưới"
        date="2024-12-20"
        user="Mẹ"
      />
      <ExpenseCard
        description="Mua sách giáo khoa cho con"
        amount={250000}
        category="Học tập"
        date="2024-12-19"
        user="Bố"
      />
      <ExpenseCard
        description="Ăn tối gia đình"
        amount={180000}
        category="Ăn uống"
        date="2024-12-18"
      />
    </div>
  );
}
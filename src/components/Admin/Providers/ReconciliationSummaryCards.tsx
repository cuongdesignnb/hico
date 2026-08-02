import type { ReconciliationSummary } from '../../../types/reconciliation';

interface ReconciliationSummaryCardsProps {
  summary: ReconciliationSummary;
}

const ReconciliationSummaryCards = ({
  summary,
}: ReconciliationSummaryCardsProps) => {
  const items = [
    ['Tổng biến thể', summary.total],
    ['Đã khớp', summary.matched],
    ['Cần xác nhận', summary.needsReview],
    ['Không tìm thấy', summary.notFound],
    ['Thiếu wmproductId', summary.missingWmproductId],
    ['Xung đột', summary.conflicts],
    ['Offer inactive', summary.inactiveProviderOffer],
    ['Admin xác nhận', summary.confirmedByAdmin],
  ] as const;

  return (
    <div className="reconciliation-summary" aria-label="Tổng quan reconciliation">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value.toLocaleString('vi-VN')}</strong>
        </div>
      ))}
    </div>
  );
};

export default ReconciliationSummaryCards;

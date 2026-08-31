import type { LoyaltyRule } from '../../../types/loyalty';

export const LoyaltyRulesPanel = ({ rules }: { rules: LoyaltyRule[] }) => <section className="account-panel"><p className="account-kicker">Quy tắc</p><h2>Cách tính điểm</h2>{rules.map((rule) => <div className="account-rule-list" key={`${rule.id}-${rule.version}`}><p>{rule.pointsPer}, làm tròn {rule.rounding}.</p><p>eSIM và nạp thêm: {rule.milestones.esim}. SIM vật lý và thiết bị: {rule.milestones.physical_sim}.</p><p>Không hết hạn. Đổi điểm hiện chưa mở.</p></div>)}</section>;

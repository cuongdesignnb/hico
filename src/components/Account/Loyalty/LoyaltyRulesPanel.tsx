import type { LoyaltyRule } from '../../../types/loyalty';

export const LoyaltyRulesPanel = ({ rules }: { rules: LoyaltyRule[] }) => <section className="account-panel"><p className="account-kicker">Quy tac</p><h2>Cach tinh diem</h2>{rules.map((rule) => <div className="account-rule-list" key={`${rule.id}-${rule.version}`}><p>{rule.pointsPer}, lam tron {rule.rounding}.</p><p>eSIM va nap them: {rule.milestones.esim}. SIM vat ly va thiet bi: {rule.milestones.physical_sim}.</p><p>Khong het han. Doi diem hien chua mo.</p></div>)}</section>;

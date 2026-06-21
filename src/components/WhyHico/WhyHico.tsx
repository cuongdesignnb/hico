import React from 'react';
import { ShieldCheck, Zap, HeartHandshake, Globe, DollarSign, Activity } from 'lucide-react';
import './WhyHico.css';

interface Benefit {
  title: string;
  desc: string;
  icon: React.ReactNode;
}

const BENEFITS: Benefit[] = [
  {
    title: 'Phủ sóng toàn cầu',
    desc: '200+ quốc gia và vùng lãnh thổ',
    icon: <Globe size={18} />,
  },
  {
    title: 'Mạng cao cấp',
    desc: 'Kết nối mạng tốt nhất mỗi quốc gia',
    icon: <ShieldCheck size={18} />,
  },
  {
    title: 'Gói cước linh hoạt',
    desc: 'Nhiều lựa chọn dung lượng và thời hạn',
    icon: <Activity size={18} />,
  },
  {
    title: 'Không phí ẩn',
    desc: 'Giá minh bạch, không phí phát sinh',
    icon: <DollarSign size={18} />,
  },
  {
    title: 'Kích hoạt tức thì',
    desc: 'Nhận eSIM ngay trong vài giây',
    icon: <Zap size={18} />,
  },
  {
    title: 'Hỗ trợ 24/7',
    desc: 'Đội ngũ hỗ trợ luôn sẵn sàng',
    icon: <HeartHandshake size={18} />,
  },
];

export const WhyHico: React.FC = () => {
  return (
    <div className="why-hico-block">
      {/* Title */}
      <div className="section-title-wrapper no-margin-bottom">
        <div>
          <h2 className="section-title">Vì sao chọn HICO?</h2>
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="benefits-mini-grid">
        {BENEFITS.map((benefit, index) => (
          <div key={index} className="benefit-mini-card">
            <div className="benefit-mini-icon-box">
              {benefit.icon}
            </div>
            <div className="benefit-mini-info">
              <h3>{benefit.title}</h3>
              <p>{benefit.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

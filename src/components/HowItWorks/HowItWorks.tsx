import React from 'react';
import { ShoppingCart, CreditCard, Mail, Settings, Radio } from 'lucide-react';
import './HowItWorks.css';

interface Step {
  number: number;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Chọn gói',
    desc: 'Chọn điểm đến và gói dữ liệu',
    icon: <ShoppingCart size={18} />,
  },
  {
    number: 2,
    title: 'Thanh toán',
    desc: 'Thanh toán an toàn nhanh chóng',
    icon: <CreditCard size={18} />,
  },
  {
    number: 3,
    title: 'Nhận eSIM',
    desc: 'Nhận QR code qua email ngay',
    icon: <Mail size={18} />,
  },
  {
    number: 4,
    title: 'Cài đặt',
    desc: 'Quét QR code cài đặt eSIM',
    icon: <Settings size={18} />,
  },
  {
    number: 5,
    title: 'Kết nối',
    desc: 'Bật dữ liệu và kết nối ngay',
    icon: <Radio size={18} />,
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <div className="how-it-works-block">
      {/* Title */}
      <div className="section-title-wrapper no-margin-bottom">
        <div>
          <h2 className="section-title">HICO eSIM hoạt động như thế nào?</h2>
        </div>
      </div>

      {/* Steps wrapper */}
      <div className="steps-container">
        {/* Progress Connector Line (desktop only) */}
        <div className="progress-line" />

        <div className="steps-grid">
          {STEPS.map((step) => (
            <div key={step.number} className="step-card">
              {/* Icon Container */}
              <div className="step-icon-box">
                {step.icon}
              </div>

              {/* Number Badge */}
              <div className="step-num-badge">{step.number}</div>

              {/* Step Body */}
              <div className="step-content">
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

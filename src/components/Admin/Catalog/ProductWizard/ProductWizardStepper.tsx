interface ProductWizardStepperProps {
  step: number;
  onStepClick: (step: number) => void;
}

const steps = ['Loại sản phẩm', 'Thông tin chung', 'Gói bán', 'Nguồn cấp', 'Kiểm tra & lưu'];

const ProductWizardStepper = ({ step, onStepClick }: ProductWizardStepperProps) => (
  <nav className="product-wizard-stepper" aria-label="Các bước tạo sản phẩm">
    {steps.map((label, index) => {
      const stepNumber = index + 1;
      const state = stepNumber === step ? 'current' : stepNumber < step ? 'complete' : 'pending';
      return (
        <button
          type="button"
          key={label}
          className={`product-wizard-step product-wizard-step-${state}`}
          aria-current={stepNumber === step ? 'step' : undefined}
          onClick={() => onStepClick(stepNumber)}
        >
          <span>{stepNumber}</span>
          <strong>{label}</strong>
        </button>
      );
    })}
  </nav>
);

export default ProductWizardStepper;

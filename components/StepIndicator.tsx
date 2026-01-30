
import React from 'react';
import { AppStep } from '../types';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const steps = [
  { id: AppStep.UPLOAD, title: 'Upload' },
  { id: AppStep.SIZE_SELECT, title: 'Size' },
  { id: AppStep.REMOVE_BG, title: 'AI Back' },
  { id: AppStep.CROP, title: 'Crop' },
  { id: AppStep.ADJUST, title: 'Fix' },
  { id: AppStep.DOWNLOAD, title: 'Save' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  return (
    <nav aria-label="Progress" className="mb-8 overflow-x-auto pb-4 no-scrollbar">
      <ol role="list" className="flex min-w-max items-center justify-between space-x-4">
        {steps.map((step, idx) => (
          <li key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black transition-all shadow-sm ${
                  currentStep >= step.id
                    ? 'bg-blue-600 text-white shadow-blue-200'
                    : 'bg-white border border-slate-200 text-slate-400'
                }`}
              >
                {step.id}
              </span>
              <span className={`mt-2 text-[10px] font-black uppercase tracking-tighter ${currentStep === step.id ? 'text-blue-600' : 'text-slate-400'}`}>
                {step.title}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className="mx-2 h-0.5 w-4 bg-slate-100 md:w-8 lg:w-12">
                <div 
                  className="h-full bg-blue-600 transition-all duration-500" 
                  style={{ width: currentStep > step.id ? '100%' : '0%' }}
                />
              </div>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

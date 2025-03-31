import React from "react";
import "./ProgressBar.css"; // Add styling

function ProgressBar({ steps, currentStep }) {
  return (
    <div className="progress-bar-container">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`progress-step ${index === currentStep ? "active" : ""} ${
            index < currentStep ? "completed" : ""
          }`}
        >
          <div className="step-number">{index + 1}</div>
          <div className="step-label">{step}</div>
        </div>
      ))}
      <div className="progress-line-container">
        <div
          className="progress-line-fill"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;

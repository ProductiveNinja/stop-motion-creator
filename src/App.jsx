import React, { useState, useCallback } from "react";
import ProgressBar from "./components/ProgressBar";
import UploadStep from "./components/UploadStep";
import RearrangeStep from "./components/RearrangeStep";
import FinalizeStep from "./components/FinalizeStep";
import "./App.css"; // Basic styling

const STEPS = ["Hochladen", "Anordnen", "Finalisieren + Download"];

function App() {
  const [currentStep, setCurrentStep] = useState(0); // 0: Upload, 1: Rearrange, 2: Finalize
  const [images, setImages] = useState([]); // Array of { id: string, file: File, previewUrl: string }
  const [frameRate, setFrameRate] = useState(10); // Default frame rate

  // --- Navigation ---
  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // --- Image Handling (passed down) ---
  // useCallback ensures these functions have stable identities if passed as props
  const handleImagesUpload = useCallback(
    (newImages) => {
      // Add unique IDs and previews to new images
      const processedImages = newImages.map((file, index) => {
        return {
          id: `image-${Date.now()}-${index}`, // Simple unique ID
          file,
          previewUrl: URL.createObjectURL(file), // Create temporary URL for preview
        };
      });
      setImages((prev) => [...prev, ...processedImages]);
      nextStep(); // Automatically move to next step after upload
    },
    [nextStep]
  ); // Dependency array includes nextStep

  const handleImageDelete = useCallback((idToDelete) => {
    setImages((prev) => {
      const imageToDelete = prev.find((img) => img.id === idToDelete);
      if (imageToDelete) {
        URL.revokeObjectURL(imageToDelete.previewUrl); // Clean up blob URL memory
      }
      return prev.filter((img) => img.id !== idToDelete);
    });
  }, []); // No dependencies needed here

  const handleImageReorder = useCallback((reorderedImages) => {
    setImages(reorderedImages);
  }, []);

  // --- Frame Rate Handling (passed down) ---
  // This now receives only validated positive numbers from FinalizeStep
  const handleFrameRateChange = useCallback((newValidRate) => {
    console.log("App.js updating frameRate to:", newValidRate); // For debugging
    // Basic sanity check (optional as FinalizeStep should pre-validate)
    if (typeof newValidRate === "number" && newValidRate > 0) {
      setFrameRate(newValidRate);
    }
  }, []); // No dependencies needed

  // --- Cleanup Blob URLs on Unmount ---
  React.useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [images]); // Rerun if images array changes (though cleanup is on unmount)

  return (
    <div className="App">
      <h1>Stop Motion Creator</h1>
      <ProgressBar steps={STEPS} currentStep={currentStep} />

      <div className="step-content">
        {currentStep === 0 && (
          <UploadStep onImagesUpload={handleImagesUpload} />
        )}
        {currentStep === 1 && (
          <RearrangeStep
            images={images}
            onImageDelete={handleImageDelete}
            onImageReorder={handleImageReorder}
          />
        )}
        {currentStep === 2 && (
          <FinalizeStep
            images={images}
            frameRate={frameRate}
            onFrameRateChange={handleFrameRateChange}
          />
        )}
      </div>

      <div className="navigation-buttons">
        {currentStep > 0 && (
          <button onClick={prevStep}>Vorheriger Schritt</button>
        )}
        {/* Only show Next button if not on the last step AND
            conditions are met (e.g., images uploaded for step 0) */}
        {currentStep < STEPS.length - 1 &&
          currentStep === 1 &&
          images.length > 0 && (
            <button onClick={nextStep}>Nächster Schritt</button>
          )}
        {/* Note: Navigation from Upload happens automatically in handleImagesUpload */}
      </div>
    </div>
  );
}

export default App;

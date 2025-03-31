import React, { useState, useCallback } from "react";
import "./UploadStep.css"; // Add styling

function UploadStep({ onImagesUpload }) {
  const [error, setError] = useState("");

  const handleFileChange = useCallback(
    (event) => {
      setError("");
      const files = Array.from(event.target.files);
      const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
      const validFiles = [];

      for (const file of files) {
        if (allowedTypes.includes(file.type)) {
          validFiles.push(file);
        } else {
          setError(
            `Invalid file type: ${file.name}. Only JPG, JPEG, PNG allowed.`
          );
          // Clear the input value so the user can select the same file again if needed after correction
          event.target.value = null;
          return; // Stop processing on first error
        }
      }

      if (validFiles.length > 0) {
        onImagesUpload(validFiles);
      }
      // Clear the input value so the user can select more files later if they come back
      event.target.value = null;
    },
    [onImagesUpload]
  );

  return (
    <div className="upload-step">
      <h2>1. Schritt: Bilder Hochladen</h2>
      <p>Wähle deine Bilder für die Stop Motion Sequenz (JPG, JPEG oder PNG). <strong>Tipp:</strong> Nummeriere deine Bilder vor dem Hochladen, sodass du sie einfacher anordnen kannst.</p>
      <input
        type="file"
        multiple
        accept=".jpg,.jpeg,.png"
        onChange={handleFileChange}
        aria-label="Image uploader"
        className="file-input"
      />
      {error && <p className="error-message">{error}</p>}
      <p className="info">
        Deine Bilder werden direkt im Browser verarbeitet.
      </p>
    </div>
  );
}

export default UploadStep;

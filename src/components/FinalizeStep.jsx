import React, { useState, useEffect, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import "./FinalizeStep.css";

const CORE_VERSION = "0.12.6";
const corePath = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/ffmpeg-core.js`;

function FinalizeStep({ images, frameRate, onFrameRateChange }) {
  // Receive central frameRate and the updater
  const messageRef = useRef(null);
  const ffmpegRef = useRef(new FFmpeg());

  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewIntervalRef = useRef(null);

  // --- Local state for the input field's displayed value ---
  const [displayFrameRate, setDisplayFrameRate] = useState(
    frameRate.toString()
  );
  // --- State to track if the *displayed* value is valid ---
  const [isFrameRateInputValid, setIsFrameRateInputValid] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState("");
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false);

  const updateLog = useCallback((newMessage) => {
    console.log("FFmpeg Status:", newMessage);
    if (messageRef.current) {
      messageRef.current.textContent = newMessage;
    }
  }, []);

  // --- Sync local display state if the prop changes from App.js ---
  useEffect(() => {
    const propFrameRateStr = frameRate.toString();
    if (displayFrameRate !== propFrameRateStr) {
      setDisplayFrameRate(propFrameRateStr);
      // Also reset validity based on the prop value
      const num = parseInt(propFrameRateStr, 10);
      setIsFrameRateInputValid(!isNaN(num) && num > 0);
    }
  }, [frameRate]); // Run only when the frameRate prop changes

  // --- FFmpeg Loading Effect ---
  useEffect(() => {
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on("log", ({ message }) => updateLog(message));
    ffmpeg.on("progress", ({ ratio }) => {
      const newProgress = Math.max(0, Math.min(1, ratio || 0));
      if (!isNaN(newProgress)) setProgress(newProgress);
    });

    const loadFFmpeg = async () => {
      if (isFFmpegLoaded) {
        updateLog("FFmpeg load check: Already loaded.");
        return;
      }
      try {
        updateLog(`Loading ffmpeg core v${CORE_VERSION}...`);
        await ffmpeg.load({ corePath });
        setIsFFmpegLoaded(true);
        updateLog("FFmpeg ready.");
      } catch (err) {
        console.error("FFmpeg load error:", err);
        setError(
          `Failed to load FFmpeg: ${err.message || err}. Check network/console.`
        );
        setIsFFmpegLoaded(false);
        updateLog(`Error loading FFmpeg: ${err.message || err}`);
      }
    };

    if (!isFFmpegLoaded) {
      loadFFmpeg();
    }
  }, [isFFmpegLoaded, updateLog]);

  // --- Preview Logic ---
  useEffect(() => {
    let intervalId = null;
    if (isPlayingPreview && images.length > 0 && isFrameRateInputValid) {
      // Only play if FPS is valid
      // Use the validated frameRate from App.js state for playback speed
      intervalId = setInterval(() => {
        setPreviewIndex((prevIndex) => (prevIndex + 1) % images.length);
      }, 1000 / frameRate);
    }
    // Cleanup function
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
    // Re-run if play state, images, or the *validated* frameRate changes
  }, [isPlayingPreview, images, frameRate, isFrameRateInputValid]);

  const togglePreview = () => {
    setIsPlayingPreview(!isPlayingPreview);
    if (isPlayingPreview) {
      setPreviewIndex(0);
    }
  };

  // --- Handle Input Change Locally ---
  const handleFrameRateInputChange = (event) => {
    const newValue = event.target.value;
    setDisplayFrameRate(newValue); // Update display immediately

    // Validate the input
    const num = parseInt(newValue, 10);
    const isValid = !isNaN(num) && num > 0 && String(num) === newValue.trim(); // Allow only positive integers

    setIsFrameRateInputValid(isValid); // Update validity state

    // If valid, propagate the numeric value up to App.js
    if (isValid) {
      onFrameRateChange(num); // Send the number
    }
    // If invalid, App.js's frameRate state remains unchanged (last valid value)
  };

  // --- Video Generation ---
  const generateVideo = useCallback(async () => {
    // This function should still use the validated `frameRate` prop from App.js
    const ffmpeg = ffmpegRef.current;
    if (!isFFmpegLoaded || !isFrameRateInputValid) {
      /* ... */ return;
    }
    if (images.length === 0) {
      /* ... */ return;
    }

    setIsGenerating(true);
    setProgress(0);
    setVideoUrl(null);
    setError("");
    updateLog("Starting video generation...");
    setProgress(0); // Ensure progress starts at 0

    try {
      const outputFilename = `output-${Date.now()}.mp4`;
      updateLog("Writing image files...");
      const writePromises = images.map(async (image, i) => {
        /* ... file writing ... */
        const filename = `img${i.toString().padStart(5, "0")}.png`;
        const data = await fetchFile(image.file);
        await ffmpeg.writeFile(filename, data);
        return filename;
      });
      const writtenFiles = await Promise.all(writePromises);
      updateLog(`Wrote ${writtenFiles.length} files.`);

      updateLog(`Running FFmpeg (FPS: ${frameRate})...`); // Use validated frameRate
      await ffmpeg.exec([
        "-framerate",
        `${frameRate}`, // Use validated frameRate
        "-i",
        "img%05d.png",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "28",
        outputFilename,
      ]);
      updateLog("FFmpeg command finished.");
      setProgress(1);

      updateLog(`Reading output: ${outputFilename}`);
      const data = await ffmpeg.readFile(outputFilename);
      updateLog(
        `Read ${outputFilename} (${(data.length / 1024 / 1024).toFixed(2)} MB).`
      );

      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const newUrl = URL.createObjectURL(
        new Blob([data.buffer], { type: "video/mp4" })
      );
      setVideoUrl(newUrl);
      updateLog("Video URL created.");

      updateLog("Cleaning up virtual files...");
      const deletePromises = writtenFiles.map((filename) =>
        ffmpeg.deleteFile(filename)
      );
      await Promise.all(deletePromises);
      await ffmpeg.deleteFile(outputFilename);
      updateLog("Cleanup complete.");
    } catch (err) {
      console.error("Video generation error:", err);
      setError(
        `Video generation failed: ${err.message || err}. Check console.`
      );
      updateLog(`Error: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
      updateLog(error ? "Generation failed." : "Generation complete.");
    }
  }, [
    images,
    frameRate, // Use the validated frameRate from App.js for generation logic
    isFFmpegLoaded,
    isFrameRateInputValid, // Need validity check here too
    videoUrl,
    updateLog,
  ]);

  // --- Cleanup Video Blob URL ---
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // --- Determine if Generate button should be disabled ---
  const isGenerateDisabled =
    isGenerating ||
    !isFFmpegLoaded ||
    images.length === 0 ||
    !isFrameRateInputValid; // Use the local validity state

  return (
    <div className="finalize-step">
      <h2>3. Schritt: Finalisieren + Download</h2>
      <div className="status-area">
        <p>
          <strong>Status:</strong> <span ref={messageRef}> Bereit</span>
        </p>
      </div>
      {!isFFmpegLoaded && !error && (
        <p className="loading-message">Video Bibliothek wird geladen...</p>
      )}
      {error && <p className="error-message">{error}</p>}

      {images.length > 0 && isFFmpegLoaded ? (
        <>
          {/* Preview Section */}
          <div className="preview-section">
            <h3>Preview</h3>
            <div className="preview-container">
              {" "}
              {
                /* ... preview image ... */
                <img
                  src={images[previewIndex]?.previewUrl}
                  alt={`Preview Frame ${previewIndex + 1}`}
                  className="preview-image"
                />
              }
            </div>
            {/* Disable preview toggle if FPS input is invalid */}
            <button
              onClick={togglePreview}
              disabled={isGenerating || !isFrameRateInputValid}
            >
              {isPlayingPreview ? "Stop Preview" : "Play Preview"}
            </button>
            {!isFrameRateInputValid && (
              <p className="warning">
                Vorschau ausgeschalten, da die FPS-Eingabe ungültig ist.
              </p>
            )}
          </div>

          {/* Settings Section */}
          <div className="settings-section">
            <h3>Settings</h3>
            <label htmlFor="frameRate">Bilder pro Sekunde (fps):</label>
            <input
              type="text" // Use text to allow empty string temporarily
              inputMode="numeric" // Hint for mobile keyboards
              pattern="[0-9]*" // Basic pattern hint
              id="frameRate"
              value={displayFrameRate} // Bind to local display state
              onChange={handleFrameRateInputChange} // Use local handler
              disabled={isGenerating}
              className={`framerate-input ${
                !isFrameRateInputValid ? "input-invalid" : ""
              }`} // Add class for styling invalid state
              placeholder="e.g., 10"
            />
            {/* Show validation message */}
            {!isFrameRateInputValid && displayFrameRate !== "" && (
              <p className="error-message">
                Bitte gib eine positive gültige Zahl ein.
              </p>
            )}
          </div>

          {/* Generation & Download Section */}
          <div className="generate-section">
            {/* Disable button based on local input validity */}
            <button
              onClick={generateVideo}
              disabled={isGenerateDisabled}
              className="button-primary"
            >
              {isGenerating ? "Wird generiert..." : "Generiere MP4 Video"}
            </button>

            {isGenerating && (
              <div className="progress-indicator">
                {" "}
                {/* ... progress bar ... */}
                <p>Prozessiere: {Math.round(progress * 100)}%</p>
                <div className="progress-bar-wrapper">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progress * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {videoUrl && !isGenerating && (
              <div className="download-section">
                {" "}
                {/* ... video player and download link ... */}
                <h3>Video bereit!</h3>
                <video controls src={videoUrl} width="320"></video>
                <a
                  href={videoUrl}
                  download={`stop-motion-${Date.now()}.mp4`}
                  className="download-button button-primary"
                >
                  Download MP4
                </a>
              </div>
            )}
          </div>
        </>
      ) : (
        !error &&
        images.length === 0 && (
          <p>Keine Bilder verfügbar. Geh zurück zum Schritt "Hochladen".</p>
        )
      )}
    </div>
  );
}

export default FinalizeStep;

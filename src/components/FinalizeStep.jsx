import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import './FinalizeStep.css';

const CORE_VERSION = '0.12.6';
const corePath = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/ffmpeg-core.js`;

function FinalizeStep({ images, frameRate, onFrameRateChange }) {
  // Receive central frameRate and the updater
  const messageRef = useRef(null);
  const ffmpegRef = useRef(new FFmpeg());

  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  // eslint-disable-next-line no-unused-vars
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
  const [error, setError] = useState('');
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false);

  const updateLog = useCallback((newMessage) => {
    console.log('FFmpeg Status:', newMessage);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameRate]); // Run only when the frameRate prop changes

  // --- FFmpeg Loading Effect ---
  useEffect(() => {
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on('log', ({ message }) => updateLog(message));
    ffmpeg.on('progress', ({ ratio }) => {
      const newProgress = Math.max(0, Math.min(1, ratio || 0));
      if (!isNaN(newProgress)) setProgress(newProgress);
    });

    const loadFFmpeg = async () => {
      if (isFFmpegLoaded) {
        updateLog('FFmpeg load check: Already loaded.');
        return;
      }
      try {
        updateLog(`Loading ffmpeg core v${CORE_VERSION}...`);
        await ffmpeg.load({ corePath });
        setIsFFmpegLoaded(true);
        updateLog('FFmpeg ready.');
      } catch (err) {
        console.error('FFmpeg load error:', err);
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

  const convertToPngUint8Array = (inputFile, targetWidth, targetHeight) => {
    return new Promise((resolve, reject) => {
      // Ensure target dimensions are even numbers
      const evenWidth = Math.floor(targetWidth / 2) * 2;
      const evenHeight = Math.floor(targetHeight / 2) * 2;

      if (evenWidth <= 0 || evenHeight <= 0) {
        reject(
          new Error(
            `Invalid target dimensions after making even: ${evenWidth}x${evenHeight}`
          )
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Set canvas size to the target EVEN dimensions
          canvas.width = evenWidth;
          canvas.height = evenHeight;
          const ctx = canvas.getContext('2d');

          // Draw the image, potentially scaling it to fit the canvas
          // Maintain aspect ratio while fitting within the target dimensions
          const hRatio = canvas.width / img.naturalWidth;
          const vRatio = canvas.height / img.naturalHeight;
          const ratio = Math.min(hRatio, vRatio); // Use min to fit inside
          const centerShift_x = (canvas.width - img.naturalWidth * ratio) / 2;
          const centerShift_y = (canvas.height - img.naturalHeight * ratio) / 2;

          // Optional: Fill background if aspect ratios differ significantly
          // ctx.fillStyle = "black"; // Or white, etc.
          // ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.drawImage(
            img,
            0,
            0,
            img.naturalWidth,
            img.naturalHeight, // Source rectangle (full image)
            centerShift_x,
            centerShift_y,
            img.naturalWidth * ratio,
            img.naturalHeight * ratio // Destination rectangle (scaled and centered)
          );

          // Get PNG data as Blob
          canvas.toBlob(async (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed to create PNG.'));
              return;
            }
            // Convert Blob to ArrayBuffer, then Uint8Array
            const arrayBuffer = await blob.arrayBuffer();
            resolve(new Uint8Array(arrayBuffer));
          }, 'image/png'); // Specify PNG format
        };
        img.onerror = (err) => {
          reject(
            new Error(
              'Failed to load image for conversion: ' + (err.message || err)
            )
          );
        };
        img.src = event.target.result; // Data URL
      };
      reader.onerror = (err) => {
        reject(
          new Error(
            'Failed to read file for conversion: ' + (err.message || err)
          )
        );
      };
      reader.readAsDataURL(inputFile); // Read as Data URL
    });
  };

  // --- Video Generation ---
  const generateVideo = useCallback(async () => {
    const ffmpeg = ffmpegRef.current;
    if (!isFFmpegLoaded || !isFrameRateInputValid) {
      return;
    }
    if (images.length === 0) {
      return;
    }

    if (images.length === 0) {
      updateLog('No images selected.');
      setError('Please add images first.');
      return;
    }

    setIsGenerating(true);
    // ... (reset state) ...
    updateLog('Starting video generation...');

    let firstImageDimensions = { width: 0, height: 0 };

    try {
      // --- Determine Target Dimensions from First Image ---
      updateLog('Reading dimensions of the first image...');
      try {
        const firstImageFile = images[0].file;
        const tempImg = new Image();
        const tempUrl = URL.createObjectURL(firstImageFile);
        await new Promise((resolve, reject) => {
          tempImg.onload = () => {
            firstImageDimensions.width = tempImg.naturalWidth;
            firstImageDimensions.height = tempImg.naturalHeight;
            URL.revokeObjectURL(tempUrl);
            if (
              firstImageDimensions.width > 0 &&
              firstImageDimensions.height > 0
            ) {
              updateLog(
                `Using target dimensions from first image: ${firstImageDimensions.width}x${firstImageDimensions.height}`
              );
              resolve();
            } else {
              reject(new Error('First image has invalid dimensions (0x0).'));
            }
          };
          tempImg.onerror = (err) => {
            URL.revokeObjectURL(tempUrl);
            reject(new Error('Failed to load first image to get dimensions.'));
          };
          tempImg.src = tempUrl;
        });
      } catch (dimError) {
        updateLog(`Error getting dimensions: ${dimError.message}`);
        setError(
          `Could not determine dimensions from the first image: ${dimError.message}`
        );
        setIsGenerating(false);
        return; // Stop generation
      }
      // --- End Determine Target Dimensions ---

      const outputFilename = `output-${Date.now()}.mp4`;
      updateLog('Converting images to PNG, resizing, and writing files...');

      const writePromises = images.map(async (image, i) => {
        const filename = `img${i.toString().padStart(5, '0')}.png`;
        try {
          updateLog(
            `Processing image ${i + 1}/${images.length} (${image.file.name})...`
          );
          // Pass target dimensions to the conversion function
          const pngData = await convertToPngUint8Array(
            image.file,
            firstImageDimensions.width,
            firstImageDimensions.height
          );
          updateLog(
            `Writing ${filename} (${(pngData.length / 1024).toFixed(1)} KB)...`
          );
          await ffmpeg.writeFile(filename, pngData);
          return filename;
        } catch (conversionError) {
          updateLog(
            `Error processing image ${i + 1}: ${conversionError.message}`
          );
          console.error(`Error processing image ${i + 1}`, conversionError);
          // Decide if you want to stop on the first error or try to continue
          throw new Error(
            `Failed to process image ${i + 1}: ${conversionError.message}`
          );
        }
      });

      const writtenFiles = await Promise.all(writePromises);
      updateLog(`Wrote ${writtenFiles.length} resized PNG files.`);

      // Log the final frameRate being used
      updateLog(`Using Frame Rate: ${frameRate}`);

      updateLog(`Running FFmpeg...`); // Command logged below if needed
      // Consider explicitly setting output frame rate too with -r
      await ffmpeg.exec([
        '-framerate',
        `${frameRate}`, // Input frame rate
        '-i',
        'img%05d.png', // Input sequence (now consistent size/format)
        // Optional: Explicit output frame rate '-r', `${frameRate}`,
        '-c:v',
        'libx264', // Encoder
        '-preset',
        'ultrafast', // Speed preset
        '-pix_fmt',
        'yuv420p', // Pixel format (requires even dimensions)
        '-crf',
        '28', // Quality
        // Optional: Add scale filter if dimensions might still be odd somehow, but resizing should handle it
        // '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Example: Force even dimensions *within* ffmpeg
        outputFilename, // Output file
      ]);
      updateLog('FFmpeg command finished.');
      setProgress(1);

      updateLog('FFmpeg command finished.');
      setProgress(1);

      // ... (rest of the code: readFile, blob creation, cleanup) ...
      // The cleanup should also work fine as writtenFiles now contains .png filenames

      updateLog(`Reading output: ${outputFilename}`);
      const data = await ffmpeg.readFile(outputFilename); // Read the generated MP4
      updateLog(
        `Read ${outputFilename} (${(data.length / 1024 / 1024).toFixed(2)} MB).`
      );

      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const newUrl = URL.createObjectURL(blob);
      setVideoUrl(newUrl);
      updateLog('Video URL created.');

      updateLog('Cleaning up virtual files...');
      const deletePromises = writtenFiles.map((filename) =>
        ffmpeg.deleteFile(filename)
      );
      await Promise.all(deletePromises);
      await ffmpeg.deleteFile(outputFilename); // Delete the output MP4
      updateLog('Cleanup complete.');
    } catch (err) {
      console.error('Video generation error:', err);
      // Check if it's an FFmpeg specific error object
      let errorMessage = 'Unknown error';
      if (err instanceof Error) {
        errorMessage = err.message;
        // Potentially look for specific FFmpeg error patterns if needed
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else {
        try {
          errorMessage = JSON.stringify(err);
        } catch {
          /* ignore */
        }
      }

      setError(
        `Video generation failed: ${errorMessage}. Check console for details.`
      );
      updateLog(`Error: ${errorMessage}`);
      // If the error includes FFmpeg logs, they might be in err.message or visible in console
      console.error('FFMPEG related error object:', err); // Log the full error object
    } finally {
      setIsGenerating(false);
      // Check the state variable 'error' which should have been set by setError
      updateLog(error ? 'Generation failed.' : 'Generation complete.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    images,
    frameRate,
    isFFmpegLoaded,
    isFrameRateInputValid,
    videoUrl,
    updateLog,
    error,
    setError,
    setIsGenerating,
    setVideoUrl,
    setProgress,
  ]);

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
            <h3>Vorschau</h3>
            <div className="preview-container">
              {' '}
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
              {isPlayingPreview ? 'Vorschau stoppen' : 'Vorschau starten'}
            </button>
            {!isFrameRateInputValid && (
              <p className="warning">
                Vorschau ausgeschalten, da die FPS-Eingabe ungültig ist.
              </p>
            )}
          </div>

          {/* Settings Section */}
          <div className="settings-section">
            <h3>Einstellungen</h3>
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
                !isFrameRateInputValid ? 'input-invalid' : ''
              }`} // Add class for styling invalid state
              placeholder="e.g., 10"
            />
            {/* Show validation message */}
            {!isFrameRateInputValid && displayFrameRate !== '' && (
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
              {isGenerating ? 'Wird generiert...' : 'Generiere MP4 Video'}
            </button>

            {isGenerating && (
              <div className="progress-indicator">
                {' '}
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
                {' '}
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

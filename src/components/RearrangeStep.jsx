import React from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import "./RearrangeStep.css"; // Ensure CSS is imported

function RearrangeStep({ images, onImageDelete, onImageReorder }) {
  const handleOnDragEnd = (result) => {
    // console.log('Drag Ended:', result); // Add for debugging if needed
    if (
      !result.destination ||
      result.destination.index === result.source.index
    ) {
      // Dropped outside list or in the same place
      return;
    }

    const items = Array.from(images);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onImageReorder(items);
  };

  return (
    <div className="rearrange-step">
      <h2>2. Schritt: Bilder anordnen</h2>
      <p>Ziehe die Bilder in die richtige Reihenfolge</p>
      {images.length === 0 ? (
        <p>
          Noch keine Bilder hochgeladen, gehe zurück zum Schritt "Hochladen"
        </p>
      ) : (
        <DragDropContext onDragEnd={handleOnDragEnd}>
          <Droppable
            droppableId="images"
            direction="horizontal"
            isDropDisabled={false}
            isCombineEnabled={false}
            ignoreContainerClipping={false}
          >
            {(
              provided,
              snapshot // Add snapshot for potential styling when dragging over
            ) => (
              <div
                className={`image-list ${
                  snapshot.isDraggingOver ? "dragging-over" : ""
                }`}
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {images.map((image, index) => (
                  <Draggable
                    key={image.id}
                    draggableId={image.id}
                    index={index}
                  >
                    {(
                      provided,
                      snapshot // Add snapshot for styling when dragging item
                    ) => (
                      <div
                        className={`image-item ${
                          snapshot.isDragging ? "dragging" : ""
                        }`}
                        ref={provided.innerRef} // *** Correct ref for Draggable ***
                        {...provided.draggableProps} // *** Props for the draggable element ***
                        {...provided.dragHandleProps} // *** Props for the drag handle (the whole item here) ***
                        style={{
                          // Optional: inline styles needed by dnd
                          ...provided.draggableProps.style,
                          // Add any custom dragging styles here if needed
                        }}
                      >
                        <img
                          src={image.previewUrl}
                          alt={`Frame ${index + 1}`}
                        />
                        <button
                          className="delete-button"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent drag potentially starting on button click
                            onImageDelete(image.id);
                          }}
                          aria-label={`Delete frame ${index + 1}`}
                        >
                          ×
                        </button>
                        <span className="image-index">{image.file.name}</span>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder} {/* Placeholder is important! */}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}

export default RearrangeStep;

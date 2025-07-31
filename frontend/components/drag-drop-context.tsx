"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type DragDropContextType = {
  isDragging: boolean;
  activeDropZone: string | null;
  setActiveDropZone: (zone: string | null) => void;
  handleDragEnter: (e: React.DragEvent, zone: string) => void;
  handleDragLeave: (e: React.DragEvent, zone: string) => void;
  handleDragOver: (e: React.DragEvent, zone: string) => void;
  handleDrop: (
    e: React.DragEvent,
    zone: string,
    onDrop: (file: File) => void
  ) => void;
};

const DragDropContext = createContext<DragDropContextType | null>(null);

export function useDragDrop() {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error("useDragDrop must be used within a DragDropProvider");
  }
  return context;
}

export function DragDropProvider({ children }: { children: React.ReactNode }) {
  const [isDragging, setIsDragging] = useState(false);
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null);

  const handleDragEnter = useCallback((e: React.DragEvent, zone: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setActiveDropZone(zone);
  }, []);

  const handleDragLeave = useCallback(
    (e: React.DragEvent, zone: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeDropZone === zone) {
        setIsDragging(false);
        setActiveDropZone(null);
      }
    },
    [activeDropZone]
  );

  const handleDragOver = useCallback((e: React.DragEvent, zone: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setActiveDropZone(zone);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, zone: string, onDrop: (file: File) => void) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setActiveDropZone(null);

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles && droppedFiles.length > 0) {
        onDrop(droppedFiles[0]);
      }
    },
    []
  );

  return (
    <DragDropContext.Provider
      value={{
        isDragging,
        activeDropZone,
        setActiveDropZone,
        handleDragEnter,
        handleDragLeave,
        handleDragOver,
        handleDrop,
      }}
    >
      {children}
    </DragDropContext.Provider>
  );
}

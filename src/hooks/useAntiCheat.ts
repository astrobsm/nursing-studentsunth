"use client";

import { useEffect, useCallback, useRef } from "react";
import { incrementTabSwitch, getQuizState, submitQuiz, logCheatingEvent } from "@/lib/quiz-store";
import { QUIZ_CONFIG } from "@/lib/constants";

interface AntiCheatCallbacks {
  onTabSwitch: (count: number) => void;
  onAutoSubmit: () => void;
}

export function useAntiCheat({ onTabSwitch, onAutoSubmit }: AntiCheatCallbacks) {
  const callbacksRef = useRef({ onTabSwitch, onAutoSubmit });
  callbacksRef.current = { onTabSwitch, onAutoSubmit };

  // Prevent right-click
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logCheatingEvent({
        type: "right_click",
        timestamp: new Date().toISOString(),
        details: "Attempted to open right-click context menu",
      });
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  // Prevent copy/paste/cut
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logCheatingEvent({
        type: "copy_attempt",
        timestamp: new Date().toISOString(),
        details: `Attempted to ${e.type} content`,
      });
    };
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logCheatingEvent({
        type: "paste_attempt",
        timestamp: new Date().toISOString(),
        details: "Attempted to paste content into the quiz",
      });
    };
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCopy);
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCopy);
      document.removeEventListener("paste", handlePaste);
    };
  }, []);

  // Prevent PrintScreen and common shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
        logCheatingEvent({
          type: "print_screen",
          timestamp: new Date().toISOString(),
          details: "Attempted to take a screenshot (PrintScreen key)",
        });
      }
      // Block Ctrl+P (print), Ctrl+S (save), Ctrl+U (source), F12 (devtools)
      if (
        (e.ctrlKey && ["p", "s", "u"].includes(e.key.toLowerCase())) ||
        e.key === "F12"
      ) {
        e.preventDefault();
        logCheatingEvent({
          type: "devtools_attempt",
          timestamp: new Date().toISOString(),
          details: `Attempted blocked shortcut: ${e.ctrlKey ? "Ctrl+" : ""}${e.shiftKey ? "Shift+" : ""}${e.key}`,
        });
      }
      // Block Ctrl+Shift+I (devtools)
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        logCheatingEvent({
          type: "devtools_attempt",
          timestamp: new Date().toISOString(),
          details: "Attempted to open Developer Tools (Ctrl+Shift+I)",
        });
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Tab switch / blur detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logCheatingEvent({
          type: "tab_switch",
          timestamp: new Date().toISOString(),
          details: "Switched away from the quiz tab (visibility change)",
        });
        const count = incrementTabSwitch();
        callbacksRef.current.onTabSwitch(count);
        if (count >= QUIZ_CONFIG.MAX_TAB_SWITCHES) {
          logCheatingEvent({
            type: "auto_submit_cheat",
            timestamp: new Date().toISOString(),
            details: `Quiz auto-submitted: exceeded maximum tab switches (${QUIZ_CONFIG.MAX_TAB_SWITCHES})`,
          });
          submitQuiz();
          callbacksRef.current.onAutoSubmit();
        }
      }
    };

    const handleBlur = () => {
      const state = getQuizState();
      if (!state.isSubmitted) {
        logCheatingEvent({
          type: "window_blur",
          timestamp: new Date().toISOString(),
          details: "Quiz window lost focus (window blur detected)",
        });
        const count = incrementTabSwitch();
        callbacksRef.current.onTabSwitch(count);
        if (count >= QUIZ_CONFIG.MAX_TAB_SWITCHES) {
          logCheatingEvent({
            type: "auto_submit_cheat",
            timestamp: new Date().toISOString(),
            details: `Quiz auto-submitted: exceeded maximum tab switches (${QUIZ_CONFIG.MAX_TAB_SWITCHES})`,
          });
          submitQuiz();
          callbacksRef.current.onAutoSubmit();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Return tab switch count
  const getTabSwitchCount = useCallback(() => {
    return getQuizState().tabSwitchCount;
  }, []);

  return { getTabSwitchCount };
}

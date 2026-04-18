import { useCallback, useMemo, useRef, useState } from 'react';

const MAX_HISTORY_SIZE = 40;

export function useFloorPlanHistory({ loadSceneData, addToast }) {
  const historyRef = useRef({ undo: [], redo: [], applying: false });
  const [historyVersion, setHistoryVersion] = useState(0);

  const pushHistoryAction = useCallback((action) => {
    if (!action || historyRef.current.applying) return;
    historyRef.current.undo.push(action);
    if (historyRef.current.undo.length > MAX_HISTORY_SIZE) {
      historyRef.current.undo.shift();
    }
    historyRef.current.redo = [];
    setHistoryVersion((v) => v + 1);
  }, []);

  const undoLastAction = useCallback(async () => {
    if (historyRef.current.applying || historyRef.current.undo.length === 0) return;
    const action = historyRef.current.undo.pop();
    if (!action?.undo) return;
    try {
      historyRef.current.applying = true;
      await action.undo();
      historyRef.current.redo.push(action);
      if (historyRef.current.redo.length > MAX_HISTORY_SIZE) {
        historyRef.current.redo.shift();
      }
      setHistoryVersion((v) => v + 1);
      await loadSceneData();
      addToast('Действие отменено', 'info');
    } catch (e) {
      addToast(action.undoError || 'Не удалось отменить действие', 'error');
    } finally {
      historyRef.current.applying = false;
    }
  }, [addToast, loadSceneData]);

  const redoLastAction = useCallback(async () => {
    if (historyRef.current.applying || historyRef.current.redo.length === 0) return;
    const action = historyRef.current.redo.pop();
    if (!action?.redo) return;
    try {
      historyRef.current.applying = true;
      await action.redo();
      historyRef.current.undo.push(action);
      if (historyRef.current.undo.length > MAX_HISTORY_SIZE) {
        historyRef.current.undo.shift();
      }
      setHistoryVersion((v) => v + 1);
      await loadSceneData();
      addToast('Действие повторено', 'info');
    } catch (e) {
      addToast(action.redoError || 'Не удалось повторить действие', 'error');
    } finally {
      historyRef.current.applying = false;
    }
  }, [addToast, loadSceneData]);

  const canUndo = useMemo(() => historyRef.current.undo.length > 0, [historyVersion]);
  const canRedo = useMemo(() => historyRef.current.redo.length > 0, [historyVersion]);

  return {
    historyRef,
    pushHistoryAction,
    undoLastAction,
    redoLastAction,
    canUndo,
    canRedo,
    historyVersion,
  };
}

/**
 * PieceSetContext — global state for chess piece visual style.
 *
 * Persists to localStorage. Default = react-chessboard built-in.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  PIECE_SETS,
  buildPieceRenderObject,
  readPieceSet,
  writePieceSet,
  type PieceRenderObject,
  type PieceSetId,
  type PieceSetOption,
} from './pieceSets';

type PieceSetContextValue = {
  id: PieceSetId;
  /** undefined = use library built-in. */
  pieces: PieceRenderObject | undefined;
  setId: (id: PieceSetId) => void;
  options: PieceSetOption[];
};

const PieceSetContext = createContext<PieceSetContextValue | null>(null);

export function PieceSetProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [id, setIdState] = useState<PieceSetId>(() => readPieceSet());

  const setId = useCallback((next: PieceSetId): void => {
    setIdState(next);
    writePieceSet(next);
  }, []);

  const pieces = useMemo(() => buildPieceRenderObject(id), [id]);

  const value = useMemo<PieceSetContextValue>(
    () => ({ id, pieces, setId, options: PIECE_SETS }),
    [id, pieces, setId]
  );

  return <PieceSetContext.Provider value={value}>{children}</PieceSetContext.Provider>;
}

export function usePieceSet(): PieceSetContextValue {
  const ctx = useContext(PieceSetContext);
  if (ctx === null) {
    throw new Error('usePieceSet must be used within <PieceSetProvider>');
  }
  return ctx;
}

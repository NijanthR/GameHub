// Premium Chess Pieces using styled Unicode symbols
// Much crisper, more recognizable, and visually beautiful

const SYMBOLS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

export default function ChessPiece({ type, color, size, className = '' }) {
  if (!type || !color) return null;

  const symbol = SYMBOLS[color]?.[type];
  if (!symbol) return null;

  const isWhite = color === 'w';

  return (
    <div
      className={`chess-piece-token ${isWhite ? 'white-piece' : 'black-piece'} ${className}`}
      style={size ? { '--piece-size': `${size}px` } : undefined}
      data-piece={type}
      data-color={color}
    >
      <span className="piece-symbol">{symbol}</span>
      <span className="piece-shadow-layer">{symbol}</span>
    </div>
  );
}

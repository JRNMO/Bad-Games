import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, ArrowDown } from 'lucide-react';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 30;
const INITIAL_DROP_SPEED = 1000;
const FAST_DROP_SPEED = 50;
const SPEED_INCREASE_FACTOR = 0.95;
const SPEED_INCREASE_INTERVAL = 30000; // 30 seconds

const SHAPES = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[1, 1, 1], [0, 1, 0]],
  [[1, 1, 1], [1, 0, 0]],
  [[1, 1, 1], [0, 0, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]]
];

const TetrisGame = () => {
  const [board, setBoard] = useState(() => 
    Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0))
  );
  const [currentPiece, setCurrentPiece] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('tetrisHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [gameOver, setGameOver] = useState(false);
  const [dropSpeed, setDropSpeed] = useState(INITIAL_DROP_SPEED);
  const [level, setLevel] = useState(1);
  const [isFastDropping, setIsFastDropping] = useState(false);

  const lastDropTime = useRef(Date.now());
  const requestRef = useRef();
  const audioRef = useRef(new Audio('/api/placeholder/400/320'));

  const isValidMove = useCallback((piece, pos) => {
    if (!piece) return false;
    for (let y = 0; y < piece.length; y++) {
      for (let x = 0; x < piece[y].length; x++) {
        if (piece[y][x]) {
          const newX = pos.x + x;
          const newY = pos.y + y;
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT || (newY >= 0 && board[newY][newX])) {
            return false;
          }
        }
      }
    }
    return true;
  }, [board]);

  const spawnPiece = useCallback(() => {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const newPosition = { 
      x: Math.floor(BOARD_WIDTH / 2) - Math.floor(shape[0].length / 2), 
      y: 0 
    };
    if (isValidMove(shape, newPosition)) {
      setCurrentPiece(shape);
      setPosition(newPosition);
      lastDropTime.current = Date.now();
    } else {
      setGameOver(true);
    }
  }, [isValidMove]);

  const mergePiece = useCallback(() => {
    if (!currentPiece) return;
    setBoard(prevBoard => {
      const newBoard = prevBoard.map(row => [...row]);
      for (let y = 0; y < currentPiece.length; y++) {
        for (let x = 0; x < currentPiece[y].length; x++) {
          if (currentPiece[y][x]) {
            newBoard[position.y + y][position.x + x] = 1;
          }
        }
      }
      return newBoard;
    });
    spawnPiece();
  }, [currentPiece, position, spawnPiece]);

  const moveLeft = useCallback(() => {
    if (isValidMove(currentPiece, { x: position.x - 1, y: position.y })) {
      setPosition(prev => ({ ...prev, x: prev.x - 1 }));
    }
  }, [currentPiece, isValidMove, position]);

  const moveRight = useCallback(() => {
    if (isValidMove(currentPiece, { x: position.x + 1, y: position.y })) {
      setPosition(prev => ({ ...prev, x: prev.x + 1 }));
    }
  }, [currentPiece, isValidMove, position]);

  const rotate = useCallback(() => {
    if (!currentPiece) return;
    const rotated = currentPiece[0].map((_, index) =>
      currentPiece.map(row => row[index]).reverse()
    );
    if (isValidMove(rotated, position)) {
      setCurrentPiece(rotated);
    }
  }, [currentPiece, isValidMove, position]);

  const fastDrop = useCallback(() => {
    setIsFastDropping(true);
  }, []);

  const stopFastDrop = useCallback(() => {
    setIsFastDropping(false);
  }, []);

  const clearLines = useCallback(() => {
    setBoard(prevBoard => {
      const newBoard = prevBoard.filter(row => row.some(cell => cell === 0));
      const clearedLines = BOARD_HEIGHT - newBoard.length;
      if (clearedLines > 0) {
        setScore(prevScore => {
          const newScore = prevScore + clearedLines * 100;
          if (newScore > highScore) {
            setHighScore(newScore);
            localStorage.setItem('tetrisHighScore', newScore.toString());
          }
          return newScore;
        });
      }
      while (newBoard.length < BOARD_HEIGHT) {
        newBoard.unshift(Array(BOARD_WIDTH).fill(0));
      }
      return newBoard;
    });
  }, [highScore]);

  const gameLoop = useCallback(() => {
    if (gameOver) return;
    
    const now = Date.now();
    const deltaTime = now - lastDropTime.current;
    
    if (deltaTime > (isFastDropping ? FAST_DROP_SPEED : dropSpeed)) {
      if (isValidMove(currentPiece, { x: position.x, y: position.y + 1 })) {
        setPosition(prev => ({ ...prev, y: prev.y + 1 }));
      } else {
        mergePiece();
        clearLines();
      }
      lastDropTime.current = now;
    }
    
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [clearLines, currentPiece, dropSpeed, gameOver, isFastDropping, isValidMove, mergePiece, position]);

  useEffect(() => {
    if (!currentPiece && !gameOver) {
      spawnPiece();
    }
  }, [currentPiece, gameOver, spawnPiece]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameLoop]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (gameOver) return;
      if (event.key === 'ArrowLeft' || event.key === 'a') moveLeft();
      if (event.key === 'ArrowRight' || event.key === 'd') moveRight();
      if (event.key === 'ArrowUp' || event.key === 'w') rotate();
      if (event.key === 'ArrowDown' || event.key === 's') fastDrop();
      if (event.key === ' ') {
        event.preventDefault();
        while (isValidMove(currentPiece, { x: position.x, y: position.y + 1 })) {
          setPosition(prev => ({ ...prev, y: prev.y + 1 }));
        }
        mergePiece();
      }
    };

    const handleKeyUp = (event) => {
      if (event.key === 'ArrowDown' || event.key === 's') stopFastDrop();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentPiece, fastDrop, gameOver, isValidMove, mergePiece, moveLeft, moveRight, position, rotate, stopFastDrop]);

  useEffect(() => {
    const increaseDifficulty = () => {
      setDropSpeed(prevSpeed => prevSpeed * SPEED_INCREASE_FACTOR);
      setLevel(prevLevel => prevLevel + 1);
    };

    const difficultyInterval = setInterval(increaseDifficulty, SPEED_INCREASE_INTERVAL);

    return () => clearInterval(difficultyInterval);
  }, []);

  const renderBoard = () => {
    const boardWithPiece = board.map(row => [...row]);
    if (currentPiece) {
      for (let y = 0; y < currentPiece.length; y++) {
        for (let x = 0; x < currentPiece[y].length; x++) {
          if (currentPiece[y][x] && position.y + y >= 0) {
            boardWithPiece[position.y + y][position.x + x] = 2;
          }
        }
      }
    }
    return boardWithPiece.map((row, y) => (
      <div key={y} className="flex">
        {row.map((cell, x) => (
          <div
            key={x}
            className={`border border-gray-300 ${
              cell === 1 ? 'bg-blue-500' : cell === 2 ? 'bg-red-500' : 'bg-white'
            }`}
            style={{ width: CELL_SIZE, height: CELL_SIZE }}
          />
        ))}
      </div>
    ));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="mb-2 text-2xl font-bold">Score: {score}</div>
      <div className="mb-2 text-xl">High Score: {highScore}</div>
      <div className="mb-2 text-xl">Level: {level}</div>
      <div className="border-4 border-gray-400 bg-white p-2" style={{ width: BOARD_WIDTH * CELL_SIZE, height: BOARD_HEIGHT * CELL_SIZE }}>
        {renderBoard()}
      </div>
      {gameOver && (
        <div className="mt-4 text-2xl font-bold text-red-500">Game Over!</div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <button
          className="bg-blue-500 text-white p-4 rounded-full"
          onClick={moveLeft}
        >
          <ArrowLeft size={32} />
        </button>
        <button
          className="bg-blue-500 text-white p-4 rounded-full"
          onTouchStart={fastDrop}
          onTouchEnd={stopFastDrop}
          onMouseDown={fastDrop}
          onMouseUp={stopFastDrop}
          onMouseLeave={stopFastDrop}
        >
          <ArrowDown size={32} />
        </button>
        <button
          className="bg-blue-500 text-white p-4 rounded-full"
          onClick={moveRight}
        >
          <ArrowRight size={32} />
        </button>
        <button
          className="bg-blue-500 text-white p-4 rounded-full col-start-2"
          onClick={rotate}
        >
          <RotateCw size={32} />
        </button>
      </div>
    </div>
  );
};

export default TetrisGame;

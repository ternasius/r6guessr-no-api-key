import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './GamePage.css';
import mapData from '../../data/maps.json';
import { getRandomMysteryImage, calculateScore, submitGuess } from '../../services/firebaseService';

const TOTAL_ROUNDS = 5;

const GamePage = () => {// Game state
  const [gameState, setGameState] = useState('loading');
  const [selectedMap, setSelectedMap] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [markerPosition, setMarkerPosition] = useState({ x: 0, y: 0 });
  const [markerPlaced, setMarkerPlaced] = useState(false);
  const [isInitialMarkerPlacement, setIsInitialMarkerPlacement] = useState(true);
  const [maps, setMaps] = useState([]);
  const [currentMysteryImage, setCurrentMysteryImage] = useState(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [playerGuessCoords, setPlayerGuessCoords] = useState(null);
  const [isCorrectMapAndFloor, setIsCorrectMapAndFloor] = useState(false);
  
  // round tracking
  const [currentRound, setCurrentRound] = useState(1);
  const [roundScores, setRoundScores] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // refs
  const floorImageRef = useRef(null);
  const floorImageElementRef = useRef(null);
  const mapContainerRef = useRef(null);
  const resultMapRef = useRef(null);
  
  // zoom and pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // mouse tracking for drag vs. click
  const [mouseDownTime, setMouseDownTime] = useState(0);
  const [hasMovedEnough, setHasMovedEnough] = useState(false);

  // store seen mystery images
  const [mysteryImages, setMysteryImages] = useState([]);

  const navigate = useNavigate();
  
  useEffect(() => {
    const handleBeforeUnload = () => {
      return "";
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    const handleUnload = () => {
      sessionStorage.setItem('pageRefreshed', 'true');
    };
    
    window.addEventListener('unload', handleUnload);
    
    const wasRefreshed = sessionStorage.getItem('pageRefreshed') === 'true';
    if (wasRefreshed) {
      wipeImages();

      sessionStorage.removeItem('pageRefreshed');
      navigate('/');
    }
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);

      wipeImages();
    };
  }, [navigate]);

  useEffect(() => {
    const initializeGame = async () => {
      setLoading(true);
      setMaps(mapData);
      
      await startNewRound();
      
      setLoading(false);
      setGameState('selectMap');
    };

    initializeGame();
  }, []);

  const startNewRound = async () => {
    try {
      // reset game state
      setSelectedMap(null);
      setSelectedFloor(null);
      setMarkerPlaced(false);
      setIsInitialMarkerPlacement(true);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setPlayerGuessCoords(null);
      setIsCorrectMapAndFloor(false);
      
      const mysteryImage = await getRandomMysteryImage();
      setCurrentMysteryImage(mysteryImage);
      setMysteryImages(prevImages => [...prevImages, mysteryImage]);
      
      return true;
    } catch (error) {
      console.error('Error starting new round:', error);
      return false;
    }
  };

  // reset zoom and position when changing floors or maps
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [selectedMap, selectedFloor]);

  useEffect(() => {
    const handleWheelEvent = (e) => {
      e.preventDefault();
      
      const zoomIn = e.deltaY < 0;
      const scaleFactor = 0.1;
      const prevScale = scale;
      let newScale;
      
      if (zoomIn) {
        newScale = Math.min(prevScale + scaleFactor, 4);
      } else {
        newScale = Math.max(prevScale - scaleFactor, 1);
      }
      
      if (newScale !== prevScale) {
        // if zooming out to scale 1, reset position to center
        if (newScale === 1) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
          return;
        }
        
        const rect = floorImageRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const scaleDiff = newScale - prevScale;
        
        const newPosX = position.x - (mouseX - rect.width/2) * (scaleDiff / prevScale);
        const newPosY = position.y - (mouseY - rect.height/2) * (scaleDiff / prevScale);
        
        setScale(newScale);
        setPosition({ x: newPosX, y: newPosY });
      }
    };
  
    const floorMapElement = floorImageRef.current;
    if (floorMapElement && gameState === 'placeMarker') {
      floorMapElement.addEventListener('wheel', handleWheelEvent, { passive: false });
    }
    
    return () => {
      if (floorMapElement) {
        floorMapElement.removeEventListener('wheel', handleWheelEvent);
      }
    };
  }, [scale, position, floorImageRef, gameState]);
  
  const handleMapSelect = (map) => {
    setSelectedMap(map);
    setGameState('selectFloor');
    setMarkerPlaced(false);
    setIsInitialMarkerPlacement(true);
  };

  const handleFloorSelect = (floor) => {
    setSelectedFloor(floor);
    setGameState('placeMarker');
    setMarkerPlaced(false);
    setIsInitialMarkerPlacement(true);
  };

  const handlePlaceMarker = (e) => {
    if (gameState === 'placeMarker' && floorImageRef.current && floorImageElementRef.current && !isDragging) {
      const mapContainer = floorImageRef.current;
      const mapRect = mapContainer.getBoundingClientRect();
      
      const clickX = e.clientX - mapRect.left;
      const clickY = e.clientY - mapRect.top;
      
      const centerX = mapRect.width / 2;
      const centerY = mapRect.height / 2;
      
      const imageX = ((clickX - centerX) / scale) + centerX - (position.x / scale);
      const imageY = ((clickY - centerY) / scale) + centerY - (position.y / scale);
      
      setMarkerPosition({ x: imageX, y: imageY });
      
      if (!markerPlaced) {
        setMarkerPlaced(true);
      } else {
        setIsInitialMarkerPlacement(false);
      }
    }
  };

  const calculateImageCoordinates = (markerPos) => {
    if (!floorImageRef.current || !floorImageElementRef.current) {
      return null;
    }
    
    const mapContainer = floorImageRef.current;
    const image = floorImageElementRef.current;
    const mapRect = mapContainer.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    
    const displayedWidth = imageRect.width / scale;
    const displayedHeight = imageRect.height / scale;
    
    const imageOffsetX = (mapRect.width - displayedWidth) / 2;
    const imageOffsetY = (mapRect.height - displayedHeight) / 2;
    
    const relativeX = markerPos.x - imageOffsetX;
    const relativeY = markerPos.y - imageOffsetY;
    
    const widthRatio = naturalWidth / displayedWidth;
    const heightRatio = naturalHeight / displayedHeight;
    
    const originalX = relativeX * widthRatio;
    const originalY = relativeY * heightRatio;
    
    const percentX = (originalX / naturalWidth) * 100;
    const percentY = (originalY / naturalHeight) * 100;
    
    return { 
      imageRect, mapRect, naturalWidth, naturalHeight, displayedWidth,
      displayedHeight, imageOffsetX, imageOffsetY, relativeX, relativeY,
      originalX, originalY, percentX, percentY
    };
  };

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.5, 1));
  };

  const handleMouseDown = (e) => {
    setMouseDownTime(Date.now());
    setDragStart({ x: e.clientX, y: e.clientY });
    setHasMovedEnough(false);
  };

  const handleMouseMove = (e) => {
    if (scale > 1 && mouseDownTime > 0) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // if moved more than 5 pixels, consider it a drag operation
      if (distance > 5) {
        setHasMovedEnough(true);
        setIsDragging(true);
        
        const newX = position.x + dx;
        const newY = position.y + dy;
        
        const maxPanX = (scale - 1) * floorImageRef.current.clientWidth / 2;
        const maxPanY = (scale - 1) * floorImageRef.current.clientHeight / 2;
        
        const constrainedX = Math.max(-maxPanX, Math.min(maxPanX, newX));
        const constrainedY = Math.max(-maxPanY, Math.min(maxPanY, newY));
        
        setPosition({
          x: constrainedX,
          y: constrainedY
        });
        
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseUp = (e) => {
    const mouseUpTime = Date.now();
    const mouseHeldDuration = mouseUpTime - mouseDownTime;
    
    if (isDragging) {
      setIsDragging(false);
    }
    
    // only place marker if:
    // 1. mouse wasn't held down for too long (less than 200ms is a click)
    // 2. mouse didn't move much (less than 5 pixels is a click)
    if (mouseHeldDuration < 200 && !hasMovedEnough) {
      handlePlaceMarker(e);
    }
    
    setMouseDownTime(0);
    setHasMovedEnough(false);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
    }
    setMouseDownTime(0);
    setHasMovedEnough(false);
  };

  const handleSubmitGuess = async () => {
    if (isSubmitting) return; // prevent multiple submissions
  
    if (!currentMysteryImage || !currentMysteryImage.id) {
      alert('Error: No mystery image loaded');
      return;
    }
    
    if (!markerPlaced || !selectedMap || !selectedFloor) {
      alert('Please place a marker on the map to make your guess');
      return;
    }

    setIsSubmitting(true);
    
    const coords = calculateImageCoordinates(markerPosition);
    if (!coords) {
      alert('Error: Could not calculate coordinates');
      setIsSubmitting(false);
      return;
    }
    
    const playerGuess = {
      mapId: selectedMap.id,
      floorName: selectedFloor.name,
      x: coords.percentX,
      y: coords.percentY
    };
    
    setPlayerGuessCoords({
      x: coords.percentX,
      y: coords.percentY
    });
    
    const isCorrectMap = playerGuess.mapId === currentMysteryImage.mapId;
    const isCorrectFloor = playerGuess.floorName === currentMysteryImage.floorName;
    
    setIsCorrectMapAndFloor(isCorrectMap && isCorrectFloor);
    
    const score = calculateScore(currentMysteryImage, playerGuess);
    
    await submitGuess(currentMysteryImage.id, playerGuess, score);
    
    setCurrentScore(score);
    setRoundScores(prevScores => [...prevScores, score]);
    setTotalScore(prevTotal => prevTotal + score);
    
    setGameState('showScore');
    setIsSubmitting(false);
  };

  const handleNextRound = async () => {
    if (currentRound >= TOTAL_ROUNDS) {
      setGameState('gameOver');
    } else {
      setLoading(true);
      const success = await startNewRound();
      setLoading(false);
      
      if (success) {
        setCurrentRound(prevRound => prevRound + 1);
        setGameState('selectMap');
      } else {
        alert('Error loading next round. Please try again.');
      }
    }
  };

  const handleRestartGame = async () => {
    setLoading(true);
    setCurrentRound(1);
    setRoundScores([]);
    setTotalScore(0);
    wipeImages();
    
    const success = await startNewRound();
    setLoading(false);
    
    if (success) {
      setGameState('selectMap');
    } else {
      alert('Error restarting game. Please try again.');
    }
  };

  const handleBack = () => {
    if (gameState === 'selectFloor') {
      setGameState('selectMap');
      setSelectedMap(null);
    } else if (gameState === 'placeMarker') {
      setGameState('selectFloor');
      setSelectedFloor(null);
      setMarkerPlaced(false);
      setIsInitialMarkerPlacement(true);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  const getMapImageUrl = (map) => {
    return map.keyart;
  };

  const getFloorImageUrl = (map, floor) => {
    return floor.img;
  };

  const findMapById = (mapId) => {
    return maps.find(map => map.id === mapId);
  };

  const findFloorByName = (map, floorName) => {
    if (!map || !map.floors) return null;
    return map.floors.find(floor => floor.name === floorName.replace(/_/g, ' '));
  };

  const getMapNameById = (mapId) => {
    const map = findMapById(mapId);
    return map ? map.name : mapId;
  };

  const preventDrag = (e) => {
    e.preventDefault();
  };

  // clear currentMysteryImage and mysteryImages
  const wipeImages = () => {
    setCurrentMysteryImage(null);
    setMysteryImages([]);
    sessionStorage.removeItem('currentMysteryImage');
    sessionStorage.removeItem('mysteryImages');
  }

  return (
    <div className="game-page">
      {gameState !== 'loading' && gameState !== 'gameOver' && (
        <div className="global-round-indicator">
          Round {currentRound} of {TOTAL_ROUNDS}
        </div>
      )}

      <div className="game-container">
        <div className="options-panel">
          {gameState === 'selectMap' && (
            <div className="map-selection">
              <h2>Select a Map</h2>
              <div className="map-list">
                {maps.map((map) => (
                  <div 
                    key={map.id}
                    className="map-option"
                    onClick={() => handleMapSelect(map)}
                    style={{
                      backgroundImage: `url(${getMapImageUrl(map)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                    onDragStart={preventDrag}
                  >
                    <div className="map-name-overlay">{map.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gameState === 'selectFloor' && selectedMap && (
            <div className="floor-selection">
              <h2>Select a Floor</h2>
              <div className="floor-list">
                {selectedMap.floors.map((floor, index) => (
                  <div 
                    key={index}
                    className="floor-option"
                    onClick={() => handleFloorSelect(floor)}
                  >
                    <div className="floor-image-container">
                      <img 
                        src={getFloorImageUrl(selectedMap, floor)} 
                        alt={`${selectedMap.name} - ${floor.name}`}
                        className="floor-preview-image"
                        draggable="false"
                        onDragStart={preventDrag}
                      />
                    </div>
                    <div className="floor-name">{floor.name}</div>
                  </div>
                ))}
              </div>
              <button className="back-button" onClick={handleBack}>
                Back to Map Selection
              </button>
            </div>
          )}

          {gameState === 'placeMarker' && selectedMap && selectedFloor && (
            <div className="floor-map-container">
              <div className="zoom-controls">
                <button className="zoom-button" onClick={handleZoomIn}>+</button>
                <button className="zoom-button" onClick={handleZoomOut}>−</button>
                {scale > 1 && (
                  <button className="zoom-button" onClick={() => {
                    setScale(1);
                    setPosition({ x: 0, y: 0 });
                  }}>Reset</button>
                )}
                <span className="zoom-level">{Math.round(scale * 100)}%</span>
              </div>
              
              <div 
                className={`floor-map ${scale > 1 ? (isDragging ? 'grabbing' : 'grabbable') : 'crosshair'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                ref={floorImageRef}
              >
                <div 
                  className="floor-map-content"
                  style={{
                    transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                    transformOrigin: 'center center'
                  }}
                  ref={mapContainerRef}
                >
                  <img 
                    ref={floorImageElementRef}
                    src={getFloorImageUrl(selectedMap, selectedFloor)} 
                    alt={`${selectedMap.name} - ${selectedFloor.name}`}
                    className="floor-image"
                    draggable="false"
                    onDragStart={preventDrag}
                  />
                  
                  {markerPlaced && (
                    <div 
                      className={`geoguessr-marker ${isInitialMarkerPlacement ? 'initial-drop' : ''}`}
                      style={{ 
                        position: 'absolute',
                        left: `${markerPosition.x}px`, 
                        top: `${markerPosition.y}px`
                      }}
                    ></div>
                  )}
                </div>
              </div>
              
              <div className="button-group">
                <button className="back-button" onClick={handleBack}>
                  Back to Floor Selection
                </button>
                <button 
                  className="submit-button" 
                  onClick={handleSubmitGuess}
                  disabled={!markerPlaced}
                >
                  Submit Guess
                </button>
              </div>
            </div>
          )}
          
          {gameState === 'showScore' && (
            <div className="score-display">
              <h2>Your Score</h2>
              <div className="score-value">{currentScore} / 100</div>
              <div className="score-breakdown">
                <p>Map: {currentScore >= 15 ? '✓ 15 points' : '✗ 0 points'}</p>
                <p>Floor: {currentScore >= 30 ? '✓ 15 points' : '✗ 0 points'}</p>
                <p>Location: {currentScore - (currentScore >= 30 ? 30 : (currentScore >= 15 ? 15 : 0))} points</p>
              </div>
              
              <div className="result-map-container">
                <h3>Correct Location</h3>
                {currentMysteryImage && (
                  <div className="result-map" ref={resultMapRef}>
                    {(() => {
                      const correctMap = findMapById(currentMysteryImage.mapId);
                      const correctFloor = correctMap ? 
                        findFloorByName(correctMap, currentMysteryImage.floorName) : null;
                      
                      if (correctMap && correctFloor) {
                        return (
                          <>
                            <div className="result-floor-image-container">
                              <img 
                                src={getFloorImageUrl(correctMap, correctFloor)}
                                alt="Floor Map"
                                className="result-floor-image"
                                draggable="false"
                                onDragStart={preventDrag}
                              />
                              
                              {isCorrectMapAndFloor && playerGuessCoords && (
                                <div 
                                  className="player-marker"
                                  style={{ 
                                    left: `${playerGuessCoords.x}%`, 
                                    top: `${playerGuessCoords.y}%` 
                                  }}
                                ></div>
                              )}
                              
                              <div 
                                className="correct-marker"
                                style={{ 
                                  left: `${currentMysteryImage.correctX}%`, 
                                  top: `${currentMysteryImage.correctY}%` 
                                }}
                              ></div>
                              
                              {isCorrectMapAndFloor && playerGuessCoords && (
                                <svg className="marker-connection" width="100%" height="100%" preserveAspectRatio="none">
                                  <line 
                                    x1={`${playerGuessCoords.x}%`}
                                    y1={`${playerGuessCoords.y}%`}
                                    x2={`${currentMysteryImage.correctX}%`}
                                    y2={`${currentMysteryImage.correctY}%`}
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                    strokeDasharray="5,5"
                                  />
                                </svg>
                              )}
                            </div>
                          </>
                        );
                      } else {
                        return <div>Map data not available</div>;
                      }
                    })()}
                  </div>
                )}
                <div className="marker-legend">
                  {isCorrectMapAndFloor && (
                    <div className="legend-item">
                      <div className="legend-marker player-marker"></div>
                      <span className="legend-label">Your Guess</span>
                    </div>
                  )}
                  <div className="legend-item">
                    <div className="legend-marker correct-marker"></div>
                    <span className="legend-label">Correct Location</span>
                  </div>
                </div>
              </div>
              
              <div className="correct-location">
                <p>Correct location was:</p>
                <p>Map: {getMapNameById(currentMysteryImage?.mapId)}</p>
                <p>Floor: {currentMysteryImage?.floorName.replace(/_/g, ' ')}</p>
              </div>
              <button className="next-round-button" onClick={handleNextRound}>
                {currentRound >= TOTAL_ROUNDS ? 'See Final Score' : 'Next Round'}
              </button>
            </div>
          )}
          
          {gameState === 'gameOver' && (
            <div className="game-over">
              <h2>Game Over</h2>
              <div className="final-score">
                <h3>Final Score</h3>
                <div className="score-value">{totalScore} / {TOTAL_ROUNDS * 100}</div>
              </div>
              
              <div className="round-scores">
                <h3>Round Scores</h3>
                <ul>
                  {roundScores.map((score, index) => (
                    <li key={index}>
                      <span>Round {index + 1}:</span> <span>{score} / 100</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <button className="restart-button" onClick={handleRestartGame}>
                Play Again
              </button>
            </div>
          )}
        </div>

        <div className="image-display">
          {gameState === 'gameOver' ? (
            <div className="mystery-images-gallery">
              <h2>Mystery Locations</h2>
              <div className="mystery-images-grid">
                {mysteryImages.map((image, index) => (
                  <div key={index} className="mystery-image-item">
                    <img 
                      src={image.url} 
                      alt={`Mystery location ${index + 1}`} 
                      className="gallery-image"
                    />
                    <div className="image-caption">
                      Round {index + 1}: {getMapNameById(image.mapId)} - {image.floorName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {currentMysteryImage ? (
                <img 
                  src={currentMysteryImage.url} 
                  alt="Mystery location" 
                  className="mystery-image"
                  draggable="false"
                  onDragStart={preventDrag}
                />
              ) : (
                <div className="loading-image">Loading mystery image...</div>
              )}
              <h2 className="question-text">Which map does this image belong to?</h2>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GamePage;

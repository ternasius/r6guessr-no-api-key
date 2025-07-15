import React, { useState, useRef, useEffect } from 'react';
import './HomePage.css';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();
  const [showRules, setShowRules] = useState(false);
  const rulesContentRef = useRef(null);

  const handleStartGame = () => {
    navigate('/game');
  };

  const toggleRules = () => {
    setShowRules(!showRules);
  };

  const handleOutsideClick = (e) => {
    if (e.target.className === 'rules-popup') {
      setShowRules(false);
    }
  };

  return (
    <div className="homepage">
      <div className="content">
        <h1 className="title">R6GUESSR</h1>
        <p className="subtitle">Test your Rainbow Six Siege map knowledge</p>
        
        <div className="buttons-container">
          <button 
            className="start-button"
            onClick={handleStartGame}
            aria-label="Start Game"
          >
            START GAME
          </button>
          <button 
            className="rules-button"
            onClick={toggleRules}
            aria-label="Game Rules"
          >
            RULES
          </button>
        </div>
        
        {showRules && (
          <div className="rules-popup" onClick={handleOutsideClick}>
            <div className="rules-content">
              <h2>How to Play</h2>
              <p>You will be shown a screenshot from a Rainbow Six Siege map</p>
              <p>Select the correct map and floor, and place a marker as close as possible to where the image was taken</p>
              <p>Score points based on accuracy:</p>
              <ul>
                <li>15 points for correct map</li>
                <li>15 points for correct floor</li>
                <li>Up to 70 points for marker accuracy</li>
              </ul>
              <p>Complete 5 rounds to finish the game</p>
              <h2>Technicalities</h2>
              <p>The roof and the grounds outside the building are grouped in the "Exterior" floor</p>
              <p>The names of the other floors are given by Ubisoft, don't come at me for the poor naming scheme</p>
              <button className="close-button" onClick={toggleRules}>Close</button>
            </div>
          </div>
        )}
        <p className="credits">All images © 2015-2025 Ubisoft Entertainment. Rainbow Six Siege is a registered trademark of Ubisoft Entertainment.</p>
      </div>
    </div>
  );
};

export default HomePage;

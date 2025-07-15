import React, { useState, useEffect } from 'react';
import { uploadMysteryImage, resetAllMysteryImageStats } from './utils';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import mapData from '../data/maps.json';
import './AdminPage.css';
import AdminLogin from './AdminLogin';

const AdminPage = () => {
  const [maps, setMaps] = useState([]);
  const [selectedMap, setSelectedMap] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [file, setFile] = useState(null);
  const [correctX, setCorrectX] = useState(50);
  const [correctY, setCorrectY] = useState(50);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);

  useEffect(() => {
    setMaps(mapData);
  }, []);

  const checkIfAdmin = (email) => {
    // replace with your email
    const adminEmails = ['emails here'];
    return adminEmails.includes(email);
  };
  
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAdmin(user ? checkIfAdmin(user.email) : false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return <div className="admin-page">Loading...</div>;
  }

  if (!user) {
    return <AdminLogin />;
  }

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-unauthorized">
          <h1>Unauthorized Access</h1>
          <p>You do not have permission to access this page.</p>
          <p>Current user: {user.email}</p>
          <button className="admin-upload-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  const handleMapSelect = (map) => {
    setSelectedMap(map);
    setSelectedFloor(null);
    setFile(null);
    setPreviewUrl(null);
    setCorrectX(50);
    setCorrectY(50);
  };

  const handleFloorSelect = (floor) => {
    setSelectedFloor(floor);
    setFile(null);
    setPreviewUrl(null);
    setCorrectX(50);
    setCorrectY(50);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // reset marker position to center when a new image is selected
      setCorrectX(50);
      setCorrectY(50);
      
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleImageClick = (e) => {
    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setCorrectX(Math.round(x * 100) / 100);
    setCorrectY(Math.round(y * 100) / 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedMap || !selectedFloor || !file) {
      setMessage('Please select a map, floor, and file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setMessage('File is too large. Please select an image smaller than 5MB.');
        return;
    }

    setUploading(true);
    setMessage('Uploading...');
    
    // add timeout to prevent infinite loading
    const uploadTimeout = setTimeout(() => {
      setUploading(false);
      setMessage('Upload timed out. Please try again.');
    }, 30000); // 30 seconds timeout
    
    try {
      if (!navigator.onLine) {
        throw new Error('You are offline. Please check your internet connection and try again.');
      }

      const result = await uploadMysteryImage(
        file, 
        selectedMap.id, 
        selectedFloor.name, 
        correctX, 
        correctY
      );
      
      clearTimeout(uploadTimeout);
      
      if (result.success) {
        setMessage('Upload successful!');
        setUploadedImages([...uploadedImages, {
          id: result.imageId,
          url: result.url,
          mapId: selectedMap.id,
          floorName: selectedFloor.name,
          correctX,
          correctY
        }]);
        
        setFile(null);
        setPreviewUrl(null);
        setCorrectX(50);
        setCorrectY(50);
      } else {
        setMessage(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      clearTimeout(uploadTimeout);
      setMessage(`Error: ${error.message}`);
      console.error('Upload error:', error);
    } finally {
      clearTimeout(uploadTimeout);
      setUploading(false);
    }
  };
  

  const getFloorImageUrl = (map, floor) => {
    if (floor.img) {
      return floor.img;
    }
    
    // fallback to a path based on map ID and floor name
    return `/images/maps/${map.id}/${floor.name}.jpg`;
  };

  const handleResetStats = async () => {
    if (isResetting) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to reset all mystery image statistics? This action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    setIsResetting(true);
    setResetMessage({ type: 'info', text: 'Resetting statistics...' });
    
    try {
      const result = await resetAllMysteryImageStats(user.email);
      
      if (result.success) {
        setResetMessage({
          type: 'success',
          text: `Successfully reset statistics for ${result.count} mystery images.`
        });
      } else {
        setResetMessage({
          type: 'error',
          text: `Failed to reset statistics: ${result.error}`
        });
      }
    } catch (error) {
      setResetMessage({
        type: 'error',
        text: `An error occurred: ${error.message}`
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Upload Mystery Images</h1>
        <div className="admin-user-info">
          <span>Logged in as: {user.email}</span>
          <button className="admin-logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
      <div className="admin-container">
        <div className="admin-stats-section">
          <h2>Statistics Management</h2>
          <div className="admin-stats-controls">
            <button 
              className="admin-reset-button"
              onClick={handleResetStats}
              disabled={isResetting}
            >
              {isResetting ? 'Resetting...' : 'Reset All Statistics'}
            </button>
            {resetMessage && (
              <div className={`admin-message ${resetMessage.type}`}>
                {resetMessage.text}
              </div>
            )}
          </div>
        </div>
        
        <div className="admin-upload-form">
          <h2>Upload New Image</h2>
          <form onSubmit={handleSubmit}>
            <div className="admin-form-group">
              <label>Select Map:</label>
              <div className="admin-map-selection">
                <div className="admin-selection-container">
                  {maps.map((map) => (
                    <div 
                      key={map.id}
                      className={`admin-map-option ${selectedMap?.id === map.id ? 'selected' : ''}`}
                      onClick={() => handleMapSelect(map)}
                    >
                      {map.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {selectedMap && (
              <div className="admin-form-group">
                <label>Select Floor:</label>
                <div className="admin-floor-selection">
                  <div className="admin-selection-container">
                    {selectedMap.floors.map((floor, index) => (
                      <div 
                        key={index}
                        className={`admin-floor-option ${selectedFloor?.name === floor.name ? 'selected' : ''}`}
                        onClick={() => handleFloorSelect(floor)}
                      >
                        {floor.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {selectedFloor && (
              <>
                <div className="admin-form-group">
                  <label>Select Mystery Image:</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                  />
                </div>
                
                {previewUrl && (
                    <div className="admin-form-group">
                        <label>Set Correct Location:</label>
                        <p>Click on the floor map to set the correct location of the mystery image</p>
                        
                        <div className="admin-preview-section">
                        <div className="admin-preview-column">
                            <div className="admin-preview-title">Floor Map:</div>
                            <div className="admin-floor-map-preview">
                            <img 
                                src={getFloorImageUrl(selectedMap, selectedFloor)} 
                                alt={`${selectedMap.name} - ${selectedFloor.name}`}
                                className="admin-floor-map-image" 
                                onClick={handleImageClick}
                            />
                            <div 
                                className="admin-marker" 
                                style={{ 
                                left: `${correctX}%`, 
                                top: `${correctY}%` 
                                }}
                            ></div>
                            </div>
                        </div>
                        
                        <div className="admin-preview-column">
                            <div className="admin-preview-title">Mystery Image:</div>
                            <div className="admin-preview-container">
                            <img 
                                src={previewUrl} 
                                alt="Mystery Preview" 
                                className="admin-preview-image"
                            />
                            </div>
                        </div>
                        </div>
                        
                        <div className="admin-coordinates">
                        <div>
                            <label>X: </label>
                            <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            step="0.01" 
                            value={correctX} 
                            onChange={(e) => setCorrectX(parseFloat(e.target.value))} 
                            />
                            %
                        </div>
                        <div>
                            <label>Y: </label>
                            <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            step="0.01" 
                            value={correctY} 
                            onChange={(e) => setCorrectY(parseFloat(e.target.value))} 
                            />
                            %
                        </div>
                        </div>
                    </div>
                    )}          
                <div className="admin-form-group">
                  <button 
                    type="submit" 
                    disabled={!file || uploading}
                    className="admin-upload-button"
                  >
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </button>
                </div>
              </>
            )}
          </form>
          
          {message && (
            <div className={`admin-message ${message.includes('Error') || message.includes('failed') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}
        </div>
        
        <div className="admin-uploaded-images">
          <h2>Recently Uploaded Images</h2>
          
          {uploadedImages.length === 0 ? (
            <p>No images uploaded yet</p>
          ) : (
            <div className="admin-image-grid">
              {uploadedImages.map((image) => (
                <div key={image.id} className="admin-uploaded-image">
                  <div className="admin-image-info">
                    <p>Map: {image.mapId}</p>
                    <p>Floor: {image.floorName}</p>
                    <p>Position: ({image.correctX.toFixed(2)}%, {image.correctY.toFixed(2)}%)</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );  
};

export default AdminPage;

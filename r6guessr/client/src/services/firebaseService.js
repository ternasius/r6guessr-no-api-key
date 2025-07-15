import { db, storage } from '../firebase/config';
import { ref, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, addDoc, getCountFromServer } from 'firebase/firestore';

// // Fetch all maps (unimplemented for now, since its saved in maps.json)
// export const fetchMaps = async () => {
//   try {
//     const mapsCollection = collection(db, 'maps');
//     const mapsSnapshot = await getDocs(mapsCollection);
    
//     const maps = await Promise.all(mapsSnapshot.docs.map(async (doc) => {
//       const mapData = { id: doc.id, ...doc.data() };
      
//       // Get keyart URL from Storage
//       if (mapData.keyartPath) {
//         try {
//           mapData.keyart = await getDownloadURL(ref(storage, mapData.keyartPath));
//         } catch (error) {
//           console.error(`Error fetching keyart for map ${mapData.id}:`, error);
//           mapData.keyart = '/images/default-map.jpg'; // Fallback image
//         }
//       }
      
//       // Get floors with their images
//       if (mapData.floors) {
//         mapData.floors = await Promise.all(mapData.floors.map(async (floor) => {
//           if (floor.imgPath) {
//             try {
//               floor.img = await getDownloadURL(ref(storage, floor.imgPath));
//             } catch (error) {
//               console.error(`Error fetching floor image for ${mapData.id} - ${floor.name}:`, error);
//               floor.img = '/images/default-floor.jpg'; // Fallback image
//             }
//           }
//           return floor;
//         }));
//       }
      
//       return mapData;
//     }));
    
//     return maps;
//   } catch (error) {
//     console.error('Error fetching maps:', error);
//     throw error;
//   }
// };

// Get a random mystery image from database
export const getRandomMysteryImage = async () => {
  // Check if we're on the homepage
  if (window.location.pathname === '/') {
    return null;
  }

  try {
    console.log('Fetching random mystery image from database...');
    
    let selectedImage = {}; // var to hold selected image data (map object)
    let docId = null; // Store the actual document ID

    const coll = collection(db, 'mystery-images');

    // get image count
    const imageCountSnapshot = await getCountFromServer(coll);
    const imageCount = imageCountSnapshot.data().count;
    const randomIndex = Math.floor(Math.random() * imageCount) + 1;
    console.log("image: ", randomIndex, "/", imageCount);

    // Query for image by random ID
    const q = query(coll, where("id", "==", randomIndex));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => { // Should only have 1 document (unique ID), otherwise switch to forEach
      selectedImage = doc.data();
      docId = doc.id;
    });
    
    if (imageCount === 0) {
      console.log('No mystery images found, returning fallback image');
      return { url: '/images/mystery-location.jpg' }; // Fallback image
    }
    
    // Get the image URL if it doesn't already have one
    if (!selectedImage.url && selectedImage.storagePath) {
      try {
        selectedImage.url = await getDownloadURL(ref(storage, selectedImage.storagePath));
      } catch (error) {
        console.error(`Error fetching mystery image URL for ${selectedImage.id}:`, error);
        selectedImage.url = '/images/mystery-location.jpg'; // Fallback image
      }
    }
    
    // Add the document ID to the selectedImage object
    selectedImage.docId = docId;
    
    return selectedImage;
  } catch (error) {
    console.error('Error getting random mystery image from database:', error);
    return { url: '/images/mystery-location.jpg', id: null }; // Fallback image
  }
};

// Calculate score based on player's guess
export const calculateScore = (mysteryImage, playerGuess) => {
  if (!mysteryImage || !playerGuess) return 0;
  
  let score = 0;
  
  // 15 points for correct map
  if (playerGuess.mapId === mysteryImage.mapId) {
    score += 15;
    
    // 15 additional points for correct floor
    if (playerGuess.floorName === mysteryImage.floorName) {
      score += 15;
      
      // Up to 70 points based on distance
      if (mysteryImage.correctX !== undefined && 
          mysteryImage.correctY !== undefined && 
          playerGuess.x !== undefined && 
          playerGuess.y !== undefined) {
        
        // Calculate distance as percentage of the image size
        const dx = playerGuess.x - mysteryImage.correctX;
        const dy = playerGuess.y - mysteryImage.correctY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Convert distance to score (closer = higher score)
        const maxDistance = 50;
        const distanceScore = Math.max(0, 70 * (1 - distance / maxDistance));
        
        score += Math.round(distanceScore);
      }
    }
  }
  
  return score;
};

// Submit a guess and update statistics
export const submitGuess = async (mysteryImageId, playerGuess, score) => {
  if (!mysteryImageId) return;
  
  try {
    const mysteryImagesCollection = collection(db, 'mystery-images');
    const q = query(mysteryImagesCollection, where("id", "==", mysteryImageId));
    const querySnapshot = await getDocs(q);
    
    const docId = querySnapshot.docs[0].id; // should only have 1, but just in case

    // Get current image data
    const imageRef = doc(db, 'mystery-images', docId);
    const imageDoc = await getDoc(imageRef);
    
    if (imageDoc.exists()) {
      const imageData = imageDoc.data();
      const currentTimesShown = imageData.timesShown || 0;
      const currentTotalScore = imageData.totalScore || 0;
      
      // Calculate new average
      const newTotalScore = currentTotalScore + score;
      const newTimesShown = currentTimesShown + 1;
      const newAvgScore = newTotalScore / (newTimesShown);
      
      // Update the document
      await updateDoc(imageRef, {
        timesShown: newTimesShown,
        totalScore: newTotalScore,
        avgScore: newAvgScore
      });
      
      // Optionally, store the guess in a separate collection
      await addDoc(collection(db, 'guesses'), {
        mysteryImageId,
        mapId: playerGuess.mapId,
        floorName: playerGuess.floorName,
        x: playerGuess.x,
        y: playerGuess.y,
        score,
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('Error submitting guess:', error);
  }
};

// Check Firestore connection
export const checkFirestoreConnection = async () => {
  try {
    // try to get count from collection
    const mysteryImagesCollection = collection(db, 'mystery-images');
    await getCountFromServer(mysteryImagesCollection);
    
    console.log('Firestore connection successful');
    return true;
  } catch (error) {
    console.error('Firestore connection failed:', error);
    return false;
  }
};


checkFirestoreConnection().then(connected => {
  console.log('Firestore connected:', connected);
});

import { storage, db, auth } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL, updateMetadata } from 'firebase/storage';
import { collection, addDoc, getCountFromServer, getDocs, doc, updateDoc } from 'firebase/firestore';

export const uploadMysteryImage = async (file, mapId, floorName, correctX, correctY) => {
  try {
    const user = auth.currentUser;
    console.log('Current user:', user ? user.email : 'No user logged in');
    
    if (!user) {
      throw new Error('You must be logged in to upload images');
    }

    console.log('Starting upload process...', { mapId, floorName, correctX, correctY });

    const coll = collection(db, 'mystery-images');

    const imageCountSnapshot = await getCountFromServer(coll);
    const newImageId = imageCountSnapshot.data().count + 1;
    const storagePath = `mystery/${mapId}/${floorName}/${file["name"]}`;

    const storageRef = ref(storage, storagePath);

    let fileBlob = file;
    if (!(file instanceof Blob)) {
      fileBlob = new Blob([file], { type: file.type });
    }
    
    console.log('Uploading file to Storage...');
    const uploadResult = await uploadBytes(storageRef, fileBlob);
    const metadata = {
      contentType: file.type,
      customMetadata: {
        'Access-Control-Allow-Origin': '*'
      }
    };

    await updateMetadata(storageRef, metadata);
    
    console.log('File uploaded successfully:', uploadResult);
    const downloadURL = await getDownloadURL(ref(storage, storagePath));

    const newMysteryImage = {
      id: newImageId,
      mapId,
      floorName,
      correctX,
      correctY,
      url: downloadURL,
      timesShown: 0,
      totalScore: 0,
      avgScore: 0
    };

    // add newMysteryImage to database
    try {
      await addDoc(coll, {
        ...newMysteryImage
      });
    } catch (error) {
      console.log(error);
    }
    return {
      success: true,
      newImageId
    };
  } catch (error) {
    console.error('Error in uploadMysteryImage:', error);
    console.error('Error details:', error.code, error.message);
    
    if (error.code === 'storage/unauthorized') {
      console.error('Storage unauthorized. Check your security rules and authentication.');
    } else if (error.code === 'storage/quota-exceeded') {
      console.error('Storage quota exceeded.');
    }
    
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
};

export const resetAllMysteryImageStats = async (adminEmail) => {
  try {
    if (!adminEmail) {
      throw new Error('Admin email is required');
    }
    
    console.log('Admin attempting to reset statistics:', adminEmail);
    console.log('Resetting statistics for all mystery images...');
    
    const mysteryImagesCollection = collection(db, 'mystery-images');
    const querySnapshot = await getDocs(mysteryImagesCollection);
    
    let updatedCount = 0;
    
    const updatePromises = querySnapshot.docs.map(async (document) => {
      const docRef = doc(db, 'mystery-images', document.id);
      
      await updateDoc(docRef, {
        timesShown: 0,
        totalScore: 0,
        avgScore: 0
      });
      
      updatedCount++;
    });
    
    await Promise.all(updatePromises);
    
    console.log(`Successfully reset statistics for ${updatedCount} mystery images`);
    return { success: true, count: updatedCount };
  } catch (error) {
    console.error('Error resetting mystery image statistics:', error);
    return { success: false, error: error.message };
  }
};
